# Architectuur

Eén config entry per installatie. `model.py` valideert complete snapshots en berekent scores zonder Home Assistant-afhankelijkheden. `coordinator.py` beheert versie-1 Store-opslag, revisies, sensorwijzigingen en dagelijkse vervaldatumberekeningen. Admin-websocketcommando's lezen en vervangen snapshots. Optimistische revisies voorkomen overschrijven door twee geopende panelen. Entities publiceren alleen totalen. Het paneel gebruikt DOM textContent en standaard Home Assistant-websocketauthenticatie.

Structuur: `custom_components/noodkompas/` bevat config flow, opslag, entities, websocket en `frontend/panel.js`; `tests/` bevat berekening-, validatie-, permissie- en frontendtests. Geen externe runtime-dependencies of netwerkclients.
