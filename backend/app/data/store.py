"""Dataset singleton. Chooses the data source per settings.data_source:

  - "db"        : force the real RWD SQLite builder (errors if alfadev.db missing)
  - "synthetic" : force the deterministic synthetic generator
  - "auto"      : use the DB if alfadev.db exists, else fall back to synthetic

The app always runs: with no DB built yet, "auto" falls back to synthetic so the
contract is still satisfied (run `python -m app.data.etl` to build the DB).
"""
from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.data.generator import generate_dataset
from app.models.schemas import Dataset


@lru_cache
def get_dataset() -> Dataset:
    settings = get_settings()
    source = (settings.data_source or "auto").lower()

    if source == "synthetic":
        return generate_dataset(settings.data_seed)

    from app.data.db import db_exists

    if source == "db" or (source == "auto" and db_exists()):
        if not db_exists():
            raise RuntimeError(
                "DATA_SOURCE=db but alfadev.db is missing. Run: python -m app.data.etl"
            )
        from app.data.db_builder import build_dataset

        return build_dataset()

    return generate_dataset(settings.data_seed)
