"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GuideSubject } from "@/lib/adventsGuide";
import { recordUsageEvent } from "@/components/analytics/AnalyticsTracker";

interface GuidePayload {
  location: GuideSubject;
  businesses: GuideSubject[];
  locationSummary: { averageRating: number | null; reviewCount: number };
  characters: string[];
  canReviewAsAnyone: boolean;
  canModerate: boolean;
  error?: string;
}

interface MapLocation {
  id: string;
  name: string;
  type?: string;
  region?: string;
}

function Stars({ value }: { value: number | null }) {
  return <span className="tracking-wider text-amber-400" aria-label={value ? `${value} out of 5 stars` : "Not rated"}>
    {value ? `${"★".repeat(Math.round(value))}${"☆".repeat(5 - Math.round(value))}` : "☆☆☆☆☆"}
  </span>;
}

export function AdventsGuideMap({ src, initialRatings }: {
  src: string;
  initialRatings: Record<string, { averageRating: number; reviewCount: number }>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapOrigin = useMemo(() => new URL(src).origin, [src]);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [payload, setPayload] = useState<GuidePayload | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [characterName, setCharacterName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [useCustomReviewer, setUseCustomReviewer] = useState(false);
  const [notice, setNotice] = useState("");
  const [ratings, setRatings] = useState(initialRatings);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reviewFormRef = useRef<HTMLFormElement>(null);

  // Pre-fills the review form from the viewer's own existing review on a
  // subject (if any), so re-submitting edits it instead of starting blank.
  function applyReviewToForm(subject: GuideSubject | undefined, characters: string[], canReviewAsAnyone: boolean) {
    const mine = subject?.reviews.find((review) => review.isMine);
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment);
      setCharacterName(mine.characterName);
      setUseCustomReviewer(canReviewAsAnyone && !characters.includes(mine.characterName));
    } else {
      setRating(0);
      setComment("");
      setUseCustomReviewer(false);
      setCharacterName((current) => current && characters.includes(current) ? current : (characters[0] ?? ""));
    }
  }

  function selectSubject(id: string) {
    setActiveSubjectId(id);
    if (!payload) return;
    const subject = [payload.location, ...payload.businesses].find((candidate) => candidate.id === id);
    applyReviewToForm(subject, payload.characters, payload.canReviewAsAnyone);
  }

  const sendRatings = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "advents-guide:ratings", ratings }, mapOrigin);
  }, [mapOrigin, ratings]);

  useEffect(() => {
    sendRatings();
  }, [sendRatings]);

  const loadGuide = useCallback(async (location: MapLocation) => {
    setLoading(true);
    setError("");
    setNotice("");
    setUseCustomReviewer(false);
    try {
      const response = await fetch(`/api/advents-guide/${encodeURIComponent(location.id)}?name=${encodeURIComponent(location.name)}`, { cache: "no-store" });
      const data = await response.json() as GuidePayload;
      if (!response.ok) throw new Error(data.error ?? "Unable to load the guide.");
      setPayload(data);
      setRatings((current) => data.locationSummary.reviewCount > 0 ? {
        ...current,
        [location.id]: {
          averageRating: data.locationSummary.averageRating ?? 0,
          reviewCount: data.locationSummary.reviewCount,
        },
      } : current);
      setActiveSubjectId(data.location.id);
      applyReviewToForm(data.location, data.characters, data.canReviewAsAnyone);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load the guide.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== mapOrigin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "advents-guide:ready") sendRatings();
      if (event.data?.type === "advents-guide:open" && event.data.location?.id && event.data.location?.name) {
        const location = event.data.location as MapLocation;
        setSelectedLocation(location);
        void loadGuide(location);
      }
      // A marker/region click on the map itself (distinct from opening the
      // Advents Guide sidebar) — the signal for which places on the map
      // people actually go look at.
      if (event.data?.type === "map:location-click" && event.data.location?.id && event.data.location?.name) {
        const clicked = event.data.location as MapLocation & { kind?: string };
        recordUsageEvent({
          eventType: "content_view",
          contentType: clicked.kind === "region" ? "map region" : "map location",
          contentId: clicked.id,
          contentLabel: clicked.name,
        });
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [loadGuide, mapOrigin, sendRatings]);

  const activeSubject = payload
    ? [payload.location, ...payload.businesses].find((subject) => subject.id === activeSubjectId) ?? payload.location
    : null;
  const myReview = activeSubject?.reviews.find((review) => review.isMine);

  // On a location overview, roll up reviews from the location and every place
  // within it (tagged with the place name); on a place, show just its reviews.
  const reports = payload && activeSubject
    ? (activeSubject.kind === "location"
        ? [payload.location, ...payload.businesses]
            .flatMap((subject) => subject.reviews.map((review) => ({ review, place: subject.kind === "business" ? subject.name : null })))
            .sort((a, b) => b.review.updatedAt.localeCompare(a.review.updatedAt))
        : activeSubject.reviews.map((review) => ({ review, place: null })))
    : [];

  async function post(body: Record<string, unknown>) {
    if (!selectedLocation) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/advents-guide/${encodeURIComponent(selectedLocation.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, locationName: selectedLocation.name }),
      });
      const data = await response.json() as GuidePayload;
      if (!response.ok) throw new Error(data.error ?? "Unable to update the guide.");
      setPayload(data);
      setRatings((current) => data.locationSummary.reviewCount > 0 ? {
        ...current,
        [selectedLocation.id]: {
          averageRating: data.locationSummary.averageRating ?? 0,
          reviewCount: data.locationSummary.reviewCount,
        },
      } : current);
      if (body.action === "review") {
        const subject = [data.location, ...data.businesses].find((candidate) => candidate.id === body.subjectId);
        applyReviewToForm(subject, data.characters, data.canReviewAsAnyone);
        const saved = subject?.reviews.find((review) => review.isMine);
        setNotice(saved && saved.createdAt !== saved.updatedAt ? "Your review was updated." : "Your review was published.");
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      } else if (body.action === "add-business") {
        setBusinessName("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the guide.");
    } finally {
      setLoading(false);
    }
  }

  function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!activeSubject) return;
    void post({ action: "review", subjectId: activeSubject.id, characterName, rating, comment });
  }

  function submitBusiness(event: FormEvent) {
    event.preventDefault();
    void post({ action: "add-business", businessName });
  }

  return <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden">
    <iframe ref={iframeRef} src={src} onLoad={sendRatings} title="Interactive map of Myrdae"
      className="h-full w-full" style={{ border: "none", background: "#07101d" }} allowFullScreen />

    {selectedLocation && <aside className="absolute inset-y-0 left-0 z-20 flex w-full max-w-md flex-col border-r border-amber-500/40 bg-[#0b0812]/98 shadow-[14px_0_40px_rgba(0,0,0,.65)] backdrop-blur-md">
      <header className="border-b border-amber-500/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-cinzel text-xs uppercase tracking-[0.22em] text-amber-400">Advents Guide to Myrdae</p>
            <h1 className="mt-2 flex items-center gap-3 font-cinzel text-2xl text-[#e8dfc8]">
              {activeSubject?.kind === "location" && <img key={selectedLocation.id} src={`${mapOrigin}/images/cities/${encodeURIComponent(selectedLocation.id)}/crest.png`} alt="" className="h-11 w-11 shrink-0 object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              <span>{activeSubject?.name ?? selectedLocation.name}</span>
            </h1>
            {activeSubject?.kind === "business" && <button className="mt-1 text-xs text-amber-300 hover:text-amber-200" onClick={() => payload && selectSubject(payload.location.id)}>← Back to {selectedLocation.name}</button>}
          </div>
          <button aria-label="Close Advents Guide" className="rounded-full border border-white/15 px-3 py-1 text-lg text-[#a89880] hover:border-amber-400 hover:text-amber-300" onClick={() => setSelectedLocation(null)}>×</button>
        </div>
        {activeSubject && (() => {
          const summary = activeSubject.kind === "location" && payload
            ? payload.locationSummary
            : { averageRating: activeSubject.averageRating, reviewCount: activeSubject.reviewCount };
          return <div className="mt-3 flex items-center gap-2 text-sm"><Stars value={summary.averageRating} /><span className="text-[#a89880]">{summary.averageRating ?? "Not rated"} · {summary.reviewCount} {summary.reviewCount === 1 ? "review" : "reviews"}</span></div>;
        })()}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-7 overflow-y-auto p-5">
        {loading && !payload && <p className="text-[#a89880]">Opening the guide…</p>}
        {error && <p role="alert" className="rounded border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="rounded border border-emerald-500/40 bg-emerald-950/40 p-3 text-sm text-emerald-200">{notice}</p>}

        {activeSubject?.kind === "location" && payload && <section>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">Places</h2>
          {payload.businesses.length === 0
            ? <p className="mt-3 text-sm italic text-[#7f748a]">No places on the map here yet.</p>
            : <select value="" onChange={(event) => { if (event.target.value) selectSubject(event.target.value); }} className="mt-3 w-full rounded border border-white/15 bg-[#130e1e] px-3 py-2 text-sm text-[#e8dfc8] outline-none focus:border-amber-400">
                <option value="">Select a place…</option>
                {payload.businesses.map((business) => <option key={business.id} value={business.id}>
                  {business.name}{business.averageRating ? ` — ★ ${business.averageRating}` : " — Not rated"}
                </option>)}
              </select>}
          <form className="mt-3 flex gap-2" onSubmit={submitBusiness}>
            <input required minLength={2} maxLength={100} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Add a place" className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#e8dfc8] outline-none focus:border-amber-400" />
            <button disabled={loading} className="rounded border border-amber-500/50 px-3 py-2 text-sm text-amber-300 disabled:opacity-50">Add</button>
          </form>
        </section>}

        {activeSubject && <section>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">Adventurers’ Reports</h2>
          <div className="mt-3 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
            {reports.length === 0 && <p className="text-sm italic text-[#7f748a]">No adventurer has filed a report here yet.</p>}
            {reports.map(({ review, place }) => <article key={review.id} className={`rounded-lg border p-4 ${review.isMine ? "border-amber-500/30 bg-amber-500/[.06]" : "border-white/10 bg-white/[.03]"}`}>
              {place && <button onClick={() => selectSubject(review.subjectId)} className="mb-1 block font-cinzel text-xs uppercase tracking-wider text-amber-300 hover:text-amber-200">{place}</button>}
              <div className="flex items-center justify-between gap-3">
                <strong className="flex items-center gap-2 font-cinzel text-sm text-[#e8dfc8]">
                  {review.characterName}
                  {review.isMine && <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">You</span>}
                </strong>
                <Stars value={review.rating} />
              </div>
              {review.censored
                ? <p className="mt-2 text-sm italic text-[#7f748a]">⟨Comment removed by a moderator⟩</p>
                : review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#b9ac98]">“{review.comment}”</p>}
              {review.isMine && <div className="mt-3 border-t border-white/5 pt-2 text-xs">
                <button type="button" onClick={() => { selectSubject(review.subjectId); reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="text-amber-300 hover:text-amber-200">Edit your review</button>
              </div>}
              {payload?.canModerate && <div className="mt-3 flex gap-4 border-t border-white/5 pt-2 text-xs">
                <button type="button" onClick={() => void post({ action: "censor-review", reviewId: review.id, censored: !review.censored })} className="text-amber-300 hover:text-amber-200">{review.censored ? "Restore" : "Censor"}</button>
                <button type="button" onClick={() => { if (window.confirm("Delete this review permanently?")) void post({ action: "delete-review", reviewId: review.id }); }} className="text-red-300 hover:text-red-200">Delete</button>
              </div>}
            </article>)}
          </div>
        </section>}

        {activeSubject && <form ref={reviewFormRef} className="space-y-3 border-t border-amber-500/20 pt-5" onSubmit={submitReview}>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">{myReview ? "Edit Your Review" : "Rate & Review"}</h2>
          {myReview && <p className="text-xs italic text-[#7f748a]">You already reviewed this — changes here will replace your existing review.</p>}
          {payload && (payload.characters.length > 0 || payload.canReviewAsAnyone) ? <>
            <label className="block text-xs uppercase tracking-wider text-[#a89880]">Reviewing as
              {payload.canReviewAsAnyone && payload.characters.length === 0
                ? <input value={characterName} maxLength={100} onChange={(event) => setCharacterName(event.target.value)} placeholder="Character or NPC name" className="mt-1 w-full rounded border border-white/15 bg-[#130e1e] px-3 py-2 text-sm normal-case tracking-normal text-[#e8dfc8] outline-none focus:border-amber-400" />
                : <select value={payload.canReviewAsAnyone && useCustomReviewer ? "__custom__" : characterName} onChange={(event) => {
                    if (event.target.value === "__custom__") { setUseCustomReviewer(true); setCharacterName(""); }
                    else { setUseCustomReviewer(false); setCharacterName(event.target.value); }
                  }} className="mt-1 w-full rounded border border-white/15 bg-[#130e1e] px-3 py-2 text-sm normal-case tracking-normal text-[#e8dfc8]">
                    {payload.characters.map((character) => <option key={character}>{character}</option>)}
                    {payload.canReviewAsAnyone && <option value="__custom__">Someone else…</option>}
                  </select>}
              {payload.canReviewAsAnyone && useCustomReviewer && payload.characters.length > 0 && <input value={characterName} maxLength={100} autoFocus onChange={(event) => setCharacterName(event.target.value)} placeholder="Character or NPC name" className="mt-2 w-full rounded border border-white/15 bg-[#130e1e] px-3 py-2 text-sm normal-case tracking-normal text-[#e8dfc8] outline-none focus:border-amber-400" />}
            </label>
            {payload.canReviewAsAnyone && <p className="text-xs italic text-[#7f748a]">You may review as one of your characters or someone else (NPC).</p>}
            <fieldset><legend className="text-xs uppercase tracking-wider text-[#a89880]">Rating</legend><div className="mt-1 flex gap-1">
              {[1,2,3,4,5].map((star) => <button type="button" key={star} aria-label={`${star} stars`} onClick={() => setRating(star)} className={`text-3xl ${star <= rating ? "text-amber-400" : "text-[#51485b]"}`}>★</button>)}
            </div></fieldset>
            <textarea maxLength={1200} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share what your character experienced…" className="min-h-28 w-full rounded border border-white/15 bg-black/30 p-3 text-sm text-[#e8dfc8] outline-none focus:border-amber-400" />
            <button disabled={loading || rating === 0 || !characterName.trim()} className="w-full rounded border border-amber-500/60 bg-amber-500/10 px-4 py-2 font-cinzel text-sm text-amber-300 disabled:opacity-40">{myReview ? "Update Review" : "Publish Review"}</button>
          </> : <p className="text-sm text-[#a89880]">A character must be assigned to your player profile before you can publish a review.</p>}
        </form>}
      </div>
    </aside>}
  </div>;
}
