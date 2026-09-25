/**
 * Small building blocks shared by the admin pages.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from './auth.jsx';

/** A success/error banner that scrolls itself into view when it appears. */
export function Notice({ notice, onDismiss }) {
  const ref = useRef(null);
  useEffect(() => {
    if (notice) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [notice]);
  if (!notice) return null;
  return (
    <div ref={ref} className={`notice notice-${notice.type === 'error' ? 'error' : 'ok'}`} role={notice.type === 'error' ? 'alert' : 'status'}>
      <span>{notice.text}</span>
      {onDismiss && (
        <button type="button" className="notice-close" aria-label="Dismiss" onClick={onDismiss}>
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * State for a page's notice plus a `run(action, successText)` helper:
 * runs an async action, shows its error or the success text, and sends
 * the user back to the login screen if their session has ended.
 */
export function useNotice() {
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const { sessionEnded } = useAuth();

  const run = useCallback(
    async (action, successText) => {
      setBusy(true);
      setNotice(null);
      try {
        const result = await action();
        if (successText) setNotice({ type: 'ok', text: successText });
        return result;
      } catch (err) {
        if (err.status === 401) sessionEnded();
        setNotice({ type: 'error', text: err.message || 'Something went wrong.' });
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [sessionEnded]
  );

  return { notice, setNotice, clear: () => setNotice(null), run, busy };
}

/** A button that asks "are you sure?" first. */
export function ConfirmButton({ message, onConfirm, children, className = 'btn btn-ghost btn-danger btn-sm', ...rest }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (window.confirm(message)) onConfirm();
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Click the text to rename it; Enter saves, Escape cancels. */
export function InlineEdit({ value, onSave, label, maxLength = 120, as: Tag = 'span', className }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (!editing) {
    return (
      <Tag className={className}>
        {value}{' '}
        <button type="button" className="link-button edit-link" aria-label={`Rename ${label}`} onClick={() => setEditing(true)}>
          Rename
        </button>
      </Tag>
    );
  }

  const save = async () => {
    const next = draft.trim();
    if (next && next !== value) await onSave(next);
    setEditing(false);
  };

  return (
    <form
      className="inline-edit"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        type="text"
        aria-label={`New name for ${label}`}
        value={draft}
        maxLength={maxLength}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
      <button className="btn btn-sm" type="submit">
        Save
      </button>
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
      >
        Cancel
      </button>
    </form>
  );
}

/** ↑ ↓ buttons for reordering a list. */
export function MoveButtons({ index, count, onMove, label }) {
  return (
    <span className="move-buttons">
      <button type="button" className="icon-btn" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        ↑
      </button>
      <button type="button" className="icon-btn" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        ↓
      </button>
    </span>
  );
}

export function ProgressBar({ value, label }) {
  if (value === null || value === undefined) return null;
  const pct = Math.round(value * 100);
  return (
    <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="progress-bar" style={{ width: `${pct}%` }} />
      <span className="progress-text">
        {label} {pct}%
      </span>
    </div>
  );
}

export function StatusPill({ on, onText = 'Visible', offText = 'Hidden' }) {
  return <span className={`pill ${on ? 'pill-ok' : 'pill-muted'}`}>{on ? onText : offText}</span>;
}

/** Move one item in an array and return the ids in the new order. */
export function reorderedIds(items, from, to) {
  const ids = items.map((i) => i.id);
  const [moved] = ids.splice(from, 1);
  ids.splice(to, 0, moved);
  return ids;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  for (const unit of units) {
    value /= 1024;
    if (value < 1024) return `${value.toFixed(value < 10 ? 1 : 0)} ${unit}`;
  }
  return `${value.toFixed(1)} TB`;
}

export function formatDate(value, { time = false } = {}) {
  if (!value) return '';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}
