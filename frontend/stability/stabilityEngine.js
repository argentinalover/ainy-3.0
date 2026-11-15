import { VARIABLES } from "./variables.js";

export const KEYBOARD_ALERTS = Object.freeze({
  Digit1: "radiation",
  Numpad1: "radiation",
  Digit2: "cortisol",
  Numpad2: "cortisol",
  Digit3: "sleep",
  Numpad3: "sleep",
  Digit4: "heartRate",
  Numpad4: "heartRate"
});

export const SIMULATED_ALERT_VALUES = Object.freeze({
  radiation: 2,
  cortisol: 30,
  sleep: 4,
  heartRate: 130
});

const deviationHistory = Object.create(null);

function calculateDeviation(value, variable) {
  const range = variable.max - variable.min;

  if (range === 0) return 0;
  if (value < variable.min) return (variable.min - value) / range;
  if (value > variable.max) return (value - variable.max) / range;
  return 0;
}

export function resetStabilityHistory(key) {
  if (!(key in VARIABLES)) {
    throw new Error(`Unknown variable: ${key}`);
  }

  delete deviationHistory[key];
}

export function calculateStability(values = {}) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new TypeError("Stability values must be an object.");
  }

  const results = {};
  const deviations = {};
  let totalDeviation = 0;
  let variableCount = 0;
  let hasAlert = false;
  let hasObservation = false;

  for (const [key, variable] of Object.entries(VARIABLES)) {
    const value = Object.prototype.hasOwnProperty.call(values, key)
      ? values[key]
      : variable.value;
    if (!Number.isFinite(value)) {
      throw new TypeError(`Value for ${key} must be a finite number.`);
    }

    const deviation = calculateDeviation(value, variable);
    deviationHistory[key] ??= [];
    deviationHistory[key].push(deviation);
    if (deviationHistory[key].length > 10) {
      deviationHistory[key].shift();
    }

    const averageDeviation =
      deviationHistory[key].reduce((sum, item) => sum + item, 0) /
      deviationHistory[key].length;

    let status = "stable";
    if (averageDeviation >= 0.25) {
      status = "alert";
      hasAlert = true;
    } else if (averageDeviation > 0) {
      status = "observation";
      hasObservation = true;
    }

    results[key] = {
      value,
      unit: variable.unit,
      reference: variable.reference,
      deviation: Number(deviation.toFixed(4)),
      status
    };
    deviations[key] = deviation;
    totalDeviation += Math.min(averageDeviation, 1);
    variableCount += 1;
  }

  const stabilityScore =
    variableCount === 0
      ? 100
      : Math.max(
          0,
          Math.round((1 - totalDeviation / variableCount) * 1000) / 10
        );

  return {
    stabilityScore,
    status: hasAlert ? "alert" : hasObservation ? "observation" : "stable",
    variables: results,
    deviations,
    lastUpdated: new Date().toISOString()
  };
}
