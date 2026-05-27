"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { readContent, writeContent } from "@/lib/contentFiles";
import type { DungeonMasterProfile } from "@/lib/dungeonMasters";

function parsePrevious(raw: string): DungeonMasterProfile["previousCampaigns"] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, status] = line.split("|").map((s) => s.trim());
      return { name, status: (status === "On Hiatus" ? "On Hiatus" : "Completed") as "Completed" | "On Hiatus" };
    });
}

export async function saveDmAction(formData: FormData) {
  await requireAdmin();

  const dms = readContent<DungeonMasterProfile[]>("dungeon-masters.json");
  const updated: DungeonMasterProfile = {
    id: (formData.get("id") as string).trim(),
    name: (formData.get("name") as string).trim(),
    focus: (formData.get("focus") as string).trim(),
    description: (formData.get("description") as string).trim(),
    portrait: (formData.get("portrait") as string)?.trim() || undefined,
    activeCampaignIds: (formData.get("activeCampaignIds") as string)
      .split(",").map((s) => s.trim()).filter(Boolean),
    previousCampaigns: parsePrevious(formData.get("previousCampaigns") as string ?? ""),
  };

  const idx = dms.findIndex((d) => d.id === updated.id);
  if (idx >= 0) {
    dms[idx] = updated;
  } else {
    dms.push(updated);
  }

  writeContent("dungeon-masters.json", dms);
  revalidatePath("/dungeon-masters");
  redirect("/admin/dungeon-masters");
}

export async function deleteDmAction(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const dms = readContent<DungeonMasterProfile[]>("dungeon-masters.json");
  writeContent("dungeon-masters.json", dms.filter((d) => d.id !== id));
  revalidatePath("/dungeon-masters");
  redirect("/admin/dungeon-masters");
}
