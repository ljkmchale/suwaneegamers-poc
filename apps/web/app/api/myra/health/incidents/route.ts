import { NextResponse } from "next/server";
import { listHealthIncidents } from "@/lib/myraHealth";
import { mayReadDetailedHealth } from "@/lib/myraHealthAuth";
export async function GET(request: Request) {
  if (!(await mayReadDetailedHealth(request))) return NextResponse.json({ error: "Admin authorization required." }, { status: 401 });
  return NextResponse.json({ incidents: listHealthIncidents() });
}
