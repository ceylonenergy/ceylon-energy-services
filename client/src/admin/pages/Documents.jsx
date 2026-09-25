import { useCallback, useEffect, useState } from 'react';
import Layout from '../Layout.jsx';
import PdfUploadForm from '../PdfUploadForm.jsx';
import { ConfirmButton, InlineEdit, MoveButtons, Notice, StatusPill, formatBytes, formatDate, reorderedIds, useNotice } from '../ui.jsx';
import { api, assetUrl } from '../../lib/api.js';

export default function Documents() {
  const [data, setData] = useState(null);
  const { notice, setNotice, run, clear } = useNotice();

  // Refreshes quietly, so the success message from the action that
  // triggered it stays on screen.
  const load = useCallback(
    () =>
      api('/api/admin/documents')
        .then(setData)
        .catch((err) => setNotice({ type: 'error', text: err.message })),
    [setNotice]
  );
  useEffect(() => {
    load();
  }, [load]);

  const patch = async (doc, body, msg) => {
    const res = await run(() => api(`/api/admin/documents/${doc.id}`, { method: 'PATCH', body }), msg);
    if (res) await load();
  };

  async function move(from, to) {
    const ids = reorderedIds(data.attachments, from, to);
    const res = await run(() => api('/api/admin/documents/order', { method: 'PUT', body: { ids } }));
    if (res) setData((d) => ({ ...d, attachments: ids.map((id) => d.attachments.find((a) => a.id === id)) }));
  }

  const profile = data?.profile;

  return (
    <Layout heading="Company Profile & Documents">
      <Notice notice={notice} onDismiss={clear} />
      {!data && !notice && <p className="muted">Loading…</p>}

      {data && (
        <>
          <section className="admin-card">
            <h2>Current company profile</h2>
            {profile ? (
              <div className="doc-summary">
                {profile.cover && <img src={assetUrl(profile.cover.thumb)} alt="" className="doc-cover" />}
                <div>
                  <dl className="status-grid">
                    <dt>Pages</dt>
                    <dd>{profile.pageCount}</dd>
                    <dt>PDF size</dt>
                    <dd>{formatBytes(profile.pdf.bytes)}</dd>
                    <dt>Last updated</dt>
                    <dd>{formatDate(profile.updatedAt, { time: true })}</dd>
                  </dl>
                  <a className="link-inline" href={assetUrl(profile.pdf.url)} target="_blank" rel="noopener noreferrer">
                    Open current PDF →
                  </a>
                </div>
              </div>
            ) : (
              <p className="muted">No company profile has been uploaded yet.</p>
            )}
          </section>

          <section className="admin-card">
            <h2>{profile ? 'Replace the company profile' : 'Upload the company profile'}</h2>
            <p className="muted">
              Choose the PDF — the page images for the website's flip-through viewer are generated automatically in your browser.
              {profile && ' The current version is kept under "Previous versions" below, so you can switch back.'}
            </p>
            <PdfUploadForm endpoint="/api/admin/documents/profile" method="PUT" submitLabel="Save & Publish" run={run} onUploaded={load} />
          </section>

          <section className="admin-card">
            <h2>Add another document</h2>
            <p className="muted">
              Adds a new document under "More documents" on the website, next to the company profile. Nothing already published
              changes.
            </p>
            <PdfUploadForm endpoint="/api/admin/documents" withTitle submitLabel="Add Document" run={run} onUploaded={load} />
          </section>

          {data.attachments.length > 0 && (
            <section className="admin-card">
              <h2>More documents ({data.attachments.length})</h2>
              <ul className="attachment-list">
                {data.attachments.map((doc, i) => (
                  <li key={doc.id} className={`attachment-item${doc.published ? '' : ' is-hidden'}`}>
                    <div>
                      <InlineEdit as="strong" value={doc.title} label={doc.title} onSave={(title) => patch(doc, { title }, 'Renamed.')} />
                      <div className="fine-print">
                        {doc.pageCount} page{doc.pageCount === 1 ? '' : 's'} · {formatBytes(doc.pdf.bytes)} · added {formatDate(doc.createdAt)}
                      </div>
                    </div>
                    <div className="attachment-item-actions">
                      <StatusPill on={doc.published} />
                      <MoveButtons index={i} count={data.attachments.length} onMove={move} label={doc.title} />
                      <a className="link-inline" href={assetUrl(doc.pdf.url)} target="_blank" rel="noopener noreferrer">
                        Open PDF
                      </a>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(doc, { published: !doc.published }, doc.published ? 'Hidden from the website.' : 'Visible on the website again.')}>
                        {doc.published ? 'Hide' : 'Show'}
                      </button>
                      <ConfirmButton
                        message={`Delete "${doc.title}"? The PDF and its pages are removed permanently.`}
                        onConfirm={async () => {
                          if (await run(() => api(`/api/admin/documents/${doc.id}`, { method: 'DELETE' }), 'Document deleted.')) load();
                        }}
                      >
                        Delete
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.archived.length > 0 && (
            <section className="admin-card">
              <h2>Previous versions of the company profile</h2>
              <p className="muted">The last {data.archived.length} replaced version(s) are kept here. Restoring one makes it live again and keeps the current one here.</p>
              <ul className="attachment-list">
                {data.archived.map((doc) => (
                  <li key={doc.id} className="attachment-item">
                    <div>
                      <strong>{doc.title}</strong>
                      <div className="fine-print">
                        {doc.pageCount} pages · {formatBytes(doc.pdf.bytes)} · replaced {formatDate(doc.archivedAt, { time: true })}
                      </div>
                    </div>
                    <div className="attachment-item-actions">
                      <a className="link-inline" href={assetUrl(doc.pdf.url)} target="_blank" rel="noopener noreferrer">
                        Open PDF
                      </a>
                      <ConfirmButton
                        className="btn btn-ghost btn-sm"
                        message="Make this version the live company profile again?"
                        onConfirm={async () => {
                          if (await run(() => api(`/api/admin/documents/${doc.id}/restore`, { method: 'POST' }), 'Restored — this version is live again.')) load();
                        }}
                      >
                        Restore
                      </ConfirmButton>
                      <ConfirmButton
                        message="Delete this old version permanently?"
                        onConfirm={async () => {
                          if (await run(() => api(`/api/admin/documents/${doc.id}`, { method: 'DELETE' }), 'Old version deleted.')) load();
                        }}
                      >
                        Delete
                      </ConfirmButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Layout>
  );
}
