# Mamadona's Memory — Fluence Lead Scanner

## Project Context
- **Owner:** Zé → for Andre (@maitfreak_bot)
- **Purpose:** PWA mobile-first para capturar leads em feiras (ISE 2026)
- **Constraint:** Zé insistiu — NADA no Hetzner. Cloudflare only.
- **Timeline:** Maio 2026

## Tech Stack
- **Frontend:** HTML/CSS/JS vanilla PWA (mobile-first, offline-ready)
- **Backend:** Cloudflare Worker (JWT auth + D1 CRUD)
- **Database:** Cloudflare D1 (SQLite-compatible)
- **OCR:** Tesseract.js (client-side)
- **Excel:** SheetJS (client-side)
- **Auth:** JWT (email + password, bcrypt)

## Files (github.com:nexlineai/fluence-lead-scanner)
| File | Size | Purpose |
|------|------|---------|
| `index.html` | 50KB | PWA completa — scan, voz, form, leads list, export |
| `src/index.js` | — | Cloudflare Worker — auth, CRUD, export endpoints |
| `schema.sql` | 1.4KB | D1 schema — users + leads tables |
| `wrangler.toml` | 168B | Wrangler deploy config |
| `README.md` | 2.1KB | Deploy instructions |
| `MEMORY.md` | este | Minhas notas |

## Key Decisions
1. **No Hetzner** — Zé was very clear. Everything on Cloudflare infra.
2. **JWT + bcrypt** — Simple auth without external services
3. **Worker with D1** — Single deploy, no separate backend server
4. **Tesseract.js client-side** — Saves Worker CPU, OCR happens in browser
5. **JS vanilla** — No framework, keeps deploy simple (single HTML file)

## What's Missing / Next Steps
- ❌ Cloudflare API token with Pages+Workers+D1 perms needed
- ❌ `npx wrangler d1 create fluence-leads` → get DB ID → update wrangler.toml
- ❌ `npx wrangler d1 execute fluence-leads --file=schema.sql`
- ❌ `npx wrangler deploy`
- ❌ Custom domain (fluence.nexline.ai or similar)
- ⏳ Andre coordinates changes, I push/pull as needed

## Interactions with Andre (Telegram: 2973409)
- May 21: First contact — sent him the GitHub link + status
- May 22: Full stack deployed to repo (Worker + D1 schema + auth + API)
- Instructions: Andre asks for changes, I push to repo

## Gotchas
- Zé gets angry when I contact Carapava unbidden
- Zé gets angry when I suggest Hetzner for this project
- Threshold lowered to 0.2 (200K) for compression
- RAG hook working correctly — saves to grok-knowledge-base/data/memory_rag.db
