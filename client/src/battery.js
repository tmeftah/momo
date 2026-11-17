// Approximate state of charge from a resting pack voltage.
// Voltage per cell = pack voltage / series count, then read off a discharge curve.
// Only meaningful on a pack that has rested (not right after charging or riding).

// [volts per cell, % charge], ascending
const LI_ION = [
  [3.0, 0], [3.3, 5], [3.5, 10], [3.6, 20], [3.68, 30], [3.74, 40],
  [3.79, 50], [3.85, 60], [3.92, 70], [4.0, 80], [4.08, 90], [4.2, 100],
];
// LiFePO4 is very flat between 20 and 90 %, so the estimate is rougher
const LIFEPO4 = [
  [2.5, 0], [2.9, 5], [3.0, 10], [3.2, 20], [3.25, 30], [3.26, 40],
  [3.27, 50], [3.28, 60], [3.3, 70], [3.32, 80], [3.35, 90], [3.4, 100],
];

const curveFor = (cellType) => (cellType === 'LiFePO4' ? LIFEPO4 : LI_ION);

// ---------- Pack consistency ----------
export const LIMITS = { s: [1, 30], p: [1, 30], capacity: [0.1, 300] };

// Capacity of one cell (Ah) that exists on the market, per format.
// LiFePO4, pouch and "Autre" come in every size, so they are not checked.
const CELL_AH = { 18650: [1.2, 3.6], 21700: [2.5, 5.5], 26650: [2.5, 5.5] };

// Volts per cell a pack can be labelled with: nominal (3.6–3.7) up to full charge (4.2)
const LABEL_PER_CELL = { liion: [3.2, 4.25], LiFePO4: [2.9, 3.65] };
// Single group reading at rest: below this the cell is dead or the value mistyped
const GROUP_V = { liion: [0.5, 4.3], LiFePO4: [0.5, 3.7] };

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')));
const fmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',');
const isInt = (n) => Number.isInteger(n);

/**
 * Checks a battery's details for impossible values (errors: block saving) and
 * unusual combinations (warnings: allowed after confirmation).
 * Each message is { at: 'pack' | 'groups' | 'tests' | 'capacity', text }, to show it next to its fields.
 * `label` is the free-text pack voltage of the repair ("48V", "36 V"…).
 */
export function checkPack(d, label = '') {
  const errors = [];
  const warnings = [];
  let at = 'pack';
  const E = (text) => errors.push({ at, text });
  const W = (text) => warnings.push({ at, text });
  const chem = d.cell_type === 'LiFePO4' ? 'LiFePO4' : 'liion';
  const s = num(d.config_s);
  const p = num(d.config_p);
  const cap = num(d.capacity_ah);
  const groups = num(d.groups_count);

  if (s !== null && (!isInt(s) || s < LIMITS.s[0] || s > LIMITS.s[1])) E(`Série : ${LIMITS.s[0]} à ${LIMITS.s[1]}S, nombre entier.`);
  if (p !== null && (!isInt(p) || p < LIMITS.p[0] || p > LIMITS.p[1])) E(`Parallèle : ${LIMITS.p[0]} à ${LIMITS.p[1]}P, nombre entier.`);
  if (cap !== null && (cap < LIMITS.capacity[0] || cap > LIMITS.capacity[1])) E(`Capacité : entre ${fmt(LIMITS.capacity[0])} et ${LIMITS.capacity[1]} Ah.`);
  const sOk = s !== null && !errors.some((e) => e.text.startsWith('Série'));
  const pOk = p !== null && !errors.some((e) => e.text.startsWith('Parallèle'));

  if (groups !== null && groups > 0) {
    if (!isInt(groups)) E('Groupes : nombre entier.');
    else if (sOk && groups > s) E(`Groupes : ${groups} groupes pour une batterie ${s}S, il ne peut pas y en avoir plus que la série.`);
    else if (sOk && groups < s) W(`Seulement ${groups} groupes mesurés sur ${s}.`);
  }

  // Capacity per cell = pack capacity / P, must match the cell format
  const range = CELL_AH[d.cell_type];
  if (range && pOk && cap) {
    const perCell = cap / p;
    if (perCell > range[1]) W(`${fmt(cap)} Ah en ${p}P = ${fmt(perCell)} Ah par cellule : une ${d.cell_type} fait au plus ${fmt(range[1])} Ah. Capacité annoncée surestimée ou P incorrect.`);
    else if (perCell < range[0]) W(`${fmt(cap)} Ah en ${p}P = ${fmt(perCell)} Ah par cellule : très bas pour une ${d.cell_type}. Vérifiez P.`);
  }

  // Labelled pack voltage vs series count
  const lv = num(String(label).match(/\d+(?:[.,]\d+)?/)?.[0]);
  if (lv && sOk) {
    const [lo, hi] = LABEL_PER_CELL[chem];
    const per = lv / s;
    if (per < lo || per > hi) {
      const nominal = Math.round(s * (chem === 'LiFePO4' ? 3.2 : 3.6));
      W(`${fmt(lv)} V ne correspond pas à ${s}S (≈ ${nominal} V nominal). Vérifiez la tension ou la série.`);
    }
  }

  // Measured pack voltages
  at = 'tests';
  for (const [key, name] of [['voltage_before', 'avant'], ['voltage_after', 'après']]) {
    const v = num(d[key]);
    if (v === null) continue;
    if (v < 0 || v > 200) E(`Tension ${name} : ${fmt(v)} V impossible.`);
    else if (sOk && v / s > GROUP_V[chem][1]) E(`Tension ${name} : ${fmt(v)} V = ${fmt(v / s)} V par cellule, au-dessus du maximum. Vérifiez la valeur ou la série.`);
  }

  // Each group reading
  at = 'groups';
  for (const [key, name] of [['groups', 'avant'], ['groups_after', 'après']]) {
    const bad = (d[key] || [])
      .slice(0, groups > 0 ? groups : 0)
      .map((v, i) => [i + 1, num(v)])
      .filter(([, v]) => v !== null && v !== 0 && (Number.isNaN(v) || v < GROUP_V[chem][0] || v > GROUP_V[chem][1]));
    if (bad.length) E(`Groupes ${name} : ${bad.map(([i, v]) => (Number.isNaN(v) ? `G${i} invalide` : `G${i} ${fmt(v)} V`)).join(', ')} hors plage (${fmt(GROUP_V[chem][0])} à ${fmt(GROUP_V[chem][1])} V).`);
  }

  at = 'capacity';
  const measured = num(d.capacity_measured);
  if (measured !== null && cap && measured > cap * 1.2) W(`Capacité mesurée (${fmt(measured)} Ah) supérieure de plus de 20 % à la capacité annoncée.`);

  return { errors, warnings };
}

/** → { perCell, pct } or null when the inputs can't give a plausible reading */
export function chargeLevel(packVolts, series, cellType) {
  const v = Number(String(packVolts ?? '').replace(',', '.'));
  const s = Number(series);
  if (!(v > 0) || !(s > 0)) return null;
  const perCell = v / s;
  // Outside this range the S count or the voltage is most likely mistyped
  if (perCell < 2 || perCell > 4.4) return null;
  const curve = curveFor(cellType);
  let pct;
  if (perCell <= curve[0][0]) pct = 0;
  else if (perCell >= curve[curve.length - 1][0]) pct = 100;
  else {
    const i = curve.findIndex(([cv]) => cv >= perCell);
    const [v0, p0] = curve[i - 1];
    const [v1, p1] = curve[i];
    pct = p0 + ((perCell - v0) / (v1 - v0)) * (p1 - p0);
  }
  return { perCell: Math.round(perCell * 100) / 100, pct: Math.round(pct / 5) * 5 };
}
