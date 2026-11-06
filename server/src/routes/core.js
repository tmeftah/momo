import { db } from '../db.js';
import { crud } from '../lib/crud.js';
import { eq, flag, httpError, num } from '../lib/util.js';
import { moveStock, getLines, addLine, removeLinesOf } from '../lib/ledger.js';

export default async function coreRoutes(app) {
  // ---------- Clients ----------
  const clients = crud(app, {
    path: '/clients',
    table: 'clients',
    view: 'v_clients',
    fields: ['name', 'phone', 'whatsapp', 'address', 'notes'],
    required: ['name'],
    search: ['name', 'phone', 'whatsapp', 'address', 'notes'],
    filters: { with_credit: flag('credit > 0') },
    order: 'name COLLATE NOCASE',
    photoRef: 'client',
  });

  app.get('/clients/:id/history', async (req) => {
    const id = Number(req.params.id);
    const client = clients.getOne(id);
    const parse = (r) => ({ ...r, details: r.details ? safeJson(r.details) : null });
    return {
      client,
      repairs: db().prepare('SELECT * FROM v_repairs WHERE client_id = ? ORDER BY id DESC').all(id).map(parse),
      diagnostics: db().prepare('SELECT * FROM v_diagnostics WHERE client_id = ? ORDER BY id DESC').all(id),
      sales: db().prepare('SELECT * FROM v_sales WHERE client_id = ? ORDER BY id DESC').all(id),
      payments: db().prepare('SELECT * FROM v_payments WHERE client_id = ? ORDER BY id DESC').all(id),
      credits: db().prepare('SELECT * FROM v_docs WHERE client_id = ? AND due AND balance > 0.009 ORDER BY created_at').all(id),
    };
  });

  // ---------- Stock items ----------
  const items = crud(app, {
    path: '/items',
    table: 'items',
    view: 'v_items',
    fields: ['name', 'category', 'reference', 'vehicle_types', 'voltage', 'power', 'quantity', 'min_stock', 'purchase_price', 'sale_price', 'location', 'notes', 'supplier_id'],
    required: ['name'],
    numbers: ['quantity', 'min_stock', 'purchase_price', 'sale_price'],
    search: ['name', 'reference', 'category', 'voltage', 'location', 'notes'],
    filters: {
      category: eq('category'),
      low: flag('low'),
      supplier_id: eq('supplier_id'),
      vehicle_type: (v, p) => {
        p.vt = `%${v}%`;
        return '(vehicle_types LIKE @vt OR vehicle_types IS NULL)';
      },
    },
    order: 'name COLLATE NOCASE',
    photoRef: 'item',
    extend: (row) => {
      row.movements = db()
        .prepare('SELECT * FROM stock_movements WHERE item_id = ? ORDER BY id DESC LIMIT 100')
        .all(row.id);
      return row;
    },
    beforeUpdate: (data, existing) => {
      // Quantity changes from the edit form are recorded as manual adjustments
      if ('quantity' in data && data.quantity !== existing.quantity) {
        db()
          .prepare('INSERT INTO stock_movements (item_id, delta, reason, note) VALUES (?, ?, ?, ?)')
          .run(existing.id, data.quantity - existing.quantity, 'ajustement', 'modification fiche');
      }
    },
    // Initial quantity of a newly created item counts as a stock movement
    afterCreate: (id, data) => {
      if (data.quantity) {
        db().prepare('INSERT INTO stock_movements (item_id, delta, reason, note) VALUES (?, ?, ?, ?)').run(id, data.quantity, 'entree', 'stock initial');
      }
    },
  });

  app.post('/items/:id/adjust', async (req) => {
    const id = Number(req.params.id);
    const item = items.getOne(id);
    const delta = num(req.body?.delta, 0);
    if (!delta) throw httpError(400, 'Quantité invalide');
    db().transaction(() => {
      moveStock(id, delta, delta > 0 ? 'entree' : 'sortie', null, null, req.body?.note ? String(req.body.note).trim() : null);
      if (req.body?.purchase_price !== undefined && req.body.purchase_price !== '' && req.body.purchase_price !== null) {
        db().prepare('UPDATE items SET purchase_price = ? WHERE id = ?').run(num(req.body.purchase_price, item.purchase_price), id);
      }
    })();
    return items.getOne(id);
  });

  app.get('/items-categories', async () =>
    db().prepare('SELECT category, COUNT(*) AS n, SUM(low) AS low FROM v_items GROUP BY category ORDER BY category').all()
  );

  // ---------- Suppliers ----------
  const suppliers = crud(app, {
    path: '/suppliers',
    table: 'suppliers',
    view: 'v_suppliers',
    fields: ['name', 'phone', 'whatsapp', 'address', 'notes'],
    required: ['name'],
    search: ['name', 'phone', 'whatsapp', 'notes'],
    order: 'name COLLATE NOCASE',
    photoRef: 'supplier',
    extend: (row) => {
      row.purchases = db().prepare('SELECT * FROM v_purchases WHERE supplier_id = ? ORDER BY id DESC').all(row.id);
      row.items = db().prepare('SELECT id, name, reference, quantity, purchase_price FROM items WHERE supplier_id = ? ORDER BY name').all(row.id);
      return row;
    },
  });

  // ---------- Supplier purchases (increase stock) ----------
  const getPurchase = (id) => {
    const p = db().prepare('SELECT * FROM v_purchases WHERE id = ?').get(id);
    if (!p) throw httpError(404, 'Achat introuvable');
    p.lines = getLines('purchase', id);
    return p;
  };

  app.get('/purchases', async (req) => {
    const params = [];
    let where = '';
    if (req.query.supplier_id) {
      where = 'WHERE supplier_id = ?';
      params.push(Number(req.query.supplier_id));
    }
    return db().prepare(`SELECT * FROM v_purchases ${where} ORDER BY id DESC LIMIT 500`).all(...params);
  });

  app.get('/purchases/:id', async (req) => getPurchase(Number(req.params.id)));

  app.post('/purchases', async (req) => {
    const { supplier_id, reference, notes, lines = [] } = req.body || {};
    if (!Array.isArray(lines) || !lines.length) throw httpError(400, 'Ajoutez au moins un article');
    if (supplier_id) suppliers.getOne(Number(supplier_id));
    const id = db().transaction(() => {
      const info = db()
        .prepare('INSERT INTO purchases (supplier_id, reference, notes) VALUES (?, ?, ?)')
        .run(supplier_id || null, reference?.trim() || null, notes?.trim() || null);
      for (const l of lines) {
        if (!l.item_id) throw httpError(400, 'Chaque ligne doit être liée à un article du stock');
        addLine('purchase', info.lastInsertRowid, l);
        const updates = [];
        const params = [];
        if (l.update_price && num(l.unit_cost, -1) >= 0) {
          updates.push('purchase_price = ?');
          params.push(num(l.unit_cost));
        }
        if (supplier_id) {
          updates.push('supplier_id = COALESCE(supplier_id, ?)');
          params.push(supplier_id);
        }
        if (updates.length) db().prepare(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`).run(...params, l.item_id);
      }
      return info.lastInsertRowid;
    })();
    return getPurchase(id);
  });

  app.delete('/purchases/:id', async (req) => {
    const id = Number(req.params.id);
    getPurchase(id);
    db().transaction(() => {
      removeLinesOf('purchase', id);
      db().prepare('DELETE FROM purchases WHERE id = ?').run(id);
    })();
    return { ok: true };
  });
}

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
