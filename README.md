# 🔑 VAE Manager

Personal workshop manager for electric vehicles (e-bikes, e-scooters, electric mopeds, lithium batteries for vehicles and power tools).
French UI, mobile-first, installable on Android as a PWA.

**Stack:** Vue 3 + Vite (client) · Fastify 5 + SQLite/better-sqlite3 (server) · one Docker image served behind Traefik.

## Modules

| Tab | What it does |
|---|---|
| 🏠 Accueil | Dashboard: repairs by status, open diagnostics, low stock, today's sales, cash collected, customer credit + quick actions |
| 🔧 Atelier | Repairs (general / electronic / charger adaptation / lithium battery), 7 statuses, priority, parts from stock, labour, payments, before/after photos, WhatsApp "ready" message |
| 📦 Stock | Items with photo, category, voltage, power, min stock, purchase/sale price + margin, location, movement history, quick in/out |
| 🛒 Vente | Direct sale without a repair: cart, cash / credit / exchange / loan, partial payment, stock decremented automatically |
| 👥 Clients | Contact card + complete history (repairs, diagnostics, purchases, payments, credits, batteries) |
| ⚙️ Plus | 🔋 Batteries · ⚡ Diagnostic · 🔌 Connectors & adaptations · 📚 Knowledge base · 📇 Suppliers & purchases · 📅 Planning · 💰 Cash register · ⚙️ Settings |

Everything is linked: client ↔ repair/diagnostic/sale ↔ lines ↔ stock movements ↔ payments ↔ history.

### Business rules

- **Stock** goes down when a part is added to a repair or sold, and goes up on a supplier purchase. Removing a line, cancelling a sale or deleting a repair puts the items back. Every change is logged in `stock_movements`.
- **Total**: repair = parts + labour; diagnostic = its own price (billable even if the client walks away); sale = sum of lines.
- **Payments**: `especes`, `echange` and `emprunt` are recorded amounts. **Crédit** means "pay later": the amount not paid becomes customer credit. Partial payments are allowed and over-payment is refused.
- **Customer credit**: the unpaid balance of a **delivered** repair, a **decided** diagnostic (not "client réfléchit"), or any sale.
- **Diagnostic → repair**: one tap copies the client, vehicle, symptoms, measurements and photos.
- **Planning**: "Terminés" are finished but the client hasn't been told yet. Clicking the WhatsApp "prévenir" button moves a repair to "À récupérer".

## Deploying to the VPS (Traefik)

```bash
cp .env.example .env      # set DOMAIN, INITIAL_PIN, and the Traefik network/entrypoint/certresolver names
docker compose up -d --build
```

- The container joins the **external** Traefik network (`TRAEFIK_NETWORK`, default `traefik`) and listens on port 3000. TLS comes from your cert resolver.
- Data is stored in the named volume `vae-data` (`/data`): `vae.db`, `uploads/` (photos), `backups/` (one SQLite snapshot a day, the last 14 are kept).
- `INITIAL_PIN` is only used on first start. Change the PIN in **Paramètres → Sécurité**.
- The app is exposed to the internet and protected by the PIN only. Login is rate-limited (5 failures per IP → locked for 15 min, plus a global limit), sessions are httpOnly/SameSite=strict cookies, and every API route and photo requires a session. For an extra lock, enable the IP allow-list middleware in `docker-compose.yml`.

On the phone, open `https://DOMAIN` in Chrome and choose **⋮ → Ajouter à l'écran d'accueil**.

### Backups

- **Paramètres → Sauvegarde complète (.zip)**: database + photos. Download one regularly and keep it off the server.
- **Restaurer**: upload that zip. The current data is first moved to `/data/avant-restauration-<date>/`.
- **Export JSON**: every table in a readable format.
- From the host: `make backup` (archives the `vae-manager_vae-data` volume into `./backups/`).

## Local development

```bash
cd server && npm install && INITIAL_PIN=123456 npm run dev   # API on :3000, data in ./data
cd client && npm install && npm run dev                      # UI on :5173 (proxies /api)
```

Docker locally without Traefik: `docker compose -f docker-compose.local.yml up --build` → http://localhost:3000 (PIN `123456`).

## Layout

```
server/src/
  index.js          Fastify bootstrap, auth hook, static client + SPA fallback
  db.js             SQLite schema (migrations via PRAGMA user_version) + computed views (totals, balances, credits)
  auth.js           PIN (scrypt), sessions, brute-force lockout
  lib/crud.js       generic list/get/create/update/delete routes
  lib/ledger.js     stock lines + payments (the stock/cash glue)
  routes/           core (clients, items, suppliers, purchases), workshop (repairs, diagnostics),
                    sales (sales, payments, dashboard, cash, planning), library (connectors, adaptations,
                    knowledge base), files (photos), system (settings, backup/restore)
client/src/
  views/            one file per screen
  components/       pickers, lines editor, payments panel, photo gallery, cell-group grid…
```

Schema changes: **append** a new entry to `MIGRATIONS` in `server/src/db.js` and never edit an existing one. Views are rebuilt on every start.
