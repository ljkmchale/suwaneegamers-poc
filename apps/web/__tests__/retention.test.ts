import Database from "better-sqlite3";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// retention.ts is the one lib module here that only does something against a
// live database, so this suite backs it with an in-memory one rather than
// testing pure helpers.
const db = new Database(":memory:");
vi.mock("@/lib/db", () => ({ getDb: () => db }));

let pruneExpired: typeof import("@/lib/retention").pruneExpired;

beforeAll(async () => {
  // Imported dynamically so the mock factory above resolves after `db` exists.
  ({ pruneExpired } = await import("@/lib/retention"));
});

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

function makeTable(name: string, ages: number[]): void {
  db.exec(`CREATE TABLE ${name} (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL)`);
  const insert = db.prepare(`INSERT INTO ${name} (created_at) VALUES (?)`);
  for (const age of ages) insert.run(daysAgo(age));
}

const countIn = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("pruneExpired", () => {
  it("deletes rows past the window and keeps the rest", () => {
    // Each test uses its own table: the once-per-24h guard is keyed on
    // table.column, so sharing one would make tests order-dependent.
    makeTable("t_basic", [200, 120, 91, 89, 10, 0]);

    pruneExpired([{ table: "t_basic", column: "created_at", days: 90 }]);

    expect(countIn("t_basic")).toBe(3);
  });

  it("prunes at most once per 24h per table", () => {
    makeTable("t_throttle", [200, 150]);

    pruneExpired([{ table: "t_throttle", column: "created_at", days: 90 }]);
    expect(countIn("t_throttle")).toBe(0);

    // Rows that reappear inside the same day are left alone until the window
    // reopens — the guard is what keeps this off every single write.
    db.prepare(`INSERT INTO t_throttle (created_at) VALUES (?)`).run(daysAgo(300));
    pruneExpired([{ table: "t_throttle", column: "created_at", days: 90 }]);
    expect(countIn("t_throttle")).toBe(1);
  });

  it("applies each policy in a batch independently", () => {
    makeTable("t_multi_a", [100, 1]);
    makeTable("t_multi_b", [100, 1]);

    pruneExpired([
      { table: "t_multi_a", column: "created_at", days: 90 },
      { table: "t_multi_b", column: "created_at", days: 30 },
    ]);

    expect(countIn("t_multi_a")).toBe(1);
    expect(countIn("t_multi_b")).toBe(1);
  });

  it("refuses identifiers that are not plain names", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    makeTable("t_guard", [100]);

    pruneExpired([
      { table: "t_guard WHERE 1=1; DROP TABLE t_guard; --", column: "created_at", days: 90 },
    ]);

    expect(countIn("t_guard")).toBe(1);
    expect(error).toHaveBeenCalled();
  });

  it("swallows failures so housekeeping never breaks the caller", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      pruneExpired([{ table: "t_missing", column: "created_at", days: 90 }]),
    ).not.toThrow();
    expect(error).toHaveBeenCalled();
  });
});
