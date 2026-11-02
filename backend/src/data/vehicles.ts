// approximate, verify against manufacturer specs before the pitch
export interface Vehicle {
  id: string;
  name: string;
  usableKwh: number;
  whPerKmHwy: number;
  maxDcKw: number;
  maxAcKw: number;
  massKg: number;
  connectors: string[];
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'nexon-lr',
    name: 'Tata Nexon EV LR',
    usableKwh: 40,
    whPerKmHwy: 140,
    maxDcKw: 50,
    maxAcKw: 7.2,
    massKg: 1615,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'punch-lr',
    name: 'Tata Punch EV LR',
    usableKwh: 35,
    whPerKmHwy: 135,
    maxDcKw: 25,
    maxAcKw: 7.2,
    massKg: 1365,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'mg-zs',
    name: 'MG ZS EV',
    usableKwh: 50,
    whPerKmHwy: 160,
    maxDcKw: 76,
    maxAcKw: 11,
    massKg: 1700,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'mg-windsor',
    name: 'MG Windsor EV',
    usableKwh: 38,
    whPerKmHwy: 140,
    maxDcKw: 50,
    maxAcKw: 7.2,
    massKg: 1650,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'xuv400',
    name: 'Mahindra XUV400',
    usableKwh: 39,
    whPerKmHwy: 150,
    maxDcKw: 50,
    maxAcKw: 7.2,
    massKg: 1630,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'ioniq5',
    name: 'Hyundai Ioniq 5',
    usableKwh: 72,
    whPerKmHwy: 180,
    maxDcKw: 220,
    maxAcKw: 11,
    massKg: 1995,
    connectors: ['CCS2', 'Type2'],
  },
  {
    id: 'byd-atto3',
    name: 'BYD Atto 3',
    usableKwh: 60,
    whPerKmHwy: 170,
    maxDcKw: 80,
    maxAcKw: 11,
    massKg: 1750,
    connectors: ['CCS2', 'Type2'],
  },
];
