// Retention for the append-only log tables (analytics, voice metrics, security
// events). These grow forever otherwise: nothing in the app ever reads a
// page_view from three months ago, but every /admin/analytics query still has
// to scan past it.
//
// Not marked "server-only" — lib/voiceMetrics.ts imports this and is itself
// loaded by the standalone autotuner script (scripts/autotune-assistant.ts).
import { getDb } from "@/lib/db";

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Per-key timestamps of the last prune. In-memory, so the dev server, the prod
// service, and any script each keep their own clock — harmless, because
// deleting already-deleted rows is a no-op.
const lastPruneAt = new Map<string, number>();

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

export interface RetentionPolicy {
  /** Table to delete from. */
  table: string;
  /** Timestamp column holding an ISO-8601 string. */
  column: string;
  /** Rows older than this many days are deleted. */
  days: number;
}

/**
 * Delete rows older than the policy window, at most once per 24h per table.
 *
 * Called from the write path of each log table so retention needs no scheduled
 * job — the table that is growing is the one that prunes itself. Failures are
 * swallowed: housekeeping must never break the request that triggered it.
 */
export function pruneExpired(policies: RetentionPolicy[]): void {
  const now = Date.now();
  for (const policy of policies) {
    const key = `${policy.table}.${policy.column}`;
    const last = lastPruneAt.get(key) ?? 0;
    if (now - last < PRUNE_INTERVAL_MS) continue;
    // Set before the delete so a throwing prune backs off a full day instead of
    // retrying on every single write.
    lastPruneAt.set(key, now);

    // Identifiers are interpolated, so refuse anything that isn't a plain name.
    // Every caller passes a hardcoded constant; this guards future ones.
    if (!IDENTIFIER_RE.test(policy.table) || !IDENTIFIER_RE.test(policy.column)) {
      console.error(`[retention] refusing unsafe identifier ${key}`);
      continue;
    }

    const cutoff = new Date(now - policy.days * 24 * 60 * 60 * 1000).toISOString();
    try {
      const result = getDb()
        .prepare(`DELETE FROM ${policy.table} WHERE ${policy.column} < ?`)
        .run(cutoff);
      if (result.changes > 0) {
        console.log(`[retention] pruned ${result.changes} rows from ${policy.table}`);
      }
    } catch (error) {
      console.error(`[retention] prune failed for ${policy.table}`, error);
    }
  }
}
