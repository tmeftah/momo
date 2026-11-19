/**
 * CSS selectors for shops where automatic detection gets a field wrong.
 * They take priority over everything else, field by field; leave out what already works.
 *
 * Key: the shop's domain (without "www."); it also matches its subdomains.
 *   name, price, sku, ean, brand, availability, description: first matching element
 *   images: every matching <img> (the largest version is used: data-zoom-image, srcset…)
 *   category: one element, or several breadcrumb links (the last one becomes the category)
 *
 * After editing, reload the extension on chrome://extensions.
 */
export const SITE_RULES = {
  // 'pieces-velo-exemple.fr': {
  //   name: 'h1.product-name',
  //   price: '.product-price .amount',
  //   sku: '.product-sku span',
  //   ean: '.product-ean span',
  //   brand: '.product-brand a',
  //   availability: '.stock-status',
  //   description: '#product-description',
  //   images: '.product-gallery img',
  //   category: '.breadcrumb a',
  // },
};
