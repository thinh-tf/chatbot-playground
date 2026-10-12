"""Upload the goldens to Confident AI so they show up as a dataset in the web UI.

Requires `deepeval login`.  Usage:  npm run eval:push-dataset
"""

import os
import sys

from deepeval.dataset import EvaluationDataset

from agent_client import DATASET_PATH

ALIAS = "shopnova-support"

if __name__ == "__main__":
    if not os.getenv("CONFIDENT_API_KEY") and "CONFIDENT_API_KEY" not in open(".env.local").read():
        sys.exit("Not logged in to Confident AI. Run `.venv/bin/deepeval login` first.")
    dataset = EvaluationDataset()
    dataset.add_goldens_from_json_file(str(DATASET_PATH))
    dataset.push(alias=ALIAS)
    print(f"Pushed {len(dataset.goldens)} goldens to Confident AI dataset '{ALIAS}'.")
