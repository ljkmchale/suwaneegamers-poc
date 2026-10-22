import "server-only";
import { getDb } from "@/lib/db";
import type { NavSection } from "@/lib/nav";

// Explicitly invited accounts, resolved from the existing member directory.
// Never grant access from a self-selected display name or roster text.
const invitedProfiles: Record<string, string> = {
  "390a0a45aadcfeb14b33989c": "Larry",
  "b2f082fa8ccad583d3523435": "Chip",
  "84a012426ea6409e052ac880": "Lesley",
  "c71df713027bb52bfb23ac72": "Sean",
  "a4ac974e235cb8705e5e2824": "Emma",
  "3ef235a3385aca5bfff5f0e5": "Ty",
};

export function isWarcraftInvitee(email?: string): boolean {
  return !!getWarcraftPlayerName(email);
}

export function getWarcraftPlayerName(email?: string): string | undefined {
  if (!email?.trim()) return undefined;
  const profile = getDb().prepare("SELECT id FROM user_profiles WHERE lower(email) = ?")
    .get(email.trim().toLowerCase()) as { id: string } | undefined;
  return profile ? invitedProfiles[profile.id] : undefined;
}

export function warcraftMenuForViewer(sections: NavSection[], invited: boolean): NavSection[] {
  if (invited) return sections;
  return sections.map(section => ({ ...section, items: section.items.filter(item => {
    const pathname = item.href.split(/[?#]/)[0];
    return pathname !== "/wow-forever" && !pathname.startsWith("/wow-forever/");
  }) })).filter((section, index) => section.items.length > 0 || sections[index].items.length === 0);
}
