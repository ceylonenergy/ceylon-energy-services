import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../../lib/api.js';

/**
 * Full-screen, page-by-page document viewer: arrows, keyboard, swipe,
 * a thumbnail strip, and downloads for one page or the whole PDF.
 */
export default function PageViewer({ doc, onClose }) {
  const [page, setPage] = useState(1);
  const thumbsRef = useRef(null);
  const open = Boolean(doc);
  const total = doc?.pageCount || 0;

  // Start at page 1 each time a document opens, and stop the page behind from scrolling.
  useEffect(() => {
    if (!open) return undefined;
    setPage(1);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, doc]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setPage((p) => Math.min(total, p + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, total, onClose]);

  // Keep the current page's thumbnail in view.
  useEffect(() => {
    thumbsRef.current?.children[page - 1]?.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [page]);

  const touchX = useRef(null);
  const onTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) setPage((p) => Math.min(total, Math.max(1, p + (dx < 0 ? 1 : -1))));
    touchX.current = null;
  };

  const current = doc?.pages[page - 1];

  return (
    <div
      className={`pv-overlay${open ? ' is-open' : ''}`}
      id="pvOverlay"
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={doc ? `${doc.title} viewer` : undefined}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {doc && (
        <>
          <div className="pv-top">
            <div className="pv-title">
              <span>{doc.title}</span>{' '}
              <span className="pv-count">
                Page {page} / {total}
              </span>
            </div>
            <div className="pv-actions">
              <a href={assetUrl(doc.pdf.download)} className="pv-btn pv-btn-ghost">
                <i className="budicon-cloud-download" /> Full PDF
              </a>
              <button className="pv-close" aria-label="Close viewer" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          <div className="pv-stage">
            <button className="pv-nav prev" aria-label="Previous page" disabled={page === 1} onClick={() => setPage(page - 1)}>
              ‹
            </button>
            <div className="pv-image-wrap">
              {current && <img src={assetUrl(current.full)} alt={`${doc.title} — page ${page}`} />}
            </div>
            <button className="pv-nav next" aria-label="Next page" disabled={page === total} onClick={() => setPage(page + 1)}>
              ›
            </button>
          </div>
          <div className="pv-bottom">
            {current && (
              <a href={assetUrl(current.download)} className="pv-btn pv-btn-solid">
                <i className="budicon-download" /> Download This Page
              </a>
            )}
            <div className="pv-thumbs" ref={thumbsRef}>
              {doc.pages.map((p, i) => (
                <button
                  type="button"
                  key={p.full}
                  className={`pv-thumb${i + 1 === page ? ' is-active' : ''}`}
                  aria-label={`Go to page ${i + 1}`}
                  onClick={() => setPage(i + 1)}
                >
                  <img src={assetUrl(p.thumb)} loading="lazy" alt={`Page ${i + 1} thumbnail`} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
