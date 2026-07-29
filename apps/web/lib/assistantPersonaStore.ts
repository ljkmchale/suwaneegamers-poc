// IO for Myra's persona catalog. Pure logic lives in lib/assistantPersonas.ts.
import { readContent, writeContent } from "@/lib/contentFiles";
import {
  type AssistantPersonaCatalog,
  type PersonaResolution,
  type RawPersonaCatalog,
  clampPersonaCatalog,
  PERSONA_CATALOG_DEFAULT,
  personaForAgent,
  resolvePersona,
} from "@/lib/assistantPersonas";

const PERSONA_FILE = "assistant-personas.json";

// Current catalog, DB-first (via readContent) with a safe built-in fallback so a
// missing file never breaks voice-session issuance.
export function readAssistantPersonas(): AssistantPersonaCatalog {
  try {
    return clampPersonaCatalog(readContent<RawPersonaCatalog>(PERSONA_FILE));
  } catch {
    return clampPersonaCatalog(PERSONA_CATALOG_DEFAULT);
  }
}

export function writeAssistantPersonas(catalog: AssistantPersonaCatalog): void {
  writeContent(PERSONA_FILE, clampPersonaCatalog(catalog));
}

export function resolvePersonaForMember(member: {
  personaId?: string | null;
  playerName?: string | null;
  displayName?: string | null;
}): PersonaResolution {
  return resolvePersona(readAssistantPersonas(), member);
}

/** The persona block shipped to the LiveKit agent for this member's session. */
export function personaForAgentMember(member: {
  personaId?: string | null;
  playerName?: string | null;
  displayName?: string | null;
}) {
  return personaForAgent(resolvePersonaForMember(member).persona);
}
