import type { Metadata } from "next";
import { ChroniclesClient } from "@/app/(site)/chronicles/ChroniclesClient";
import { requireAdmin } from "@/lib/adminAuth";
import { indexStats, hasIndex, loadIndex } from "@/lib/brain/vector-store";
import { brainConfig as bc } from "@/lib/brain/config";
import path from "node:path";

export const metadata: Metadata = {
  title: "Admin Chronicles",
  description: "DM-only Chronicles workspace.",
};

interface AdminChroniclesPageProps {
  searchParams: Promise<{ source?: string }>;
}

export default async function AdminChroniclesPage({ searchParams }: AdminChroniclesPageProps) {
  await requireAdmin();
  const { source } = await searchParams;
  const [brainConf, initialSource] = await Promise.all([
    getInitialBrainConfig(),
    getInitialSource(source),
  ]);

  return (
    <div className="-m-8">
      <ChroniclesClient
        initialConfig={brainConf.config}
        initialConfigError={brainConf.error}
        initialSource={initialSource}
        isAdmin
        surface="admin"
        initialVisibility="dm"
        initialAnswerMode="analysis"
      />
    </div>
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
    if (!page) return null;

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
