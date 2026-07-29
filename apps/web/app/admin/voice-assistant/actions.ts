"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { readLearned, withQuestionForgotten, writeLearned } from "@/lib/assistantLearned";
import { readAssistantPersonas, writeAssistantPersonas } from "@/lib/assistantPersonaStore";
import { findPersona } from "@/lib/assistantPersonas";
import { setUserProfilePersona } from "@/lib/userProfiles";

// Forget a learned answer or dismiss a gap, and block that question from being
// re-learned on the next nightly run. The admin off-switch for Myra's automatic
// learning: both the "Forget" (learned answers) and "Ignore" (gaps) controls
// post here with the question's normalized key.
export async function forgetQuestionAction(formData: FormData) {
  await requireAdmin();
  const normalized = String(formData.get("normalized") ?? "").trim();
  if (!normalized) return;
  writeLearned(withQuestionForgotten(readLearned(), normalized));
  revalidatePath("/admin/voice-assistant");
}

// Assign a member's Myra persona. An empty (or unknown) persona id clears the
// assignment, which returns them to roster matching and then the house default.
// Members can change their own choice later on /profile — last write wins.
export async function setMemberPersonaAction(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "").trim();
  if (!profileId) return;
  const requested = String(formData.get("personaId") ?? "").trim();
  const persona = findPersona(readAssistantPersonas(), requested)?.id ?? null;
  setUserProfilePersona(profileId, persona);
  revalidatePath("/admin/voice-assistant");
  revalidatePath("/profile");
}

// Assign a persona to a roster player who has never signed in. There is no
// profile row to write, so the assignment goes into the persona's matchPlayers
// list — the same mechanism that resolves their voice the first time they do
// sign in. A name belongs to at most one persona, so it is cleared everywhere
// first.
export async function setRosterPersonaAction(formData: FormData) {
  await requireAdmin();
  const playerName = String(formData.get("playerName") ?? "").trim();
  if (!playerName) return;

  const catalog = readAssistantPersonas();
  const requested = String(formData.get("personaId") ?? "").trim();
  const target = findPersona(catalog, requested);

  const personas = catalog.personas.map((persona) => ({
    ...persona,
    matchPlayers: persona.matchPlayers.filter(
      (name) => name.localeCompare(playerName, undefined, { sensitivity: "base" }) !== 0,
    ),
  }));
  if (target) {
    const index = personas.findIndex((persona) => persona.id === target.id);
    personas[index] = {
      ...personas[index],
      matchPlayers: [...personas[index].matchPlayers, playerName],
    };
  }

  writeAssistantPersonas({ ...catalog, personas });
  revalidatePath("/admin/voice-assistant");
  revalidatePath("/profile");
}
