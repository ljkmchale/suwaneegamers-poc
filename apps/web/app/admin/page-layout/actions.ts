"use server";

import { revalidatePath } from "next/cache";
import { writeNavConfig, type NavSection } from "@/lib/nav";
import { setPageLayout } from "@/lib/pageLayouts";
import type { PageItem } from "@/lib/pageBlocks";

export async function saveNavLayoutAction(sections: NavSection[]) {
  writeNavConfig({ sections });
  revalidatePath("/", "layout");
}

export async function savePageLayoutAction(pageId: string, items: PageItem[]) {
  setPageLayout(pageId, items);
  revalidatePath(pageId);
}
