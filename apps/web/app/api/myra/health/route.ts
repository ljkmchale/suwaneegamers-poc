import { NextResponse } from "next/server";
import { getMyraHealth } from "@/lib/myraHealth";
import { mayReadDetailedHealth } from "@/lib/myraHealthAuth";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await mayReadDetailedHealth(request))) return NextResponse.json({ error: "Admin or Myra authorization required." }, { status: 401 });
  return NextResponse.json(await getMyraHealth());
}
