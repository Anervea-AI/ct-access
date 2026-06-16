"""Psychiatry-specific proxy layer (PRD §5.3).

Claims data does not contain several psychiatric trial criteria. These are modeled
via documented proxies; each carries a definition, an adjustable strictness
parameter, and a confidence note that the assistant must surface.
"""
from __future__ import annotations

from pydantic import BaseModel


class ProxyDefinition(BaseModel):
    criterionId: str
    criterion: str
    proxyApproach: str
    parameter: str
    confidence: str
    limitation: str


PROXY_LIBRARY: dict[str, ProxyDefinition] = {
    "inc_current_mde": ProxyDefinition(
        criterionId="inc_current_mde",
        criterion="Current depressive episode timing",
        proxyApproach="Claim recency + a treatment change (new/adjusted antidepressant or mood stabilizer) within the lookback window.",
        parameter="lookbackDays (30–365)",
        confidence="medium",
        limitation="Episode boundaries are inferred from treatment behavior, not clinician-confirmed.",
    ),
    "inc_severity": ProxyDefinition(
        criterionId="inc_severity",
        criterion="Severity scales (MADRS / YMRS / HAM-D / CGI)",
        proxyApproach="Treatment intensity, polypharmacy, recent psychiatric hospitalization, ECT, and prior therapy lines.",
        parameter="severityStrictness index (0–100)",
        confidence="low",
        limitation="No validated severity scale exists in claims; this is a behavioral proxy only.",
    ),
    "exc_substance": ProxyDefinition(
        criterionId="exc_substance",
        criterion="Substance use disorder",
        proxyApproach="Coded SUD diagnoses (F10–F19) plus medication-assisted-treatment prescriptions.",
        parameter="sudStrictness index (0–100)",
        confidence="low",
        limitation="Claims substantially under-capture SUD; true prevalence is higher.",
    ),
    "exc_suicidality": ProxyDefinition(
        criterionId="exc_suicidality",
        criterion="Suicidality",
        proxyApproach="Self-harm / ideation ICD codes and ER encounters.",
        parameter="(none — coded only)",
        confidence="low",
        limitation="Understates true rate; much suicidality is never coded.",
    ),
}


def get_proxy(criterion_id: str) -> ProxyDefinition | None:
    return PROXY_LIBRARY.get(criterion_id)


def all_proxies() -> list[ProxyDefinition]:
    return list(PROXY_LIBRARY.values())
