import { db, nowLocal } from '../db.js';
import { crud } from '../lib/crud.js';
import { eq, inList, flag, httpError } from '../lib/util.js';
import { getLines, addLine, updateLine, removeLine, removeLinesOf, getPayments, removePaymentsOf } from '../lib/ledger.js';

const PRIORITY_ORDER = "CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END";
export const REPAIR_STATUSES = ['en_attente', 'en_cours', 'en_pause', 'attente_piece', 'en_test', 'terminee', 'livree'];
const DECISIONS = ['acceptee', 'reflechit', 'refuse', 'impossible'];

export default async function workshopRoutes(app) {
  // ---------- Repairs (general, electronic, charger adaptation, lithium battery) ----------
  const repairs = crud(app, {
    path: '/repairs',
    table: 'repairs',
    view: 'v_repairs',
    fields: ['client_id', 'category', 'vehicle_type', 'brand', 'model', 'voltage', 'serial', 'problem', 'diagnosis', 'work_done', 'labor', 'status', 'priority', 'details', 'notes', 'due_date'],
    numbers: ['labor'],
    json: ['details'],
    search: ['client_name', 'client_phone', 'brand', 'model', 'serial', 'problem', 'work_done', "CAST(id AS TEXT)"],
    filters: {
      status: eq('status'),
      statuses: inList('status', 'statuses'),
      category: eq('category'),
      client_id: eq('client_id'),
      priority: eq('priority'),
      open: flag("status <> 'livree'", "status = 'livree'"),
    },
    order: `CASE WHEN status = 'livree' THEN 1 ELSE 0 END, ${PRIORITY_ORDER}, id DESC`,
    photoRef: 'repair',
    extend: (row) => {
      row.lines = getLines('repair', row.id);
      row.payments = getPayments('repair', row.id);
      row.diagnostic = row.diagnostic_id
        ? db().prepare('SELECT id, price, paid, balance, fault_found FROM v_diagnostics WHERE id = ?').get(row.diagnostic_id) || null
        : null;
      return row;
    },
    beforeCreate: (data) => validateRepair(data),
    beforeUpdate: (data, existing) => {
      validateRepair(data);
      if (data.status && data.status !== existing.status) {
        const now = nowLocal();
        if (data.status === 'terminee' && !existing.finished_at) data.finished_at = now;
        if (data.status === 'livree') {
          data.delivered_at = now;
          if (!existing.finished_at) data.finished_at = now;
        }
        if (!['terminee', 'livree'].includes(data.status)) {
          data.notified_at = null;
          data.delivered_at = null;
        }
      }
    },
    beforeDelete: (id) => {
      removeLinesOf('repair', id);
      removePaymentsOf('repair', id);
      db().prepare('UPDATE diagnostics SET repair_id = NULL WHERE repair_id = ?').run(id);
      db().prepare('UPDATE adaptations SET repair_id = NULL WHERE repair_id = ?').run(id);
    },
  });

  function validateRepair(data) {
    if (data.status && !REPAIR_STATUSES.includes(data.status)) throw httpError(400, 'Statut invalide');
    if (data.priority && !['urgent', 'normal', 'pas_urgent'].includes(data.priority)) throw httpError(400, 'Priorité invalide');
  }

  // Client was told the vehicle is ready (WhatsApp) → moves to "à récupérer" in the planning
  app.post('/repairs/:id/notified', async (req) => {
    const id = Number(req.params.id);
    db().prepare('UPDATE repairs SET notified_at = ? WHERE id = ?').run(nowLocal(), id);
    return repairs.getOne(id);
  });

  // ---------- Parts used in a repair (live stock decrement) ----------
  app.post('/repairs/:id/lines', async (req) => {
    const id = Number(req.params.id);
    repairs.getOne(id);
    db().transaction(() => addLine('repair', id, req.body || {}))();
    return repairs.getOne(id);
  });

  app.put('/lines/:id', async (req) => {
    const line = db().transaction(() => updateLine(Number(req.params.id), req.body || {}))();
    return { ok: true, ref_type: line.ref_type, ref_id: line.ref_id };
  });

  app.delete('/lines/:id', async (req) => {
    const existing = db().prepare('SELECT ref_type FROM lines WHERE id = ?').get(Number(req.params.id));
    if (existing && existing.ref_type !== 'repair') {
      throw httpError(400, 'Pour une vente ou un achat, supprimez le document complet');
    }
    const line = db().transaction(() => removeLine(Number(req.params.id)))();
    return { ok: true, ref_type: line.ref_type, ref_id: line.ref_id };
  });

  // ---------- Diagnostics (billable on their own) ----------
  const diagnostics = crud(app, {
    path: '/diagnostics',
    table: 'diagnostics',
    view: 'v_diagnostics',
    fields: ['client_id', 'vehicle_type', 'brand', 'model', 'voltage', 'serial', 'symptoms', 'tests', 'measurements', 'fault_found', 'proposed_solution', 'duration_min', 'price', 'decision', 'priority', 'notes'],
    numbers: ['duration_min', 'price'],
    search: ['client_name', 'client_phone', 'brand', 'model', 'symptoms', 'fault_found', "CAST(id AS TEXT)"],
    filters: {
      client_id: eq('client_id'),
      decision: eq('decision'),
      open: flag("(decision IS NULL OR decision = 'reflechit')", "(decision IS NOT NULL AND decision <> 'reflechit')"),
    },
    order: `CASE WHEN decision IS NULL OR decision = 'reflechit' THEN 0 ELSE 1 END, ${PRIORITY_ORDER}, id DESC`,
    photoRef: 'diagnostic',
    extend: (row) => {
      row.payments = getPayments('diagnostic', row.id);
      row.repair = row.repair_id ? db().prepare('SELECT id, status, total FROM v_repairs WHERE id = ?').get(row.repair_id) || null : null;
      return row;
    },
    beforeUpdate: (data, existing) => {
      if (data.decision && !DECISIONS.includes(data.decision)) throw httpError(400, 'Décision invalide');
      if ('decision' in data && data.decision !== existing.decision) data.decided_at = data.decision ? nowLocal() : null;
    },
    beforeDelete: (id) => {
      removePaymentsOf('diagnostic', id);
      db().prepare('UPDATE repairs SET diagnostic_id = NULL WHERE diagnostic_id = ?').run(id);
    },
  });

  // Turn an accepted diagnostic into a repair without retyping anything
  app.post('/diagnostics/:id/convert', async (req) => {
    const d = diagnostics.getOne(Number(req.params.id));
    if (d.repair_id) return { repair_id: d.repair_id };
    const category = req.body?.category || (['batterie', 'outil'].includes(d.vehicle_type) ? 'batterie' : 'general');
    const diagnosisText = [d.fault_found, d.measurements && `Mesures : ${d.measurements}`, d.tests && `Tests : ${d.tests}`, d.proposed_solution && `Solution proposée : ${d.proposed_solution}`]
      .filter(Boolean)
      .join('\n');
    const repairId = db().transaction(() => {
      const info = db()
        .prepare(
          `INSERT INTO repairs (client_id, category, vehicle_type, brand, model, voltage, serial, problem, diagnosis, priority, status, diagnostic_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'en_attente', ?)`
        )
        .run(d.client_id, category, d.vehicle_type, d.brand, d.model, d.voltage, d.serial, d.symptoms, diagnosisText || null, d.priority, d.id);
      db().prepare("UPDATE diagnostics SET repair_id = ?, decision = 'acceptee', decided_at = COALESCE(decided_at, ?), updated_at = ? WHERE id = ?").run(info.lastInsertRowid, nowLocal(), nowLocal(), d.id);
      // Carry the diagnostic photos over to the repair (shared files, separate rows)
      db()
        .prepare("INSERT INTO photos (ref_type, ref_id, filename, tag, caption) SELECT 'repair', ?, filename, COALESCE(tag, 'diagnostic'), caption FROM photos WHERE ref_type = 'diagnostic' AND ref_id = ?")
        .run(info.lastInsertRowid, d.id);
      return info.lastInsertRowid;
    })();
    return { repair_id: repairId };
  });
}
