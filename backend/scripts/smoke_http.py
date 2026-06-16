"""Hit the running server over HTTP to verify the full API end-to-end."""
from __future__ import annotations

import time

import httpx

from app.data.store import get_dataset
from app.models.inputs import ScenarioState

BASE = "http://127.0.0.1:8000"


def main() -> None:
    ds = get_dataset()
    scenario = ScenarioState(criteria=[c.model_copy(deep=True) for c in ds.criteria])

    # wait for server
    for _ in range(40):
        try:
            httpx.get(f"{BASE}/api/health", timeout=1)
            break
        except Exception:
            time.sleep(0.25)

    h = httpx.get(f"{BASE}/api/health", timeout=5).json()
    print("health:", h)

    d = httpx.get(f"{BASE}/api/dataset", timeout=10).json()
    print("dataset: criteria", len(d["criteria"]), "sites", len(d["sites"]), "kols", len(d["kols"]))

    body = {"scenario": scenario.model_dump()}
    f = httpx.post(f"{BASE}/api/compute/funnel", json=body, timeout=10).json()
    print("compute/funnel eligiblePool:", f["eligiblePool"], "biggest:", f["biggestConstraintId"])

    s = httpx.post(f"{BASE}/api/compute/sites", json=body, timeout=10).json()
    print("compute/sites top:", s["sites"][0]["name"], s["sites"][0]["eligiblePatients"])

    chat = httpx.post(f"{BASE}/api/chat", json={
        "message": "What is my eligible pool and biggest constraint?",
        "scenario": scenario.model_dump(), "history": [],
    }, timeout=30).json()
    print("chat usedLlm:", chat["usedLlm"], "| tools:", chat["toolCalls"], "| viz:", chat["viz"]["type"] if chat["viz"] else None)
    print("chat text:", chat["text"][:120])

    pdf = httpx.post(f"{BASE}/api/export/pdf", json={"scenario": scenario.model_dump(), "title": "Smoke"}, timeout=30)
    print("export/pdf:", pdf.status_code, pdf.headers.get("content-type"), len(pdf.content), "bytes")
    print("ALL OK")


if __name__ == "__main__":
    main()
