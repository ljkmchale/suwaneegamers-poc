"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminAuth";
import { isIsoDate, monthKey, parseCents, regularChargesDue } from "@/lib/serviceCosts";
import { getServiceCatalog } from "@/lib/serviceCostStore";
import { deleteServicePayment, listServicePayments, recordServicePayments } from "@/lib/servicePayments";

function today(): string {
  const now = new Date();
  return `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
}

export async function logPaymentAction(formData: FormData) {
  await requireAdmin();
  const serviceId = String(formData.get("serviceId") ?? "");
  const service = getServiceCatalog().services.find((entry) => entry.id === serviceId);
  const amountCents = parseCents(formData.get("amount"));
  const paidOn = String(formData.get("paidOn") ?? "");
  if (!service || amountCents === null || !isIsoDate(paidOn)) return;
  recordServicePayments([
    {
      serviceId: service.id,
      serviceName: service.name,
      paidOn,
      amountCents,
      note: String(formData.get("note") ?? ""),
    },
  ]);
  revalidatePath("/admin/services/payments");
}

/** One click: log every regular charge due this month that isn't logged yet. */
export async function logRegularChargesAction() {
  await requireAdmin();
  const paidOn = today();
  const month = paidOn.slice(0, 7);
  const logged = new Set(listServicePayments(`${month}-01`).map((payment) => payment.serviceId));
  const due = regularChargesDue(getServiceCatalog().services, month, logged);
  recordServicePayments(
    due.map((entry) => ({
      serviceId: entry.id,
      serviceName: entry.name,
      paidOn,
      amountCents: Math.round((entry.cost ?? 0) * 100),
      note: "Regular charge at plan price",
    })),
  );
  revalidatePath("/admin/services/payments");
}

export async function deletePaymentAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  deleteServicePayment(id);
  revalidatePath("/admin/services/payments");
}
