# Republish index.html to an existing private Tile.
#
# Needs a tile access token (PAT) with scope content:write, minted by a tile admin
# under Manage -> Automation. Keep it out of the repo: pass it through the environment.
#
#   $env:TILE_TOKEN = '<pat>'
#   powershell -ExecutionPolicy Bypass -File publish.ps1 -Slug <your-tile-slug>
#
# A token upload takes the tile offline until the final publish call succeeds,
# so the script always runs all three steps: upload, finalize, publish.
param(
  [Parameter(Mandatory = $true)][string]$Slug,
  [string]$File = "index.html"
)
$ErrorActionPreference = "Stop"

if (-not $env:TILE_TOKEN) { throw "Set TILE_TOKEN to a tile access token with scope content:write." }
$path = Join-Path $PSScriptRoot $File
if (-not (Test-Path $path)) { throw "File not found: $path" }

$base = "https://tile.accenture.com/mapi/v1/pages/$Slug"
$auth = @{ Authorization = "Bearer $($env:TILE_TOKEN)" }

Write-Host "Uploading $File..."
$upload = Invoke-RestMethod -Method Post -Uri "$base/upload" -Headers $auth -InFile $path -ContentType "text/html"
if (-not $upload.upload_id) { throw "Upload returned no upload_id." }

Write-Host "Finalizing..."
$body = @{ upload_id = $upload.upload_id } | ConvertTo-Json
$final = Invoke-RestMethod -Method Post -Uri "$base/finalize" -Headers $auth -ContentType "application/json" -Body $body
foreach ($w in @($final.warnings)) { if ($w) { Write-Warning $w } }
if ($final.scan) { Write-Host "Scan rating: $($final.scan.rating)" }

Write-Host "Publishing..."
$pub = Invoke-RestMethod -Method Post -Uri "$base/publish" -Headers $auth
if (-not $pub.published) { throw "Publish did not confirm. The tile may be offline; run this script again." }
Write-Host "Published. Reload the tile to see the new version."
