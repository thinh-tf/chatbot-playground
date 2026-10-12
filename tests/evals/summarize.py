"""Compact summary of the latest `deepeval test run` (.deepeval/.latest_test_run.json).

Usage:  .venv/bin/python tests/evals/summarize.py [--reasons]
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

RUN_FILE = Path(__file__).resolve().parents[2] / ".deepeval" / ".latest_test_run.json"


def main() -> None:
    show_reasons = "--reasons" in sys.argv
    run = json.loads(RUN_FILE.read_text())["testRunData"]
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
