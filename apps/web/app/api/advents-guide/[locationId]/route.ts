import { NextRequest, NextResponse } from "next/server";
import { addBusiness, deleteReview, getLocationGuide, saveReview, setReviewCensored } from "@/lib/adventsGuide";
import { getUserProfileContext, type UserProfileContext } from "@/lib/userProfiles";
import { getUserSession, isSignedIn } from "@/lib/userSession";
import { adminAllowlistActive, isAllowedAdminEmail } from "@/lib/adminAllowlist";

async function memberContext() {
  const session = await getUserSession();
  if (!isSignedIn(session)) return null;
  return getUserProfileContext(session);
}

// DMs and site admins may review as anyone and moderate reviews (delete/censor).
function isDmOrAdmin(member: UserProfileContext): boolean {
  return member.isDm || (adminAllowlistActive() && isAllowedAdminEmail(member.profile.email));
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
      canReviewAsAnyone: isDmOrAdmin(member),
      canModerate: isDmOrAdmin(member),
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
        allowAnyCharacter: isDmOrAdmin(member),
        rating: Number(body.rating),
        comment: String(body.comment ?? ""),
      });
    } else if (body.action === "delete-review" || body.action === "censor-review") {
      if (!isDmOrAdmin(member)) return NextResponse.json({ error: "Only a DM or admin can moderate reviews." }, { status: 403 });
      const reviewId = String(body.reviewId ?? "");
      if (!reviewId) throw new Error("Missing review.");
      if (body.action === "delete-review") deleteReview(reviewId);
      else setReviewCensored(reviewId, Boolean(body.censored));
    } else {
      throw new Error("Unknown guide action.");
    }
    return NextResponse.json({
      ...getLocationGuide(locationId, locationName, member.profile.id),
      characters: member.characters,
      canReviewAsAnyone: isDmOrAdmin(member),
      canModerate: isDmOrAdmin(member),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update guide." }, { status: 400 });
  }
}
