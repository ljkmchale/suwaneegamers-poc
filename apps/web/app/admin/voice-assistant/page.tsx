import Link from "next/link";
import { MessageCircleQuestion, Mic2 } from "lucide-react";
import { getVoiceAnalytics } from "@/lib/voiceAnalytics";

export const dynamic = "force-dynamic";

function milliseconds(value: number) {
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(1)}s`;
}

function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function HorizontalBars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-[#6a5a78]">Activity will appear here as the assistant is used.</p>;
  }
  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1.5 flex items-end justify-between gap-4 text-xs">
            <span className="min-w-0 truncate text-[#c8bda8]" title={row.label}>{row.label}</span>
            <span className="shrink-0 text-[#9080a0]">{row.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#08050f]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-[#f59e0b]"
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface VoiceAssistantPageProps {
  searchParams?: Promise<{ days?: string }>;
}

export default async function VoiceAssistantPage({ searchParams }: VoiceAssistantPageProps) {
  const params = await searchParams;
  const requestedDays = Number(params?.days ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const voice = getVoiceAnalytics(days);

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Mic2 className="text-violet-300" size={28} aria-hidden="true" />
          <div>
            <h1 className="font-cinzel text-3xl uppercase tracking-widest">Voice Assistant</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#a89880]">
              Understand how members use the assistant, how quickly she responds, and which capabilities to add next.
            </p>
          </div>
        </div>
        <div className="mt-5 inline-flex rounded-lg border border-[#2a2a35] bg-[#08050f] p-1">
          {[7, 30, 90].map((range) => (
            <Link
              key={range}
              href={`/admin/voice-assistant?days=${range}`}
              className={`rounded-md px-4 py-2 font-cinzel text-[10px] uppercase tracking-widest ${
                days === range ? "bg-[#8b5cf6] text-white" : "text-[#9080a0] hover:text-[#e8dfc8]"
              }`}
            >
              {range} days
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ["Sessions", voice.summary.sessions],
          ["Members", voice.summary.users],
          ["Questions", voice.summary.questions],
          ["Avg. response", milliseconds(voice.summary.averageResponseMs)],
          ["Slowest", milliseconds(voice.summary.slowestResponseMs)],
          ["Avg. session", duration(voice.summary.averageDurationSeconds)],
          ["Errors", voice.summary.errors],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
            <p className="text-[10px] uppercase tracking-widest text-[#6a5a78]">{label}</p>
            <p className="mt-3 font-cinzel text-2xl text-violet-300">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <h2 className="mb-4 flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
            <MessageCircleQuestion size={17} className="text-violet-300" aria-hidden="true" />
            Question types
          </h2>
          <HorizontalBars rows={voice.categories} />
        </section>
        <section className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
          <h2 className="mb-4 font-cinzel text-sm uppercase tracking-widest">Capability gaps to review</h2>
          <HorizontalBars rows={voice.unsupported} />
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-[#2a2a35] bg-[#0f0a1a]">
        <div className="border-b border-[#2a2a35] px-5 py-4">
          <h2 className="font-cinzel text-sm uppercase tracking-widest">Recent recognized questions</h2>
          <p className="mt-1 text-xs text-[#6a5a78]">Question text and answers are available only within the admin area.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <tr>
                <th className="px-5 py-3 font-normal">Asked</th>
                <th className="px-5 py-3 font-normal">Member</th>
                <th className="px-5 py-3 font-normal">Question and answer</th>
                <th className="px-5 py-3 font-normal">Type</th>
                <th className="px-5 py-3 text-right font-normal">Response</th>
              </tr>
            </thead>
            <tbody>
              {voice.recentQuestions.map((question) => (
                <tr key={question.id} className="border-t border-[#201927] align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-[#9080a0]">{dateTime(question.askedAt)}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-[#c8bda8]">{question.member}</td>
                  <td className="min-w-[24rem] px-5 py-3">
                    <p className="text-[#e8dfc8]">“{question.question}”</p>
                    <p className="mt-1 text-[#6a5a78]">{question.answer ?? question.errorMessage ?? "No answer recorded"}</p>
                  </td>
                  <td className="px-5 py-3 capitalize text-violet-300">{question.category.replaceAll("_", " ")}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right text-[#a89880]">{milliseconds(question.responseMs)}</td>
                </tr>
              ))}
              {voice.recentQuestions.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-[#6a5a78]">No voice questions have been recorded in this period.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
