import { NextResponse } from "next/server";
import { getMyraHealth, healthRegistry } from "@/lib/myraHealth";
import { isHealthAdmin } from "@/lib/myraHealthAuth";
export async function POST(_request: Request, context: { params: Promise<{ service: string }> }) {
  if (!(await isHealthAdmin())) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  const { service } = await context.params;
  if (!healthRegistry.some((check) => check.id === service || check.group === service)) return NextResponse.json({ error: "Unknown diagnostic service." }, { status: 400 });
  return NextResponse.json(await getMyraHealth({ depth: "component", service, force: true }));
}
