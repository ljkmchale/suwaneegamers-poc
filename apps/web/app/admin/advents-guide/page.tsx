import Link from "next/link";
import { Anchor, ChevronDown, Flag, EyeOff } from "lucide-react";
import { requireAdmin } from "@/lib/adminAuth";
import {
  listGuideRatingsForAdmin,
  type AdminGuideLocation,
  type AdminGuideReview,
  type AdminGuideSort,
} from "@/lib/adventsGuide";
import { GuideReviewActions } from "./GuideReviewActions";

export const dynamic = "force-dynamic";

const SORTS: { key: AdminGuideSort; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "lowest", label: "Lowest rated" },
  { key: "most", label: "Most reviews" },
];

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Stars({ value }: { value: number | null }) {
  const rounded = value ? Math.round(value) : 0;
  return (
    <span className="tracking-wider text-amber-400" aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
      {"★".repeat(rounded)}
      <span className="text-[#4a4356]">{"★".repeat(5 - rounded)}</span>
    </span>
  );
}

function ReviewRow({ review }: { review: AdminGuideReview }) {
  return (
    <li className="rounded-lg border border-[#21182e] bg-[#0b0713] p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#5a5060]">
        {review.placeName ? (
          <span className="rounded-full border border-[#2a2a35] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#a89880]">
            {review.placeName}
          </span>
        ) : (
          <span className="rounded-full border border-[#2a2a35] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#6f6580]">
            Location overview
          </span>
        )}
        {review.flagged && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-800 bg-amber-950/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">
            <Flag size={10} aria-hidden="true" /> Flagged
          </span>
        )}
        {review.censored && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[#3a2a4a] bg-[#160f22] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#9080a0]">
            <EyeOff size={10} aria-hidden="true" /> Censored
          </span>
        )}
        <span className="ml-auto">{dateTime(review.updatedAt)}</span>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <strong className="font-cinzel text-sm text-[#e8dfc8]">{review.characterName}</strong>
        <Stars value={review.rating} />
      </div>

      {review.comment ? (
        <p
          className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${
            review.censored ? "italic text-[#7f748a]" : "text-[#b9ac98]"
          }`}
        >
          {review.censored ? "(hidden from players — " : "“"}
          {review.comment}
          {review.censored ? ")" : "”"}
        </p>
      ) : (
        <p className="mt-2 text-sm italic text-[#5a5060]">No written comment.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#21182e] pt-3">
        <span className="text-xs text-[#7a6f85]">
          {review.memberName ?? "Unknown member"}
          {review.memberEmail && <span className="text-[#5a5060]"> · {review.memberEmail}</span>}
        </span>
        <GuideReviewActions id={review.id} censored={review.censored} />
      </div>
    </li>
  );
}

function LocationCard({ location, open }: { location: AdminGuideLocation; open: boolean }) {
  return (
    <details className="group rounded-lg border border-[#2a2a35] bg-[#0f0a1a]" open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          size={16}
          aria-hidden="true"
          className="shrink-0 text-[#5a5060] transition-transform group-open:rotate-180"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-cinzel text-lg text-[#e8dfc8]">{location.locationName}</h2>
          <p className="mt-0.5 truncate text-xs text-[#5a5060]">{location.locationId}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {location.flaggedCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-300">
              <Flag size={11} aria-hidden="true" /> {location.flaggedCount}
            </span>
          )}
          {location.censoredCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[#9080a0]">
              <EyeOff size={11} aria-hidden="true" /> {location.censoredCount}
            </span>
          )}
          <Stars value={location.averageRating} />
          <span className="whitespace-nowrap text-xs text-[#7a6f85]">
            {location.averageRating ?? "—"} · {location.reviewCount}
            {location.reviewCount === 1 ? " review" : " reviews"}
          </span>
        </div>
      </summary>
      <ul className="space-y-3 border-t border-[#21182e] p-4">
        {location.reviews.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </ul>
    </details>
  );
}

export default async function AdminAdventsGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const sort: AdminGuideSort =
    params.sort === "lowest" || params.sort === "most" ? params.sort : "recent";

  const locations = listGuideRatingsForAdmin(sort);
  const totals = locations.reduce(
    (acc, loc) => ({
      reviews: acc.reviews + loc.reviewCount,
      flagged: acc.flagged + loc.flaggedCount,
      censored: acc.censored + loc.censoredCount,
    }),
    { reviews: 0, flagged: 0, censored: 0 },
  );
  // Expand any location that needs attention so it is visible without a click.
  const autoOpen = locations.length <= 3 || totals.flagged > 0;

  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="font-cinzel text-2xl text-[#e8dfc8]">Advents Guide</h1>
        <p className="mt-1 text-sm text-[#7a6f85]">
          Every in-character rating and review left on the map. Censor hides a
          comment from players while keeping it here; delete removes it for good.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#9080a0]">
          <span>
            <strong className="text-[#e8dfc8]">{locations.length}</strong> locations
          </span>
          <span>
            <strong className="text-[#e8dfc8]">{totals.reviews}</strong> reviews
          </span>
          <span>
            <strong className="text-amber-300">{totals.flagged}</strong> flagged
          </span>
          <span>
            <strong className="text-[#e8dfc8]">{totals.censored}</strong> censored
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {SORTS.map((option) => (
            <Link
              key={option.key}
              href={option.key === "recent" ? "/admin/advents-guide" : `/admin/advents-guide?sort=${option.key}`}
              className={`transition-colors hover:text-[#f59e0b] ${
                sort === option.key ? "text-[#f59e0b]" : "text-[#a89880]"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>

      {locations.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2a2a35] py-16 text-center text-[#5a5060]">
          <Anchor size={28} aria-hidden="true" />
          <p className="text-sm">No adventurer has filed a report on the map yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((location) => (
            <LocationCard key={location.locationId} location={location} open={autoOpen} />
          ))}
        </div>
      )}
    </div>
  );
}
