import type { Metadata } from "next";
import { CartContents } from "@/components/store/CartContents";
import { paypalStoreConfig } from "@/lib/store";

export const metadata: Metadata = { title: "Your Bag" };

export default function CartPage() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-24 pt-12">
      <p className="font-cinzel text-xs uppercase tracking-[.35em]" style={{ color: "var(--color-accent-arcane)" }}>The Gamers’ Forge</p>
      <h1 className="mt-2 font-cinzel text-3xl uppercase tracking-widest">Your Bag</h1>
      <div className="mt-8"><CartContents checkoutReady={paypalStoreConfig.configured} /></div>
    </div>
  );
}
