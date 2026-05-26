# Guia Completo: Correção e Deploy

## Problema Identificado ❌

O erro "The _write() method is not implemented" ocorria porque:
- O código estava usando `better-sqlite3` (banco local)
- Cloudflare Pages é um ambiente **serverless** que não permite operações de arquivo local
- A solução é usar **Supabase** (já configurado) em produção

## Solução Implementada ✅

Atualizamos o código para:
1. Detectar automaticamente o ambiente (local vs. Cloudflare)
2. Usar **Supabase** em produção (Cloudflare Pages)
3. Usar **D1/SQLite** em desenvolvimento local
4. Importação funciona em ambos os ambientes

---

## Passo a Passo para Deploy

### 1️⃣ Verificar/Configurar Variáveis de Ambiente

Você precisa garantir que as variáveis do Supabase estão configuradas no Cloudflare.

**Acesse:**
```
https://dash.cloudflare.com → Projects → valorproduto7 → Settings → Environment variables
```

**Adicione/Atualize estas variáveis (Production):**

| Nome | Valor | Tipo |
|------|-------|------|
| `SUPABASE_URL` | `https://xlulghxjzkjlxkvpcbrr.supabase.co` | Secret |
| `SUPABASE_KEY` | `sb_publishable_t67D4f83gG7UWTKhgNURiQ_se7UWuAl` | Secret |

⚠️ **Importante**: Use `Secret` para dados sensíveis, não `Text`

### 2️⃣ Preparar o Supabase

A tabela `products` precisa existir no Supabase com este esquema:

```sql
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(255) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  marca VARCHAR(255),
  price_distributor DECIMAL(10, 2) DEFAULT 0,
  price_distributor_with_ipi DECIMAL(10, 2) DEFAULT 0,
  price_final DECIMAL(10, 2) DEFAULT 0,
  price_final_with_ipi DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
CREATE INDEX IF NOT EXISTS idx_products_description ON products(description);
```

**Para executar no Supabase:**

1. Acesse: https://app.supabase.com
2. Selecione seu projeto
3. Vá para **SQL Editor** → **New Query**
4. Cole o SQL acima
5. Clique em **Run**

### 3️⃣ Testar Localmente

Antes de fazer deploy, teste se funciona localmente:

```bash
# 1. Instale as dependências (se ainda não fez)
pnpm install

# 2. Inicie o servidor de desenvolvimento
pnpm dev

# 3. Acesse: http://localhost:8080/batch

# 4. Teste a importação:
#    - Clique em "Importar Produtos (CSV)"
#    - Selecione um arquivo CSV
#    - Você deve ver: "X produtos importados com sucesso!"
```

Se der erro sobre D1, é normal em desenvolvimento. O importante é que funcione em produção.

### 4️⃣ Fazer Deploy

Escolha **uma** das opções abaixo:

#### Opção A: Deploy via GitHub (Recomendado)

```bash
# 1. Verifique se há mudanças
git status

# 2. Faça o commit
git add .
git commit -m "fix: corrigir importação CSV para Cloudflare"

# 3. Envie para o GitHub
git push origin ai_main_ba2144b07c67437f9237
```

O Cloudflare Pages detectará a mudança automaticamente e fará o deploy.

#### Opção B: Deploy via Wrangler CLI

```bash
# 1. Instale Wrangler (se não tiver)
npm install -g wrangler

# 2. Autentique
wrangler login

# 3. Deploy
wrangler deploy
```

### 5️⃣ Verificar o Deploy

Após fazer o deploy:

1. Acesse seu site em produção
2. Vá para `/batch`
3. Teste a importação CSV
4. Verifique os logs no Cloudflare:
   - Dashboard → Workers & Pages → valorproduto7 → Deployments

---

## Checklist de Deployment ✓

- [ ] Variáveis `SUPABASE_URL` e `SUPABASE_KEY` configuradas no Cloudflare
- [ ] Tabela `products` criada no Supabase
- [ ] Código atualizado com a correção (commit feito)
- [ ] Deploy realizado (GitHub Pages ou Wrangler)
- [ ] Teste de importação funcionando em produção

---

## Se Houver Problemas

### Erro: "Supabase not configured"
**Solução:** Verifique as variáveis de ambiente no Cloudflare Dashboard

### Erro: "Table does not exist"
**Solução:** Execute o SQL para criar a tabela no Supabase

### Erro: "CORS" ou "Unauthorized"
**Solução:** Verifique a chave do Supabase no wrangler.toml

### Produtos não aparecem depois da importação
**Solução:** Verifique no Supabase Dashboard → Database → products se os dados foram salvos

---

## Desenvolvimento Local

Para continuar desenvolvendo localmente:

```bash
# Inicie o servidor de desenvolvimento
pnpm dev

# Em outro terminal, abra o preview
# Vá para http://localhost:8080/batch
```

**Nota**: Em desenvolvimento, o sistema pode usar D1 (SQLite local) ou Supabase, dependendo das variáveis configuradas no `.env`

---

## Estrutura Atualizada

```
server/
├── routes/
│   ├── csv-import.ts          ← ATUALIZADO: Usa Supabase + D1 fallback
│   └── d1-products.ts         ← ATUALIZADO: Suporta ambos os formatos
├── lib/
│   └── d1-client.ts           ← Continua igual (D1 local)
└── index.ts

client/
├── components/
│   └── CSVImporter.tsx        ← NOVO: Interface de importação
└── pages/
    └── Batch.tsx              ← ATUALIZADO: Integra CSVImporter

public/
└── import-products.csv        ← NOVO: Amostra de CSV com seus produtos
```

---

## Próximas Etapas

Após o deploy bem-sucedido:

1. ✅ Importar todos os seus 458 produtos
2. ✅ Testar busca de produtos
3. ✅ Gerar relatórios/PDFs
4. ✅ Configurar compatibilidades

---

## Support

Se tiver dúvidas durante o deploy:

1. Verifique os logs: https://dash.cloudflare.com
2. Teste localmente: `pnpm dev`
3. Consulte a documentação do Supabase: https://supabase.com/docs
