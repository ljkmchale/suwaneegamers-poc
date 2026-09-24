"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { clampService, slugify } from "@/lib/serviceCosts";
import { getServiceCatalog, saveServiceCatalog } from "@/lib/serviceCostStore";

function entryFromForm(formData: FormData, id: string, envKeys: string[]) {
  return clampService({
    id,
    envKeys,
    name: formData.get("name"),
    category: formData.get("category"),
    purpose: formData.get("purpose"),
    plan: formData.get("plan"),
    cost: formData.get("cost"),
    billingCycle: formData.get("billingCycle"),
    renewalDate: formData.get("renewalDate"),
    billingEmail: formData.get("billingEmail"),
    dashboardUrl: formData.get("dashboardUrl"),
    usageUrl: formData.get("usageUrl"),
    notes: formData.get("notes"),
  });
}

export async function saveServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const catalog = getServiceCatalog();
  const index = catalog.services.findIndex((service) => service.id === id);
  if (index < 0) return;
  const entry = entryFromForm(formData, id, catalog.services[index].envKeys);
  if (!entry) return;
  catalog.services[index] = entry;
  saveServiceCatalog(catalog);
  revalidatePath("/admin/services");
}

export async function addServiceAction(formData: FormData) {
  await requireAdmin();
  const catalog = getServiceCatalog();
  const base = slugify(String(formData.get("name") ?? ""));
  if (!base) return;
  let id = base;
  for (let n = 2; catalog.services.some((service) => service.id === id); n += 1) id = `${base}-${n}`;
  const entry = entryFromForm(formData, id, []);
  if (!entry) return;
  catalog.services.push(entry);
  saveServiceCatalog(catalog);
  revalidatePath("/admin/services");
}

export async function deleteServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (formData.get("confirm") !== "yes") return;
  const catalog = getServiceCatalog();
  const services = catalog.services.filter((service) => service.id !== id);
  if (services.length === catalog.services.length) return;
  saveServiceCatalog({ services });
  revalidatePath("/admin/services");
}
