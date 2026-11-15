export {};

// Variables fisiológicas y ambientales iniciales de Ainy.
// Los rangos son referencias de simulación, no umbrales médicos certificados.

export const VARIABLES = {
  microgravity: {
    name: "Microgravity",
    label: "Microgravedad",
    indicatorColor: "#c78400",
    value: 0.000001,
    unit: "g",
    min: 0,
    max: 0.0001,
    reference: 0.000001
  },

  sleep: {
    name: "Sleep",
    label: "Sueño",
    indicatorColor: "#b79ae8",
    value: 7.5,
    unit: "hours",
    min: 7,
    max: 9,
    reference: 7.5
  },

  muscleLoss: {
    name: "Muscle Loss",
    label: "Pérdida muscular",
    indicatorColor: "#c78400",
    value: 0,
    unit: "%",
    min: 0,
    max: 5,
    reference: 0
  },

  radiation: {
    name: "Radiation",
    label: "Radiación",
    indicatorColor: "#42b85a",
    value: 0.3,
    unit: "mSv/day",
    min: 0,
    max: 1,
    reference: 0.3
  },

  heartRate: {
    name: "Heart Rate",
    label: "Ritmo cardíaco",
    indicatorColor: "#dc143c",
    value: 72,
    unit: "bpm",
    min: 60,
    max: 100,
    reference: 72
  },

  cortisol: {
    name: "Cortisol",
    label: "Cortisol",
    indicatorColor: "#73d2f3",
    value: 12,
    unit: "µg/dL",
    min: 5,
    max: 25,
    reference: 12
  }
};
