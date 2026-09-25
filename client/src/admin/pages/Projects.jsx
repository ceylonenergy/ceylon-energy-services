import { useEffect, useState } from 'react';
import Layout from '../Layout.jsx';
import { ConfirmButton, InlineEdit, MoveButtons, Notice, ProgressBar, StatusPill, reorderedIds, useNotice } from '../ui.jsx';
import { IMAGE_ACCEPT, MAX_IMAGE_BYTES, shrinkImage } from '../lib/images.js';
import { api, assetUrl, upload } from '../../lib/api.js';

const BATCH = 20; // the server accepts up to 20 photos per request
const base = (loc, proj) => `/api/admin/gallery/locations/${loc.id}${proj ? `/projects/${proj.id}` : ''}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

export default function Projects() {
  const [locations, setLocations] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const { notice, run, clear, busy } = useNotice();

  useEffect(() => {
    run(async () => setLocations((await api('/api/admin/gallery')).locations));
  }, [run]);

  const replace = (loc) => setLocations((ls) => ls.map((l) => (l.id === loc.id ? loc : l)));
  const toggleOpen = (id, force) =>
    setOpen((s) => {
      const next = new Set(s);
      if (force ?? !next.has(id)) next.add(id);
      else next.delete(id);
      return next;
    });

  async function addLocation(e) {
    e.preventDefault();
    const input = e.currentTarget.elements.name;
    const name = input.value;
    const res = await run(() => api('/api/admin/gallery/locations', { method: 'POST', body: { name } }), `Location "${name.trim()}" added — now add a project to it.`);
    if (res) {
      setLocations((ls) => [...ls, res.location]);
      toggleOpen(res.location.id, true);
      input.value = '';
    }
  }

  async function moveLocation(from, to) {
    const ids = reorderedIds(locations, from, to);
    const res = await run(() => api('/api/admin/gallery/locations/order', { method: 'PUT', body: { ids } }));
    if (res) setLocations((ls) => ids.map((id) => ls.find((l) => l.id === id)));
  }

  return (
    <Layout heading="Project Gallery">
      <Notice notice={notice} onDismiss={clear} />

      <section className="admin-card">
        <h2>Add a location</h2>
        <p className="muted">
          Locations group projects on the website (e.g. "Colombo", "Kaluthara") and are the first level of the gallery. A location
          appears on the site once one of its projects has a photo.
        </p>
        <form className="inline-form no-rule" onSubmit={addLocation}>
          <label>
            Location name <input type="text" name="name" maxLength={80} required />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            Add Location
          </button>
        </form>
      </section>

      {locations === null && !notice && <p className="muted">Loading the gallery…</p>}
      {locations?.length === 0 && <p className="muted">No locations yet — add one above to get started.</p>}

      {locations?.map((loc, i) => (
        <LocationCard
          key={loc.id}
          loc={loc}
          index={i}
          count={locations.length}
          isOpen={open.has(loc.id)}
          onToggle={() => toggleOpen(loc.id)}
          onMove={moveLocation}
          onChange={replace}
          onRemoved={() => setLocations((ls) => ls.filter((l) => l.id !== loc.id))}
          run={run}
        />
      ))}
    </Layout>
  );
}

function LocationCard({ loc, index, count, isOpen, onToggle, onMove, onChange, onRemoved, run }) {
  const patch = async (body, msg) => {
    const res = await run(() => api(base(loc), { method: 'PATCH', body }), msg);
    if (res) onChange(res.location);
  };

  async function addProject(e) {
    e.preventDefault();
    const input = e.currentTarget.elements.name;
    const name = input.value;
    const res = await run(() => api(`${base(loc)}/projects`, { method: 'POST', body: { name } }), `Project "${name.trim()}" added — upload its photos below.`);
    if (res) {
      onChange(res.location);
      input.value = '';
    }
  }

  async function moveProject(from, to) {
    const ids = reorderedIds(loc.projects, from, to);
    const res = await run(() => api(`${base(loc)}/projects/order`, { method: 'PUT', body: { ids } }));
    if (res) onChange(res.location);
  }

  return (
    <section className={`admin-card location-card${loc.published ? '' : ' is-hidden'}`}>
      <div className="admin-card-head">
        <button type="button" className="disclosure" aria-expanded={isOpen} onClick={onToggle}>
          <span className="disclosure-arrow" aria-hidden="true">
            {isOpen ? '▾' : '▸'}
          </span>
          <span className="location-name">{loc.name}</span>
          <span className="fine-print">
            {plural(loc.projectCount, 'project')} · {plural(loc.photoCount, 'photo')}
          </span>
        </button>
        <div className="card-actions">
          <StatusPill on={loc.published} />
          <MoveButtons index={index} count={count} onMove={onMove} label={loc.name} />
        </div>
      </div>

      {isOpen && (
        <div className="location-body">
          <div className="toolbar">
            <InlineEdit value={loc.name} label={loc.name} maxLength={80} onSave={(name) => patch({ name }, 'Location renamed.')} />
            <span className="toolbar-spacer" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ published: !loc.published }, loc.published ? 'Location hidden from the website.' : 'Location is visible on the website again.')}>
              {loc.published ? 'Hide from website' : 'Show on website'}
            </button>
            <ConfirmButton
              message={`Remove "${loc.name}" and all ${loc.photoCount} of its photos? The photos are deleted permanently.`}
              onConfirm={async () => {
                const res = await run(() => api(base(loc), { method: 'DELETE' }), `"${loc.name}" removed.`);
                if (res) onRemoved();
              }}
            >
              Remove location
            </ConfirmButton>
          </div>

          <form className="inline-form" onSubmit={addProject}>
            <label>
              New project name <input type="text" name="name" maxLength={120} required />
            </label>
            <button className="btn btn-ghost" type="submit">
              Add Project
            </button>
          </form>

          {loc.projects.length === 0 && <p className="muted fine-print">No projects in this location yet.</p>}
          {loc.projects.map((proj, i) => (
            <ProjectBlock key={proj.id} loc={loc} proj={proj} index={i} count={loc.projects.length} onMove={moveProject} onChange={onChange} run={run} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectBlock({ loc, proj, index, count, onMove, onChange, run }) {
  const [progress, setProgress] = useState(null);
  const url = base(loc, proj);
  const photoCount = proj.photos.length;

  const patch = async (body, msg) => {
    const res = await run(() => api(url, { method: 'PATCH', body }), msg);
    if (res) onChange(res.location);
  };

  async function uploadPhotos(e) {
    const input = e.currentTarget;
    const chosen = [...input.files];
    input.value = '';
    if (!chosen.length) return;

    await run(async () => {
      setProgress(0);
      try {
        const files = [];
        for (const file of chosen) {
          const small = await shrinkImage(file);
          if (small.size > MAX_IMAGE_BYTES) throw new Error(`"${file.name}" is still larger than 10MB. Please use a smaller photo.`);
          files.push(small);
        }
        const batches = Math.ceil(files.length / BATCH);
        for (let b = 0; b < batches; b++) {
          const form = new FormData();
          files.slice(b * BATCH, (b + 1) * BATCH).forEach((f) => form.append('photos', f));
          const res = await upload(`${url}/photos`, form, { onProgress: (p) => setProgress((b + p) / batches) });
          onChange(res.location);
        }
      } finally {
        setProgress(null);
      }
    }, `${plural(chosen.length, 'photo')} uploaded — ${chosen.length === 1 ? 'it is' : 'they are'} on the website now.`);
  }

  async function photoAction(photo, action) {
    if (action === 'caption') {
      const caption = window.prompt('Caption (used as the photo description for search engines and screen readers):', photo.caption);
      if (caption === null) return;
      const res = await run(() => api(`${url}/photos/${photo.id}`, { method: 'PATCH', body: { caption } }), 'Caption saved.');
      if (res) onChange(res.location);
    }
    if (action === 'delete') {
      if (!window.confirm('Delete this photo? It is removed from the website and from storage, and cannot be undone.')) return;
      const res = await run(() => api(`${url}/photos/${photo.id}`, { method: 'DELETE' }), 'Photo removed.');
      if (res) onChange(res.location);
    }
  }

  async function movePhoto(from, to) {
    const ids = reorderedIds(proj.photos, from, to);
    const res = await run(() => api(`${url}/photos/order`, { method: 'PUT', body: { ids } }));
    if (res) onChange(res.location);
  }

  return (
    <div className={`project-block${proj.published ? '' : ' is-hidden'}`}>
      <div className="admin-card-head">
        <InlineEdit as="h3" value={proj.name} label={proj.name} onSave={(name) => patch({ name }, 'Project renamed.')} />
        <div className="card-actions">
          <span className="fine-print">{plural(photoCount, 'photo')}</span>
          <StatusPill on={proj.published} />
          <MoveButtons index={index} count={count} onMove={onMove} label={proj.name} />
        </div>
      </div>

      {photoCount > 0 && (
        <div className="thumb-grid">
          {proj.photos.map((photo, i) => (
            <figure className="thumb-item" key={photo.id}>
              <img src={assetUrl(photo.thumb)} loading="lazy" alt={photo.caption || `Photo ${i + 1}`} />
              <button type="button" className="thumb-remove" aria-label="Delete photo" onClick={() => photoAction(photo, 'delete')}>
                ✕
              </button>
              <figcaption className="thumb-tools">
                <button type="button" className="icon-btn" aria-label="Move photo earlier" disabled={i === 0} onClick={() => movePhoto(i, i - 1)}>
                  ←
                </button>
                <button type="button" className="icon-btn caption-btn" title={photo.caption || 'Add a caption'} onClick={() => photoAction(photo, 'caption')}>
                  {photo.caption ? 'Caption ✓' : 'Caption'}
                </button>
                <button type="button" className="icon-btn" aria-label="Move photo later" disabled={i === photoCount - 1} onClick={() => movePhoto(i, i + 1)}>
                  →
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {photoCount > 0 && <p className="fine-print">The first photo is the project's cover on the website.</p>}

      <ProgressBar value={progress} label="Uploading" />

      <div className="toolbar">
        <label className="btn btn-ghost btn-sm file-button">
          Upload photos
          <input type="file" accept={IMAGE_ACCEPT} multiple onChange={uploadPhotos} disabled={progress !== null} />
        </label>
        <span className="fine-print">JPG, PNG or WebP · large photos are resized automatically</span>
        <span className="toolbar-spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch({ published: !proj.published }, proj.published ? 'Project hidden from the website.' : 'Project is visible again.')}>
          {proj.published ? 'Hide' : 'Show'}
        </button>
        <ConfirmButton
          message={`Remove the project "${proj.name}" and its ${plural(photoCount, 'photo')}? This cannot be undone.`}
          onConfirm={async () => {
            const res = await run(() => api(url, { method: 'DELETE' }), `Project "${proj.name}" removed.`);
            if (res) onChange(res.location);
          }}
        >
          Remove project
        </ConfirmButton>
      </div>
    </div>
  );
}
