"""Compact summary of the latest `deepeval test run` (.deepeval/.latest_run_full.json).

Usage:  .venv/bin/python tests/evals/summarize.py [--reasons]
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

# After `deepeval login`, .latest_test_run.json only keeps the Confident AI link; the full results
# are in .latest_run_full.json.
DEEPEVAL_DIR = Path(__file__).resolve().parents[2] / ".deepeval"
RUN_FILE = next(
    f for f in (DEEPEVAL_DIR / ".latest_run_full.json", DEEPEVAL_DIR / ".latest_test_run.json") if f.exists()
)


def main() -> None:
    show_reasons = "--reasons" in sys.argv
    data = json.loads(RUN_FILE.read_text())
    run = data.get("testRunData", data)
    cases = sorted(run["testCases"], key=lambda c: c.get("order", 0))

    per_metric = defaultdict(list)
    print(f"Run: {run.get('identifier') or '-'} | {len(cases)} cases\n")
    for case in cases:
        failed = [m for m in case["metricsData"] if not m["success"]]
        scores = " ".join(f"{m['name'].split(' [')[0]}={m['score']:.2f}" for m in case["metricsData"] if m.get("score") is not None)
        print(f"{'PASS' if case['success'] else 'FAIL'}  {case['name']}: {scores}")
        if show_reasons:
            for m in failed:
                print(f"      - {m['name']}: {m.get('reason') or m.get('error')}")
        for m in case["metricsData"]:
            per_metric[m["name"]].append(m)

    print("\nMetric                     pass   mean")
    for name, ms in sorted(per_metric.items()):
        scored = [m["score"] for m in ms if m.get("score") is not None]
        passed = sum(m["success"] for m in ms)
        mean = sum(scored) / len(scored) if scored else float("nan")
        print(f"{name:<26} {passed:>2}/{len(ms):<3} {mean:.2f}")
    print(f"\nCases passed: {sum(c['success'] for c in cases)}/{len(cases)}")


if __name__ == "__main__":
    main()
