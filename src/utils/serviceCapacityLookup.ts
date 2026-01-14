import {
  SERVICE_CAPACITY_TABLES,
  SERVICE_LENGTHS,
  PressureSystem,
  ServiceLengthFt,
  ServiceType,
} from "@/src/data/serviceCapacityTables";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const normalizeLength = (input: number | string): ServiceLengthFt => {
  const rawValue = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(rawValue)) {
    return SERVICE_LENGTHS[0];
  }

  const rounded = Math.round(rawValue / 5) * 5;
  const clamped = clamp(rounded, SERVICE_LENGTHS[0], SERVICE_LENGTHS[SERVICE_LENGTHS.length - 1]);
  return clamped as ServiceLengthFt;
};

export const getCapacityRow = (
  serviceType: ServiceType,
  pressureSystem: PressureSystem,
  length: number | string,
) => {
  const table = SERVICE_CAPACITY_TABLES[serviceType]?.[pressureSystem];
  if (!table) {
    return { pipeSizes: [], row: null };
  }

  const normalizedLength = normalizeLength(length);
  return {
    pipeSizes: table.pipeSizes,
    row: table.byLength[normalizedLength] ?? null,
  };
};
