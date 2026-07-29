"use client";

import { useState } from "react";
import Link from "next/link";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

export interface NavUser {
  name: string;
  email: string;
  picture?: string;
}

export function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className="inline-flex h-9 items-center gap-2 rounded border px-2 transition-colors"
        style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
        aria-label={`Signed in as ${user.name}`}
        title={user.email}
      >
        <Avatar user={user} />
        <span className="hidden xl:inline text-xs font-cinzel tracking-wider max-w-24 truncate">
          {firstName}
        </span>
      </button>

      {open && (
        <div className="absolute top-full right-0 pt-1 min-w-56 z-50">
          <div
            className="rounded-lg border py-2 shadow-2xl"
            style={{
              background: "rgba(10, 7, 20, 0.97)",
              borderColor: "var(--color-bg-border)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div className="px-4 py-2 border-b" style={{ borderColor: "var(--color-bg-border)" }}>
              <p className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>
                {user.name}
              </p>
              <p className="text-[10px] truncate" style={{ color: "var(--color-text-muted)" }}>
                {user.email}
              </p>
            </div>
            <Link
              href="/profile"
              className="flex w-full items-center gap-2 px-4 py-2 text-xs font-cinzel tracking-wider uppercase transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              onClick={() => setOpen(false)}
            >
              <Settings size={14} strokeWidth={2} aria-hidden="true" />
              Profile &amp; Myra
            </Link>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-2 px-4 py-2 text-xs font-cinzel tracking-wider uppercase transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                <LogOut size={14} strokeWidth={2} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user: NavUser }) {
  if (user.picture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.picture}
        alt=""
        referrerPolicy="no-referrer"
        className="h-6 w-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      className="grid h-6 w-6 place-items-center rounded-full"
      style={{ background: "var(--color-bg-surface)", color: "var(--color-accent-gold)" }}
    >
      <UserIcon size={13} strokeWidth={2} aria-hidden="true" />
    </span>
  );
}
