import { useCallback, useEffect, useState } from 'react';
import Layout from '../Layout.jsx';
import { ConfirmButton, Notice, formatDate, useNotice } from '../ui.jsx';
import { api } from '../../lib/api.js';

const FILTERS = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'new', label: 'Unread' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

/** Contact-form enquiries. Every message sent from the website lands here, emailed or not. */
export default function Messages() {
  const [filter, setFilter] = useState('inbox');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const { notice, setNotice, run, clear } = useNotice();

  const load = useCallback(
    () =>
      api(`/api/admin/messages?status=${filter}&page=${page}`)
        .then((d) => {
          setData(d);
          window.dispatchEvent(new CustomEvent('ce:unread', { detail: d.counts.new }));
        })
        .catch((err) => setNotice({ type: 'error', text: err.message })),
    [filter, page, setNotice]
  );
  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (msg, status, text) => {
    if (await run(() => api(`/api/admin/messages/${msg.id}`, { method: 'PATCH', body: { status } }), text)) load();
  };

  async function toggle(msg) {
    const opening = openId !== msg.id;
    setOpenId(opening ? msg.id : null);
    // Opening an unread message marks it read, like any mail app.
    if (opening && msg.status === 'new') {
      await api(`/api/admin/messages/${msg.id}`, { method: 'PATCH', body: { status: 'read' } }).catch(() => {});
      load();
    }
  }

  const counts = data?.counts || { new: 0, read: 0, archived: 0 };
  const countFor = { inbox: counts.new + counts.read, new: counts.new, archived: counts.archived, all: counts.new + counts.read + counts.archived };

  return (
    <Layout heading="Messages">
      <Notice notice={notice} onDismiss={clear} />

      <div className="filter-tabs" role="tablist" aria-label="Filter messages">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`filter-tab${filter === f.key ? ' is-active' : ''}`}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
              setOpenId(null);
            }}
          >
            {f.label} <span className="count">{countFor[f.key]}</span>
          </button>
        ))}
      </div>

      <section className="admin-card">
        {!data && <p className="muted">Loading…</p>}
        {data?.messages.length === 0 && (
          <p className="muted">{filter === 'inbox' ? 'No messages yet. Enquiries from the website contact form will appear here.' : 'Nothing here.'}</p>
        )}

        <ul className="message-list">
          {data?.messages.map((m) => (
            <li key={m.id} className={`message${m.status === 'new' ? ' is-new' : ''}${openId === m.id ? ' is-open' : ''}`}>
              <button type="button" className="message-head" aria-expanded={openId === m.id} onClick={() => toggle(m)}>
                <span className="message-from">
                  {m.status === 'new' && <span className="dot dot-new" aria-label="Unread" />}
                  {m.name}
                </span>
                <span className="message-subject">{m.subject || m.message.slice(0, 80)}</span>
                <span className="message-date">{formatDate(m.createdAt, { time: true })}</span>
              </button>

              {openId === m.id && (
                <div className="message-body">
                  <dl className="status-grid">
                    <dt>From</dt>
                    <dd>
                      {m.name} &lt;<a href={`mailto:${m.email}`}>{m.email}</a>&gt;
                    </dd>
                    {m.phone && (
                      <>
                        <dt>Phone</dt>
                        <dd>
                          <a href={`tel:${m.phone.replace(/\s+/g, '')}`}>{m.phone}</a>
                        </dd>
                      </>
                    )}
                    {m.subject && (
                      <>
                        <dt>Subject</dt>
                        <dd>{m.subject}</dd>
                      </>
                    )}
                    <dt>Email copy</dt>
                    <dd>
                      {m.delivery.status === 'sent' && 'Sent to the team inbox'}
                      {m.delivery.status === 'skipped' && 'Not emailed (email is not configured)'}
                      {m.delivery.status === 'failed' && <span className="is-error">Email failed: {m.delivery.error}</span>}
                      {m.delivery.status === 'pending' && 'Pending'}
                    </dd>
                  </dl>
                  <p className="message-text">{m.message}</p>
                  <div className="toolbar">
                    <a
                      className="btn btn-sm"
                      href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your enquiry to Ceylon Energy Services'}`)}`}
                    >
                      Reply by email
                    </a>
                    {m.status !== 'new' && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'new', 'Marked as unread.')}>
                        Mark unread
                      </button>
                    )}
                    {m.status !== 'archived' ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'archived', 'Archived.')}>
                        Archive
                      </button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(m, 'read', 'Moved back to the inbox.')}>
                        Move to inbox
                      </button>
                    )}
                    <ConfirmButton
                      message={`Delete the message from ${m.name} permanently?`}
                      onConfirm={async () => {
                        if (await run(() => api(`/api/admin/messages/${m.id}`, { method: 'DELETE' }), 'Message deleted.')) load();
                      }}
                    >
                      Delete
                    </ConfirmButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>

        {data && data.pages > 1 && (
          <div className="pager">
            <button type="button" className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              ← Newer
            </button>
            <span className="fine-print">
              Page {data.page} of {data.pages}
            </span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>
              Older →
            </button>
          </div>
        )}
      </section>
    </Layout>
  );
}
