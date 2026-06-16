"""PDF export — audit-ready feasibility summary with definitions + timestamps (PRD §6.3)."""
from __future__ import annotations

import io
from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

from app.compute.forecast import compute_forecast
from app.compute.funnel import compute_funnel
from app.compute.sites import compute_sites
from app.data.store import get_dataset
from app.models.inputs import ScenarioState
from app.semantic.dictionary import DATA_DICTIONARY

router = APIRouter(prefix="/api/export")

PRIMARY = colors.HexColor("#9a3412")
ACCENT = colors.HexColor("#c2410c")
INK = colors.HexColor("#2c2118")
MUTED = colors.HexColor("#f5efe4")
BORDER = colors.HexColor("#e7dcc9")


class ExportRequest(BaseModel):
    scenario: ScenarioState
    title: str = "Feasibility Summary"


@router.post("/pdf")
def export_pdf(req: ExportRequest):
    ds = get_dataset()
    funnel = compute_funnel(req.scenario.criteria, ds.totalUniverse)
    site_res = compute_sites(ds.sites, funnel.eligiblePool, req.scenario.siteFilters)
    forecast = compute_forecast(req.scenario.forecast, funnel.eligiblePool)
    base = next((s for s in forecast.scenarios if s.id == "base"), None)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=LETTER, topMargin=0.7 * inch, bottomMargin=0.7 * inch)
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=PRIMARY, fontSize=20, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=PRIMARY, fontSize=13, spaceBefore=14)
    meta = ParagraphStyle("meta", parent=styles["Normal"], textColor=colors.HexColor("#6b7280"), fontSize=8)
    body = ParagraphStyle("body", parent=styles["Normal"], textColor=INK, fontSize=9.5, leading=14)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    el: list = []
    el.append(Paragraph("AlfaDev — " + req.title, h1))
    el.append(Paragraph(f"{ds.program}", body))
    el.append(Paragraph(
        f"Scenario: <b>{req.scenario.name}</b> (protocol {req.scenario.protocolVersion}) &nbsp;|&nbsp; "
        f"Generated {now} &nbsp;|&nbsp; Data version {ds.dataVersion} (seed {ds.seed})", meta))
    el.append(Spacer(1, 8))

    # Eligibility funnel
    el.append(Paragraph("Eligibility funnel", h2))
    el.append(Paragraph(
        f"Eligible pool: <b>{funnel.eligiblePool:,}</b> of {funnel.totalUniverse:,} diagnosed. "
        f"Biggest constraint: <b>{funnel.biggestConstraintLabel}</b> "
        f"(removes {funnel.biggestConstraintRemoved:,}).", body))
    rows = [["Criterion", "Type", "Reduction %", "Remaining", "% of universe"]]
    for s in funnel.steps:
        rows.append([s.label, s.type, f"{s.reductionPct:.1f}", f"{s.remaining:,}", f"{s.pct:.1f}%"])
    t = Table(rows, colWidths=[2.6 * inch, 0.9 * inch, 0.9 * inch, 1.0 * inch, 1.0 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), MUTED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#94a3b8")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TEXTCOLOR", (0, 1), (0, -1), PRIMARY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbf7f0")]),
    ]))
    el.append(t)

    # Top sites
    el.append(Paragraph("Top recommended sites", h2))
    rows = [["#", "Site", "Region", "Eligible", "PI trials", "Score"]]
    for i, s in enumerate(site_res.sites[:10]):
        rows.append([str(i + 1), s.name, s.region, f"{s.eligiblePatients:,}", str(s.piExperienceTrials), f"{s.score:.2f}"])
    t = Table(rows, colWidths=[0.4 * inch, 2.6 * inch, 1.1 * inch, 1.0 * inch, 0.9 * inch, 0.7 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), MUTED),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#94a3b8")),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fbf7f0")]),
    ]))
    el.append(t)

    # Forecast
    if base:
        el.append(Paragraph("Enrollment forecast (base scenario)", h2))
        el.append(Paragraph(
            f"Projected last-patient-in: <b>{base.lpiDate}</b> "
            f"({'on track' if base.onTrack else 'behind'} for target {base.targetDate}). "
            f"Sites needed for target: <b>{forecast.sitesNeededForTarget or 'infeasible'}</b>.", body))

    # Definitions appendix
    el.append(Paragraph("Definitions &amp; data sources", h2))
    for td in DATA_DICTIONARY.values():
        el.append(Paragraph(f"<b>{td.term}</b> — {td.definition} <i>Source: {td.source}.</i>", body))

    doc.build(el)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=alfadev-feasibility-summary.pdf"},
    )
