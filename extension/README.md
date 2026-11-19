# VAE Manager – Import produit (Chrome extension)

Adds the product shown on a supplier's webshop to the VAE Manager stock.

`extractor.js`, `site-rules.js` and `import-helpers.js` are also used by the app's phone import screen (`client/src/views/ProductImport.vue`), so a change here applies to both. The Docker build copies them for the client build.

## Install

1. In VAE Manager: **Plus › Réglages › Import de produits › Télécharger l'extension**, then unzip the file. (Working from the repository, you can also use this `extension/` folder directly.)
2. In Chrome: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the unzipped folder. Pin the extension to the toolbar.
3. In Réglages, **Connecter l'extension** creates the key (shown only once; generate a new one if you lose it). Click the extension icon, paste the key, then **Enregistrer et tester**. The server address is already filled in when the extension was downloaded from Réglages: the server adds it as `defaults.json` in the ZIP.

After changing any file here, click the reload arrow on the extension's card in `chrome://extensions`.

## Use

On a product page: click the icon → **Extraire le produit** → check the form → **Ajouter au stock**.

- **Photos**: all photos found are shown; tap to select or unselect. The first selected one becomes the item's main photo. The extension downloads them with your browser (so it works on shops that block servers) and the server compresses them like any other photo.
- **Prix**: choose whether the shop price is your purchase price (buying from a supplier, the default) or your sale price. The choice and the supplier are remembered per shop.
- **Déjà dans le stock ?**: items with the same product link, EAN or reference are listed. An item with the same link or EAN is selected for update by default. An update refreshes the price, the shop's availability and the link, and fills only the fields that are still empty. It never changes the name or the quantity.
- If the popup closes, the form is kept until the browser is closed. Reopen the extension on the same page to continue.

## How extraction works

`extractor.js` runs inside the page and merges several sources, field by field, from most to least reliable:

| Source | What it reads |
|---|---|
| Site rules | your CSS selectors in `site-rules.js` |
| Shop software | Shopify (`/products/<handle>.js`), PrestaShop (`data-product`), WooCommerce (gallery, `.product_meta`), Magento (gallery JSON, `data-price-amount`) |
| JSON-LD | schema.org `Product` / `ProductGroup` (variants), `Offer`, `BreadcrumbList` |
| Microdata | `itemtype="schema.org/Product"` |
| Open Graph | `og:image`, `product:price:amount`, `product:availability`… |
| Page | title, visible price (crossed-out prices skipped), gallery images (`data-zoom-image`, `srcset`…), breadcrumbs, "Réf. :", "EAN :", "Marque :" labels |

Related-product blocks, headers, footers and menus are ignored. Prices such as `1 299,90 €`, `1,299.00` and `12,500 DT` are understood. EANs read from page text must have a valid check digit.

The footer of the form says which sources were used.

## A shop is read badly

Add selectors for that shop in `site-rules.js`; they take priority over everything else, one field at a time:

```js
export const SITE_RULES = {
  'pieces-velo-exemple.fr': {
    price: '.product-price .amount',
    images: '.product-gallery img',
    ean: '.product-ean span',
  },
};
```

Then reload the extension.

## Permissions

- **Read all sites** (`<all_urls>`): to read the product page you are on, download its photos, and reach your VAE Manager server.
- **scripting**, **activeTab**: to run the extractor in the current tab when you click **Extraire le produit**. Nothing runs on pages until you click.
- **storage**: server address, key, and per-shop choices, stored locally in Chrome.

The key only gives access to `/api/import/*` (add or update items and their photos, list categories and suppliers). Revoke it in **Réglages › Import de produits**.
