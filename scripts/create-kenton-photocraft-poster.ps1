$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'artwork-drafts\kenton-demo\photocraft-poster'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$steps = @(
  @{command='layer.renameLayer';params=@{name='Kenton - original illustration'}},
  @{command='layer.smartObjects.convertToSmartObject';params=@{}},
  @{command='filter.cameraRaw';params=@{contrast=10;highlights=-22;shadows=8;texture=8;gradeShadows=@{hue=208;sat=15};gradeHighlights=@{hue=38;sat=12}}},
  @{command='gradient.fill.create';params=@{from=@(0,0);to=@(1100,0);stops=@(@(0,'#100c19'),@(1,'#100c19'));transparency=@(@(0,100),@(0.4,92),@(1,0))}},
  @{command='layer.renameLayer';params=@{name='Plum atmosphere - editable gradient'}},
  @{command='shape.create';params=@{kind='rect';rect=@(42,42,1588,857);fill=$null;stroke=@{width=2;color='#a88b55';opacity=65};name='Fine gold frame'}},
  @{command='shape.create';params=@{kind='line';from=@(88,218);to=@(460,218);weight=2;fill='#bd9a5c';name='Gold divider'}},
  @{command='type.create';params=@{x=88;y=180;text='SOULS OF DESTINY';font='Georgia';size=24;tracking=180;color='#cbb27c';name='Campaign label'}},
  @{command='type.create';params=@{x=80;y=400;text='KENTON';font='Georgia';size=105;color='#ead7ac';name='Kenton - editable title'}},
  @{command='layer.layerStyle.gradientOverlay';params=@{from='#9b7036';to='#fff0c2';angle=90;opacity=100}},
  @{command='layer.layerStyle.bevelEmboss';params=@{style='inner';technique='smooth';depth=80;size=2;soften=1;angle=120;altitude=35}},
  @{command='layer.layerStyle.dropShadow';params=@{color='#08040e';opacity=80;distance=8;size=16;angle=120}},
  @{command='type.create';params=@{x=86;y=495;text='CLAWSTAR';font='Georgia';size=62;tracking=45;color='#ead7ac';name='Clawstar - editable title'}},
  @{command='layer.layerStyle.dropShadow';params=@{color='#08040e';opacity=80;distance=5;size=12}},
  @{command='type.create';params=@{x=90;y=578;text='Designer. Artiste. Adventurer.';font='Georgia';size=24;color='#ded0b7';name='Character introduction'}},
  @{command='shape.create';params=@{kind='line';from=@(90,642);to=@(350,642);weight=2;fill='#bd9a5c';name='Lower gold divider'}},
  @{command='type.create';params=@{x=90;y=717;text='SURVIVAL, WITH STYLE.';font='Georgia';size=21;tracking=50;color='#d8bb7e';name='Tagline'}},
  @{command='type.create';params=@{x=90;y=846;text='SUWANEE GAMERS  /  CHARACTER SPOTLIGHT';font='Georgia';size=14;tracking=70;color='#bfae93';name='Poster footer'}}
)
$steps | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $outputRoot 'poster-actions.json') -Encoding utf8NoBOM
$arguments = @('run',(Join-Path $projectRoot 'artwork-drafts\kenton-demo\kenton-market.png'))
foreach ($step in $steps) { $arguments += @('--cmd',$step.command,'--params',($step.params | ConvertTo-Json -Depth 12 -Compress)) }
$arguments += @('--out',(Join-Path $outputRoot 'kenton-poster.psd'))
& 'C:\Program Files\PhotoCraft\photocraft-cli.exe' @arguments
if ($LASTEXITCODE -ne 0) { throw 'PhotoCraft poster composition failed' }
& 'C:\Program Files\PhotoCraft\photocraft-cli.exe' convert (Join-Path $outputRoot 'kenton-poster.psd') (Join-Path $outputRoot 'kenton-poster.png')
if ($LASTEXITCODE -ne 0) { throw 'PhotoCraft PNG export failed' }
