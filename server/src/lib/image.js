import sharp from 'sharp';
import { config } from '../config.js';

// Small VPS: one libvips thread per image and no decoded-image cache, so RAM stays flat.
sharp.concurrency(1);
sharp.cache(false);

/**
 * Normalises an uploaded photo: applies EXIF rotation, caps the long edge,
 * strips metadata (GPS, camera…) and re-encodes as WebP.
 * A 12 MP phone photo (4–8 MB) typically ends up around 200–400 KB.
 * Animated GIFs are kept as-is (re-encoding them is rarely worth it).
 * Returns { buffer, ext } or throws if the file is not a readable image.
 */
export async function compressPhoto(input) {
  const img = sharp(input, { failOn: 'error', limitInputPixels: 60_000_000 });
  const meta = await img.metadata();
  if (meta.format === 'gif' && (meta.pages || 1) > 1) return { buffer: input, ext: 'gif' };

  const buffer = await img
    .rotate()
    .resize({ width: config.photoMaxPx, height: config.photoMaxPx, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: config.photoQuality, effort: 4, smartSubsample: true })
    .toBuffer();
  return { buffer, ext: 'webp' };
}

/**
 * Crops a stored photo. rotate is a quarter turn (0/90/180/270) applied first;
 * x, y, w, h are fractions (0–1) of the rotated image, so they don't depend on
 * the size the photo was shown at. EXIF orientation is honoured, as in the browser.
 */
export async function cropPhoto(input, { rotate = 0, x, y, w, h }) {
  const meta = await sharp(input, { autoOrient: true }).metadata();
  if (meta.format === 'gif' && (meta.pages || 1) > 1) throw new Error('animated');
  const turned = rotate % 180 !== 0;
  const W = turned ? meta.autoOrient.height : meta.autoOrient.width;
  const H = turned ? meta.autoOrient.width : meta.autoOrient.height;
  const left = Math.min(Math.round(x * W), W - 1);
  const top = Math.min(Math.round(y * H), H - 1);
  const width = Math.max(1, Math.min(Math.round(w * W), W - left));
  const height = Math.max(1, Math.min(Math.round(h * H), H - top));
  const buffer = await sharp(input, { autoOrient: true, failOn: 'error', limitInputPixels: 60_000_000 })
    .rotate(rotate)
    .extract({ left, top, width, height })
    .resize({ width: config.photoMaxPx, height: config.photoMaxPx, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: config.photoQuality, effort: 4, smartSubsample: true })
    .toBuffer();
  return { buffer, ext: 'webp' };
}
