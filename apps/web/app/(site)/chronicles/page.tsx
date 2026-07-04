import type { Metadata } from "next";
import { ChroniclesClient } from "@/app/(site)/chronicles/ChroniclesClient";
import { indexStats, hasIndex, loadIndex } from "@/lib/brain/vector-store";
import { brainConfig as bc } from "@/lib/brain/config";
import path from "node:path";

export const metadata: Metadata = {
  title: "Chronicles",
  description: "The Suwanee Gamers chronicles and knowledge base.",
};

interface ChroniclesPageProps {
  searchParams: Promise<{ source?: string }>;
}

export default async function ChroniclesPage({ searchParams }: ChroniclesPageProps) {
  const { source } = await searchParams;
  const [brainConf, initialSource] = await Promise.all([
    getInitialBrainConfig(),
    getInitialSource(source),
  ]);

  return (
    <ChroniclesClient
      initialConfig={brainConf.config}
      initialConfigError={brainConf.error}
      initialSource={initialSource}
      isAdmin={false}
      surface="public"
    />
  );
}

async function getInitialBrainConfig() {
  try {
    const stats = await indexStats();
    const campaigns = stats.exists
      ? ["All", ...Object.keys(stats.campaigns).filter((c) => c !== "All" && c !== "World").sort(), "World lore"]
      : ["All"];
    return {
      config: {
        campaigns,
        topK: bc.topK,
        chatModel: bc.chatModel,
        embedModel: bc.embedModel,
        answerReviewEnabled: bc.answerReviewEnabled,
        dmModeEnabled: bc.dmModeEnabled,
      },
      error: "",
    };
  } catch {
    return { config: null, error: "Chronicles is not reachable." };
  }
}

async function getInitialSource(sourcePath?: string) {
  if (!sourcePath) return null;
  try {
    if (!(await hasIndex())) return null;
    const index = await loadIndex();
    const page = index.pages?.[sourcePath];
    if (!page || page.visibility === "dm") return null;

    const absolutePath = path.resolve(bc.vaultRoot, sourcePath);
    const relative = path.relative(bc.vaultRoot, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

    const { readFile } = await import("node:fs/promises");
    const markdown = await readFile(absolutePath, "utf8");
    return {
      title: page.title,
      path: page.path,
      campaign: page.campaign,
      visibility: page.visibility,
      links: page.links ?? [],
      backlinks: page.backlinks ?? [],
      markdown,
    };
  } catch {
    return null;
  }
}
