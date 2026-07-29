// Pure tuning logic for Myra. NO server/db/fs imports —
// this module is unit-tested and shared by the token route, the tuning store,
// and the nightly autotuner. IO lives in lib/assistantTuningStore.ts.
//
// Myra's timing knobs live in content/assistant-tuning.json. The nightly
// autotuner (scripts/autotune-assistant.ts) reads recent metrics, nudges a small
// set of knobs within safe bounds, and writes the file back. The token route ships
// the current values to the agent in dispatch metadata so they apply every session.

export type TuningSource = "default" | "autotune" | "manual";

export interface AssistantTuning {
  /** Seconds to wait after speech stops before replying. The snappiness knob. */
  minEndpointingDelay: number;
  /** Upper bound on the endpointing wait. */
  maxEndpointingDelay: number;
  /** Silero VAD silence window, seconds. */
  vadMinSilence: number;
  /** Silero VAD activation threshold, 0-1. Higher ignores more background noise. */
  vadActivationThreshold: number;
  /** Minimum speech length (s) before background noise can interrupt her. */
  minInterruptionDuration: number;
  /** Minimum recognized words before an interruption counts (noise guard). */
  minInterruptionWords: number;
  ollamaTemperature: number;
  ollamaTopP: number;
  updatedAt: string;
  updatedBy: TuningSource;
  note: string;
}

/** Aggregated per-turn metrics the autotuner reasons over. */
export interface TuningSignals {
  turns: number;
  interruptions: number;
  llmResponses: number;
  ttftP50Ms: number;
  ttftP95Ms: number;
  eouDelayP50Ms: number;
  ttsTtfbP50Ms: number;
}

export const TUNING_DEFAULTS: AssistantTuning = {
  minEndpointingDelay: 0.4,
  maxEndpointingDelay: 5.0,
  vadMinSilence: 0.45,
  vadActivationThreshold: 0.6,
  minInterruptionDuration: 1.2,
  minInterruptionWords: 3,
  ollamaTemperature: 0.3,
  ollamaTopP: 0.9,
  updatedAt: "",
  updatedBy: "default",
  note: "",
};

export const TUNING_BOUNDS = {
  minEndpointingDelay: { min: 0.3, max: 0.6, step: 0.05 },
  vadMinSilence: { min: 0.3, max: 0.7 },
  vadActivationThreshold: { min: 0.4, max: 0.85 },
  minInterruptionDuration: { min: 0.8, max: 1.5, step: 0.1 },
  minInterruptionWords: { min: 2, max: 5 },
} as const;

// The autotuner will not act until it has at least this many turns in the
// window, so it never over-reacts to a tiny sample.
const MIN_TURNS_FOR_ENDPOINTING = 15;
// Safety guard: above this interruption rate, only ever *raise* patience.
const HIGH_INTERRUPTION_RATE = 0.15;
const LOW_INTERRUPTION_RATE = 0.03;
const VERY_SLOW_TTFT_P95_MS = 4000;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Coerce arbitrary stored/loaded data into a valid, in-bounds tuning object. */
export function clampTuning(raw: Partial<AssistantTuning> | null | undefined): AssistantTuning {
  const t = { ...TUNING_DEFAULTS, ...(raw ?? {}) };
  const bounds = TUNING_BOUNDS;
  return {
    minEndpointingDelay: round2(
      clampNumber(t.minEndpointingDelay, bounds.minEndpointingDelay.min, bounds.minEndpointingDelay.max, TUNING_DEFAULTS.minEndpointingDelay),
    ),
    maxEndpointingDelay: round2(clampNumber(t.maxEndpointingDelay, 2, 10, TUNING_DEFAULTS.maxEndpointingDelay)),
    vadMinSilence: round2(
      clampNumber(t.vadMinSilence, bounds.vadMinSilence.min, bounds.vadMinSilence.max, TUNING_DEFAULTS.vadMinSilence),
    ),
    vadActivationThreshold: round2(
      clampNumber(
        t.vadActivationThreshold,
        bounds.vadActivationThreshold.min,
        bounds.vadActivationThreshold.max,
        TUNING_DEFAULTS.vadActivationThreshold,
      ),
    ),
    minInterruptionDuration: round2(
      clampNumber(
        t.minInterruptionDuration,
        bounds.minInterruptionDuration.min,
        bounds.minInterruptionDuration.max,
        TUNING_DEFAULTS.minInterruptionDuration,
      ),
    ),
    minInterruptionWords: Math.round(
      clampNumber(
        t.minInterruptionWords,
        bounds.minInterruptionWords.min,
        bounds.minInterruptionWords.max,
        TUNING_DEFAULTS.minInterruptionWords,
      ),
    ),
    ollamaTemperature: round2(clampNumber(t.ollamaTemperature, 0, 1, TUNING_DEFAULTS.ollamaTemperature)),
    ollamaTopP: round2(clampNumber(t.ollamaTopP, 0.1, 1, TUNING_DEFAULTS.ollamaTopP)),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : "",
    updatedBy: (["default", "autotune", "manual"] as const).includes(t.updatedBy as TuningSource)
      ? (t.updatedBy as TuningSource)
      : "default",
    note: typeof t.note === "string" ? t.note : "",
  };
}

export interface TuningDecision {
  tuning: AssistantTuning;
  changed: boolean;
  changes: string[];
}

/**
 * Decide the next tuning from the current values and recent metrics.
 *
 * Conservative and bounded: tiny steps, safety-biased on turn-taking (raises
 * patience readily when interruptions appear; only lowers it when interruptions
 * are near zero over a healthy sample). Model changes are recommended, never
 * applied.
 */
export function computeTuning(
  current: AssistantTuning,
  signals: TuningSignals,
  now: Date = new Date(),
): TuningDecision {
  const base = clampTuning(current);
  const next: AssistantTuning = { ...base };
  const changes: string[] = [];

  // --- Endpointing (snappiness) and barge-in guard, interruption-guarded ---
  // Both react to the interruption rate. A high rate usually means background
  // noise is cutting Myra off: make her wait a touch longer before speaking
  // (endpointing) AND require a longer burst before noise counts as an
  // interruption. Both ease back toward snappier defaults only when
  // interruptions are near zero over a healthy sample.
  if (signals.turns >= MIN_TURNS_FOR_ENDPOINTING) {
    const interruptionRate = signals.interruptions / signals.turns;
    const highNoise = interruptionRate > HIGH_INTERRUPTION_RATE;
    const lowNoise = interruptionRate < LOW_INTERRUPTION_RATE;
    const pct = Math.round(interruptionRate * 100);

    const { min, max, step } = TUNING_BOUNDS.minEndpointingDelay;
    if (highNoise && base.minEndpointingDelay < max) {
      next.minEndpointingDelay = round2(Math.min(max, base.minEndpointingDelay + step));
      changes.push(
        `raised endpointing to ${next.minEndpointingDelay}s (she was interrupted ${pct}% of turns)`,
      );
    } else if (lowNoise && base.minEndpointingDelay > min) {
      next.minEndpointingDelay = round2(Math.max(min, base.minEndpointingDelay - step));
      changes.push(
        `lowered endpointing to ${next.minEndpointingDelay}s (interruptions near zero over ${signals.turns} turns)`,
      );
    }

    const idur = TUNING_BOUNDS.minInterruptionDuration;
    if (highNoise && base.minInterruptionDuration < idur.max) {
      next.minInterruptionDuration = round2(Math.min(idur.max, base.minInterruptionDuration + idur.step));
      changes.push(
        `raised interruption guard to ${next.minInterruptionDuration}s (interrupted ${pct}% of turns — likely background noise)`,
      );
    } else if (lowNoise && base.minInterruptionDuration > idur.min) {
      next.minInterruptionDuration = round2(Math.max(idur.min, base.minInterruptionDuration - idur.step));
      changes.push(
        `lowered interruption guard to ${next.minInterruptionDuration}s (interruptions near zero over ${signals.turns} turns)`,
      );
    }
  }

  // --- Model recommendation (never auto-applied) ---
  if (signals.llmResponses >= 20 && signals.ttftP95Ms > VERY_SLOW_TTFT_P95_MS) {
    changes.push(
      `recommendation: TTFT p95 is ${signals.ttftP95Ms}ms even when warm — consider a smaller/faster OLLAMA_MODEL`,
    );
  }

  const changed =
    next.minEndpointingDelay !== base.minEndpointingDelay ||
    next.minInterruptionDuration !== base.minInterruptionDuration;
  if (changes.length > 0) {
    next.updatedAt = now.toISOString();
    next.updatedBy = "autotune";
    next.note = changes.join("; ");
  }
  return { tuning: next, changed, changes };
}
