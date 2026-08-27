// Not marked "server-only": also imported by the standalone autotuner script
// (scripts/autotune-assistant.ts) run outside Next via tsx.
import { readContent, writeContent } from "@/lib/contentFiles";
import {
  type AssistantTuning,
  clampTuning,
  TUNING_DEFAULTS,
} from "@/lib/assistantTuning";

const TUNING_FILE = "assistant-tuning.json";

// Current tuning, DB-first (via readContent) with a safe default fallback so a
// missing file never breaks voice-session issuance.
export function readAssistantTuning(): AssistantTuning {
  try {
    return clampTuning(readContent<Partial<AssistantTuning>>(TUNING_FILE));
  } catch {
    return { ...TUNING_DEFAULTS };
  }
}

export function writeAssistantTuning(tuning: AssistantTuning): void {
  writeContent(TUNING_FILE, clampTuning(tuning));
}

// The compact subset shipped to the LiveKit agent in dispatch metadata.
export function assistantTuningForAgent(): Record<string, number | string> {
  const t = readAssistantTuning();
  return {
    minEndpointingDelay: t.minEndpointingDelay,
    maxEndpointingDelay: t.maxEndpointingDelay,
    vadMinSilence: t.vadMinSilence,
    vadActivationThreshold: t.vadActivationThreshold,
    minInterruptionDuration: t.minInterruptionDuration,
    minInterruptionWords: t.minInterruptionWords,
  };
}
