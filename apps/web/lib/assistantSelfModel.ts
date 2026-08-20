import fs from "node:fs";
import { contentPath } from "@/lib/contentFiles";

// Myra's SELF-MODEL — a curated, hand-maintained description of how she works and
// what systems run her (content/assistant-self-knowledge.md). It lets her answer
// "how do you work?", "what model do you use?", "what are your systems?" from an
// accurate, maintained source rather than guessing or reading live source code.
//
// The document is tiered by an ADMIN marker block: everything outside it is safe
// for any signed-in member; the marked block is operational detail shipped ONLY
// to verified admins. Like the brain, this is a plain-file read (Markdown, a
// generated/maintained artifact rather than CMS-edited JSON).

const ADMIN_BEGIN = "<!-- ADMIN:BEGIN";
const ADMIN_END = "<!-- ADMIN:END -->";

function readDoc(): string {
  try {
    return fs.readFileSync(contentPath("assistant-self-knowledge.md"), "utf-8").trim();
  } catch {
    return "";
  }
}

/** The member-safe portion: the document with the ADMIN block removed. */
export function publicSelfModel(doc = readDoc()): string {
  if (!doc) return "";
  const begin = doc.indexOf(ADMIN_BEGIN);
  if (begin === -1) return doc.trim();
  const endMarker = doc.indexOf(ADMIN_END, begin);
  const after = endMarker === -1 ? "" : doc.slice(endMarker + ADMIN_END.length);
  return `${doc.slice(0, begin)}${after}`.replace(/\n{3,}/g, "\n\n").trim();
}

/** The admin-only operational detail inside the ADMIN block, or "" if absent. */
export function adminSelfModel(doc = readDoc()): string {
  if (!doc) return "";
  const begin = doc.indexOf(ADMIN_BEGIN);
  const endMarker = doc.indexOf(ADMIN_END, begin);
  if (begin === -1 || endMarker === -1) return "";
  const bodyStart = doc.indexOf("-->", begin);
  if (bodyStart === -1 || bodyStart > endMarker) return "";
  return doc.slice(bodyStart + 3, endMarker).trim();
}

/**
 * The self-model block for dispatch metadata. Everyone gets the public overview;
 * a verified admin additionally gets the operational-detail block appended. The
 * admin detail is only included when the token route has proven admin status, so
 * internal systems detail never reaches a non-admin.
 */
export function getAssistantSelfModel(isVerifiedAdmin: boolean): string {
  const doc = readDoc();
  const publicPart = publicSelfModel(doc);
  if (!isVerifiedAdmin) return publicPart;
  const adminPart = adminSelfModel(doc);
  return adminPart ? `${publicPart}\n\n${adminPart}` : publicPart;
}
