import { describe, expect, it } from "vitest";
import {
  clampPersona,
  clampPersonaCatalog,
  DEFAULT_PERSONA_ID,
  DEFAULT_PREVIEW_LINE,
  PERSONA_CATALOG_DEFAULT,
  personaForAgent,
  personasUsingVoice,
  previewLine,
  resolvePersona,
  STYLE_LINE_LIMIT,
  VOICE_IDS,
  VOICE_OPTIONS,
  voiceLabel,
} from "@/lib/assistantPersonas";

const catalog = PERSONA_CATALOG_DEFAULT;

describe("persona validation", () => {
  it("falls back to the default voice when the voice is not served by Speaches", () => {
    const persona = clampPersona({ id: "x", voice: "not-a-real-voice" });
    expect(persona.voice).toBe(catalog.personas[0].voice);
    expect(VOICE_IDS).toContain(persona.voice);
  });

  it("keeps a valid voice and clamps the speaking rate into an intelligible range", () => {
    expect(clampPersona({ voice: "bf_emma", speed: 1.0 }).voice).toBe("bf_emma");
    expect(clampPersona({ speed: 9 }).speed).toBe(1.25);
    expect(clampPersona({ speed: 0.1 }).speed).toBe(0.7);
    expect(clampPersona({ speed: "fast" as unknown as number }).speed).toBe(catalog.personas[0].speed);
  });

  it("caps style lines so personas stay small in dispatch metadata", () => {
    const persona = clampPersona({
      style: Array.from({ length: 40 }, (_, index) => `line ${index}`),
    });
    expect(persona.style).toHaveLength(STYLE_LINE_LIMIT);
  });

  it("keeps Myra's classic style when a persona supplies none", () => {
    expect(clampPersona({ id: "blank", style: [], examples: [] }).style).toEqual(
      catalog.personas[0].style,
    );
  });

  it("restores the built-in catalog when the stored file is empty or broken", () => {
    expect(clampPersonaCatalog(null).personas.length).toBeGreaterThan(0);
    expect(clampPersonaCatalog({ personas: [] }).defaultPersonaId).toBe(DEFAULT_PERSONA_ID);
  });

  it("points defaultPersonaId at a persona that actually exists", () => {
    const cleaned = clampPersonaCatalog({
      defaultPersonaId: "deleted-persona",
      personas: [{ id: "only-one", label: "Only One", voice: "af_sky" }],
    });
    expect(cleaned.defaultPersonaId).toBe("only-one");
  });

  it("drops duplicate persona ids so an assignment resolves to one persona", () => {
    const cleaned = clampPersonaCatalog({
      personas: [
        { id: "dupe", label: "First", voice: "af_sky" },
        { id: "dupe", label: "Second", voice: "bf_lily" },
      ],
    });
    expect(cleaned.personas).toHaveLength(1);
    expect(cleaned.personas[0].label).toBe("First");
  });
});

describe("persona resolution", () => {
  it("gives Michael Hewson the British persona before anyone assigns one", () => {
    const { persona, source } = resolvePersona(catalog, { playerName: "Michael Hewson" });
    expect(persona.id).toBe("british-cheeky");
    expect(persona.voice).toBe("bf_isabella");
    expect(source).toBe("match");
  });

  it("matches the roster name regardless of case or stray spacing", () => {
    expect(resolvePersona(catalog, { displayName: "  michael hewson " }).persona.id).toBe(
      "british-cheeky",
    );
  });

  it("prefers an explicit choice over the roster match", () => {
    const { persona, source } = resolvePersona(catalog, {
      personaId: "storyteller",
      playerName: "Michael Hewson",
    });
    expect(persona.id).toBe("storyteller");
    expect(source).toBe("chosen");
  });

  it("ignores a persona id that no longer exists instead of going silent", () => {
    const { persona, source } = resolvePersona(catalog, { personaId: "deleted-persona" });
    expect(persona.id).toBe(DEFAULT_PERSONA_ID);
    expect(source).toBe("default");
  });

  it("uses the house default for everyone else", () => {
    const { persona, source } = resolvePersona(catalog, { playerName: "Someone Else" });
    expect(persona.id).toBe(DEFAULT_PERSONA_ID);
    expect(source).toBe("default");
  });
});

describe("voice audition", () => {
  it("auditions a persona in its own words", () => {
    const line = previewLine(catalog.personas.find((p) => p.id === "british-cheeky"));
    expect(line).toContain("Sunday at one");
    // Only the spoken half of each "instead of X, say Y" example.
    expect(line).not.toContain("Instead of");
  });

  it("falls back to a neutral sample for a voice no persona uses", () => {
    expect(previewLine(null)).toBe(DEFAULT_PREVIEW_LINE);
    expect(previewLine(clampPersona({ id: "quiet", examples: ["no quoted line here"] })).length)
      .toBeGreaterThan(0);
  });

  it("reports which personas speak with a voice", () => {
    expect(personasUsingVoice(catalog, "bf_isabella").map((p) => p.id)).toEqual([
      "british-cheeky",
    ]);
    expect(personasUsingVoice(catalog, "af_sky")).toEqual([]);
  });

  it("offers male and female voices in both accents", () => {
    for (const accent of ["American", "British"] as const) {
      for (const voiceOf of ["female", "male"] as const) {
        expect(
          VOICE_OPTIONS.some((v) => v.accent === accent && v.voiceOf === voiceOf),
        ).toBe(true);
      }
    }
  });

  it("only offers voices the speech server actually serves", () => {
    // Kokoro ids are two letters (language + register) then an underscore.
    for (const voice of VOICE_OPTIONS) {
      expect(voice.id).toMatch(/^[ab][fm]_[a-z]+$/);
    }
  });
});

describe("agent payload", () => {
  it("ships only what the agent needs to speak in character", () => {
    const payload = personaForAgent(catalog.personas[1]);
    expect(Object.keys(payload).sort()).toEqual([
      "examples",
      "id",
      "label",
      "speed",
      "style",
      "voice",
    ]);
    expect(payload.voice).toBe("bf_isabella");
  });

  it("names voices readably for the admin panel", () => {
    expect(voiceLabel("bf_emma")).toContain("British");
    expect(voiceLabel("af_heart")).toContain("American");
    expect(voiceLabel("unknown_voice")).toBe("unknown_voice");
  });
});
