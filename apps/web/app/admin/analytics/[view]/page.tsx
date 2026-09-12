import { notFound } from "next/navigation";
import { InsightsPage, INSIGHT_VIEWS, type InsightParams, type InsightView } from "../InsightsPage";
export const dynamic = "force-dynamic";
export default async function AnalyticsDetailPage({ params, searchParams }: { params: Promise<{ view: string }>; searchParams?: Promise<InsightParams> }) {
  const { view } = await params;
  if (!Object.hasOwn(INSIGHT_VIEWS, view)) notFound();
  return <InsightsPage view={view as InsightView} searchParams={searchParams} />;
}
