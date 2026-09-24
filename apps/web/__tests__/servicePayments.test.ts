// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const testContentDir = mkdtempSync(join(tmpdir(), "sg-service-payments-"));

beforeAll(() => {
  process.env.SUWANEE_CONTENT_DIR = testContentDir;
});

afterAll(async () => {
  const { getDb } = await import("@/lib/db");
  getDb().close();
  delete (globalThis as typeof globalThis & { __sgDb?: unknown }).__sgDb;
  delete process.env.SUWANEE_CONTENT_DIR;
  rmSync(testContentDir, { recursive: true, force: true });
});

describe("service payment log", () => {
  it("records, lists, and deletes payments", async () => {
    const { deleteServicePayment, listServicePayments, recordServicePayments } = await import(
      "@/lib/servicePayments"
    );

    const inserted = recordServicePayments([
      { serviceId: "elevenlabs", serviceName: "ElevenLabs", paidOn: "2026-09-03", amountCents: 2200 },
      { serviceId: "anthropic", serviceName: "Anthropic", paidOn: "2026-08-20", amountCents: 3000, note: "top-up" },
      // Rejected: bad date, negative amount, fractional cents.
      { serviceId: "x", serviceName: "X", paidOn: "Sept 3", amountCents: 100 },
      { serviceId: "x", serviceName: "X", paidOn: "2026-09-01", amountCents: -5 },
      { serviceId: "x", serviceName: "X", paidOn: "2026-09-01", amountCents: 1.5 },
    ]);
    expect(inserted).toBe(2);

    const all = listServicePayments("2026-01-01");
    expect(all.map((p) => [p.serviceId, p.amountCents])).toEqual([
      ["elevenlabs", 2200],
      ["anthropic", 3000],
    ]);
    expect(all[1].note).toBe("top-up");
    expect(listServicePayments("2026-09-01")).toHaveLength(1);

    deleteServicePayment(all[0].id);
    expect(listServicePayments("2026-01-01").map((p) => p.serviceId)).toEqual(["anthropic"]);
  });
});
