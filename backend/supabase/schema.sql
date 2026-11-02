-- PlugIt Community Chargers Schema
CREATE TABLE IF NOT EXISTS community_chargers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  connectors JSONB NOT NULL,
  access TEXT NOT NULL DEFAULT 'public_paid',
  price_note TEXT,
  hours TEXT,
  public_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'unverified', -- 'unverified' | 'confirmed' | 'rejected' | 'removed'
  owner_hash TEXT NOT NULL,
  edit_token_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS charger_confirmations (
  charger_id TEXT NOT NULL REFERENCES community_chargers(id) ON DELETE CASCADE,
  device_hash TEXT NOT NULL,
  worked BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (charger_id, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_community_chargers_status ON community_chargers(status);
CREATE INDEX IF NOT EXISTS idx_community_chargers_coords ON community_chargers(lat, lng);
