"""SQLAlchemy engine + declarative schema for the real RWD warehouse.

The ETL (`app.data.etl`) loads the dropped CSV/XLSX files into `alfadev.db`; the
DB-backed builder (`app.data.db_builder`) queries these tables and assembles the
same Pydantic `Dataset` contract the synthetic generator produces. Schema mirrors
the profiled source columns. NPIs are 10-digit identifiers stored as BIGINT.
"""
from __future__ import annotations

import pathlib
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import (
    BigInteger,
    Float,
    Integer,
    String,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker, mapped_column, Mapped

DATA_DIR = pathlib.Path(__file__).resolve().parent
DB_PATH = DATA_DIR / "alfadev.db"
DB_URL = f"sqlite:///{DB_PATH}"


def get_engine(url: str = DB_URL):
    # check_same_thread False so the lru_cached builder can run under uvicorn workers
    return create_engine(url, future=True, connect_args={"check_same_thread": False})


ENGINE = get_engine()
SessionLocal = sessionmaker(bind=ENGINE, future=True, expire_on_commit=False)


@contextmanager
def session_scope() -> Iterator[Session]:
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def db_exists() -> bool:
    return DB_PATH.exists() and DB_PATH.stat().st_size > 0


class Base(DeclarativeBase):
    pass


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #


class Hcp(Base):
    __tablename__ = "hcp"
    npi: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    rank: Mapped[int | None] = mapped_column(Integer)
    decile: Mapped[int | None] = mapped_column(Integer)
    first_name: Mapped[str | None] = mapped_column(String)
    last_name: Mapped[str | None] = mapped_column(String)
    specialty: Mapped[str | None] = mapped_column(String)
    primary_hco_name: Mapped[str | None] = mapped_column(String)
    primary_hco_classification: Mapped[str | None] = mapped_column(String)
    primary_hco_facility_type: Mapped[str | None] = mapped_column(String)
    primary_hco_address: Mapped[str | None] = mapped_column(String)
    primary_hco_city: Mapped[str | None] = mapped_column(String)
    primary_hco_state: Mapped[str | None] = mapped_column(String)
    primary_hco_zip: Mapped[str | None] = mapped_column(String)
    patient_count: Mapped[int | None] = mapped_column(Integer)
    primary_hco_npi: Mapped[int | None] = mapped_column(BigInteger)  # nullable FK via fuzzy match
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)
    geo_source: Mapped[str | None] = mapped_column(String)  # zcta | zip3 | state | None


class Hco(Base):
    __tablename__ = "hco"
    npi: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    rank: Mapped[int | None] = mapped_column(Integer)
    decile: Mapped[int | None] = mapped_column(Integer)
    name: Mapped[str | None] = mapped_column(String)
    classification: Mapped[str | None] = mapped_column(String)
    facility_type: Mapped[str | None] = mapped_column(String)
    address: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)
    zip: Mapped[str | None] = mapped_column(String)
    patient_count: Mapped[int | None] = mapped_column(Integer)


class HcpReferral(Base):
    __tablename__ = "hcp_referral"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hcp_npi: Mapped[int | None] = mapped_column(BigInteger, index=True)
    num_outbound: Mapped[int | None] = mapped_column(Integer)
    share_outbound: Mapped[float | None] = mapped_column(Float)
    connected_hcp_npi: Mapped[int | None] = mapped_column(BigInteger, index=True)
    num_inbound: Mapped[int | None] = mapped_column(Integer)
    share_inbound: Mapped[float | None] = mapped_column(Float)
    connected_specialty: Mapped[str | None] = mapped_column(String)
    connected_hco_classification: Mapped[str | None] = mapped_column(String)
    connected_hco_name: Mapped[str | None] = mapped_column(String)
    connected_hco_address: Mapped[str | None] = mapped_column(String)
    connected_hco_city: Mapped[str | None] = mapped_column(String)
    connected_hco_facility_type: Mapped[str | None] = mapped_column(String)
    connected_hco_zip: Mapped[str | None] = mapped_column(String)
    connected_hco_state: Mapped[str | None] = mapped_column(String)


# --------------------------------------------------------------------------- #
# Trials
# --------------------------------------------------------------------------- #


class ClinicalTrial(Base):
    __tablename__ = "clinical_trial"
    trial_id: Mapped[str] = mapped_column(String, primary_key=True)  # NCT id
    title: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    detailed_status: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[str | None] = mapped_column(String)
    end_date: Mapped[str | None] = mapped_column(String)
    phase: Mapped[str | None] = mapped_column(String)
    lead_sponsor: Mapped[str | None] = mapped_column(String)
    lead_sponsor_class: Mapped[str | None] = mapped_column(String)
    condition_mesh_terms: Mapped[str | None] = mapped_column(String)


class TrialHcp(Base):
    __tablename__ = "trial_hcp"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trial_id: Mapped[str | None] = mapped_column(String, index=True)
    npi: Mapped[int | None] = mapped_column(BigInteger, index=True)
    first_name: Mapped[str | None] = mapped_column(String)
    last_name: Mapped[str | None] = mapped_column(String)
    facility_city: Mapped[str | None] = mapped_column(String)
    facility_state: Mapped[str | None] = mapped_column(String)
    facility_zip: Mapped[str | None] = mapped_column(String)


# --------------------------------------------------------------------------- #
# Real ILLUMINATE1 recruiting sites
# --------------------------------------------------------------------------- #


class IlluminateSite(Base):
    __tablename__ = "illuminate_site"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    facility: Mapped[str | None] = mapped_column(String)
    city: Mapped[str | None] = mapped_column(String)
    state: Mapped[str | None] = mapped_column(String)  # 2-letter abbr (normalized)
    zip: Mapped[str | None] = mapped_column(String)
    status: Mapped[str | None] = mapped_column(String)
    primary_contact: Mapped[str | None] = mapped_column(String)
    phone: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)
    lat: Mapped[float | None] = mapped_column(Float)
    lng: Mapped[float | None] = mapped_column(Float)


# --------------------------------------------------------------------------- #
# Patient-count breakdowns (aggregate, no patient-level rows)
# --------------------------------------------------------------------------- #


class PatientGeo(Base):
    __tablename__ = "patient_geo"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    state: Mapped[str | None] = mapped_column(String, index=True)  # 2-letter abbr
    zip3: Mapped[str | None] = mapped_column(String, index=True)
    patient_count: Mapped[int | None] = mapped_column(Integer)
    white: Mapped[int | None] = mapped_column(Integer)
    black: Mapped[int | None] = mapped_column(Integer)
    asian: Mapped[int | None] = mapped_column(Integer)
    hispanic: Mapped[int | None] = mapped_column(Integer)
    other: Mapped[int | None] = mapped_column(Integer)
    unknown: Mapped[int | None] = mapped_column(Integer)


class PatientAge(Base):
    __tablename__ = "patient_age"
    age_band: Mapped[str] = mapped_column(String, primary_key=True)
    patient_count: Mapped[int | None] = mapped_column(Integer)


class PatientGender(Base):
    __tablename__ = "patient_gender"
    gender: Mapped[str] = mapped_column(String, primary_key=True)
    patient_count: Mapped[int | None] = mapped_column(Integer)


class PatientPayer(Base):
    __tablename__ = "patient_payer"
    payer_channel: Mapped[str] = mapped_column(String, primary_key=True)
    patient_count: Mapped[int | None] = mapped_column(Integer)


class PatientPlan(Base):
    __tablename__ = "patient_plan"
    payer_name: Mapped[str] = mapped_column(String, primary_key=True)
    patient_count: Mapped[int | None] = mapped_column(Integer)


def create_all(engine=ENGINE) -> None:
    Base.metadata.create_all(engine)


def drop_all(engine=ENGINE) -> None:
    Base.metadata.drop_all(engine)
