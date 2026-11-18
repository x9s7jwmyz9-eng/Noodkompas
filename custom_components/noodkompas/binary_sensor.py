"""72 uur gereed wanneer iedere categorie volledig scoort."""

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import NoodkompasCoordinator
from .entity import NoodkompasEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([NoodkompasReady(hass.data[DOMAIN]["coordinator"], entry)])


class NoodkompasReady(NoodkompasEntity, BinarySensorEntity):
    """Publiceer alleen ja/nee. Bewust geen device_class: 'aan' betekent gereed."""

    _attr_name = "72 uur gereed"
    _attr_icon = "mdi:shield-check"

    def __init__(self, coordinator: NoodkompasCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry, "72h_ready")

    @property
    def is_on(self) -> bool:
        return self.coordinator.data["72h_ready"]
