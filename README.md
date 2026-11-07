# 🔑 VAE Manager

Personal workshop manager for electric vehicles (e-bikes, e-scooters, electric mopeds, lithium batteries for vehicles and power tools).
French UI, mobile-first, installable on iPhone and Android as a PWA.

**Stack:** Vue 3 + Vite (client) · Fastify 5 + SQLite/better-sqlite3 (server) · one Docker image served behind Traefik.

## Modules

| Tab | What it does |
|---|---|
| 🏠 Accueil | Dashboard: repairs by status, open diagnostics, low stock, today's sales, cash collected, customer credit + quick actions |
| 🔧 Atelier | Repairs (general / electronic / charger adaptation / lithium battery), 7 statuses, priority, tasks from the catalog, parts from stock, labour, payments, before/after photos, WhatsApp "ready" message |
| 📦 Stock | Items with photo, category, voltage, power, min stock, purchase/sale price + margin, location, movement history, quick in/out |
| 🛒 Vente | Direct sale without a repair: cart, cash / credit / exchange / loan, partial payment, stock decremented automatically |
| 👥 Clients | Contact card + complete history (repairs, diagnostics, purchases, payments, credits, batteries) |
| ⚙️ Plus | 🔋 Batteries · ⚡ Diagnostic · 🔌 Connectors & adaptations · 📚 Knowledge base · 📇 Suppliers & purchases · 📅 Planning · 🧾 Tasks (prestations) · 💰 Cash register · ⚙️ Settings |

Everything is linked: client ↔ repair/diagnostic/sale ↔ lines ↔ stock movements ↔ payments ↔ history.

### Business rules

- **Stock** goes down when a part is added to a repair or sold, and goes up on a supplier purchase. Removing a line, cancelling a sale or deleting a repair puts the items back. Every change is logged in `stock_movements`.
- **Tasks (prestations)**: a catalog of recurring repair tasks with a default price, sorted by how often they are used. Adding one to a repair copies its name and price, which can then be changed for that repair only; changing or deleting a catalog task never changes past repairs. A task typed on the spot can be saved to the catalog.
- **Total**: repair = tasks + parts + labour; diagnostic = its own price (billable even if the client walks away); sale = sum of lines.
- **Payments**: `especes`, `echange` and `emprunt` are recorded amounts. **Crédit** means "pay later": the amount not paid becomes customer credit. Partial payments are allowed and over-payment is refused.
- **Customer credit**: the unpaid balance of a **delivered** repair, a **decided** diagnostic (not "client réfléchit"), or any sale.
- **Diagnostic → repair**: one tap copies the client, vehicle, symptoms, measurements and photos.
- **Planning**: "Terminés" are finished but the client hasn't been told yet. Clicking the WhatsApp "prévenir" button moves a repair to "À récupérer".

## Commands (Makefile)

Run `make` (or `make help`) to list every command. Requirements: Node 20+ for development, Docker with Compose v2 for the container targets.

### Development

| Command | What it does |
|---|---|
| `make install` | Install server and client dependencies (`npm ci`) |
| `make dev` | API on :3000 + Vite UI on :5173 with hot reload. Ctrl+C stops both |
| `make dev-server` | Only the API (auto-restart on change) |
| `make dev-client` | Only the Vite dev server (proxies `/api` to :3000) |
| `make build` | Build the client for production into `client/dist` |
| `make start` | Build, then run the production build locally without Docker on :3000 |
| `make local` | Build and run the Docker image locally on http://localhost:3000 (no Traefik) |
| `make local-logs` | Follow the local container logs |
| `make local-down` | Stop the local container (its data volume is kept) |
| `make clean` | Remove `node_modules` and `client/dist` (keeps `./data`) |

In development the PIN is `123456` and data goes to `./data`. Use a different PIN with `make dev DEV_PIN=987654`.

**Steps for a first local run:**

```bash
make install
make dev            # open http://localhost:5173, PIN 123456
```

### Production (VPS behind Traefik)

| Command | What it does |
|---|---|
| `make up` (or `make prod`) | Build the image and start the container behind Traefik |
| `make down` | Stop production (the `vae-data` volume is kept) |
| `make restart` | Restart the container |
| `make rebuild` | Rebuild the image from scratch (no cache) and restart |
| `make update` | `git pull --ff-only`, then rebuild and restart |
| `make logs` | Follow the last 100 log lines |
| `make ps` | Show the container status |
| `make shell` | Open a shell inside the container |
| `make backup` | Archive the `vae-manager_vae-data` volume to `./backups/vae-data-<date>.tgz` |

All production targets except `backup` stop with an error if `.env` is missing.

**Steps for a first deployment:**

```bash
git clone git@github.com:tmeftah/momo.git && cd momo
cp .env.example .env      # set DOMAIN, INITIAL_PIN, and the Traefik network/entrypoint/certresolver names
make up
make logs                 # check it started, then Ctrl+C
```

**Steps to ship a new version:**

```bash
make backup               # optional but recommended
make update               # pulls from GitHub, rebuilds, restarts
```

### Deployment notes

- The container joins the **external** Traefik network (`TRAEFIK_NETWORK`, default `traefik`) and listens on port 3000. TLS comes from your cert resolver.
- Data is stored in the named volume `vae-data` (`/data`): `vae.db`, `uploads/` (photos, resized to 1920 px and stored as WebP — about 200–400 KB each), `backups/` (one SQLite snapshot a day, the last 14 are kept).
- `INITIAL_PIN` is only used on first start. Change the PIN in **Paramètres → Sécurité**.
- The app is exposed to the internet and protected by the PIN only. Login is rate-limited (5 failures per IP → locked for 15 min, plus a global limit), sessions are httpOnly/SameSite=strict cookies, and every API route and photo requires a session. For an extra lock, enable the IP allow-list middleware in `docker-compose.yml`.

On the phone, open `https://DOMAIN` in Chrome and choose **⋮ → Ajouter à l'écran d'accueil**.

### Backups

- **Paramètres → Sauvegarde complète (.zip)**: database + photos. Download one regularly and keep it off the server.
- **Restaurer**: upload that zip. The current data is first moved to `/data/avant-restauration-<date>/`.
- **Export JSON**: every table in a readable format.
- From the host: `make backup` (archives the `vae-manager_vae-data` volume into `./backups/`).

## Installable app (PWA)

Open the site on the phone, then install it:
- **iPhone (Safari):** Share → *Sur l'écran d'accueil* → Ajouter.
- **Android (Chrome):** use the prompt, or menu ⋮ → *Installer l'application*.

The app also offers this itself, from the Accueil tip, Plus and Réglages.

Once installed:
- **Display:** it opens full screen with its own icon and launch screen. Long-pressing the icon on Android shows shortcuts: Réparation, Vente, Diagnostic, Atelier.
- **Offline:** the app itself is stored on the device, and screens already opened stay readable without network. A « Hors ligne » pill shows the age of that data. Changes need the connection.
- **Updates:** after a deploy (`make update`), the app shows « Nouvelle version · Mettre à jour ».
- **Badge:** the icon badge counts the vehicles ready to hand back, on platforms that support it.
- **Logout:** locking the app wipes the data kept on the phone.

Requirements:
- The app must be served over HTTPS for installation and offline use; Traefik's TLS does this.
- The service worker (`client/sw.template.js`) is generated at build time with the list of files to store.
- Icons and iOS launch screens are in `client/public/`.

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
