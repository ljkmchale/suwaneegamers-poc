"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { writeNavConfig, type NavSection } from "@/lib/nav";
import { setPageLayout } from "@/lib/pageLayouts";
import type { PageItem, PageGridMeta, CanvasMeta } from "@/lib/pageBlocks";

export async function saveNavLayoutAction(sections: NavSection[]) {
  await requireAdmin();

  writeNavConfig({ sections });
  revalidatePath("/", "layout");
}

export async function savePageLayoutAction(
  pageId: string,
  items: PageItem[],
  grid?: PageGridMeta | null,
  canvas?: CanvasMeta | null,
) {
  await requireAdmin();

  setPageLayout(pageId, items, grid, canvas);
  revalidatePath(pageId);
  if (/^\/campaigns\/[^/]+$/.test(pageId)) {
    revalidatePath("/campaigns");
    revalidatePath("/calendar");
  }
}
