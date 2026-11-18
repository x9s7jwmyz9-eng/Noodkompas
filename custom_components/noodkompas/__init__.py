"""Noodkompas: lokale Nederlandse noodvoorraad."""

import logging
from pathlib import Path

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers.storage import Store

from .const import DOMAIN, PLATFORMS, VERSION
from .coordinator import NoodkompasCoordinator
from .websocket import ws_get, ws_save

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    runtime = NoodkompasCoordinator(hass, entry)
    try:
        await runtime.async_load()
    except (ValueError, KeyError, TypeError, AttributeError, OSError, HomeAssistantError):
        runtime.unload()
        # Geen inhoud loggen: de opslag bevat privégegevens. Het bestand blijft ongewijzigd.
        _LOGGER.error("Opslag .storage/%s kan niet worden geladen of gemigreerd", DOMAIN)
        raise ConfigEntryNotReady("Lokale opslag kan niet veilig worden geladen") from None
    domain_data = hass.data.setdefault(DOMAIN, {})
    domain_data["coordinator"] = runtime
    entry.async_on_unload(runtime.unload)
    if not domain_data.get("registered"):
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    "/noodkompas_static/panel.js",
                    str(Path(__file__).parent / "frontend" / "panel.js"),
                    True,
                )
            ]
        )
        websocket_api.async_register_command(hass, ws_get)
        websocket_api.async_register_command(hass, ws_save)
        domain_data["registered"] = True
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=DOMAIN,
        webcomponent_name="noodkompas-panel",
        sidebar_title="Noodkompas",
        sidebar_icon="mdi:compass-outline",
        module_url=f"/noodkompas_static/panel.js?v={VERSION}",
        require_admin=True,
    )
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    if await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        runtime = hass.data[DOMAIN].pop("coordinator", None)
        if runtime:
            await runtime.async_stop()
        frontend.async_remove_panel(hass, DOMAIN)
        return True
    return False


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Verwijder private voorraad en noodplan bij verwijderen integratie."""
    await Store(hass, 1, DOMAIN).async_remove()
