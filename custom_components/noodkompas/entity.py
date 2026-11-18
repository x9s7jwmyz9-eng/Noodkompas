"""Gedeelde basis: één Noodkompas-apparaat met stabiele entity-ID's."""

from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, VERSION
from .coordinator import NoodkompasCoordinator


class NoodkompasEntity(CoordinatorEntity[NoodkompasCoordinator]):
    """Groepeer alle entities onder één service-apparaat."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: NoodkompasCoordinator, entry: ConfigEntry, key: str) -> None:
        super().__init__(coordinator)
        self._key = key
        self._attr_unique_id = f"{DOMAIN}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Noodkompas",
            entry_type=DeviceEntryType.SERVICE,
            sw_version=VERSION,
        )

    @property
    def suggested_object_id(self) -> str:
        # Houd entity-ID's gelijk aan eerdere versies, ook bij een nieuwe installatie.
        return f"{DOMAIN}_{self._key}"
