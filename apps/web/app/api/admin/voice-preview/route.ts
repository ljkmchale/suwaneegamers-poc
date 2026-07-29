import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { readAssistantPersonas } from "@/lib/assistantPersonaStore";
import {
  findPersona,
  previewLine,
  SPEED_BOUNDS,
  VOICE_IDS,
} from "@/lib/assistantPersonas";

export const dynamic = "force-dynamic";

// Audition a Kokoro voice from the admin panel. The browser cannot reach the
// speech server directly (it listens on loopback, and an admin may be on another
// device), so this proxies the request. Nothing here accepts free text: the
// spoken line comes from the persona catalog or the built-in sample, so this
// never becomes an open text-to-speech endpoint.
export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (session.isAdmin !== true) {
    return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const voice = params.get("voice") ?? "";
  if (!VOICE_IDS.includes(voice)) {
    return NextResponse.json({ error: "Unknown voice." }, { status: 400 });
  }

  const requestedSpeed = Number(params.get("speed"));
  const speed = Number.isFinite(requestedSpeed)
    ? Math.min(SPEED_BOUNDS.max, Math.max(SPEED_BOUNDS.min, requestedSpeed))
    : 1;

  const persona = findPersona(readAssistantPersonas(), params.get("personaId"));
  const input = previewLine(persona);

  const baseUrl = process.env.LOCAL_SPEECH_BASE_URL ?? "http://127.0.0.1:8000/v1";
  const model = process.env.LOCAL_TTS_MODEL ?? "speaches-ai/Kokoro-82M-v1.0-ONNX";

  try {
    const response = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input, speed, response_format: "mp3" }),
      // Kokoro renders a couple of sentences in about a second; well past that
      // the speech server is down and the panel should say so rather than hang.
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[voice preview]", response.status, detail.slice(0, 200));
      return NextResponse.json(
        { error: "The speech server rejected that voice." },
        { status: 502 },
      );
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        // Same voice + speed + persona always renders the same audio, so let the
        // browser keep it while an admin clicks around comparing voices.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[voice preview]", error);
    return NextResponse.json(
      { error: "The speech server is not responding. Is the voice stack running?" },
      { status: 503 },
    );
  }
}
