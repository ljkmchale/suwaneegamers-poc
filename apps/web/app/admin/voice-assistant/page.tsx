import Link from "next/link";
import {
  Coins,
  GraduationCap,
  HelpCircle,
  MessageCircleQuestion,
  Mic2,
  SlidersHorizontal,
  SpellCheck2,
  Theater,
  Wrench,
} from "lucide-react";
import { getVoiceAnalytics } from "@/lib/voiceAnalytics";
import { getClaudePlatformUsage } from "@/lib/voiceMetrics";
import { readAssistantTuning } from "@/lib/assistantTuningStore";
import { readLearned } from "@/lib/assistantLearned";
import { readAssistantPersonas } from "@/lib/assistantPersonaStore";
import {
  personasUsingVoice,
  resolvePersona,
  voiceLabel,
  VOICE_OPTIONS,
} from "@/lib/assistantPersonas";
import { listUserProfiles } from "@/lib/userProfiles";
import { getPlayerProfileSeeds } from "@/lib/players";
import { readRemediationAudit, readRemediations } from "@/lib/assistantRemediation";
import { RemediationPanel } from "@/components/admin/RemediationPanel";
import { VoiceAudition, type AuditionVoice } from "@/components/admin/VoiceAudition";
import {
  forgetQuestionAction,
  approveRemediationAction,
  dismissRemediationAction,
  setMemberPersonaAction,
  setRosterPersonaAction,
} from "./actions";

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

function tokenCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dollars(value: number) {
  if (value === 0) return "$0.0000";
  return value < 0.01 ? `$${value.toFixed(4)}` : `$${value.toFixed(2)}`;
}

function HorizontalBars({ rows }: { rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) {
    return <p className="py-10 text-center text-sm text-[#6a5a78]">Activity will appear here as Myra is used.</p>;
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

interface TuningKnob {
  label: string;
  value: string;
  hint: string;
  auto: boolean;
}

function TuningCard({ knob }: { knob: TuningKnob }) {
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-widest text-[#6a5a78]">{knob.label}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-widest ${
            knob.auto
              ? "bg-[#1c1330] text-violet-300"
              : "border border-[#2a2a35] text-[#6a5a78]"
          }`}
          title={
            knob.auto
              ? "Adjusted nightly by the autotuner"
              : "Manual knob — the autotuner does not change this"
          }
        >
          {knob.auto ? "auto" : "manual"}
        </span>
      </div>
      <p className="mt-3 font-cinzel text-2xl text-violet-300">{knob.value}</p>
      <p className="mt-2 text-xs leading-relaxed text-[#6a5a78]">{knob.hint}</p>
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
  const claude = await getClaudePlatformUsage(days);
  const tuning = readAssistantTuning();
  const learned = readLearned();
  const remediationStore = readRemediations();
  const remediationQueue = remediationStore.entries.filter((entry) => entry.status === "pending");
  const remediationAudit = readRemediationAudit();
  const personaCatalog = readAssistantPersonas();
  // Every signed-in member with the persona they will actually hear, whether it
  // was chosen, matched from the roster, or the house default.
  const members = listUserProfiles().map((profile) => ({
    profile,
    ...resolvePersona(personaCatalog, {
      personaId: profile.myraPersona,
      playerName: profile.playerName,
      displayName: profile.displayName,
    }),
  }));
  // Roster players who have never signed in have no profile row to assign, but
  // they still need a voice waiting for them — that is what matchPlayers is for.
  const signedInNames = new Set(
    members.flatMap(({ profile }) =>
      [profile.playerName, profile.displayName]
        .filter(Boolean)
        .map((name) => name!.trim().toLowerCase()),
    ),
  );
  const rosterOnly = getPlayerProfileSeeds()
    .filter((player) => !signedInNames.has(player.name.trim().toLowerCase()))
    .map((player) => ({
      name: player.name,
      ...resolvePersona(personaCatalog, { playerName: player.name }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const auditionVoices: AuditionVoice[] = VOICE_OPTIONS.map((voice) => {
    const inUse = personasUsingVoice(personaCatalog, voice.id);
    return {
      id: voice.id,
      label: voice.label,
      // Group the grid the way someone shops for a voice: accent, then register.
      accent: `${voice.accent} · ${voice.voiceOf}`,
      usedBy: inUse.map((persona) => persona.label),
      personaId: inUse[0]?.id,
      speed: inUse[0]?.speed ?? 1,
    };
  });
  const topLearned = [...learned.answers].sort((a, b) => b.timesAsked - a.timesAsked).slice(0, 8);
  const topGaps = [...learned.gaps].sort((a, b) => b.timesAsked - a.timesAsked).slice(0, 8);

  // Which knobs the nightly autotuner actually moves (see lib/assistantTuning.ts).
  const tuningKnobs: TuningKnob[] = [
    {
      label: "Reply delay",
      value: `${tuning.minEndpointingDelay}s`,
      hint: "How long she waits after you stop speaking before replying. Lower is snappier.",
      auto: true,
    },
    {
      label: "Interruption guard",
      value: `${tuning.minInterruptionDuration}s`,
      hint: "How long a sound must last before it can interrupt her. Higher ignores more background noise.",
      auto: true,
    },
    {
      label: "Mic sensitivity",
      value: tuning.vadActivationThreshold.toFixed(2),
      hint: "Loudness needed to register as speech (0–1). Higher ignores more room noise.",
      auto: false,
    },
    {
      label: "Interruption words",
      value: String(tuning.minInterruptionWords),
      hint: "Recognized words required before an interruption counts, so noise alone can't cut her off.",
      auto: false,
    },
    {
      label: "Silence window",
      value: `${tuning.vadMinSilence}s`,
      hint: "Silence needed to decide your turn is over.",
      auto: false,
    },
    {
      label: "Max reply wait",
      value: `${tuning.maxEndpointingDelay}s`,
      hint: "Upper bound on how long she waits before answering.",
      auto: false,
    },
    {
      label: "Model temperature",
      value: (Number(process.env.ANTHROPIC_TEMPERATURE) || 0.3).toFixed(2),
      hint: "Claude answer randomness. Lower is more consistent and commits to words sooner.",
      auto: false,
    },
  ];

  return (
    <div className="mx-auto max-w-[96rem]">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Mic2 className="text-violet-300" size={28} aria-hidden="true" />
          <div>
            <h1 className="font-cinzel text-3xl uppercase tracking-widest">Myra</h1>
            <p className="mt-2 max-w-3xl text-sm text-[#a89880]">
              Understand how members use Myra, how quickly she responds, and which capabilities to add next.
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

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
              <Coins size={17} className="text-amber-400" aria-hidden="true" />
              Claude tokens &amp; estimated cost
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#6a5a78]">
              Provider-reported usage for Myra&apos;s Claude requests in this period.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://platform.claude.com/dashboard" target="_blank" rel="noreferrer" className="rounded-full border border-amber-500/30 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300 hover:bg-amber-500/10">Open Claude Platform</a>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
              {claude.summary.requests} Claude requests
            </span>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Input tokens", tokenCount(claude.summary.inputTokens)],
            ["Output tokens", tokenCount(claude.summary.outputTokens)],
            ["Cache reads", tokenCount(claude.summary.cacheReadTokens)],
            ["Cache writes", tokenCount(claude.summary.cacheCreationTokens)],
            ["Estimated cost", dollars(claude.summary.estimatedCostUsd)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[#201927] bg-[#08050f] p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#6a5a78]">{label}</p>
              <p className="mt-2 font-cinzel text-xl text-amber-300">{value}</p>
            </div>
          ))}
        </div>
        {claude.models.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-[#201927]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
                <tr>
                  <th className="px-4 py-3 font-normal">Model</th>
                  <th className="px-4 py-3 text-right font-normal">Requests</th>
                  <th className="px-4 py-3 text-right font-normal">Input</th>
                  <th className="px-4 py-3 text-right font-normal">Output</th>
                  <th className="px-4 py-3 text-right font-normal">Cache read</th>
                  <th className="px-4 py-3 text-right font-normal">Cache write</th>
                  <th className="px-4 py-3 text-right font-normal">Est. cost</th>
                </tr>
              </thead>
              <tbody>
                {claude.models.map((model) => (
                  <tr key={model.model} className="border-t border-[#201927]">
                    <td className="px-4 py-3 text-[#e8dfc8]">{model.model}</td>
                    <td className="px-4 py-3 text-right text-[#a89880]">{model.requests}</td>
                    <td className="px-4 py-3 text-right text-[#a89880]">{tokenCount(model.inputTokens)}</td>
                    <td className="px-4 py-3 text-right text-[#a89880]">{tokenCount(model.outputTokens)}</td>
                    <td className="px-4 py-3 text-right text-[#a89880]">{tokenCount(model.cacheReadTokens)}</td>
                    <td className="px-4 py-3 text-right text-[#a89880]">{tokenCount(model.cacheCreationTokens)}</td>
                    <td className="px-4 py-3 text-right text-amber-300">{dollars(model.estimatedCostUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg border border-[#201927] bg-[#08050f] py-8 text-center text-xs text-[#6a5a78]">
            Claude token usage will appear after Myra answers her next model-assisted question.
          </p>
        )}
        <p className="mt-4 text-[10px] leading-relaxed text-[#5a5060]">
          {claude.message} Request counts remain Myra&apos;s local voice-session counts. Cost is
          estimated from published model rates and excludes taxes, credits, and negotiated pricing.
        </p>
      </section>

      <RemediationPanel entries={remediationQueue} audit={remediationAudit} />

      <section className="hidden">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
              <Wrench size={17} className="text-amber-400" aria-hidden="true" />
              Myra remediation queue
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#6a5a78]">
              Weak answers from the showcase and nightly learning land here with a proposed
              correction and player-safe evidence. Approving a grounded learned answer makes
              it available to Myra; structural approvals record the decision without silently
              rewriting lore or routing code.
            </p>
          </div>
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-widest text-amber-300">
            {remediationQueue.length} pending
          </span>
        </div>
        {remediationQueue.length === 0 ? (
          <p className="rounded-lg border border-[#201927] bg-[#08050f] py-8 text-center text-xs text-[#6a5a78]">
            No weak answers are waiting for review.
          </p>
        ) : (
          <div className="space-y-3">
            {remediationQueue.slice(0, 20).map((entry) => (
              <article key={entry.id} className="rounded-lg border border-[#201927] bg-[#08050f] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#1c1330] px-2 py-0.5 text-[9px] uppercase tracking-widest text-violet-300">
                        {entry.category.replaceAll("-", " ")}
                      </span>
                      <span className="text-[10px] text-[#5a5060]">
                        {entry.source.replaceAll("-", " ")} · seen {entry.timesSeen}×
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#e8dfc8]">“{entry.question}”</p>
                    <p className="mt-2 text-xs leading-relaxed text-[#a89880]">
                      <span className="text-[#6a5a78]">Proposed correction: </span>
                      {entry.proposedCorrection}
                    </p>
                    {entry.answerCandidate ? (
                      <p className="mt-2 rounded-md border border-[#201927] bg-[#0f0a1a] p-3 text-xs leading-relaxed text-[#c8bda8]">
                        {entry.answerCandidate}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-[#5a5060]">
                      Evidence: {entry.evidence.length > 0 ? entry.evidence.join(" · ") : "No grounded source yet"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={approveRemediationAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-emerald-600 px-3 py-2 text-[10px] uppercase tracking-widest text-white hover:bg-emerald-500"
                      >
                        Approve
                      </button>
                    </form>
                    <form action={dismissRemediationAction}>
                      <input type="hidden" name="id" value={entry.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-[#2a2a35] px-3 py-2 text-[10px] uppercase tracking-widest text-[#9080a0] hover:border-red-400 hover:text-red-300"
                      >
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
            <SlidersHorizontal size={17} className="text-violet-300" aria-hidden="true" />
            Assistant tuning
          </h2>
          <p className="text-xs text-[#6a5a78]">
            {tuning.updatedBy === "autotune"
              ? "Last adjusted by the nightly autotuner"
              : tuning.updatedBy === "manual"
                ? "Last set manually"
                : "Using default values"}
            {tuning.updatedAt ? ` · ${dateTime(tuning.updatedAt)}` : ""}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tuningKnobs.map((knob) => (
            <TuningCard key={knob.label} knob={knob} />
          ))}
        </div>
        {tuning.note ? (
          <p className="mt-4 border-t border-[#201927] pt-4 text-xs italic text-[#9080a0]">
            Autotuner note: {tuning.note}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-[#6a5a78]">
          Values are read live from <code className="text-[#9080a0]">assistant-tuning.json</code> and
          shipped to Myra each session. <span className="text-violet-300">Auto</span> knobs
          are nudged nightly within safe bounds; manual knobs change only when edited.
        </p>
      </section>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
            <Theater size={17} className="text-violet-300" aria-hidden="true" />
            Voices &amp; personalities
          </h2>
          <p className="text-xs text-[#6a5a78]">
            {personaCatalog.personas.length} personas · from{" "}
            <code className="text-[#9080a0]">assistant-personas.json</code>
          </p>
        </div>
        <p className="mb-5 max-w-3xl text-xs leading-relaxed text-[#6a5a78]">
          A persona changes only how Myra sounds and talks — her knowledge, grounding, and
          limits are identical for everyone. Members can change their own choice on their
          profile page; whoever saves last wins. Leave a member on{" "}
          <span className="text-[#9080a0]">Automatic</span> to use the roster match, then the
          house default. Roster players who have never signed in are listed too — assigning
          one stores the choice by name, so it is waiting for them the first time they sign in.
        </p>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {personaCatalog.personas.map((persona) => (
            <div key={persona.id} className="rounded-xl border border-[#201927] bg-[#08050f] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-cinzel text-sm text-[#e8dfc8]">{persona.label}</p>
                {persona.id === personaCatalog.defaultPersonaId ? (
                  <span className="shrink-0 rounded-full bg-[#1c1330] px-2 py-0.5 text-[9px] uppercase tracking-widest text-violet-300">
                    default
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#6a5a78]">{persona.description}</p>
              <p className="mt-3 text-[10px] uppercase tracking-widest text-[#5a5060]">
                {voiceLabel(persona.voice)} · {persona.speed.toFixed(2)}×
              </p>
              {persona.matchPlayers.length > 0 ? (
                <p className="mt-2 text-[10px] text-[#5a5060]">
                  auto for {persona.matchPlayers.join(", ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mb-6 rounded-lg border border-[#201927] bg-[#08050f] p-4">
          <VoiceAudition voices={auditionVoices} />
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#201927]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#08050f] text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <tr>
                <th className="px-4 py-3 font-normal">Member</th>
                <th className="px-4 py-3 font-normal">Roster player</th>
                <th className="px-4 py-3 font-normal">Hears</th>
                <th className="px-4 py-3 font-normal">Assign</th>
              </tr>
            </thead>
            <tbody>
              {members.map(({ profile, persona, source }) => (
                <tr key={profile.id} className="border-t border-[#201927] align-middle">
                  <td className="px-4 py-3">
                    <p className="text-[#e8dfc8]">{profile.displayName}</p>
                    <p className="text-[10px] text-[#5a5060]">{profile.email}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#9080a0]">
                    {profile.playerName ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-violet-300">{persona.label}</p>
                    <p className="text-[10px] text-[#5a5060]">
                      {voiceLabel(persona.voice)}
                      {source === "chosen"
                        ? " · assigned"
                        : source === "match"
                          ? " · roster match"
                          : " · default"}
                      {profile.myraEnabled ? "" : " · Myra off"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <form action={setMemberPersonaAction} className="flex items-center gap-2">
                      <input type="hidden" name="profileId" value={profile.id} />
                      <select
                        // React only applies defaultValue when an element mounts,
                        // and it resets uncontrolled fields after a server action.
                        // Without a key tied to the saved value, the select would
                        // snap back to its page-load value after every save.
                        key={`${profile.id}-${profile.myraPersona ?? "auto"}`}
                        name="personaId"
                        defaultValue={profile.myraPersona ?? ""}
                        aria-label={`Persona for ${profile.displayName}`}
                        className="rounded-md border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8]"
                      >
                        <option value="">
                          {source === "chosen"
                            ? "Automatic"
                            : `Automatic — ${persona.label}`}
                        </option>
                        {personaCatalog.personas.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-[#2a2a35] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#9080a0] transition-colors hover:border-violet-400 hover:text-[#e8dfc8]"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {rosterOnly.map(({ name, persona, source }) => (
                <tr key={`roster-${name}`} className="border-t border-[#201927] align-middle">
                  <td className="px-4 py-3">
                    <p className="text-[#c8bda8]">{name}</p>
                    <p className="text-[10px] text-[#5a5060]">has not signed in yet</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#9080a0]">{name}</td>
                  <td className="px-4 py-3">
                    <p className="text-violet-300">{persona.label}</p>
                    <p className="text-[10px] text-[#5a5060]">
                      {voiceLabel(persona.voice)}
                      {source === "match" ? " · roster match" : " · default"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <form action={setRosterPersonaAction} className="flex items-center gap-2">
                      <input type="hidden" name="playerName" value={name} />
                      <select
                        // Same remount trick as the member rows above.
                        key={`${name}-${source === "match" ? persona.id : "auto"}`}
                        name="personaId"
                        defaultValue={source === "match" ? persona.id : ""}
                        aria-label={`Persona for ${name}`}
                        className="rounded-md border border-[#2a2a35] bg-[#08050f] px-2 py-1.5 text-xs text-[#e8dfc8]"
                      >
                        <option value="">
                          {source === "match" ? "Automatic" : `Automatic — ${persona.label}`}
                        </option>
                        {personaCatalog.personas.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-[#2a2a35] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#9080a0] transition-colors hover:border-violet-400 hover:text-[#e8dfc8]"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {members.length === 0 && rosterOnly.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-[#6a5a78]">
                    No members have signed in yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 rounded-xl border border-[#2a2a35] bg-[#0f0a1a] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-cinzel text-sm uppercase tracking-widest">
            <GraduationCap size={17} className="text-violet-300" aria-hidden="true" />
            What Myra has learned
          </h2>
          <Link
            href="/admin/pronunciations"
            className="inline-flex items-center gap-1.5 text-xs text-[#9080a0] hover:text-[#e8dfc8] transition-colors"
          >
            <SpellCheck2 size={14} aria-hidden="true" /> Edit pronunciations
          </Link>
        </div>
        <p className="mb-5 max-w-3xl text-xs leading-relaxed text-[#6a5a78]">
          Each night Myra reviews questions she couldn&apos;t answer, finds grounded answers from
          Chronicles, and remembers them for next time. Answers with a source go live automatically;
          questions she still can&apos;t answer are listed as gaps.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <GraduationCap size={13} className="text-violet-300" aria-hidden="true" />
              Learned answers ({learned.answers.length})
            </p>
            {topLearned.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#6a5a78]">
                Nothing learned yet — answers appear here after the nightly run.
              </p>
            ) : (
              <ul className="space-y-3">
                {topLearned.map((entry) => (
                  <li key={entry.normalized} className="rounded-lg border border-[#201927] bg-[#08050f] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-[#e8dfc8]">“{entry.question}”</p>
                      <form action={forgetQuestionAction}>
                        <input type="hidden" name="normalized" value={entry.normalized} />
                        <button
                          type="submit"
                          className="shrink-0 text-[10px] uppercase tracking-widest text-[#5a5060] hover:text-[#ef4444] transition-colors"
                          title="Forget this answer and never re-learn it"
                        >
                          Forget
                        </button>
                      </form>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[#6a5a78]">{entry.answer}</p>
                    <p className="mt-1.5 text-[10px] text-[#5a5060]">
                      asked {entry.timesAsked}× · {entry.sources.length} source
                      {entry.sources.length === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#6a5a78]">
              <HelpCircle size={13} className="text-amber-400" aria-hidden="true" />
              Open gaps ({learned.gaps.length})
            </p>
            {topGaps.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#6a5a78]">
                No open gaps — Myra found an answer for everything asked.
              </p>
            ) : (
              <ul className="space-y-2">
                {topGaps.map((gap) => (
                  <li
                    key={gap.normalized}
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#201927] bg-[#08050f] p-3"
                  >
                    <span className="text-xs text-[#c8bda8]">“{gap.question}”</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-[10px] text-[#5a5060]">{gap.timesAsked}×</span>
                      <form action={forgetQuestionAction}>
                        <input type="hidden" name="normalized" value={gap.normalized} />
                        <button
                          type="submit"
                          className="text-[10px] uppercase tracking-widest text-[#5a5060] hover:text-[#ef4444] transition-colors"
                          title="Ignore this question and stop flagging it"
                        >
                          Ignore
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {learned.updatedAt || learned.blocked.length > 0 ? (
          <p className="mt-4 border-t border-[#201927] pt-4 text-xs text-[#6a5a78]">
            {learned.updatedAt ? `Last learning run: ${dateTime(learned.updatedAt)}` : ""}
            {learned.updatedAt && learned.blocked.length > 0 ? " · " : ""}
            {learned.blocked.length > 0 ? `${learned.blocked.length} question(s) forgotten` : ""}
          </p>
        ) : null}
      </section>

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
                  <td className="px-5 py-3 capitalize text-violet-300">
                    {question.category.replaceAll("_", " ")}
                    {question.model && (
                      <span
                        className="mt-1 block text-[0.65rem] uppercase tracking-wider text-[#6a5a78]"
                        title={
                          question.model === "claude"
                            ? "Answered by Claude"
                            : `Answered by ${question.model}`
                        }
                      >
                        {question.model}
                      </span>
                    )}
                  </td>
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
