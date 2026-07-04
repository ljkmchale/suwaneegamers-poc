import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const token = process.env.SUWANEE_SCHEDULER_TOKEN;
  if (!token) return false;
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null;
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter((path): path is string => typeof path === "string" && path.startsWith("/"))
    : [];

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ ok: true, paths });
}
