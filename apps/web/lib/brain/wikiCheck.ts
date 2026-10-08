/**
 * Campaign-wiki checks that `brain-tools/scripts/audit-wiki.mjs` does not do.
 *
 * audit-wiki already reports broken and ambiguous links, orphan pages and
 * pages missing from the index. This adds the vault's own rules on top:
 *
 *  - Links to DM-only pages from player-visible pages. The Library refuses
 *    the page to players, so the link dead-ends and only its title shows.
 *  - Campaign bleed: a page from one campaign linking into another campaign's
 *    pages ("never bleed information across campaigns", brain-vault/CLAUDE.md).
 *  - Names spelled two ways: page titles that differ only by a typo,
 *    apostrophe, spacing or case ("Iuz'Obal" / "Iuz Obal").
 *  - Scope disagreements: a page filed under one campaign's folder that the
 *    site treats as another campaign (or none), a declared campaign that is
 *    not a known one, or an unrecognised visibility value.
 *
 * Pure functions over documents shaped like brain-tools' loadVaultDocuments()
 * output, so the campaign, visibility and resolved links are exactly the ones
 * the indexer gives the site and Myra. Nothing here reads or writes files.
 */

export const CAMPAIGNS = ["HoE", "SoD", "The Silent Vanguard", "Bloody Endeavor", "Dungeons III", "The Crystal Bottle"] as const;
/** Scopes that are shared by design, not owned by one campaign. */
export const SHARED_SCOPES = ["World", "All"] as const;

export interface VaultDoc {
  relativePath: string;
  frontmatter: Record<string, unknown>;
  metadata: {
    title: string;
    campaign: string;
    visibility: string;
    /** Resolved target paths, as the indexer resolved them. */
    links?: string[];
    browseOnly?: boolean;
  };
}

export interface SpoilerLink {
  from: string;
  to: string;
}

export interface CampaignBleed {
  from: string;
  fromCampaign: string;
  to: string;
  toCampaign: string;
}

export interface SpellingVariant {
  titles: [string, string];
  paths: [string, string];
  why: "punctuation or spacing" | "one letter";
}

export interface ScopeProblem {
  path: string;
  problem: string;
}

export interface WikiCheckReport {
  pageCount: number;
  spoilerLinks: SpoilerLink[];
  campaignBleed: CampaignBleed[];
  spellingVariants: SpellingVariant[];
  scopeProblems: ScopeProblem[];
}

const isCampaign = (value: string): boolean => (CAMPAIGNS as readonly string[]).includes(value);

/** Pages that list or map several campaigns on purpose; links out of them are not bleed. */
function isCrossCampaignPage(doc: VaultDoc): boolean {
  return Boolean(doc.metadata.browseOnly) || /^wiki\/(indexes|maps|timelines|threads)\//.test(doc.relativePath) || /\bby campaign\b/i.test(doc.relativePath);
}

export function findSpoilerLinks(docs: VaultDoc[]): SpoilerLink[] {
  const byPath = new Map(docs.map((doc) => [doc.relativePath, doc]));
  const found: SpoilerLink[] = [];
  for (const doc of docs) {
    if (doc.metadata.visibility === "dm") continue;
    for (const target of new Set(doc.metadata.links ?? [])) {
      if (byPath.get(target)?.metadata.visibility === "dm") found.push({ from: doc.relativePath, to: target });
    }
  }
  return found;
}

export function findCampaignBleed(docs: VaultDoc[]): CampaignBleed[] {
  const byPath = new Map(docs.map((doc) => [doc.relativePath, doc]));
  const found: CampaignBleed[] = [];
  for (const doc of docs) {
    const fromCampaign = doc.metadata.campaign;
    if (!isCampaign(fromCampaign) || isCrossCampaignPage(doc)) continue;
    for (const target of new Set(doc.metadata.links ?? [])) {
      const toCampaign = byPath.get(target)?.metadata.campaign ?? "";
      if (isCampaign(toCampaign) && toCampaign !== fromCampaign) found.push({ from: doc.relativePath, fromCampaign, to: target, toCampaign });
    }
  }
  return found;
}

/** Lowercase letters and digits only: "Iuz'Obal" and "iuz obal" both become "iuzobal". */
function squash(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Whether two strings are one insertion, deletion or substitution apart. */
function oneEditApart(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) === 1;
}

/**
 * Titles that are probably the same name written two ways. Identical titles
 * are fine (the same place has a world page and campaign pages by design),
 * and titles that differ only in numbers are separate sessions or parts.
 */
export function findSpellingVariants(docs: VaultDoc[]): SpellingVariant[] {
  const titles = new Map<string, string>();
  for (const doc of docs) if (!titles.has(doc.metadata.title)) titles.set(doc.metadata.title, doc.relativePath);
  const entries = [...titles.entries()].map(([title, path]) => ({ title, path, key: squash(title) }));
  const found: SpellingVariant[] = [];
  for (let a = 0; a < entries.length; a++) {
    for (let b = a + 1; b < entries.length; b++) {
      const left = entries[a]!;
      const right = entries[b]!;
      // A source and the summary or gazetteer page written from it share a name by design.
      const isSourceCopy = (path: string) => /^wiki\/(summaries|sources)\//.test(path);
      const folder = (path: string) => path.split("/")[1];
      if ((isSourceCopy(left.path) || isSourceCopy(right.path)) && folder(left.path) !== folder(right.path)) continue;
      // "HoE Session 01" and "HoE Session 02" are different pages, not a typo.
      const numbersOnly = (value: string) => value.replace(/\d+/g, "#");
      if (left.key !== right.key && numbersOnly(left.key) === numbersOnly(right.key)) continue;
      let why: SpellingVariant["why"] | null = null;
      if (left.key && left.key === right.key) why = "punctuation or spacing";
      else if (Math.min(left.key.length, right.key.length) >= 6 && oneEditApart(left.key, right.key)) why = "one letter";
      if (why) found.push({ titles: [left.title, right.title], paths: [left.path, right.path], why });
    }
  }
  return found;
}

const KNOWN_VISIBILITY = new Set(["dm", "players"]);

/** The campaign a page's folder implies ("wiki/npcs/HoE/…" is HoE), if any. */
export function folderCampaign(relativePath: string): string | null {
  const parts = relativePath.split("/");
  return CAMPAIGNS.find((campaign) => parts.slice(0, -1).includes(campaign)) ?? null;
}

export function findScopeProblems(docs: VaultDoc[]): ScopeProblem[] {
  const found: ScopeProblem[] = [];
  for (const doc of docs) {
    const declared = doc.frontmatter.campaign;
    if (typeof declared === "string" && declared && !isCampaign(declared) && !(SHARED_SCOPES as readonly string[]).includes(declared)) {
      found.push({ path: doc.relativePath, problem: `declares campaign "${declared}", which is not a known campaign` });
    }
    const folder = folderCampaign(doc.relativePath);
    if (folder && doc.metadata.campaign !== folder) {
      found.push({
        path: doc.relativePath,
        problem: `is in the ${folder} folder, but the site treats it as "${doc.metadata.campaign}"`,
      });
    }
    if (!KNOWN_VISIBILITY.has(doc.metadata.visibility)) {
      found.push({ path: doc.relativePath, problem: `has visibility "${doc.metadata.visibility}"; the site only understands dm or players` });
    }
  }
  return found;
}

export function checkWiki(docs: VaultDoc[]): WikiCheckReport {
  return {
    pageCount: docs.length,
    spoilerLinks: findSpoilerLinks(docs),
    campaignBleed: findCampaignBleed(docs),
    spellingVariants: findSpellingVariants(docs),
    scopeProblems: findScopeProblems(docs),
  };
}
