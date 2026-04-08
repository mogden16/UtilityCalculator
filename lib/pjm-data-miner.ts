export type FuelCategory =
  | "coal"
  | "gas"
  | "oil"
  | "nuclear"
  | "hydro"
  | "wind"
  | "solar"
  | "other";

export type PJMGenByFuelApiRecord = {
  fueltype?: string;
  fuel_type?: string;
  mw?: number | string;
  mw_total?: number | string;
  datetime_beginning_utc?: string;
  datetime_beginning_ept?: string;
  datetime?: string;
};

export type PJMGenByFuelRecord = {
  fueltype: string;
  mw: number;
  timestamp: string;
};

type ApiItemsResponse = { [key: string]: unknown };

export class PJMDataMinerClient {
  private readonly baseUrl = "https://api.pjm.com/api/v1";
  private readonly token: string | undefined;

  constructor(options: { token?: string } = {}) {
    this.token = options.token ?? process.env.PJM_DATAMINER_API_KEY;
  }

  async getGenByFuelLatest(signal?: AbortSignal): Promise<PJMGenByFuelRecord[]> {
    const data = await this.fetchJson<ApiItemsResponse | PJMGenByFuelApiRecord[]>(
      "gen_by_fuel?rowCount=50",
      signal,
    );

    const items = this.extractItems(data);
    if (!items.length) {
      return [];
    }

    return items
      .map((item) => this.normalizeGenByFuelRecord(item))
      .filter((record): record is PJMGenByFuelRecord => Boolean(record));
  }

  // Placeholder methods for future endpoints
  async getLoad(_signal?: AbortSignal): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  async getLMP(_signal?: AbortSignal): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  async getRenewables(_signal?: AbortSignal): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  private async fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (!this.token) {
      throw new Error("PJM Data Miner API token is not configured.");
    }

    const response = await fetch(`${this.baseUrl}/${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`PJM Data Miner request failed with status ${response.status}`);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new Error("Invalid JSON received from PJM Data Miner API");
    }
  }

  private extractItems(data: ApiItemsResponse | PJMGenByFuelApiRecord[]): PJMGenByFuelApiRecord[] {
    if (Array.isArray(data)) {
      return data;
    }

    const values = Object.values(data);
    const list = values.find((value): value is PJMGenByFuelApiRecord[] => Array.isArray(value));
    return list ?? [];
  }

  private normalizeGenByFuelRecord(record: PJMGenByFuelApiRecord): PJMGenByFuelRecord | null {
    const fueltype = (record.fueltype ?? record.fuel_type ?? "").toString().trim();
    const mwRaw = record.mw ?? record.mw_total;
    const timestamp =
      record.datetime_beginning_utc ?? record.datetime_beginning_ept ?? record.datetime ?? "";

    const mw = typeof mwRaw === "string" ? Number(mwRaw.replace(/,/g, "")) : Number(mwRaw ?? 0);

    if (!fueltype || !Number.isFinite(mw) || !timestamp) {
      return null;
    }

    return {
      fueltype,
      mw,
      timestamp,
    };
  }
}
