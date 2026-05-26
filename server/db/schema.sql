-- Products table schema for D1 SQLite
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  marca TEXT,
  price_distributor REAL DEFAULT 0,
  price_distributor_with_ipi REAL DEFAULT 0,
  price_final REAL DEFAULT 0,
  price_final_with_ipi REAL DEFAULT 0,
  catalog_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_description ON products(description);

-- Compatibility table (from Supabase)
CREATE TABLE IF NOT EXISTS compatibility (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  equipamento TEXT NOT NULL,
  parametro TEXT,
  fabricante TEXT,
  modelo TEXT,
  acessorio TEXT,
  foto_produto TEXT,
  foto_conexao TEXT,
  observacoes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compatibility_equipamento ON compatibility(equipamento);

-- Catalogs table (for product catalog tracking)
CREATE TABLE IF NOT EXISTS catalogs (
  id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
  name TEXT NOT NULL,
  source TEXT,
  path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_catalogs_name ON catalogs(name);
