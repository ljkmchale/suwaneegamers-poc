import { InsightsPage, INSIGHT_VIEWS, type InsightParams, type InsightView } from "./InsightsPage";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<InsightParams> }) {
  const params = await searchParams;
  const view = params?.view && Object.hasOwn(INSIGHT_VIEWS, params.view) ? params.view as InsightView : "overview";
  return <InsightsPage view={view} searchParams={Promise.resolve(params ?? {})} />;
}
