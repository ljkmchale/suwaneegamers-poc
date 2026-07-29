"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CART_STORAGE_KEY } from "./AddToCartButton";

interface CartItem {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  quantity: number;
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function CartContents({ checkoutReady }: { checkoutReady: boolean }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]"));
  }, []);

  function save(next: CartItem[]) {
    setItems(next);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("sg-cart-change"));
  }

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [items],
  );

  if (!items.length) {
    return (
      <div className="fantasy-card p-10 text-center">
        <p className="font-cinzel text-lg uppercase tracking-wider">Your adventurer’s bag is empty</p>
        <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Browse the shop when the first treasures arrive.
        </p>
        <Link href="/store" className="mt-6 inline-block text-sm" style={{ color: "var(--color-accent-gold)" }}>
          Return to the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="fantasy-card flex items-center justify-between gap-5 p-5">
            <div>
              <Link href={`/store/${item.slug}`} className="font-cinzel uppercase tracking-wider">
                {item.name}
              </Link>
              <p className="mt-1 text-sm" style={{ color: "var(--color-accent-gold)" }}>
                {money(item.priceCents)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Qty
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={item.quantity}
                  onChange={(event) =>
                    save(items.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : entry,
                    ))
                  }
                  className="ml-2 w-16 rounded border bg-transparent px-2 py-1"
                  style={{ borderColor: "var(--color-bg-border)" }}
                />
              </label>
              <button
                type="button"
                onClick={() => save(items.filter((entry) => entry.id !== item.id))}
                className="text-xs hover:text-red-300"
                style={{ color: "var(--color-text-muted)" }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </section>
      <aside className="fantasy-card h-fit p-6">
        <h2 className="font-cinzel text-lg uppercase tracking-wider">Order summary</h2>
        <div className="mt-5 flex justify-between border-t pt-4" style={{ borderColor: "var(--color-bg-border)" }}>
          <span style={{ color: "var(--color-text-secondary)" }}>Subtotal</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Shipping and tax will be calculated when checkout is configured.
        </p>
        <button
          type="button"
          disabled
          className="mt-6 w-full rounded-lg border px-4 py-3 font-cinzel text-xs uppercase tracking-widest opacity-60"
          style={{ borderColor: "var(--color-bg-border)", color: "var(--color-text-secondary)" }}
        >
          {checkoutReady ? "Checkout coming next" : "Checkout not yet enabled"}
        </button>
      </aside>
    </div>
  );
}
