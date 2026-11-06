import Database from 'better-sqlite3';
import { config } from './config.js';

const NOW = "(datetime('now','localtime'))";

/**
 * Ordered migrations. Never edit an existing entry once released:
 * append a new one instead. PRAGMA user_version tracks progress.
 */
const MIGRATIONS = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT ${NOW},
    expires_at TEXT NOT NULL,
    user_agent TEXT
  );

  CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT, whatsapp TEXT, address TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );
  CREATE INDEX idx_clients_name ON clients(name);

  CREATE TABLE suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT, whatsapp TEXT, address TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );

  CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT, reference TEXT, vehicle_types TEXT, voltage TEXT, power TEXT,
    quantity REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0,
    sale_price REAL NOT NULL DEFAULT 0,
    location TEXT, notes TEXT,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );
  CREATE INDEX idx_items_name ON items(name);

  CREATE TABLE stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    delta REAL NOT NULL,
    reason TEXT NOT NULL,
    ref_type TEXT, ref_id INTEGER, note TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_mov_item ON stock_movements(item_id);

  CREATE TABLE repairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    category TEXT NOT NULL DEFAULT 'general',
    vehicle_type TEXT, brand TEXT, model TEXT, voltage TEXT, serial TEXT,
    problem TEXT, diagnosis TEXT, work_done TEXT,
    labor REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'en_attente',
    priority TEXT NOT NULL DEFAULT 'normal',
    details TEXT, notes TEXT, due_date TEXT,
    diagnostic_id INTEGER,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT,
    finished_at TEXT, notified_at TEXT, delivered_at TEXT
  );
  CREATE INDEX idx_repairs_client ON repairs(client_id);
  CREATE INDEX idx_repairs_status ON repairs(status);

  CREATE TABLE diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    vehicle_type TEXT, brand TEXT, model TEXT, voltage TEXT, serial TEXT,
    symptoms TEXT, tests TEXT, measurements TEXT, fault_found TEXT, proposed_solution TEXT,
    duration_min INTEGER NOT NULL DEFAULT 0,
    price REAL NOT NULL DEFAULT 0,
    decision TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    notes TEXT,
    repair_id INTEGER,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT, decided_at TEXT
  );
  CREATE INDEX idx_diag_client ON diagnostics(client_id);

  CREATE TABLE sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );
  CREATE INDEX idx_sales_date ON sales(created_at);

  CREATE TABLE purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER REFERENCES suppliers(id),
    reference TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );

  -- Generic document lines: repair parts, sale items, supplier purchase items
  CREATE TABLE lines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    item_id INTEGER REFERENCES items(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    qty REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    unit_cost REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_lines_ref ON lines(ref_type, ref_id);
  CREATE INDEX idx_lines_item ON lines(item_id);

  CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    method TEXT NOT NULL DEFAULT 'especes',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_pay_ref ON payments(ref_type, ref_id);
  CREATE INDEX idx_pay_date ON payments(created_at);

  CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref_type TEXT NOT NULL,
    ref_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    tag TEXT, caption TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}
  );
  CREATE INDEX idx_photos_ref ON photos(ref_type, ref_id);

  CREATE TABLE connectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT, application TEXT,
    pins INTEGER,
    wires TEXT,
    wiring TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );

  CREATE TABLE adaptations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    connector_id INTEGER REFERENCES connectors(id) ON DELETE SET NULL,
    repair_id INTEGER,
    title TEXT NOT NULL,
    problem TEXT, pinout TEXT, solution TEXT, notes TEXT,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );

  CREATE TABLE solutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT, symptoms TEXT, diagnosis TEXT, cause TEXT, solution TEXT,
    parts TEXT, wiring TEXT, notes TEXT,
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${NOW}, updated_at TEXT
  );
  `,
];

// "2" rather than "2.0" in text summaries
const QTY = '(CASE WHEN l.qty = CAST(l.qty AS INTEGER) THEN CAST(l.qty AS INTEGER) ELSE l.qty END)';

/** Views are rebuilt on every start, so they can evolve freely. */
const VIEWS = `
DROP VIEW IF EXISTS v_clients;
DROP VIEW IF EXISTS v_docs;
DROP VIEW IF EXISTS v_payments;
DROP VIEW IF EXISTS v_repairs;
DROP VIEW IF EXISTS v_diagnostics;
DROP VIEW IF EXISTS v_sales;
DROP VIEW IF EXISTS v_purchases;
DROP VIEW IF EXISTS v_items;
DROP VIEW IF EXISTS v_suppliers;
DROP VIEW IF EXISTS v_connectors;
DROP VIEW IF EXISTS v_adaptations;
DROP VIEW IF EXISTS v_solutions;

CREATE VIEW v_repairs AS
SELECT x.*,
  ROUND(x.parts_total + x.labor, 2) AS total,
  ROUND(x.parts_total + x.labor - x.paid, 2) AS balance
FROM (
  SELECT r.*, c.name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp,
    COALESCE((SELECT SUM(l.qty * l.unit_price) FROM lines l WHERE l.ref_type = 'repair' AND l.ref_id = r.id), 0) AS parts_total,
    COALESCE((SELECT SUM(l.qty * l.unit_cost) FROM lines l WHERE l.ref_type = 'repair' AND l.ref_id = r.id), 0) AS parts_cost,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.ref_type = 'repair' AND p.ref_id = r.id), 0) AS paid,
    (SELECT filename FROM photos ph WHERE ph.ref_type = 'repair' AND ph.ref_id = r.id ORDER BY ph.id LIMIT 1) AS photo
  FROM repairs r LEFT JOIN clients c ON c.id = r.client_id
) x;

CREATE VIEW v_diagnostics AS
SELECT x.*, ROUND(x.price, 2) AS total, ROUND(x.price - x.paid, 2) AS balance
FROM (
  SELECT d.*, c.name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.ref_type = 'diagnostic' AND p.ref_id = d.id), 0) AS paid
  FROM diagnostics d LEFT JOIN clients c ON c.id = d.client_id
) x;

CREATE VIEW v_sales AS
SELECT x.*, ROUND(x.total - x.paid, 2) AS balance
FROM (
  SELECT s.*, c.name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp,
    ROUND(COALESCE((SELECT SUM(l.qty * l.unit_price) FROM lines l WHERE l.ref_type = 'sale' AND l.ref_id = s.id), 0), 2) AS total,
    COALESCE((SELECT SUM(l.qty * l.unit_cost) FROM lines l WHERE l.ref_type = 'sale' AND l.ref_id = s.id), 0) AS cost,
    COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.ref_type = 'sale' AND p.ref_id = s.id), 0) AS paid,
    (SELECT group_concat(CASE WHEN l.qty <> 1 THEN ${QTY} || '× ' ELSE '' END || l.name, ', ')
       FROM lines l WHERE l.ref_type = 'sale' AND l.ref_id = s.id) AS summary
  FROM sales s LEFT JOIN clients c ON c.id = s.client_id
) x;

CREATE VIEW v_purchases AS
SELECT p.*, s.name AS supplier_name,
  ROUND(COALESCE((SELECT SUM(l.qty * l.unit_cost) FROM lines l WHERE l.ref_type = 'purchase' AND l.ref_id = p.id), 0), 2) AS total,
  (SELECT group_concat(${QTY} || '× ' || l.name, ', ') FROM lines l WHERE l.ref_type = 'purchase' AND l.ref_id = p.id) AS summary
FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id;

-- Every billable document. "due" = the amount is owed now (vehicle delivered, decision taken, sale done).
CREATE VIEW v_docs AS
SELECT 'repair' AS ref_type, id, client_id, client_name, total, paid, balance, created_at,
  TRIM(COALESCE(brand, '') || ' ' || COALESCE(model, '')) AS label, category AS kind,
  (status = 'livree') AS due
FROM v_repairs
UNION ALL
SELECT 'diagnostic', id, client_id, client_name, total, paid, balance, created_at,
  TRIM(COALESCE(brand, '') || ' ' || COALESCE(model, '')), 'diagnostic',
  (decision IS NOT NULL AND decision <> 'reflechit')
FROM v_diagnostics
UNION ALL
SELECT 'sale', id, client_id, client_name, total, paid, balance, created_at, summary, 'sale', 1
FROM v_sales;

CREATE VIEW v_payments AS
SELECT x.*, c.name AS client_name FROM (
  SELECT p.*,
    CASE p.ref_type
      WHEN 'repair' THEN (SELECT client_id FROM repairs WHERE id = p.ref_id)
      WHEN 'diagnostic' THEN (SELECT client_id FROM diagnostics WHERE id = p.ref_id)
      WHEN 'sale' THEN (SELECT client_id FROM sales WHERE id = p.ref_id)
    END AS client_id
  FROM payments p
) x LEFT JOIN clients c ON c.id = x.client_id;

CREATE VIEW v_clients AS
SELECT c.*,
  COALESCE((SELECT ROUND(SUM(d.balance), 2) FROM v_docs d WHERE d.client_id = c.id AND d.due AND d.balance > 0.009), 0) AS credit
FROM clients c;

CREATE VIEW v_items AS
SELECT i.*, s.name AS supplier_name,
  (SELECT filename FROM photos ph WHERE ph.ref_type = 'item' AND ph.ref_id = i.id ORDER BY ph.id LIMIT 1) AS photo,
  (i.quantity <= i.min_stock) AS low
FROM items i LEFT JOIN suppliers s ON s.id = i.supplier_id;

CREATE VIEW v_suppliers AS
SELECT s.*,
  (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) AS purchases_count,
  (SELECT MAX(created_at) FROM purchases p WHERE p.supplier_id = s.id) AS last_purchase_at
FROM suppliers s;

CREATE VIEW v_connectors AS
SELECT c.*,
  (SELECT filename FROM photos ph WHERE ph.ref_type = 'connector' AND ph.ref_id = c.id ORDER BY ph.id LIMIT 1) AS photo,
  (SELECT COUNT(*) FROM adaptations a WHERE a.connector_id = c.id) AS adaptations_count
FROM connectors c;

CREATE VIEW v_adaptations AS
SELECT a.*, c.name AS connector_name,
  (SELECT filename FROM photos ph WHERE ph.ref_type = 'adaptation' AND ph.ref_id = a.id ORDER BY ph.id LIMIT 1) AS photo
FROM adaptations a LEFT JOIN connectors c ON c.id = a.connector_id;

CREATE VIEW v_solutions AS
SELECT s.*,
  (SELECT filename FROM photos ph WHERE ph.ref_type = 'solution' AND ph.ref_id = s.id ORDER BY ph.id LIMIT 1) AS photo
FROM solutions s;
`;

let instance = null;

export function db() {
  if (!instance) throw Object.assign(new Error('Base de données indisponible'), { statusCode: 503 });
  return instance;
}

export function migrate(database) {
  const current = database.pragma('user_version', { simple: true });
  for (let v = current; v < MIGRATIONS.length; v++) {
    database.transaction(() => {
      database.exec(MIGRATIONS[v]);
      database.pragma(`user_version = ${v + 1}`);
    })();
  }
  database.exec(VIEWS);
}

export function openDb(file = config.dbPath) {
  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  migrate(database);
  instance = database;
  return database;
}

export function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export function nowLocal() {
  return db().prepare("SELECT datetime('now','localtime') AS n").get().n;
}

export function todayLocal() {
  return db().prepare("SELECT date('now','localtime') AS d").get().d;
}

export function getSetting(key, fallback = null) {
  const row = db().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value == null ? null : String(value));
}
