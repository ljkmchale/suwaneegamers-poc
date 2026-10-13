#!/usr/bin/env node
// Render a whole shot-list film locally (FLUX keyframes -> Wan 2.2 clips -> ffmpeg finish).
//
//   node scripts/render-shot-list.mjs artwork-drafts/video/s36-shot-list.json --name s36-film
//
// Resumable: shots whose clip already exists are skipped. ComfyUI is kept up for
// the whole batch (hidden, --lowvram --reserve-vram 4 so Parakeet keeps its GPU
// share) and stopped at the end, releasing the GPU. Output: artwork-drafts/video/<name>.mp4
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve, extname } from 'node:path';

const listPath = process.argv[2];
if (!listPath || listPath.startsWith('--')) { console.error('Usage: render-shot-list.mjs <shot-list.json> [--name film] [--dissolve 0.25] [--only 03-ferryman] [--out cut-name]'); process.exit(2); }
const opt = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const name = opt('name', 'film');
const outName = opt('out', name); // output file name; clips are still looked up by --name
const dissolve = Number(opt('dissolve', 0.25));
const only = opt('only', null);
const list = JSON.parse(readFileSync(resolve(listPath), 'utf8'));
const dir = resolve('artwork-drafts', 'video');
const W = list.format?.width || 1024;
const H = list.format?.height || 576;
const suffix = list.styleSuffix || '';

const run = (cmd, argv) => spawnSync(cmd, argv, { stdio: 'inherit' });
const node = (script, argv) => run(process.execPath, [resolve('scripts', script), ...argv]);
const stopComfy = () => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(homedir(), 'ComfyUI', 'stop-comfyui.ps1')], { stdio: 'ignore' });

const t0 = Date.now();
const clips = [];
const failed = [];
let n = 0;
try {
  for (const shot of list.shots) {
    n += 1;
    if (only && shot.id !== only) { if (existsSync(join(dir, `${name}-${shot.id}.mp4`))) clips.push({ shot, file: join(dir, `${name}-${shot.id}.mp4`) }); continue; }
    const clip = join(dir, `${name}-${shot.id}.mp4`);
    if (existsSync(clip)) { console.log(`[${n}/${list.shots.length}] ${shot.id}: already rendered, skipping`); clips.push({ shot, file: clip }); continue; }
    console.log(`\n[${n}/${list.shots.length}] ${shot.id}  (${shot.seconds}s / ${shot.frames} frames)  elapsed ${Math.round((Date.now() - t0) / 60000)} min`);

    let keyframe;
    if (shot.keyframe.from === 'existing') {
      keyframe = resolve(shot.keyframe.file);
      if (!existsSync(keyframe)) { console.error(`  missing keyframe ${keyframe}`); failed.push(shot.id); continue; }
    } else {
      const out = `${name}-${shot.id}-key`;
      keyframe = join(dir, `${out}.png`);
      if (!existsSync(keyframe)) {
        const r = node('comfy-flux-still.mjs', ['--keep-running', '--out', out, '--width', String(W), '--height', String(H),
          '--seed', String(1000 + n), '--prompt', `${shot.keyframe.prompt}, ${suffix}`]);
        if (r.status !== 0 || !existsSync(keyframe)) { console.error('  keyframe failed'); failed.push(shot.id); continue; }
      }
    }
    const raw = `${name}-${shot.id}`;
    const r = node('comfy-wan-i2v.mjs', ['--keep-running', '--image', keyframe, '--out', raw, '--frames', String(shot.frames),
      '--width', String(W), '--height', String(H), '--steps', '16', '--seed', String(2000 + n),
      '--prompt', `Cinematic movie scene. ${shot.motion} Realistic motion, film grain, dark fantasy.`]);
    if (r.status !== 0 || !existsSync(clip)) { console.error('  clip failed'); failed.push(shot.id); continue; }
    clips.push({ shot, file: clip });
  }
} finally {
  stopComfy();
  console.log('ComfyUI stopped; GPU released.');
}

if (failed.length) { console.error(`\nFailed shots: ${failed.join(', ')}. Re-run to retry (finished shots are skipped).`); process.exit(1); }
if (only) { console.log('--only run: skipping the stitch.'); process.exit(0); }

// ---- stitch + finish ----
const probe = (f) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout);
const durs = clips.map((c) => probe(c.file));
const inputs = clips.flatMap((c) => ['-i', c.file]);
let chain = ''; let last = '[0:v]'; let acc = durs[0];
for (let i = 1; i < clips.length; i += 1) {
  const off = (acc - dissolve).toFixed(3);
  const out = i === clips.length - 1 ? '[x]' : `[x${i}]`;
  chain += `${last}[${i}:v]xfade=transition=fade:duration=${dissolve}:offset=${off}${out};`;
  last = out; acc = acc + durs[i] - dissolve;
}
// letterbox to 2.39:1, warm candle grade, slow flicker, film grain
const bar = Math.round((H - W / 2.39) / 2);
const finish = `[x]format=yuv420p,` +
  `colorbalance=rs=0.05:gs=-0.01:bs=-0.06:rm=0.04:bm=-0.04,` +
  `eq=brightness='0.018*sin(2*PI*t*7.1)+0.012*sin(2*PI*t*13.7)':saturation=1.08:eval=frame,` +
  `noise=alls=7:allf=t,` +
  `drawbox=x=0:y=0:w=iw:h=${bar}:color=black:t=fill,drawbox=x=0:y=ih-${bar}:w=iw:h=${bar}:color=black:t=fill,` +
  `setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv[v]`;
const filter = clips.length > 1 ? `${chain}${finish}` : `[0:v]null[x];${finish}`;
const dst = join(dir, `${outName}.mp4`);
const enc = run('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', filter, '-map', '[v]',
  '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '16', '-preset', 'slow', '-movflags', '+faststart', '-an', dst]);
if (enc.status !== 0) { console.error('Stitch failed'); process.exit(1); }
console.log(`\nFilm: ${dst}  (${acc.toFixed(1)} s, ${clips.length} shots, ${Math.round((Date.now() - t0) / 60000)} min total)`);
