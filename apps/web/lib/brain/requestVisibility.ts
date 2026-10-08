import { getAdminSession } from "@/lib/adminSession";

/**
 * The visibility a Library request actually gets.
 *
 * A request may ask for "dm", but asking is not permission: anyone signed in
 * can put `?visibility=dm` in an address. DM pages are served only to an
 * authenticated admin session, the same rule /api/brain/ask applies (which
 * also accepts Myra's short-lived DM capability; these GET routes have no
 * machine caller). Everything else is treated as a player request.
 */
export async function grantedVisibility(requested: string | null | undefined): Promise<"dm" | "players"> {
  if (requested !== "dm") return "players";
  return (await getAdminSession()).isAdmin === true ? "dm" : "players";
}
