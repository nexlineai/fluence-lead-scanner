# Fluence Lead Scanner

PWA mobile-first para captura de leads em feiras (ISE 2026).  
Scan de business cards, notas de voz, formulário de leads, export Excel, multi-rep.

## Stack

- **Frontend**: HTML/CSS/JS PWA (mobile-first, offline-ready)
- **Backend**: Cloudflare Workers + D1 (SQLite)
- **Auth**: JWT (email + password)
- **OCR**: Tesseract.js (client-side)
- **Excel**: SheetJS (client-side)

## Deploy

### 1. Pré-requisitos

- Cloudflare API token com permissões: `Workers:Edit`, `Pages:Edit`, `D1:Edit`
- Node.js 20+ (opcional, para wrangler CLI)

### 2. Setup D1 Database

```bash
# Criar database
npx wrangler d1 create fluence-leads

# Aplicar schema
npx wrangler d1 execute fluence-leads --file=schema.sql
```

### 3. Configurar wrangler.toml

Editar `wrangler.toml` e definir o `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fluence-leads"
database_id = "<id-do-passos-anterior>"
```

### 4. Deploy Worker

```bash
npx wrangler deploy
```

### 5. (Opcional) Deploy Pages

Se quiser separar o frontend do Worker:

```bash
npx wrangler pages deploy . --project-name fluence-lead-scanner
```

Ou conectar o repositório GitHub diretamente no dashboard Cloudflare Pages.

## Estrutura

```
fluence-lead-scanner/
├── index.html       # PWA completa com auth + API
├── src/index.js     # Cloudflare Worker (backend)
├── schema.sql       # D1 database schema
├── wrangler.toml    # Wrangler config
└── README.md        # Este ficheiro
```

## API Endpoints

| Método | Path              | Descrição          | Auth     |
|--------|-------------------|--------------------|----------|
| POST   | /api/register     | Criar conta        | ❌       |
| POST   | /api/login        | Login (devolve JWT)| ❌       |
| GET    | /api/leads        | Listar leads       | ✅ Bearer|
| POST   | /api/leads        | Criar lead         | ✅ Bearer|
| DELETE | /api/leads/:id    | Apagar lead        | ✅ Bearer|
| DELETE | /api/leads        | Apagar todos       | ✅ Bearer|
| GET    | /api/leads/export | Exportar leads     | ✅ Bearer|
| GET    | /api/users        | Listar users       | ✅ Bearer|
