'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications, timeAgo, type AppNotification } from './useNotifications';

/** Header bell for every logged-in role: unread count, latest items, mark read, link to the full page. */
export default function NotificationBell({ userId }: { userId: string }) {
  const { items, unread, loading, error, markRead, markAllRead } = useNotifications(userId, 8);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const openItem = async (n: AppNotification) => {
    await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  return (
    <div ref={ref} className="position-relative dss-bell">
      <button
        type="button"
        className="btn btn-link p-1 position-relative text-dark"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 22, lineHeight: 1 }}
      >
        <i className={`bi ${unread ? 'bi-bell-fill' : 'bi-bell'}`} aria-hidden="true" />
        {unread > 0 && (
          <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: 11 }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="card shadow border-0 position-absolute end-0 mt-2"
          style={{ width: 'min(360px, calc(100vw - 32px))', zIndex: 1050 }}
        >
          <div className="card-header bg-white d-flex justify-content-between align-items-center py-2">
            <strong>Notifications</strong>
            <button type="button" className="btn btn-sm btn-link text-decoration-none" disabled={!unread} onClick={markAllRead}>
              Mark all read
            </button>
          </div>
          <ul className="list-group list-group-flush" style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading && <li className="list-group-item text-muted small">Loading…</li>}
            {!loading && error && <li className="list-group-item text-danger small">{error}</li>}
            {!loading && !error && items.length === 0 && <li className="list-group-item text-muted small">No notifications yet.</li>}
            {items.map((n) => (
              <li key={n.id} className="list-group-item list-group-item-action p-0">
                <button type="button" onClick={() => openItem(n)} className="text-start w-100 px-3 py-2 border-0 rounded-0"
                  style={{ background: n.read_at ? '#fff' : '#eef7f6', color: '#212529', display: 'block' }}>
                  <div className="d-flex justify-content-between gap-2">
                    <span className={n.read_at ? 'fw-normal' : 'fw-semibold'}>{n.title}</span>
                    <small className="text-muted text-nowrap">{timeAgo(n.created_at)}</small>
                  </div>
                  <div className="small text-muted">{n.body}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="card-footer bg-white text-center py-2">
            <Link href="/notifications" className="small text-decoration-none" onClick={() => setOpen(false)}>See all notifications</Link>
          </div>
        </div>
      )}
    </div>
  );
}
