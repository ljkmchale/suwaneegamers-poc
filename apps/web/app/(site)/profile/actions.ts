"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { updateUserProfile } from "@/lib/userProfiles";
import { readAssistantPersonas } from "@/lib/assistantPersonaStore";
import { findPersona } from "@/lib/assistantPersonas";

export async function saveProfileAction(formData: FormData) {
  const session = await getUserSession();
  if (!isSignedIn(session)) redirect("/");

  // "" (Automatic) and anything not in the catalog both clear the choice, so a
  // deleted persona falls back to roster matching rather than a broken voice.
  const requestedPersona = String(formData.get("myraPersona") ?? "").trim();
  const persona = findPersona(readAssistantPersonas(), requestedPersona)?.id ?? null;

  updateUserProfile(session, {
    myraEnabled: formData.get("myraEnabled") === "on",
    myraPersona: persona,
  });
  revalidatePath("/", "layout");
  redirect("/profile?saved=1");
}
