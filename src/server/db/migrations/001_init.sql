-- 001_init: core schema (ARCHITECTURE §5).
-- Quantities are INTEGERS in base units (piece / g / ml). Timestamps are ISO-8601 UTC text.
-- Every tenant table carries shop_id. IDs are app-generated UUID text.

CREATE TABLE shops (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  default_language TEXT NOT NULL DEFAULT 'en' CHECK (default_language IN ('en', 'hi', 'te')),
  lead_time_days   INTEGER NOT NULL DEFAULT 2 CHECK (lead_time_days >= 0),
  cover_days       INTEGER NOT NULL DEFAULT 7 CHECK (cover_days >= 0),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL REFERENCES shops (id),
  username   TEXT NOT NULL COLLATE NOCASE UNIQUE,
  pin_hash   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE products (
  id                 TEXT PRIMARY KEY,
  shop_id            TEXT NOT NULL REFERENCES shops (id),
  name               TEXT NOT NULL,
  base_unit          TEXT NOT NULL CHECK (base_unit IN ('piece', 'g', 'ml')),
  display_unit       TEXT NOT NULL,  -- universal or pack unit name; validated in the domain layer
  stock_base         INTEGER NOT NULL DEFAULT 0 CHECK (stock_base >= 0),  -- cached; ledger is truth
  low_threshold_base INTEGER CHECK (low_threshold_base IS NULL OR low_threshold_base >= 0),
  archived_at        TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX products_shop_name_uq ON products (shop_id, name COLLATE NOCASE);

-- Pack units only (bag, box, carton...). Universal units (kg, litre, dozen...) live in code.
-- There is deliberately NO default factor: a row exists only when configured or taught.
CREATE TABLE product_units (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  unit        TEXT NOT NULL,
  factor_base INTEGER NOT NULL CHECK (factor_base > 0),
  source      TEXT NOT NULL CHECK (source IN ('seed', 'taught', 'manual')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (product_id, unit)
);

CREATE TABLE product_aliases (
  id         TEXT PRIMARY KEY,
  shop_id    TEXT NOT NULL REFERENCES shops (id),
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  alias      TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  lang       TEXT,
  source     TEXT NOT NULL CHECK (source IN ('seed', 'learned', 'manual')),
  use_count  INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (shop_id, alias_norm)
);
CREATE INDEX product_aliases_product_idx ON product_aliases (product_id);

-- Audit log of every voice/typed interaction. Declared before inventory_transactions (FK target).
CREATE TABLE voice_events (
  id                 TEXT PRIMARY KEY,
  shop_id            TEXT NOT NULL REFERENCES shops (id),
  user_id            TEXT NOT NULL REFERENCES users (id),
  parent_event_id    TEXT REFERENCES voice_events (id),  -- clarification chain
  transcript         TEXT NOT NULL,
  stt_engine         TEXT NOT NULL CHECK (stt_engine IN ('web_speech', 'typed', 'server')),
  stt_alternatives   TEXT CHECK (stt_alternatives IS NULL OR json_valid(stt_alternatives)),
  stt_confidence     REAL,
  detected_language  TEXT,
  interpreter        TEXT CHECK (interpreter IS NULL OR interpreter IN ('llm', 'fallback')),
  llm_model          TEXT,
  raw_interpretation TEXT CHECK (raw_interpretation IS NULL OR json_valid(raw_interpretation)),
  plan               TEXT CHECK (plan IS NULL OR json_valid(plan)),  -- ValidatedPlan when applicable
  tier               TEXT CHECK (tier IS NULL OR tier IN ('T0', 'T1', 'T2', 'T3')),
  status             TEXT NOT NULL CHECK (status IN
                       ('answered', 'pending_confirm', 'needs_clarification', 'applied', 'cancelled', 'failed', 'expired')),
  error              TEXT,
  latency_ms         INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at        TEXT
);
CREATE INDEX voice_events_shop_created_idx ON voice_events (shop_id, created_at);
CREATE INDEX voice_events_parent_idx ON voice_events (parent_event_id);

-- Append-only ledger. stock_base on products must always equal SUM(delta_base) for the product.
CREATE TABLE inventory_transactions (
  id               TEXT PRIMARY KEY,
  shop_id          TEXT NOT NULL REFERENCES shops (id),
  product_id       TEXT NOT NULL REFERENCES products (id),
  type             TEXT NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment', 'opening', 'reversal')),
  delta_base       INTEGER NOT NULL,  -- signed, base units
  stock_after_base INTEGER NOT NULL CHECK (stock_after_base >= 0),
  qty_entered      REAL,              -- what the user said (audit/display)
  unit_entered     TEXT,
  unit_price_paise INTEGER CHECK (unit_price_paise IS NULL OR unit_price_paise >= 0),
  source           TEXT NOT NULL CHECK (source IN ('voice', 'manual', 'seed', 'undo')),
  voice_event_id   TEXT REFERENCES voice_events (id),
  reverses_txn_id  TEXT UNIQUE REFERENCES inventory_transactions (id),  -- a transaction can be reversed once
  note             TEXT,
  created_by       TEXT REFERENCES users (id),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX txns_product_created_idx ON inventory_transactions (product_id, created_at);
CREATE INDEX txns_shop_created_idx ON inventory_transactions (shop_id, created_at);

-- Enforce append-only at the database level (undo = compensating reversal row, never an edit).
CREATE TRIGGER inventory_transactions_no_update
BEFORE UPDATE ON inventory_transactions
BEGIN
  SELECT RAISE(ABORT, 'inventory_transactions is append-only');
END;

CREATE TRIGGER inventory_transactions_no_delete
BEFORE DELETE ON inventory_transactions
BEGIN
  SELECT RAISE(ABORT, 'inventory_transactions is append-only');
END;
