"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { createProduct, setStorefrontEnabled, updateProduct, type FulfillmentType, type ProductStatus } from "@/lib/store";

function optionalInventory(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : Math.max(0, Number.parseInt(text, 10) || 0);
}

function productInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Product name is required.");
  const price = Math.max(0, Number.parseFloat(String(formData.get("price") ?? "0")) || 0);
  return {
    name,
    slug: String(formData.get("slug") ?? "").trim(),
    category: String(formData.get("category") ?? "other"),
    shortDescription: String(formData.get("shortDescription") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    priceCents: Math.round(price * 100),
    imageUrl: String(formData.get("imageUrl") ?? "").trim(),
    inventoryQuantity: optionalInventory(formData.get("inventoryQuantity")),
    status: String(formData.get("status") ?? "draft") as ProductStatus,
    fulfillmentType: String(formData.get("fulfillmentType") ?? "physical") as FulfillmentType,
  };
}

export async function createProductAction(formData: FormData) {
  await requireAdmin();
  createProduct(productInput(formData));
  revalidatePath("/store");
  revalidatePath("/admin/store");
  redirect("/admin/store");
}

export async function updateProductAction(id: string, formData: FormData) {
  await requireAdmin();
  const product = updateProduct(id, productInput(formData));
  revalidatePath("/store");
  revalidatePath("/admin/store");
  if (product) revalidatePath(`/store/${product.slug}`);
  redirect("/admin/store");
}

export async function updateStorefrontVisibilityAction(formData: FormData) {
  await requireAdmin();
  setStorefrontEnabled(formData.get("enabled") === "on");
  revalidatePath("/", "layout");
  revalidatePath("/admin/store");
}
