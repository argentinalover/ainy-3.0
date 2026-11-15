export {};

import { VARIABLES } from "./variables.js";

const simulatedValues = Object.fromEntries(
  Object.entries(VARIABLES).map(([key, variable]) => [
    key,
    variable.value
  ])
);

const fluctuations = {
  microgravity: 0.00000002,
  sleep: 0.08,
  muscleLoss: 0.005,
  radiation: 0.005,
  heartRate: 0.5,
  cortisol: 0.15
};

// Genera pequeñas fluctuaciones alrededor de los valores iniciales.
export function simulateValues() {
  for (const key of Object.keys(simulatedValues)) {
    const variation = fluctuations[key];
    const randomChange = (Math.random() - 0.5) * 2 * variation;

    simulatedValues[key] += randomChange;

    if (key === "muscleLoss") {
      simulatedValues[key] = Math.max(0, simulatedValues[key]);
    }
  }

  return { ...simulatedValues };
}

// Permite modificar una variable para realizar pruebas.
export function setSimulationValue(key, value) {
  if (!(key in simulatedValues)) {
    throw new Error(`Unknown variable: ${key}`);
  }

  simulatedValues[key] = value;
}
