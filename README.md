# Noodkompas

Een volledig Nederlandstalige, lokale Home Assistant-integratie voor noodvoorraad en zelfredzaamheid volgens het 72-uursprincipe. Versie 1.2.0.

Wat er per versie veranderd is, staat in [CHANGELOG.md](CHANGELOG.md).

## Wat kun je ermee?

- Huishouden: volwassenen, kinderen en huisdieren.
- Water: liters voorraad, automatisch benodigd water voor drie dagen en beschikbare dagen.
- Voedsel: producten, hoeveelheid, eenheid, optionele houdbaarheidsdatum en waarschuwingen.
- Energie: handmatige Wh/kWh of geselecteerde HA-sensoren; powerbanks, UPS, powerstations, thuisaccu's en EV's met een instelbare reserve.
- Noodpakket: vaste checklist en eigen items.
- Noodplan: verzamelplaats, contactpersonen en optionele opmerkingen.
- Dashboard: vijf deelscores, totaalscore, 72 uur gereed en geschatte zelfredzaamheid.
- Vijftien standaard Home Assistant-entities voor dashboards en eigen automatiseringen.

Het sidebarpaneel en de lees-/schrijf-API zijn altijd uitsluitend toegankelijk voor administrators. Gevoelige inhoud wordt niet in entity-attributen gezet. De berekende totalen zijn reguliere HA-entities en zijn zichtbaar voor gebruikers die HA toegang geeft tot die entities.

## Vereisten

Home Assistant **2026.3 of nieuwer**, met de standaard frontend en HTTP/websocket-ondersteuning. Geen YAML-configuratie nodig. Geen cloudaccount of extra Python-runtimeafhankelijkheden. De schemavalidatie gebruikt Home Assistants eigen Probatio of, op oudere versies, Voluptuous.

De integratie zelf maakt geen externe netwerkverbindingen. Een energiesensor uit een andere integratie kan zelf wel afhankelijk zijn van internet. Voor werkelijk offline gebruik selecteer je lokale sensoren of gebruik je handmatige waarden.

## Installeren via de Marktplaats of HACS

1. Open in Home Assistant de **Marktplaats** (of **HACS**).
2. Kies in het menu rechtsboven **Voeg toe via een GitHub-link** (in HACS: **Aangepaste repositories**, type **Integratie**).
3. Plak `https://github.com/x9s7jwmyz9-eng/Noodkompas` en voeg hem toe.
4. Zoek **Noodkompas**, download hem en herstart Home Assistant.
5. Ga naar **Instellingen → Apparaten & diensten → Integratie toevoegen** en zoek **Noodkompas**.
6. Open **Noodkompas** in de zijbalk als administrator, vul je gegevens in en klik **Opslaan**.

Nieuwe versies verschijnen vanzelf als update in de Marktplaats of HACS.

## Handmatig installeren

1. Download de code via **Code → Download ZIP** en pak hem uit.
2. Kopieer de map `custom_components/noodkompas` naar de map `custom_components` in je Home Assistant-configuratiemap. Het resultaat is `/config/custom_components/noodkompas/manifest.json`. Maak `custom_components` aan als die nog niet bestaat.
3. Herstart Home Assistant en voeg de integratie toe zoals in stap 5 en 6 hierboven.

Bijwerken gaat op dezelfde manier: overschrijf de map, herstart en ververs de browser (Ctrl+F5). Verwijder de integratie daarbij **niet** via Apparaten & diensten, want dan worden je opgeslagen gegevens gewist. Opslag van een oudere versie wordt automatisch bijgewerkt.

## Hoe worden de scores berekend?

| Onderdeel | Berekening |
|---|---|
| Water | Standaard 3 liter × personen per dag, plus ingestelde liters per huisdier. Voorraad gedeeld door dagbehoefte geeft dagen. |
| Voedsel | Hoeveelheid × persoonsdagen per eenheid, opgeteld en gedeeld door personen. Verlopen producten tellen niet mee; producten zonder datum bederven niet. |
| Energie | Bruikbare Wh gedeeld door de ingestelde dagbehoefte; standaard 500 Wh per dag per huishouden. |
| Noodpakket | Percentage aanwezige checklistitems; alle zeven standaarditems zijn verplicht en blijven in de checklist. |
| Noodplan | Verzamelplaats en minimaal één contact leveren ieder de helft van de score. Opmerkingen zijn optioneel. |
| Totaal | Gemiddelde van de vijf deelscores; iedere deelscore is maximaal 100%. |
| 72 uur gereed | Alleen ja als **alle vijf** deelscores ongerond 100% zijn. |
| Zelfredzaamheid | Het minimum van waterdagen, voedseldagen en energiedagen. Checklist en plan zijn apart te beoordelen. |

Volwassenen en kinderen tellen als één persoon. Voor voedsel vul je zelf in hoeveel persoonsdagen één eenheid vertegenwoordigt. Bijvoorbeeld: 0,33 persoonsdag voor een volledige maaltijd bij drie maaltijden per dag. Dit is geen automatische voedingskundige beoordeling. Huisdieren tellen mee voor water; controleer huisdiervoer zelf, bijvoorbeeld met een eigen checklistitem.

De datum is de lokale Home Assistant-datum. Producten op hun houdbaarheidsdatum tellen nog mee; pas de voorraad aan als een product eerder niet meer bruikbaar is. Het waarschuwingsvenster is standaard 30 dagen, inclusief vandaag. De waarschuwingssensor telt productregels met voorraad, geen afzonderlijke stuks. Verlopen producten hebben een aparte sensor. Na middernacht wordt de nieuwe datum direct verwerkt. Laat de datum leeg voor producten die niet bederven, zoals zout of suiker; die tellen altijd mee en geven geen waarschuwing.

## Energiesensoren

- **Wh/kWh**: de sensorwaarde moet de huidige beschikbare opgeslagen energie voorstellen, geen cumulatief verbruik of opwekking.
- **%**: vul ook de volledige capaciteit in Wh in. Bijvoorbeeld 50% van 2000 Wh = 1000 Wh.
- Een geselecteerde sensor **vervangt** de handmatige energie voor dat item; waarden worden niet bij elkaar opgeteld.
- `unknown`, `unavailable`, negatieve waarden, niet-eindige waarden, een ongeschikte eenheid of waarden boven 1 miljard Wh leveren 0 Wh en een ongeldige-bronnenwaarschuwing op. Voor kWh geldt het maximum vóór de omrekening als aanvullende invoergrens.
- Een sensor-ID mag maar één keer geselecteerd worden. De integratie kan niet herkennen dat twee verschillende sensoren dezelfde fysieke accu meten: voorkom zelf dubbel tellen.
- Bij een EV is capaciteit verplicht voor een bruikbare berekening.
- Bij elke bron met een ingevulde capaciteit (bijvoorbeeld een thuisaccu of UPS) wordt de energie op die capaciteit begrensd en wordt de reserve als percentage van de volledige capaciteit afgetrokken, met een minimum van 0 Wh. Zonder capaciteit telt de volledige waarde.
- Een EV-accu wordt alleen als noodenergie beschouwd als je die daadwerkelijk kunt gebruiken, bijvoorbeeld met ondersteunde V2L/V2H-apparatuur. Selecteer anders geen EV.

## Entities

Bij een nieuwe installatie zonder bestaande naamconflicten worden onder andere deze entity-ID's aangemaakt:

| Entity | Waarde |
|---|---|
| `sensor.noodkompas_score` | Gereedheid in % |
| `binary_sensor.noodkompas_72h_ready` | 72 uur gereed (aan/uit; in paneel ja/nee) |
| `sensor.noodkompas_water_days` | Waterdagen |
| `sensor.noodkompas_food_days` | Voedseldagen |
| `sensor.noodkompas_energy_available` | Beschikbare Wh |
| `sensor.noodkompas_expiring_items` | Bijna verlopen productregels |
| `sensor.noodkompas_expired_items` | Verlopen productregels |
| `sensor.noodkompas_water_required` | Benodigde liters voor 72 uur |
| `sensor.noodkompas_water_score` | Waterscore |
| `sensor.noodkompas_food_score` | Voedselscore |
| `sensor.noodkompas_energy_score` | Energiescore |
| `sensor.noodkompas_kit_score` | Noodpakketscore |
| `sensor.noodkompas_plan_score` | Noodplanscore |
| `sensor.noodkompas_self_sufficiency_days` | Geschatte zelfredzaamheid |
| `sensor.noodkompas_invalid_energy_sources` | Ongeldige energiesensoren |

Home Assistant kan een achtervoegsel toevoegen bij een naamconflict. Het paneel vraagt de werkelijke entity-ID's op uit het entityregister. Na een handmatige entityhernoeming herlaad je het paneel.

## Privacy en veiligheid

De opslag gebruikt Home Assistants versiebeheer via `Store` op de vaste sleutel `noodkompas` in `.storage`. Er worden geen eigen bestandspaden geaccepteerd. De opslag is lokaal, **niet apart versleuteld**. Iemand met toegang tot het HA-bestandssysteem of een backup kan deze gegevens lezen. Bij verwijderen van de integratie wordt de actuele opslag verwijderd; eerdere backups blijven bestaan.

Beide websocketcommando's, `noodkompas/get` en `noodkompas/save`, vereisen HA-administratorrechten. De frontendcontrole is extra bescherming; de server beslist. Iedere snapshot wordt volledig server-side gevalideerd. Een revisienummer voorkomt dat twee geopende panelen elkaars werk stilzwijgend overschrijven. De frontend voegt gebruikerscontent toe via `textContent` en `value`, nooit als HTML. De statische route levert alleen de meegeleverde JavaScript-file, geen voorraad of noodplan.

De integratie heeft geen eigen REST-endpoints, shellacties, netwerkclients, logging van voorraad/noodplan of diagnostics-export. Standaard HA-debuglogging kan websocketverkeer bevatten als je zelf debuglogging inschakelt; laat dit uit bij gevoelige gegevens. Zie [SECURITY.md](SECURITY.md) voor de review en grenzen van verificatie.

## Ontwikkelen en testen

```text
python -m pip install -r requirements-dev.txt
python -m pytest -q
python -m ruff check .
python -m ruff format --check .
pnpm install --frozen-lockfile
pnpm run check
pnpm test
```

De standaard pytest-suite test het pure model en controleert beveiligingsstructuur. De DOM-suite test het echte panel-script in JSDOM. Voor de **echte Home Assistant-runtime- en permissietests**, op een Linux-omgeving met een geschikte Python-versie voor de geïnstalleerde HA-release:

```text
python -m pip install pytest-homeassistant-custom-component
python -m pytest -o addopts='' -o asyncio_mode=auto tests/ha -q
```

De GitHub Actions-workflow voert beide suites uit bij elke push.

## Problemen oplossen

- **Niet in de integratielijst:** controleer het pad en herstart Home Assistant.
- **Geen sidebaritem:** meld je aan als administrator en herlaad de pagina.
- **Opslaan geweigerd:** controleer verplichte velden, geldige datums, unieke items/sensoren en limieten. Bij een revisieconflict kies je in het paneel tussen de laatste versie laden of je eigen versie alsnog opslaan; je invoer blijft staan tot je kiest.
- **Geen energiescore:** controleer de sensorwaarde, de eenheid, benodigde capaciteit en reserve.
- **Opslag ongeldig:** opslag van oudere versies wordt automatisch gemigreerd. Lukt dat niet, dan weigert de integratie de opslag te overschrijven en meldt dit in het logboek (zonder inhoud). Herstel vanuit een backup of verwijder en herinstalleer de integratie als je de gegevens wilt wissen.

Dit is een planningshulpmiddel. De scores meten de ingevulde voorraad en checklist, niet de werkelijke veiligheid, voedingswaarde of technische beschikbaarheid tijdens een noodsituatie.
