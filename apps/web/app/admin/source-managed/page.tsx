import { getAutoManagedPages } from "@/lib/autoManagedPagesData";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getManagedCampaignDetailPaths } from "@/lib/campaignDetailLayouts";
import { getActiveCampaigns } from "@/lib/campaigns";
import { getActiveCustomPages } from "@/lib/customPages";
import {
  lockPageAction,
  unlockPageAction,
  setSourceUrlAction,
} from "./actions";

const BUILTIN_LABELS: Record<string, string> = {
  "/": "Home",
  "/campaigns": "Campaigns",
  "/players": "Players",
  "/dungeon-masters": "Dungeon Masters",
  "/bestiary": "Bestiary",
  "/lore": "Legends & Lore",
  "/world": "World",
  "/setting": "Setting",
  "/history": "History",
  "/pantheon": "Pantheon",
  "/gazetteer": "Gazetteer",
  "/campaign-setting": "Campaign Setting",
  "/organizations": "Organizations",
  "/references": "References",
  "/reference-for-dungeon-masters": "Reference for DMs",
  "/territories": "Territories",
  "/calendar": "Calendar",
  "/chronicles": "Chronicles",
  "/maps-of-myrdae": "Maps of Myrdae",
  "/previous-campaigns": "Previous Campaigns",
  "/test-page": "Test Page",
};

interface PathEntry {
  path: string;
  label: string;
  group: string;
}

export default function SourceManagedPage() {
  const locked = getAutoManagedPages();
  const lockedPaths = new Set(locked.map((p) => p.path));

  // Build the full list of manageable paths (same logic as site layout.tsx)
  const campaigns = getActiveCampaigns();
  const campaignPathToLabel = Object.fromEntries(
    campaigns.map((c) => [`/campaigns/${c.id}`, c.name ?? c.id]),
  );

  const customPages = getActiveCustomPages();

  const allPaths: PathEntry[] = [
    // Built-in section / block pages
    ...Object.keys(PAGE_SECTIONS).map((path) => ({
      path,
      label: BUILTIN_LABELS[path] ?? path.replace(/^\//, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      group: "Built-in Pages",
    })),
    // Campaign detail pages
    ...getManagedCampaignDetailPaths().map((path) => ({
      path,
      label: campaignPathToLabel[path] ?? path,
      group: "Campaigns",
    })),
    // Custom pages
    ...customPages.map((p) => ({
      path: `/${p.slug}`,
      label: p.title,
      group: "Custom Pages",
    })),
  ];

  const lockedEntries = locked;
  const unlockedEntries = allPaths.filter((e) => !lockedPaths.has(e.path));

  // Group unlocked by group label
  const groups = [...new Set(unlockedEntries.map((e) => e.group))];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-1">
          Source-Managed Pages
        </h1>
        <p className="text-sm text-[#a89880]">
          Lock a page to disable the layout editor and link its authoritative
          source (Google Doc or Google Calendar).
        </p>
      </div>

      {/* Locked pages */}
      {lockedEntries.length > 0 && (
        <section className="mb-10">
          <h2 className="font-cinzel text-xs tracking-[0.3em] uppercase text-[#8b5cf6] mb-4">
            Source Locked
          </h2>
          <div className="space-y-3">
            {lockedEntries.map((page) => (
              <div
                key={page.path}
                className="rounded-lg border border-[#5b3f11] bg-[#0f0a1a] p-5"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-cinzel text-sm text-[#e8dfc8]">
                      {page.label}
                    </p>
                    <p className="text-xs font-mono text-[#8b5cf6] mt-0.5">
                      {page.path}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-cinzel tracking-widest uppercase px-2 py-1 rounded-full border border-[#f59e0b] text-[#f59e0b]">
                    Locked
                  </span>
                </div>

                {/* Source URL field */}
                <form action={setSourceUrlAction} className="mb-3">
                  <input type="hidden" name="path" value={page.path} />
                  <label className="block font-cinzel text-[10px] tracking-widest uppercase text-[#5a5060] mb-1.5">
                    {page.sourceName === "Google Calendar"
                      ? "Google Calendar URL"
                      : "Google Doc URL"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      name="url"
                      defaultValue={page.sourceUrl ?? ""}
                      placeholder={
                        page.sourceName === "Google Calendar"
                          ? "https://calendar.google.com/calendar/embed?src=…"
                          : "https://docs.google.com/document/d/…"
                      }
                      className="flex-1 min-w-0 rounded border border-[#2a2a35] bg-[#08050f] px-3 py-2 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:outline-none focus:border-[#8b5cf6]"
                    />
                    <button
                      type="submit"
                      className="shrink-0 px-3 py-2 rounded border border-[#2a2a35] font-cinzel text-[10px] tracking-widest uppercase text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </form>

                <form action={unlockPageAction.bind(null, page.path)}>
                  <button
                    type="submit"
                    className="text-xs text-[#5a5060] hover:text-[#ef4444] transition-colors"
                  >
                    Unlock page
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Unlocked pages — grouped */}
      <section>
        <h2 className="font-cinzel text-xs tracking-[0.3em] uppercase text-[#5a5060] mb-4">
          Editable Pages
        </h2>

        {groups.map((group) => {
          const entries = unlockedEntries.filter((e) => e.group === group);
          if (entries.length === 0) return null;
          return (
            <div key={group} className="mb-6">
              <p className="font-cinzel text-[10px] tracking-widest uppercase text-[#3a3040] mb-2 px-1">
                {group}
              </p>
              <div className="border border-[#2a2a35] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.path}
                        className="border-b border-[#2a2a35] last:border-0 hover:bg-[#16161e]"
                      >
                        <td className="px-4 py-3 text-[#e8dfc8]">
                          {entry.label}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#5a5060]">
                          {entry.path}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <form
                            action={lockPageAction.bind(
                              null,
                              entry.path,
                              entry.label,
                            )}
                          >
                            <button
                              type="submit"
                              className="text-xs text-[#5a5060] hover:text-[#f59e0b] transition-colors"
                            >
                              Lock page
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {unlockedEntries.length === 0 && (
          <p className="text-xs text-[#5a5060] px-1">
            All pages are source-locked.
          </p>
        )}
      </section>

      <div className="mt-8 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <p className="font-cinzel text-xs tracking-widest uppercase text-[#5a5060] mb-2">
          How it works
        </p>
        <ol className="text-sm text-[#a89880] space-y-1 list-decimal list-inside">
          <li>
            Lock a page — the Edit Layout button on that page changes to{" "}
            <strong className="text-[#e8dfc8]">Source Locked</strong> and block
            editing is disabled.
          </li>
          <li>
            Paste the Google Doc share URL — it appears as a clickable link in
            the admin overlay and here.
          </li>
          <li>Unlock to re-enable the layout editor at any time.</li>
        </ol>
      </div>
    </div>
  );
}
