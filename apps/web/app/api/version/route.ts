import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      version: process.env.SUWANEE_BUILD_VERSION ?? "development",
      buildId: process.env.SUWANEE_BUILD_ID ?? "unknown",
      commit: process.env.SUWANEE_BUILD_COMMIT ?? "unknown",
      branch: process.env.SUWANEE_BUILD_BRANCH ?? "unknown",
      dirty: process.env.SUWANEE_BUILD_DIRTY === "true",
      builtAt: process.env.SUWANEE_BUILD_TIME ?? "unknown",
      environment: process.env.NODE_ENV ?? "unknown",
    },
    { headers: { "Cache-Control": "no-store, must-revalidate" } },
  );
}
