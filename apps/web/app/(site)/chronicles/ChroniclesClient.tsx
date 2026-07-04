"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Copy,
  Eye,
  ListChecks,
  LoaderCircle,
  ScrollText,
  Search,
  Shield,
  Sparkles,
  Users,
  X,
} from "lucide-react";

interface BrainConfig {
  campaigns: string[];
  topK: number;
  dmModeEnabled?: boolean;
}

interface BrainSource {
  title: string;
  path: string;
  heading?: string;
  campaign?: string;
  score?: number;
}

interface BrainAnswer {
  answer?: string;
  sources?: BrainSource[];
  error?: string;
}

interface SourcePayload {
  title: string;
  path: string;
  campaign: string;
  visibility: string;
  markdown: string;
  error?: string;
}

const QUICK_QUESTIONS = [
  "Where is the party right now and what are they doing?",
  "What happened in the most recent session?",
  "What plot threads are still open and unresolved?",
  "Who are the active party members?",
];

const CHRONICLE_VIEWS = [
  {
    label: "NPCs",
    description: "Named non-player characters by campaign",
    path: "wiki/indexes/NPC Index.md",
    icon: Users,
  },
  {
    label: "Objectives",
    description: "Quests and active objectives",
    path: "wiki/indexes/Quest Index.md",
    icon: ListChecks,
  },
  {
    label: "Characters",
    description: "Character roster by campaign",
    path: "wiki/threads/Character Personal Threads Index.md",
    icon: BookOpen,
  },
  {
    label: "Open Threads",
    description: "Unresolved leads and loose ends",
    path: "wiki/threads/Open Threads By Campaign.md",
    icon: ScrollText,
  },
];

export function ChroniclesClient({
  initialConfig,
  initialConfigError,
  initialSource,
  isAdmin,
  surface = "public",
  initialVisibility = "players",
  initialAnswerMode = "direct",
}: {
  initialConfig: BrainConfig | null;
  initialConfigError: string;
  initialSource: SourcePayload | null;
  isAdmin: boolean;
  surface?: "public" | "admin";
  initialVisibility?: "players" | "dm";
  initialAnswerMode?: "direct" | "recap" | "analysis";
}) {
  const [config, setConfig] = useState<BrainConfig | null>(initialConfig);
  const [configError, setConfigError] = useState(initialConfigError);
  const [campaign, setCampaign] = useState(initialConfig?.campaigns?.[0] ?? "All");
  const [visibility, setVisibility] = useState<"players" | "dm">(initialVisibility);
  const [quality, setQuality] = useState<"fast" | "deep">("fast");
  const [answerMode, setAnswerMode] = useState<"direct" | "recap" | "analysis">(initialAnswerMode);
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<BrainSource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<SourcePayload | null>(initialSource);

  const allowDmControls = surface === "admin" && isAdmin;
  const dmAvailable = allowDmControls && Boolean(config?.dmModeEnabled);
  const canUseDm = visibility === "players" || dmAvailable;
  const chroniclesPath = surface === "admin" ? "/admin/chronicles" : "/chronicles";

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        const response = await fetch("/api/brain/config", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load Chronicles config.");
        if (cancelled) return;
        setConfig(payload);
        setCampaign(payload.campaigns?.[0] ?? "All");
      } catch (err) {
        if (!cancelled) setConfigError(err instanceof Error ? err.message : "Chronicles is not reachable.");
      }
    }

    if (!initialConfig) loadConfig();
    return () => {
      cancelled = true;
    };
  }, [initialConfig]);

  const introText = useMemo(() => {
    if (configError) return configError;
    if (!config) return "Connecting to Chronicles...";
    if (surface === "admin") {
      return "DM workspace for private Chronicles sources, deeper answers, and verification.";
    }
    return "Grounded player-safe answers from the maintained Chronicles wiki, with source anchors for verification.";
  }, [config, configError, surface]);

  async function submitQuestion(nextQuestion?: string) {
    const asked = (nextQuestion ?? question).trim();
    if (!asked || loading) return;

    setQuestion("");
    setLastQuestion(asked);
    setAnswer("");
    setSources([]);
    setError("");
    setActiveSource(null);
    setLoading(true);

    try {
      if (!canUseDm) throw new Error("Log in as an admin to use DM mode.");

      const response = await fetch("/api/brain/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: asked,
          campaign,
          visibility,
          quality,
          answerMode,
          topK: config?.topK ?? 7,
        }),
      });
      const payload = (await response.json()) as BrainAnswer;
      if (!response.ok) throw new Error(payload.error || "Chronicles could not answer.");

      setAnswer(payload.answer ?? "");
      setSources(payload.sources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function setSourceUrl(sourcePath: string | null) {
    const url = new URL(window.location.href);
    if (sourcePath) url.searchParams.set("source", sourcePath);
    else url.searchParams.delete("source");
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function openSource(sourcePath: string, updateUrl = false) {
    setSourceLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ path: sourcePath, visibility });
      const response = await fetch(`/api/brain/source?${params}`);
      const payload = (await response.json()) as SourcePayload;
      if (!response.ok) throw new Error(payload.error || "Could not open source.");
      setActiveSource(payload);
      if (updateUrl) setSourceUrl(sourcePath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open source.");
    } finally {
      setSourceLoading(false);
    }
  }

  function closeSource() {
    setActiveSource(null);
    setSourceUrl(null);
  }

  async function openWikiLink(target: string) {
    setSourceLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ target, visibility });
      const response = await fetch(`/api/brain/resolve-source?${params}`);
      const payload = (await response.json()) as Pick<SourcePayload, "path" | "error">;
      if (!response.ok) throw new Error(payload.error || "Could not resolve wiki link.");
      await openSource(payload.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resolve wiki link.");
      setSourceLoading(false);
    }
  }

  async function copyAnswer() {
    if (answer) await navigator.clipboard.writeText(answer);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitQuestion();
  }

  return (
    <div
      data-full-page-route={surface === "public" ? "chronicles" : undefined}
      className={surface === "admin"
        ? "min-h-[calc(100vh-4rem)] bg-[var(--color-bg-deep)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden"
        : "h-auto min-h-[calc(100vh-4rem)] bg-[var(--color-bg-deep)] lg:h-[calc(100vh-4rem)] lg:overflow-hidden"}
    >
      <div className="grid min-h-[calc(100vh-4rem)] lg:h-full lg:grid-cols-[18rem_minmax(0,1fr)_22rem]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--color-bg-border)] bg-[rgba(15,10,26,0.92)] lg:border-r lg:border-b-0">
          <div className="border-b border-[var(--color-bg-border)] px-5 py-5">
            <div className="mb-4 flex items-center gap-3" aria-hidden="true">
              <BookOpen size={19} className="text-[var(--color-accent-gold)]" strokeWidth={1.8} />
            </div>
            <h1 className="font-cinzel text-2xl tracking-widest uppercase text-[var(--color-text-primary)]">
              Chronicles
            </h1>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{introText}</p>
          </div>

          <div className="grid gap-4 px-5 py-5">
            <Control label="Campaign">
              <select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="brain-select" disabled={!config}>
                {(config?.campaigns ?? ["All"]).map((item) => (
                  <option key={item} value={item}>{item === "All" ? "Auto-detect / World lore" : item}</option>
                ))}
              </select>
            </Control>

            <div className="grid grid-cols-2 gap-3">
              {allowDmControls && (
                <Control label="Mode">
                  <select value={visibility} onChange={(event) => setVisibility(event.target.value as "players" | "dm")} className="brain-select">
                    <option value="players">Player</option>
                    <option value="dm" disabled={!dmAvailable}>DM</option>
                  </select>
                </Control>
              )}
              <Control label="Quality">
                <select value={quality} onChange={(event) => setQuality(event.target.value as "fast" | "deep")} className="brain-select">
                  <option value="fast">Fast</option>
                  <option value="deep">Thorough</option>
                </select>
              </Control>
            </div>

            <Control label="Answer Style">
              <select value={answerMode} onChange={(event) => setAnswerMode(event.target.value as "direct" | "recap" | "analysis")} className="brain-select">
                <option value="direct">Direct</option>
                <option value="recap">Recap</option>
                {allowDmControls && <option value="analysis">DM Analysis</option>}
              </select>
            </Control>

            {allowDmControls && !config?.dmModeEnabled && (
              <p className="border border-[#92400e] bg-[#451a03]/40 px-3 py-2 text-xs text-[#fde68a]">
                Brain DM mode needs BRAIN_DM_SHARED_SECRET configured in Suwanee Gamers.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--color-bg-border)] px-5 py-5">
            <p className="mb-3 font-cinzel text-xs tracking-[0.24em] uppercase text-[var(--color-text-muted)]">
              Browse
            </p>
            <div className="mb-6 grid gap-2">
              {CHRONICLE_VIEWS.map((view) => {
                const Icon = view.icon;
                return (
                  <Link
                    key={view.path}
                    href={`${chroniclesPath}?source=${encodeURIComponent(view.path)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      openSource(view.path, true);
                    }}
                    className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 border border-[var(--color-bg-border)] bg-[rgba(8,5,15,0.42)] px-3 py-3 text-left transition hover:border-[var(--color-accent-arcane)]"
                  >
                    <Icon size={17} className="mt-0.5 text-[var(--color-accent-gold)]" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block font-cinzel text-xs tracking-[0.14em] uppercase text-[var(--color-text-primary)]">
                        {view.label}
                      </span>
                      <span className="mt-1 block text-xs leading-4 text-[var(--color-text-muted)]">
                        {view.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <p className="mb-3 font-cinzel text-xs tracking-[0.24em] uppercase text-[var(--color-text-muted)]">
              Quick Questions
            </p>
            <div className="grid gap-2">
              {QUICK_QUESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => submitQuestion(item)}
                  className="border border-[var(--color-bg-border)] bg-[rgba(8,5,15,0.42)] px-3 py-2 text-left text-sm leading-5 text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-arcane)] hover:text-[var(--color-text-primary)]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[rgba(8,5,15,0.72)]">
          <section className="border-b border-[var(--color-bg-border)] px-5 py-5 lg:px-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-cinzel text-xs tracking-[0.35em] uppercase text-[var(--color-accent-arcane)]">
                  Ask the Archives
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {visibility === "dm" ? "DM sources enabled" : "Player-safe sources"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                {visibility === "dm" ? <Shield size={14} /> : <Eye size={14} />}
                <span>{campaign === "All" ? "Auto-detect" : campaign}</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              <label className="sr-only" htmlFor="chronicles-question">Ask Chronicles</label>
              <textarea
                id="chronicles-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                placeholder="Ask about a character, place, faction, clue, session, or unresolved thread..."
                className="min-h-24 resize-y border border-[var(--color-bg-border)] bg-[rgba(15,10,26,0.72)] px-4 py-3 text-base text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-arcane)]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !question.trim() || Boolean(configError)}
                  className="inline-flex min-h-11 items-center gap-2 border border-[var(--color-accent-arcane)] bg-[rgba(139,92,246,0.14)] px-5 py-2 font-cinzel text-xs tracking-[0.18em] text-[var(--color-accent-gold)] uppercase transition hover:border-[var(--color-accent-gold)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? <LoaderCircle className="animate-spin" size={16} /> : <Search size={16} />}
                  Consult
                </button>
              </div>
            </form>
          </section>

          <section className="min-h-[28rem] flex-1 overflow-y-auto px-5 py-6 lg:min-h-0 lg:px-7">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-cinzel text-xs tracking-[0.24em] uppercase text-[var(--color-accent-gold)]">
                  Answer
                </p>
                {lastQuestion && <p className="mt-1 truncate text-sm text-[var(--color-text-muted)]">{lastQuestion}</p>}
              </div>
              <button
                type="button"
                onClick={copyAnswer}
                disabled={!answer}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--color-bg-border)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-arcane)] hover:text-[var(--color-text-primary)] disabled:opacity-35"
                aria-label="Copy answer"
                title="Copy answer"
              >
                <Copy size={15} />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                <LoaderCircle className="animate-spin text-[var(--color-accent-arcane)]" size={20} />
                <span>The Chronicles are searching...</span>
              </div>
            )}

            {error && (
              <div className="border border-[#7f1d1d] bg-[#450a0a]/45 px-4 py-3 text-sm text-[#fecaca]">
                {error}
              </div>
            )}

            {!loading && !error && !answer && (
              <div className="flex max-w-2xl flex-col gap-3 text-[var(--color-text-secondary)]">
                <Sparkles className="text-[var(--color-accent-arcane)]" size={22} />
                <p>
                  Ask a question and Chronicles will answer here using the maintained indexed source material.
                </p>
              </div>
            )}

            {answer && (
              <article className="prose prose-invert max-w-none prose-headings:font-cinzel prose-headings:text-[var(--color-accent-gold)] prose-p:text-[var(--color-text-primary)] prose-li:text-[var(--color-text-primary)] prose-strong:text-[var(--color-text-primary)] prose-table:text-sm">
                <MarkdownView markdown={answer} onWikiLink={openWikiLink} />
              </article>
            )}
          </section>
        </main>

        <aside className="flex min-h-0 flex-col border-t border-[var(--color-bg-border)] bg-[rgba(15,10,26,0.86)] lg:border-t-0 lg:border-l">
          <div className="border-b border-[var(--color-bg-border)] px-5 py-5">
            <p className="font-cinzel text-xs tracking-[0.24em] uppercase text-[var(--color-accent-gold)]">
              Sources
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {sources.length ? `${sources.length} source${sources.length === 1 ? "" : "s"}` : "No sources yet"}
            </p>
          </div>
          <div className="grid max-h-[30rem] gap-2 overflow-y-auto p-4 lg:max-h-none lg:flex-1">
            {sources.map((source) => (
              <button
                key={`${source.path}-${source.heading ?? ""}`}
                type="button"
                onClick={() => openSource(source.path)}
                className="border border-[var(--color-bg-border)] bg-[rgba(8,5,15,0.36)] px-3 py-3 text-left transition hover:border-[var(--color-accent-arcane)]"
              >
                <span className="block font-cinzel text-xs tracking-wider text-[var(--color-text-primary)]">
                  {source.title}
                </span>
                {source.heading && <span className="mt-1 block text-xs text-[var(--color-text-secondary)]">{source.heading}</span>}
                <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                  <span>{source.campaign ?? "Chronicles"}</span>
                  {typeof source.score === "number" && <span>{source.score.toFixed(2)}</span>}
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>

      {activeSource && (
        <div className={`fixed inset-x-0 bottom-0 z-[60] bg-black/76 backdrop-blur-sm ${surface === "admin" ? "top-0" : "top-16"}`}>
          <div className="flex h-full flex-col border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--color-bg-border)] px-5 py-4">
              <div className="min-w-0">
                <p className="font-cinzel text-xs tracking-[0.24em] uppercase text-[var(--color-accent-gold)]">Source</p>
                <h2 className="truncate font-cinzel text-xl text-[var(--color-text-primary)]">{activeSource.title}</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{activeSource.campaign} - {activeSource.path}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={chroniclesPath}
                  onClick={(event) => {
                    event.preventDefault();
                    closeSource();
                  }}
                  className="min-h-9 border border-[var(--color-bg-border)] px-3 font-cinzel text-[11px] tracking-[0.16em] text-[var(--color-text-secondary)] uppercase transition hover:border-[var(--color-accent-arcane)] hover:text-[var(--color-text-primary)]"
                >
                  Back to Chronicles
                </Link>
                <Link
                  href={chroniclesPath}
                  onClick={(event) => {
                    event.preventDefault();
                    closeSource();
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center border border-[var(--color-bg-border)] text-[var(--color-text-secondary)] transition hover:border-[var(--color-accent-arcane)] hover:text-[var(--color-text-primary)]"
                  aria-label="Close source"
                  title="Close source"
                >
                  <X size={16} />
                </Link>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-8">
              {sourceLoading ? (
                <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                  <LoaderCircle className="animate-spin text-[var(--color-accent-arcane)]" size={20} />
                  <span>Opening source...</span>
                </div>
              ) : (
                <article className="prose prose-invert max-w-none prose-headings:font-cinzel prose-headings:text-[var(--color-accent-gold)] prose-p:text-[var(--color-text-primary)] prose-li:text-[var(--color-text-primary)] prose-blockquote:border-[var(--color-accent-arcane)] prose-blockquote:text-[var(--color-text-secondary)] prose-strong:text-[var(--color-text-primary)]">
                  <MarkdownView markdown={stripFrontmatter(activeSource.markdown)} onWikiLink={openWikiLink} />
                </article>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="font-cinzel text-[11px] tracking-[0.18em] uppercase text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}

function MarkdownView({ markdown, onWikiLink }: { markdown: string; onWikiLink: (target: string) => void }) {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  function flushList() {
    if (!listItems.length) return;
    const items = listItems;
    listItems = [];
    blocks.push(<ul key={`ul-${blocks.length}`}>{items.map((item, index) => <li key={index}>{renderInline(item, onWikiLink)}</li>)}</ul>);
  }

  function flushOrdered() {
    if (!orderedItems.length) return;
    const items = orderedItems;
    orderedItems = [];
    blocks.push(<ol key={`ol-${blocks.length}`}>{items.map((item, index) => <li key={index}>{renderInline(item, onWikiLink)}</li>)}</ol>);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      flushOrdered();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      flushOrdered();
      const level = Math.min(heading[1].length + 1, 5);
      if (level === 2) blocks.push(<h2 key={`h-${blocks.length}`}>{renderInline(heading[2], onWikiLink)}</h2>);
      else if (level === 3) blocks.push(<h3 key={`h-${blocks.length}`}>{renderInline(heading[2], onWikiLink)}</h3>);
      else if (level === 4) blocks.push(<h4 key={`h-${blocks.length}`}>{renderInline(heading[2], onWikiLink)}</h4>);
      else blocks.push(<h5 key={`h-${blocks.length}`}>{renderInline(heading[2], onWikiLink)}</h5>);
      continue;
    }

    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushList();
      orderedItems.push(ordered[1]);
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      flushOrdered();
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    flushOrdered();
    blocks.push(<p key={`p-${blocks.length}`}>{renderInline(line, onWikiLink)}</p>);
  }

  flushList();
  flushOrdered();
  return <>{blocks}</>;
}

function renderInline(text: string, onWikiLink: (target: string) => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[2]) {
      const target = match[2];
      const label = match[3] || match[2];
      nodes.push(
        <button key={`${target}-${match.index}`} type="button" onClick={() => onWikiLink(target)} className="font-medium text-[var(--color-accent-gold)] underline decoration-[var(--color-accent-arcane)]/50 underline-offset-4 transition hover:text-[#fde68a]">
          {label}
        </button>
      );
    } else if (match[4]) {
      nodes.push(<strong key={`strong-${match.index}`}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<code key={`code-${match.index}`}>{match[5]}</code>);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function stripFrontmatter(markdown: string) {
  return markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n/, "");
}
