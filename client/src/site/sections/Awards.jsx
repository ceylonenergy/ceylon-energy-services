import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Lightbox from '../Lightbox.jsx';
import { refreshScroll, revealOnScroll } from '../motion.js';
import { assetUrl } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';

const label = (a) => (a.year ? `${a.title} · ${a.year}` : a.title);

export default function Awards() {
  const { data, loading } = useApi('/api/awards');
  const [broken, setBroken] = useState(() => new Set());
  const [index, setIndex] = useState(null);
  const gridRef = useRef(null);

  // An award whose image fails to load is hidden rather than shown as a broken icon.
  const awards = useMemo(() => (data?.awards || []).filter((a) => !broken.has(a.id)), [data, broken]);

  useEffect(() => {
    if (!gridRef.current) return undefined;
    const cleanup = revealOnScroll(gridRef.current.children, {
      from: { opacity: 0, y: 24 },
      duration: 0.6,
      start: 'top 95%',
      delay: (i) => (i % 4) * 0.06,
    });
    refreshScroll(); // the page just got taller
    return cleanup;
  }, [awards]);

  const images = useMemo(
    () => awards.map((a) => ({ src: assetUrl(a.image.large), alt: a.title, caption: label(a) })),
    [awards]
  );
  const close = useCallback(() => setIndex(null), []);

  return (
    <section id="awards" className="wrap-panel pad">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow center">Recognition</p>
          <h2 className="section-title reveal">Awards</h2>
          <p className="lede reveal">A few of the awards and certifications we've picked up along the way.</p>
        </div>
        <div className="cp-grid" id="awardsGrid" ref={gridRef}>
          {awards.map((a, i) => (
            <div className="cp-item reveal" key={a.id}>
              <button type="button" className="cp-item-media" aria-label={`View ${label(a)}`} onClick={() => setIndex(i)}>
                <img
                  src={assetUrl(a.image.card)}
                  alt={a.title}
                  loading="lazy"
                  onError={() => setBroken((b) => new Set(b).add(a.id))}
                />
              </button>
              <span className="cp-item-label">{label(a)}</span>
            </div>
          ))}
        </div>
        {!loading && awards.length === 0 && <p className="lede center">No awards added yet.</p>}
      </div>
      <Lightbox id="awardLightbox" images={images} index={index} onChange={setIndex} onClose={close} />
    </section>
  );
}
