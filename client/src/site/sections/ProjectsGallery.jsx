import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Lightbox from '../Lightbox.jsx';
import { revealOnScroll, refreshScroll } from '../motion.js';
import { assetUrl } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';

const PLACEHOLDER = '/assets/images/dummy.png';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Swap a broken image for the placeholder, once. */
function fallback(e) {
  if (e.currentTarget.dataset.fallback) return;
  e.currentTarget.dataset.fallback = '1';
  e.currentTarget.src = PLACEHOLDER;
}

/**
 * "Our Projects": locations -> projects -> photos, loaded from
 * /api/projects (MongoDB + Cloudinary). Adding a project in the admin
 * panel is all it takes to show it here.
 */
export default function ProjectsGallery() {
  const { data, error, loading } = useApi('/api/projects');
  const locations = useMemo(() => data?.locations || [], [data]);

  const [locIndex, setLocIndex] = useState(null);
  const [projIndex, setProjIndex] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const gridRef = useRef(null);
  const sectionRef = useRef(null);

  const loc = locIndex !== null ? locations[locIndex] : null;
  const proj = loc && projIndex !== null ? loc.projects[projIndex] : null;
  const view = proj ? 'photos' : loc ? 'projects' : 'albums';

  // Fade the cards in whenever the level changes.
  useEffect(() => {
    if (!gridRef.current) return undefined;
    const cleanup = revealOnScroll(gridRef.current.children, {
      from: { opacity: 0, scale: 0.94 },
      duration: 0.55,
      ease: 'power2.out',
      start: 'top 95%',
      delay: (i) => (i % 4) * 0.05,
    });
    refreshScroll();
    return cleanup;
  }, [view, locIndex, projIndex, locations]);

  const goTo = (nextLoc, nextProj = null) => {
    setLocIndex(nextLoc);
    setProjIndex(nextProj);
    // Keep the section in view when a deep gallery collapses to a short one.
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0;
    if (top < -80) sectionRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const lightboxImages = useMemo(
    () =>
      (proj?.photos || []).map((photo, i) => ({
        src: assetUrl(photo.large) || PLACEHOLDER,
        alt: photo.caption || `${loc.name} ${proj.name} photo ${i + 1}`,
      })),
    [proj, loc]
  );
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  let body;
  if (loading) {
    body = <p className="lede center">Loading projects…</p>;
  } else if (error || !locations.length) {
    body = <p className="lede center">Our project gallery is being updated — please check back shortly.</p>;
  } else if (view === 'albums') {
    body = (
      <div className="album-grid" ref={gridRef}>
        {locations.map((l, i) => (
          <button type="button" className="album-card reveal" key={l.id} onClick={() => goTo(i)}>
            <img src={assetUrl(l.cover?.thumb) || PLACEHOLDER} alt={`${l.name} — completed solar projects`} loading="lazy" onError={fallback} />
            <div className="album-label">
              <h4>{l.name}</h4>
              <span>
                {plural(l.projectCount, 'project')} · {plural(l.photoCount, 'photo')}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  } else if (view === 'projects') {
    body = (
      <div className="album-grid" ref={gridRef}>
        {loc.projects.map((p, i) => (
          <button type="button" className="album-card reveal" key={p.id} onClick={() => goTo(locIndex, i)}>
            <img src={assetUrl(p.cover?.thumb) || PLACEHOLDER} alt={`${loc.name} ${p.name}`} loading="lazy" onError={fallback} />
            <div className="album-label">
              <h4>{p.name}</h4>
              <span>{plural(p.photoCount, 'photo')}</span>
            </div>
          </button>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="proj-grid" ref={gridRef}>
        {proj.photos.map((photo, i) => (
          <button type="button" className="proj-item reveal" key={photo.id} onClick={() => setLightboxIndex(i)}>
            <img
              src={assetUrl(photo.medium) || PLACEHOLDER}
              alt={lightboxImages[i]?.alt}
              width={photo.width || undefined}
              height={photo.height || undefined}
              loading="lazy"
              onError={fallback}
            />
            <span className="plus" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <section id="our-projects" className="wrap-panel pad" ref={sectionRef}>
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow center">Field Work</p>
          <h2 className="section-title reveal">Our Projects</h2>
          <p className="lede reveal">Browse by site — pick a location, then a project, to see the photos.</p>
        </div>
      </div>
      <div className="container">
        <nav className="gallery-crumbs" aria-label="Gallery breadcrumb">
          {locations.length > 0 && (
            <>
              <button type="button" onClick={() => goTo(null)}>
                All Locations
              </button>
              {loc && (
                <>
                  {' '}
                  <span className="sep">/</span>{' '}
                  {proj ? (
                    <>
                      <button type="button" onClick={() => goTo(locIndex)}>
                        {loc.name}
                      </button>{' '}
                      <span className="sep">/</span> <span className="current">{proj.name}</span>
                    </>
                  ) : (
                    <span className="current">{loc.name}</span>
                  )}
                </>
              )}
            </>
          )}
        </nav>
        {body}
      </div>

      <Lightbox id="lightbox" images={lightboxImages} index={lightboxIndex} onChange={setLightboxIndex} onClose={closeLightbox} />
    </section>
  );
}
