/**
 * pdf.js loads a few runtime files on demand (WebAssembly image
 * decoders, the 14 standard PDF fonts, character maps). They are
 * published inside the pdfjs-dist package; this serves them at /pdfjs/
 * in development and copies them into the build.
 *
 * Only the admin panel's document upload uses pdf.js, so visitors never
 * download any of this.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));
const DIRS = ['wasm', 'standard_fonts', 'cmaps', 'iccs'];

export default function pdfjsAssets() {
  let outDir = 'dist';
  return {
    name: 'ceylon-pdfjs-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/pdfjs', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
        const [dir] = rel.split('/');
        const file = path.join(PDFJS_ROOT, rel);
        if (!DIRS.includes(dir) || !file.startsWith(PDFJS_ROOT) || !fs.existsSync(file)) return next();
        if (file.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      for (const dir of DIRS) {
        const from = path.join(PDFJS_ROOT, dir);
        if (fs.existsSync(from)) fs.cpSync(from, path.join(outDir, 'pdfjs', dir), { recursive: true });
      }
    },
  };
}
