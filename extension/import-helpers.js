/**
 * Shared by the extension popup and the app's phone import screen (client/src/views/ProductImport.vue).
 */

// Checked in this order against the shop's category, then the product name
const CATEGORY_HINTS = [
  [/\bbms\b|carte de protection/i, 'BMS'],
  [/18650/, 'Cellules 18650'],
  [/21700/, 'Cellules 21700'],
  [/chargeur|charger|ladegerät/i, 'Chargeurs'],
  [/contr[ôo]leur|controller/i, 'Contrôleurs'],
  [/[ée]cran|display|afficheur|\blcd\b/i, 'Écrans'],
  [/capteurs? (à )?effet hall|hall sensor|capteurs? hall/i, 'Capteurs Hall'],
  [/moteur|motor/i, 'Moteurs'],
  [/connecteur|connector|\bxt ?(30|60|90)\b|anderson|\bgx ?16\b/i, 'Connecteurs'],
  [/c[âa]ble|cable|faisceau|rallonge/i, 'Câbles'],
  [/batterie|battery|\baccus?\b/i, 'Batteries'],
];
// Only when no text names a specific part ("Moteur" in the name beats "Pièces trottinette")
const ACCESSORY_HINTS = [
  [/trottinette|scooter [ée]lectrique pliant|kick ?scooter|\bm365\b|ninebot|xiaomi/i, 'Accessoires trottinette électrique'],
  [/scooter|cyclomoteur/i, 'Accessoires scooter électrique'],
  [/v[ée]lo|\bvae\b|e-?bike/i, 'Accessoires vélo électrique'],
];

const CURRENCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£', TND: 'DT', MAD: 'DH', DZD: 'DA', CHF: 'CHF', CAD: '$' };

export const squash = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');

/** One of the known stock categories for an extracted product, or ''. */
export function guessCategory(p, known) {
  const texts = [p.category, ...(p.breadcrumbs || []).slice().reverse(), p.name].filter(Boolean);
  for (const t of texts) {
    const exact = known.find((c) => squash(c) === squash(t));
    if (exact) return exact;
  }
  for (const hints of [CATEGORY_HINTS, ACCESSORY_HINTS]) {
    for (const t of texts) for (const [re, cat] of hints) if (re.test(t) && known.includes(cat)) return cat;
  }
  return '';
}

/** The supplier whose name matches the shop's domain ("velo-parts.fr" ↔ "VeloParts"). */
export function guessSupplier(site, suppliers) {
  const host = squash(site.split('.').slice(0, -1).join('.') || site);
  return suppliers.find((s) => {
    const n = squash(s.name);
    return n.length >= 3 && (host.includes(n) || n.includes(host));
  })?.id;
}

/** Warning when the shop shows prices in another currency than the stock's. */
export function currencyWarning(code, stockCurrency) {
  if (!code || !stockCurrency) return '';
  const symbol = CURRENCY_SYMBOL[code] || code;
  if (squash(symbol) === squash(stockCurrency) || squash(code) === squash(stockCurrency)) return '';
  return `Prix affiché en ${code} sur le site, le stock est en ${stockCurrency} : convertissez le montant si besoin.`;
}
