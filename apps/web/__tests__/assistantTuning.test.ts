import { describe, expect, it } from "vitest";
import {
  clampTuning,
  computeTuning,
  TUNING_DEFAULTS,
  type TuningSignals,
} from "@/lib/assistantTuning";

const NO_SIGNAL: TuningSignals = {
  turns: 0,
  interruptions: 0,
  llmResponses: 0,
  ttftP50Ms: 0,
  ttftP95Ms: 0,
  eouDelayP50Ms: 0,
  ttsTtfbP50Ms: 0,
};

describe("clampTuning", () => {
  it("fills defaults and clamps out-of-range values into bounds", () => {
    const t = clampTuning({ minEndpointingDelay: 99, ollamaTemperature: -5 });
    expect(t.minEndpointingDelay).toBe(0.6); // ceiling
    expect(t.ollamaTemperature).toBe(0); // floor
    expect(t.maxEndpointingDelay).toBe(TUNING_DEFAULTS.maxEndpointingDelay);
  });

  it("fills defaults and clamps the noise-guard knobs", () => {
    const filled = clampTuning({});
    expect(filled.vadActivationThreshold).toBe(TUNING_DEFAULTS.vadActivationThreshold);
    expect(filled.minInterruptionDuration).toBe(TUNING_DEFAULTS.minInterruptionDuration);
    expect(filled.minInterruptionWords).toBe(TUNING_DEFAULTS.minInterruptionWords);

    const clamped = clampTuning({
      vadActivationThreshold: 5,
      minInterruptionDuration: 99,
      minInterruptionWords: 42,
    });
    expect(clamped.vadActivationThreshold).toBe(0.85); // ceiling
    expect(clamped.minInterruptionDuration).toBe(1.5); // ceiling
    expect(clamped.minInterruptionWords).toBe(5); // ceiling
    expect(Number.isInteger(clamped.minInterruptionWords)).toBe(true);
  });
});

describe("computeTuning", () => {
  it("does nothing without enough samples", () => {
    const { changed, changes } = computeTuning(TUNING_DEFAULTS, { ...NO_SIGNAL, turns: 3, interruptions: 3 });
    expect(changed).toBe(false);
    expect(changes).toHaveLength(0);
  });

  it("raises endpointing patience and the interruption guard when she is interrupted often", () => {
    const { tuning, changed } = computeTuning(TUNING_DEFAULTS, {
      ...NO_SIGNAL,
      turns: 40,
      interruptions: 12, // 30%
    });
    expect(changed).toBe(true);
    expect(tuning.minEndpointingDelay).toBeGreaterThan(TUNING_DEFAULTS.minEndpointingDelay);
    expect(tuning.minInterruptionDuration).toBeGreaterThan(TUNING_DEFAULTS.minInterruptionDuration);
    expect(tuning.updatedBy).toBe("autotune");
  });

  it("lowers the interruption guard toward its floor when interruptions are near zero", () => {
    const { tuning, changed } = computeTuning(TUNING_DEFAULTS, {
      ...NO_SIGNAL,
      turns: 60,
      interruptions: 0,
    });
    expect(changed).toBe(true);
    expect(tuning.minInterruptionDuration).toBeLessThan(TUNING_DEFAULTS.minInterruptionDuration);
    expect(tuning.minInterruptionDuration).toBeGreaterThanOrEqual(0.4); // never below floor
  });

  it("lowers endpointing toward the floor when interruptions are near zero", () => {
    const { tuning, changed } = computeTuning(TUNING_DEFAULTS, {
      ...NO_SIGNAL,
      turns: 60,
      interruptions: 0,
    });
    expect(changed).toBe(true);
    expect(tuning.minEndpointingDelay).toBeLessThan(TUNING_DEFAULTS.minEndpointingDelay);
    expect(tuning.minEndpointingDelay).toBeGreaterThanOrEqual(0.3); // never below floor
  });

  it("never lowers endpointing or the interruption guard below their floors over many quiet turns", () => {
    // Both interruption-driven knobs start at their floors, so a long quiet
    // window must produce no change at all.
    const start = clampTuning({ ...TUNING_DEFAULTS, minEndpointingDelay: 0.3, minInterruptionDuration: 0.8 });
    const { tuning, changed } = computeTuning(start, { ...NO_SIGNAL, turns: 100, interruptions: 0 });
    expect(tuning.minEndpointingDelay).toBe(0.3);
    expect(tuning.minInterruptionDuration).toBe(0.8);
    expect(changed).toBe(false);
  });

  it("recommends a faster model without changing anything when TTFT stays very high", () => {
    const { changed, changes } = computeTuning(TUNING_DEFAULTS, {
      ...NO_SIGNAL,
      llmResponses: 30,
      ttftP95Ms: 6000,
    });
    expect(changed).toBe(false); // recommendation only
    expect(changes.join(" ")).toMatch(/recommendation/i);
  });
});
