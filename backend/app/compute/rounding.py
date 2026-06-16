"""Deterministic rounding + helpers, mirrored exactly in `frontend/src/compute/rounding.ts`.

Python's round() uses banker's rounding and JS Math.round() rounds half-up; for
all-positive counts they diverge on x.5. We standardize on round-half-up
(floor(x + 0.5)) so the client and server produce identical integers.
"""
from __future__ import annotations

import math


def r0(x: float) -> int:
    """Round to integer, half-up (matches JS Math.round for positive values)."""
    return int(math.floor(x + 0.5))


def r1(x: float) -> float:
    return math.floor(x * 10 + 0.5) / 10


def r2(x: float) -> float:
    return math.floor(x * 100 + 0.5) / 100


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def hash01(i: float) -> float:
    """Deterministic pseudo-random in [0,1) from an integer-ish seed.

    Classic fract(sin(x)*k) hash; mirrored in TS. Used for per-entity synthetic
    noise (e.g. monitoring actuals) without a stateful RNG."""
    v = math.sin(i * 12.9898) * 43758.5453
    return v - math.floor(v)
