# Sync LuminaryWorks engineering baseline (.editorconfig, .nvmrc, .npmrc, biome presets)
# Source: packages/tooling (canonical @luminaryworks/tooling)
# Paths: relative to workspace root (sibling of LuminaryWorks) — no drive letter.
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Canonical = Join-Path $PSScriptRoot '..\packages\tooling'
$Templates = Join-Path $Canonical 'templates'

# shared/scripts → shared → LuminaryWorks → {workspace}
$Www = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$Meta = Join-Path $Www 'LuminaryWorks'

$BiomePresets = @(
  'biome.base.json',
  'biome.backend.json',
  'biome.frontend.json',
  'biome.server.json',
  'biome.web.json'
)

$MetaToolingDirs = @(
  (Join-Path $Meta 'tooling'),
  (Join-Path $Www 'blockyedu\tooling'),
  (Join-Path $Www 'vistaremote\tooling'),
  (Join-Path $Www 'doerflow\tooling'),
  (Join-Path $Www 'syncrobrain\tooling'),
  (Join-Path $Www 'dataluminary\tooling')
)

function Copy-FileTo {
  param([string]$Source, [string]$Dest)
  if (-not (Test-Path $Source)) { return }
  $dir = Split-Path $Dest -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if ($DryRun) {
    Write-Host "[dry-run] $Source -> $Dest"
    return
  }
  Copy-Item -Path $Source -Destination $Dest -Force
}

function Write-BiomeJson {
  param([string]$RepoPath, [string]$ExtendsPath)
  $dest = Join-Path $RepoPath 'biome.json'
  $content = @"
{
  "`$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "extends": ["$ExtendsPath"]
}
"@
  if ($DryRun) {
    Write-Host "[dry-run] biome.json -> $dest (extends $ExtendsPath)"
    return
  }
  [System.IO.File]::WriteAllText($dest, $content)
}

# 1) Sync presets into each meta-repo tooling/
foreach ($dir in $MetaToolingDirs) {
  foreach ($preset in $BiomePresets) {
    Copy-FileTo (Join-Path $Canonical $preset) (Join-Path $dir $preset)
  }
  # base always from canonical
  Copy-FileTo (Join-Path $Canonical 'biome.base.json') (Join-Path $dir 'biome.base.json')
}

# 2) Per-repo baseline (Phase C flat layout under {workspace}/)
# Profile: editorconfig, nvmrc, npmrc, biomeExtends (null = skip biome.json)
$Repos = @(
  @{ Path = $Meta; Nvmrc = $false; Npmrc = $false; Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Meta 'docs'); Biome = '../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Meta 'identity'); Biome = $null },
  @{ Path = (Join-Path $Meta 'shared'); Biome = './packages/tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'blockyedu'); Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'blockyedu\server'); Biome = '../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'blockyedu\code-app-web'); Biome = '../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Www 'blockyedu\edu-app-web'); Biome = '../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Www 'blockyedu\media-platform'); Biome = '../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'vistaremote'); Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'vistaremote\server'); Biome = '../tooling/biome.server.json' },
  @{ Path = (Join-Path $Www 'vistaremote\web'); Biome = '../tooling/biome.web.json' },
  @{ Path = (Join-Path $Www 'vistaremote\ai'); Biome = '../tooling/biome.server.json' },
  @{ Path = (Join-Path $Www 'vistaremote\deploy'); Biome = '../tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'vistaremote\desktop'); Biome = '../tooling/biome.desktop.json' },
  @{ Path = (Join-Path $Www 'vistaremote\docs'); Biome = '../tooling/biome.web.json' },
  @{ Path = (Join-Path $Www 'vistaremote\mobile'); Biome = '../tooling/biome.mobile.json' },
  @{ Path = (Join-Path $Www 'vistaremote\shared'); Biome = '../tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'doerflow'); Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\api'); Biome = '../../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\web'); Biome = '../../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\docs'); Biome = '../../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\contracts'); Biome = '../../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\p2p'); Biome = '../../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'doerflow\repos\shared'); Biome = '../../tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'syncrobrain'); Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'dataluminary'); Biome = './tooling/biome.base.json' },
  @{ Path = (Join-Path $Www 'dataluminary\DataTalk'); Biome = '../tooling/biome.backend.json' },
  @{ Path = (Join-Path $Www 'dataluminary\DataView'); Biome = '../tooling/biome.frontend.json' },
  @{ Path = (Join-Path $Www 'dataluminary\ProductWhitePaper'); Biome = '../tooling/biome.frontend.json' }
)

foreach ($repo in $Repos) {
  $p = $repo.Path
  if (-not (Test-Path $p)) {
    Write-Warning "Skip missing: $p"
    continue
  }
  Write-Host "Sync $p"
  Copy-FileTo (Join-Path $Templates 'editorconfig') (Join-Path $p '.editorconfig')
  if ($repo.Nvmrc -ne $false) {
    Copy-FileTo (Join-Path $Templates 'nvmrc') (Join-Path $p '.nvmrc')
  }
  if ($repo.Npmrc -ne $false -and (Test-Path (Join-Path $p 'package.json'))) {
    $npmrc = Join-Path $p '.npmrc'
    if (Test-Path $npmrc) {
      $existing = Get-Content $npmrc -Raw
      if ($existing -notmatch 'engine-strict') {
        if ($DryRun) {
          Write-Host "[dry-run] append engine-strict to $npmrc"
        } else {
          Add-Content -Path $npmrc -Value "`nengine-strict=true"
        }
      }
    } else {
      Copy-FileTo (Join-Path $Templates 'npmrc') $npmrc
    }
  }
  if ($null -ne $repo.Biome) {
    Write-BiomeJson $p $repo.Biome
  }
}

Write-Host "Done. (workspace=$Www)"
