#!/usr/bin/env bash
# Bumpt de service-worker cache, commit en push. Zonder de bump blijven de
# telefoons de oude versie serveren.
set -euo pipefail

cur=$(grep -oE 'sl26-v[0-9]+' sw.js | head -1)
[ -z "$cur" ] && { echo "Geen CACHE-versie gevonden in sw.js"; exit 1; }
next="sl26-v$(( ${cur##*-v} + 1 ))"

sed -i.bak "s/$cur/$next/g" sw.js && rm -f sw.js.bak
echo "Cache: $cur -> $next"

git add -A
git commit -m "${1:-update reisboek} ($next)"
git push
echo "Gepusht. GitHub Pages doet er ~1 minuut over."
