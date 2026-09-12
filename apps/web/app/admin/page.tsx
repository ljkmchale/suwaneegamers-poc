import { InsightsPage, type InsightParams } from "./analytics/InsightsPage";
export const dynamic = "force-dynamic";
export default function AdminDashboard({ searchParams }: { searchParams?: Promise<InsightParams> }) {
  return <InsightsPage searchParams={searchParams} />;
}
