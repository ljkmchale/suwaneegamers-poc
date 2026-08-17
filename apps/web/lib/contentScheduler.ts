import { getDb } from "@/lib/db";
import type { ScheduleSpec } from "@/lib/scheduleSpec";
export type { ScheduleSpec } from "@/lib/scheduleSpec";
export { formatScheduleSpec, computeNextRun } from "@/lib/scheduleSpec";

// Mirrors the revalidatePaths arrays in scripts/content-scheduler.mjs
export const JOB_PATHS: Record<string, string[]> = {
  "territories-sync":     ["/territories"],
  "lore-core":            ["/organizations", "/pantheon", "/gazetteer"],
  "lore-page":            ["/lore"],
  "history-page":         ["/history"],
  "organization-symbols": ["/organizations"],
  "pantheon-symbols":     ["/pantheon"],
  "gazetteer":            ["/gazetteer"],
  "dm-reference":         ["/reference-for-dungeon-masters"],
  "crit-tables":          ["/crit_tables"],
  "campaign-headers":     ["/campaigns", "/previous-campaigns"],
  "campaign-roster":      ["/campaigns"],
  "session-audio":        ["/campaigns", "/calendar"],
  "session-notes":        ["/campaigns", "/calendar"],
  "chronicles-sources":   ["/advents_of_harmony", "/admin/chronicles"],
  "assistant-brain":      ["/"],
  "assistant-autotune":   ["/"],
  "content-documents":    ["/", "/admin/source-managed", "/bestiary", "/campaigns", "/dungeon-masters", "/gazetteer", "/organizations", "/pantheon", "/players", "/previous-campaigns", "/reference-for-dungeon-masters", "/territories"],
};

export interface ContentSyncJobStatus {
  id: string;
  label: string;
  schedule: string;
  scheduleSpec: ScheduleSpec | null;
  command: string;
  enabled: boolean;
  revalidatePaths: string[];
  userCreated: boolean;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: string | null;
  lastExitCode: number | null;
  lastDurationMs: number | null;
  nextRunAt: string | null;
  lastMessage: string | null;
}

interface DbContentSyncJob {
  id: string;
  label: string;
  schedule: string;
  schedule_json: string | null;
  command: string;
  enabled: number;
  revalidate_paths_json: string | null;
  last_started_at: string | null;
  last_finished_at: string | null;
  last_success_at: string | null;
  last_status: string | null;
  last_exit_code: number | null;
  last_duration_ms: number | null;
  next_run_at: string | null;
  last_message: string | null;
}

export function getContentSyncJobStatuses(): ContentSyncJobStatus[] {
  return (
    getDb()
      .prepare(
        `SELECT
          id,
          label,
          schedule,
          schedule_json,
          command,
          enabled,
          revalidate_paths_json,
          last_started_at,
          last_finished_at,
          last_success_at,
          last_status,
          last_exit_code,
          last_duration_ms,
          next_run_at,
          last_message
        FROM content_sync_jobs
        ORDER BY next_run_at IS NULL, next_run_at, label`,
      )
      .all() as DbContentSyncJob[]
  ).map((row) => {
    const scheduleSpec: ScheduleSpec | null = row.schedule_json
      ? (JSON.parse(row.schedule_json) as ScheduleSpec)
      : null;
    return {
      id: row.id,
      label: row.label,
      schedule: row.schedule,
      scheduleSpec,
      command: row.command,
      enabled: Boolean(row.enabled),
      revalidatePaths: JOB_PATHS[row.id] ?? (row.revalidate_paths_json ? (JSON.parse(row.revalidate_paths_json) as string[]) : []),
      userCreated: !JOB_PATHS[row.id] && !!row.revalidate_paths_json,
      lastStartedAt: row.last_started_at,
      lastFinishedAt: row.last_finished_at,
      lastSuccessAt: row.last_success_at,
      lastStatus: row.last_status,
      lastExitCode: row.last_exit_code,
      lastDurationMs: row.last_duration_ms,
      nextRunAt: row.next_run_at,
      lastMessage: row.last_message,
    };
  });
}
