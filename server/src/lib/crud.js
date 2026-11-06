import { db } from '../db.js';
import { httpError } from './util.js';
import { collectPhotos, unlinkFiles } from './photos.js';

/**
 * Registers list / get / create / update / delete routes for a table.
 *
 * o.path        route prefix ('/clients')
 * o.table       table written to
 * o.view        view read from (defaults to table)
 * o.fields      writable columns (whitelist)
 * o.required    columns that must be non-empty
 * o.numbers     columns coerced to numbers
 * o.json        columns stored as JSON text
 * o.search      columns searched by ?q=
 * o.filters     { queryKey: (value, params) => sqlFragment | null }
 * o.order       ORDER BY clause
 * o.photoRef    photos.ref_type owned by this entity (deleted with it)
 * o.extend(row) adds related data on GET /:id
 * o.beforeCreate(data, body) / o.afterCreate(id, data) / o.beforeUpdate(data, existing) / o.beforeDelete(id)
 */
export function crud(app, o) {
  const view = o.view || o.table;
  const json = o.json || [];
  const numbers = o.numbers || [];

  const parse = (row) => {
    if (!row) return row;
    for (const k of json) {
      if (typeof row[k] === 'string') {
        try {
          row[k] = JSON.parse(row[k]);
        } catch {
          row[k] = null;
        }
      }
    }
    return row;
  };

  const pick = (body = {}) => {
    const out = {};
    for (const f of o.fields) {
      if (!(f in body) || body[f] === undefined) continue;
      let v = body[f];
      if (json.includes(f)) v = v == null ? null : JSON.stringify(v);
      else if (numbers.includes(f)) {
        const n = Number(v);
        v = v === '' || v === null || !Number.isFinite(n) ? 0 : n;
      } else if (typeof v === 'boolean') v = v ? 1 : 0;
      else if (typeof v === 'string') {
        v = v.trim();
        if (v === '') v = null;
      } else if (v !== null && typeof v === 'object') v = JSON.stringify(v);
      out[f] = v;
    }
    return out;
  };

  const checkRequired = (data, partial) => {
    for (const f of o.required || []) {
      if (partial && !(f in data)) continue;
      if (data[f] === null || data[f] === undefined || data[f] === '') {
        throw httpError(400, `Champ obligatoire manquant : ${f}`);
      }
    }
  };

  const list = (q = {}) => {
    const where = [];
    const params = {};
    if (q.q && o.search?.length) {
      where.push('(' + o.search.map((f) => `${f} LIKE @q`).join(' OR ') + ')');
      params.q = `%${String(q.q).trim()}%`;
    }
    for (const [key, fn] of Object.entries(o.filters || {})) {
      if (q[key] === undefined || q[key] === '') continue;
      const sql = fn(String(q[key]), params);
      if (sql) where.push(sql);
    }
    const limit = Math.min(Math.max(Number(q.limit) || 300, 1), 5000);
    const sql = `SELECT * FROM ${view}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY ${o.order || 'id DESC'} LIMIT ${limit}`;
    return db().prepare(sql).all(params).map(parse);
  };

  const getOne = (id) => {
    const row = parse(db().prepare(`SELECT * FROM ${view} WHERE id = ?`).get(id));
    if (!row) throw httpError(404, 'Élément introuvable');
    return o.extend ? o.extend(row) : row;
  };

  const create = (body) => {
    const data = { ...(o.defaults || {}), ...pick(body) };
    checkRequired(data, false);
    o.beforeCreate?.(data, body);
    const cols = Object.keys(data);
    const sql = cols.length
      ? `INSERT INTO ${o.table} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`
      : `INSERT INTO ${o.table} DEFAULT VALUES`;
    const id = db().transaction(() => {
      const info = db().prepare(sql).run(data);
      o.afterCreate?.(info.lastInsertRowid, data);
      return info.lastInsertRowid;
    })();
    return getOne(id);
  };

  const update = (id, body) => {
    const existing = db().prepare(`SELECT * FROM ${o.table} WHERE id = ?`).get(id);
    if (!existing) throw httpError(404, 'Élément introuvable');
    const data = pick(body);
    checkRequired(data, true);
    o.beforeUpdate?.(data, existing);
    const cols = Object.keys(data);
    if (cols.length) {
      db()
        .prepare(`UPDATE ${o.table} SET ${cols.map((c) => `${c} = @${c}`).join(', ')}, updated_at = datetime('now','localtime') WHERE id = @__id`)
        .run({ ...data, __id: id });
    }
    return getOne(id);
  };

  const remove = (id) => {
    let files = [];
    db().transaction(() => {
      o.beforeDelete?.(id);
      const res = db().prepare(`DELETE FROM ${o.table} WHERE id = ?`).run(id);
      if (!res.changes) throw httpError(404, 'Élément introuvable');
      if (o.photoRef) files = collectPhotos(o.photoRef, id);
    })();
    unlinkFiles(files);
    return { ok: true };
  };

  app.get(o.path, async (req) => list(req.query));
  app.get(`${o.path}/:id`, async (req) => getOne(Number(req.params.id)));
  app.post(o.path, async (req) => create(req.body || {}));
  app.put(`${o.path}/:id`, async (req) => update(Number(req.params.id), req.body || {}));
  app.delete(`${o.path}/:id`, async (req) => remove(Number(req.params.id)));

  return { list, getOne, create, update, remove, parse };
}
