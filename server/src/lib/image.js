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
