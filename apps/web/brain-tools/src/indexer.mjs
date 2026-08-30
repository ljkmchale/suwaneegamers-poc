import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { createHash } from "node:crypto";
import { config } from "./config.mjs";
import { embedTexts } from "./ai-client.mjs";
import { chunkDocuments, loadVaultDocuments } from "./vault.mjs";
import { hasIndex, loadIndex, saveIndex } from "./vector-store.mjs";

// Jina's throughput cap on this account is the real bottleneck: ~100k tokens/min
// and only 2 concurrent requests. The old code (16 chunks, fixed 6s delay,
// sequential ≈ 80k TPM) left throughput on the table AND stalled on a fixed timer
// even for tiny rebuilds; going wider trips 429 storms that waste time retrying.
// Instead we pace to a token budget: up to EMBED_CONCURRENCY requests in flight,
// each batch capped by token estimate, and a token bucket held just under the
// per-minute cap. This saturates the tier without 429s. Tunable via env; raising
// EMBED_TPM/CONCURRENCY only helps if the Jina plan's limits are raised too.
const maxBatchSize = Number(process.env.BRAIN_EMBED_BATCH_SIZE ?? 64);
const maxBatchTokens = Number(process.env.BRAIN_EMBED_BATCH_TOKENS ?? 14000);
const embedConcurrency = Number(process.env.BRAIN_EMBED_CONCURRENCY ?? 2);
const tokensPerMinute = Number(process.env.BRAIN_EMBED_TPM ?? 90000);

async function main() {
  console.log(`Vault: ${config.vaultRoot}`);
  console.log("Loading Markdown documents...");
  const documents = await loadVaultDocuments();
  const browseOnlyDocuments = documents.filter((d) => d.metadata.browseOnly);
  const chunks = chunkDocuments(documents);
  console.log(`Loaded ${documents.length} documents (${browseOnlyDocuments.length} browse-only) and prepared ${chunks.length} chunks.`);

  // Content hash keyed by relativePath — used to detect which files changed
  const currentFileHashes = {};
  for (const doc of documents) {
    currentFileHashes[doc.relativePath] = hashContent(doc.body);
  }

  // Reuse embeddings by the hash of the EXACT text sent to the embedder
  // (renderChunkForEmbedding — title/campaign/heading/path/body). Identical input
  // always yields the same vector, so any prior index that stored {text, metadata,
  // embedding} lets us skip re-embedding unchanged chunks — reconstructing the
  // render string from each prior item.
  //
  // The previous logic keyed reuse on a per-file `fileHashes` map that older
  // indexes never stored, so reuse was silently 0 and every rebuild re-embedded
  // all 7000+ chunks. With a 6s delay between 16-chunk batches that is ~40 min,
  // which overran the nightly job's 20-min timeout — so the index could never
  // refresh and went stale for months. Content-hash reuse fixes both: the catch-up
  // rebuild reuses everything unchanged and only embeds genuinely new chunks.
  const previousByRender = new Map();

  if (await hasIndex()) {
    const prevIndex = await loadIndex();
    if (prevIndex.embedModel === config.embedModel) {
      for (const item of prevIndex.items) {
        if (item.text && Array.isArray(item.embedding)) {
          previousByRender.set(hashContent(renderChunkForEmbedding(item)), item.embedding);
        }
      }
      console.log(`Previous index: ${prevIndex.items.length} chunks available for reuse.`);
    } else {
      console.log(`Embed model changed (${prevIndex.embedModel} → ${config.embedModel}), full reindex.`);
    }
  }

  // Split chunks into reuse (identical embedding input seen before) vs embed (new).
  const embeddings = new Array(chunks.length).fill(null);
  const toEmbedIndices = [];

  for (let i = 0; i < chunks.length; i++) {
    const reused = previousByRender.get(hashContent(renderChunkForEmbedding(chunks[i])));
    if (reused) embeddings[i] = reused;
    else toEmbedIndices.push(i);
  }

  const reuseCount = chunks.length - toEmbedIndices.length;
  console.log(`Reusing ${reuseCount} embeddings, embedding ${toEmbedIndices.length} new/changed chunks.`);

  if (toEmbedIndices.length > 0) {
    const renders = toEmbedIndices.map((i) => renderChunkForEmbedding(chunks[i]));
    const estTokens = (text) => Math.ceil(text.length / 4); // ~4 chars/token

    // Pack chunks into batches capped by BOTH count and estimated tokens so no
    // single request trips the per-request token ceiling.
    const batches = [];
    let batch = { idx: [], texts: [], tokens: 0 };
    for (let k = 0; k < renders.length; k += 1) {
      const t = estTokens(renders[k]);
      if (batch.texts.length > 0 && (batch.texts.length >= maxBatchSize || batch.tokens + t > maxBatchTokens)) {
        batches.push(batch);
        batch = { idx: [], texts: [], tokens: 0 };
      }
      batch.idx.push(toEmbedIndices[k]);
      batch.texts.push(renders[k]);
      batch.tokens += t;
    }
    if (batch.texts.length) batches.push(batch);

    console.log(`Embedding ${toEmbedIndices.length} chunks in ${batches.length} batches (<=${maxBatchTokens} tok each, ${embedConcurrency} concurrent, ~${tokensPerMinute} TPM)...`);

    // Token bucket: refills continuously toward the per-minute budget; a request
    // waits until enough tokens are available before it goes out.
    let available = 0; // start empty so we ramp into the cap instead of bursting
    let lastRefill = Date.now();
    const takeTokens = async (need) => {
      for (;;) {
        const now = Date.now();
        available = Math.min(tokensPerMinute, available + ((now - lastRefill) / 60000) * tokensPerMinute);
        lastRefill = now;
        if (available >= Math.min(need, tokensPerMinute)) { available -= need; return; }
        await new Promise((r) => setTimeout(r, Math.ceil(((need - available) / tokensPerMinute) * 60000)));
      }
    };

    let cursor = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const which = cursor++;
        if (which >= batches.length) return;
        const b = batches[which];
        await takeTokens(b.tokens);
        const embedded = await embedTexts(b.texts);
        for (let j = 0; j < b.idx.length; j += 1) embeddings[b.idx[j]] = embedded[j];
        done += b.idx.length;
        console.log(`Embedded ${done} / ${toEmbedIndices.length}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(embedConcurrency, batches.length) }, () => worker()));
  }

  const saved = await saveIndex(chunks, embeddings, browseOnlyDocuments, currentFileHashes);
  console.log(`Saved ${saved.chunkCount} chunks to ${config.indexPath}`);
}

function hashContent(text) {
  return createHash("sha256").update(String(text ?? "")).digest("hex");
}

function renderChunkForEmbedding(chunk) {
  return [
    `Title: ${chunk.metadata.title}`,
    `Campaign: ${chunk.metadata.campaign}`,
    `Heading: ${chunk.metadata.heading}`,
    `Path: ${chunk.metadata.path}`,
    "",
    chunk.text
  ].join("\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
