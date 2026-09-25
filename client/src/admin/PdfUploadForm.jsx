import { useEffect, useMemo, useRef, useState } from 'react';
import { ProgressBar, formatBytes } from './ui.jsx';
import { MAX_PAGES, pdfToPageImages } from './lib/pdfPages.js';
import { upload } from '../lib/api.js';

const MAX_PDF_BYTES = 60 * 1024 * 1024;

/**
 * Choose a PDF; its pages are rendered to images in the browser for the
 * website's flip-through viewer. Pages can be dragged into a different
 * order or removed. If a PDF cannot be rendered (scanned, encrypted,
 * damaged), page images can be chosen by hand instead.
 */
export default function PdfUploadForm({ endpoint, method = 'POST', withTitle = false, submitLabel, onUploaded, run }) {
  const [pdf, setPdf] = useState(null);
  const [pages, setPages] = useState([]);
  const [status, setStatus] = useState({ text: '', error: false });
  const [converting, setConverting] = useState(false);
  const [manual, setManual] = useState(false);
  const [progress, setProgress] = useState(null);
  const dragFrom = useRef(null);
  const formRef = useRef(null);

  const previews = useMemo(() => pages.map((f) => URL.createObjectURL(f)), [pages]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function reset() {
    formRef.current?.reset();
    setPdf(null);
    setPages([]);
    setStatus({ text: '', error: false });
    setManual(false);
  }

  async function choosePdf(e) {
    const file = e.target.files[0];
    setPages([]);
    setPdf(file || null);
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      setStatus({ text: `That PDF is ${formatBytes(file.size)}; the limit is 60 MB.`, error: true });
      setPdf(null);
      e.target.value = '';
      return;
    }
    if (manual) return;

    setConverting(true);
    setStatus({ text: 'Reading PDF…', error: false });
    try {
      const images = await pdfToPageImages(file, {
        onProgress: (done, total) => setStatus({ text: `Generating page ${Math.min(done + 1, total)} of ${total}…`, error: false }),
      });
      setPages(images);
      setStatus({ text: `${images.length} page image${images.length === 1 ? '' : 's'} generated from the PDF.`, error: false });
    } catch (err) {
      setManual(true);
      setStatus({ text: `${err.message || 'This PDF could not be read in the browser.'} Choose the page images (JPG) yourself below.`, error: true });
    } finally {
      setConverting(false);
    }
  }

  function chooseImages(e) {
    const files = [...e.target.files].slice(0, MAX_PAGES);
    setPages(files);
    setStatus({ text: files.length ? `${files.length} page image${files.length === 1 ? '' : 's'} ready.` : '', error: false });
  }

  function movePage(from, to) {
    if (from === to || to < 0 || to >= pages.length) return;
    setPages((list) => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    if (converting) {
      setStatus({ text: 'Still generating page images — please wait a moment.', error: true });
      return;
    }
    if (!pdf || !pages.length) {
      setStatus({ text: 'Choose a PDF first (and wait for its pages to appear).', error: true });
      return;
    }
    const form = new FormData();
    if (withTitle) form.append('title', formRef.current.elements.title.value);
    form.append('pdf', pdf);
    pages.forEach((p, i) => form.append('pages', p, `page-${String(i + 1).padStart(2, '0')}.jpg`));

    const res = await run(async () => {
      setProgress(0);
      try {
        return await upload(endpoint, form, { method, onProgress: setProgress });
      } finally {
        setProgress(null);
      }
    }, 'Saved — it is on the website now.');
    if (res) {
      reset();
      onUploaded(res.document);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit}>
      {withTitle && (
        <label>
          Title (optional — the file name is used otherwise)
          <input type="text" name="title" maxLength={120} placeholder="e.g. ISO Certification, Product Brochure" />
        </label>
      )}
      <label className="file-field">
        <span>PDF file</span>
        <input type="file" accept="application/pdf" required onChange={choosePdf} />
      </label>

      {manual && (
        <label className="file-field">
          <span>Page images (JPG, one per page, in order)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} />
        </label>
      )}

      {status.text && <p className={`fine-print${status.error ? ' is-error' : ''}`}>{status.text}</p>}
      {!manual && !pdf && (
        <button type="button" className="link-inline link-button" onClick={() => setManual(true)}>
          Upload page images manually instead
        </button>
      )}

      {pages.length > 1 && <p className="fine-print">Drag pages to reorder — this is the order they appear in on the website.</p>}
      {pages.length > 0 && (
        <div className="page-thumbs">
          {pages.map((file, i) => (
            <div
              key={previews[i]}
              className="page-thumb"
              draggable
              onDragStart={() => {
                dragFrom.current = i;
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                movePage(dragFrom.current, i);
                dragFrom.current = null;
              }}
            >
              <img src={previews[i]} alt={`Page ${i + 1}`} />
              <span className="page-thumb-num">{i + 1}</span>
              <button type="button" className="page-thumb-remove" aria-label={`Remove page ${i + 1}`} onClick={() => setPages((l) => l.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <ProgressBar value={progress} label="Uploading" />
      <button className="btn" type="submit" disabled={converting || progress !== null}>
        {progress !== null ? 'Uploading…' : submitLabel}
      </button>
    </form>
  );
}
