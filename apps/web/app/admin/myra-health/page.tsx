import { MyraHealthPanel } from "@/components/admin/MyraHealthPanel";
import { requireAdmin } from "@/lib/adminAuth";
import { getMyraHealth } from "@/lib/myraHealth";
export const dynamic = "force-dynamic";
export default async function MyraHealthPage() {
  await requireAdmin();
  return <MyraHealthPanel initial={await getMyraHealth()} />;
}
