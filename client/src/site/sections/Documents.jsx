import { useCallback, useEffect, useRef, useState } from 'react';
import PageViewer from './PageViewer.jsx';
import { refreshScroll, revealOnScroll } from '../motion.js';
import { assetUrl } from '../../lib/api.js';
import { useApi } from '../../lib/useApi.js';

const pages = (n) => `${n} page${n === 1 ? '' : 's'}`;

/** The Company Profile, plus any additional documents added in the admin panel. */
export default function Documents() {
  const { data, loading } = useApi('/api/documents');
  const [openDoc, setOpenDoc] = useState(null);
  const gridRef = useRef(null);

  const profile = data?.profile;
  const attachments = data?.attachments || [];

  useEffect(() => {
    if (!gridRef.current) return undefined;
    const cleanup = revealOnScroll(gridRef.current.children, { from: { opacity: 0, y: 24 }, duration: 0.6, start: 'top 95%' });
    refreshScroll();
    return cleanup;
  }, [data]);

  const close = useCallback(() => setOpenDoc(null), []);
  const openOnKey = (doc) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenDoc(doc);
    }
  };

  return (
    <section id="company-profile" className="wrap-panel pad">
      <div className="container">
        <div className="section-head center">
          <p className="eyebrow center">Read Us Cover to Cover</p>
          <h2 className="section-title reveal">Attachments</h2>
          <p className="lede reveal">
            Flip through our full company profile below, or download any page — or the entire document — for your own records.
          </p>
        </div>

        {profile && profile.pageCount > 0 && (
          <div className="cp-launch">
            <div
              className="cp-launch-thumb"
              role="button"
              tabIndex={0}
              aria-label="Open company profile page viewer"
              onClick={() => setOpenDoc(profile)}
              onKeyDown={openOnKey(profile)}
            >
              <img src={assetUrl(profile.cover.card)} loading="lazy" alt="Ceylon Energy company profile cover" />
              <span className="cp-launch-badge">
                <i className="budicon-document" /> <span>{pages(profile.pageCount)}</span>
              </span>
              <span className="cp-launch-cta">Click to browse the full profile</span>
            </div>
            <div>
              <div className="cp-launch-actions">
                <button className="btn" onClick={() => setOpenDoc(profile)}>
                  <span>
                    <i className="budicon-document" /> View Company Profile
                  </span>
                </button>
                <a href={assetUrl(profile.pdf.download)} className="btn btn-ghost">
                  <span>
                    <i className="budicon-cloud-download" /> Download Full PDF
                  </span>
                </a>
              </div>
            </div>
          </div>
        )}

        {!loading && !profile && !attachments.length && (
          <p className="lede center">Our company profile will be available here shortly.</p>
        )}

        {attachments.length > 0 && (
          <div className="cp-toolbar">
            <p className="lede" style={{ margin: 0 }}>
              More documents
            </p>
          </div>
        )}
        <div className="cp-grid" id="cpAttachmentsGrid" ref={gridRef}>
          {attachments.map((doc) => (
            <div className="cp-item" key={doc.id}>
              <div
                className="cp-item-media"
                role="button"
                tabIndex={0}
                aria-label={`Open ${doc.title}`}
                onClick={() => setOpenDoc(doc)}
                onKeyDown={openOnKey(doc)}
              >
                <img src={assetUrl(doc.cover?.card)} loading="lazy" alt={`${doc.title} cover`} />
                <a
                  className="cp-dl-btn"
                  href={assetUrl(doc.pdf.download)}
                  aria-label={`Download ${doc.title} PDF`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <i className="budicon-cloud-download" />
                </a>
              </div>
              <span className="cp-item-label">
                {doc.title} · {pages(doc.pageCount)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <PageViewer doc={openDoc} onClose={close} />
    </section>
  );
}
