import type { Station, Connector, ConnectorType } from '@/lib/types';

/** Raw shape from Open Charge Map /v3/poi compact=true */
interface OCMRaw {
  ID: number;
  AddressInfo: {
    Title: string;
    AddressLine1?: string;
    Town?: string;
    StateOrProvince?: string;
    Latitude: number;
    Longitude: number;
  };
  OperatorInfo?: { Title?: string };
  Connections?: Array<{
    ConnectionTypeID?: number;
    PowerKW?: number;
    Quantity?: number;
    StatusTypeID?: number;
  }>;
  StatusTypeID?: number;
  DateLastVerified?: string;
}

// OCM ConnectionTypeID → our ConnectorType
const CONNECTION_MAP: Record<number, ConnectorType> = {
  25:  'CCS2',
  33:  'CCS2',       // CCS (Type 2)
  2:   'CHAdeMO',
  1:   'Type2',
  36:  'Type2',      // IEC 62196-2 Type 2
  32:  'CCS2',
  30:  'GBT',
  28:  'GBT',
  29:  'BharatDC001',
  72:  'BharatAC001',
  0:   'ThreePin',
};

function mapConnectorType(id?: number): ConnectorType {
  if (!id) return 'Type2';
  return CONNECTION_MAP[id] ?? 'Type2';
}

function mapStatus(raw: OCMRaw): Station['status'] {
  const sid = raw.StatusTypeID;
  if (sid === 50) return 'working';
  if (sid === 75 || sid === 100 || sid === 200) return 'down';
  return 'unknown';
}

export function normalizeOCMStation(raw: OCMRaw): Station {
  const connectors: Connector[] = (raw.Connections ?? []).map(c => ({
    type: mapConnectorType(c.ConnectionTypeID),
    kw: c.PowerKW ?? 7.2,
    qty: c.Quantity ?? 1,
  }));

  const maxKw = connectors.reduce((m, c) => Math.max(m, c.kw), 0);

  return {
    id: `ocm-${raw.ID}`,
    name: raw.AddressInfo.Title,
    operator: raw.OperatorInfo?.Title ?? 'Unknown',
    lat: raw.AddressInfo.Latitude,
    lng: raw.AddressInfo.Longitude,
    address: [
      raw.AddressInfo.AddressLine1,
      raw.AddressInfo.Town,
      raw.AddressInfo.StateOrProvince,
    ]
      .filter(Boolean)
      .join(', '),
    connectors,
    maxKw,
    status: mapStatus(raw),
    source: 'ocm',
    lastVerified: raw.DateLastVerified ?? undefined,
  };
}

export function normalizeOCMResponse(data: unknown): Station[] {
  if (!Array.isArray(data)) return [];
  return (data as OCMRaw[]).map(normalizeOCMStation);
}
