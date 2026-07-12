# Bumpt de service-worker cache, commit en push.
param([string]$Message = "update reisboek")

$path = Resolve-Path "sw.js"
$sw = [System.IO.File]::ReadAllText($path)
if ($sw -notmatch 'sl26-v(\d+)') { Write-Error "Geen CACHE-versie gevonden in sw.js"; exit 1 }

$next = "sl26-v$([int]$Matches[1] + 1)"
$sw = $sw -replace 'sl26-v\d+', $next
[System.IO.File]::WriteAllText($path, $sw)   # UTF-8, geen BOM
Write-Host "Cache -> $next"

git add -A
git commit -m "$Message ($next)"
git push
Write-Host "Gepusht. GitHub Pages doet er ~1 minuut over."
