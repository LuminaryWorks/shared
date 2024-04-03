# Sync LuminaryWorks engineering baseline (.editorconfig, .nvmrc, .npmrc, biome presets)
# Source: packages/tooling (canonical @luminary/tooling)
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Canonical = Join-Path $PSScriptRoot '..\packages\tooling'
$Templates = Join-Path $Canonical 'templates'

$BiomePresets = @(
  'biome.base.json',
  'biome.backend.json',
  'biome.frontend.json',
  'biome.server.json',
  'biome.web.json'
)

$MetaToolingDirs = @(
  'D:\www\LuminaryWorks\tooling',
  'D:\www\BlockyEdu\VibeEdu\tooling',
  'D:\www\VistaRemote\tooling',
  'D:\www\AgentSkillMesh\VibeAgent\tooling',
  'D:\www\LuminaryIoTChain\tooling',
  'D:\www\DataLuminary\DataLuminary-Platform\tooling'
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

# 2) Per-repo baseline
# Profile: editorconfig, nvmrc, npmrc, biomeExtends (null = skip biome.json)
$Repos = @(
  @{ Path = 'D:\www\LuminaryWorks'; Nvmrc = $false; Npmrc = $false; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\LuminaryWorks\docs'; Biome = '../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\LuminaryWorks\identity'; Biome = $null },
  @{ Path = 'D:\www\LuminaryWorks\shared'; Biome = './packages/tooling/biome.base.json' },
  @{ Path = 'D:\www\BlockyEdu\VibeEdu'; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\BlockyEdu\VibeEdu\server'; Biome = '../tooling/biome.backend.json' },
  @{ Path = 'D:\www\BlockyEdu\VibeEdu\code-app-web'; Biome = '../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\BlockyEdu\VibeEdu\edu-app-web'; Biome = '../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\BlockyEdu\VibeEdu\media-platform'; Biome = '../tooling/biome.backend.json' },
  @{ Path = 'D:\www\VistaRemote'; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\VistaRemote\server'; Biome = '../tooling/biome.server.json' },
  @{ Path = 'D:\www\VistaRemote\web'; Biome = '../tooling/biome.web.json' },
  @{ Path = 'D:\www\VistaRemote\ai'; Biome = '../tooling/biome.server.json' },
  @{ Path = 'D:\www\VistaRemote\deploy'; Biome = '../tooling/biome.base.json' },
  @{ Path = 'D:\www\VistaRemote\desktop'; Biome = '../tooling/biome.desktop.json' },
  @{ Path = 'D:\www\VistaRemote\docs'; Biome = '../tooling/biome.web.json' },
  @{ Path = 'D:\www\VistaRemote\mobile'; Biome = '../tooling/biome.mobile.json' },
  @{ Path = 'D:\www\VistaRemote\shared'; Biome = '../tooling/biome.base.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent'; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\api'; Biome = '../../tooling/biome.backend.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\web'; Biome = '../../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\docs'; Biome = '../../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\contracts'; Biome = '../../tooling/biome.backend.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\p2p'; Biome = '../../tooling/biome.backend.json' },
  @{ Path = 'D:\www\AgentSkillMesh\VibeAgent\repos\shared'; Biome = '../../tooling/biome.base.json' },
  @{ Path = 'D:\www\LuminaryIoTChain'; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\DataLuminary\DataLuminary-Platform'; Biome = './tooling/biome.base.json' },
  @{ Path = 'D:\www\DataLuminary\DataLuminary-Platform\DataTalk'; Biome = '../tooling/biome.backend.json' },
  @{ Path = 'D:\www\DataLuminary\DataLuminary-Platform\DataView'; Biome = '../tooling/biome.frontend.json' },
  @{ Path = 'D:\www\DataLuminary\DataLuminary-Platform\ProductWhitePaper'; Biome = '../tooling/biome.frontend.json' }
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

Write-Host 'Done.'
