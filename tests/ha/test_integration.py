"""Runtime- en permissietests tegen echte Home Assistant-API's."""

from copy import deepcopy
from unittest.mock import AsyncMock, MagicMock

import pytest
from homeassistant.components import websocket_api
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.exceptions import Unauthorized
from homeassistant.setup import async_setup_component

from custom_components.noodkompas.coordinator import NoodkompasCoordinator
from custom_components.noodkompas.model import defaults
from custom_components.noodkompas.websocket import ws_get, ws_save


@pytest.mark.parametrize("handler", [ws_get, ws_save])
@pytest.mark.parametrize("user", [None, MagicMock(is_admin=False)])
def test_non_admin_denied_before_any_data_access(hass, handler, user):
    """De echte HA-require_admin-decorator weigert vóór scheduling."""
    connection = MagicMock(user=user)
    with pytest.raises(Unauthorized):
        handler(hass, connection, {"id": 1, "type": "noodkompas/get"})
    connection.send_result.assert_not_called()


async def test_admin_get_and_save_through_real_decorators(hass):
    runtime = NoodkompasCoordinator(hass)
    runtime.store = MagicMock(async_save=AsyncMock())
    runtime.refresh()
    hass.data["noodkompas"] = {"coordinator": runtime}
    connection = MagicMock(is_admin=True)
    connection.user.is_admin = True
    ws_get(hass, connection, {"id": 1, "type": "noodkompas/get"})
    await hass.async_block_till_done()
    assert connection.send_result.call_args.args[1]["snapshot"] == defaults()
    data = defaults()
    data["water_l"] = 9
    ws_save(hass, connection, {"id": 2, "type": "noodkompas/save", "snapshot": data, "revision": 0})
    await hass.async_block_till_done()
    assert runtime.revision == 1
    assert runtime.data["water_days"] == 3
    assert runtime.store.async_save.await_count == 1


async def test_revision_conflict_and_storage_failure(hass):
    runtime = NoodkompasCoordinator(hass)
    runtime.store = MagicMock(async_save=AsyncMock())
    await runtime.async_save(defaults(), 0)
    with pytest.raises(ValueError):
        await runtime.async_save(defaults(), 0)
    before = deepcopy(runtime.snapshot)
    runtime.store.async_save.side_effect = OSError("Disk error")
    changed = defaults()
    changed["water_l"] = 123
    with pytest.raises(OSError):
        await runtime.async_save(changed, 1)
    assert runtime.snapshot == before
    assert runtime.revision == 1


async def test_invalid_input_returns_generic_error(hass):
    runtime = NoodkompasCoordinator(hass)
    runtime.store = MagicMock(async_save=AsyncMock())
    hass.data["noodkompas"] = {"coordinator": runtime}
    connection = MagicMock()
    connection.user.is_admin = True
    data = defaults()
    data["water_l"] = -1
    ws_save(hass, connection, {"id": 1, "snapshot": data, "revision": 0})
    await hass.async_block_till_done()
    assert connection.send_error.call_args.args[1] == "invalid_input"
    runtime.store.async_save.assert_not_called()


async def test_ws_schema_rejects_extra_fields(hass, hass_ws_client):
    assert await async_setup_component(hass, "websocket_api", {})
    websocket_api.async_register_command(hass, ws_save)
    client = await hass_ws_client(hass)
    await client.send_json(
        {
            "id": 1,
            "type": "noodkompas/save",
            "snapshot": defaults(),
            "revision": 0,
            "unexpected": True,
        }
    )
    response = await client.receive_json()
    assert response["success"] is False
    assert response["error"]["code"] == "invalid_format"


async def test_config_flow_single_installation(hass):
    result = await hass.config_entries.flow.async_init("noodkompas", context={"source": "user"})
    assert result["type"] == FlowResultType.FORM
    # Setup wordt apart getest; voorkom hier netwerk-/frontendvoorbereiding.
    from unittest.mock import patch

    with patch("custom_components.noodkompas.async_setup_entry", return_value=True):
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
        await hass.async_block_till_done()
    assert result["type"] == FlowResultType.CREATE_ENTRY
    second = await hass.config_entries.flow.async_init("noodkompas", context={"source": "user"})
    assert second["type"] == FlowResultType.ABORT
