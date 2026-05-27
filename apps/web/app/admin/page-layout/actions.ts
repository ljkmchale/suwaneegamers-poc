"use server";

import { revalidatePath } from "next/cache";
import { writeNavConfig, type NavSection } from "@/lib/nav";
import { setPageLayout } from "@/lib/pageLayouts";

export async function saveNavLayoutAction(sections: NavSection[]) {
  writeNavConfig({ sections });
  revalidatePath("/", "layout");
}

export async function savePageSectionOrderAction(pageId: string, sectionIds: string[]) {
  setPageLayout(pageId, sectionIds);
  revalidatePath(pageId);
}
