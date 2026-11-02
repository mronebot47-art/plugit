// vehicle presets with approx flag
export interface Vehicle {
  id: string;
  name: string;
  usableKwh: number;
  whPerKmHwy: number;
  maxDcKw: number;
  maxAcKw: number;
  massKg: number;
  connectors: string[];
  approx?: boolean;
}

export const VEHICLES: Vehicle[] = [
  {
    id: 'ather-450x',
    name: 'Ather 450X (Campus 2W Scooter)',
    usableKwh: 3.7,
    whPerKmHwy: 38,
    maxDcKw: 3.3,
    maxAcKw: 3.3,
    massKg: 108,
    connectors: ['15A Socket', 'AtherGrid', 'Type2'],
    approx: false,
  },
  {
    id: 'campus-shuttle',
    name: 'Campus Electric Shuttle / Buggy',
    usableKwh: 15,
    whPerKmHwy: 85,
    maxDcKw: 15,
    maxAcKw: 7.2,
    massKg: 850,
    connectors: ['Type2', '15A Socket'],
    approx: false,
  },
  {
    id: 'tiago-ev',
    name: 'Tata Tiago EV (Campus Fleet)',
    usableKwh: 24,
    whPerKmHwy: 120,
    maxDcKw: 25,
    maxAcKw: 3.3,
    massKg: 1235,
    connectors: ['CCS2', 'Type2'],
    approx: true,
  },
  {
    id: 'nexon-lr',
    name: 'Tata Nexon EV LR',
    usableKwh: 40,
    whPerKmHwy: 140,
    maxDcKw: 50,
    maxAcKw: 7.2,
    massKg: 1615,
    connectors: ['CCS2', 'Type2'],
    approx: true,
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
    approx: true,
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
    approx: true,
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
    approx: true,
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
    approx: true,
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
    approx: true,
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
    approx: true,
  },
];
