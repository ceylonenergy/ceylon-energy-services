import { useEffect } from 'react';

/**
 * Full-screen photo viewer used by the gallery and the awards.
 * Arrow keys step, Escape closes, a click on the backdrop closes.
 *
 * `images` is [{ src, alt, caption? }]; `index` null means closed.
 */
export default function Lightbox({ images, index, onChange, onClose, id }) {
  const open = index !== null && images.length > 0;
  const current = open ? images[index] : null;

  useEffect(() => {
    if (!open) return undefined;
    const step = (dir) => onChange((index + dir + images.length) % images.length);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, images.length, onChange, onClose]);

  const step = (dir) => onChange((index + dir + images.length) % images.length);

  return (
    <div
      className={`lightbox${open ? ' is-open' : ''}`}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-hidden={!open}
      aria-label={current?.alt || 'Photo viewer'}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <button className="lightbox-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      {images.length > 1 && (
        <button className="lightbox-nav prev" aria-label="Previous" onClick={() => step(-1)}>
          ‹
        </button>
      )}
      {current && <img src={current.src} alt={current.alt} />}
      {images.length > 1 && (
        <button className="lightbox-nav next" aria-label="Next" onClick={() => step(1)}>
          ›
        </button>
      )}
      {current?.caption && <p className="lightbox-caption">{current.caption}</p>}
    </div>
  );
}
