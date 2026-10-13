#!/usr/bin/env node
// On-demand keyframe still through local ComfyUI + FLUX.1 schnell (GGUF).
//
//   node scripts/comfy-flux-still.mjs --prompt "..." --out s36-shot1 [--width 1024 --height 576 --seed 7 --keep-running]
//
// Same start/stop contract as comfy-wan-i2v.mjs: ComfyUI is started hidden
// with --lowvram --reserve-vram 4 and stopped afterward unless --keep-running.
// Output: artwork-drafts/video/<out>.png (feed it to comfy-wan-i2v.mjs --image).
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return acc;
  }, []),
);
const need = (k) => { if (!args[k] || args[k] === true) { console.error(`Missing --${k}`); process.exit(2); } return String(args[k]); };

const COMFY = join(homedir(), 'ComfyUI');
const BASE = 'http://127.0.0.1:8188';
const prompt = need('prompt');
const out = need('out');
const width = Number(args.width || 1024);
const height = Number(args.height || 576);
const seed = Number(args.seed || Math.floor(Math.random() * 2 ** 31));

const ps = (file) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(COMFY, file)], { stdio: 'ignore' });
const up = async () => { try { return (await fetch(`${BASE}/system_stats`)).ok; } catch { return false; } };

async function main() {
  if (!(await up())) {
    console.log('Starting ComfyUI...');
    const r = ps('start-comfyui.ps1');
    if (r.status !== 0 || !(await up())) throw new Error(`ComfyUI failed to start (see ~/ComfyUI/comfyui.err.log)`);
  }
  try {
    const wf = {
      1: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'flux1-schnell-Q4_K_S.gguf' } },
      2: { class_type: 'DualCLIPLoaderGGUF', inputs: { clip_name1: 't5-v1_1-xxl-encoder-Q5_K_M.gguf', clip_name2: 'clip_l.safetensors', type: 'flux' } },
      3: { class_type: 'VAELoader', inputs: { vae_name: 'ae.safetensors' } },
      4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
      5: { class_type: 'EmptySD3LatentImage', inputs: { width, height, batch_size: 1 } },
      6: { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['4', 0], negative: ['4', 0], latent_image: ['5', 0], seed, steps: 4, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
      7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['3', 0] } },
      8: { class_type: 'SaveImage', inputs: { images: ['7', 0], filename_prefix: `video-keyframes/${out}` } },
    };
    const q = await fetch(`${BASE}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf }) });
    if (!q.ok) throw new Error(`ComfyUI rejected the workflow: ${await q.text()}`);
    const { prompt_id } = await q.json();
    console.log(`Queued ${prompt_id} (${width}x${height}, seed ${seed}). Rendering...`);
    const started = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 3000));
      const h = (await (await fetch(`${BASE}/history/${prompt_id}`)).json())[prompt_id];
      if (!h) continue;
      if (h.status?.status_str === 'error') throw new Error(`Render failed: ${JSON.stringify(h.status.messages?.slice(-2))}`);
      const img = Object.values(h.outputs || {}).flatMap((o) => o.images || [])[0];
      if (img) {
        const dstDir = resolve('artwork-drafts', 'video');
        await mkdir(dstDir, { recursive: true });
        const dst = join(dstDir, `${out}.png`);
        await copyFile(join(COMFY, 'output', img.subfolder || '', img.filename), dst);
        console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s -> ${dst}`);
        return;
      }
    }
  } finally {
    if (!args['keep-running']) { ps('stop-comfyui.ps1'); console.log('ComfyUI stopped; GPU released.'); }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
