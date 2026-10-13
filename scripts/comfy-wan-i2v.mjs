#!/usr/bin/env node
// On-demand image-to-video through local ComfyUI + Wan 2.2 TI2V-5B (GGUF).
//
//   node scripts/comfy-wan-i2v.mjs --image keyframe.png --prompt "candles flicker..." --out s36-shot1
//
// Starts ComfyUI if it is not running (hidden, --lowvram --reserve-vram 4 so
// Parakeet keeps its GPU share), renders one clip, then STOPS ComfyUI so the
// GPU is released. Pass --keep-running to leave it up between clips.
// The finished MP4 is copied to artwork-drafts/video/<out>.mp4.
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]);
    return acc;
  }, []),
);
const need = (k) => { if (!args[k] || args[k] === true) { console.error(`Missing --${k}`); process.exit(2); } return String(args[k]); };

const COMFY = join(homedir(), 'ComfyUI');
const BASE = 'http://127.0.0.1:8188';
const image = resolve(need('image'));
const prompt = need('prompt');
const out = need('out');
const width = Number(args.width || 672);
const height = Number(args.height || 384);
const frames = Number(args.frames || 33); // must be 4k+1; 24 fps
const steps = Number(args.steps || 16);
const seed = Number(args.seed || Math.floor(Math.random() * 2 ** 31));
const negative = String(args.negative || 'blurry, static, still image, low quality, jpeg artifacts, deformed, extra limbs, watermark, text, subtitles, overexposed');
if ((frames - 1) % 4 !== 0) { console.error('--frames must be 4k+1 (33, 49, 81, 121)'); process.exit(2); }

const ps = (file, ...rest) => spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(COMFY, file), ...rest], { stdio: 'ignore' });
const up = async () => { try { return (await fetch(`${BASE}/system_stats`)).ok; } catch { return false; } };

async function main() {
  if (!(await up())) {
    console.log('Starting ComfyUI...');
    const r = ps('start-comfyui.ps1');
    if (r.status !== 0 || !(await up())) throw new Error(`ComfyUI failed to start (see ~/ComfyUI/comfyui.err.log)`);
  }
  try {
    const name = `${randomUUID()}-${basename(image)}`;
    const form = new FormData();
    form.append('image', new Blob([await readFile(image)]), name);
    const upRes = await (await fetch(`${BASE}/upload/image`, { method: 'POST', body: form })).json();

    const wf = {
      1: { class_type: 'UnetLoaderGGUF', inputs: { unet_name: 'Wan2.2-TI2V-5B-Q5_K_M.gguf' } },
      2: { class_type: 'CLIPLoaderGGUF', inputs: { clip_name: 'umt5-xxl-encoder-Q5_K_M.gguf', type: 'wan' } },
      3: { class_type: 'VAELoader', inputs: { vae_name: 'wan2.2_vae.safetensors' } },
      4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
      5: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['2', 0] } },
      6: { class_type: 'LoadImage', inputs: { image: upRes.name } },
      7: { class_type: 'Wan22ImageToVideoLatent', inputs: { vae: ['3', 0], width, height, length: frames, batch_size: 1, start_image: ['6', 0] } },
      8: { class_type: 'ModelSamplingSD3', inputs: { model: ['1', 0], shift: 8 } },
      9: { class_type: 'KSampler', inputs: { model: ['8', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['7', 0], seed, steps, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1 } },
      10: { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['3', 0] } },
      11: { class_type: 'CreateVideo', inputs: { images: ['10', 0], fps: 24 } },
      12: { class_type: 'SaveVideo', inputs: { video: ['11', 0], filename_prefix: `video/${out}`, format: 'mp4', codec: 'h264' } },
    };
    const q = await fetch(`${BASE}/prompt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf }) });
    if (!q.ok) throw new Error(`ComfyUI rejected the workflow: ${await q.text()}`);
    const { prompt_id } = await q.json();
    console.log(`Queued ${prompt_id} (${width}x${height}, ${frames} frames, ${steps} steps). Rendering...`);

    const started = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, 5000));
      const h = (await (await fetch(`${BASE}/history/${prompt_id}`)).json())[prompt_id];
      if (!h) continue;
      if (h.status?.status_str === 'error') throw new Error(`Render failed: ${JSON.stringify(h.status.messages?.slice(-2))}`);
      const files = Object.values(h.outputs || {}).flatMap((o) => o.images || o.videos || o.gifs || []);
      const vid = files.find((f) => /\.(mp4|webm|mkv)$/i.test(f.filename));
      if (vid) {
        const src = join(COMFY, 'output', vid.subfolder || '', vid.filename);
        const dstDir = resolve('artwork-drafts', 'video');
        await mkdir(dstDir, { recursive: true });
        const dst = join(dstDir, `${out}.mp4`);
        // Re-encode to a plain, universally playable MP4: ComfyUI tags the
        // stream with an sRGB transfer and puts the index at the end, which
        // trips up previews and some players.
        const enc = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv',
          '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', '14', '-preset', 'slow',
          '-movflags', '+faststart', '-an', dst], { stdio: 'inherit' });
        if (enc.status !== 0) { await copyFile(src, dst); console.warn('ffmpeg re-encode failed; copied the raw ComfyUI file.'); }
        console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s -> ${dst}`);
        return;
      }
    }
  } finally {
    if (!args['keep-running']) { ps('stop-comfyui.ps1'); console.log('ComfyUI stopped; GPU released.'); }
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
