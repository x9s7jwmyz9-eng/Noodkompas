"""Publieke totalen, zonder namen of gevoelige attributen."""

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfEnergy, UnitOfTime, UnitOfVolume
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import NoodkompasCoordinator
from .entity import NoodkompasEntity


def _desc(
    key: str,
    name: str,
    icon: str,
    unit: str | None = None,
    device_class: SensorDeviceClass | None = None,
    precision: int | None = None,
) -> SensorEntityDescription:
    return SensorEntityDescription(
        key=key,
        name=name,
        icon=icon,
        native_unit_of_measurement=unit,
        device_class=device_class,
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=precision,
    )


# Namen zonder "Noodkompas"-voorvoegsel: HA zet de apparaatnaam ervoor.
DESCRIPTIONS = [
    _desc("score", "Gereedheid", "mdi:shield-home", PERCENTAGE, precision=0),
    _desc("water_days", "Waterdagen", "mdi:water", UnitOfTime.DAYS, SensorDeviceClass.DURATION, 1),
    _desc("food_days", "Voedseldagen", "mdi:food", UnitOfTime.DAYS, SensorDeviceClass.DURATION, 1),
    _desc(
        "energy_available",
        "Beschikbare energie",
        "mdi:battery",
        UnitOfEnergy.WATT_HOUR,
        SensorDeviceClass.ENERGY_STORAGE,
        0,
    ),
    _desc("expiring_items", "Bijna verlopen producten", "mdi:calendar-alert"),
    _desc("expired_items", "Verlopen producten", "mdi:calendar-remove"),
    _desc(
        "water_required",
        "Benodigd water",
        "mdi:water",
        UnitOfVolume.LITERS,
        SensorDeviceClass.VOLUME_STORAGE,
        1,
    ),
    _desc("water_score", "Waterscore", "mdi:water", PERCENTAGE, precision=0),
    _desc("food_score", "Voedselscore", "mdi:food", PERCENTAGE, precision=0),
    _desc("energy_score", "Energiescore", "mdi:battery", PERCENTAGE, precision=0),
    _desc("kit_score", "Noodpakketscore", "mdi:bag-personal", PERCENTAGE, precision=0),
    _desc("plan_score", "Noodplanscore", "mdi:map-marker", PERCENTAGE, precision=0),
    _desc(
        "self_sufficiency_days",
        "Zelfredzaamheid",
        "mdi:shield-home",
        UnitOfTime.DAYS,
        SensorDeviceClass.DURATION,
        1,
    ),
    _desc("invalid_energy_sources", "Ongeldige energiebronnen", "mdi:alert"),
]


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    coordinator = hass.data[DOMAIN]["coordinator"]
    async_add_entities(NoodkompasSensor(coordinator, entry, desc) for desc in DESCRIPTIONS)


class NoodkompasSensor(NoodkompasEntity, SensorEntity):
    """Standaard HA-coordinatorentity."""

    def __init__(
        self,
        coordinator: NoodkompasCoordinator,
        entry: ConfigEntry,
        description: SensorEntityDescription,
    ) -> None:
        super().__init__(coordinator, entry, description.key)
        self.entity_description = description

    @property
    def native_value(self) -> float | int:
        value = self.coordinator.data[self.entity_description.key]
        return round(value, 2) if isinstance(value, float) else value
