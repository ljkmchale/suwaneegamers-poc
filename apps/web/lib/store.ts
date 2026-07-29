import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export type ProductStatus = "draft" | "active" | "archived";
export type FulfillmentType = "physical" | "digital" | "event";

export interface StoreProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  category: string;
  inventoryQuantity: number | null;
  status: ProductStatus;
  fulfillmentType: FulfillmentType;
  createdAt: string;
  updatedAt: string;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  price_cents: number;
  currency: string;
  image_url: string | null;
  category: string;
  inventory_quantity: number | null;
  status: ProductStatus;
  fulfillment_type: FulfillmentType;
  created_at: string;
  updated_at: string;
}

function mapProduct(row: ProductRow): StoreProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    imageUrl: row.image_url,
    category: row.category,
    inventoryQuantity: row.inventory_quantity,
    status: row.status,
    fulfillmentType: row.fulfillment_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function productSlug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function listActiveProducts(): StoreProduct[] {
  return (getDb().prepare(
    `SELECT * FROM store_products WHERE status = 'active' ORDER BY updated_at DESC`,
  ).all() as ProductRow[]).map(mapProduct);
}

export function listAllProducts(): StoreProduct[] {
  return (getDb().prepare(
    `SELECT * FROM store_products ORDER BY updated_at DESC`,
  ).all() as ProductRow[]).map(mapProduct);
}

export function getActiveProduct(slug: string): StoreProduct | null {
  const row = getDb().prepare(
    `SELECT * FROM store_products WHERE slug = ? AND status = 'active'`,
  ).get(slug) as ProductRow | undefined;
  return row ? mapProduct(row) : null;
}

export function getProduct(id: string): StoreProduct | null {
  const row = getDb().prepare(`SELECT * FROM store_products WHERE id = ?`).get(id) as
    | ProductRow
    | undefined;
  return row ? mapProduct(row) : null;
}

export function getProductBySlug(slug: string): StoreProduct | null {
  const row = getDb().prepare(`SELECT * FROM store_products WHERE slug = ?`).get(slug) as
    | ProductRow
    | undefined;
  return row ? mapProduct(row) : null;
}

export interface ProductInput {
  name: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  priceCents?: number;
  imageUrl?: string;
  category?: string;
  inventoryQuantity?: number | null;
  status?: ProductStatus;
  fulfillmentType?: FulfillmentType;
}

export function createProduct(input: ProductInput): StoreProduct {
  const id = randomUUID();
  const now = new Date().toISOString();
  const slug = productSlug(input.slug || input.name);
  getDb().prepare(`
    INSERT INTO store_products (
      id, slug, name, short_description, description, price_cents, currency,
      image_url, category, inventory_quantity, status, fulfillment_type, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, slug, input.name, input.shortDescription ?? "", input.description ?? "",
    input.priceCents ?? 0, input.imageUrl || null, input.category ?? "other", input.inventoryQuantity ?? null,
    input.status ?? "draft", input.fulfillmentType ?? "physical", now, now,
  );
  return getProduct(id)!;
}

export function updateProduct(id: string, input: ProductInput): StoreProduct | null {
  const current = getProduct(id);
  if (!current) return null;
  getDb().prepare(`
    UPDATE store_products SET
      slug = ?, name = ?, short_description = ?, description = ?, price_cents = ?,
      image_url = ?, category = ?, inventory_quantity = ?, status = ?, fulfillment_type = ?, updated_at = ?
    WHERE id = ?
  `).run(
    productSlug(input.slug || input.name), input.name,
    input.shortDescription ?? "", input.description ?? "", input.priceCents ?? 0,
    input.imageUrl || null, input.category ?? current.category, input.inventoryQuantity ?? null, input.status ?? "draft",
    input.fulfillmentType ?? "physical", new Date().toISOString(), id,
  );
  return getProduct(id);
}

export function formatPrice(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export const PAYPAL_FEE_RATE = 0.0349;
export const PAYPAL_FIXED_FEE_CENTS = 49;

export function paypalPriceCents(basePriceCents: number): number {
  if (basePriceCents <= 0) return 0;
  return Math.ceil(
    (basePriceCents + PAYPAL_FIXED_FEE_CENTS) / (1 - PAYPAL_FEE_RATE),
  );
}

export function ensureStarterProductDrafts(): void {
  for (const product of [
    { name: "Suwanee Gamers T-Shirt", category: "t-shirts", shortDescription: "Draft shirt listing—add artwork, sizes, colors, price, and inventory." },
    {
      name: "Suwanee Gamers Dice Box",
      category: "dice-boxes",
      shortDescription: "A fitted seven-die vault offered in walnut or maple.",
      description: "A fitted seven-die vault offered in walnut or maple with a laser-engraved Suwanee Gamers crest.",
      imageUrl: "/media/images/store/dragon-vault-dice-box-walnut-v2.webp",
    },
    { name: "Suwanee Gamers Dice Bag", category: "dice-bags", shortDescription: "Draft dice bag listing—add materials, capacity, price, and inventory." },
    {
      name: "Suwanee Gamers Long Maple Dice Box",
      category: "dice-boxes",
      shortDescription: "A slim two-piece maple dice vault with magnetic closure.",
      description: "A long fitted two-piece dice vault with magnetic closure and an engraved Suwanee Gamers crest, offered in purpleheart, walnut, or maple.",
      imageUrl: "/media/images/store/long-dice-box-maple-forge.webp",
    },
    {
      name: "Suwanee Gamers Crewneck Sweatshirt",
      category: "t-shirts",
      shortDescription: "A heavyweight crewneck with a small crest on the front-left chest.",
      description: "A heavyweight crewneck sweatshirt featuring one small Suwanee Gamers crest on the front-left chest and a plain back.",
      imageUrl: "/media/images/store/suwanee-gamers-crewneck-sweatshirt.webp",
    },
    {
      name: "Suwanee Gamers Pullover Hoodie",
      category: "t-shirts",
      shortDescription: "A heavyweight pullover hoodie with a small front-left chest crest.",
      description: "A heavyweight pullover hoodie featuring one small Suwanee Gamers crest on the front-left chest and a plain back.",
      imageUrl: "/media/images/store/suwanee-gamers-pullover-hoodie.webp",
    },
  ]) {
    if (!getProductBySlug(productSlug(product.name))) {
      createProduct({ ...product, status: "draft", fulfillmentType: "physical" });
    }
  }
}

export const paypalStoreConfig = {
  configured: Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
  environment: process.env.PAYPAL_ENVIRONMENT === "live" ? "live" : "sandbox",
} as const;

export function isStorefrontEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const row = getDb().prepare(
    `SELECT value FROM store_settings WHERE key = 'storefront_enabled'`,
  ).get() as { value: string } | undefined;
  return row?.value === "true";
}

export function setStorefrontEnabled(enabled: boolean): void {
  getDb().prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES ('storefront_enabled', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(enabled), new Date().toISOString());
}
