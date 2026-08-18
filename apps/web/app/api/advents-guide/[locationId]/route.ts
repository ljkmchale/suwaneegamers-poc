import { NextRequest, NextResponse } from "next/server";
import { addBusiness, getLocationGuide, saveReview } from "@/lib/adventsGuide";
import { getUserProfileContext } from "@/lib/userProfiles";
import { getUserSession, isSignedIn } from "@/lib/userSession";

async function memberContext() {
  const session = await getUserSession();
  if (!isSignedIn(session)) return null;
  return getUserProfileContext(session);
}

export async function GET(request: NextRequest, context: { params: Promise<{ locationId: string }> }) {
  const member = await memberContext();
  if (!member) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { locationId } = await context.params;
  const locationName = request.nextUrl.searchParams.get("name") ?? locationId;
  try {
    return NextResponse.json({
      ...getLocationGuide(locationId, locationName, member.profile.id),
      characters: member.characters,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load guide." }, { status: 400 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ locationId: string }> }) {
  const member = await memberContext();
  if (!member) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { locationId } = await context.params;
  try {
    const body = await request.json() as Record<string, unknown>;
    const locationName = String(body.locationName ?? locationId);
    if (body.action === "add-business") {
      addBusiness({
        locationId,
        locationName,
        businessName: String(body.businessName ?? ""),
        userProfileId: member.profile.id,
      });
    } else if (body.action === "review") {
      saveReview({
        subjectId: String(body.subjectId ?? ""),
        userProfileId: member.profile.id,
        characterName: String(body.characterName ?? ""),
        allowedCharacters: member.characters,
        rating: Number(body.rating),
        comment: String(body.comment ?? ""),
      });
    } else {
      throw new Error("Unknown guide action.");
    }
    return NextResponse.json({
      ...getLocationGuide(locationId, locationName, member.profile.id),
      characters: member.characters,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update guide." }, { status: 400 });
  }
}
