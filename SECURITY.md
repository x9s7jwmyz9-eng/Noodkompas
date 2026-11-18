# Veiligheidsreview

## Autorisatie

- Sidebarregistratie heeft `require_admin=True`, zonder afzwakbare optie.
- Zowel private lees- als schrijfcommando's hebben de standaard HA-`require_admin`-decorator vóór async-scheduling.
- HTTP levert uitsluitend de ene vaste statische JavaScript-file. Geen opslag, export of willekeurige directory.
- Geen schrijfservices, REST-endpoints of alternatieve schrijfroute.
- Entitywaarden bevatten uitsluitend numerieke totalen en de gereedheidsboolean. Namen, telefoonnummers, locaties, opmerkingen en individuele voorraadregels blijven uit de state machine en Recorder.
- Totalen zijn bewust reguliere HA-entities. Wie alle voorraadindicaties uitsluitend voor admins wil houden, moet aanvullend de HA-toegang tot entities beperken.

## Invoer en opslag

- Exacte sleutelsets op iedere laag; verkeerde typen, booleans als getallen, negatieve getallen, NaN/Infinity en ongeldige datums geweigerd.
- Limieten voor tekst, lijsten en getallen; sensor-ID's beperkt tot `sensor.*`.
- Standaard checklistitems verplicht, checklistnamen en energiesensor-ID's uniek.
- Een fixed-key `Store` bewaart alleen gevalideerde snapshots. Revisiecontrole gebeurt binnen een lock. Mislukt schrijven, dan worden snapshot en revisie niet gepubliceerd.
- Geen API-optie voor bestandspaden, executable code of externe URL's.
- Geen eigen secretslogging. Validatiefouten geven een generieke melding, geen aangeleverde inhoud.

## Frontend

- Alleen DOM-elementconstructie, `textContent` en `value`; geen HTML-interpolatie of eval.
- HA verzorgt authenticatie en de websocketverbinding; geen tokenopslag in eigen localStorage.
- Niet-admin maakt geen private leesaanvraag. Bij intrekking van adminrechten wordt het zichtbare formulier gewist.
- Formuliervalidatie is gebruiksgemak; de backend valideert onafhankelijk.
- Opslaan blokkeert formulierwijzigingen tijdens de schrijfoperatie; fouten behouden de invoer.

## Grenzen

Lokale opslag en backups zijn niet apart versleuteld. Beveilig het Home Assistant-hostsysteem en eventuele backups. HA-admins hebben toegang tot het hele noodplan. De integratie beschermt niet tegen een gecompromitteerde HA-host, browserextensie of administrator. HA's eigen debuglogging kan websocketberichten loggen wanneer dit door de beheerder wordt ingeschakeld.

De statische controles vervangen niet de echte HA-permissietests in `tests/ha`; de GitHub Actions-workflow voert beide uit.

## Een probleem melden

Meld een beveiligingsprobleem niet in een openbaar issue, maar privé via het tabblad **Security → Report a vulnerability** van deze repository. Zet nooit echte noodplangegevens in een melding.
