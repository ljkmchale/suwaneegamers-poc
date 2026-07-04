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
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 px-6 text-center sm:grid-cols-[auto_1fr_auto]">
        <Image
          src="/images/suwaneegamers-logo-footer.png"
          alt="Suwanee Gamers"
          width={80}
          height={80}
          className="h-20 w-20 rounded-full object-contain shadow-2xl"
          style={{
            filter: "drop-shadow(0 0 18px rgba(245, 158, 11, 0.28))",
          }}
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="font-cinzel text-sm tracking-widest" style={{ color: "var(--color-accent-gold)" }}>
            ⚔ Suwanee Gamers ⚔
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            The World of Myrdae · Year 1246 AF · The Awakening
          </p>
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
            <a
              href="https://www.facebook.com/SuwaneeGamers/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Facebook — Suwanee Gamers
            </a>
            <a
              href="https://www.instagram.com/suwaneegamers/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Instagram — Suwanee Gamers
            </a>
            <a
              href="https://meet.google.com/mex-iakn-nmd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Google Meet — Group Call
            </a>
          </div>
        </div>
        <div className="hidden h-20 w-20 sm:block" aria-hidden="true" />
      </div>
    </footer>
  );
}
