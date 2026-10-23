import { notFound } from "next/navigation";
import { getUserSession } from "@/lib/userSession";
import { getWarcraftProfileId, selectWarcraftGroup } from "@/lib/warcraftInvitations";
import type { Metadata } from "next";
import { getAdminSession } from "@/lib/adminSession";
import { getWarcraftHub, warcraftGroups } from "@/lib/wowForever";
import { WarcraftChronicles } from "@/app/(site)/wow-forever/WarcraftChronicles";
import styles from "@/app/(site)/wow-forever/warcraft.module.css";

export const metadata: Metadata = {
  title: "The Azeroth Chronicles",
  description: "The illustrated story of our World of Warcraft: Forever adventures.",
};

export default async function AzerothChroniclesPage({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const admin = (await getAdminSession()).isAdmin === true;
  const { group } = selectWarcraftGroup(warcraftGroups(getWarcraftHub()), getWarcraftProfileId((await getUserSession()).email), admin, (await searchParams).group);
  if (!group) notFound();
  return <div className={`${styles.page} ${styles.chronicleStandalone}`}>
    <WarcraftChronicles nights={group.nights} admin={admin} groupId={group.id} groupName={group.name} standalone />
  </div>;
}
