-- Criar tabela de produtos
DROP TABLE IF EXISTS products;
CREATE TABLE products (
  id TEXT PRIMARY KEY,
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

CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_description ON products(description);

-- Criar tabela de compatibilidade
DROP TABLE IF EXISTS compatibility;
CREATE TABLE compatibility (
  id TEXT PRIMARY KEY,
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

CREATE INDEX idx_compatibility_equipamento ON compatibility(equipamento);

-- Criar tabela de catálogos
DROP TABLE IF EXISTS catalogs;
CREATE TABLE catalogs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT,
  path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_catalogs_name ON catalogs(name);

-- Inserir dados de exemplo
INSERT INTO products (id, code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi) VALUES
('1', 'PROD001', 'Válvula Esfera 1 polegada', 'Tigre', 45.50, 52.33, 120.00, 137.76),
('2', 'PROD002', 'Conexão PVC 90º 32mm', 'Plastifor', 12.30, 14.14, 35.50, 40.81),
('3', 'PROD003', 'Tubo PVC Soldável 25mm', 'Dura', 8.50, 9.77, 25.00, 28.75),
('4', 'PROD004', 'Junta Universal PVC', 'Krona', 5.20, 5.98, 15.00, 17.25),
('5', 'PROD005', 'Adaptador Macho PVC 20mm', 'Brasfor', 2.15, 2.47, 6.50, 7.48),
('6', 'PROD006', 'Tampa PVC 32mm', 'Plastifor', 3.80, 4.37, 11.00, 12.65),
('7', 'PROD007', 'Luva Longa PVC 20mm', 'Dura', 4.50, 5.18, 13.00, 14.95),
('8', 'PROD008', 'Tê PVC 90º 25mm', 'Tigre', 6.20, 7.13, 18.00, 20.70),
('9', 'PROD009', 'Redutor PVC 32-25mm', 'Brasfor', 5.90, 6.79, 17.00, 19.55),
('10', 'PROD010', 'Cotovelo PVC 45º 20mm', 'Krona', 3.40, 3.91, 10.00, 11.50);
