import { afterEach, describe, expect, it, vi } from "vitest";
import { revalidate } from "@/app/(site)/history/page";
import { getHistoryData, HISTORY_REVALIDATE_SECONDS } from "@/lib/history";

const historyMarkdown = `# **Time & History**

## The Harmon Order (Calendar)

The Harmon Order marks the shared calendar of Myrdae.

| Month | Note |
| --- | --- |
| Evalee | Spring begins |

### Seasons

The seasons are tracked by the old calendar.

| Season | Span |
| --- | --- |
| Spring | Evalee to Luros |

- Founders Day

### Hours of the Day

Dawn

## Chronology

The major ages of Myrdae.

### The Awakening

The current age.

| Year | Significant Events |
| --- | --- |
| 1246 | Year of Discovery |

# **Faith & Beliefs**
`;

describe("History timeline refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the page and source fetch on the same 24-hour revalidation window", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      text: async () => historyMarkdown,
    })) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchMock);

    const data = await getHistoryData();

    expect(HISTORY_REVALIDATE_SECONDS).toBe(24 * 60 * 60);
    expect(revalidate).toBe(HISTORY_REVALIDATE_SECONDS);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("export?format=md"),
      { next: { revalidate: HISTORY_REVALIDATE_SECONDS } },
    );
    expect(data.eras.map((era) => era.title)).toEqual(["The Awakening"]);
  });
});
