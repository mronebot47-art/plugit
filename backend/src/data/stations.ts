export interface Connector {
  type: string;
  kw: number;
  qty: number;
}

export interface Station {
  id: string;
  name: string;
  operator: string;
  lat: number;
  lng: number;
  address: string;
  connectors: Connector[];
  maxKw: number;
  status: 'working' | 'down' | 'unknown';
  source: 'live' | 'cache' | 'fixture';
  probFree: number;
  distanceAlongRoute?: number;
  detourKm?: number;
  detourMin?: number;
  usageCost?: string;
  lastReport?: string;
  availability: {
    probFree: number;
    label: string;
    forecast12h: number[];
  };
}

export const STATIONS: Station[] = [
  {
    id: 'blr-1',
    name: 'Tata Power EZ Charge - MG Road Metro',
    operator: 'Tata Power EZ Charge',
    lat: 12.9756,
    lng: 77.6097,
    address: 'MG Road Metro Station Parking, Bengaluru, Karnataka',
    connectors: [
      { type: 'CCS2', kw: 60, qty: 2 },
      { type: 'Type2', kw: 7.2, qty: 2 },
    ],
    maxKw: 60,
    status: 'working',
    source: 'fixture',
    probFree: 0.82,
    availability: {
      probFree: 0.82,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'blr-2',
    name: 'Statiq Fast Hub - Electronic City Phase 1',
    operator: 'Statiq',
    lat: 12.8452,
    lng: 77.6602,
    address: 'Velankani Tech Park, Hosur Rd, Bengaluru, Karnataka',
    connectors: [
      { type: 'CCS2', kw: 120, qty: 4 },
      { type: 'Type2', kw: 22, qty: 2 },
    ],
    maxKw: 120,
    status: 'working',
    source: 'fixture',
    probFree: 0.65,
    availability: {
      probFree: 0.65,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'blr-3',
    name: 'Zeon Charging - Attibele Toll Plaza',
    operator: 'Zeon',
    lat: 12.7785,
    lng: 77.7712,
    address: 'NH 44, Attibele, Karnataka',
    connectors: [{ type: 'CCS2', kw: 50, qty: 2 }],
    maxKw: 50,
    status: 'working',
    source: 'fixture',
    probFree: 0.74,
    availability: {
      probFree: 0.74,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'hosur-1',
    name: 'Jio-bp pulse - Hosur Highway Hub',
    operator: 'Jio-bp pulse',
    lat: 12.7354,
    lng: 77.8324,
    address: 'NH 44, Hosur Bypass, Tamil Nadu',
    connectors: [
      { type: 'CCS2', kw: 60, qty: 2 },
      { type: 'BharatDC001', kw: 15, qty: 1 },
    ],
    maxKw: 60,
    status: 'working',
    source: 'fixture',
    probFree: 0.58,
    availability: {
      probFree: 0.58,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'krishnagiri-1',
    name: 'ChargeZone - Highway Plaza Krishnagiri',
    operator: 'ChargeZone',
    lat: 12.5266,
    lng: 78.2144,
    address: 'Near Krishnagiri Toll Plaza, NH 44, Tamil Nadu',
    connectors: [{ type: 'CCS2', kw: 60, qty: 4 }],
    maxKw: 60,
    status: 'working',
    source: 'fixture',
    probFree: 0.7,
    availability: {
      probFree: 0.7,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'krishnagiri-2',
    name: 'Tata Power Fast Hub - Krishnagiri',
    operator: 'Tata Power EZ Charge',
    lat: 12.518,
    lng: 78.225,
    address: 'Hotel Saravana Bhavan Complex, NH 44, Krishnagiri',
    connectors: [{ type: 'CCS2', kw: 30, qty: 2 }],
    maxKw: 30,
    status: 'working',
    source: 'fixture',
    probFree: 0.45,
    availability: {
      probFree: 0.45,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'ambur-1',
    name: 'Zeon Charging - Star Biryani Ambur',
    operator: 'Zeon',
    lat: 12.7915,
    lng: 78.7165,
    address: 'NH 48, Ambur, Tamil Nadu',
    connectors: [{ type: 'CCS2', kw: 50, qty: 2 }],
    maxKw: 50,
    status: 'working',
    source: 'fixture',
    probFree: 0.62,
    availability: {
      probFree: 0.62,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'vellore-1',
    name: 'Statiq Superhub - Vellore Bypass',
    operator: 'Statiq',
    lat: 12.9165,
    lng: 79.1325,
    address: 'Near Green Circle, NH 48, Vellore, Tamil Nadu',
    connectors: [
      { type: 'CCS2', kw: 120, qty: 4 },
      { type: 'Type2', kw: 11, qty: 2 },
    ],
    maxKw: 120,
    status: 'working',
    source: 'fixture',
    probFree: 0.78,
    availability: {
      probFree: 0.78,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'kanchipuram-1',
    name: 'Tata Power - Sriperumbudur Corridor',
    operator: 'Tata Power EZ Charge',
    lat: 12.9692,
    lng: 79.9458,
    address: 'NH 48, Sriperumbudur Industrial Hub, Tamil Nadu',
    connectors: [{ type: 'CCS2', kw: 60, qty: 2 }],
    maxKw: 60,
    status: 'working',
    source: 'fixture',
    probFree: 0.55,
    availability: {
      probFree: 0.55,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'chennai-1',
    name: 'Jio-bp pulse - Guindy Hub',
    operator: 'Jio-bp pulse',
    lat: 13.0067,
    lng: 80.2023,
    address: 'Anna Salai, Guindy, Chennai, Tamil Nadu',
    connectors: [
      { type: 'CCS2', kw: 60, qty: 4 },
      { type: 'Type2', kw: 22, qty: 2 },
    ],
    maxKw: 60,
    status: 'working',
    source: 'fixture',
    probFree: 0.85,
    availability: {
      probFree: 0.85,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
  {
    id: 'chennai-2',
    name: 'Zeon Marina - Santhome High Road',
    operator: 'Zeon',
    lat: 13.0334,
    lng: 80.2785,
    address: 'Near Marina Beach, Mylapore, Chennai, Tamil Nadu',
    connectors: [{ type: 'CCS2', kw: 50, qty: 2 }],
    maxKw: 50,
    status: 'working',
    source: 'fixture',
    probFree: 0.9,
    availability: {
      probFree: 0.9,
      label: 'Estimated',
      forecast12h: [0.8, 0.75, 0.6, 0.45, 0.5, 0.7, 0.85, 0.9, 0.8, 0.65, 0.5, 0.7],
    },
  },
];
