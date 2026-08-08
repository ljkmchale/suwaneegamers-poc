const DATE_ONLY = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/;

function parseDateOnly(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = DATE_ONLY.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3] ?? "1");
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  return { year, month, day };
}

export function formatCampaignDuration(startDate?: string, endDate?: string | Date): string | null {
  const start = parseDateOnly(startDate);
  const end = endDate instanceof Date
    ? { year: endDate.getFullYear(), month: endDate.getMonth() + 1, day: endDate.getDate() }
    : parseDateOnly(endDate);
  if (!start || !end) return null;

  let totalMonths = (end.year - start.year) * 12 + (end.month - start.month);
  if (end.day < start.day) totalMonths -= 1;
  if (totalMonths < 0) return null;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (months || !years) parts.push(`${months} month${months === 1 ? "" : "s"}`);
  return parts.join(" ");
}

