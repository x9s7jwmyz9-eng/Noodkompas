"""Opslagcontract met expliciete HA-adapterdoubles; geen HA-runtimeclaim."""

import asyncio
import importlib
from copy import deepcopy
from datetime import datetime
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest


@pytest.fixture
def storage_runtime(model, monkeypatch):
    import sys

    storage = {"data": None}

    class StoreDouble:
        def __init__(self, *args):
            self.async_load = AsyncMock(side_effect=self.load)
            self.async_save = AsyncMock(side_effect=self.save)

        async def load(self):
            return deepcopy(storage["data"])

        async def save(self, value):
            await asyncio.sleep(0)  # Laat een tweede schrijver de lock bereiken.
            storage["data"] = deepcopy(value)

    class CoordinatorDouble:
        @classmethod
        def __class_getitem__(cls, value):
            return cls

        def __init__(self, hass, *args, **kwargs):
            self.hass = hass

        def async_set_updated_data(self, value):
            self.data = value

    unsubscribe_states, unsubscribe_timer = Mock(), Mock()
    modules = {
        "homeassistant.config_entries": {"ConfigEntry": object},
        "homeassistant.core": {"HomeAssistant": object, "callback": lambda f: f},
        "homeassistant.helpers.event": {
            "async_track_state_change_event": Mock(return_value=unsubscribe_states),
            "async_track_time_change": Mock(return_value=unsubscribe_timer),
        },
        "homeassistant.helpers.storage": {"Store": StoreDouble},
        "homeassistant.helpers.update_coordinator": {"DataUpdateCoordinator": CoordinatorDouble},
        "homeassistant.util": {"dt": SimpleNamespace(now=lambda: datetime(2026, 10, 7))},
    }
    for name, attributes in modules.items():
        module = ModuleType(name)
        module.__dict__.update(attributes)
        monkeypatch.setitem(sys.modules, name, module)
    name = "noodkompas_model_test.coordinator"
    monkeypatch.delitem(sys.modules, name, raising=False)
    coordinator = importlib.import_module(name).NoodkompasCoordinator
    hass = SimpleNamespace(states=SimpleNamespace(get=lambda entity_id: None))
    return coordinator, hass, storage, unsubscribe_states, unsubscribe_timer


def test_persistence_and_reload(model, storage_runtime):
    async def run():
        cls, hass, storage, _, timer = storage_runtime
        runtime = cls(hass)
        await runtime.async_load()
        data = model.defaults()
        data["water_l"] = 9
        await runtime.async_save(data, 0)
        assert storage["data"]["revision"] == 1
        data["water_l"] = 500
        assert runtime.snapshot["water_l"] == 9
        reloaded = cls(hass)
        await reloaded.async_load()
        assert reloaded.data["water_days"] == 3
        assert reloaded.revision == 1
        runtime.unload()
        reloaded.unload()
        assert timer.call_count == 2

    asyncio.run(run())


def test_two_writers_do_not_overwrite(model, storage_runtime):
    async def run():
        cls, hass, _, _, _ = storage_runtime
        runtime = cls(hass)
        a, b = model.defaults(), model.defaults()
        a["water_l"], b["water_l"] = 9, 18
        results = await asyncio.gather(
            runtime.async_save(a, 0), runtime.async_save(b, 0), return_exceptions=True
        )
        assert results[0] is None
        assert isinstance(results[1], ValueError)
        assert runtime.snapshot["water_l"] == 9
        assert runtime.revision == 1

    asyncio.run(run())


def test_failed_write_does_not_publish(model, storage_runtime):
    async def run():
        cls, hass, storage, _, _ = storage_runtime
        runtime = cls(hass)
        runtime.store.async_save.side_effect = OSError("Disk error")
        data = model.defaults()
        data["water_l"] = 9
        with pytest.raises(OSError):
            await runtime.async_save(data, 0)
        assert runtime.revision == 0
        assert runtime.snapshot["water_l"] == 0
        assert storage["data"] is None

    asyncio.run(run())


def test_invalid_write_never_reaches_store(model, storage_runtime):
    async def run():
        cls, hass, _, _, _ = storage_runtime
        runtime = cls(hass)
        data = model.defaults()
        data["water_l"] = -1
        with pytest.raises(ValueError):
            await runtime.async_save(data, 0)
        with pytest.raises(ValueError):
            await runtime.async_save(model.defaults(), True)
        runtime.store.async_save.assert_not_called()

    asyncio.run(run())


def test_corrupt_storage_not_overwritten(model, storage_runtime):
    async def run():
        cls, hass, storage, _, _ = storage_runtime
        storage["data"] = {"snapshot": model.defaults(), "revision": True}
        runtime = cls(hass)
        with pytest.raises(ValueError):
            await runtime.async_load()
        runtime.store.async_save.assert_not_called()

    asyncio.run(run())


def test_unload_waits_for_active_write_and_rejects_new_writes(model, storage_runtime):
    async def run():
        cls, hass, _, _, _ = storage_runtime
        runtime = cls(hass)
        started, allow_finish = asyncio.Event(), asyncio.Event()

        async def delayed_write(value):
            started.set()
            await allow_finish.wait()

        runtime.store.async_save.side_effect = delayed_write
        save = asyncio.create_task(runtime.async_save(model.defaults(), 0))
        await started.wait()
        stop = asyncio.create_task(runtime.async_stop())
        await asyncio.sleep(0)
        assert not stop.done()
        allow_finish.set()
        await asyncio.gather(save, stop)
        with pytest.raises(ValueError):
            await runtime.async_save(model.defaults(), 1)
        assert runtime.revision == 1

    asyncio.run(run())


def test_legacy_storage_without_schema_is_migrated(model, storage_runtime):
    async def run():
        cls, hass, storage, _, _ = storage_runtime
        legacy = model.defaults()
        del legacy["settings"]["expiry_warning_days"]
        legacy["energy"] = [
            {
                "name": "Thuisaccu",
                "category": "home_battery",
                "stored_wh": 5000,
                "entity_id": "",
                "capacity_wh": 10000,
                "reserve_pct": 20,
            }
        ]
        storage["data"] = {"snapshot": legacy, "revision": 4}
        runtime = cls(hass)
        await runtime.async_load()
        assert runtime.revision == 4
        assert runtime.snapshot["settings"]["expiry_warning_days"] == 30
        assert runtime.data["energy_available"] == 5000
        runtime.store.async_save.assert_not_called()  # Pas bij opslaan herschreven.
        await runtime.async_save(runtime.snapshot, 4)
        assert storage["data"]["schema"] == model.SCHEMA_VERSION
        runtime.unload()

    asyncio.run(run())


@pytest.mark.parametrize("schema", [0, "2", True, None])
def test_invalid_schema_version_rejected(model, storage_runtime, schema):
    async def run():
        cls, hass, storage, _, _ = storage_runtime
        storage["data"] = {"schema": schema, "snapshot": model.defaults(), "revision": 0}
        with pytest.raises(ValueError):
            await cls(hass).async_load()

    asyncio.run(run())


def test_conflict_is_distinct_from_invalid_input(model, storage_runtime):
    async def run():
        cls, hass, _, _, _ = storage_runtime
        module = importlib.import_module("noodkompas_model_test.coordinator")
        runtime = cls(hass)
        await runtime.async_save(model.defaults(), 0)
        with pytest.raises(module.RevisionConflict):
            await runtime.async_save(model.defaults(), 0)
        bad = model.defaults()
        bad["water_l"] = -1
        with pytest.raises(ValueError) as error:
            await runtime.async_save(bad, 1)
        assert not isinstance(error.value, module.RevisionConflict)

    asyncio.run(run())
