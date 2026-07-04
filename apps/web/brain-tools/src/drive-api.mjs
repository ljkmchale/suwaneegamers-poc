import { config } from "./config.mjs";

function getApiKey() {
  const apiKey = config.googleApiKey;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Add it to brain-query/.env.\n" +
        "Create one at https://console.cloud.google.com/apis/credentials with the Google Drive API enabled."
    );
  }
  return apiKey;
}

/**
 * Export a Google Doc as plain text via the Drive API v3.
 * The document must be publicly shared (link-viewable) or the API key
 * must have access. Returns the plain-text content as a string.
 */
export async function exportGoogleDocText(docId) {
  const params = new URLSearchParams({ mimeType: "text/plain", key: getApiKey() });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(docId)}/export?${params}`
  );

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error?.message ? `: ${body.error.message}` : "";
    } catch {
      // ignore parse error
    }
    const error = new Error(
      `Drive API export failed with HTTP ${response.status}${detail}. Make sure link sharing is enabled on the Google Doc.`
    );
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }

  const text = await response.text();
  if (!text.trim()) {
    const error = new Error("Drive API returned an empty document.");
    error.statusCode = 422;
    throw error;
  }

  return text;
}
