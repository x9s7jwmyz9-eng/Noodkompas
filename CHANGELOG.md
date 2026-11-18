# Wijzigingen

## 1.2.0 — 18 november 2026

- Opslag krijgt een schemaversie en wordt bij het laden gemigreerd: ontbrekende velden en nieuwe standaarditems worden aangevuld, onbekende velden genegeerd. Een update kan bestaande gegevens daardoor niet meer blokkeren.
- Een revisieconflict geeft de eigen foutcode `conflict`. Het paneel behoudt je invoer en laat je kiezen: laatste versie laden of je eigen versie alsnog opslaan.
- De reserve en capaciteitsgrens gelden nu voor elke energiebron met een ingevulde capaciteit, niet alleen voor een EV. Bestaande niet-EV-bronnen krijgen bij migratie reserve 0%, zodat hun uitkomst gelijk blijft. Nieuwe bronnen starten op 0%.
- Noodplan is compleet met een verzamelplaats en minimaal één contactpersoon; opmerkingen zijn optioneel.
- Producten zonder houdbaarheidsdatum (bederft niet) zijn toegestaan. Nieuwe producten starten op 1 persoonsdag, en het paneel waarschuwt bij 0.
- Alle entities vallen onder één apparaat "Noodkompas". Sensoren hebben `state_class` (langetermijnstatistieken), device classes en weergaveprecisie. Entity-ID's en weergavenamen blijven gelijk.
- Herberekening om middernacht in plaats van elke minuut; de coordinator krijgt de config entry mee.
- Een opslag die niet geladen kan worden, wordt in het logboek gemeld (zonder inhoud).

## 1.1.0 — 7 oktober 2026

- Nieuw Nederlandstalig overzicht met gereedheidsring, drie kerncijfers en vijf klikbare categoriekaarten.
- Gerichte aandachtspunten voor voorraad, houdbaarheid, energie en noodplan.
- Zeven tabbladen met toetsenbordbediening en behoud van onopgeslagen invoer.
- Rustige groene accenten, een compacte checklist, lege beginstanden en een mobiele lay-out.
- Ondersteuning voor de lichte/donkere modus van Home Assistant.
- Eenduidige melding bij wijzigingen; extra bevestiging voordat onopgeslagen invoer wordt verworpen.
- Verborgen ongeldige invoervelden worden zichtbaar vóór browservalidatie.
- Onbekende scores krijgen geen misleidende nulwaarde.
- Ongewijzigde entityupdates behouden de focus op dashboardknoppen.
- Bestaande opslag en entity-ID's blijven gelijk. Geen nieuwe externe afhankelijkheden.

## 1.0.0

Eerste versie met lokale voorraad, noodplan, administratiepaneel en vijftien HA-entities.
