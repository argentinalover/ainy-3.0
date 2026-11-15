import assert from "node:assert/strict";
import test from "node:test";
import { VARIABLES } from "./variables.js";
import {
  KEYBOARD_ALERTS,
  SIMULATED_ALERT_VALUES,
  calculateStability,
  resetStabilityHistory
} from "./stabilityEngine.js";

const referenceValues = Object.fromEntries(
  Object.entries(VARIABLES).map(([key, variable]) => [key, variable.reference])
);

function resetHistory() {
  for (const key of Object.keys(VARIABLES)) {
    resetStabilityHistory(key);
  }
}

test("reference sensor values produce a stable score", () => {
  resetHistory();

  const result = calculateStability(referenceValues);

  assert.equal(result.status, "stable");
  assert.equal(result.stabilityScore, 100);
});

test("each keyboard demo value produces a metric alert", () => {
  for (const metric of Object.values(KEYBOARD_ALERTS)) {
    resetHistory();

    const result = calculateStability({
      ...referenceValues,
      [metric]: SIMULATED_ALERT_VALUES[metric]
    });

    assert.equal(result.variables[metric].status, "alert", metric);
    assert.equal(result.status, "alert", metric);
  }
});

test("keyboard shortcuts map to the four simulated biometric metrics", () => {
  assert.deepEqual(
    {
      Digit1: KEYBOARD_ALERTS.Digit1,
      Numpad1: KEYBOARD_ALERTS.Numpad1,
      Digit2: KEYBOARD_ALERTS.Digit2,
      Numpad2: KEYBOARD_ALERTS.Numpad2,
      Digit3: KEYBOARD_ALERTS.Digit3,
      Numpad3: KEYBOARD_ALERTS.Numpad3,
      Digit4: KEYBOARD_ALERTS.Digit4,
      Numpad4: KEYBOARD_ALERTS.Numpad4
    },
    {
      Digit1: "radiation",
      Numpad1: "radiation",
      Digit2: "cortisol",
      Numpad2: "cortisol",
      Digit3: "sleep",
      Numpad3: "sleep",
      Digit4: "heartRate",
      Numpad4: "heartRate"
    }
  );
});

test("unknown history keys and nonnumeric sensor values are rejected", () => {
  assert.throws(() => resetStabilityHistory("unknown"), /Unknown variable/);
  assert.throws(
    () => calculateStability({ ...referenceValues, heartRate: NaN }),
    /finite number/
  );
});
