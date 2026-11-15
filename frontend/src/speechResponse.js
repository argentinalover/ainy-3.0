const PAUSE_MARKER_PATTERN = /^\[PAUSA:\s*(\d+(?:[.,]\d+)?)\s*s\]\s*/i;
const PAUSE_MARKER_PREFIX = /^\[PAUSA:/i;
const MAX_SPEECH_PAUSE_MS = 10_000;

export function parseSpeechResponse(response) {
  const trimmedResponse = response.trim();
  const match = PAUSE_MARKER_PATTERN.exec(trimmedResponse);

  if (!match) {
    if (PAUSE_MARKER_PREFIX.test(trimmedResponse)) {
      throw new Error("Ainy returned an invalid speech pause marker.");
    }

    return { text: trimmedResponse, pauseMs: 0 };
  }

  const text = trimmedResponse.slice(match[0].length).trim();
  if (!text) {
    throw new Error("Ainy returned a pause marker without a response.");
  }

  const pauseSeconds = Number(match[1].replace(",", "."));
  return {
    text,
    pauseMs: Math.min(pauseSeconds * 1000, MAX_SPEECH_PAUSE_MS),
  };
}

export function waitForSpeechPause(pauseMs) {
  if (pauseMs <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, pauseMs));
}
