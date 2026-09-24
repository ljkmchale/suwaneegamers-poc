import "server-only";

import { getDb } from "@/lib/db";
import { isIsoDate } from "@/lib/serviceCosts";

// The monthly payment log behind /admin/services/payments: what was actually
// charged, as opposed to the plan prices in content/service-costs.json.

export type ServicePayment = {
  id: number;
  serviceId: string;
  serviceName: string;
  paidOn: string;
  amountCents: number;
  note: string | null;
  createdAt: string;
};

type PaymentRow = {
  id: number;
  service_id: string;
  service_name: string;
  paid_on: string;
  amount_cents: number;
  note: string | null;
  created_at: string;
};

function toPayment(row: PaymentRow): ServicePayment {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    paidOn: row.paid_on,
    amountCents: row.amount_cents,
    note: row.note,
    createdAt: row.created_at,
  };
}

function clean(value: unknown, length: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, length) : "";
}

export type NewPayment = {
  serviceId: string;
  serviceName: string;
  paidOn: string;
  amountCents: number;
  note?: string;
};

export function recordServicePayments(payments: NewPayment[]): number {
  const valid = payments
    .map((payment) => ({
      serviceId: clean(payment.serviceId, 60),
      serviceName: clean(payment.serviceName, 120),
      paidOn: payment.paidOn,
      amountCents: payment.amountCents,
      note: clean(payment.note, 300) || null,
    }))
    .filter(
      (payment) =>
        payment.serviceId &&
        payment.serviceName &&
        isIsoDate(payment.paidOn) &&
        Number.isInteger(payment.amountCents) &&
        payment.amountCents >= 0,
    );
  if (valid.length === 0) return 0;
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO service_payments (service_id, service_name, paid_on, amount_cents, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const now = new Date().toISOString();
  db.transaction(() => {
    for (const payment of valid) {
      insert.run(payment.serviceId, payment.serviceName, payment.paidOn, payment.amountCents, payment.note, now);
    }
  })();
  return valid.length;
}

/** Payments on or after `sinceDate` (YYYY-MM-DD), newest first. */
export function listServicePayments(sinceDate: string): ServicePayment[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM service_payments WHERE paid_on >= ? ORDER BY paid_on DESC, id DESC`,
    )
    .all(sinceDate) as PaymentRow[];
  return rows.map(toPayment);
}

export function deleteServicePayment(id: number): void {
  getDb().prepare(`DELETE FROM service_payments WHERE id = ?`).run(id);
}
