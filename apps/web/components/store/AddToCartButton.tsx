"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";

interface CartProduct {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
}

export const CART_STORAGE_KEY = "suwanee-gamers-cart-v2";

export function AddToCartButton({ product }: { product: CartProduct }) {
  const [added, setAdded] = useState(false);

  function add() {
    const existing = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]") as
      Array<CartProduct & { quantity: number }>;
    const item = existing.find((entry) => entry.id === product.id);
    if (item) {
      item.quantity += 1;
      item.priceCents = product.priceCents;
      item.name = product.name;
      item.slug = product.slug;
      item.imageUrl = product.imageUrl;
    }
    else existing.push({ ...product, quantity: 1 });
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(existing));
    window.dispatchEvent(new Event("sg-cart-change"));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={add}
      className="inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 font-cinzel text-xs uppercase tracking-widest transition-all hover:brightness-125"
      style={{
        borderColor: "var(--color-accent-gold)",
        color: "var(--color-accent-gold)",
        background: "rgba(245,158,11,.1)",
      }}
    >
      <ShoppingBag size={16} aria-hidden="true" />
      {added ? "Added to bag" : "Add to bag"}
    </button>
  );
}
