import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Recognize a trusted server-to-server caller.
 *
 * The site is members-only, but a few callers have no browser session: the
 * LiveKit voice agent posting metrics and asking Chronicles questions. They
 * carry the shared LiveKit secret as a bearer token instead.
 *
 * Compared in constant time so a wrong token cannot be discovered a byte at a
 * time, and refused outright when no secret is configured — an unset env var
 * must never mean "everyone is trusted".
 */
export function isMachineRequest(request: NextRequest): boolean {
  const expected = process.env.LIVEKIT_API_SECRET;
  if (!expected) return false;

  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(suppliedBytes, expectedBytes);
}
