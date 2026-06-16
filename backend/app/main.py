"""AlfaDev FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import export, feasibility_routes, map_routes, routes
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="AlfaDev API",
    description="Clinical-trial feasibility platform — synthetic Phase-0 backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routes.router)
app.include_router(export.router)
app.include_router(map_routes.router)
app.include_router(feasibility_routes.router)


@app.get("/")
def root() -> dict:
    return {"name": "AlfaDev API", "docs": "/docs", "health": "/api/health"}
