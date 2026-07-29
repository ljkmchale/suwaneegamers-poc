// Nightly auto-tuner for Myra.
//
// Reads the recent per-turn timing metrics (voice_metrics), nudges a small set of
// timing knobs within safe bounds, and writes content/assistant-tuning.json. The
// token route ships the result to the agent each session, so changes take effect
// without a redeploy. Every change is logged and reversible; a tiny sample or no
// data is a no-op.
//
// Run manually:  cd apps/web && npx tsx scripts/autotune-assistant.ts
// Scheduler job id: "assistant-autotune".
import { computeTuning } from "@/lib/assistantTuning";
import { readAssistantTuning, writeAssistantTuning } from "@/lib/assistantTuningStore";
import { getTuningSignals } from "@/lib/voiceMetrics";

const WINDOW_DAYS = Number(process.env.ASSISTANT_AUTOTUNE_DAYS ?? 7);

function main(): void {
  const current = readAssistantTuning();
  const signals = getTuningSignals(WINDOW_DAYS);
  const { tuning, changed, changes } = computeTuning(current, signals);

  const stamp = new Date().toISOString();
  console.log(
    `[${stamp}] autotune signals: turns=${signals.turns} interruptions=${signals.interruptions} ` +
      `llm=${signals.llmResponses} ` +
      `ttftP50=${signals.ttftP50Ms}ms ttftP95=${signals.ttftP95Ms}ms`,
  );

  // Recommendations (e.g. model swaps) are surfaced even when nothing is applied.
  for (const change of changes) {
    console.log(`[${stamp}] autotune: ${change}`);
  }

  if (!changed) {
    console.log(`[${stamp}] autotune: no parameter changes.`);
    return;
  }

  writeAssistantTuning(tuning);
  console.log(
    `[${stamp}] autotune applied: endpointing=${tuning.minEndpointingDelay}s ` +
      `interruptionGuard=${tuning.minInterruptionDuration}s`,
  );
}

main();
