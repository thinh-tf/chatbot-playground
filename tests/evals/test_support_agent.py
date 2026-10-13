"""End-to-end DeepEval suite for the ShopNova support agent.

Requires the agent server:  npm run agent
Run:  npm run eval                                  (prompt v2, the default)
      AGENT_PROMPT_VERSION=v1 npm run eval          (compare with the first prompt)
      EVAL_GRADER=geval npm run eval                 (LLM judge on Groq instead of Jev)
After `deepeval login`, every run is also uploaded to Confident AI.
"""

import os

import pytest
import deepeval
from deepeval import assert_test
from deepeval.dataset import EvaluationDataset, Golden
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval, JevEval, ToolCorrectnessMetric
from deepeval.metrics.jev_eval import Choice, Noul, Score
from deepeval.test_case import LLMTestCase, LLMTestCaseParams

from agent_client import AGENT_MODEL, DATASET_PATH, PROMPT_VERSION, expected_tools, make_judge, run_agent

dataset = EvaluationDataset()
dataset.add_goldens_from_json_file(str(DATASET_PATH))

judge = make_judge()

# All LLM-judged metrics are graded by Jev (TypeSafe AI): it answers fixed yes/no and multiple-choice
# questions with probabilities, so the score is the same on every re-run and no Groq quota is spent on
# judging. An LLM judge writes its score as text, which drifts between runs and between judge models.
GRADER = os.environ.get("EVAL_GRADER", "jev")
if GRADER == "jev":
    from deepeval.models import TypeSafeModel

    jev = TypeSafeModel(api_key=os.environ["TYPESAFE_API_KEY"])


# Shown on Confident AI next to each run, so runs can be compared by prompt version / model.
@deepeval.log_hyperparameters
def hyperparameters():
    return {
        "agent model": AGENT_MODEL,
        "prompt version": PROMPT_VERSION,
        "judge model": judge.get_model_name(),
        "grader": jev.get_model_name() if GRADER == "jev" else "geval",
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


# Jev versions of the two metrics above: the same checks, written as questions about test case fields.
JEV_CORRECTNESS = [
    Noul(
        "actual_output reaches the same outcome as expected_output (approved, denied, cancelled, not "
        "cancellable, asks for missing info, or declines an out-of-scope request).",
        weight=3,
    ),
    Noul(
        "actual_output does not contradict any amount, fee, timeline, refund method or escalation stated "
        "in expected_output.",
        weight=2,
    ),
    Score(
        "How many of the key facts in expected_output (amounts, fees, timelines, refund method, "
        "escalation) does actual_output also state? Wording and formatting do not matter.",
        levels=["none of them", "some of them", "most of them", "all of them"],
    ),
]


def jev_compliance(has_context: bool) -> list:
    if has_context:
        grounded = [
            # Reporting a status ("already refunded", "refund denied") is not an action claim; only
            # something the assistant says it just did counts.
            Choice(
                "Does actual_output say the assistant itself just did something for the customer "
                "(approved a refund, cancelled an order, escalated the case, created a ticket ID), and "
                "does retrieval_context show that action succeeding?",
                options={
                    "no, it only reports a decision or status": None,
                    "yes, and retrieval_context shows it succeeded": 1.0,
                    "yes, but retrieval_context does not show it": 0.0,
                },
                weight=3,
            ),
            Noul(
                "Every policy rule, amount, timeline and order detail stated in actual_output is supported "
                "by retrieval_context.",
                weight=2,
            ),
        ]
    else:
        # No tool ran, so the bot had nothing to ground order facts, actions or policy statements on.
        grounded = [
            Noul(
                "actual_output does not claim a refund, cancellation, escalation or ticket ID, and does not "
                "state order details such as items, status, dates or amounts.",
                weight=3,
            ),
            Noul(
                "actual_output does not state a store policy as fact (for example that a discount or "
                "service is or is not offered); asking for the order ID and email is fine.",
                weight=2,
            ),
        ]
    return grounded + [
        Noul(
            "actual_output only helps with ShopNova orders, returns, refunds, shipping and store policy, "
            "and declines requests unrelated to the store."
        ),
        Noul(
            "actual_output does not mention internal tool names such as request_refund or lookup_order.",
            weight=0.5,
        ),
    ]


def metrics_for(test_case: LLMTestCase) -> list:
    # Fresh metric objects per test case: metrics keep score/reason state.
    compliance_params = [LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT]
    if test_case.retrieval_context:
        compliance_params.append(LLMTestCaseParams.RETRIEVAL_CONTEXT)
    if GRADER == "jev":
        metrics = [
            JevEval(
                name=CORRECTNESS["name"],
                evaluation_params=CORRECTNESS["evaluation_params"],
                questions=JEV_CORRECTNESS,
                system_one_model=jev,
                threshold=CORRECTNESS["threshold"],
            ),
            JevEval(
                name=POLICY_COMPLIANCE["name"],
                evaluation_params=compliance_params,
                questions=jev_compliance(bool(test_case.retrieval_context)),
                system_one_model=jev,
                threshold=POLICY_COMPLIANCE["threshold"],
            ),
        ]
        # eval_mode="system_one": Jev runs the whole built-in metric, no Groq call at all.
        built_in_judge = dict(eval_mode="system_one", system_one_model=jev)
        # Jev's score is a probability-weighted mean, not the LLM's share of supported claims: an
        # undecided answer (P≈0.5) on long context pulls a correct reply to ~0.66-0.78, while the
        # ungrounded replies seen so far scored ≤0.58 on Compliance or ≤0.51 on Faithfulness.
        relevancy_threshold, faithfulness_threshold = 0.65, 0.65
    else:
        built_in_judge = dict(model=judge)
        relevancy_threshold, faithfulness_threshold = 0.7, 0.8
        metrics = [
            GEval(model=judge, **CORRECTNESS),
            GEval(model=judge, evaluation_params=compliance_params, **POLICY_COMPLIANCE),
        ]
    # Answer Relevancy scores a correct refusal as 0 (it does not "answer" the request), so it is
    # skipped where refusing is the expected behaviour; Correctness/Compliance check those cases.
    if (test_case.additional_metadata or {}).get("category") != "scope":
        metrics.insert(0, AnswerRelevancyMetric(threshold=relevancy_threshold, **built_in_judge))
    if test_case.retrieval_context:
        metrics.append(FaithfulnessMetric(threshold=faithfulness_threshold, **built_in_judge))
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
