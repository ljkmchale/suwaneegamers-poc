import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { createHash } from "node:crypto";
import { config } from "./config.mjs";
import { embedTexts } from "./ai-client.mjs";
import { chunkDocuments, loadVaultDocuments } from "./vault.mjs";
import { hasIndex, loadIndex, saveIndex } from "./vector-store.mjs";

const batchSize = 16;
const batchDelayMs = 6000;

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
    console.log(`Embedding with ${config.embedModel} via Jina AI...`);
    const chunksToEmbed = toEmbedIndices.map((i) => chunks[i]);

    for (let batchStart = 0; batchStart < chunksToEmbed.length; batchStart += batchSize) {
      if (batchStart > 0) await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      const batch = chunksToEmbed.slice(batchStart, batchStart + batchSize);
      const embedded = await embedTexts(batch.map(renderChunkForEmbedding));
      for (let j = 0; j < batch.length; j++) {
        embeddings[toEmbedIndices[batchStart + j]] = embedded[j];
      }
      console.log(`Embedded ${Math.min(batchStart + batch.length, chunksToEmbed.length)} / ${chunksToEmbed.length}`);
    }
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
