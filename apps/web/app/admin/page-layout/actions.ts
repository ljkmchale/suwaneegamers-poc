"use server";

import { revalidatePath } from "next/cache";
import { writeNavConfig, type NavSection } from "@/lib/nav";

export async function saveNavLayoutAction(sections: NavSection[]) {
  writeNavConfig({ sections });
  revalidatePath("/", "layout");
}
