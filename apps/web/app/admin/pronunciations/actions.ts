"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { writeContent } from "@/lib/contentFiles";

const PRONUNCIATIONS_FILE = "assistant-pronunciations.json";

// Persist Myra's pronunciation overrides. The form submits parallel `word` and
// `pronunciation` fields (one pair per row); we zip, trim, drop empty/duplicate
// rows, and write the map the agent reads at speech time via lib/assistantBrain.
export async function savePronunciationsAction(formData: FormData) {
  await requireAdmin();

  const words = formData.getAll("word").map((v) => String(v).trim());
  const pronunciations = formData.getAll("pronunciation").map((v) => String(v).trim());

  const map: Record<string, string> = {};
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const pronunciation = pronunciations[i] ?? "";
    // Both sides required; last one wins on a duplicate word.
    if (word && pronunciation) map[word] = pronunciation;
  }

  writeContent(PRONUNCIATIONS_FILE, map);
  revalidatePath("/admin/pronunciations");
}
