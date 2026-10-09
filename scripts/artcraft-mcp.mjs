import { createInterface } from 'node:readline';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Official API: https://github.com/storytold/artcraft/blob/main/_docs/artcraft_omni_api.md
const keyFile = join(homedir(), '.artcraft', 'api-key.txt');
async function key() {
  return process.env.ARTCRAFT_API_KEY?.trim() || await readFile(keyFile, 'utf8').then(s => s.trim()).catch(() => '');
}
const tools = [
  { name: 'artcraft_setup_status', description: 'Check whether an ArtCraft API key is configured. Does not validate credentials or spend credits.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'artcraft_generate_video', description: 'Submit a video generation job using the official ArtCraft API. Spends account credits. Use only for a user-requested generation. References must be publicly reachable URLs. Save and reuse the returned job token; do not automatically retry submission.', inputSchema: { type: 'object', properties: {
    model: { type: 'string' }, prompt: { type: 'string' }, duration_seconds: { type: 'integer', minimum: 1 }, aspect_ratio: { type: 'string' }, resolution: { type: 'string' }, generate_audio: { type: 'boolean' }, negative_prompt: { type: 'string' }, start_frame_image_url: { type: 'string', format: 'uri' }, end_frame_image_url: { type: 'string', format: 'uri' }, reference_image_urls: { type: 'array', items: { type: 'string', format: 'uri' } }, idempotency_token: { type: 'string', format: 'uuid' }
  }, required: ['model', 'prompt', 'duration_seconds', 'aspect_ratio'], additionalProperties: false } },
  { name: 'artcraft_video_job_status', description: 'Read a submitted video job and its finished video URL. Does not submit generation.', inputSchema: { type: 'object', properties: { job_token: { type: 'string', pattern: '^jinf_[a-zA-Z0-9]+$' } }, required: ['job_token'], additionalProperties: false } }
];
async function api(path, body) {
  const secret = await key();
  if (!secret) throw new Error(`ArtCraft API key missing. Set ARTCRAFT_API_KEY or save it in ${keyFile}. ArtCraft staff must enable API access on your account.`);
  const response = await fetch(`https://api.storyteller.ai${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(body ? 240000 : 30000) });
  if (!response.ok) throw new Error(`ArtCraft HTTP ${response.status}. 401: check API access/key; 402: insufficient credits. A failed or timed-out submission may have created a job; inspect your account before resubmitting.`);
  return response.json();
}
async function call(name, args = {}) {
  if (name === 'artcraft_setup_status') return { configured: Boolean(await key()), keyFile, api: 'https://api.storyteller.ai', credentialValidated: false };
  if (name === 'artcraft_video_job_status') {
    if (!/^jinf_[a-zA-Z0-9]+$/.test(args.job_token || '')) throw new Error('Invalid job token');
    return api(`/v1/omni_api/job_status/job/${args.job_token}`);
  }
  if (name === 'artcraft_generate_video') {
    const allowed = Object.keys(tools[1].inputSchema.properties);
    if (Object.keys(args).some(k => !allowed.includes(k))) throw new Error('Unknown generation field');
    if (!args.model || !args.prompt || !args.aspect_ratio || !Number.isInteger(args.duration_seconds) || args.duration_seconds < 1) throw new Error('Model, prompt, positive integer duration, and aspect ratio required');
    for (const url of [args.start_frame_image_url, args.end_frame_image_url, ...(args.reference_image_urls || [])].filter(Boolean)) {
      if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('References require HTTP(S) URLs');
    }
    const idempotency_token = args.idempotency_token || randomUUID();
    try { return { ...await api('/v1/omni_api/generate/video', { ...args, idempotency_token }), idempotency_token }; }
    catch (error) { throw new Error(`${error.message} Submission idempotency token: ${idempotency_token}`); }
  }
  throw new Error('Unknown tool');
}
const lines = createInterface({ input: process.stdin });
for await (const line of lines) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.id === undefined) continue;
    let result;
    if (request.method === 'initialize') result = { protocolVersion: request.params?.protocolVersion || '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'suwaneegamers-artcraft', version: '1.0.0' } };
    else if (request.method === 'ping') result = {};
    else if (request.method === 'tools/list') result = { tools };
    else if (request.method === 'tools/call') {
      try { result = { content: [{ type: 'text', text: JSON.stringify(await call(request.params.name, request.params.arguments)) }] }; }
      catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }
    } else { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32601, message: 'Method not found' } }) + '\n'); continue; }
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  } catch { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request?.id ?? null, error: { code: -32700, message: 'Invalid request' } }) + '\n'); }
}
