import crypto from 'crypto';

export interface ConnectorItem {
  type: string;
  kw: number;
  qty: number;
}

export interface CommunityCharger {
  id: string; // 'community:<uuid>'
  name: string;
  lat: number;
  lng: number;
  address?: string;
  connectors: ConnectorItem[];
  access: 'public_free' | 'public_paid';
  priceNote?: string;
  hours?: string;
  publicConfirmed: boolean;
  status: 'unverified' | 'confirmed' | 'rejected' | 'removed';
  ownerHash: string;
  editTokenHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChargerConfirmation {
  chargerId: string;
  deviceHash: string;
  worked: boolean;
  createdAt: string;
}

const DEVICE_ID_SALT = process.env.DEVICE_ID_SALT || 'plugit-salt-v1';

export function hashDeviceId(deviceId: string): string {
  return crypto.createHash('sha256').update(DEVICE_ID_SALT + deviceId).digest('hex');
}

export function hashEditToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// 4 Pre-seeded Bengaluru Community Chargers (2 confirmed, 2 unverified)
export const SEED_COMMUNITY_CHARGERS: CommunityCharger[] = [
  {
    id: 'community:b0000001-0000-4000-8000-000000000001',
    name: 'Toit Brewpub Parking Fast Charger',
    lat: 12.9793,
    lng: 77.6406,
    address: '100 Feet Rd, Indiranagar, Bengaluru, Karnataka 560038',
    connectors: [{ type: 'CCS2', kw: 60, qty: 2 }],
    access: 'public_paid',
    priceNote: 'Rs 19/kWh + parking',
    hours: '11:00 AM - 11:30 PM',
    publicConfirmed: true,
    status: 'confirmed',
    ownerHash: hashDeviceId('seed-device-1'),
    editTokenHash: hashEditToken('token-seed-0000000000000000000001'),
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
  },
  {
    id: 'community:b0000002-0000-4000-8000-000000000002',
    name: 'Koramangala BDA Complex Hub',
    lat: 12.9345,
    lng: 77.6256,
    address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru, Karnataka 560034',
    connectors: [
      { type: 'CCS2', kw: 50, qty: 2 },
      { type: 'Type2', kw: 7.2, qty: 2 },
    ],
    access: 'public_paid',
    priceNote: 'Rs 18/kWh',
    hours: '24/7',
    publicConfirmed: true,
    status: 'confirmed',
    ownerHash: hashDeviceId('seed-device-2'),
    editTokenHash: hashEditToken('token-seed-0000000000000000000002'),
    createdAt: '2026-11-01T09:30:00.000Z',
    updatedAt: '2026-11-01T14:15:00.000Z',
  },
  {
    id: 'community:b0000003-0000-4000-8000-000000000003',
    name: 'HSR 27th Main Community Plug',
    lat: 12.9116,
    lng: 77.6474,
    address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka 560102',
    connectors: [{ type: 'CCS2', kw: 30, qty: 1 }],
    access: 'public_free',
    priceNote: 'Free charging courtesy of local co-working space',
    hours: '9:00 AM - 9:00 PM',
    publicConfirmed: true,
    status: 'unverified',
    ownerHash: hashDeviceId('seed-device-3'),
    editTokenHash: hashEditToken('token-seed-0000000000000000000003'),
    createdAt: '2026-11-02T04:00:00.000Z',
    updatedAt: '2026-11-02T04:00:00.000Z',
  },
  {
    id: 'community:b0000004-0000-4000-8000-000000000004',
    name: 'Whitefield Nexus Shantiniketan Point',
    lat: 12.9892,
    lng: 77.7282,
    address: 'Whitefield Main Rd, Thigalarapalya, Bengaluru, Karnataka 560067',
    connectors: [{ type: 'Type2', kw: 22, qty: 2 }],
    access: 'public_paid',
    priceNote: 'Standard mall EV tariffs',
    hours: '10:00 AM - 10:00 PM',
    publicConfirmed: true,
    status: 'unverified',
    ownerHash: hashDeviceId('seed-device-4'),
    editTokenHash: hashEditToken('token-seed-0000000000000000000004'),
    createdAt: '2026-11-02T05:15:00.000Z',
    updatedAt: '2026-11-02T05:15:00.000Z',
  },
];

export const SEED_CONFIRMATIONS: ChargerConfirmation[] = [
  // 2 votes for charger 1
  {
    chargerId: 'community:b0000001-0000-4000-8000-000000000001',
    deviceHash: hashDeviceId('verifier-dev-1'),
    worked: true,
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    chargerId: 'community:b0000001-0000-4000-8000-000000000001',
    deviceHash: hashDeviceId('verifier-dev-2'),
    worked: true,
    createdAt: '2026-11-01T11:00:00.000Z',
  },
  // 2 votes for charger 2
  {
    chargerId: 'community:b0000002-0000-4000-8000-000000000002',
    deviceHash: hashDeviceId('verifier-dev-3'),
    worked: true,
    createdAt: '2026-11-01T13:00:00.000Z',
  },
  {
    chargerId: 'community:b0000002-0000-4000-8000-000000000002',
    deviceHash: hashDeviceId('verifier-dev-4'),
    worked: true,
    createdAt: '2026-11-01T14:00:00.000Z',
  },
  // 1 vote for charger 3 (not enough for confirmed yet)
  {
    chargerId: 'community:b0000003-0000-4000-8000-000000000003',
    deviceHash: hashDeviceId('verifier-dev-5'),
    worked: true,
    createdAt: '2026-11-02T04:30:00.000Z',
  },
];
