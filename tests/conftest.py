"""Laad het pure model zonder een HA-installatie te simuleren."""

import sys
from pathlib import Path
from types import ModuleType

import pytest


@pytest.fixture
def model():
    """Geïsoleerde package-naam: de echte integratie-import blijft ongemoeid."""
    import importlib

    package = ModuleType("noodkompas_model_test")
    package.__path__ = [str(Path(__file__).parents[1] / "custom_components" / "noodkompas")]
    sys.modules[package.__name__] = package
    return importlib.import_module("noodkompas_model_test.model")
