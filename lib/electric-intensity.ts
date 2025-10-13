import { BTU_PER_KW } from "@/lib/energy";

const GRAMS_PER_POUND = 453.59237;
const KWH_PER_MMBTU = 1_000_000 / BTU_PER_KW;
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

export type ElectricIntensityData = {
  zone: string;
  gCO2PerKWh: number;
  lbPerMMBtu: number;
  window: string;
  samples: number;
};

type CacheEntry = {
  expiresAt: number;
  data: ElectricIntensityData;
};

const intensityCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<ElectricIntensityData>>();

function buildUrl(zone: string) {
  const query = new URLSearchParams({ zone });
  return `/api/electricity?${query.toString()}`;
}

export async function getElectricIntensity(zone: string): Promise<ElectricIntensityData> {
  const normalized = zone.trim().toUpperCase();
  if (!normalized) {
    throw new Error("A valid ISO zone is required");
  }

  const now = Date.now();
  const cached = intensityCache.get(normalized);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const inFlight = pendingRequests.get(normalized);
  if (inFlight) {
    return inFlight;
  }

  const request = fetch(buildUrl(normalized))
    .then(async (response) => {
      if (!response.ok) {
        let message = `Electricity lookup failed (${response.status})`;
        try {
          const body = await response.json();
          if (typeof body?.error === "string" && body.error.trim()) {
            message = body.error;
          }
        } catch (error) {
          // Ignore non-JSON payloads and use the default message
        }
        throw new Error(message);
      }

      const payload = await response.json();
      const gCO2PerKWh = Number(payload?.carbonIntensity);
      if (!Number.isFinite(gCO2PerKWh)) {
        throw new Error("Electricity data did not include a carbon intensity value");
      }

      const kWhPerMMBtu = KWH_PER_MMBTU;
      const gramsPerMMBtu = gCO2PerKWh * kWhPerMMBtu;
      const lbPerMMBtu = gramsPerMMBtu / GRAMS_PER_POUND;

      const sampleCount = Number(payload?.sampleCount);
      const data: ElectricIntensityData = {
        zone: typeof payload?.zone === "string" ? payload.zone : normalized,
        gCO2PerKWh,
        lbPerMMBtu,
        window: typeof payload?.window === "string" ? payload.window : "30d",
        samples: Number.isFinite(sampleCount) ? sampleCount : 0,
      };

      intensityCache.set(normalized, {
        data,
        expiresAt: now + CACHE_TTL_MS,
      });

      return data;
    })
    .finally(() => {
      pendingRequests.delete(normalized);
    });

  pendingRequests.set(normalized, request);

  return request;
}
