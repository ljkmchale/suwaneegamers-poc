"use client";

import dynamic from "next/dynamic";
import type { NavSection } from "@/lib/nav";

const PageLayoutEditor = dynamic(
  () => import("./PageLayoutEditor").then((m) => m.PageLayoutEditor),
  { ssr: false, loading: () => <div className="h-40 animate-pulse rounded-lg bg-[#0f0a1a]" /> }
);

export function PageLayoutEditorWrapper({ initial }: { initial: NavSection[] }) {
  return <PageLayoutEditor initial={initial} />;
}
