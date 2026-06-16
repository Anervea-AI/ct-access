"""Module 04 — KOL scoring (weighted blend of signals; re-sorts on weight change)."""
from __future__ import annotations

from app.compute.rounding import r2
from app.models.inputs import KolControls
from app.models.schemas import Kol, KolEdge, KolGraphResult

SIGNAL_KEYS = [
    "patientVolume", "referralCentrality", "referralReach",
    "trialLeadership", "trialRecency", "specialtyFit",
]


def score_kol(kol: Kol, weights: dict[str, float]) -> float:
    wsum = sum(max(0.0, weights.get(k, 0.0)) for k in SIGNAL_KEYS) or 1.0
    total = 0.0
    for k in SIGNAL_KEYS:
        total += max(0.0, weights.get(k, 0.0)) * getattr(kol.signals, k)
    return r2(total / wsum)


def compute_kol(kols: list[Kol], edges: list[KolEdge], controls: KolControls) -> KolGraphResult:
    def passes(k: Kol) -> bool:
        if controls.segment and k.segment != controls.segment:
            return False
        if controls.region and k.region != controls.region:
            return False
        if controls.specialty and k.specialty != controls.specialty:
            return False
        return True

    scored = [k.model_copy(update={"score": score_kol(k, controls.weights)}) for k in kols if passes(k)]
    scored.sort(key=lambda k: k.score, reverse=True)
    ids = {k.id for k in scored}
    kept_edges = [e for e in edges if e.source in ids and e.target in ids]
    return KolGraphResult(nodes=scored, edges=kept_edges)
