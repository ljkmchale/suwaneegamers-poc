import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { createHash } from "node:crypto";
import { config } from "./config.mjs";
import { embedTexts } from "./ollama.mjs";
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

  // Load previous index so unchanged files can reuse their embeddings
  let previousEmbeddings = new Map();
  let previousFileHashes = {};

  if (await hasIndex()) {
    const prevIndex = await loadIndex();
    if (prevIndex.embedModel === config.embedModel) {
      previousFileHashes = prevIndex.fileHashes ?? {};
      for (const item of prevIndex.items) {
        // Key by path+heading+chunkIndex (all stored in metadata) so the lookup
        // matches regardless of how stableId transforms the raw chunk id.
        const key = `${item.metadata.path}#${item.metadata.heading}#${item.metadata.chunkIndex}`;
        previousEmbeddings.set(key, item.embedding);
      }
      const unchangedCount = Object.keys(previousFileHashes).filter(
        (f) => previousFileHashes[f] === currentFileHashes[f]
      ).length;
      console.log(`Previous index: ${prevIndex.chunkCount} chunks, ${unchangedCount} files unchanged.`);
    } else {
      console.log(`Embed model changed (${prevIndex.embedModel} → ${config.embedModel}), full reindex.`);
    }
  }

  // Split chunks into reuse (file hash unchanged) vs embed (new or changed)
  const embeddings = new Array(chunks.length).fill(null);
  const toEmbedIndices = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const filePath = chunk.metadata.path;
    const key = `${chunk.metadata.path}#${chunk.metadata.heading}#${chunk.metadata.chunkIndex}`;
    const prevEmbedding = previousEmbeddings.get(key);

    if (prevEmbedding && previousFileHashes[filePath] === currentFileHashes[filePath]) {
      embeddings[i] = prevEmbedding;
    } else {
      toEmbedIndices.push(i);
    }
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
