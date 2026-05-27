"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";
import type { PortalCampaign, CampaignPartyMember, CampaignResourceLink, CampaignSessionSummary } from "@/lib/campaigns";

function parseParty(raw: string): CampaignPartyMember[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, player, url] = line.split("|").map((s) => s.trim());
      return { name, ...(player ? { player } : {}), ...(url ? { url } : {}) };
    });
}

function parseResources(raw: string): CampaignResourceLink[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split("|").map((s) => s.trim());
      return { label, url };
    });
}

function parseSummaries(raw: string): CampaignSessionSummary[] {
  return raw
    .split("\n---\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const firstNewline = block.indexOf("\n");
      if (firstNewline < 0) return { title: block, summary: "" };
      return {
        title: block.slice(0, firstNewline).trim(),
        summary: block.slice(firstNewline + 1).trim(),
      };
    });
}

function parseAliases(raw: string): string[] {
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function buildCampaignFromForm(formData: FormData): PortalCampaign {
  return {
    id: (formData.get("id") as string).trim(),
    name: (formData.get("name") as string).trim(),
    dm: (formData.get("dm") as string).trim(),
    schedule: (formData.get("schedule") as string).trim(),
    description: (formData.get("description") as string).trim(),
    referenceUrl: (formData.get("referenceUrl") as string).trim(),
    headerImage: (formData.get("headerImage") as string)?.trim() || undefined,
    headerImagePosition: (formData.get("headerImagePosition") as string)?.trim() || undefined,
    official: formData.get("official") === "false" ? false : undefined,
    resources: parseResources(formData.get("resources") as string ?? ""),
    party: parseParty(formData.get("party") as string ?? ""),
    sessionSummaries: parseSummaries(formData.get("sessionSummaries") as string ?? ""),
    aliases: parseAliases(formData.get("aliases") as string ?? ""),
  };
}

export async function saveCampaignAction(formData: FormData) {
  await requireAdmin();

  const campaigns = readContent<PortalCampaign[]>("campaigns.json");
  const updated = buildCampaignFromForm(formData);
  const idx = campaigns.findIndex((c) => c.id === updated.id);

  if (idx >= 0) {
    campaigns[idx] = updated;
  } else {
    campaigns.push(updated);
  }

  writeContent("campaigns.json", campaigns);
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${updated.id}`);
  revalidatePath("/");
  redirect("/admin/campaigns");
}

export async function deleteCampaignAction(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const campaigns = readContent<PortalCampaign[]>("campaigns.json");
  writeContent("campaigns.json", campaigns.filter((c) => c.id !== id));
  revalidatePath("/campaigns");
  revalidatePath("/");
  redirect("/admin/campaigns");
}

export async function reorderCampaignsAction(ids: string[]) {
  await requireAdmin();

  const campaigns = readContent<PortalCampaign[]>("campaigns.json");
  const ordered = ids
    .map((id) => campaigns.find((c) => c.id === id))
    .filter(Boolean) as PortalCampaign[];
  writeContent("campaigns.json", ordered);
  revalidatePath("/campaigns");
  revalidatePath("/");
}
