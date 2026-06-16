import json
import pathlib

import pytest

from app.data.store import get_dataset
from app.models.inputs import ScenarioState

SHARED = pathlib.Path(__file__).resolve().parents[2] / "shared"


@pytest.fixture(scope="session")
def dataset():
    return get_dataset()


@pytest.fixture(scope="session")
def golden_scenario():
    raw = json.loads((SHARED / "golden" / "scenario.json").read_text(encoding="utf-8"))
    return ScenarioState.model_validate(raw)


@pytest.fixture(scope="session")
def golden_expected():
    return json.loads((SHARED / "golden" / "expected.json").read_text(encoding="utf-8"))


@pytest.fixture
def base_scenario(dataset):
    return ScenarioState(criteria=[c.model_copy(deep=True) for c in dataset.criteria])
