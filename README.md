# Noodkompas

Een volledig Nederlandstalige, lokale Home Assistant-integratie voor noodvoorraad en zelfredzaamheid volgens het 72-uursprincipe. Versie 1.1.0.

## Nieuw in 1.1

Een vernieuwd overzicht met een gereedheidsring, gekleurde voortgangsbalken, gerichte volgende stappen en aparte tabbladen voor alle onderdelen. De lay-out past zich aan mobiel en desktop aan en volgt de lichte of donkere modus van Home Assistant. Bij het wisselen van tabbladen blijft onopgeslagen invoer behouden. Ontbreekt een verplicht veld bij opslaan, dan opent automatisch het bijbehorende tabblad.

## Bijwerken vanaf 1.0

1. Pak `noodkompas-installatie-v1.1.0.zip` uit. Dit pakket bevat alleen de map `noodkompas` met de integratiebestanden.
2. Kopieer die map naar `/config/custom_components/` en overschrijf de bestaande bestanden in `/config/custom_components/noodkompas/`. Verwijder de integratie niet via Apparaten & diensten: dat zou de opgeslagen voorraad verwijderen.
3. Herstart Home Assistant volledig en ververs de browserpagina. Bij een oude weergave gebruik je Ctrl+F5 of wis je de frontendcache van de Companion-app.

Je bestaande voorraad, instellingen en entity-ID's blijven behouden; de opslagstructuur verandert niet. Teruggaan kan door de bestanden uit versie 1.0.0 terug te zetten en Home Assistant te herstarten.

## Wat kun je ermee?

- Huishouden: volwassenen, kinderen en huisdieren.
- Water: liters voorraad, automatisch benodigd water voor drie dagen en beschikbare dagen.
- Voedsel: producten, hoeveelheid, eenheid, houdbaarheidsdatum en waarschuwingen.
- Energie: handmatige Wh/kWh of geselecteerde HA-sensoren; powerbanks, UPS, powerstations, thuisaccu's en EV's met een minimale reserve.
- Noodpakket: vaste checklist en eigen items.
- Noodplan: verzamelplaats, contactpersonen en opmerkingen.
- Dashboard: vijf deelscores, totaalscore, 72 uur gereed en geschatte zelfredzaamheid.
- Vijftien standaard Home Assistant-entities voor dashboards en eigen automatiseringen.

Het sidebarpaneel en de lees-/schrijf-API zijn altijd uitsluitend toegankelijk voor administrators. Gevoelige inhoud wordt niet in entity-attributen gezet. De berekende totalen zijn reguliere HA-entities en zijn zichtbaar voor gebruikers die HA toegang geeft tot die entities.

## Vereisten

Home Assistant **2026.3 of nieuwer**, met de standaard frontend en HTTP/websocket-ondersteuning. Geen YAML-configuratie nodig. Geen cloudaccount of extra Python-runtimeafhankelijkheden. De schemavalidatie gebruikt Home Assistants eigen Probatio of, op oudere versies, Voluptuous.

De integratie zelf maakt geen externe netwerkverbindingen. Een energiesensor uit een andere integratie kan zelf wel afhankelijk zijn van internet. Voor werkelijk offline gebruik selecteer je lokale sensoren of gebruik je handmatige waarden.

## Installeren zonder GitHub of HACS

1. Pak de ZIP uit.
2. Kopieer de map `custom_components/noodkompas` naar de map `custom_components` in je Home Assistant-configuratiemap. Het resultaat is `/config/custom_components/noodkompas/manifest.json`. Maak `custom_components` aan als die nog niet bestaat.
3. Herstart Home Assistant.
4. Ga naar **Instellingen → Apparaten & diensten → Integratie toevoegen** en zoek **Noodkompas**.
5. Bevestig de installatie en open **Noodkompas** in de zijbalk als administrator.
6. Vul de gegevens in en klik **Opslaan**. De entitywaarden worden meteen bijgewerkt.

Je kunt de bestanden bijvoorbeeld kopiëren via een lokaal bestandsshare van je HA-configuratiemap. Deze repository installeert niets automatisch op je bestaande HA-installatie.

## Voor het eerst op GitHub zetten

HACS downloadt custom integrations uit een GitHub-repository; een ZIP op je computer heeft geen HACS-repository-URL. Je hoeft geen programmeerkennis te hebben voor de volgende stappen.

1. Maak een account aan op [GitHub](https://github.com/signup).
2. Maak via [New repository](https://github.com/new) een repository met de naam `noodkompas`. Kies **Public**. Upload alleen de code uit dit pakket, nooit je Home Assistant-configuratie of opgeslagen noodplan.
3. In `custom_components/noodkompas/manifest.json` vervang je `REPLACE_OWNER` in beide links door je GitHub-gebruikersnaam. Als je een andere repositorynaam hebt gekozen, pas je die ook aan. Vul `codeowners` bijvoorbeeld in als `["@jouwgebruikersnaam"]`.
4. In de lege repository kies je **uploading an existing file**. Sleep de **inhoud** van de uitgepakte repository naar het uploadvlak: onder andere `custom_components`, `docs`, `tests`, `README.md`, `hacs.json` en de overige projectbestanden. Upload de ZIP niet als enige bestand en zet geen extra `noodkompas`-map om de inhoud heen.
5. Klik **Commit changes**. Controleer dat `custom_components/noodkompas/manifest.json` direct onder de repository-root staat.
6. Je repository-URL is nu `https://github.com/jouwgebruikersnaam/noodkompas`.

De documentatie-/issuetrackerlinks staan bewust op `REPLACE_OWNER` zolang er geen echte repository-eigenaar bekend is. Voor handmatige installatie zijn ze niet nodig; vul ze voor publicatie in. Je kunt dit ook lokaal automatiseren met `python tools/prepare_repository.py https://github.com/jouwgebruikersnaam/noodkompas`.

Voor de optionele geautomatiseerde controles moet ook de verborgen map `.github` geüpload zijn. GitHub's browserupload ondersteunt niet altijd verborgen bestanden; installeer daarvoor desgewenst GitHub Desktop en voeg de volledige projectmap toe. De integratie zelf en installatie via HACS hebben de workflow niet nodig.

## Installeren via HACS

1. Publiceer de repository zoals hierboven beschreven.
2. Open HACS in Home Assistant.
3. Open het menu rechtsboven en kies **Custom repositories / Aangepaste repositories**.
4. Plak je GitHub-repository-URL, kies type **Integration** en voeg hem toe.
5. Zoek **Noodkompas**, download en herstart Home Assistant.
6. Voeg **Noodkompas** toe via **Instellingen → Apparaten & diensten**.

Een GitHub-release is optioneel: HACS kan de standaardbranch gebruiken. De directorystructuur en metadata volgen de [HACS-integratievereisten](https://www.hacs.xyz/docs/publish/integration/).

## Hoe worden de scores berekend?

| Onderdeel | Berekening |
|---|---|
| Water | Standaard 3 liter × personen per dag, plus ingestelde liters per huisdier. Voorraad gedeeld door dagbehoefte geeft dagen. |
| Voedsel | Hoeveelheid × persoonsdagen per eenheid, opgeteld en gedeeld door personen. Verlopen producten tellen niet mee. |
| Energie | Bruikbare Wh gedeeld door de ingestelde dagbehoefte; standaard 500 Wh per dag per huishouden. |
| Noodpakket | Percentage aanwezige checklistitems; alle zeven standaarditems zijn verplicht en blijven in de checklist. |
| Noodplan | Verzamelplaats, minimaal één contact en opmerkingen leveren ieder een derde van de score. |
| Totaal | Gemiddelde van de vijf deelscores; iedere deelscore is maximaal 100%. |
| 72 uur gereed | Alleen ja als **alle vijf** deelscores ongerond 100% zijn. |
| Zelfredzaamheid | Het minimum van waterdagen, voedseldagen en energiedagen. Checklist en plan zijn apart te beoordelen. |

Volwassenen en kinderen tellen voor deze eerste versie als één persoon. Voor voedsel vul je zelf in hoeveel persoonsdagen één eenheid vertegenwoordigt. Bijvoorbeeld: 0,33 persoonsdag voor een volledige maaltijd bij drie maaltijden per dag. Dit is geen automatische voedingskundige beoordeling. Huisdieren tellen mee voor water; controleer huisdiervoer zelf, bijvoorbeeld met een eigen checklistitem.

De datum is de lokale Home Assistant-datum. Producten op hun houdbaarheidsdatum tellen nog mee; pas de voorraad aan als een product eerder niet meer bruikbaar is. Het waarschuwingsvenster is standaard 30 dagen, inclusief vandaag. De waarschuwingssensor telt productregels met voorraad, geen afzonderlijke stuks. Verlopen producten hebben een aparte sensor. Een wijziging aan de lokale datum wordt binnen één minuut verwerkt.

## Energiesensoren

- **Wh/kWh**: de sensorwaarde moet de huidige beschikbare opgeslagen energie voorstellen, geen cumulatief verbruik of opwekking.
- **%**: vul ook de volledige capaciteit in Wh in. Bijvoorbeeld 50% van 2000 Wh = 1000 Wh.
- Een geselecteerde sensor **vervangt** de handmatige energie voor dat item; waarden worden niet bij elkaar opgeteld.
- `unknown`, `unavailable`, negatieve waarden, niet-eindige waarden, een ongeschikte eenheid of waarden boven 1 miljard Wh leveren 0 Wh en een ongeldige-bronnenwaarschuwing op. Voor kWh geldt het maximum vóór de omrekening als aanvullende invoergrens.
- Een sensor-ID mag maar één keer geselecteerd worden. De integratie kan niet herkennen dat twee verschillende sensoren dezelfde fysieke accu meten: voorkom zelf dubbel tellen.
- Bij een EV is capaciteit verplicht voor een bruikbare berekening. De reserve wordt als percentage van de volledige capaciteit afgetrokken, met een minimum van 0 Wh.
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

De meegestuurde GitHub Actions-workflow voert beide suites uit zodra de repository op GitHub staat. Zie [docs/VERIFICATIE.md](docs/VERIFICATIE.md) voor wat bij oplevering daadwerkelijk is uitgevoerd. Test deze eerste versie op je eigen HA-installatie voordat je op de uitkomsten vertrouwt.

## Problemen oplossen

- **Niet in de integratielijst:** controleer het pad en herstart Home Assistant.
- **Geen sidebaritem:** meld je aan als administrator en herlaad de pagina.
- **Opslaan geweigerd:** controleer verplichte velden, geldige datums, unieke items/sensoren en limieten. Bij een revisieconflict herlaad je het paneel; dit verwerpt onopgeslagen wijzigingen.
- **Geen energiescore:** controleer de sensorwaarde, de eenheid, benodigde capaciteit en EV-reserve.
- **Opslag ongeldig:** de integratie weigert corrupte opslag te overschrijven. Herstel vanuit een backup of verwijder en herinstalleer de integratie als je de gegevens wilt wissen.

Dit is een planningshulpmiddel. De scores meten de ingevulde voorraad en checklist, niet de werkelijke veiligheid, voedingswaarde of technische beschikbaarheid tijdens een noodsituatie.
