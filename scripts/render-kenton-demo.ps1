param([string]$MarketArtwork = '', [switch]$PreviewOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$outputRoot = Join-Path $projectRoot 'artwork-drafts\kenton-demo'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
$portrait = Join-Path $projectRoot 'apps\web\media\images\characters\kenton-clawstar\portrait.png'
$narration = Join-Path $projectRoot 'apps\web\media\images\characters\kenton-clawstar\introduction.mp3'
if ($MarketArtwork) { Copy-Item -LiteralPath $MarketArtwork -Destination (Join-Path $outputRoot 'kenton-market.png') }
if (!(Test-Path -LiteralPath (Join-Path $outputRoot 'kenton-market.png'))) { throw 'Provide -MarketArtwork with the accepted Kenton market illustration.' }
Copy-Item -LiteralPath $portrait -Destination (Join-Path $outputRoot 'kenton-portrait.png')
Copy-Item -LiteralPath $narration -Destination (Join-Path $outputRoot 'kenton-introduction.mp3')
Copy-Item -LiteralPath 'C:\Windows\Fonts\georgia.ttf' -Destination (Join-Path $outputRoot 'title-font.ttf')
Set-Content -LiteralPath (Join-Path $outputRoot 'title.txt') -Value 'KENTON CLAWSTAR' -Encoding utf8NoBOM -NoNewline
Set-Content -LiteralPath (Join-Path $outputRoot 'subtitle.txt') -Value 'Souls of Destiny' -Encoding utf8NoBOM -NoNewline
Set-Content -LiteralPath (Join-Path $outputRoot 'market-title.txt') -Value 'FINE SILKS. FINER ENTRANCES.' -Encoding utf8NoBOM -NoNewline
Set-Content -LiteralPath (Join-Path $outputRoot 'closing.txt') -Value 'SURVIVAL, WITH STYLE.' -Encoding utf8NoBOM -NoNewline
# The video is a standalone preview. No campaign mapping, DB, or production asset changes.
# Three nine-second shots, one-second crossfades, produce 25 seconds at 30 fps.
$filter = @'
[0:v]scale=2560:-1,crop=2560:1440,zoompan=z='1.03+0.12*on/269':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=270:s=1280x720:fps=30,setsar=1,format=yuv420p[a];
[1:v]scale=2560:-1,crop=2560:1440,zoompan=z='1.15-0.1*on/269':x='(iw-iw/zoom)*(0.35+0.3*on/269)':y='ih/2-ih/zoom/2':d=270:s=1280x720:fps=30,setsar=1,format=yuv420p[b];
[2:v]scale=2560:-1,crop=2560:1440,zoompan=z='1.1+0.06*on/269':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=270:s=1280x720:fps=30,setsar=1,format=yuv420p[c];
[a][b]xfade=transition=fade:duration=1:offset=8[ab];
[ab][c]xfade=transition=fade:duration=1:offset=16,
drawbox=x=0:y=535:w=iw:h=185:color=black@0.48:t=fill,
drawtext=fontfile=title-font.ttf:textfile=title.txt:fontcolor=0xf5e6c8:fontsize=56:x=64:y=575:enable='between(t,0.5,7.5)',
drawtext=fontfile=title-font.ttf:textfile=subtitle.txt:fontcolor=0xd9b96f:fontsize=28:x=66:y=650:enable='between(t,0.5,7.5)',
drawtext=fontfile=title-font.ttf:textfile=market-title.txt:fontcolor=0xf5e6c8:fontsize=39:x=64:y=615:enable='between(t,9,15.5)',
drawtext=fontfile=title-font.ttf:textfile=closing.txt:fontcolor=0xf5e6c8:fontsize=45:x=64:y=615:enable='between(t,17.5,24)',
fade=t=in:st=0:d=0.5,fade=t=out:st=24:d=1[v];
[3:a]apad,atrim=duration=25,afade=t=out:st=23:d=2[audio]
'@
Push-Location -LiteralPath $outputRoot
try {
  $arguments = @('-y','-hide_banner','-loglevel','warning','-i','kenton-portrait.png','-i','kenton-market.png','-i','kenton-portrait.png','-i','kenton-introduction.mp3','-filter_complex',$filter,'-map','[v]','-map','[audio]','-t','25','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart','kenton-cinematic-demo.mp4')
  if (!$PreviewOnly) {
    & ffmpeg @arguments
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed: $LASTEXITCODE" }
  }
  Write-Output (Join-Path $outputRoot 'kenton-cinematic-demo.mp4')
} finally { Pop-Location }

