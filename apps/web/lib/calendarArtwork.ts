// Non-campaign calendar art is maintained here, separately from Drive-managed
// campaign headers. Match titles only; descriptions may mention other events.
export function calendarArtwork(title: string): { image: string; position?: string; fit?: "contain" } | undefined {
  const normalized = title.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  if (/\bladies poker\b/.test(normalized)) {
    return { image: "/media/images/ladies-poker-v1.webp", fit: "contain" };
  }
  if (/\b(?:world of warcraft|wow) forever\b/.test(normalized)) {
    return { image: "/media/images/wow-forever/azeroth-painted-road-v2.webp" };
  }
  if (/\b(?:ren fest|renaissance (?:festival|fair|faire))\b/.test(normalized)) {
    return { image: "/media/images/campaigns/georgia-renaissance-festival-fall-fling.webp" };
  }
  return undefined;
}
