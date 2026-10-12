"""End-to-end DeepEval suite for the ShopNova support agent.

Requires the agent server:  npm run agent
Run:  npm run eval                                  (prompt v2, the default)
      AGENT_PROMPT_VERSION=v1 npm run eval          (compare with the first prompt)
After `deepeval login`, every run is also uploaded to Confident AI.
"""

import pytest
import deepeval
from deepeval import assert_test
from deepeval.dataset import EvaluationDataset, Golden
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval, ToolCorrectnessMetric
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from agent_client import AGENT_MODEL, DATASET_PATH, PROMPT_VERSION, expected_tools, make_judge, run_agent

dataset = EvaluationDataset()
dataset.add_goldens_from_json_file(str(DATASET_PATH))

judge = make_judge()


# Shown on Confident AI next to each run, so runs can be compared by prompt version / model.
@deepeval.log_hyperparameters
def hyperparameters():
    return {
        "agent model": AGENT_MODEL,
        "prompt version": PROMPT_VERSION,
        "judge model": judge.get_model_name(),
    }


# Explicit evaluation steps instead of free-form criteria: with free-form criteria the judge invented
# its own steps (e.g. exact punctuation match, or penalizing the bot for asking to verify identity).
CORRECTNESS = dict(
    name="Correctness",
    evaluation_steps=[
        "From the expected output, identify the outcome: the decision (approved, denied, cancelled, not "
        "cancellable, asks for missing info, declines out-of-scope) and every key fact: amounts, fees, "
        "timelines, refund method, ticket/escalation.",
        "If the actual output reaches a different decision than the expected output, or contradicts any key "
        "fact, the score must be very low.",
        "For each key fact in the expected output that the actual output omits, lower the score; missing "
        "amounts or timelines matter more than missing explanations.",
        "Ignore wording, punctuation and typography (dashes, spaces, symbols), formatting, tone, and extra "
        "helpful content that does not contradict the expected output.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
    threshold=0.7,
)

POLICY_COMPLIANCE = dict(
    name="Policy Compliance",
    evaluation_steps=[
        "The retrieval context, when present, is everything the store system returned (policy sections, "
        "order records, refund/cancel/escalation results). Facts from it are not invented.",
        "Every policy rule, amount, timeline, ticket ID or completed action (refund approved, order "
        "cancelled, case escalated) stated in the actual output must be supported by the retrieval context. "
        "Claiming an action or ticket ID that the context does not show is a severe violation.",
        "Order-specific details (items, status, dates, amounts) may only appear if the retrieval context "
        "contains that order's record. Asking the customer for a missing order ID or email is correct "
        "behaviour and must not be penalized.",
        "Declining a request unrelated to the store is correct; helping with it is a violation. Mentioning "
        "internal tool names (e.g. request_refund) is a minor violation.",
        "Do not penalize the output for not fully answering when the reason is missing verification or an "
        "out-of-scope request.",
    ],
    threshold=0.7,
)


def metrics_for(test_case: LLMTestCase) -> list:
    # Fresh metric objects per test case: metrics keep score/reason state.
    compliance_params = [LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT]
    if test_case.retrieval_context:
        compliance_params.append(LLMTestCaseParams.RETRIEVAL_CONTEXT)
    metrics = [
        GEval(model=judge, **CORRECTNESS),
        GEval(model=judge, evaluation_params=compliance_params, **POLICY_COMPLIANCE),
    ]
    # Answer Relevancy scores a correct refusal as 0 (it does not "answer" the request), so it is
    # skipped where refusing is the expected behaviour; Correctness/Compliance check those cases.
    if (test_case.additional_metadata or {}).get("category") != "scope":
        metrics.insert(0, AnswerRelevancyMetric(model=judge, threshold=0.7))
    if test_case.retrieval_context:
        metrics.append(FaithfulnessMetric(model=judge, threshold=0.8))
    if test_case.expected_tools:
        metrics.append(ToolCorrectnessMetric(model=judge, threshold=1.0))
    return metrics


@pytest.mark.parametrize("golden", dataset.goldens, ids=lambda g: g.name)
def test_support_agent(golden: Golden):
    run = run_agent(golden.input)
    test_case = LLMTestCase(
        input=golden.input,
        actual_output=run.output,
        expected_output=golden.expected_output,
        retrieval_context=run.retrieval_context or None,
        tools_called=run.tools_called,
        expected_tools=expected_tools(golden),
        additional_metadata=golden.additional_metadata,
        name=golden.name,
    )
    assert_test(test_case, metrics_for(test_case))
