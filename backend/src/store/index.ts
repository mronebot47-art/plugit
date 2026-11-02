import {
  CommunityCharger,
  ChargerConfirmation,
  SEED_COMMUNITY_CHARGERS,
  SEED_CONFIRMATIONS,
} from '../data/chargers';

export interface Store {
  insertCharger(charger: CommunityCharger): Promise<void>;
  listChargersInBbox(minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<CommunityCharger[]>;
  getAllActiveChargers(): Promise<CommunityCharger[]>;
  getCharger(id: string): Promise<CommunityCharger | null>;
  updateCharger(id: string, updates: Partial<CommunityCharger>): Promise<void>;
  setStatus(id: string, status: 'unverified' | 'confirmed' | 'rejected' | 'removed'): Promise<void>;
  upsertConfirmation(conf: ChargerConfirmation): Promise<void>;
  countConfirmations(chargerId: string): Promise<{ worked: number; notWorked: number; distinctDevices: number }>;
  listConfirmations(chargerId: string): Promise<ChargerConfirmation[]>;
}

export class MemoryStore implements Store {
  private chargers = new Map<string, CommunityCharger>();
  private confirmations: ChargerConfirmation[] = [];

  constructor() {
    for (const c of SEED_COMMUNITY_CHARGERS) {
      this.chargers.set(c.id, { ...c });
    }
    for (const conf of SEED_CONFIRMATIONS) {
      this.confirmations.push({ ...conf });
    }
  }

  async insertCharger(charger: CommunityCharger): Promise<void> {
    this.chargers.set(charger.id, { ...charger });
  }

  async listChargersInBbox(minLat: number, minLng: number, maxLat: number, maxLng: number): Promise<CommunityCharger[]> {
    const res: CommunityCharger[] = [];
    for (const c of this.chargers.values()) {
      if (c.status === 'removed' || c.status === 'rejected') continue;
      if (c.lat >= minLat && c.lat <= maxLat && c.lng >= minLng && c.lng <= maxLng) {
        res.push({ ...c });
      }
    }
    return res;
  }

  async getAllActiveChargers(): Promise<CommunityCharger[]> {
    const res: CommunityCharger[] = [];
    for (const c of this.chargers.values()) {
      if (c.status === 'unverified' || c.status === 'confirmed') {
        res.push({ ...c });
      }
    }
    return res;
  }

  async getCharger(id: string): Promise<CommunityCharger | null> {
    const c = this.chargers.get(id);
    return c ? { ...c } : null;
  }

  async updateCharger(id: string, updates: Partial<CommunityCharger>): Promise<void> {
    const existing = this.chargers.get(id);
    if (!existing) return;
    this.chargers.set(id, {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async setStatus(id: string, status: 'unverified' | 'confirmed' | 'rejected' | 'removed'): Promise<void> {
    const existing = this.chargers.get(id);
    if (!existing) return;
    existing.status = status;
    existing.updatedAt = new Date().toISOString();
  }

  async upsertConfirmation(conf: ChargerConfirmation): Promise<void> {
    const idx = this.confirmations.findIndex(
      (c) => c.chargerId === conf.chargerId && c.deviceHash === conf.deviceHash
    );
    if (idx >= 0) {
      this.confirmations[idx] = { ...conf };
    } else {
      this.confirmations.push({ ...conf });
    }
  }

  async countConfirmations(chargerId: string): Promise<{ worked: number; notWorked: number; distinctDevices: number }> {
    const votes = this.confirmations.filter((c) => c.chargerId === chargerId);
    let worked = 0;
    let notWorked = 0;
    const devices = new Set<string>();

    for (const v of votes) {
      devices.add(v.deviceHash);
      if (v.worked) worked++;
      else notWorked++;
    }

    return {
      worked,
      notWorked,
      distinctDevices: devices.size,
    };
  }

  async listConfirmations(chargerId: string): Promise<ChargerConfirmation[]> {
    return this.confirmations.filter((c) => c.chargerId === chargerId).map((c) => ({ ...c }));
  }
}

// Global active store instance
export const store: Store = new MemoryStore();
