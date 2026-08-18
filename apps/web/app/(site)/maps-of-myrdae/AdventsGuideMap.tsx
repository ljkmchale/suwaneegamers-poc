"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GuideSubject } from "@/lib/adventsGuide";

interface GuidePayload {
  location: GuideSubject;
  businesses: GuideSubject[];
  characters: string[];
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
  const [ratings, setRatings] = useState(initialRatings);

  const sendRatings = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "advents-guide:ratings", ratings }, mapOrigin);
  }, [mapOrigin, ratings]);

  useEffect(() => {
    sendRatings();
  }, [sendRatings]);

  const loadGuide = useCallback(async (location: MapLocation) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/advents-guide/${encodeURIComponent(location.id)}?name=${encodeURIComponent(location.name)}`);
      const data = await response.json() as GuidePayload;
      if (!response.ok) throw new Error(data.error ?? "Unable to load the guide.");
      setPayload(data);
      setRatings((current) => data.location.reviewCount > 0 ? {
        ...current,
        [location.id]: {
          averageRating: data.location.averageRating ?? 0,
          reviewCount: data.location.reviewCount,
        },
      } : current);
      setActiveSubjectId(data.location.id);
      setCharacterName((current) => current && data.characters.includes(current) ? current : (data.characters[0] ?? ""));
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
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [loadGuide, mapOrigin, sendRatings]);

  const activeSubject = payload
    ? [payload.location, ...payload.businesses].find((subject) => subject.id === activeSubjectId) ?? payload.location
    : null;

  async function post(body: Record<string, unknown>) {
    if (!selectedLocation) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/advents-guide/${encodeURIComponent(selectedLocation.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, locationName: selectedLocation.name }),
      });
      const data = await response.json() as GuidePayload;
      if (!response.ok) throw new Error(data.error ?? "Unable to update the guide.");
      setPayload(data);
      setRatings((current) => data.location.reviewCount > 0 ? {
        ...current,
        [selectedLocation.id]: {
          averageRating: data.location.averageRating ?? 0,
          reviewCount: data.location.reviewCount,
        },
      } : current);
      setComment("");
      setRating(0);
      setBusinessName("");
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
            <h1 className="mt-2 font-cinzel text-2xl text-[#e8dfc8]">{activeSubject?.name ?? selectedLocation.name}</h1>
            {activeSubject?.kind === "business" && <button className="mt-1 text-xs text-amber-300 hover:text-amber-200" onClick={() => setActiveSubjectId(payload?.location.id ?? null)}>← Back to {selectedLocation.name}</button>}
          </div>
          <button aria-label="Close Advents Guide" className="rounded-full border border-white/15 px-3 py-1 text-lg text-[#a89880] hover:border-amber-400 hover:text-amber-300" onClick={() => setSelectedLocation(null)}>×</button>
        </div>
        {activeSubject && <div className="mt-3 flex items-center gap-2 text-sm"><Stars value={activeSubject.averageRating} /><span className="text-[#a89880]">{activeSubject.averageRating ?? "Not rated"} · {activeSubject.reviewCount} {activeSubject.reviewCount === 1 ? "review" : "reviews"}</span></div>}
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto p-5">
        {loading && !payload && <p className="text-[#a89880]">Opening the guide…</p>}
        {error && <p role="alert" className="rounded border border-red-500/40 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}

        {activeSubject?.kind === "location" && payload && <section>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">Businesses</h2>
          <div className="mt-3 space-y-2">
            {payload.businesses.length === 0 && <p className="text-sm italic text-[#7f748a]">No businesses have been entered yet.</p>}
            {payload.businesses.map((business) => <button key={business.id} onClick={() => setActiveSubjectId(business.id)} className="flex w-full items-center justify-between rounded border border-white/10 bg-white/[.03] p-3 text-left hover:border-amber-500/40">
              <span className="font-cinzel text-sm text-[#e8dfc8]">{business.name}</span>
              <span className="text-xs text-[#a89880]">{business.averageRating ? `★ ${business.averageRating}` : "Not rated"}</span>
            </button>)}
          </div>
          <form className="mt-3 flex gap-2" onSubmit={submitBusiness}>
            <input required minLength={2} maxLength={100} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Add a business" className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-3 py-2 text-sm text-[#e8dfc8] outline-none focus:border-amber-400" />
            <button disabled={loading} className="rounded border border-amber-500/50 px-3 py-2 text-sm text-amber-300 disabled:opacity-50">Add</button>
          </form>
        </section>}

        {activeSubject && <section>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">Adventurers’ Reports</h2>
          <div className="mt-3 space-y-3">
            {activeSubject.reviews.length === 0 && <p className="text-sm italic text-[#7f748a]">No adventurer has reviewed this place yet.</p>}
            {activeSubject.reviews.map((review) => <article key={review.id} className="rounded-lg border border-white/10 bg-white/[.03] p-4">
              <div className="flex items-center justify-between gap-3"><strong className="font-cinzel text-sm text-[#e8dfc8]">{review.characterName}</strong><Stars value={review.rating} /></div>
              {review.comment && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#b9ac98]">“{review.comment}”</p>}
            </article>)}
          </div>
        </section>}

        {activeSubject && <form className="space-y-3 border-t border-amber-500/20 pt-5" onSubmit={submitReview}>
          <h2 className="font-cinzel text-sm uppercase tracking-wider text-amber-300">Rate &amp; Review</h2>
          {payload?.characters.length ? <>
            <label className="block text-xs uppercase tracking-wider text-[#a89880]">Reviewing as
              <select value={characterName} onChange={(event) => setCharacterName(event.target.value)} className="mt-1 w-full rounded border border-white/15 bg-[#130e1e] px-3 py-2 text-sm normal-case tracking-normal text-[#e8dfc8]">
                {payload.characters.map((character) => <option key={character}>{character}</option>)}
              </select>
            </label>
            <fieldset><legend className="text-xs uppercase tracking-wider text-[#a89880]">Rating</legend><div className="mt-1 flex gap-1">
              {[1,2,3,4,5].map((star) => <button type="button" key={star} aria-label={`${star} stars`} onClick={() => setRating(star)} className={`text-3xl ${star <= rating ? "text-amber-400" : "text-[#51485b]"}`}>★</button>)}
            </div></fieldset>
            <textarea maxLength={1200} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Share what your character experienced…" className="min-h-28 w-full rounded border border-white/15 bg-black/30 p-3 text-sm text-[#e8dfc8] outline-none focus:border-amber-400" />
            <button disabled={loading || rating === 0 || !characterName} className="w-full rounded border border-amber-500/60 bg-amber-500/10 px-4 py-2 font-cinzel text-sm text-amber-300 disabled:opacity-40">Publish Review</button>
          </> : <p className="text-sm text-[#a89880]">A character must be assigned to your player profile before you can publish a review.</p>}
        </form>}
      </div>
    </aside>}
  </div>;
}
