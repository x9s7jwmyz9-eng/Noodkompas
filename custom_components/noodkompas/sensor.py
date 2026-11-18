"""Publieke totalen, zonder namen of gevoelige attributen."""

from homeassistant.components.sensor import SensorEntity, SensorEntityDescription
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import NoodkompasCoordinator

DESCRIPTIONS = [
    SensorEntityDescription(key=key, name=name, native_unit_of_measurement=unit, icon=icon)
    for key, name, unit, icon in [
        ("score", "Noodkompas Score", "%", "mdi:shield-home"),
        ("water_days", "Noodkompas Water days", "d", "mdi:water"),
        ("food_days", "Noodkompas Food days", "d", "mdi:food"),
        ("energy_available", "Noodkompas Energy available", "Wh", "mdi:battery"),
        ("expiring_items", "Noodkompas Expiring items", None, "mdi:calendar-alert"),
        ("expired_items", "Noodkompas Verlopen producten", None, "mdi:calendar-remove"),
        ("water_required", "Noodkompas Benodigd water", "L", "mdi:water"),
        ("water_score", "Noodkompas Waterscore", "%", "mdi:water"),
        ("food_score", "Noodkompas Voedselscore", "%", "mdi:food"),
        ("energy_score", "Noodkompas Energiescore", "%", "mdi:battery"),
        ("kit_score", "Noodkompas Noodpakketscore", "%", "mdi:bag-personal"),
        ("plan_score", "Noodkompas Noodplanscore", "%", "mdi:map-marker"),
        ("self_sufficiency_days", "Noodkompas Zelfredzaamheid", "d", "mdi:shield-home"),
        ("invalid_energy_sources", "Noodkompas Ongeldige energiebronnen", None, "mdi:alert"),
    ]
]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities(
        NoodkompasSensor(hass.data[DOMAIN]["coordinator"], desc) for desc in DESCRIPTIONS
    )


class NoodkompasSensor(CoordinatorEntity[NoodkompasCoordinator], SensorEntity):
    """Standaard HA-coordinatorentity."""

    def __init__(
        self, coordinator: NoodkompasCoordinator, description: SensorEntityDescription
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_unique_id = f"{DOMAIN}_{description.key}"
        # Nederlandse weergavenaam onafhankelijk van stabiele entity-id.
        names = {
            "score": "Noodkompas Gereedheid",
            "water_days": "Noodkompas Waterdagen",
            "food_days": "Noodkompas Voedseldagen",
            "energy_available": "Noodkompas Beschikbare energie",
            "expiring_items": "Noodkompas Bijna verlopen producten",
        }
        self._attr_name = names.get(description.key, description.name)

    @property
    def suggested_object_id(self) -> str:
        return f"{DOMAIN}_{self.entity_description.key}"

    @property
    def native_value(self) -> float | int:
        value = self.coordinator.data[self.entity_description.key]
        return round(value, 2) if isinstance(value, float) else value
