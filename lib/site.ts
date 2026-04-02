export const TOOL_ROUTES = [
  {
    href: "/",
    label: "Overview",
    shortLabel: "Overview",
    description: "Landing page for the static engineering toolkit.",
    icon: "calculator",
  },
  {
    href: "/load-converter",
    label: "Load Converter",
    shortLabel: "Converter",
    description: "Convert between input fuel, delivered output, and common thermal demand units.",
    icon: "calculator",
  },
  {
    href: "/energy-cost-comparison",
    label: "Energy Cost Comparison",
    shortLabel: "Cost Compare",
    description: "Normalize utility rates to delivered MMBtu and compare heating options fairly.",
    icon: "scale",
  },
  {
    href: "/load-estimator",
    label: "Load Estimator",
    shortLabel: "Load Estimator",
    description: "Rule-of-thumb screening tool for heating and cooling demand with explicit assumptions.",
    icon: "thermometer",
  },
  {
    href: "/gas-flow",
    label: "Gas Flow",
    shortLabel: "Gas Flow",
    description: "Translate thermal demand into gas flow rates such as CFH, MCFH, therm per hour, and Dth per hour.",
    icon: "flame",
  },
  {
    href: "/unit-conversions",
    label: "Unit Conversions",
    shortLabel: "Conversions",
    description: "General engineering conversions for energy, power, temperature, flow, and pressure.",
    icon: "gauge",
  },
] as const;
