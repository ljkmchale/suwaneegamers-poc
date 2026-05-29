import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center text-center px-6">
      {/* Decorative rune */}
      <div
        className="text-6xl mb-8 select-none"
        style={{ color: "var(--color-accent-arcane)", opacity: 0.5 }}
        aria-hidden="true"
      >
        ⚙
      </div>

      {/* Heading */}
      <p
        className="font-cinzel text-xs tracking-widest uppercase mb-3"
        style={{ color: "var(--color-accent-arcane)" }}
      >
        Under Construction
      </p>
      <h1
        className="font-cinzel text-3xl md:text-4xl tracking-widest uppercase mb-4"
        style={{ color: "var(--color-accent-gold)" }}
      >
        This Page Is Being Built
      </h1>

      {/* Body */}
      <p
        className="text-sm max-w-md mb-2"
        style={{ color: "var(--color-text-secondary)" }}
      >
        The scribes are still working on this section of the archive. Check back
        soon — or return to the realm and explore what&apos;s already been uncovered.
      </p>

      {/* Divider */}
      <div
        className="w-16 border-t my-8"
        style={{ borderColor: "var(--color-bg-border)" }}
      />

      {/* Back home */}
      <Link
        href="/"
        className="font-cinzel text-xs tracking-widest uppercase px-6 py-2.5 rounded border transition-colors"
        style={{
          borderColor: "var(--color-accent-gold)",
          color: "var(--color-accent-gold)",
        }}
      >
        Return to the Realm
      </Link>
    </div>
  );
}
