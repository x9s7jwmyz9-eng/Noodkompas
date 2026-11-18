"""Alle toegang tot private gegevens vereist administratorrechten."""

from copy import deepcopy
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import entity_registry as er

from .compat import vol
from .const import DOMAIN
from .coordinator import RevisionConflict


@websocket_api.websocket_command({"type": "noodkompas/get"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_get(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    runtime = hass.data.get(DOMAIN, {}).get("coordinator")
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Noodkompas is niet geladen")
        return
    registry = er.async_get(hass)
    entities = {
        key: registry.async_get_entity_id(
            "binary_sensor" if key == "72h_ready" else "sensor", DOMAIN, f"{DOMAIN}_{key}"
        )
        for key in runtime.data
    }
    connection.send_result(
        msg["id"],
        {
            "snapshot": deepcopy(runtime.snapshot),
            "revision": runtime.revision,
            "summary": runtime.data,
            "entities": entities,
        },
    )


@websocket_api.websocket_command(
    {
        "type": "noodkompas/save",
        vol.Required("snapshot"): dict,
        vol.Required("revision"): vol.All(int, vol.Range(min=0)),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_save(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    runtime = hass.data.get(DOMAIN, {}).get("coordinator")
    if runtime is None:
        connection.send_error(msg["id"], "not_loaded", "Noodkompas is niet geladen")
        return
    try:
        await runtime.async_save(msg["snapshot"], msg["revision"])
    except RevisionConflict:
        # Apart van ongeldige invoer, zodat het paneel de invoer niet hoeft te verwerpen.
        connection.send_error(msg["id"], "conflict", "De gegevens zijn intussen elders opgeslagen.")
        return
    except ValueError:
        # Geen ingediende inhoud opnemen in logs of foutmeldingen.
        connection.send_error(
            msg["id"],
            "invalid_input",
            "Ongeldige invoer. Controleer de gemarkeerde velden.",
        )
        return
    except (OSError, HomeAssistantError):
        connection.send_error(
            msg["id"], "storage_failed", "Lokale opslag mislukt. Probeer opnieuw."
        )
        return
    connection.send_result(msg["id"], {"revision": runtime.revision, "summary": runtime.data})
