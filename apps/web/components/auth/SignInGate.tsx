import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled. Give it another try.",
  state: "Your sign-in session expired. Please try again.",
  exchange: "We couldn't complete sign-in with Google. Please try again.",
  not_configured: "Sign-in is not available right now.",
};

export function SignInGate({ error }: { error?: string }) {
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      style={{ background: "var(--color-bg-deep)" }}
    >
      <div
        className="fantasy-card w-full max-w-md rounded-2xl border p-10"
        style={{
          background: "var(--color-bg-card)",
          borderColor: "var(--color-bg-border)",
        }}
      >
        <div
          className="mb-6 font-cinzel text-2xl uppercase tracking-widest"
          style={{ color: "var(--color-accent-gold)" }}
        >
          ⚔ Suwanee Gamers
        </div>
        <h1
          className="mb-3 font-cinzel text-lg uppercase tracking-wider"
          style={{ color: "var(--color-text-primary)" }}
        >
          Enter the Portal
        </h1>
        <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          Sign in with your Google account to reach the campaign roster, calendar,
          and party tools.
        </p>

        {message && (
          <p
            className="mb-6 rounded-lg border px-4 py-3 text-xs"
            style={{
              borderColor: "var(--color-accent-blood)",
              color: "var(--color-accent-blood)",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {message}
          </p>
        )}

        <GoogleSignInButton />

        <p className="mt-8 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          We only use your name and email to show who&apos;s active in the group.
        </p>
      </div>
    </div>
  );
}
