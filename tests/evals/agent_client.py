"""Helpers for the DeepEval suite: Groq judge model + client for the LangGraph agent server."""

import asyncio
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path

import requests
from deepeval.models.llms.utils import trim_and_load_json
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import ToolCall
from openai import AsyncOpenAI, OpenAI, RateLimitError

ROOT = Path(__file__).resolve().parents[2]
DATASET_PATH = Path(__file__).parent / ".dataset.json"
AGENT_URL = os.getenv("LANGGRAPH_API_URL", "http://localhost:2024")
ASSISTANT_ID = os.getenv("LANGGRAPH_ASSISTANT_ID", "agent")
# Prompt version the agent should use for this eval run (agent/support/prompt.ts).
PROMPT_VERSION = os.getenv("AGENT_PROMPT_VERSION", "v2")
AGENT_MODEL = os.getenv("AGENT_MODEL", "openai/gpt-oss-120b")


def _load_env_local() -> None:
    """Reuse GROQ_API_KEY from .env.local so the judge needs no extra setup."""
    env = ROOT / ".env.local"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


_load_env_local()


GROQ_BASE_URL = "https://api.groq.com/openai/v1"
MAX_RETRIES = 10
MAX_WAIT_S = 90  # longer waits mean the daily quota is gone; fail fast instead of hanging


class GroqQuotaExhausted(RuntimeError):
    pass


def _retry_after(err: RateLimitError) -> float:
    # Groq says "Please try again in 4.34s" (or "in 1m2.5s"); fall back to 10s.
    m = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", str(err))
    return (int(m.group(1) or 0) * 60 + float(m.group(2)) + 0.5) if m else 10.0


class GroqJudge(DeepEvalBaseLLM):
    """DeepEval judge on Groq's OpenAI-compatible API, with JSON mode and rate-limit aware retries.

    The free tier allows ~8K tokens/minute and 200K tokens/day per model, so the judge uses a different
    model than the agent (separate quota) and waits for the time Groq asks instead of failing the metric.
    """

    def __init__(self, model: str):
        self.api_key = os.environ["GROQ_API_KEY"]
        self.tokens_used = 0
        super().__init__(model)

    def load_model(self):
        return OpenAI(api_key=self.api_key, base_url=GROQ_BASE_URL, max_retries=0)

    def get_model_name(self) -> str:
        return f"{self.name} (Groq)"

    def _request(self, prompt: str, schema) -> dict:
        kwargs = {"model": self.name, "messages": [{"role": "user", "content": prompt}], "temperature": 0}
        if self.name.startswith("openai/gpt-oss"):
            kwargs["reasoning_effort"] = "low"
        elif self.name.startswith("qwen/"):
            kwargs["reasoning_effort"] = "none"  # plain JSON answer, no <think> block
        if schema is not None:
            kwargs["response_format"] = {"type": "json_object"}
        return kwargs

    def _parse(self, response, schema):
        self.tokens_used += response.usage.total_tokens if response.usage else 0
        content = response.choices[0].message.content or ""
        return (schema.model_validate(trim_and_load_json(content)) if schema else content), 0.0

    def generate(self, prompt: str, schema=None):
        for attempt in range(MAX_RETRIES):
            try:
                return self._parse(self.model.chat.completions.create(**self._request(prompt, schema)), schema)
            except RateLimitError as err:
                wait = _retry_after(err)
                if wait > MAX_WAIT_S:
                    raise GroqQuotaExhausted(f"Groq quota for {self.name} exhausted: {err}") from err
                if attempt == MAX_RETRIES - 1:
                    raise
                time.sleep(wait)

    async def a_generate(self, prompt: str, schema=None):
        client = AsyncOpenAI(api_key=self.api_key, base_url=GROQ_BASE_URL, max_retries=0)
        for attempt in range(MAX_RETRIES):
            try:
                return self._parse(await client.chat.completions.create(**self._request(prompt, schema)), schema)
            except RateLimitError as err:
                wait = _retry_after(err)
                if wait > MAX_WAIT_S:
                    raise GroqQuotaExhausted(f"Groq quota for {self.name} exhausted: {err}") from err
                if attempt == MAX_RETRIES - 1:
                    raise
                await asyncio.sleep(wait)


def make_judge() -> GroqJudge:
    return GroqJudge(os.getenv("DEEPEVAL_JUDGE_MODEL", "qwen/qwen3.8-27b"))


@dataclass
class AgentRun:
    output: str
    tools_called: list[ToolCall] = field(default_factory=list)
    retrieval_context: list[str] = field(default_factory=list)


def run_agent(user_input: str, timeout: int = 180) -> AgentRun:
    """One stateless run of the support agent; collects the final answer, tool calls and tool outputs."""
    payload = {
        "assistant_id": ASSISTANT_ID,
        "input": {"messages": [{"role": "user", "content": user_input}]},
        "config": {"configurable": {"prompt_version": PROMPT_VERSION}},
    }
    for attempt in range(5):
        resp = requests.post(f"{AGENT_URL}/runs/wait", json=payload, timeout=timeout)
        resp.raise_for_status()
        body = resp.json()
        if "messages" in body:
            break
        # The run failed inside the agent (usually a Groq 429); wait for the rate limit window.
        if attempt == 4:
            raise RuntimeError(f"Agent run failed: {body}")
        time.sleep(20)
    messages = body["messages"]

    outputs = {m.get("tool_call_id"): m for m in messages if m["type"] == "tool"}
    tools_called, retrieval_context = [], []
    for m in messages:
        for call in m.get("tool_calls") or []:
            result = outputs.get(call["id"], {}).get("content", "")
            tools_called.append(ToolCall(name=call["name"], input_parameters=call["args"], output=result))
            if not result:
                continue
            # Policy hits become separate chunks; order/refund results are one chunk each.
            chunks = result.split("\n\n") if call["name"] == "search_policy" else [result]
            retrieval_context.extend(chunks)

    final = next(m for m in reversed(messages) if m["type"] == "ai")
    content = final["content"]
    if isinstance(content, list):
        content = "".join(b.get("text", "") for b in content if isinstance(b, dict))
    return AgentRun(output=content, tools_called=tools_called, retrieval_context=retrieval_context)


def expected_tools(golden) -> list[ToolCall]:
    return [t if isinstance(t, ToolCall) else ToolCall(**t) for t in (golden.expected_tools or [])]
