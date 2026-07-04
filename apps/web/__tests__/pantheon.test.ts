import fs from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidate } from "@/app/(site)/pantheon/page";
import {
  getPantheonDeities,
  PANTHEON_REVALIDATE_SECONDS,
} from "@/lib/pantheon";

const pantheonMarkdown = `
| Name | Title | Domain(s) |
| --- | --- | --- |
| Addan | Eternal Guardian | Protection |

### Addan

Guardian details.
`;

describe("Pantheon source loading", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders from the synced local source without waiting on Google", async () => {
    const realReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((path, ...args) => {
      if (String(path).includes("history-doc-cache")) return pantheonMarkdown;
      return realReadFileSync(path, ...args as [never]);
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const deities = await getPantheonDeities();

    expect(deities[0]).toMatchObject({
      name: "Addan",
      title: "Eternal Guardian",
      details: "Guardian details.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the page revalidation window when the local source is unavailable", async () => {
    const realReadFileSync = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((path, ...args) => {
      if (String(path).includes("history-doc-cache")) throw new Error("no cache");
      return realReadFileSync(path, ...args as [never]);
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => pantheonMarkdown,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await getPantheonDeities();

    expect(PANTHEON_REVALIDATE_SECONDS).toBe(24 * 60 * 60);
    expect(revalidate).toBe(PANTHEON_REVALIDATE_SECONDS);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("export?format=md"),
      { next: { revalidate: PANTHEON_REVALIDATE_SECONDS } },
    );
  });
});
