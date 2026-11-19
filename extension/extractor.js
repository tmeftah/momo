/**
 * Reads the product shown on the current shop page.
 *
 * chrome.scripting.executeScript serialises this function and runs it inside the page,
 * so it must stay self-contained: no imports and no references to outer variables.
 *
 * Sources, from most to least reliable, merged field by field:
 *   rules     CSS selectors written for one site (site-rules.js)
 *   platform  data published by the shop software (Shopify, PrestaShop, WooCommerce, Magento)
 *   ld        schema.org JSON-LD
 *   microdata schema.org microdata
 *   meta      Open Graph / product meta tags
 *   dom       reading the page itself (title, visible price, gallery, "Réf. :" labels…)
 *
 * page (optional, used by the app on phones): { html, url, fetchText(url) } reads HTML fetched
 * by the server instead of the open tab. There is no layout then, so visibility and picture
 * sizes come from attributes, and fetchText replaces same-site requests (Shopify data).
 */
export async function extractProduct(siteRules = {}, page = null) {
  const MAX_IMAGES = 15;
  const MAX_DESCRIPTION = 10000;
  const live = !page;
  const doc = live ? document : new DOMParser().parseFromString(page.html, 'text/html');
  const loc = live ? location : new URL(page.url);
  const lang = (doc.documentElement.lang || navigator.language || '').toLowerCase();
  const variantId = new URLSearchParams(loc.search).get('variant');

  // ---------- small helpers ----------
  const $ = (sel, root = doc) => {
    try {
      return root.querySelector(sel);
    } catch {
      return null;
    }
  };
  const $$ = (sel, root = doc) => {
    try {
      return [...root.querySelectorAll(sel)];
    } catch {
      return [];
    }
  };
  const clean = (s) => (s === undefined || s === null ? '' : String(s)).replace(/[\s  ]+/g, ' ').trim();
  const txt = (el) => (el ? clean(el.tagName === 'META' ? el.getAttribute('content') : el.textContent) : '');
  const has = (v) =>
    v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'number' && !Number.isFinite(v));
  const firstOf = (sels, root = doc) => {
    for (const s of sels) {
      const e = $(s, root);
      if (e) return e;
    }
    return null;
  };
  const visible = (el) => !!el && (!live || el.tagName === 'META' || el.getClientRects().length > 0);
  /** Rendered size on a live page; width/height attributes otherwise (0 when unknown). */
  const sizeOf = (img) => {
    if (live) {
      const r = img.getBoundingClientRect();
      return { w: Math.max(r.width, img.naturalWidth || 0), h: Math.max(r.height, img.naturalHeight || 0) };
    }
    return { w: parseInt(img.getAttribute('width'), 10) || 0, h: parseInt(img.getAttribute('height'), 10) || 0 };
  };
  const getJson = async (url) => {
    if (live) {
      const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
      return res.ok ? res.json() : null;
    }
    return page.fetchText ? JSON.parse(await page.fetchText(url)) : null;
  };
  const metaContent = (...names) => {
    for (const n of names) {
      const c = clean($(`meta[property="${n}"], meta[name="${n}"]`)?.getAttribute('content'));
      if (c) return c;
    }
    return '';
  };
  const absUrl = (u) => {
    if (!u || typeof u !== 'string') return null;
    u = u.trim();
    if (!u || u.startsWith('data:') || u.startsWith('blob:')) return null;
    try {
      const x = new URL(u, loc.href);
      return x.protocol === 'http:' || x.protocol === 'https:' ? x.href : null;
    } catch {
      return null;
    }
  };
  const asArray = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
  const nameOf = (v) => {
    for (const x of asArray(v)) {
      const s = clean(typeof x === 'object' ? x?.name : x);
      if (s) return s;
    }
    return '';
  };

  /** HTML (or text with entities) to readable plain text with line breaks. DOMParser never runs scripts. */
  const htmlToText = (html, depth = 0, cellSeparator = ' ') => {
    if (!html) return '';
    const d = new DOMParser().parseFromString(String(html), 'text/html');
    d.querySelectorAll('script, style, noscript, template, iframe').forEach((e) => e.remove());
    d.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
    d.querySelectorAll('li').forEach((li) => li.prepend('- '));
    d.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6, ul, ol, table').forEach((b) => b.append('\n'));
    d.querySelectorAll('td, th').forEach((c) => c.append(cellSeparator));
    const out = (d.body?.textContent || '')
      .replace(/[ \t  ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^(description|description du produit|descriptif|product description|beschreibung)\n/i, '')
      .trim();
    // Shops often escape their HTML twice in JSON-LD: "&lt;p&gt;"
    return depth === 0 && /<\/?[a-z][a-z0-9]*[\s>/]/i.test(out) ? htmlToText(out, 1) : out;
  };

  // ---------- value normalisers ----------
  const CURRENCY_PATTERNS = [
    [/€|\bEUR\b|\beuros?\b/i, 'EUR'],
    [/£|\bGBP\b/i, 'GBP'],
    [/\bCHF\b/i, 'CHF'],
    [/\bTND\b|\bDT\b|د\.ت/i, 'TND'],
    [/\bMAD\b|\bDHS?\b|د\.م/i, 'MAD'],
    [/\bDZD\b|\bDA\b|د\.ج/i, 'DZD'],
    [/\bCAD\b|CA\$/i, 'CAD'],
    [/\bUSD\b|US\$|\$/, 'USD'],
  ];
  const currencyOf = (s) => {
    s = clean(s);
    if (!s) return '';
    if (/^[A-Z]{3}$/.test(s)) return s;
    for (const [re, code] of CURRENCY_PATTERNS) if (re.test(s)) return code;
    return '';
  };
  const THREE_DECIMALS = ['TND', 'KWD', 'BHD', 'OMR', 'JOD', 'LYD', 'IQD'];

  /** "1 299,00 €", "1,299.00", "12,500 DT", 19.9 → number. */
  const parsePrice = (v, currency = '') => {
    if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;
    let s = clean(v).replace(/\s/g, '');
    if (!s) return null;
    if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
    const m = s.match(/\d[\d.,']*/);
    if (!m) return null;
    s = m[0].replace(/'/g, '').replace(/[.,]+$/, '');
    const c = s.lastIndexOf(',');
    const d = s.lastIndexOf('.');
    if (c > -1 && d > -1) {
      s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (c > -1 || d > -1) {
      const sep = c > -1 ? ',' : '.';
      const parts = s.split(sep);
      const tail = parts[parts.length - 1];
      let decimal;
      if (parts.length > 2) decimal = false;
      else if (tail.length !== 3) decimal = true;
      // "12,500": decimals in 3-decimal currencies; elsewhere a comma is decimal except in English
      else decimal = THREE_DECIMALS.includes(currency) || (sep === ',' ? !lang.startsWith('en') : lang.startsWith('en'));
      s = decimal ? parts.slice(0, -1).join('') + '.' + tail : parts.join('');
    }
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const gtinChecksumOk = (g) => {
    const digits = g.split('').map(Number);
    const check = digits.pop();
    const sum = digits.reverse().reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  };
  /** Digits only, 8–14 long. strict = the value was guessed from page text, so the check digit must be right. */
  const gtin = (v, strict = false) => {
    const s = clean(v).replace(/[\s-]/g, '');
    if (!/^\d{8,14}$/.test(s)) return '';
    if (strict && !gtinChecksumOk(s)) return '';
    return s;
  };

  const SCHEMA_AVAILABILITY = {
    instock: 'in_stock',
    instoreonly: 'in_stock',
    onlineonly: 'in_stock',
    available: 'in_stock',
    limitedavailability: 'limited',
    lastremainingitems: 'limited',
    outofstock: 'out_of_stock',
    soldout: 'out_of_stock',
    unavailable: 'out_of_stock',
    preorder: 'preorder',
    presale: 'preorder',
    backorder: 'backorder',
    madetoorder: 'backorder',
    discontinued: 'discontinued',
  };
  /** schema.org URL, platform code or visible text → in_stock | limited | out_of_stock | preorder | backorder | discontinued */
  const availabilityOf = (v) => {
    const s = clean(v).toLowerCase();
    if (!s) return '';
    const schema = s.match(/schema\.org\/(\w+)/);
    const key = schema ? schema[1] : s.replace(/[\s_-]/g, '');
    if (SCHEMA_AVAILABILITY[key]) return SCHEMA_AVAILABILITY[key];
    if (/rupture|épuisé|epuise|indisponible|non disponible|out of stock|sold out|not available|unavailable|ausverkauft|nicht (verfügbar|lieferbar)|agotado|غير متوفر|نفذ/.test(s)) return 'out_of_stock';
    if (/plus fabriqué|discontinued|n'est plus commercialisé/.test(s)) return 'discontinued';
    if (/pr[ée]-?commande|pre-?order/.test(s)) return 'preorder';
    if (/sur commande|backorder|on order|auf bestellung/.test(s)) return 'backorder';
    if (/derni(er|ère)s? (pièce|article|exemplaire)|only \d+ left|stock limité|low stock|plus que \d+|quantité limitée|nur noch \d+/.test(s)) return 'limited';
    if (/en stock|in stock|disponible|available|auf lager|lieferbar|متوفر|متاح/.test(s)) return 'in_stock';
    return '';
  };

  // ---------- images ----------
  const bestFromSrcset = (ss) => {
    let best = null;
    let bestW = -1;
    for (const part of String(ss).split(/,\s+/)) {
      const [url, size] = part.trim().split(/\s+/);
      const w = size ? parseFloat(size) * (size.endsWith('x') ? 1000 : 1) : 0;
      if (url && w >= bestW) {
        best = url;
        bestW = w;
      }
    }
    return best;
  };
  const HIRES_ATTRS = ['data-zoom-image', 'data-large_image', 'data-large-image', 'data-image-large-src', 'data-full', 'data-full-src', 'data-zoom', 'data-zoom-src', 'data-hires', 'data-src-large', 'data-original'];
  const imageUrlOf = (el) => {
    if (!el) return null;
    for (const a of HIRES_ATTRS) {
      const v = el.getAttribute(a);
      if (v && !v.trim().startsWith('{')) {
        const u = absUrl(v);
        if (u) return u;
      }
    }
    const href = el.closest('a[href]')?.getAttribute('href');
    if (href && /\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(href)) {
      const u = absUrl(href);
      if (u) return u;
    }
    const sets = [el.getAttribute('srcset'), el.getAttribute('data-srcset')];
    const pic = el.closest('picture');
    if (pic) for (const s of pic.querySelectorAll('source')) sets.push(s.getAttribute('srcset'), s.getAttribute('data-srcset'));
    for (const ss of sets) {
      const u = ss && absUrl(bestFromSrcset(ss));
      if (u) return u;
    }
    for (const a of ['data-src', 'data-lazy-src', 'data-lazy']) {
      const u = absUrl(el.getAttribute(a));
      if (u) return u;
    }
    return absUrl(el.currentSrc || el.getAttribute('src') || el.getAttribute('content') || el.getAttribute('href'));
  };
  const ldImages = (v) =>
    asArray(v)
      .flatMap((x) => (typeof x === 'string' ? [x] : [x?.contentUrl, x?.url].filter(Boolean).slice(0, 1)))
      .map(absUrl);

  /** Ask for the original instead of a resized copy where the URL scheme is well known. */
  const upgradeImage = (u) => {
    try {
      const x = new URL(u);
      if (x.pathname.includes('/wp-content/uploads/')) x.pathname = x.pathname.replace(/-\d{2,4}x\d{2,4}(?=\.\w{3,4}$)/, '');
      if (x.hostname === 'cdn.shopify.com' || x.pathname.includes('/cdn/shop/')) {
        x.pathname = x.pathname.replace(/_(\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(@\dx)?(?=\.\w{3,4}$)/, '');
        for (const p of ['width', 'height', 'crop']) x.searchParams.delete(p);
      }
      return x.href;
    } catch {
      return u;
    }
  };
  const JUNK_IMAGE = /(sprite|icon|logo|placeholder|blank|spacer|loader|loading|pixel|1x1|badge|flag|payment|rating|stars?[-_.]|avatar|banner|transparent)/i;
  const goodImage = (u) => {
    if (!u) return false;
    const path = u.split(/[?#]/)[0];
    if (/\.svg$/i.test(path)) return false;
    return !JUNK_IMAGE.test(path.split('/').slice(-2).join('/'));
  };

  // Parts of a page that are about other products or the site itself
  const NOISE =
    'header, footer, nav, aside, [class*="related" i], [id*="related" i], [class*="upsell" i], [class*="cross-sell" i], [class*="crosssell" i], [class*="recommend" i], [class*="similar" i], [class*="recently" i], [class*="also-bought" i], [class*="newsletter" i], [class*="cart-drawer" i], [class*="minicart" i], [class*="mini-cart" i]';
  const isNoise = (el) => !!el.closest(NOISE);

  // ---------- source: site rules ----------
  function fromRules() {
    const host = loc.hostname.replace(/^www\./, '');
    const key = Object.keys(siteRules || {}).find((k) => host === k.replace(/^www\./, '') || host.endsWith('.' + k.replace(/^www\./, '')));
    const r = key ? siteRules[key] : null;
    if (!r) return {};
    const one = (sel) => (sel ? txt($(sel)) : '');
    const out = {
      name: one(r.name),
      sku: one(r.sku),
      ean: gtin(one(r.ean)),
      brand: one(r.brand),
      availability_text: one(r.availability),
      images: r.images ? $$(r.images).map(imageUrlOf) : [],
    };
    if (r.price) {
      const el = $(r.price);
      const raw = el?.getAttribute('content') || el?.getAttribute('data-price') || txt(el);
      out.currency = currencyOf(txt(el));
      out.price = parsePrice(raw, out.currency);
    }
    if (r.description) out.description = htmlToText($(r.description)?.innerHTML);
    if (r.category) {
      const crumbs = $$(r.category).map(txt).filter(Boolean);
      if (crumbs.length > 1) out.breadcrumbs = crumbs;
      else out.category = crumbs[0] || '';
    }
    out.availability = availabilityOf(out.availability_text);
    return out;
  }

  // ---------- source: shop platforms ----------
  async function fromShopify() {
    const m = loc.pathname.match(/^(.*?\/products\/[^/?#]+)/);
    const isShopify = $('meta[name="shopify-digital-wallet"], meta[name="shopify-checkout-api-token"], link[href*="cdn.shopify.com"], script[src*="cdn.shopify.com"], link[href*="/cdn/shop/"]');
    if (!m || !isShopify) return {};
    try {
      const p = await getJson(new URL(`${m[1]}.js`, loc.href).href);
      if (!p) return {};
      const variants = p.variants || [];
      const v = variants.find((x) => String(x.id) === variantId) || variants.find((x) => x.available) || variants[0] || {};
      const multi = variants.length > 1 && v.title && v.title !== 'Default Title';
      return {
        platform: 'Shopify',
        name: multi ? `${p.title} – ${v.title}` : p.title,
        price: typeof (v.price ?? p.price) === 'number' ? (v.price ?? p.price) / 100 : null,
        sku: v.sku,
        ean: gtin(v.barcode),
        brand: p.vendor,
        category: p.type,
        description: htmlToText(p.description),
        availability: (v.available ?? p.available) ? 'in_stock' : 'out_of_stock',
        images: [v.featured_image?.src, ...(p.images || [])].map(absUrl),
      };
    } catch {
      return {};
    }
  }

  function fromPrestashop() {
    let d = null;
    try {
      d = JSON.parse($('#product-details[data-product], [data-product].js-product-details')?.getAttribute('data-product') || 'null');
    } catch {
      d = null;
    }
    const gallery = $$('[data-image-large-src]').map((e) => absUrl(e.getAttribute('data-image-large-src')));
    if (!d && !gallery.length) return {};
    const out = { platform: 'PrestaShop', images: [] };
    if (d) {
      Object.assign(out, {
        name: d.name,
        sku: d.reference_to_display || d.reference,
        ean: gtin(d.ean13) || gtin(d.upc) || gtin(d.gtin),
        brand: d.manufacturer_name,
        category: d.category_name,
        price: parsePrice(d.price_amount ?? d.price),
        availability: availabilityOf(d.availability),
        availability_text: clean(d.availability_message),
        description: htmlToText(d.description || d.description_short),
      });
      const imgs = [d.cover, ...(d.images || [])].filter(Boolean);
      out.images = imgs.map((i) => absUrl(i.large?.url || i.bySize?.large_default?.url || i.medium?.url));
    }
    out.images.push(...gallery);
    if (!out.sku) out.sku = txt($('.product-reference span, .product-reference [itemprop="sku"]'));
    return out;
  }

  function fromWoo() {
    if (!$('.woocommerce-product-gallery, body.single-product .product_meta')) return {};
    const summary = $('.summary, .entry-summary') || doc;
    const priceEl = $('.price ins .woocommerce-Price-amount', summary) || $('.price .woocommerce-Price-amount', summary);
    const stock = $('.stock', summary);
    const currency = currencyOf(txt(priceEl?.querySelector('.woocommerce-Price-currencySymbol')));
    return {
      platform: 'WooCommerce',
      images: $$('.woocommerce-product-gallery__image').map((e) => absUrl(e.querySelector('a')?.getAttribute('href')) || imageUrlOf(e.querySelector('img'))),
      sku: txt($('.product_meta .sku')),
      category: txt($('.product_meta .posted_in a')),
      brand: txt($('.pwb-single-product-brands a, .product_meta .brand a, .product_meta .posted_in.brand a, .wb-single-brand a')),
      price: priceEl ? parsePrice(txt(priceEl), currency) : null,
      currency,
      availability: stock
        ? stock.classList.contains('out-of-stock')
          ? 'out_of_stock'
          : stock.classList.contains('available-on-backorder')
            ? 'backorder'
            : availabilityOf(txt(stock)) || 'in_stock'
        : '',
      availability_text: txt(stock),
      description: htmlToText(($('#tab-description, .woocommerce-Tabs-panel--description') || $('.woocommerce-product-details__short-description'))?.innerHTML),
    };
  }

  function fromMagento() {
    const images = [];
    const findGallery = (o) => {
      if (!o || typeof o !== 'object') return;
      const g = o['mage/gallery/gallery'];
      if (g?.data) {
        for (const im of g.data) images.push(absUrl(im.full || im.img));
        return;
      }
      Object.values(o).forEach(findGallery);
    };
    for (const s of $$('script[type="text/x-magento-init"]')) {
      if (!s.textContent.includes('mage/gallery/gallery')) continue;
      try {
        findGallery(JSON.parse(s.textContent));
      } catch {
        /* not JSON */
      }
    }
    const priceEl = $('.product-info-main [data-price-type="finalPrice"][data-price-amount]');
    if (!images.length && !priceEl) return {};
    return {
      platform: 'Magento',
      images,
      price: priceEl ? parsePrice(priceEl.getAttribute('data-price-amount')) : null,
      sku: txt($('.product-info-main .product.attribute.sku .value')),
      availability: availabilityOf(txt($('.product-info-main .stock span, .product-info-stock-sku .stock'))),
      description: htmlToText($('.product.attribute.description .value')?.innerHTML),
    };
  }

  // ---------- source: schema.org JSON-LD ----------
  const ldNodes = [];
  {
    const walk = (n, depth) => {
      if (!n || typeof n !== 'object' || depth > 8) return;
      if (Array.isArray(n)) return n.forEach((x) => walk(x, depth + 1));
      ldNodes.push(n);
      for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage']) if (n[k] && typeof n[k] === 'object') walk(n[k], depth + 1);
    };
    for (const s of $$('script[type="application/ld+json"]')) {
      const raw = s.textContent.trim();
      try {
        walk(JSON.parse(raw), 0);
      } catch {
        try {
          walk(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ')), 0);
        } catch {
          /* broken JSON-LD: ignore */
        }
      }
    }
  }
  const typeIs = (n, ...types) => asArray(n['@type']).some((t) => types.includes(String(t).replace(/^.*[/#]/, '')));
  const h1Text = clean(firstOf(['h1[itemprop="name"]', '.product_title', '.product-title h1', 'h1.product-title', 'h1.product-name', 'main h1', 'h1'])?.textContent);

  function fromLd() {
    const products = ldNodes.filter((n) => typeIs(n, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel', 'Car', 'Vehicle'));
    const r = {};
    if (products.length) {
      const h1 = h1Text.toLowerCase();
      const score = (p) => {
        const name = clean(p.name).toLowerCase();
        let s = 0;
        if (p.offers || p.hasVariant) s += 2;
        if (h1 && name && (name === h1 || h1.includes(name) || name.includes(h1))) s += 3;
        try {
          if (p.url && new URL(p.url, loc.href).pathname === loc.pathname) s += 2;
        } catch {
          /* ignore */
        }
        if (p.image) s += 1;
        return s;
      };
      const p = products.reduce((best, x) => (score(x) > score(best) ? x : best));
      let variant = null;
      if (Array.isArray(p.hasVariant) && p.hasVariant.length) {
        variant =
          (variantId && p.hasVariant.find((v) => [v.sku, v['@id'], v.url, v.productID].some((x) => x && String(x).includes(variantId)))) ||
          p.hasVariant[0];
      }
      const pick = (k) => (has(variant?.[k]) ? variant[k] : p[k]);
      const offers = asArray(pick('offers')).flatMap((o) => (Array.isArray(o?.offers) ? [o, ...o.offers] : [o])).filter((o) => o && typeof o === 'object');
      const priceOf = (o) => o.price ?? o.lowPrice ?? asArray(o.priceSpecification).find((ps) => ps?.price !== undefined)?.price;
      const offer = offers.find((o) => has(priceOf(o))) || offers[0] || {};
      const currency = clean(offer.priceCurrency || asArray(offer.priceSpecification).find((ps) => ps?.priceCurrency)?.priceCurrency);
      Object.assign(r, {
        name: clean(variant?.name || p.name),
        description: htmlToText(asArray(p.description)[0] || variant?.description),
        sku: clean(pick('sku') || pick('mpn')),
        ean: gtin(pick('gtin13')) || gtin(pick('gtin')) || gtin(pick('gtin12')) || gtin(pick('gtin14')) || gtin(pick('gtin8')) || gtin(pick('ean')),
        brand: nameOf(p.brand) || nameOf(p.manufacturer),
        category: Array.isArray(p.category) ? p.category.map(nameOf).filter(Boolean).join(' > ') : nameOf(p.category),
        images: [...ldImages(variant?.image), ...ldImages(p.image)],
        currency,
        price: parsePrice(priceOf(offer), currency),
        availability: availabilityOf(offer.availability),
      });
    }
    const crumbs = ldNodes.find((n) => typeIs(n, 'BreadcrumbList'));
    if (crumbs) {
      r.breadcrumbs = asArray(crumbs.itemListElement)
        .slice()
        .sort((a, b) => (Number(a?.position) || 0) - (Number(b?.position) || 0))
        .map((e) => clean(e?.name || (typeof e?.item === 'object' ? e.item?.name : '')))
        .filter(Boolean);
    }
    return r;
  }

  // ---------- source: schema.org microdata ----------
  function fromMicrodata() {
    const root = $('[itemscope][itemtype*="schema.org/Product" i]');
    if (!root) return {};
    const val = (el) => (el ? clean(el.getAttribute('content') ?? el.getAttribute('href') ?? el.getAttribute('src') ?? el.textContent) : '');
    const own = (prop) => $$(`[itemprop~="${prop}"]`, root).find((el) => el.parentElement?.closest('[itemscope]') === root && !el.hasAttribute('itemscope'));
    const any = (prop) => $(`[itemprop~="${prop}"]`, root);
    const brandEl = any('brand') || any('manufacturer');
    const descEl = own('description');
    const priceEl = any('price') || any('lowPrice');
    const currency = val(any('priceCurrency'));
    return {
      name: val(own('name')),
      description: descEl ? (descEl.tagName === 'META' ? clean(descEl.getAttribute('content')) : htmlToText(descEl.innerHTML)) : '',
      sku: val(any('sku')) || val(any('mpn')),
      ean: gtin(val(any('gtin13'))) || gtin(val(any('gtin'))) || gtin(val(any('gtin12'))) || gtin(val(any('gtin8'))),
      brand: brandEl ? val($('[itemprop~="name"]', brandEl)) || val(brandEl) : '',
      category: val(own('category')),
      images: $$('[itemprop~="image"]', root).map(imageUrlOf),
      currency,
      price: priceEl ? parsePrice(priceEl.getAttribute('content') ?? priceEl.textContent, currency) : null,
      availability: availabilityOf(val(any('availability'))),
    };
  }

  // ---------- source: Open Graph / meta tags ----------
  function fromMeta() {
    const currency = metaContent('product:price:currency', 'og:price:currency');
    return {
      name: metaContent('og:title', 'twitter:title'),
      description: metaContent('og:description', 'description', 'twitter:description'),
      images: $$('meta[property="og:image"], meta[property="og:image:url"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').map((m) => absUrl(m.getAttribute('content'))),
      currency,
      price: parsePrice(metaContent('product:price:amount', 'og:price:amount', 'product:sale_price:amount'), currency),
      availability: availabilityOf(metaContent('product:availability', 'og:availability')),
      brand: metaContent('product:brand', 'og:brand'),
      sku: metaContent('product:retailer_item_id', 'product:sku'),
      ean: gtin(metaContent('product:ean', 'product:gtin', 'product:upc')),
      category: metaContent('product:category'),
    };
  }

  // ---------- source: the page itself ----------
  function fromDom() {
    const r = {};
    const h1 = firstOf(['h1[itemprop="name"]', '.product_title', 'h1.product-title', 'h1.product-name', 'main h1', 'h1']);
    r.name = h1Text || clean(doc.title.split(/\s[|–—-]\s/)[0]);

    // The product block: climb from the title until a large picture is included
    let scope = doc.body;
    if (h1) {
      let e = h1;
      for (let i = 0; i < 10 && e.parentElement && e.parentElement !== doc.body; i++) {
        e = e.parentElement;
        // Without layout, a picture with no declared size counts too
        if ([...e.querySelectorAll('img')].some((img) => sizeOf(img).w >= 200 || (!live && !sizeOf(img).w && !isNoise(img)))) {
          scope = e;
          break;
        }
      }
    }

    // Price: machine-readable attributes first, then visible text. Crossed-out prices are skipped.
    const OLD_PRICE = 'del, s, strike, [class*="old" i], [class*="was" i], [class*="compare" i], [class*="crossed" i], [class*="barre" i], [class*="before" i], [class*="regular-price" i]';
    const PRICE_SELS = ['[itemprop="price"]', '[data-price-amount]', '[data-price-type="finalPrice"]', '.current-price', '.product-price', '.price-current', '.price--current', '.special-price .price', '.price ins', '.our_price_display', '.price-item--sale', '.price', '[class*="price" i]'];
    search: for (const root of scope === doc.body ? [doc.body] : [scope, doc.body]) {
      for (const sel of PRICE_SELS) {
        for (const el of $$(sel, root).slice(0, 12)) {
          if (el.closest(OLD_PRICE) || isNoise(el) || !visible(el)) continue;
          const machine = el.getAttribute('content') || el.getAttribute('data-price-amount') || el.getAttribute('data-price');
          const label = txt(el);
          if (!machine && (!/\d/.test(label) || label.length > 40)) continue;
          const currency = currencyOf(label);
          const p = parsePrice(machine || label, currency);
          if (p > 0) {
            Object.assign(r, { price: p, currency });
            break search;
          }
        }
      }
    }

    // Images: product gallery first, otherwise the largest pictures near the title
    const GALLERY = ['[data-zoom-image]', '[data-large-image]', '[data-large_image]', '[data-image-large-src]', '[class*="gallery" i] img', '[class*="product-image" i] img', '[class*="product__media" i] img', '[class*="productImage" i] img', '[class*="product-photo" i] img', '[class*="zoom" i] img', '[class*="thumbnail" i] img', '[class*="carousel" i] img', '[class*="slider" i] img', '[class*="swiper" i] img'];
    const fromGallery = [];
    for (const root of [...new Set([scope, doc.body])]) {
      for (const sel of GALLERY) for (const el of $$(sel, root)) if (!isNoise(el)) fromGallery.push(imageUrlOf(el));
      if (fromGallery.filter(Boolean).length) break;
    }
    r.images = fromGallery;
    if (!fromGallery.filter(Boolean).length) {
      r.images = [...new Set([scope, doc.body])]
        .flatMap((root) => $$('img', root))
        .filter((img) => !isNoise(img))
        .map((img) => ({ img, size: sizeOf(img) }))
        .filter(({ size }) => (size.w >= 250 && size.h >= 200) || (!live && !size.w))
        .sort((a, b) => b.size.w * b.size.h - a.size.w * a.size.h)
        .slice(0, 6)
        .map(({ img }) => imageUrlOf(img));
    }

    const descEl = firstOf(['[itemprop="description"]', '#tab-description', '#description', '.product-description', '.product__description', '.product-single__description', '#product-description', '.woocommerce-product-details__short-description', '[class*="product-description" i]', '[class*="description" i]', '[id*="description" i]']);
    if (descEl && !isNoise(descEl)) r.description = descEl.tagName === 'META' ? clean(descEl.getAttribute('content')) : htmlToText(descEl.innerHTML);
    if (r.description && r.description.length < 20) r.description = '';

    const crumbSets = [
      () => $$('[itemtype*="BreadcrumbList" i] [itemprop="name"]'),
      () => $$('nav[aria-label*="breadcrumb" i] li, nav[aria-label*="fil d" i] li'),
      () => $$('.breadcrumb li, .breadcrumbs li, ol.breadcrumb > *'),
      () => $$('[class*="breadcrumb" i] a, [class*="breadcrumb" i] li'),
    ];
    for (const get of crumbSets) {
      const crumbs = get().map(txt).filter(Boolean);
      if (crumbs.length) {
        r.breadcrumbs = crumbs;
        break;
      }
    }

    // "Réf. : CH-42", "EAN : 376…", "Marque : Bafang", also in two-column spec tables
    const textOf = (el) => (live ? el.innerText || '' : htmlToText(el.innerHTML, 1, ' : ')).slice(0, 60000);
    const text = textOf(scope) + '\n' + (scope === doc.body ? '' : textOf(doc.body));
    const grab = (re) => clean(text.match(re)?.[1]).replace(/[\s:]+$/, '');
    r.ean = gtin(grab(/\b(?:EAN(?:[- ]?13)?|GTIN(?:[- ]?1[234])?|UPC|Code[- ]barres?|Barcode)\s*[.:#]?\s*(\d[\d ]{6,16}\d)/i), true);
    r.sku = grab(/(?:^|[\s(])(?:SKU|R[ée]f(?:[ée]rence)?(?: (?:produit|article|fabricant))?|Art(?:ikel)?[.-]?\s?(?:Nr|No)|Item (?:No|#)|Product code|Code (?:produit|article)|MPN)(?:\s*[.:#\t]\s*|\s+)+((?=[A-Z0-9\-_./]*\d)[A-Z0-9][A-Z0-9\-_./]{1,39})/i);
    r.brand = grab(/(?:^|\n)\s*(?:Marque|Brand|Fabricant|Manufacturer|Hersteller|Marca)\s*(?:[:\t]\s*)+([^\n\t]{2,40})/i);

    const availEl = firstOf(['[itemprop="availability"]', '#availability', '.availability', '.product-availability', '.stock', '[class*="availability" i]', '[class*="stock-status" i]', '[class*="in-stock" i]', '[class*="out-of-stock" i]', '[data-stock]'], scope);
    if (availEl && !isNoise(availEl)) {
      const label = txt(availEl).slice(0, 120);
      r.availability_text = label.length <= 80 ? label : '';
      r.availability = availabilityOf(availEl.getAttribute('href') || availEl.getAttribute('content') || label);
    }
    return r;
  }

  // ---------- merge ----------
  const platform = [await fromShopify(), fromPrestashop(), fromWoo(), fromMagento()].reduce((acc, p) => {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'images') acc.images = [...(acc.images || []), ...v];
      else if (!has(acc[k]) && has(v)) acc[k] = v;
    }
    return acc;
  }, {});
  const found = { rules: fromRules(), platform, ld: fromLd(), microdata: fromMicrodata(), meta: fromMeta(), dom: fromDom() };
  const ORDER = ['rules', 'platform', 'ld', 'microdata', 'meta', 'dom'];
  // For the name and description, the page text beats share tags ("Product – Shop name", short summaries)
  const ORDER_TEXT = ['rules', 'platform', 'ld', 'microdata', 'dom', 'meta'];

  const sources = {};
  const take = (field, order = ORDER) => {
    for (const src of order) {
      const v = found[src][field];
      if (has(v)) {
        sources[field] = src;
        return typeof v === 'string' ? v.trim() : v;
      }
    }
    return field === 'price' ? null : '';
  };

  const name = take('name', ORDER_TEXT);
  const price = take('price');
  const currency = currencyOf(sources.price ? found[sources.price].currency : '') || currencyOf(take('currency'));

  const seen = new Set();
  const images = [];
  for (const src of ORDER) {
    for (const u of found[src].images || []) {
      if (!goodImage(u)) continue;
      const best = upgradeImage(u);
      if (seen.has(best)) continue;
      seen.add(best);
      images.push(best);
      if (!sources.images) sources.images = src;
    }
  }

  // Breadcrumbs without "Accueil" and without the product itself; the category is the last one left
  const isHome = (s) => /^(accueil|home|startseite|inicio|homepage|الرئيسية)$/i.test(s);
  const strip = (s) => clean(s.replace(/^[\s›»>/|·-]+|[\s›»>/|·-]+$/g, ''));
  let breadcrumbs = (take('breadcrumbs') || []).map(strip).filter((c) => c && !isHome(c) && c.toLowerCase() !== name.toLowerCase() && c.length < 80);
  breadcrumbs = breadcrumbs.filter((c, i) => c !== breadcrumbs[i - 1]);
  let category = take('category');
  if (/\s[>›/|]\s/.test(category)) {
    const parts = category.split(/\s[>›/|]\s/).map(strip).filter((c) => c && !isHome(c));
    if (!breadcrumbs.length) breadcrumbs = parts;
    category = parts[parts.length - 1] || '';
  }
  if (breadcrumbs.length) category = breadcrumbs[breadcrumbs.length - 1];

  const availability = take('availability');
  const canonical = absUrl($('link[rel="canonical"]')?.getAttribute('href'));
  const here = new URL(loc.href);
  here.hash = '';
  const url = canonical && new URL(canonical).hostname === loc.hostname && !variantId ? canonical : here.href;

  return {
    url,
    site: loc.hostname.replace(/^www\./, ''),
    platform: platform.platform || '',
    name,
    price,
    currency,
    sku: take('sku'),
    ean: take('ean'),
    brand: take('brand'),
    category,
    breadcrumbs,
    availability,
    availability_text: found.rules.availability_text || platform.availability_text || found.dom.availability_text || '',
    description: take('description', ORDER_TEXT).slice(0, MAX_DESCRIPTION),
    images: images.slice(0, MAX_IMAGES),
    sources,
  };
}
