# Verificatie bij oplevering

Datum: 7 oktober 2026.

## Uitgevoerd en geslaagd

- **53 Python-tests**: 44 model-/validatiecases, 3 statische beveiligingscontroles en 6 opslagcontracttests met expliciete Home Assistant-adapterdoubles.
- **15 frontendtests** met het echte panel-script in JSDOM: de negen eerdere beveiligings- en invoertests plus behoud van invoer bij tabwissels, validatie van verborgen velden, onbekende scores, behoud van toetsenbordfocus, pijltjestoetsnavigatie en bescherming tegen onbedoeld verwerpen.
- `ruff check .`: geen fouten.
- `ruff format --check .`: alle Python-bestanden voldoen.
- JavaScript-syntaxcontrole met Node.js.
- Python-syntaxcontrole en JSON-validatie.
- Handmatige review van autorisatiegrenzen, entitygegevens, vaste opslagpaden, XSS, revisieconflicten, onbekende energiesensoren, getalgrenzen en eventuele netwerk-/shellroutes.
- Versie 1.0 is via de Home Assistant-MCP-koppeling gecontroleerd op Home Assistant 2026.10.0: de integratie is geladen, alle vijftien entities zijn beschikbaar en het sidebarpaneel heeft `require_admin=true`.
- Versie 1.1 is in een echte browser visueel gecontroleerd met fictieve gegevens: desktop, mobiel (390 pixels), lichte/donkere modus, lege beginstand, checklist en validatie over tabbladen. De mobiele documentbreedte is gecontroleerd op horizontale overflow.
- Het vernieuwde paneel is nog niet op de live HA-installatie geplaatst. MCP geeft hier geen toegang om de geïnstalleerde custom-componentbestanden te vervangen; daarom wordt een apart installatiepakket geleverd.

## Nog te verifiëren op een echte installatie

De echte Home Assistant-tests in `tests/ha` en de GitHub Actions-workflow zijn meegeleverd, maar **niet uitgevoerd bij oplevering**. Deze Windows-omgeving heeft Python 3.12 en geen geschikte recente Home Assistant/Linux-runtime. Statische decoratorcontroles en adapterdoubles bewijzen niet dat alle lifecycle-, frontend- en permissie-API's op iedere HA-release werken.

De code is afgestemd op de actuele officiële HA-API's en richt zich op Home Assistant 2026.3 en nieuwer. Er is een compatibiliteitslaag voor de overgang van Voluptuous naar Probatio. Dit is geen claim van uitgevoerde runtimecompatibiliteitstests tegen die versies.

Voer voor publicatie/gebruik de meegeleverde HA-suite uit en controleer op je HA-installatie: UI-configuratie, eerste entity-ID's, adminpaneel, weigering van websockettoegang voor een gewone gebruiker, herladen/verwijderen, opslag na herstart, sensorwijzigingen en een datumovergang. De repository is nog niet op GitHub gepubliceerd en HACS heeft hem nog niet daadwerkelijk geïnstalleerd.

## Gebruikte officiële bronnen

- [HA-integratiemanifest](https://developers.home-assistant.io/docs/creating_integration_manifest/)
- [Custom panels](https://developers.home-assistant.io/docs/frontend/custom-ui/creating-custom-panels/)
- [Panelregistratie in HA Core](https://github.com/home-assistant/core/blob/dev/homeassistant/components/panel_custom/__init__.py)
- [Websocketdecorators en admincontrole](https://github.com/home-assistant/core/blob/dev/homeassistant/components/websocket_api/decorators.py)
- [HACS-integratievereisten](https://www.hacs.xyz/docs/publish/integration/)
- [Lokale brand-afbeeldingen vanaf HA 2026.3](https://developers.home-assistant.io/blog/2026/02/24/brands-proxy-api/)
