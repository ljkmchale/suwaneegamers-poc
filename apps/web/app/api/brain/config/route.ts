import { NextResponse } from "next/server";
import { indexStats } from "@/lib/brain/vector-store";
import { brainConfig } from "@/lib/brain/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await indexStats();
    const campaigns = stats.exists
      ? ["All", ...Object.keys(stats.campaigns).filter((c) => c !== "All" && c !== "World").sort(), "World lore"]
      : ["All"];
    return NextResponse.json({
      campaigns,
      topK: brainConfig.topK,
      chatModel: brainConfig.chatModel,
      embedModel: brainConfig.embedModel,
      answerReviewEnabled: brainConfig.answerReviewEnabled,
      dmModeEnabled: brainConfig.dmModeEnabled,
    });
  } catch (error) {
    console.error("[Brain Config]", error);
    return NextResponse.json({ error: "Chronicles is not reachable." }, { status: 502 });
  }
}
