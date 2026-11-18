"""Lokale opslag en actualisatie."""

import logging
from asyncio import Lock
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import DOMAIN
from .model import calculate, defaults, validate


class NoodkompasCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Persistente admin-data; publieke coordinator-data bevat alleen totalen."""

    def __init__(self, hass: HomeAssistant) -> None:
        super().__init__(hass, logging.getLogger(__name__), name=DOMAIN, always_update=False)
        self.store = Store(hass, 1, DOMAIN)
        self.snapshot = defaults()
        self.revision = 0
        self._lock = Lock()
        self._closing = False
        self._unsub_states: Callable[[], None] | None = None
        self._unsub_timer: Callable[[], None] | None = None

    async def async_load(self) -> None:
        stored = await self.store.async_load()
        if stored is not None:
            self.snapshot = validate(stored["snapshot"])
            revision = stored["revision"]
            if type(revision) is not int or revision < 0:
                raise ValueError("Ongeldige opslagrevisie")
            self.revision = revision
        self._track_sources()
        self._unsub_timer = async_track_time_interval(
            self.hass, self._refresh_event, timedelta(minutes=1)
        )
        self.refresh()

    @callback
    def _track_sources(self) -> None:
        if self._unsub_states:
            self._unsub_states()
            self._unsub_states = None
        ids = [i["entity_id"] for i in self.snapshot["energy"] if i["entity_id"]]
        if ids:
            self._unsub_states = async_track_state_change_event(self.hass, ids, self._refresh_event)

    @callback
    def _refresh_event(self, event: Any) -> None:
        self.refresh()

    @callback
    def refresh(self) -> None:
        states = {}
        for item in self.snapshot["energy"]:
            if state := self.hass.states.get(item["entity_id"]):
                states[item["entity_id"]] = (
                    state.state,
                    state.attributes.get("unit_of_measurement", ""),
                )
        self.async_set_updated_data(calculate(self.snapshot, dt_util.now().date(), states))

    async def async_save(self, data: dict, revision: int) -> None:
        if type(revision) is not int or revision < 0:
            raise ValueError("Ongeldige revisie")
        snapshot = validate(data)
        async with self._lock:
            if self._closing:
                raise ValueError("Noodkompas wordt ontladen")
            if revision != self.revision:
                raise ValueError("Gegevens zijn gewijzigd; herlaad het paneel")
            next_revision = self.revision + 1
            # Publiceer pas nadat de opslag succesvol is afgerond.
            await self.store.async_save({"snapshot": snapshot, "revision": next_revision})
            self.snapshot, self.revision = snapshot, next_revision
            self._track_sources()
            self.refresh()

    @callback
    def unload(self) -> None:
        self._closing = True
        for unsubscribe in (self._unsub_states, self._unsub_timer):
            if unsubscribe:
                unsubscribe()
        self._unsub_states = self._unsub_timer = None

    async def async_stop(self) -> None:
        """Wacht op actieve writes voordat verwijderen de opslag kan wissen."""
        self._closing = True
        async with self._lock:
            self.unload()

    async def async_remove(self) -> None:
        await self.store.async_remove()
