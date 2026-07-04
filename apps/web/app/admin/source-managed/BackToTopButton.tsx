"use client";

import { useEffect, useState } from "react";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 500);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed right-6 bottom-6 z-40 rounded border border-[#5b3f11] bg-[#0f0a1a] px-4 py-2 font-cinzel text-[10px] uppercase tracking-widest text-[#e8dfc8] shadow-xl shadow-black/40 transition-all hover:border-[#f59e0b] hover:text-[#f59e0b] ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      Back to top
    </button>
  );
}
