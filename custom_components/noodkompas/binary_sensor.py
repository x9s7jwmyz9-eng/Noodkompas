"""72 uur gereed wanneer iedere categorie volledig scoort."""

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import NoodkompasCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([NoodkompasReady(hass.data[DOMAIN]["coordinator"])])


class NoodkompasReady(CoordinatorEntity[NoodkompasCoordinator], BinarySensorEntity):
    """Publiceer alleen ja/nee."""

    _attr_name = "Noodkompas 72 uur gereed"
    _attr_unique_id = f"{DOMAIN}_72h_ready"
    _attr_icon = "mdi:shield-check"

    @property
    def suggested_object_id(self) -> str:
        return f"{DOMAIN}_72h_ready"

    @property
    def is_on(self) -> bool:
        return self.coordinator.data["72h_ready"]
