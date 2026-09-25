import { useEffect, useRef, useState } from 'react';
import Layout from '../Layout.jsx';
import { ConfirmButton, MoveButtons, Notice, ProgressBar, StatusPill, reorderedIds, useNotice } from '../ui.jsx';
import { IMAGE_ACCEPT, shrinkImage } from '../lib/images.js';
import { api, assetUrl, upload } from '../../lib/api.js';

export default function Awards() {
  const [awards, setAwards] = useState(null);
  const [progress, setProgress] = useState(null);
  const [editing, setEditing] = useState(null);
  const { notice, run, clear, busy } = useNotice();
  const formRef = useRef(null);

  useEffect(() => {
    run(async () => setAwards((await api('/api/admin/awards')).awards));
  }, [run]);

  const replace = (award) => setAwards((list) => list.map((a) => (a.id === award.id ? award : a)));

  async function add(e) {
    e.preventDefault();
    const formEl = formRef.current;
    const data = new FormData(formEl);
    const file = data.get('image');
    if (!file || !file.size) return;
    data.set('image', await shrinkImage(file));

    const res = await run(async () => {
      setProgress(0);
      try {
        return await upload('/api/admin/awards', data, { onProgress: setProgress });
      } finally {
        setProgress(null);
      }
    }, 'Award added — it shows first in the Awards section of the website.');
    if (res) {
      setAwards((list) => [res.award, ...list]);
      formEl.reset();
    }
  }

  async function move(from, to) {
    const ids = reorderedIds(awards, from, to);
    const res = await run(() => api('/api/admin/awards/order', { method: 'PUT', body: { ids } }));
    if (res) setAwards((list) => ids.map((id) => list.find((a) => a.id === id)));
  }

  async function saveEdit(e, award) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const file = data.get('image');
    if (file && file.size) data.set('image', await shrinkImage(file));
    else data.delete('image');
    const res = await run(() => upload(`/api/admin/awards/${award.id}`, data, { method: 'PATCH' }), 'Award updated.');
    if (res) {
      replace(res.award);
      setEditing(null);
    }
  }

  return (
    <Layout heading="Awards & Recognitions">
      <Notice notice={notice} onDismiss={clear} />

      <section className="admin-card">
        <h2>Add an award</h2>
        <p className="muted">Upload a photo of the award, certificate or trophy. New awards appear first in the "Awards" section of the website.</p>
        <form ref={formRef} onSubmit={add}>
          <label>
            Title <input type="text" name="title" maxLength={120} placeholder="e.g. Best Solar Installer" required />
          </label>
          <label>
            Year (optional) <input type="text" name="year" maxLength={4} placeholder="2025" inputMode="numeric" pattern="[0-9]{4}" />
          </label>
          <label className="file-field">
            <span>Award image (JPG, PNG or WebP)</span>
            <input type="file" name="image" accept={IMAGE_ACCEPT} required />
          </label>
          <ProgressBar value={progress} label="Uploading" />
          <button className="btn" type="submit" disabled={busy}>
            Add Award
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Current awards {awards && `(${awards.length})`}</h2>
        {awards === null && <p className="muted">Loading…</p>}
        {awards?.length === 0 && <p className="muted">No awards yet — add one above and it will show here and on the website.</p>}

        <ul className="award-list">
          {awards?.map((a, i) => (
            <li key={a.id} className={`award-row${a.published ? '' : ' is-hidden'}`}>
              <img src={assetUrl(a.image.card)} alt={a.title} loading="lazy" />
              {editing === a.id ? (
                <form className="award-edit" onSubmit={(e) => saveEdit(e, a)}>
                  <label>
                    Title <input type="text" name="title" defaultValue={a.title} maxLength={120} required />
                  </label>
                  <label>
                    Year <input type="text" name="year" defaultValue={a.year || ''} maxLength={4} pattern="[0-9]{4}" inputMode="numeric" />
                  </label>
                  <label className="file-field">
                    <span>Replace image (optional)</span>
                    <input type="file" name="image" accept={IMAGE_ACCEPT} />
                  </label>
                  <div className="toolbar">
                    <button className="btn btn-sm" type="submit" disabled={busy}>
                      Save
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="award-info">
                  <strong>{a.title}</strong>
                  {a.year && <span className="fine-print">{a.year}</span>}
                  <div className="toolbar">
                    <StatusPill on={a.published} />
                    <MoveButtons index={i} count={awards.length} onMove={move} label={a.title} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(a.id)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        const res = await run(
                          () => api(`/api/admin/awards/${a.id}`, { method: 'PATCH', body: { published: !a.published } }),
                          a.published ? 'Award hidden from the website.' : 'Award is visible again.'
                        );
                        if (res) replace(res.award);
                      }}
                    >
                      {a.published ? 'Hide' : 'Show'}
                    </button>
                    <ConfirmButton
                      message={`Remove "${a.title}" from the website? Its image is deleted.`}
                      onConfirm={async () => {
                        const res = await run(() => api(`/api/admin/awards/${a.id}`, { method: 'DELETE' }), 'Award removed.');
                        if (res) setAwards((list) => list.filter((x) => x.id !== a.id));
                      }}
                    >
                      Remove
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </Layout>
  );
}
