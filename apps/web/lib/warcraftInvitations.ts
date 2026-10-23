import "server-only";
import { getDb } from "@/lib/db";
import type { NavSection } from "@/lib/nav";

import { getWarcraftHub, warcraftGroups, type WarcraftGroup } from "@/lib/wowForever";

export function getWarcraftProfileId(email?: string): string | undefined {
  if (!email?.trim()) return undefined;
  const profile = getDb().prepare("SELECT id FROM user_profiles WHERE lower(email) = ?")
    .get(email.trim().toLowerCase()) as { id: string } | undefined;
  return profile?.id;
}
export function isWarcraftInvitee(email?: string): boolean {
  const id = getWarcraftProfileId(email);
  return !!id && warcraftGroups(getWarcraftHub()).some(group => !!group.members[id]);
}
export function getWarcraftPlayerName(email?: string, groupId = "group-a"): string | undefined {
  const id = getWarcraftProfileId(email);
  return id ? warcraftGroups(getWarcraftHub()).find(group => group.id === groupId)?.members[id] : undefined;
}
export function selectWarcraftGroup(groups: WarcraftGroup[], profileId: string | undefined, admin: boolean, requested?: string) {
  const available = groups.filter(group => admin || (!!profileId && !!group.members[profileId]));
  const group = requested ? available.find(group => group.id === requested) : available[0];
  return { available, group };
}

export function warcraftMenuForViewer(sections: NavSection[], invited: boolean): NavSection[] {
  if (invited) return sections;
  return sections.map(section => ({ ...section, items: section.items.filter(item => {
    const pathname = item.href.split(/[?#]/)[0];
    return pathname !== "/wow-forever" && !pathname.startsWith("/wow-forever/");
  }) })).filter((section, index) => section.items.length > 0 || sections[index].items.length === 0);
}
