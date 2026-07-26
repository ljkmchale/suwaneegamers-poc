import { readFile, writeFile } from "node:fs/promises";
import { sealData } from "iron-session";

const environment = Object.fromEntries(
  (await readFile(new URL("../.env.local", import.meta.url), "utf8"))
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);

const session = await sealData(
  {
    sub: "local-production-smoke-test",
    email: "smoke-test@suwaneegamers.invalid",
    name: "Local production smoke test",
  },
  {
    password: environment.ADMIN_SESSION_SECRET,
    ttl: 60,
  },
);

const response = await fetch("http://127.0.0.1:4652/api/livekit/token", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie: `sg-user=${session}`,
  },
  body: "{}",
});
const body = await response.json();

if (!response.ok) {
  throw new Error(`Token endpoint returned ${response.status}: ${body.error}`);
}
if (body.serverUrl !== "wss://voice.suwaneegamers.net") {
  throw new Error(`Unexpected LiveKit URL: ${body.serverUrl}`);
}
if (!body.participantToken) {
  throw new Error("The token endpoint did not return a participant token.");
}

if (process.env.LIVEKIT_SMOKE_OUTPUT) {
  await writeFile(
    process.env.LIVEKIT_SMOKE_OUTPUT,
    JSON.stringify({
      serverUrl: body.serverUrl,
      participantToken: body.participantToken,
    }),
    { mode: 0o600 },
  );
}

console.log("Authenticated production LiveKit token issued successfully.");
