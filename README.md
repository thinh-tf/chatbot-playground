ShopNova Support: a customer-support chatbot built on the [assistant-ui](https://github.com/assistant-ui/assistant-ui) starter (Next.js + LangGraph + Groq), used to try out the [DeepEval](https://deepeval.com) evaluation framework.

The bot ("Nova") handles orders, returns, refunds, cancellations, shipping and warranty for a fictional store. It answers from a small policy knowledge base and acts through tools (`agent/support/tools.ts`):

| Tool | What it does |
| --- | --- |
| `search_policy` | Keyword search over the store policies (RAG) |
| `lookup_order` | Order details, after verifying order ID + email |
| `request_refund` | Applies the refund rules and returns APPROVED (amount) or DENIED (reason) |
| `cancel_order` | Cancels orders that have not shipped |
| `escalate_to_human` | Opens a ticket for warranty claims or human support |

The chat UI shows each tool call as a card (policy hits, order, refund decision, ticket), so you can see what the bot looked up and decided. Demo orders are listed on the welcome screen.

## Getting Started

Add your [Groq API key](https://console.groq.com/keys) to `.env.local` (see `.env.example`):

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Start the LangGraph agent server (serves `agent/graph.ts` on http://localhost:2024):

```bash
npm run agent
```

In another terminal, start the web app and open [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

## Evaluating with DeepEval

The suite lives in `tests/evals/`: 18 hand-written goldens (`.dataset.json`) covering refunds, cancellations, order status, identity checks, policy questions and out-of-scope requests. Each case runs the real agent through the LangGraph API and is scored on:

| Metric | Catches |
| --- | --- |
| Correctness (GEval) | Wrong decision, amount or timeline compared with the expected answer |
| Policy Compliance (GEval) | Invented policies or ticket IDs, leaked order data, unapproved promises |
| Faithfulness | Claims not supported by the tool outputs |
| Answer Relevancy | Off-topic or padded answers |
| Tool Correctness | Missing tool calls (e.g. promising a refund without calling `request_refund`) |

The judge model also runs on Groq (`qwen/qwen3.8-27b` by default, `DEEPEVAL_JUDGE_MODEL` to change it), so no extra API key is needed.

```bash
npm run eval:setup                     # once: Python venv with deepeval
npm run agent                          # the agent server must be running
npm run eval                           # prompt v2 (current)
AGENT_PROMPT_VERSION=v1 npm run eval   # first prompt, for comparison
npm run eval:summary                   # compact pass/fail table of the last run
```

To see the runs in DeepEval's web UI (Confident AI), log in once; every `npm run eval` is then uploaded with its prompt version and models:

```bash
.venv/bin/deepeval login               # free account, saves the key to .env.local
.venv/bin/deepeval view                # open the latest run
```

See [docs/DEEPEVAL_DEMO.md](docs/DEEPEVAL_DEMO.md) for the demo walkthrough and results.
