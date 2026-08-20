"use client";

export function ConfirmSecurityAction({
  action,
  ip,
  disabled = false,
}: {
  action: "block" | "unblock";
  ip: string;
  disabled?: boolean;
}) {
  const blocking = action === "block";
  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        if (!window.confirm(`${blocking ? "Block" : "Unblock"} ${ip} ${blocking ? "at the Cloudflare edge" : "and allow it to reach the site again"}?`)) {
          event.preventDefault();
        }
      }}
      className={`rounded border px-2 py-1 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${
        blocking
          ? "border-red-800 text-red-300 hover:bg-red-950"
          : "border-emerald-800 text-emerald-300 hover:bg-emerald-950"
      }`}
    >
      {blocking ? "Block at Cloudflare" : "Unblock"}
    </button>
  );
}
