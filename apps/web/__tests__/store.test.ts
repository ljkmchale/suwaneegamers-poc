import { describe, expect, it } from "vitest";
import { formatPrice, paypalPriceCents, productSlug } from "@/lib/store";

describe("store catalog helpers", () => {
  it("creates stable product URLs", () => {
    expect(productSlug("Suwanee Gamers T-Shirt")).toBe("suwanee-gamers-t-shirt");
    expect(productSlug("  Dragon's Dice Bag! ")).toBe("dragon-s-dice-bag");
  });

  it("formats integer-cent prices", () => {
    expect(formatPrice(2500)).toBe("$25.00");
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("grosses up product prices to recover PayPal's 3.49% plus $0.49 fee", () => {
    expect(paypalPriceCents(0)).toBe(0);
    expect(paypalPriceCents(2500)).toBe(2642);
    expect(paypalPriceCents(3500)).toBe(3678);
    expect(paypalPriceCents(6000)).toBe(6268);
  });
});
