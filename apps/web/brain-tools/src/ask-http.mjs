// HTTP client for the live Chronicles answer endpoint.
//
// The eval scripts used to import answerQuestion() from ./query.mjs, a parallel
// re-implementation of the RAG that generated answers with Groq. Production
// answers come from lib/brain/query.ts (Claude Haiku 4.5 primary) served at
// /api/brain/ask. Pointing the evals here means they exercise exactly the code
// path visitors and the voice agent hit — same engine, same model, same route —
// instead of drifting against a second implementation.
//
// Auth: /api/brain/ask is a machine path that takes the LiveKit shared secret as
// a bearer token (see lib/machineAuth.ts) — the same credential the voice agent
// uses. Point BRAIN_ASK_URL at a running server (defaults to the prod service on
// 4652; set it to http://127.0.0.1:3000/api/brain/ask to test the dev server).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const srcDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(srcDir, "..", ".."); // apps/web
const repoRoot = path.resolve(webRoot, "..", ".."); // repo root

// Populate secrets from the same .env files the app uses, without overriding
// anything already exported in the shell. LIVEKIT_API_SECRET lives in
// apps/web/.env.local; the others are checked as fallbacks.
for (const envFile of [
  path.join(webRoot, ".env.local"),
  path.join(srcDir, "..", ".env"), // brain-tools/.env
  path.join(repoRoot, ".env.local"),
]) {
  if (!fs.existsSync(envFile)) continue;
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [rawKey, ...rest] = trimmed.split("=");
    const key = rawKey.trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

export const askEndpoint = process.env.BRAIN_ASK_URL || "http://127.0.0.1:4652/api/brain/ask";
const secret = process.env.LIVEKIT_API_SECRET || "";

// Matches the answerQuestion(question, options) signature the eval scripts used,
// so callers need only change the import. Returns the route's JSON result
// ({ answer, sources: [{ path, title, score, ... }], ... }).
export async function answerQuestion(question, options = {}) {
  if (!secret) {
    throw new Error(
      "LIVEKIT_API_SECRET is not set, so the eval cannot authenticate to " +
        `${askEndpoint}. It is the same bearer the voice agent uses — add it to apps/web/.env.local.`,
    );
  }

  const body = {
    question,
    campaign: options.campaign ?? "All",
    visibility: options.visibility ?? "players",
    answerMode: options.answerMode ?? "direct",
  };
  if (options.topK != null) body.topK = options.topK;
  // The route takes quality ("fast"/"deep"), not review (bool); translate.
  if (options.review === true) body.quality = "deep";
  else if (options.review === false) body.quality = "fast";
  if (options.debug) body.debug = true;

  const headers = {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`,
  };
  // DM visibility is gated on this header in the route, not on a browser session.
  if (body.visibility === "dm") headers["x-sg-admin"] = "1";

  let response;
  try {
    response = await fetch(askEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(
      `Could not reach ${askEndpoint} (${error.message}). Is the site running? ` +
        "Start the prod service (port 4652) or set BRAIN_ASK_URL to your dev server " +
        "(http://127.0.0.1:3000/api/brain/ask).",
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${askEndpoint} returned ${response.status}: ${detail.slice(0, 300)}`);
  }
  return await response.json();
}
