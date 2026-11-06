/**
 * Stock lines and payments — the glue between documents (repairs, sales,
 * purchases, diagnostics), the stock and the cash register.
 * All functions must run inside a db transaction when combined.
 */
import { db } from '../db.js';
import { httpError, num, round2, PAYMENT_METHODS, DOC_TYPES } from './util.js';

const LINE_SIGN = { sale: -1, repair: -1, purchase: 1 };
const LINE_REASON = { sale: 'vente', repair: 'reparation', purchase: 'achat' };

export function moveStock(itemId, delta, reason, refType = null, refId = null, note = null) {
  if (!itemId || !delta) return;
  db().prepare("UPDATE items SET quantity = quantity + ?, updated_at = datetime('now','localtime') WHERE id = ?").run(delta, itemId);
  db()
    .prepare('INSERT INTO stock_movements (item_id, delta, reason, ref_type, ref_id, note) VALUES (?, ?, ?, ?, ?, ?)')
    .run(itemId, delta, reason, refType, refId, note);
}

export function getLines(refType, refId) {
  return db()
    .prepare(
      `SELECT l.*, i.quantity AS stock_quantity, i.reference AS item_reference,
        (SELECT filename FROM photos ph WHERE ph.ref_type = 'item' AND ph.ref_id = l.item_id ORDER BY ph.id LIMIT 1) AS photo
       FROM lines l LEFT JOIN items i ON i.id = l.item_id
       WHERE l.ref_type = ? AND l.ref_id = ? ORDER BY l.id`
    )
    .all(refType, refId);
}

export function addLine(refType, refId, input = {}) {
  if (!LINE_SIGN[refType]) throw httpError(400, 'Type de document invalide');
  const item = input.item_id ? db().prepare('SELECT * FROM items WHERE id = ?').get(input.item_id) : null;
  if (input.item_id && !item) throw httpError(404, 'Article introuvable');
  const qty = num(input.qty, 1);
  if (qty <= 0) throw httpError(400, 'Quantité invalide');
  const name = String(input.name || item?.name || '').trim();
  if (!name) throw httpError(400, "Nom de l'article manquant");

  let unitPrice;
  let unitCost;
  if (refType === 'purchase') {
    unitCost = num(input.unit_cost ?? input.unit_price, item?.purchase_price ?? 0);
    unitPrice = unitCost;
  } else {
    unitPrice = num(input.unit_price, item?.sale_price ?? 0);
    unitCost = num(input.unit_cost, item?.purchase_price ?? 0);
  }

  const info = db()
    .prepare('INSERT INTO lines (ref_type, ref_id, item_id, name, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(refType, refId, item?.id ?? null, name, qty, unitPrice, unitCost);
  if (item) moveStock(item.id, LINE_SIGN[refType] * qty, LINE_REASON[refType], refType, refId);
  return info.lastInsertRowid;
}

export function updateLine(id, input = {}) {
  const line = db().prepare('SELECT * FROM lines WHERE id = ?').get(id);
  if (!line) throw httpError(404, 'Ligne introuvable');
  const qty = input.qty !== undefined ? num(input.qty, line.qty) : line.qty;
  if (qty <= 0) throw httpError(400, 'Quantité invalide');
  const unitPrice = input.unit_price !== undefined ? num(input.unit_price, line.unit_price) : line.unit_price;
  const name = input.name !== undefined ? String(input.name).trim() || line.name : line.name;
  db().prepare('UPDATE lines SET qty = ?, unit_price = ?, name = ? WHERE id = ?').run(qty, unitPrice, name, id);
  const diff = qty - line.qty;
  if (line.item_id && diff) moveStock(line.item_id, LINE_SIGN[line.ref_type] * diff, LINE_REASON[line.ref_type], line.ref_type, line.ref_id, 'modification quantité');
  return line;
}

export function removeLine(id) {
  const line = db().prepare('SELECT * FROM lines WHERE id = ?').get(id);
  if (!line) throw httpError(404, 'Ligne introuvable');
  db().prepare('DELETE FROM lines WHERE id = ?').run(id);
  if (line.item_id) moveStock(line.item_id, -LINE_SIGN[line.ref_type] * line.qty, 'annulation', line.ref_type, line.ref_id, `annulation ${LINE_REASON[line.ref_type]}`);
  return line;
}

export function removeLinesOf(refType, refId) {
  for (const { id } of db().prepare('SELECT id FROM lines WHERE ref_type = ? AND ref_id = ?').all(refType, refId)) removeLine(id);
}

export function getDoc(refType, refId) {
  if (!DOC_TYPES.includes(refType)) throw httpError(400, 'Type de document invalide');
  const doc = db().prepare('SELECT * FROM v_docs WHERE ref_type = ? AND id = ?').get(refType, refId);
  if (!doc) throw httpError(404, 'Document introuvable');
  return doc;
}

export function getPayments(refType, refId) {
  return db().prepare('SELECT * FROM payments WHERE ref_type = ? AND ref_id = ? ORDER BY id').all(refType, refId);
}

/** method "credit" means "pay later": any advance given with it is recorded as cash. */
export function addPayment(refType, refId, input = {}) {
  const amount = round2(num(input.amount, 0));
  if (amount <= 0) throw httpError(400, 'Montant invalide');
  let method = String(input.method || 'especes');
  if (method === 'credit') method = 'especes';
  if (!PAYMENT_METHODS.includes(method)) throw httpError(400, 'Mode de paiement invalide');
  const doc = getDoc(refType, refId);
  if (amount > round2(doc.balance) + 0.009) {
    throw httpError(400, `Montant supérieur au reste à payer (${round2(doc.balance)})`);
  }
  const info = db()
    .prepare('INSERT INTO payments (ref_type, ref_id, amount, method, notes) VALUES (?, ?, ?, ?, ?)')
    .run(refType, refId, amount, method, input.notes ? String(input.notes).trim() : null);
  return info.lastInsertRowid;
}

export function removePaymentsOf(refType, refId) {
  db().prepare('DELETE FROM payments WHERE ref_type = ? AND ref_id = ?').run(refType, refId);
}
