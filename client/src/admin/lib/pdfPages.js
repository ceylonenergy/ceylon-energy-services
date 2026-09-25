/**
 * Turn every page of a PDF into a JPG, in the browser, with pdf.js —
 * the same approach the PHP panel's admin.js used, so the server needs
 * no PDF tools. The images feed the website's flip-through viewer.
 *
 * pdf.js is imported on first use, so nobody downloads it until they
 * actually pick a PDF.
 */
const MAX_RENDER_EDGE = 2000; // keeps each JPG well under the 10MB per-page limit
const JPEG_QUALITY = 0.82;
export const MAX_PAGES = 200; // mirrors the server's limit

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    // The "legacy" build: the standard one relies on JavaScript features
    // only the very newest browsers have (e.g. Map#getOrInsertComputed),
    // and the admin must work in whatever browser the office uses.
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Render all pages. `onProgress(done, total)` is called as pages finish.
 * Resolves to an array of File objects (page-01.jpg, page-02.jpg, ...).
 */
export async function pdfToPageImages(file, { onProgress } = {}) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({
    data,
    wasmUrl: '/pdfjs/wasm/',
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    cMapUrl: '/pdfjs/cmaps/',
    iccUrl: '/pdfjs/iccs/',
  });
  const pdf = await task.promise;

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new Error(`That PDF has ${pdf.numPages} pages; the limit is ${MAX_PAGES}. Add page images manually instead.`);
    }

    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress?.(n - 1, pdf.numPages);
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.max(0.1, Math.min(MAX_RENDER_EDGE / Math.max(base.width, base.height), 2));
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      // JPEG has no transparency: a white background keeps transparent areas from turning black.
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;
      page.cleanup();

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
      if (!blob) throw new Error(`Could not convert page ${n}.`);
      pages.push(new File([blob], `page-${pad(n)}.jpg`, { type: 'image/jpeg' }));
      canvas.width = canvas.height = 0; // free the pixels right away on long documents
    }
    onProgress?.(pdf.numPages, pdf.numPages);
    return pages;
  } finally {
    // pdf.js 6 releases the document (and its worker) through the loading task.
    await task.destroy();
  }
}
