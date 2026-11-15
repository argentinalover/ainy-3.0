export {};

import { VARIABLES } from "./variables.js";

const deviationHistory = {};

export function resetStabilityHistory(key) {
  if (!(key in VARIABLES)) {
    throw new Error(`Unknown variable: ${key}`);
  }

  delete deviationHistory[key];
}

function calculateDeviation(value, variable) {
  const range = variable.max - variable.min;

  if (range === 0) return 0;

  if (value < variable.min) {
    return (variable.min - value) / range;
  }

  if (value > variable.max) {
    return (value - variable.max) / range;
  }

  return 0;
}

export function calculateStability(values) {
  const results = {};
  const deviations = {};

  let totalDeviation = 0;
  let variableCount = 0;
  let hasAlert = false;
  let hasObservation = false;

  for (const [key, variable] of Object.entries(VARIABLES)) {
    const value = values[key];

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
    variableCount++;
  }

  const stabilityScore = Math.max(
    0,
    Math.round((1 - totalDeviation / variableCount) * 1000) / 10
  );

  return {
    stabilityScore,
    status: hasAlert
      ? "alert"
      : hasObservation
        ? "observation"
        : "stable",
    variables: results,
    deviations,
    lastUpdated: new Date().toISOString()
  };
}
