export {};

import { VARIABLES } from "./variables.js";

const simulatedValues = Object.fromEntries(
  Object.entries(VARIABLES).map(([key, variable]) => [
    key,
    variable.value
  ])
);
const manualAlertOverrides = new Set();
const MEAN_REVERSION_RATE = 0.1;

const fluctuations = {
  microgravity: 0.00000002,
  sleep: 0.08,
  muscleLoss: 0.005,
  radiation: 0.005,
  heartRate: 0.5,
  cortisol: 0.15
};

// Generates bounded fluctuations around each variable's reference value.
export function simulateValues() {
  for (const key of Object.keys(simulatedValues)) {
    if (manualAlertOverrides.has(key)) continue;

    const variable = VARIABLES[key];
    const currentValue = simulatedValues[key];
    const variation = fluctuations[key];
    const randomChange = (Math.random() - 0.5) * 2 * variation;
    const meanReversion =
      (variable.reference - currentValue) * MEAN_REVERSION_RATE;

    simulatedValues[key] = Math.min(
      variable.max,
      Math.max(variable.min, currentValue + meanReversion + randomChange)
    );
  }

  return { ...simulatedValues };
}

// Permite modificar una variable para realizar pruebas.
export function setSimulationValue(key, value) {
  if (!(key in simulatedValues)) {
    throw new Error(`Unknown variable: ${key}`);
  }

  simulatedValues[key] = value;

  const variable = VARIABLES[key];
  if (value < variable.min || value > variable.max) {
    manualAlertOverrides.add(key);
  } else {
    manualAlertOverrides.delete(key);
  }
}
