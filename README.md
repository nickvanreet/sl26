# Reisboek Slovenië 2026 — Kids Editie

Mobiel, offline reisboek voor Loes, Willem en Charlotte. 18 dagen Slovenië, 3 campings, 1 Ierse Setter.
Geen prijzen, geen boekingen, geen tol — dat staat in het boek van papa & mama.

**Live:** `https://<gebruikersnaam>.github.io/sl26/`

---

## Eerste keer publiceren

Plak dit in Claude Code, in deze map:

> Maak een publieke GitHub-repo `sl26`, push de inhoud van deze map, zet GitHub Pages aan vanaf
> de root van de `main`-branch, en geef me de URL. Lees eerst CLAUDE.md.

Handmatig kan ook: repo aanmaken op `github.com/new` (public), de bestanden uploaden via
*uploading an existing file*, dan **Settings → Pages → Deploy from a branch → main / (root)**.

## Wijzigen en opnieuw publiceren

```bash
node test/smoke.js                    # eerst testen (npm install jsdom)
./deploy.sh "toboggan-tijden toegevoegd"
```

`deploy.sh` (of `deploy.ps1` op Windows) bumpt automatisch de cache-versie in `sw.js`.
**Sla die stap niet over** — anders blijven de telefoons de oude versie tonen.

## Naar de kinderen sturen

1. Stuur de link via WhatsApp. Stuur **niet** het bestand: dan werkt de opslag niet en zijn hun
   vinkjes weg zodra ze de app sluiten.
2. Laat ze hem één keer openen **op wifi thuis**.
3. Dan: *Zet op beginscherm* (iPhone: Deel → Zet op beginscherm · Android: ⋮ → App installeren).

Daarna werkt alles zonder bereik — ook in Bovec, ook in de tunnels — en blijft hun voortgang staan.

## Let op

De site is publiek bereikbaar, ook vanuit een private repo. Er staan voornamen van kinderen in en
de exacte data dat het huis leeg is. Er staat een `noindex` en een `robots.txt` in om hem uit Google
te houden; geef de repo een saaie naam en link er nergens naar.
