import { db, todayLocal } from '../db.js';
import { httpError, round2, DOC_TYPES } from '../lib/util.js';
import { getLines, addLine, removeLinesOf, getPayments, addPayment, removePaymentsOf, getDoc } from '../lib/ledger.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_ORDER = "CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END";

export default async function salesRoutes(app) {
  // ---------- Direct sales (no repair) ----------
  const getSale = (id) => {
    const s = db().prepare('SELECT * FROM v_sales WHERE id = ?').get(id);
    if (!s) throw httpError(404, 'Vente introuvable');
    s.lines = getLines('sale', id);
    s.payments = getPayments('sale', id);
    return s;
  };

  app.get('/sales', async (req) => {
    const where = [];
    const params = {};
    if (req.query.client_id) {
      where.push('client_id = @client_id');
      params.client_id = Number(req.query.client_id);
    }
    if (DATE_RE.test(req.query.from || '')) {
      where.push('created_at >= @from');
      params.from = req.query.from;
    }
    if (DATE_RE.test(req.query.to || '')) {
      where.push("created_at < date(@to, '+1 day')");
      params.to = req.query.to;
    }
    if (req.query.unpaid === '1') where.push('balance > 0.009');
    if (req.query.q) {
      where.push('(summary LIKE @q OR client_name LIKE @q OR CAST(id AS TEXT) = @qid)');
      params.q = `%${req.query.q}%`;
      params.qid = String(req.query.q).replace('#', '');
    }
    return db()
      .prepare(`SELECT * FROM v_sales ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`)
      .all(params);
  });

  app.get('/sales/:id', async (req) => getSale(Number(req.params.id)));

  app.post('/sales', async (req) => {
    const { client_id, notes, lines = [], payment } = req.body || {};
    if (!Array.isArray(lines) || !lines.length) throw httpError(400, 'Le panier est vide');
    if (client_id && !db().prepare('SELECT 1 FROM clients WHERE id = ?').get(client_id)) throw httpError(404, 'Client introuvable');
    const id = db().transaction(() => {
      const info = db().prepare('INSERT INTO sales (client_id, notes) VALUES (?, ?)').run(client_id || null, notes?.trim() || null);
      for (const l of lines) addLine('sale', info.lastInsertRowid, l);
      if (payment && Number(payment.amount) > 0) addPayment('sale', info.lastInsertRowid, payment);
      return info.lastInsertRowid;
    })();
    return getSale(id);
  });

  app.put('/sales/:id', async (req) => {
    const id = Number(req.params.id);
    getSale(id);
    const { client_id, notes } = req.body || {};
    db()
      .prepare("UPDATE sales SET client_id = ?, notes = ?, updated_at = datetime('now','localtime') WHERE id = ?")
      .run(client_id || null, notes?.trim() || null, id);
    return getSale(id);
  });

  // Cancelling a sale puts the items back in stock and removes its payments
  app.delete('/sales/:id', async (req) => {
    const id = Number(req.params.id);
    getSale(id);
    db().transaction(() => {
      removeLinesOf('sale', id);
      removePaymentsOf('sale', id);
      db().prepare('DELETE FROM sales WHERE id = ?').run(id);
    })();
    return { ok: true };
  });

  // ---------- Payments ----------
  app.get('/payments', async (req) => {
    const where = [];
    const params = {};
    if (DOC_TYPES.includes(req.query.ref_type)) {
      where.push('ref_type = @ref_type');
      params.ref_type = req.query.ref_type;
    }
    if (req.query.ref_id) {
      where.push('ref_id = @ref_id');
      params.ref_id = Number(req.query.ref_id);
    }
    if (req.query.client_id) {
      where.push('client_id = @client_id');
      params.client_id = Number(req.query.client_id);
    }
    return db()
      .prepare(`SELECT * FROM v_payments ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT 500`)
      .all(params);
  });

  app.post('/payments', async (req) => {
    const { ref_type, ref_id } = req.body || {};
    const id = db().transaction(() => addPayment(ref_type, Number(ref_id), req.body))();
    return { id, doc: getDoc(ref_type, Number(ref_id)) };
  });

  app.delete('/payments/:id', async (req) => {
    const p = db().prepare('SELECT * FROM payments WHERE id = ?').get(Number(req.params.id));
    if (!p) throw httpError(404, 'Paiement introuvable');
    db().prepare('DELETE FROM payments WHERE id = ?').run(p.id);
    return { ok: true, doc: getDoc(p.ref_type, p.ref_id) };
  });

  // ---------- Open customer credits ----------
  app.get('/credits', async () =>
    db().prepare('SELECT * FROM v_docs WHERE due AND balance > 0.009 ORDER BY client_name COLLATE NOCASE, created_at').all()
  );

  // ---------- Dashboard ----------
  app.get('/dashboard', async () => {
    const today = todayLocal();
    const statusCounts = Object.fromEntries(
      db().prepare("SELECT status, COUNT(*) AS n FROM repairs WHERE status <> 'livree' GROUP BY status").all().map((r) => [r.status, r.n])
    );
    const toCollect = db().prepare("SELECT COUNT(*) AS n FROM repairs WHERE status = 'terminee'").get().n;
    const diagnosticsOpen = db().prepare("SELECT COUNT(*) AS n FROM diagnostics WHERE decision IS NULL OR decision = 'reflechit'").get().n;
    const lowStock = db().prepare('SELECT id, name, quantity, min_stock, photo, category FROM v_items WHERE low ORDER BY (quantity - min_stock), name LIMIT 8').all();
    const lowStockCount = db().prepare('SELECT COUNT(*) AS n FROM items WHERE quantity <= min_stock').get().n;
    const salesToday = db()
      .prepare("SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total FROM v_sales WHERE created_at >= @d AND created_at < date(@d, '+1 day')")
      .get({ d: today });
    const credits = db().prepare('SELECT COUNT(*) AS n, COALESCE(SUM(balance), 0) AS total FROM v_docs WHERE due AND balance > 0.009').get();
    const cashRows = db()
      .prepare("SELECT method, SUM(amount) AS total FROM payments WHERE created_at >= @d AND created_at < date(@d, '+1 day') GROUP BY method")
      .all({ d: today });
    const cash = Object.fromEntries(cashRows.map((r) => [r.method, round2(r.total)]));
    const active = db()
      .prepare(
        `SELECT id, category, client_name, vehicle_type, brand, model, status, priority, created_at, total
         FROM v_repairs WHERE status IN ('en_attente','en_cours','en_pause','attente_piece','en_test')
         ORDER BY ${PRIORITY_ORDER}, CASE status WHEN 'en_cours' THEN 0 ELSE 1 END, id DESC LIMIT 8`
      )
      .all();
    return {
      today,
      repairs: statusCounts,
      to_collect: toCollect,
      diagnostics_open: diagnosticsOpen,
      low_stock: { count: lowStockCount, items: lowStock },
      sales_today: { count: salesToday.n, total: round2(salesToday.total) },
      credits: { count: credits.n, total: round2(credits.total) },
      cash_today: { ...cash, total: round2(cashRows.reduce((s, r) => s + r.total, 0)) },
      active,
    };
  });

  // ---------- Cash register ----------
  app.get('/cash', async (req) => {
    const from = DATE_RE.test(req.query.from || '') ? req.query.from : todayLocal();
    const to = DATE_RE.test(req.query.to || '') ? req.query.to : from;
    const range = { from, to };
    const inRange = "created_at >= @from AND created_at < date(@to, '+1 day')";

    const payments = db().prepare(`SELECT * FROM v_payments WHERE ${inRange} ORDER BY id DESC`).all(range);
    const byMethod = {};
    const byType = {};
    for (const p of payments) {
      byMethod[p.method] = round2((byMethod[p.method] || 0) + p.amount);
      byType[p.ref_type] = round2((byType[p.ref_type] || 0) + p.amount);
    }
    const sales = db()
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(cost), 0) AS cost FROM v_sales WHERE ${inRange}`)
      .get(range);
    const delivered = db()
      .prepare(
        `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS total, COALESCE(SUM(labor), 0) AS labor,
           COALESCE(SUM(parts_total), 0) AS parts_total, COALESCE(SUM(parts_cost), 0) AS parts_cost
         FROM v_repairs WHERE delivered_at >= @from AND delivered_at < date(@to, '+1 day')`
      )
      .get(range);
    const diagnostics = db()
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(price), 0) AS total FROM v_diagnostics WHERE decided_at >= @from AND decided_at < date(@to, '+1 day')`)
      .get(range);
    const credits = db().prepare('SELECT * FROM v_docs WHERE due AND balance > 0.009 ORDER BY created_at DESC').all();

    return {
      from,
      to,
      total: round2(payments.reduce((s, p) => s + p.amount, 0)),
      by_method: byMethod,
      by_type: byType,
      payments,
      sales: { count: sales.n, total: round2(sales.total), cost: round2(sales.cost), margin: round2(sales.total - sales.cost) },
      repairs_delivered: {
        count: delivered.n,
        total: round2(delivered.total),
        labor: round2(delivered.labor),
        parts_margin: round2(delivered.parts_total - delivered.parts_cost),
      },
      diagnostics: { count: diagnostics.n, total: round2(diagnostics.total) },
      credits: { total: round2(credits.reduce((s, c) => s + c.balance, 0)), items: credits },
    };
  });

  // ---------- Planning ----------
  app.get('/planning', async () => ({
    repairs: db()
      .prepare(
        `SELECT id, category, client_id, client_name, client_phone, client_whatsapp, vehicle_type, brand, model, status, priority,
           due_date, created_at, finished_at, notified_at, delivered_at, total, balance, problem
         FROM v_repairs
         WHERE status <> 'livree' OR delivered_at >= datetime('now', 'localtime', '-7 days')
         ORDER BY ${PRIORITY_ORDER}, COALESCE(due_date, '9999'), id`
      )
      .all(),
    diagnostics: db()
      .prepare(
        `SELECT id, client_id, client_name, vehicle_type, brand, model, priority, decision, created_at, price, symptoms
         FROM v_diagnostics WHERE decision IS NULL OR decision = 'reflechit'
         ORDER BY ${PRIORITY_ORDER}, id`
      )
      .all(),
  }));
}
