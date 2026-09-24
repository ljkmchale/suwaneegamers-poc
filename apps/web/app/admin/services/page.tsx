import { ExternalLink, KeyRound, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/adminAuth";
import {
  BILLING_CYCLES,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  daysUntil,
  monthlyEquivalent,
  summarizeCosts,
  type ServiceCategory,
  type ServiceEntry,
} from "@/lib/serviceCosts";
import { configuredKeyMap, getServiceCatalog } from "@/lib/serviceCostStore";
import { addServiceAction, deleteServiceAction, saveServiceAction } from "./actions";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const CYCLE_LABELS: Record<string, string> = {
  usage: "per month (usage)",
  monthly: "per month",
  yearly: "per year",
  free: "free",
};

const CATEGORY_HINTS: Record<ServiceCategory, string> = {
  usage: "Billed per use — these can grow without anyone noticing. Set spend limits in each console.",
  subscription: "Fixed plans, domains, and hosting.",
  dev: "What it costs to build and maintain the site, not to run it.",
  free: "No bill today, but tracked so nothing surprises you.",
  dormant: "Wired up but switched off or retired.",
};

const inputClass =
  "w-full rounded border border-[#2a2a35] bg-[#08050f] px-2.5 py-1.5 text-sm text-[#e8dfc8] placeholder:text-[#4a4050] focus:border-[#8b5cf6] focus:outline-none";
const labelClass = "block text-[11px] uppercase tracking-wider text-[#7a6f85]";

function costLabel(entry: ServiceEntry) {
  if (entry.billingCycle === "free") return "Free";
  if (entry.cost === null) return "Not entered";
  return `${usd.format(entry.cost)} ${CYCLE_LABELS[entry.billingCycle]}`;
}

function RenewalBadge({ date, today }: { date: string; today: Date }) {
  const days = daysUntil(date, today);
  if (days === null) return null;
  const tone =
    days < 0
      ? "border-red-900 bg-red-950/40 text-red-300"
      : days <= 30
        ? "border-amber-800 bg-amber-950/40 text-amber-300"
        : "border-[#2a2a35] text-[#9080a0]";
  const text = days < 0 ? `renewal passed ${date}` : days === 0 ? "renews today" : `renews in ${days}d`;
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}>{text}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function ServiceFields({ entry }: { entry?: ServiceEntry }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Name">
        <input name="name" required defaultValue={entry?.name} className={inputClass} />
      </Field>
      <Field label="Category">
        <select name="category" defaultValue={entry?.category ?? "subscription"} className={inputClass}>
          {CATEGORY_ORDER.map((category) => (
            <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
          ))}
        </select>
      </Field>
      <Field label="Plan">
        <input name="plan" defaultValue={entry?.plan} placeholder="e.g. Starter" className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cost (USD)">
          <input name="cost" inputMode="decimal" defaultValue={entry?.cost ?? ""} placeholder="0.00" className={inputClass} />
        </Field>
        <Field label="Billed">
          <select name="billingCycle" defaultValue={entry?.billingCycle ?? "monthly"} className={inputClass}>
            {BILLING_CYCLES.map((cycle) => (
              <option key={cycle} value={cycle}>{CYCLE_LABELS[cycle]}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Next renewal">
        <input type="date" name="renewalDate" defaultValue={entry?.renewalDate} className={inputClass} />
      </Field>
      <Field label="Billing email">
        <input name="billingEmail" defaultValue={entry?.billingEmail} placeholder="who gets the invoice" className={inputClass} />
      </Field>
      <Field label="Billing / cancel URL">
        <input name="dashboardUrl" type="url" defaultValue={entry?.dashboardUrl} placeholder="https://" className={inputClass} />
      </Field>
      <Field label="Usage URL">
        <input name="usageUrl" type="url" defaultValue={entry?.usageUrl} placeholder="https://" className={inputClass} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="What it's used for">
          <input name="purpose" defaultValue={entry?.purpose} className={inputClass} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Notes">
          <textarea name="notes" rows={2} defaultValue={entry?.notes} className={inputClass} />
        </Field>
      </div>
    </div>
  );
}

function ServiceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded border border-[#2a2a35] px-2 py-1 text-xs text-[#a89880] transition-colors hover:border-[#8b5cf6] hover:text-[#f59e0b]"
    >
      <ExternalLink size={12} aria-hidden="true" />
      {label}
    </a>
  );
}

function ServiceLinks({ entry }: { entry: ServiceEntry }) {
  const showUsage = entry.usageUrl && entry.usageUrl !== entry.dashboardUrl;
  if (!entry.dashboardUrl && !showUsage) return null;
  return (
    <div className="flex basis-full flex-wrap gap-2">
      {entry.dashboardUrl && (
        <ServiceLink
          href={entry.dashboardUrl}
          label={entry.category === "free" ? "Account / site" : "Billing / cancel"}
        />
      )}
      {showUsage && <ServiceLink href={entry.usageUrl} label="Usage" />}
    </div>
  );
}

function ServiceCard({
  entry,
  keyStatus,
  today,
}: {
  entry: ServiceEntry;
  keyStatus: Map<string, boolean>;
  today: Date;
}) {
  const monthly = monthlyEquivalent(entry);
  return (
    <li>
      <details className="group rounded-lg border border-[#2a2a35] bg-[#0f0a1a]">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 p-4 [&::-webkit-details-marker]:hidden">
          <span className="font-medium text-[#e8dfc8]">{entry.name}</span>
          {entry.plan && <span className="text-xs text-[#7a6f85]">{entry.plan}</span>}
          <RenewalBadge date={entry.renewalDate} today={today} />
          <span className="ml-auto text-right text-sm">
            <span className={entry.cost === null && entry.billingCycle !== "free" ? "text-[#5a5060] italic" : "text-[#e8dfc8]"}>
              {costLabel(entry)}
            </span>
            {entry.billingCycle === "yearly" && monthly > 0 && (
              <span className="block text-[11px] text-[#7a6f85]">≈ {usd.format(monthly)}/mo</span>
            )}
          </span>
          {entry.purpose && <p className="basis-full text-xs leading-relaxed text-[#9080a0]">{entry.purpose}</p>}
          <ServiceLinks entry={entry} />
          {entry.envKeys.length > 0 && (
            <div className="flex basis-full flex-wrap gap-1.5">
              {entry.envKeys.map((key) => {
                const set = keyStatus.get(key);
                return (
                  <span
                    key={key}
                    title={set ? "Key is set on this server" : "Key not found on this server"}
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] ${set ? "border-emerald-900 text-emerald-300" : "border-[#2a2a35] text-[#5a5060]"}`}
                  >
                    <KeyRound size={10} aria-hidden="true" />
                    {key}
                  </span>
                );
              })}
            </div>
          )}
        </summary>

        <div className="space-y-4 border-t border-[#21182e] p-4">
          {entry.notes && <p className="text-xs text-[#a89880]">{entry.notes}</p>}
          <form action={saveServiceAction} className="space-y-3">
            <input type="hidden" name="id" value={entry.id} />
            <ServiceFields entry={entry} />
            <button
              type="submit"
              className="rounded border border-[#8b5cf6] bg-[#16161e] px-3 py-1.5 text-xs text-[#e8dfc8] transition-colors hover:text-[#f59e0b]"
            >
              Save
            </button>
          </form>
          <form action={deleteServiceAction} className="flex flex-wrap items-center gap-3 border-t border-[#21182e] pt-3 text-xs">
            <input type="hidden" name="id" value={entry.id} />
            <label className="inline-flex items-center gap-1.5 text-[#7a6f85]">
              <input type="checkbox" name="confirm" value="yes" required />
              Remove this service from the tracker
            </label>
            <button type="submit" className="rounded border border-[#2a2a35] px-2.5 py-1 text-[#a89880] hover:border-red-800 hover:text-red-300">
              Remove
            </button>
          </form>
        </div>
      </details>
    </li>
  );
}

export default async function AdminServicesPage() {
  await requireAdmin();
  const { services } = getServiceCatalog();
  const keyStatus = configuredKeyMap(services);
  const summary = summarizeCosts(services);
  const today = new Date();
  const nextRenewal = services
    .map((entry) => ({ entry, days: daysUntil(entry.renewalDate, today) }))
    .filter((item): item is { entry: ServiceEntry; days: number } => item.days !== null && item.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  const stats = [
    { label: "Monthly (known)", value: usd.format(summary.monthlyTotal) },
    { label: "Yearly (known)", value: usd.format(summary.yearlyTotal) },
    { label: "Paid, cost not entered", value: String(summary.unpricedCount) },
    {
      label: "Next renewal",
      value: nextRenewal ? `${nextRenewal.entry.name} · ${nextRenewal.entry.renewalDate}` : "None set",
    },
  ];

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="font-cinzel text-2xl text-[#e8dfc8]">Services &amp; Costs</h1>
        <p className="mt-1 text-sm text-[#7a6f85]">
          Every outside service the site connects to and what it costs. Click a service to fill in its plan,
          price, and renewal date. Yearly plans count toward the monthly total at one-twelfth.
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
        {CATEGORY_ORDER.map((category) => {
          const entries = services.filter((entry) => entry.category === category);
          if (entries.length === 0) return null;
          return (
            <section key={category}>
              <h2 className="font-cinzel text-lg text-[#e8dfc8]">{CATEGORY_LABELS[category]}</h2>
              <p className="mb-3 text-xs text-[#7a6f85]">{CATEGORY_HINTS[category]}</p>
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <ServiceCard key={entry.id} entry={entry} keyStatus={keyStatus} today={today} />
                ))}
              </ul>
            </section>
          );
        })}

        <section>
          <details className="rounded-lg border border-dashed border-[#2a2a35] bg-[#0f0a1a]">
            <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm text-[#a89880] hover:text-[#f59e0b] [&::-webkit-details-marker]:hidden">
              <Plus size={15} aria-hidden="true" />
              Add a service
            </summary>
            <form action={addServiceAction} className="space-y-3 border-t border-[#21182e] p-4">
              <ServiceFields />
              <button
                type="submit"
                className="rounded border border-[#8b5cf6] bg-[#16161e] px-3 py-1.5 text-xs text-[#e8dfc8] transition-colors hover:text-[#f59e0b]"
              >
                Add service
              </button>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
