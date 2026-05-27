"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createPageAction } from "../actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

const INPUT = "w-full px-3 py-2 rounded border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm";
const LABEL = "block mb-1.5 text-xs font-cinzel tracking-widest uppercase text-[#a89880]";

export default function NewPagePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [pending, setPending] = useState(false);

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await createPageAction(fd);
    router.push("/admin/pages");
  }

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <Link href="/admin/pages" className="text-xs text-[#5a5060] hover:text-[#a89880] transition-colors">
          ← Back to Pages
        </Link>
        <h1 className="font-cinzel text-3xl tracking-widest uppercase mt-4 mb-1">New Page</h1>
        <p className="text-sm text-[#a89880]">Create a blank custom page you can fill with blocks.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className={LABEL}>Page title</label>
          <input
            name="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. New Player Guide"
            className={INPUT}
            required
            autoFocus
          />
        </div>

        <div>
          <label className={LABEL}>URL slug</label>
          <div className="flex items-center gap-0">
            <span className="px-3 py-2 rounded-l border border-r-0 border-[#2a2a35] bg-[#0f0a1a] text-[#5a5060] text-sm select-none">
              /
            </span>
            <input
              name="slug"
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
              placeholder="new-player-guide"
              className="flex-1 px-3 py-2 rounded-r border border-[#2a2a35] bg-[#16161e] text-[#e8dfc8] placeholder-[#5a5060] focus:outline-none focus:border-[#8b5cf6] text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-[#5a5060]">
            Auto-generated from title. Edit to customise.
          </p>
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-[#2a2a35]">
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="px-6 py-2.5 rounded font-cinzel text-xs tracking-widest uppercase bg-[#8b5cf6] hover:bg-[#7c3aed] text-white transition-colors disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create Page"}
          </button>
          <Link href="/admin/pages" className="text-sm text-[#5a5060] hover:text-[#a89880] transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
