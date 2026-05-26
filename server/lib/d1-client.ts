import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

declare global {
  interface GlobalThis {
    __CF_ENV?: Record<string, unknown>;
  }
}

let localDbInstance: Database.Database | null = null;

const getCloudflareD1Binding = (): any | null => {
  return (globalThis as any).__CF_ENV?.DB ?? null;
};

export const isCloudflareD1Available = (): boolean => {
  return !!getCloudflareD1Binding();
};

export function getD1() {
  if (localDbInstance) return localDbInstance;

  const dbDir = path.join(process.cwd(), 'data');
  const dbPath = path.join(dbDir, 'products.db');

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  localDbInstance = new Database(dbPath);
  localDbInstance.pragma('journal_mode = WAL');
  initializeSchema();

  return localDbInstance;
}

function initializeSchema() {
  if (!localDbInstance) return;

  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn('[D1] Schema file not found, creating basic schema');
    localDbInstance.exec(`
      CREATE TABLE IF NOT EXISTS products (
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
      CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
      CREATE INDEX IF NOT EXISTS idx_products_description ON products(description);
      CREATE TABLE IF NOT EXISTS compatibility (
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
      CREATE INDEX IF NOT EXISTS idx_compatibility_equipamento ON compatibility(equipamento);
      CREATE TABLE IF NOT EXISTS catalogs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        source TEXT,
        path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_catalogs_name ON catalogs(name);
    `);
    return;
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  localDbInstance.exec(schema);
}

export interface D1Product {
  id: string;
  code: string;
  description: string;
  marca?: string;
  price_distributor: number;
  price_distributor_with_ipi: number;
  price_final: number;
  price_final_with_ipi: number;
  catalog_path?: string | null;
  created_at: string;
  updated_at: string;
}

const transformD1Product = (product: any): D1Product => ({
  id: product.id,
  code: product.code,
  description: product.description,
  marca: product.marca,
  price_distributor: product.price_distributor || 0,
  price_distributor_with_ipi: product.price_distributor_with_ipi || 0,
  price_final: product.price_final || 0,
  price_final_with_ipi: product.price_final_with_ipi || 0,
  catalog_path: product.catalog_path ?? null,
  created_at: product.created_at,
  updated_at: product.updated_at,
});

const transformCompatibilityRecord = (record: any): CompatibilityRecord => ({
  id: record.id,
  equipamento: record.equipamento,
  parametro: record.parametro || undefined,
  fabricante: record.fabricante || undefined,
  modelo: record.modelo || undefined,
  acessorio: record.acessorio || undefined,
  foto_produto: record.foto_produto || undefined,
  foto_conexao: record.foto_conexao || undefined,
  observacoes: record.observacoes || undefined,
  created_at: record.created_at,
  updated_at: record.updated_at,
});

const runD1Query = async <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const db = getCloudflareD1Binding();
  if (!db) throw new Error('Cloudflare D1 binding not available');

  const stmt = db.prepare(sql);
  const result = await stmt.bind(...params).all();
  if (!result.success) {
    throw result.error ?? new Error('D1 query failed');
  }

  return (result.results || []) as T[];
};

const runD1QueryFirst = async <T = any>(sql: string, params: any[] = []): Promise<T | null> => {
  const results = await runD1Query<T>(sql, params);
  return results.length > 0 ? results[0] : null;
};

export async function getAllProducts(): Promise<D1Product[]> {
  if (isCloudflareD1Available()) {
    const products = await runD1Query<D1Product>('SELECT * FROM products ORDER BY code');
    return products.map(transformD1Product);
  }

  const db = getD1();
  const stmt = db.prepare('SELECT * FROM products ORDER BY code');
  return (stmt.all() as D1Product[]).map(transformD1Product);
}

export async function searchProducts(query: string): Promise<D1Product[]> {
  if (isCloudflareD1Available()) {
    const lower = query.toLowerCase();
    const products = await runD1Query<D1Product>(
      `SELECT * FROM products WHERE LOWER(code) LIKE ? OR LOWER(description) LIKE ? ORDER BY code LIMIT 20`,
      [`%${lower}%`, `%${lower}%`]
    );
    return products.map(transformD1Product);
  }

  const db = getD1();
  const searchTerm = `%${query.toLowerCase()}%`;
  const stmt = db.prepare(`
    SELECT * FROM products 
    WHERE LOWER(code) LIKE ? OR LOWER(description) LIKE ?
    ORDER BY code
    LIMIT 20
  `);
  return stmt.all(searchTerm, searchTerm) as D1Product[];
}

export async function getProductByCode(code: string): Promise<D1Product | null> {
  if (isCloudflareD1Available()) {
    const product = await runD1QueryFirst<D1Product>('SELECT * FROM products WHERE code = ?', [code]);
    return product ? transformD1Product(product) : null;
  }

  const db = getD1();
  const stmt = db.prepare('SELECT * FROM products WHERE code = ?');
  return stmt.get(code) as D1Product | null;
}

export async function insertProduct(product: Omit<D1Product, 'id' | 'created_at' | 'updated_at'>): Promise<D1Product> {
  if (isCloudflareD1Available()) {
    const db = getCloudflareD1Binding();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO products (code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi, catalog_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = await stmt.bind(
      product.code,
      product.description,
      product.marca || null,
      product.price_distributor,
      product.price_distributor_with_ipi,
      product.price_final,
      product.price_final_with_ipi,
      product.catalog_path || null
    ).run();
    if (!result.success) throw result.error ?? new Error('Failed to insert product into D1');
    const inserted = await getProductByCode(product.code);
    if (!inserted) throw new Error('Inserted product could not be loaded');
    return inserted;
  }

  const db = getD1();
  const stmt = db.prepare(`
    INSERT INTO products (code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi, catalog_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    product.code,
    product.description,
    product.marca || null,
    product.price_distributor,
    product.price_distributor_with_ipi,
    product.price_final,
    product.price_final_with_ipi,
    product.catalog_path || null
  );

  return (await getProductByCode(product.code))!;
}

export async function insertProducts(products: Omit<D1Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
  if (isCloudflareD1Available()) {
    const db = getCloudflareD1Binding();
    let count = 0;
    for (const item of products) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO products (code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi, catalog_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await stmt.bind(
        item.code,
        item.description,
        item.marca || null,
        item.price_distributor,
        item.price_distributor_with_ipi,
        item.price_final,
        item.price_final_with_ipi,
        item.catalog_path || null
      ).run();
      if (!result.success) throw result.error ?? new Error('Failed to insert product into D1');
      count++;
    }
    return count;
  }

  const db = getD1();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO products (code, description, marca, price_distributor, price_distributor_with_ipi, price_final, price_final_with_ipi, catalog_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items: typeof products) => {
    let count = 0;
    for (const item of items) {
      stmt.run(
        item.code,
        item.description,
        item.marca || null,
        item.price_distributor,
        item.price_distributor_with_ipi,
        item.price_final,
        item.price_final_with_ipi,
        item.catalog_path || null
      );
      count++;
    }
    return count;
  });

  return insertMany(products);
}

export async function deleteAllProducts(): Promise<number> {
  if (isCloudflareD1Available()) {
    const countRow = await runD1QueryFirst<{ count: number }>('SELECT COUNT(*) as count FROM products');
    const count = countRow?.count ?? 0;
    const stmt = getCloudflareD1Binding().prepare('DELETE FROM products');
    const result = await stmt.run();
    if (!result.success) throw result.error ?? new Error('Failed to delete all products from D1');
    return count;
  }

  const db = getD1();
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const { count } = countStmt.get() as { count: number };
  const deleteStmt = db.prepare('DELETE FROM products');
  deleteStmt.run();
  return count;
}

export async function deleteProductByCode(code: string): Promise<boolean> {
  if (isCloudflareD1Available()) {
    const stmt = getCloudflareD1Binding().prepare('DELETE FROM products WHERE code = ?');
    const result = await stmt.bind(code).run();
    if (!result.success) throw result.error ?? new Error('Failed to delete product from D1');
    return true;
  }

  const db = getD1();
  const stmt = db.prepare('DELETE FROM products WHERE code = ?');
  const result = stmt.run(code);
  return result.changes > 0;
}

export async function updateProduct(code: string, updates: Partial<Omit<D1Product, 'id' | 'created_at' | 'updated_at'>>): Promise<D1Product | null> {
  if (isCloudflareD1Available()) {
    const updateData: any = { ...updates };
    const fields: string[] = [];
    const values: any[] = [];

    if (updateData.description !== undefined) {
      fields.push('description = ?');
      values.push(updateData.description);
    }
    if (updateData.marca !== undefined) {
      fields.push('marca = ?');
      values.push(updateData.marca);
    }
    if (updateData.price_distributor !== undefined) {
      fields.push('price_distributor = ?');
      values.push(updateData.price_distributor);
    }
    if (updateData.price_distributor_with_ipi !== undefined) {
      fields.push('price_distributor_with_ipi = ?');
      values.push(updateData.price_distributor_with_ipi);
    }
    if (updateData.price_final !== undefined) {
      fields.push('price_final = ?');
      values.push(updateData.price_final);
    }
    if (updateData.price_final_with_ipi !== undefined) {
      fields.push('price_final_with_ipi = ?');
      values.push(updateData.price_final_with_ipi);
    }
    if (updateData.catalog_path !== undefined) {
      fields.push('catalog_path = ?');
      values.push(updateData.catalog_path);
    }

    if (fields.length === 0) {
      return getProductByCode(code);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(code);

    const sql = `UPDATE products SET ${fields.join(', ')} WHERE code = ?`;
    const stmt = getCloudflareD1Binding().prepare(sql);
    const result = await stmt.bind(...values).run();
    if (!result.success) throw result.error ?? new Error('Failed to update product in D1');
    return getProductByCode(code);
  }

  const db = getD1();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.marca !== undefined) {
    fields.push('marca = ?');
    values.push(updates.marca);
  }
  if (updates.price_distributor !== undefined) {
    fields.push('price_distributor = ?');
    values.push(updates.price_distributor);
  }
  if (updates.price_distributor_with_ipi !== undefined) {
    fields.push('price_distributor_with_ipi = ?');
    values.push(updates.price_distributor_with_ipi);
  }
  if (updates.price_final !== undefined) {
    fields.push('price_final = ?');
    values.push(updates.price_final);
  }
  if (updates.price_final_with_ipi !== undefined) {
    fields.push('price_final_with_ipi = ?');
    values.push(updates.price_final_with_ipi);
  }
  if (updates.catalog_path !== undefined) {
    fields.push('catalog_path = ?');
    values.push(updates.catalog_path);
  }

  if (fields.length === 0) return getProductByCode(code);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(code);

  const sql = `UPDATE products SET ${fields.join(', ')} WHERE code = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getProductByCode(code);
}

export async function getProductCount(): Promise<number> {
  if (isCloudflareD1Available()) {
    const countRow = await runD1QueryFirst<{ count: number }>('SELECT COUNT(*) as count FROM products');
    return countRow?.count ?? 0;
  }

  const db = getD1();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const { count } = stmt.get() as { count: number };
  return count;
}

export interface CompatibilityRecord {
  id: string;
  equipamento: string;
  parametro?: string;
  fabricante?: string;
  modelo?: string;
  acessorio?: string;
  foto_produto?: string;
  foto_conexao?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export async function getAllCompatibility(): Promise<CompatibilityRecord[]> {
  if (isCloudflareD1Available()) {
    const records = await runD1Query<CompatibilityRecord>('SELECT * FROM compatibility ORDER BY equipamento');
    return records.map(transformCompatibilityRecord);
  }

  const db = getD1();
  const stmt = db.prepare('SELECT * FROM compatibility ORDER BY equipamento');
  return stmt.all() as CompatibilityRecord[];
}

export async function getCompatibilityById(id: string): Promise<CompatibilityRecord | null> {
  if (isCloudflareD1Available()) {
    const record = await runD1QueryFirst<CompatibilityRecord>('SELECT * FROM compatibility WHERE id = ?', [id]);
    return record ? transformCompatibilityRecord(record) : null;
  }

  const db = getD1();
  const stmt = db.prepare('SELECT * FROM compatibility WHERE id = ?');
  return stmt.get(id) as CompatibilityRecord | null;
}

export async function insertCompatibility(record: Omit<CompatibilityRecord, 'id' | 'created_at' | 'updated_at'>): Promise<CompatibilityRecord> {
  if (isCloudflareD1Available()) {
    const stmt = getCloudflareD1Binding().prepare(`
      INSERT INTO compatibility (equipamento, parametro, fabricante, modelo, acessorio, foto_produto, foto_conexao, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = await stmt.bind(
      record.equipamento,
      record.parametro || null,
      record.fabricante || null,
      record.modelo || null,
      record.acessorio || null,
      record.foto_produto || null,
      record.foto_conexao || null,
      record.observacoes || null
    ).run();
    if (!result.success) throw result.error ?? new Error('Failed to insert compatibility record into D1');
    const inserted = await runD1QueryFirst<CompatibilityRecord>('SELECT * FROM compatibility WHERE id = last_insert_rowid()');
    if (!inserted) throw new Error('Inserted compatibility record could not be loaded');
    return transformCompatibilityRecord(inserted);
  }

  const db = getD1();
  const stmt = db.prepare(`
    INSERT INTO compatibility (equipamento, parametro, fabricante, modelo, acessorio, foto_produto, foto_conexao, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    record.equipamento,
    record.parametro || null,
    record.fabricante || null,
    record.modelo || null,
    record.acessorio || null,
    record.foto_produto || null,
    record.foto_conexao || null,
    record.observacoes || null
  );

  const lastIdResult = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
  const newRecord = await getCompatibilityById(String(lastIdResult.id));
  return newRecord || ({ equipamento: record.equipamento, fabricante: record.fabricante, modelo: record.modelo, acessorio: record.acessorio } as CompatibilityRecord);
}

export async function updateCompatibility(id: string, updates: Partial<Omit<CompatibilityRecord, 'id' | 'created_at' | 'updated_at'>>): Promise<CompatibilityRecord | null> {
  if (isCloudflareD1Available()) {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.equipamento !== undefined) {
      fields.push('equipamento = ?');
      values.push(updates.equipamento);
    }
    if (updates.parametro !== undefined) {
      fields.push('parametro = ?');
      values.push(updates.parametro);
    }
    if (updates.fabricante !== undefined) {
      fields.push('fabricante = ?');
      values.push(updates.fabricante);
    }
    if (updates.modelo !== undefined) {
      fields.push('modelo = ?');
      values.push(updates.modelo);
    }
    if (updates.acessorio !== undefined) {
      fields.push('acessorio = ?');
      values.push(updates.acessorio);
    }
    if (updates.foto_produto !== undefined) {
      fields.push('foto_produto = ?');
      values.push(updates.foto_produto);
    }
    if (updates.foto_conexao !== undefined) {
      fields.push('foto_conexao = ?');
      values.push(updates.foto_conexao);
    }
    if (updates.observacoes !== undefined) {
      fields.push('observacoes = ?');
      values.push(updates.observacoes);
    }

    if (fields.length === 0) {
      return getCompatibilityById(id);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE compatibility SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = getCloudflareD1Binding().prepare(sql);
    const result = await stmt.bind(...values).run();
    if (!result.success) throw result.error ?? new Error('Failed to update compatibility record in D1');
    return getCompatibilityById(id);
  }

  const db = getD1();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.equipamento !== undefined) {
    fields.push('equipamento = ?');
    values.push(updates.equipamento);
  }
  if (updates.parametro !== undefined) {
    fields.push('parametro = ?');
    values.push(updates.parametro);
  }
  if (updates.fabricante !== undefined) {
    fields.push('fabricante = ?');
    values.push(updates.fabricante);
  }
  if (updates.modelo !== undefined) {
    fields.push('modelo = ?');
    values.push(updates.modelo);
  }
  if (updates.acessorio !== undefined) {
    fields.push('acessorio = ?');
    values.push(updates.acessorio);
  }
  if (updates.foto_produto !== undefined) {
    fields.push('foto_produto = ?');
    values.push(updates.foto_produto);
  }
  if (updates.foto_conexao !== undefined) {
    fields.push('foto_conexao = ?');
    values.push(updates.foto_conexao);
  }
  if (updates.observacoes !== undefined) {
    fields.push('observacoes = ?');
    values.push(updates.observacoes);
  }

  if (fields.length === 0) return getCompatibilityById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const sql = `UPDATE compatibility SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(sql);
  stmt.run(...values);

  return getCompatibilityById(id);
}

export async function deleteCompatibility(id: string): Promise<boolean> {
  if (isCloudflareD1Available()) {
    const stmt = getCloudflareD1Binding().prepare('DELETE FROM compatibility WHERE id = ?');
    const result = await stmt.bind(id).run();
    if (!result.success) throw result.error ?? new Error('Failed to delete compatibility record from D1');
    return true;
  }

  const db = getD1();
  const stmt = db.prepare('DELETE FROM compatibility WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
