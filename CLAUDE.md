# CLAUDE.md — Reisboek Slovenië 2026, Kids Editie

## Wat dit is

Een offline, mobiel reisboek voor drie kinderen (9, 12 en 13 jaar) tijdens een kampeerreis
door Slovenië, **17 juli – 3 augustus 2026**. Alles in het Nederlands.

Dit is de **kids-versie**. Er bestaat een aparte, veel uitgebreidere ouder-versie
(`Reisboek_Slovenie_2026_v13.html`) met budget, boekingen, tol, vignetten, restaurants met
prijsklassen, dierenartsnummers en laadverdeling. **Die hoort hier niet thuis** — zie Harde regels.

De reis: Duffel → Besigheim → Camp Vodenca (Bovec, 5 nachten) → Camping Sobec (Bled, 6 nachten)
→ Kaki Plac (Piran, 4 nachten) → München → Duffel. 18 dagen, 3.100 km, met een Ierse Setter (Billie).

## Architectuur

Eén zelfstandig HTML-bestand. Geen build, geen framework, geen dependencies, geen CDN.
Vanilla JS in één IIFE onderaan `index.html`. CSS in de `<head>`.

```
index.html            de hele app (HTML + CSS + JS)
sw.js                 service worker, cache-first — hierdoor werkt het zonder bereik
manifest.webmanifest  "zet op beginscherm" / standalone
icon-*.png            app-icons
robots.txt            uit Google houden
.nojekyll             GitHub Pages: geen Jekyll-verwerking
test/smoke.js         headless regressietest (jsdom)
```

Vijf tabbladen: **Dagen** (aftellen + 18 dagkaarten + SOS) · **Avontuur** (10 activiteiten,
zwemplekken, eet-uitdagingen) · **Missies** (30 missies + rangen + eigen rugzak) ·
**Spellen** (bingo, landenspel, Sloveense woorden, weetjes) · **Billie** (hondentaken + tellers).

Opslag: `localStorage`, met sleutels `sl26:<naam>:<id>` per kind en `sl26:fam:<id>` voor het gezin.
Naamkeuze bij eerste opening (Loes / Willem / Charlotte).

## Harde regels — hier zijn we al een keer over gestruikeld

1. **De repo is publiek.** GitHub Pages serveert álles, ook vanuit een private repo.
   Commit nooit prijzen, budgetten, boekingen, telefoonnummers, adressen, dierenartsen,
   of de ouder-versie van het reisboek. De noodnummers in de app worden door de kinderen
   zélf ingetypt en blijven lokaal — die staan niet in de broncode. Houd dat zo.

2. **Bump `CACHE` in `sw.js` bij elke inhoudelijke wijziging.** De service worker is
   cache-first (met opzet: op de camping is geen bereik). Doe je dit niet, dan blijven de
   telefoons de oude versie tonen en lijkt de deploy mislukt. `deploy.sh` / `deploy.ps1` doen dit automatisch.

3. **Geen externe assets.** Geen webfonts, geen CDN, geen externe afbeeldingen. Het moet
   werken in de Soča-vallei zonder bereik. Alleen system fonts en inline SVG/emoji.

4. **Elke `localStorage`-toegang in een try/catch.** In sandboxed previews en op
   `file://`/`content://` gooit hij. De wrappers `put()` / `get()` / `del()` vangen dat af en
   vallen terug op een in-memory object. Roep `localStorage` nooit rechtstreeks aan.

5. **Initialiseer pas onderaan het script.** Er zat een crash in: `setWho()` werd bovenaan
   aangeroepen en riep `loadTicks()` aan, dat `ticks` gebruikt — een `var` die pas 60 regels
   later wordt toegekend. `undefined.forEach` → de hele IIFE brak af → de tab-handlers werden
   nooit gekoppeld → de tabs deden niets. Het opstartblok staat nu bewust helemaal onderaan.

6. **De tabbalk staat bovenaan, in de normale flow** (`nav.tabs`, `position: sticky`).
   Een `position: fixed` balk onderaan verdwijnt in previews die de iframe-hoogte gelijkstellen
   aan de contenthoogte. Niet terugzetten.

7. **Koppel de namen niet aan de leeftijden.** De kinderen heten Loes, Willem en Charlotte en
   zijn 9, 12 en 13 — maar welke welke is, staat niet vast in de bron. Schrijf "12+" of
   "de jongste", nooit "Willem (12)".

8. **Alles in het Nederlands**, informeel (je/jullie), en niet kinderachtig — er zit een
   13-jarige in de doelgroep.

9. **Geen budget of logistiek.** Prijzen, boekingen, tol en vignetten horen in het boek van de
   ouders. Als er iets over geld terugsluipt in de kids-versie: eruit.

## Deploy

GitHub Pages, `main`-branch, root. Wijzigen en publiceren:

```bash
./deploy.sh "wat je veranderd hebt"     # macOS / Linux / Git Bash
.\deploy.ps1 "wat je veranderd hebt"    # Windows PowerShell
```

Beide bumpen de `CACHE`-versie in `sw.js`, committen en pushen.

## Testen

```bash
npm install jsdom     # eenmalig, dev-only
node test/smoke.js
```

Draait de pagina headless in twee scenario's: **eerste opening** (nog geen naam gekozen) en
**terugkerende gebruiker** (naam opgeslagen — dít is het geval dat ooit crashte). Controleert
dat er geen JS-fouten zijn, dat alle vijf tabbladen bestaan en wisselen, en dat de vinkjes
worden teruggeladen. Draai dit vóór elke deploy.

## Bekende beperkingen

- Safari wist lokaal opgeslagen data na ~7 dagen zonder bezoek aan de site. Web-apps op het
  beginscherm zijn daarvan uitgezonderd — vandaar de "zet op beginscherm"-tip in de app.
- Voortgang staat per toestel en per browser. Er is geen server en er zijn geen accounts, dus
  niets synchroniseert tussen de telefoons. Het scorebord toont alleen wat op dát toestel staat.
- Browsergeschiedenis wissen = vinkjes weg. Dat is de prijs van geen backend.
