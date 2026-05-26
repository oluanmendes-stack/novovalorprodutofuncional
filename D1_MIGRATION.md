# Migration from Supabase to D1

## Overview
Este documento descreve a migração completa do banco de dados Supabase para D1 (SQLite) no projeto.

## Mudanças Realizadas

### 1. Backend
- **`server/db/schema.sql`**: Schema SQL para a tabela `products` em D1
- **`server/lib/d1-client.ts`**: Cliente D1 com funcionalidades CRUD
- **`server/routes/d1-products.ts`**: Rotas de produtos usando D1 em vez de Supabase
- **`server/index.ts`**: Atualizado para usar rotas D1 em vez de Supabase

### 2. Frontend
- **`client/lib/d1.ts`**: Biblioteca de cliente para D1 (substituindo supabase.ts)
- **`client/hooks/useProducts.ts`**: Atualizado para usar D1
- **`client/hooks/useSupabaseProducts.ts`**: Atualizado para usar D1
- **`client/hooks/useSupabaseBatch.ts`**: Atualizado para usar D1

## Estrutura do Banco de Dados

### Tabela: products
```sql
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
  created_at DATETIME,
  updated_at DATETIME
);
```

## Endpoints da API

Todos os endpoints de produtos foram migrados para usar D1:

- `GET /api/products` - Lista todos os produtos
- `GET /api/products/search?q=...` - Busca produtos por código/descrição
- `GET /api/products/:code` - Obtém um produto específico
- `POST /api/products/import` - Importa produtos em lote
- `DELETE /api/products/delete-all` - Deleta todos os produtos

## Dados Persistentes

- Em desenvolvimento: Os produtos são armazenados em `data/products.db` (SQLite)
- Em produção (Cloudflare Workers): Usar D1 binding

## Configuração para Produção

Para usar D1 em Cloudflare Workers, você precisa:

1. Criar um banco de dados D1
2. Executar as migrações SQL
3. Configurar o binding no `wrangler.toml`

Exemplo de `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "products"
database_id = "seu-database-id"
```

Então, na sua função do Workers:
```typescript
import { getD1 } from './server/lib/d1-client';

export default {
  async fetch(request, env, ctx) {
    // D1 será vinculado via env.DB
    const db = env.DB;
    // ... use db
  }
}
```

## Removendo Dependências Supabase (Opcional)

Você pode remover as dependências do Supabase se não as usar em outras partes:

```bash
npm uninstall @supabase/supabase-js
```

Note: Mantenha supabase-js se ainda estiver usando Supabase para outras funcionalidades (storage, compatibility, etc).

## Variáveis de Ambiente

As seguintes variáveis de ambiente do Supabase não são mais necessárias:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

## Testes

Para testar a migração:

1. Importar produtos via CSV usando `/api/products/import`
2. Verificar se aparecem em `/api/products`
3. Testar busca em `/api/products/search`
4. Testar obtenção de um produto específico em `/api/products/:code`
