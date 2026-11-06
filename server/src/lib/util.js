export function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export function num(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export const PAYMENT_METHODS = ['especes', 'echange', 'emprunt'];
export const DOC_TYPES = ['repair', 'diagnostic', 'sale'];
export const PHOTO_REFS = ['repair', 'diagnostic', 'item', 'client', 'connector', 'adaptation', 'solution', 'supplier', 'purchase'];

/** SQL filter builders used by the generic CRUD list endpoint. */
export const eq = (col, key = col) => (v, p) => {
  p[key] = v;
  return `${col} = @${key}`;
};

/** Comma-separated list: ?statuses=en_cours,en_pause */
export const inList = (col, key) => (v, p) => {
  p[key] = `,${v},`;
  return `instr(@${key}, ',' || ${col} || ',') > 0`;
};

export const flag = (sqlWhenTrue, sqlWhenFalse = null) => (v) =>
  v === '1' || v === 'true' ? sqlWhenTrue : sqlWhenFalse;
