import Link from "next/link";
import type { WarcraftGroup } from "@/lib/wowForever";
import styles from "./warcraft.module.css";

export function partyLabel(group: WarcraftGroup, index: number) {
  return group.partyName?.trim() || ["Azeroth Adventurers", "Azeroth Explorers"][index] || `Adventure party ${index + 1}`;
}

export function PartySwitcher({ groups, selected, admin, chronicles = false }: { groups: WarcraftGroup[]; selected: string; admin: boolean; chronicles?: boolean }) {
  if (groups.length < 2) return null;
  const route = chronicles ? "/wow-forever/chronicles" : "/wow-forever";
  return <nav aria-label={admin ? "Warcraft groups" : "Your adventure parties"} className={styles.actions}>
    {groups.map((group, index) => <Link key={group.id} href={`${route}?group=${encodeURIComponent(group.id)}`} aria-current={group.id === selected ? "page" : undefined}>{admin ? group.name : partyLabel(group, index)}</Link>)}
  </nav>;
}
