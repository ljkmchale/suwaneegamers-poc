import Link from "next/link";
import { ArrowLeft, Receipt, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/adminAuth";
import {
  monthKey,
  recentMonths,
  regularChargesDue,
  summarizeCosts,
  totalsByMonth,
} from "@/lib/serviceCosts";
import { getServiceCatalog } from "@/lib/serviceCostStore";
import { listServicePayments, type ServicePayment } from "@/lib/servicePayments";
import { deletePaymentAction, logPaymentAction, logRegularChargesAction } from "./actions";

export const dynamic = "force-dynamic";

const MONTHS_SHOWN = 12;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cents = (value: number) => usd.format(value / 100);

const inputClass =
  "w-full rounded border border-[#2a2a35] bg-[#08050f] px-2.5 py-1.5 text-sm text-[#e8dfc8] placeholder:text-[#4a4050] focus:border-[#8b5cf6] focus:outline-none";
const labelClass = "block text-[11px] uppercase tracking-wider text-[#7a6f85]";
const buttonClass =
  "rounded border border-[#8b5cf6] bg-[#16161e] px-3 py-1.5 text-xs text-[#e8dfc8] transition-colors hover:text-[#f59e0b]";

function monthLabel(month: string) {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, index - 1, 1));
}

function PaymentRow({ payment }: { payment: ServicePayment }) {
  return (
    <tr className="border-t border-[#21182e]">
      <td className="py-2 pr-3 text-[#9080a0]">{payment.paidOn}</td>
      <td className="py-2 pr-3 text-[#e8dfc8]">{payment.serviceName}</td>
      <td className="py-2 pr-3 text-xs text-[#7a6f85]">{payment.note}</td>
      <td className="py-2 pr-3 text-right text-[#e8dfc8]">{cents(payment.amountCents)}</td>
      <td className="py-2 text-right">
        <form action={deletePaymentAction}>
          <input type="hidden" name="id" value={payment.id} />
          <button
            type="submit"
            aria-label={`Delete ${payment.serviceName} payment on ${payment.paidOn}`}
            className="rounded p-1 text-[#5a5060] hover:text-red-300"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </form>
      </td>
    </tr>
  );
}

export default async function ServicePaymentsPage() {
  await requireAdmin();
  const now = new Date();
  const todayIso = `${monthKey(now)}-${String(now.getDate()).padStart(2, "0")}`;
  const months = recentMonths(now, MONTHS_SHOWN);
  const currentMonth = months[0];
  const payments = listServicePayments(`${months[months.length - 1]}-01`);
  const monthTotals = totalsByMonth(payments, months);
  const { services } = getServiceCatalog();
  const planMonthly = summarizeCosts(services).monthlyTotal;
  const loggedThisMonth = new Set(
    payments.filter((payment) => payment.paidOn.startsWith(currentMonth)).map((payment) => payment.serviceId),
  );
  const due = regularChargesDue(services, currentMonth, loggedThisMonth);
  const yearTotal = monthTotals.reduce((sum, month) => sum + month.totalCents, 0);

  const byService = new Map<string, { name: string; totalCents: number; count: number }>();
  for (const payment of payments) {
    const row = byService.get(payment.serviceId) ?? { name: payment.serviceName, totalCents: 0, count: 0 };
    row.totalCents += payment.amountCents;
    row.count += 1;
    byService.set(payment.serviceId, row);
  }
  const serviceTotals = [...byService.values()].sort((a, b) => b.totalCents - a.totalCents);

  const stats = [
    { label: "Paid this month", value: cents(monthTotals[0].totalCents) },
    { label: "Last month", value: cents(monthTotals[1].totalCents) },
    { label: `Last ${MONTHS_SHOWN} months`, value: cents(yearTotal) },
    { label: "Plan prices / month", value: usd.format(planMonthly) },
  ];

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <Link
          href="/admin/services"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-[#a89880] hover:text-[#f59e0b]"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          Services &amp; Costs
        </Link>
        <h1 className="font-cinzel text-2xl text-[#e8dfc8]">Payment Log</h1>
        <p className="mt-1 text-sm text-[#7a6f85]">
          What was actually charged, month by month. Compare it with the plan prices on Services &amp; Costs to
          catch overages, price changes, and forgotten renewals.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-4 py-3">
              <dt className={labelClass}>{stat.label}</dt>
              <dd className="mt-1 text-lg text-[#e8dfc8]">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="space-y-8">
        <section className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
          <h2 className="font-cinzel text-lg text-[#e8dfc8]">Regular charges for {monthLabel(currentMonth)}</h2>
          {due.length === 0 ? (
            <p className="mt-1 text-sm text-[#7a6f85]">Every regular charge for this month is logged.</p>
          ) : (
            <>
              <p className="mt-1 text-sm text-[#7a6f85]">Not logged yet:</p>
              <ul className="mt-2 space-y-1 text-sm">
                {due.map((entry) => (
                  <li key={entry.id} className="flex justify-between gap-4 text-[#e8dfc8]">
                    <span>{entry.name}</span>
                    <span>{usd.format(entry.cost ?? 0)}</span>
                  </li>
                ))}
              </ul>
              <form action={logRegularChargesAction} className="mt-3">
                <button type="submit" className={buttonClass}>
                  Log these at plan price, dated today
                </button>
              </form>
              <p className="mt-2 text-xs text-[#5a5060]">
                If a bill came in different, log it by hand below instead. Prepaid top-ups (like Anthropic credit)
                are always logged by hand.
              </p>
            </>
          )}
        </section>

        <section className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a] p-4">
          <h2 className="font-cinzel text-lg text-[#e8dfc8]">Log a payment</h2>
          <form action={logPaymentAction} className="mt-3 grid gap-3 sm:grid-cols-4">
            <label className="space-y-1 sm:col-span-2">
              <span className={labelClass}>Service</span>
              <select name="serviceId" required className={inputClass}>
                {services.map((entry) => (
                  <option key={entry.id} value={entry.id}>{entry.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Date</span>
              <input type="date" name="paidOn" required defaultValue={todayIso} className={inputClass} />
            </label>
            <label className="space-y-1">
              <span className={labelClass}>Amount (USD)</span>
              <input name="amount" required inputMode="decimal" placeholder="0.00" className={inputClass} />
            </label>
            <label className="space-y-1 sm:col-span-3">
              <span className={labelClass}>Note</span>
              <input name="note" placeholder="e.g. credit top-up, overage, annual renewal" className={inputClass} />
            </label>
            <div className="flex items-end">
              <button type="submit" className={`${buttonClass} w-full`}>Log payment</button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="mb-3 font-cinzel text-lg text-[#e8dfc8]">By month</h2>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2a2a35] py-12 text-center text-[#5a5060]">
              <Receipt size={28} aria-hidden="true" />
              <p className="text-sm">No payments logged yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {monthTotals.map((month) => {
                const rows = payments.filter((payment) => payment.paidOn.startsWith(month.month));
                return (
                  <li key={month.month}>
                    <details
                      open={month.month === currentMonth || undefined}
                      className="rounded-lg border border-[#2a2a35] bg-[#0f0a1a]"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                        <span className="text-[#e8dfc8]">{monthLabel(month.month)}</span>
                        <span className="text-xs text-[#7a6f85]">
                          {month.count} {month.count === 1 ? "payment" : "payments"}
                        </span>
                        <span className="ml-auto text-[#e8dfc8]">{cents(month.totalCents)}</span>
                      </summary>
                      {rows.length > 0 && (
                        <div className="overflow-x-auto border-t border-[#21182e] px-4 pb-2">
                          <table className="w-full text-sm">
                            <tbody>
                              {rows.map((payment) => (
                                <PaymentRow key={payment.id} payment={payment} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {serviceTotals.length > 0 && (
          <section>
            <h2 className="mb-3 font-cinzel text-lg text-[#e8dfc8]">By service, last {MONTHS_SHOWN} months</h2>
            <div className="overflow-x-auto rounded-lg border border-[#2a2a35] bg-[#0f0a1a] px-4">
              <table className="w-full text-sm">
                <tbody>
                  {serviceTotals.map((row) => (
                    <tr key={row.name} className="border-t border-[#21182e] first:border-t-0">
                      <td className="py-2 pr-3 text-[#e8dfc8]">{row.name}</td>
                      <td className="py-2 pr-3 text-xs text-[#7a6f85]">
                        {row.count} {row.count === 1 ? "payment" : "payments"}
                      </td>
                      <td className="py-2 text-right text-[#e8dfc8]">{cents(row.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
