import Image from "next/image";
import Link from "next/link";

function SocialIcon({ name }: { name: "Facebook" | "Instagram" | "Discord" }) {
  if (name === "Facebook") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.438H7.078v-3.489h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.973h-1.513c-1.49 0-1.956.931-1.956 1.887v2.261h3.328l-.532 3.489h-2.796V24C19.612 23.094 24 18.1 24 12.073Z" />
      </svg>
    );
  }

  if (name === "Instagram") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
        <path d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6Zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
      <path d="M20.32 4.37A19.8 19.8 0 0 0 15.44 2.9a13.8 13.8 0 0 0-.62 1.28 18.3 18.3 0 0 0-5.62 0 13.6 13.6 0 0 0-.63-1.28A19.7 19.7 0 0 0 3.68 4.38C.59 8.96-.25 13.43.17 17.84a19.9 19.9 0 0 0 5.99 3.03c.49-.66.92-1.36 1.3-2.1a12.9 12.9 0 0 1-2.05-.98l.5-.39c3.95 1.8 8.24 1.8 12.15 0l.5.39c-.66.38-1.35.71-2.06.98.38.74.82 1.44 1.3 2.1a19.8 19.8 0 0 0 6-3.03c.49-5.11-.83-9.54-3.48-13.47ZM8.02 15.15c-1.18 0-2.16-1.08-2.16-2.4s.95-2.4 2.16-2.4c1.22 0 2.18 1.09 2.16 2.4 0 1.32-.95 2.4-2.16 2.4Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.4s.95-2.4 2.16-2.4c1.22 0 2.18 1.09 2.16 2.4 0 1.32-.94 2.4-2.16 2.4Z" />
    </svg>
  );
}

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
      <div className="relative mx-auto flex max-w-6xl justify-center px-6 text-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/media/images/suwaneegamers-logo-footer.png"
            alt="Suwanee Gamers"
            width={80}
            height={80}
            className="h-20 w-20 object-contain shadow-2xl"
            style={{
              filter: "drop-shadow(0 0 18px rgba(245, 158, 11, 0.28))",
            }}
          />
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            © 2026 Suwanee Gamers. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://www.facebook.com/SuwaneeGamers/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              title="Facebook"
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              <SocialIcon name="Facebook" />
            </a>
            <a
              href="https://www.instagram.com/suwaneegamers/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              title="Instagram"
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              <SocialIcon name="Instagram" />
            </a>
            <a
              href="https://discord.com/invite/cnJxQ57mx"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              title="Discord"
              className="transition-opacity hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              <SocialIcon name="Discord" />
            </a>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/terms-of-use"
              className="text-xs underline-offset-4 transition-opacity hover:underline hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Terms of Use
            </Link>
            <Link
              href="/privacy-policy"
              className="text-xs underline-offset-4 transition-opacity hover:underline hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:webmaster@suwaneegamers.net"
              className="text-xs underline-offset-4 transition-opacity hover:underline hover:opacity-80"
              style={{ color: "var(--color-accent-arcane)" }}
            >
              Contact the Webmaster
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
