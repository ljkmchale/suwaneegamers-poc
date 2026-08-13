import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readContent } from "./content-documents.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = readContent("legends-lore-narrations.json");
const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const requestedTitle = args.filter((arg) => !arg.startsWith("--")).join(" ").trim();
const entries = all
  ? config.entries
  : config.entries.filter((candidate) => candidate.title === requestedTitle);

if (!entries.length) {
  throw new Error(`Narration entry not found: ${requestedTitle || "(no title supplied)"}`);
}

function readApiKey() {
  if (process.env.ELEVEN_API_KEY?.trim()) return process.env.ELEVEN_API_KEY.trim();
  for (const envPath of [
    path.join(root, ".env.local"),
    path.join(root, "services", "livekit-schedule-agent", ".env.local"),
  ]) {
    if (!fs.existsSync(envPath)) continue;
    const match = /^ELEVEN_API_KEY=(.*)$/m.exec(fs.readFileSync(envPath, "utf8"));
    if (match?.[1]) return match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return "";
}

const apiKey = readApiKey();
if (!apiKey) throw new Error("ELEVEN_API_KEY is not configured.");

const historian = config.historian;
function splitForElevenLabs(text, maximum = 9000) {
  if (text.length <= maximum) return [text];
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > maximum) {
    const window = remaining.slice(0, maximum + 1);
    const paragraphBreak = window.lastIndexOf("\n\n");
    const sentenceBreak = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
    );
    const splitAt = paragraphBreak > maximum * 0.5
      ? paragraphBreak
      : sentenceBreak > maximum * 0.5
        ? sentenceBreak + 1
        : maximum;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

for (const entry of entries) {
  const relativeAudioPath = entry.audioUrl.replace(/^\/media\/session-audio\//, "");
  const outputPath = path.join(root, "apps", "web", "media", "session-audio", relativeAudioPath);
  if (!force && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
    console.log(`Cached ${entry.title} -> ${path.relative(root, outputPath)}`);
    continue;
  }

  const audioParts = [];
  const textParts = splitForElevenLabs(entry.script);
  for (let partIndex = 0; partIndex < textParts.length; partIndex += 1) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${historian.voiceId}?output_format=${historian.outputFormat}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: textParts[partIndex],
          model_id: historian.modelId,
          voice_settings: {
            stability: historian.stability,
            similarity_boost: historian.similarity,
            style: historian.style,
            speed: historian.speed,
            use_speaker_boost: historian.useSpeakerBoost,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs generation failed for ${entry.title}, part ${partIndex + 1} of ${textParts.length}, with HTTP ${response.status}: ${await response.text()}`);
    }
    audioParts.push(Buffer.from(await response.arrayBuffer()));
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat(audioParts));
  console.log(`Generated ${entry.title}${textParts.length > 1 ? ` (${textParts.length} parts)` : ""} -> ${path.relative(root, outputPath)}`);
}
