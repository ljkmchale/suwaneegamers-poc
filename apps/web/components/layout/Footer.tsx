import Image from "next/image";

export function Footer() {
  return (
    <footer
      className="relative z-10 overflow-hidden border-t py-10"
      style={{
        borderColor: "var(--color-bg-border)",
        background:
          "linear-gradient(180deg, rgba(8,5,15,0.92) 0%, rgba(8,5,15,0.98) 100%), linear-gradient(90deg, rgba(42,42,53,0.34), rgba(15,10,26,0.72), rgba(42,42,53,0.34))",
      }}
    >
      <div
        className="absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 20% 0%, rgba(245,158,11,0.10), transparent 32%), radial-gradient(circle at 80% 10%, rgba(139,92,246,0.12), transparent 34%)",
        }}
      />
      <div className="relative max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-6 text-center sm:text-left">
        <Image
          src="/images/suwaneegamers-logo.png"
          alt="Suwanee Gamers"
          width={80}
          height={80}
          className="h-20 w-20 rounded-full object-contain shadow-2xl"
          style={{
            filter: "drop-shadow(0 0 18px rgba(245, 158, 11, 0.28))",
          }}
        />
        <div className="flex flex-col items-center sm:items-end gap-4">
          <p className="font-cinzel text-sm tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
            ⚔ Suwanee Gamers ⚔
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            The World of Myrdae · Year 1246 AF · The Awakening
          </p>
          <a
            href="https://www.facebook.com/SuwaneeGamers/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs hover:opacity-80 transition-opacity"
            style={{ color: "var(--color-accent-arcane)" }}
          >
            📘 Facebook — Suwanee Gamers
          </a>
        </div>
      </div>
    </footer>
  );
}
