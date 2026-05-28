"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { writeNavConfig, type NavSection } from "@/lib/nav";
import { setPageLayout } from "@/lib/pageLayouts";
import type { PageItem, PageGridMeta } from "@/lib/pageBlocks";

export async function saveNavLayoutAction(sections: NavSection[]) {
  await requireAdmin();

  writeNavConfig({ sections });
  revalidatePath("/", "layout");
}

export async function savePageLayoutAction(pageId: string, items: PageItem[], grid?: PageGridMeta | null) {
  await requireAdmin();

  setPageLayout(pageId, items, grid);
  revalidatePath(pageId);
}
