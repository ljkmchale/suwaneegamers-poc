import { loadDotEnv } from "./env.mjs";
loadDotEnv();

import { syncGoogleDocSources } from "./google-doc-sync.mjs";

try {
  const result = await syncGoogleDocSources();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
