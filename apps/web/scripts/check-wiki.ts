/**
 * Campaign-wiki checker. Read-only: it reads brain-vault/ and prints a report.
 *
 *   pnpm --filter web check-wiki            # report, up to 25 of each kind
 *   pnpm --filter web check-wiki --all      # every finding
 *   pnpm --filter web check-wiki --json     # machine-readable
 *
 * Pages are loaded with brain-tools' own loadVaultDocuments(), the same code
 * the indexer uses to build what the site and Myra search, so campaign,
 * visibility and link resolution match them exactly. For broken links,
 * orphans and index coverage, run `npm run audit-wiki` in brain-tools/.
 *
 * It only reports; the exit code is non-zero only if the check itself fails.
 */
import { checkWiki, type VaultDoc, type WikiCheckReport } from "../lib/brain/wikiCheck";

const LIMIT = 25;

async function main() {
  const args = new Set(process.argv.slice(2));
  const { loadVaultDocuments } = (await import("../brain-tools/src/vault.mjs")) as {
    loadVaultDocuments: () => Promise<VaultDoc[]>;
  };
  const report = checkWiki(await loadVaultDocuments());
  if (args.has("--json")) console.log(JSON.stringify(report, null, 2));
  else print(report, args.has("--all") ? Infinity : LIMIT);
}

function print(report: WikiCheckReport, limit: number) {
  console.log(`Campaign wiki check: ${report.pageCount} pages\n`);
  section(
    "Links from player pages to DM-only pages (players hit \"DM-only\"; the title shows)",
    report.spoilerLinks,
    limit,
    (item) => `${item.from}  ->  ${item.to}`,
  );
  const bleedBySource = new Map<string, typeof report.campaignBleed>();
  for (const item of report.campaignBleed) bleedBySource.set(item.from, [...(bleedBySource.get(item.from) ?? []), item]);
  section(
    `Campaign bleed (${report.campaignBleed.length} links from ${bleedBySource.size} pages into another campaign)`,
    [...bleedBySource.entries()],
    limit,
    ([from, items]) =>
      `${from} [${items[0]!.fromCampaign}] -> ${items.map((item) => `${item.to.split("/").pop()?.replace(/\.md$/, "")} [${item.toCampaign}]`).join(", ")}`,
  );
  section(
    "Names spelled two ways",
    report.spellingVariants,
    limit,
    (item) => `"${item.titles[0]}" / "${item.titles[1]}" (${item.why})\n      ${item.paths[0]}\n      ${item.paths[1]}`,
  );
  section("Scope disagreements", report.scopeProblems, limit, (item) => `${item.path} ${item.problem}`);
  section(
    "Unnamed map locations (name them in the map editor; the next map import renames the page)",
    report.unnamedLocations,
    limit,
    (item) => item,
  );
}

function section<T>(title: string, items: T[], limit: number, render: (item: T) => string) {
  console.log(`${title}: ${items.length}`);
  for (const item of items.slice(0, limit)) console.log(`  - ${render(item)}`);
  if (items.length > limit) console.log(`  ... ${items.length - limit} more (use --all)`);
  console.log("");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 2;
});
