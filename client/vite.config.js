import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

/**
 * Emits dist/sw.js from sw.template.js with the list of files to precache
 * (app shell, every JS/CSS chunk, latin fonts, icons). Its content changes with
 * every build that changes the app, which is what triggers the update prompt.
 */
function serviceWorker() {
  return {
    name: 'vae-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter(
        (f) => f.startsWith('assets/') && (/\.(js|css)$/.test(f) || /inter-latin(-ext)?-wght/.test(f))
      );
      const files = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-192.png', '/apple-touch-icon.png', ...assets.map((f) => `/${f}`)];
      // Hash the content of the public files too: a redrawn icon keeps its name.
      const hash = createHash('sha256').update(files.join());
      for (const f of files.slice(1, 5)) hash.update(fs.readFileSync(new URL(`./public${f}`, import.meta.url)));
      const version = hash.digest('hex').slice(0, 10);
      const source = fs
        .readFileSync(new URL('./sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(files, null, 1));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [vue(), serviceWorker()],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
