import assert from "node:assert/strict";
import test from "node:test";
import { parseSpeechResponse } from "../src/speechResponse.js";

test("keeps normal responses without adding a delay", () => {
  assert.deepEqual(parseSpeechResponse("  Hola.  "), {
    text: "Hola.",
    pauseMs: 0,
  });
});

test("extracts a pause marker and removes it from speech text", () => {
  assert.deepEqual(parseSpeechResponse("[PAUSA: 5s] Respira con calma."), {
    text: "Respira con calma.",
    pauseMs: 5000,
  });
});

test("accepts a decimal comma and caps long pauses at ten seconds", () => {
  assert.deepEqual(parseSpeechResponse("[PAUSA: 12,5s] Mensaje."), {
    text: "Mensaje.",
    pauseMs: 10_000,
  });
  assert.deepEqual(parseSpeechResponse("[PAUSA: 2,5s] Mensaje."), {
    text: "Mensaje.",
    pauseMs: 2500,
  });
});

test("rejects malformed or empty pause responses", () => {
  assert.throws(() => parseSpeechResponse("[PAUSA: Xs] Respira."), /invalid/);
  assert.throws(() => parseSpeechResponse("[PAUSA: 5s]"), /without a response/);
});
