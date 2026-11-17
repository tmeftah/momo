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
