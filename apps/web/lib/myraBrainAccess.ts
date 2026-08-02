import { createHash, createHmac, timingSafeEqual } from "node:crypto";

interface MyraBrainAccessPayload {
  v: 1;
  visibility: "dm";
  subject: string;
  campaigns: "*" | string[];
  exp: number;
}

export function myraFullDmEmails(env: string | undefined = process.env.MYRA_FULL_DM_EMAILS): string[] {
  return (env ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function mayUseFullMyraDm(email: string | undefined, env?: string): boolean {
  if (!email) return false;
  return myraFullDmEmails(env).includes(email.trim().toLowerCase());
}

export function createMyraBrainAccessToken(
  subject: string,
  campaigns: "*" | string[],
  secret: string | undefined = process.env.LIVEKIT_API_SECRET,
  now = Date.now(),
): string | null {
  if (!secret || !subject || (campaigns !== "*" && campaigns.length === 0)) return null;
  const payload: MyraBrainAccessPayload = {
    v: 1,
    visibility: "dm",
    subject: createHash("sha256").update(subject).digest("hex").slice(0, 24),
    campaigns,
    exp: Math.floor(now / 1000) + 15 * 60,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyMyraBrainAccessToken(
  token: string | null,
  secret: string | undefined = process.env.LIVEKIT_API_SECRET,
  now = Date.now(),
): MyraBrainAccessPayload | null {
  if (!secret || !token) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return null;
  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as MyraBrainAccessPayload;
    const campaignsValid = payload.campaigns === "*" || (
      Array.isArray(payload.campaigns) && payload.campaigns.every((campaign) => typeof campaign === "string")
    );
    return payload.v === 1 && payload.visibility === "dm" && Boolean(payload.subject) && campaignsValid && payload.exp >= Math.floor(now / 1000)
      ? payload
      : null;
  } catch {
    return null;
  }
}

export function tokenAllowsCampaign(payload: MyraBrainAccessPayload | null, campaign: string): boolean {
  if (!payload) return false;
  if (payload.campaigns === "*") return true;
  const requested = campaign.trim().toLowerCase();
  return requested !== "all" && payload.campaigns.some((allowed) => allowed.toLowerCase() === requested);
}
