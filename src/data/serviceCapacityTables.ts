export type ServiceType = "existing" | "new";
export type PressureSystem = "low" | "intermediate" | "high";
export const SERVICE_LENGTHS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;
export type ServiceLengthFt = (typeof SERVICE_LENGTHS)[number];
export type PipeSize = string;

export interface CapacityRow {
  [pipeSize: string]: number;
}

export interface CapacityTables {
  [serviceType: string]: {
    [pressureSystem: string]: {
      pipeSizes: PipeSize[];
      byLength: Record<number, CapacityRow>;
    };
  };
}

// TODO: Replace placeholder rows with the transcribed PGW service capacity tables.
const buildPlaceholderRows = (pipeSizes: PipeSize[]) =>
  Object.fromEntries(
    SERVICE_LENGTHS.map((length) => [
      length,
      Object.fromEntries(pipeSizes.map((size) => [size, 0])),
    ]),
  ) as Record<ServiceLengthFt, CapacityRow>;

const EXISTING_LOW_PIPE_SIZES: PipeSize[] = [
  '1" CTS',
  '1 1/4" CTS',
  '1 1/4" IPS',
  '2" IPS',
  '3" IPS',
  '4" IPS',
  '6" IPS',
  '8" IPS',
];

const EXISTING_INTERMEDIATE_PIPE_SIZES: PipeSize[] = [
  '3/4" CTS',
  '1" CTS',
  '1 1/4" CTS',
  '1 1/4" IPS',
  '2" IPS',
  '3" IPS',
  '4" IPS',
  '6" IPS',
  '8" IPS',
];

const EXISTING_HIGH_PIPE_SIZES: PipeSize[] = [...EXISTING_INTERMEDIATE_PIPE_SIZES];

const NEW_LOW_PIPE_SIZES: PipeSize[] = [...EXISTING_LOW_PIPE_SIZES];
const NEW_INTERMEDIATE_PIPE_SIZES: PipeSize[] = [...EXISTING_INTERMEDIATE_PIPE_SIZES];
const NEW_HIGH_PIPE_SIZES: PipeSize[] = [...EXISTING_HIGH_PIPE_SIZES];

export const SERVICE_CAPACITY_TABLES: CapacityTables = {
  existing: {
    low: {
      pipeSizes: EXISTING_LOW_PIPE_SIZES,
      byLength: buildPlaceholderRows(EXISTING_LOW_PIPE_SIZES),
    },
    intermediate: {
      pipeSizes: EXISTING_INTERMEDIATE_PIPE_SIZES,
      byLength: buildPlaceholderRows(EXISTING_INTERMEDIATE_PIPE_SIZES),
    },
    high: {
      pipeSizes: EXISTING_HIGH_PIPE_SIZES,
      byLength: buildPlaceholderRows(EXISTING_HIGH_PIPE_SIZES),
    },
  },
  new: {
    low: {
      pipeSizes: NEW_LOW_PIPE_SIZES,
      byLength: buildPlaceholderRows(NEW_LOW_PIPE_SIZES),
    },
    intermediate: {
      pipeSizes: NEW_INTERMEDIATE_PIPE_SIZES,
      byLength: buildPlaceholderRows(NEW_INTERMEDIATE_PIPE_SIZES),
    },
    high: {
      pipeSizes: NEW_HIGH_PIPE_SIZES,
      byLength: buildPlaceholderRows(NEW_HIGH_PIPE_SIZES),
    },
  },
};
