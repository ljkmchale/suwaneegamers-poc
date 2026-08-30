import type { Metadata } from "next";
import { MyraAvatarPoc } from "@/app/myra-avatar-poc/MyraAvatarPoc";

export const metadata: Metadata = {
  title: "Myra, the Living Guide",
  description: "Speak with Myra, Suwanee Gamers' living guide to Myrdae.",
};

export default function AdventsOfHarmonyPage() {
  return <MyraAvatarPoc pagePath="/advents_of_harmony" />;
}
