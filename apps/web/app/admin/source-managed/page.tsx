import { getAutoManagedPages } from "@/lib/autoManagedPagesData";
import { getManagedSourceLinks } from "@/lib/autoManagedPages";
import { PAGE_SECTIONS } from "@/lib/pageSections";
import { getManagedCampaignDetailPaths } from "@/lib/campaignDetailLayouts";
import { getActiveCampaigns } from "@/lib/campaigns";
import { getActiveCustomPages } from "@/lib/customPages";
import { getContentSyncJobStatuses } from "@/lib/contentScheduler";
import { getNavConfig } from "@/lib/nav";
import { ScheduleEditor } from "./ScheduleEditor";
import { AddScheduleForm } from "./AddScheduleForm";
import { BackToTopButton } from "./BackToTopButton";
import { RefreshButton } from "./RefreshButton";
import { RefreshStatus } from "./RefreshStatus";
import { RefreshPoller } from "./RefreshPoller";
import { RunNowForm } from "./RunNowForm";
import { SourcePageFold } from "./SourcePageFold";
import {
  lockPageAction,
  unlockPageAction,
  setManagedSourceUrlAction,
  addManagedSourceAction,
  removeManagedSourceAction,
  removePageScheduleAction,
  refreshPageAction,
} from "./actions";

export const dynamic = "force-dynamic";

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
  "/adventures": "Adventures",
  "/reference-for-dungeon-masters": "Reference for DMs",
  "/territories": "Territories",
  "/calendar": "Calendar",
  "/advents_of_harmony": "Advents of Harmony",
  "/maps-of-myrdae": "Maps of Myrdae",
  "/previous-campaigns": "Previous Campaigns",
  "/test-page": "Test Page",
};

interface PathEntry {
  path: string;
  label: string;
  group: string;
}

interface SourceManagedPageProps {
  searchParams?: Promise<{
    status?: string;
    path?: string;
    message?: string;
  }>;
}

function formatDateTime(value: string | null) {
  if (!value) return "Not run yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(value: number | null) {
  if (!value) return "";
  if (value < 1000) return `${value}ms`;
  return `${Math.round(value / 1000)}s`;
}

export default async function SourceManagedPage({ searchParams }: SourceManagedPageProps) {
  const refreshStatus = await searchParams;
  const refreshMessage = refreshStatus?.message;
  const refreshPath = refreshStatus?.path;
  const locked = getAutoManagedPages();
  const lockedPaths = new Set(locked.map((p) => p.path));
  const contentSyncJobs = getContentSyncJobStatuses();
  const hasRunningJob = contentSyncJobs.some((j) => j.lastStatus === "running");

  const campaigns = getActiveCampaigns();
  const campaignPathToLabel = Object.fromEntries(
    campaigns.map((c) => [`/campaigns/${c.id}`, c.name ?? c.id]),
  );

  const customPages = getActiveCustomPages();

  const allPaths: PathEntry[] = [
    ...Object.keys(PAGE_SECTIONS).map((path) => ({
      path,
      label: BUILTIN_LABELS[path] ?? path.replace(/^\//, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      group: "Built-in Pages",
    })),
    ...getManagedCampaignDetailPaths().map((path) => ({
      path,
      label: campaignPathToLabel[path] ?? path,
      group: "Campaigns",
    })),
    ...customPages.map((p) => ({
      path: `/${p.slug}`,
      label: p.title,
      group: "Custom Pages",
    })),
  ];

  const lockedEntries = locked;
  const unlockedEntries = allPaths.filter((e) => !lockedPaths.has(e.path));

  const pathToJobs = new Map<string, typeof contentSyncJobs>();
  for (const job of contentSyncJobs) {
    if (job.id === "content-documents") continue;
    for (const path of job.revalidatePaths) {
      const existing = pathToJobs.get(path) ?? [];
      pathToJobs.set(path, [...existing, job]);
    }
  }

  const lockedJobIds = new Set(
    [...pathToJobs.entries()]
      .filter(([path]) => lockedPaths.has(path))
      .flatMap(([, jobs]) => jobs.map((j) => j.id)),
  );
  const backgroundJobs = contentSyncJobs.filter(
    (j) => j.id === "content-documents" || !lockedJobIds.has(j.id),
  );

  const groups = [...new Set(unlockedEntries.map((e) => e.group))];

  const navHrefs = new Set(
    getNavConfig().sections.flatMap((s) => s.items.map((i) => i.href)),
  );

  return (
    <div>
      <RefreshPoller hasRunning={hasRunningJob} />
      <BackToTopButton />
      <div className="mb-8">
        <h1 className="font-cinzel text-3xl tracking-widest uppercase mb-1">
          Source-Managed Pages
        </h1>
        <p className="text-sm text-[#a89880]">
          Lock a page to disable the layout editor and link its authoritative source documents.
          Add docs and schedules for each page below.
        </p>
      </div>

      <RefreshStatus
        status={refreshStatus?.status}
        path={refreshPath}
        message={refreshMessage}
      />

      {/* Source-locked pages */}
      {lockedEntries.length > 0 && (
        <section className="mb-10">
          <h2 className="font-cinzel text-xs tracking-[0.3em] uppercase text-[#8b5cf6] mb-4">
            Source Locked
          </h2>
          <div className="space-y-3">
            {lockedEntries.map((page) => {
              const pageJobs = pathToJobs.get(page.path) ?? [];
              const sources = getManagedSourceLinks(page);
              return (
                <SourcePageFold
                  key={page.path}
                  label={page.label}
                  path={page.path}
                  notInNav={!navHrefs.has(page.path)}
                  generated={page.generated}
                >
                  {/* Source Docs */}
                  <div className="mb-4 rounded-lg border border-[#2a2a35] bg-[#08050f] p-3">
                    <p className="mb-2 font-cinzel text-[10px] tracking-widest uppercase text-[#9080a0]">
                      Source Docs
                    </p>
                    <div className="space-y-2">
                      {sources.map((source) => {
                        const linkedJob = source.syncJobId
                          ? contentSyncJobs.find((j) => j.id === source.syncJobId)
                          : undefined;
                        return (
                        <div
                          key={`${source.key}-${source.url}`}
                          className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2"
                        >
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="font-cinzel text-[10px] tracking-widest uppercase text-[#8b5cf6]">
                              {source.label}
                            </span>
                            {source.section && (
                              <span className="text-[11px] text-[#a89880] italic">
                                {source.section}
                              </span>
                            )}
                            {linkedJob && (
                              <span className="ml-auto text-[10px] font-cinzel tracking-widest text-[#6a5a78]">
                                Synced by: <span className="text-[#9080a0]">{linkedJob.label}</span> · <span className="text-[#9080a0]">{linkedJob.schedule}</span>
                              </span>
                            )}
                          </div>
                          {/* Edit URL form */}
                          <form action={setManagedSourceUrlAction}>
                            <input type="hidden" name="path" value={page.path} />
                            <input type="hidden" name="sourceKey" value={source.key ?? ""} />
                            <div className="flex gap-2 mb-2">
                              <input
                                type="url"
                                name="url"
                                defaultValue={source.url}
                                className="min-w-0 flex-1 rounded border border-[#2a2a35] bg-[#08050f] px-3 py-2 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
                              />
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 rounded border border-[#2a2a35] px-3 py-2 font-cinzel text-[10px] uppercase tracking-widest text-[#9080a0] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]"
                              >
                                Open
                              </a>
                              <button
                                type="submit"
                                className="shrink-0 rounded border border-[#2a2a35] px-3 py-2 font-cinzel text-[10px] uppercase tracking-widest text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#e8dfc8]"
                              >
                                Save
                              </button>
                            </div>
                            <input
                              type="text"
                              name="section"
                              defaultValue={source.section ?? ""}
                              placeholder="Section / tab pulled from (e.g. Territories tab, Row 3)"
                              className="w-full rounded border border-[#2a2a35] bg-[#08050f] px-3 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
                            />
                          </form>
                          {/* Per-source actions */}
                          <div className="mt-2 flex items-center gap-4">
                            {linkedJob && (
                              <RunNowForm jobId={linkedJob.id} label="Force update" />
                            )}
                            {source.key?.startsWith("managedSources.") && (
                              <form action={removeManagedSourceAction}>
                                <input type="hidden" name="path" value={page.path} />
                                <input type="hidden" name="sourceKey" value={source.key} />
                                <button
                                  type="submit"
                                  className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#ef4444] transition-colors"
                                >
                                  Remove doc
                                </button>
                              </form>
                            )}
                            <AddScheduleForm
                              pagePath={page.path}
                              pageLabel={page.label}
                              defaultLabel={source.label}
                              sourceJobId={source.syncJobId}
                              triggerLabel="+ Schedule this doc"
                            />
                          </div>
                        </div>
                      );
                      })}
                    </div>

                    {/* Add doc form */}
                    <details className="mt-3 group">
                      <summary className="cursor-pointer list-none font-cinzel text-[10px] uppercase tracking-widest text-[#9080a0] hover:text-[#8b5cf6] transition-colors select-none">
                        + Add doc
                      </summary>
                      <form action={addManagedSourceAction} className="mt-2 rounded border border-[#2a2a35] bg-[#0f0a1a] p-3 space-y-2">
                        <input type="hidden" name="path" value={page.path} />
                        <input
                          type="text"
                          name="label"
                          placeholder="Label (e.g. Player Notes Google Doc)"
                          required
                          className="w-full rounded border border-[#2a2a35] bg-[#08050f] px-3 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
                        />
                        <input
                          type="url"
                          name="url"
                          placeholder="https://docs.google.com/..."
                          required
                          className="w-full rounded border border-[#2a2a35] bg-[#08050f] px-3 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
                        />
                        <input
                          type="text"
                          name="section"
                          placeholder="Section / tab (optional)"
                          className="w-full rounded border border-[#2a2a35] bg-[#08050f] px-3 py-1.5 text-xs text-[#e8dfc8] placeholder-[#3a3040] focus:border-[#8b5cf6] focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="rounded border border-[#2a2a35] px-3 py-1.5 font-cinzel text-[10px] uppercase tracking-widest text-[#a89880] hover:border-[#8b5cf6] hover:text-[#e8dfc8] transition-colors"
                        >
                          Add doc
                        </button>
                      </form>
                    </details>
                  </div>

                  {/* Sync Schedules */}
                  <div className="mb-4 rounded-lg border border-[#2a2a35] bg-[#08050f] p-3">
                    <p className="mb-2 font-cinzel text-[10px] tracking-widest uppercase text-[#9080a0]">
                      Sync Schedules
                    </p>
                    {pageJobs.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {pageJobs.map((job) => {
                          const ok = job.lastStatus === "succeeded";
                          const running = job.lastStatus === "running";
                          const failed = job.lastStatus === "failed";
                          return (
                            <div
                              key={job.id}
                              className="rounded border border-[#2a2a35] bg-[#0f0a1a] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <span className="font-cinzel text-[11px] text-[#e8dfc8]">
                                  {job.label}
                                </span>
                                <ScheduleEditor
                                  jobId={job.id}
                                  scheduleSpec={job.scheduleSpec}
                                  scheduleFallback={job.schedule}
                                />
                                <span
                                  className={`ml-auto rounded border px-2 py-0.5 font-cinzel text-[9px] uppercase tracking-widest ${
                                    running
                                      ? "border-[#f59e0b] text-[#f59e0b]"
                                      : failed
                                        ? "border-[#ef4444] text-[#fecaca]"
                                        : ok
                                          ? "border-[#315c3d] text-[#bbf7d0]"
                                          : "border-[#2a2a35] text-[#9080a0]"
                                  }`}
                                >
                                  {job.lastStatus ?? "Pending"}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-[#a89880]">
                                <span>
                                  <span className="text-[#9080a0]">Next:</span>{" "}
                                  {formatDateTime(job.nextRunAt)}
                                </span>
                                <span>
                                  <span className="text-[#9080a0]">Last success:</span>{" "}
                                  {formatDateTime(job.lastSuccessAt)}
                                </span>
                                {job.lastDurationMs && (
                                  <span className="text-[#9080a0]">
                                    {formatDuration(job.lastDurationMs)}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex items-center gap-4">
                                <RunNowForm jobId={job.id} />
                                {job.userCreated && (
                                  <form action={removePageScheduleAction.bind(null, job.id)}>
                                    <button
                                      type="submit"
                                      className="font-cinzel text-[9px] uppercase tracking-widest text-[#9080a0] hover:text-[#ef4444] transition-colors"
                                    >
                                      Remove schedule
                                    </button>
                                  </form>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-[#9080a0] mb-3">
                        No auto-sync configured. Add a schedule to revalidate this page automatically.
                      </p>
                    )}
                    <AddScheduleForm pagePath={page.path} pageLabel={page.label} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-4">
                    <form action={refreshPageAction.bind(null, page.path)}>
                      <RefreshButton />
                    </form>
                    {page.generated ? (
                      <span className="text-xs text-[#9080a0]">
                        Generated from campaign content; saving a link creates an override.
                      </span>
                    ) : (
                      <form action={unlockPageAction.bind(null, page.path)}>
                        <button
                          type="submit"
                          className="text-xs text-[#9080a0] hover:text-[#ef4444] transition-colors"
                        >
                          Unlock page
                        </button>
                      </form>
                    )}
                  </div>
                </SourcePageFold>
              );
            })}
          </div>
        </section>
      )}

      {/* Background sync jobs not tied to a locked page */}
      {backgroundJobs.length > 0 && (
        <details className="mb-10 rounded-lg border border-[#2a2a35] bg-[#08050f] p-4">
          <summary className="cursor-pointer list-none font-cinzel text-xs tracking-[0.3em] uppercase text-[#9080a0] transition-colors hover:text-[#e8dfc8]">
            Background Syncs ({backgroundJobs.length})
          </summary>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {backgroundJobs.map((job) => {
              const ok = job.lastStatus === "succeeded";
              const running = job.lastStatus === "running";
              const failed = job.lastStatus === "failed";
              return (
                <div key={job.id} className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-cinzel text-sm text-[#e8dfc8]">{job.label}</p>
                      <div className="mt-1">
                        <ScheduleEditor
                          jobId={job.id}
                          scheduleSpec={job.scheduleSpec}
                          scheduleFallback={job.schedule}
                        />
                      </div>
                    </div>
                    <span
                      className={`rounded border px-2 py-1 font-cinzel text-[9px] uppercase tracking-widest ${
                        running
                          ? "border-[#f59e0b] text-[#f59e0b]"
                          : failed
                            ? "border-[#ef4444] text-[#fecaca]"
                            : ok
                              ? "border-[#315c3d] text-[#bbf7d0]"
                              : "border-[#2a2a35] text-[#9080a0]"
                      }`}
                    >
                      {job.lastStatus ?? "Pending"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#a89880]">
                    <span><span className="text-[#9080a0]">Next:</span> {formatDateTime(job.nextRunAt)}</span>
                    <span><span className="text-[#9080a0]">Last success:</span> {formatDateTime(job.lastSuccessAt)}</span>
                    {job.lastDurationMs && <span className="text-[#9080a0]">{formatDuration(job.lastDurationMs)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}

      {/* Unlocked pages — grouped */}
      <section>
        <h2 className="font-cinzel text-xs tracking-[0.3em] uppercase text-[#9080a0] mb-4">
          Editable Pages
        </h2>

        {groups.map((group) => {
          const entries = unlockedEntries.filter((e) => e.group === group);
          if (entries.length === 0) return null;
          return (
            <details key={group} className="mb-3 rounded-lg border border-[#2a2a35] bg-[#08050f]">
              <summary className="cursor-pointer list-none px-4 py-3 font-cinzel text-[10px] tracking-widest uppercase text-[#7a6a88] transition-colors hover:text-[#e8dfc8]">
                {group} ({entries.length})
              </summary>
              <div className="border-t border-[#2a2a35] overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {entries.map((entry) => {
                      const inactive = !navHrefs.has(entry.path);
                      return (
                        <tr
                          key={entry.path}
                          className="border-b border-[#2a2a35] last:border-0 hover:bg-[#16161e]"
                        >
                          <td className="px-4 py-3">
                            <span className={inactive ? "text-[#6a5a78]" : "text-[#e8dfc8]"}>
                              {entry.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#9080a0]">{entry.path}</td>
                          <td className="px-4 py-3">
                            {inactive && (
                              <span className="rounded border border-[#3a2a45] px-2 py-0.5 font-cinzel text-[9px] uppercase tracking-widest text-[#6a5a78]">
                                Not in nav
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <form action={lockPageAction.bind(null, entry.path, entry.label)}>
                              <button
                                type="submit"
                                className="text-xs text-[#9080a0] hover:text-[#f59e0b] transition-colors"
                              >
                                Lock page
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}

        {unlockedEntries.length === 0 && (
          <p className="text-xs text-[#9080a0] px-1">All pages are source-locked.</p>
        )}
      </section>

      <div className="mt-8 rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <p className="font-cinzel text-xs tracking-widest uppercase text-[#9080a0] mb-2">
          How it works
        </p>
        <ol className="text-sm text-[#a89880] space-y-1 list-decimal list-inside">
          <li>Lock a page to disable the layout editor and connect it to source documents.</li>
          <li>Add or edit source docs — paste a Google Doc share URL and label it.</li>
          <li>Set a sync schedule — the scheduler revalidates the page cache at the configured times.</li>
          <li>Hit <strong className="text-[#e8dfc8]">Refresh content now</strong> to force an immediate refresh.</li>
          <li>Unlock to re-enable the layout editor at any time.</li>
        </ol>
      </div>
    </div>
  );
}
