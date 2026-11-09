'use client';
import Link from 'next/link';
import { useNotifications, timeAgo } from './useNotifications';

export default function NotificationsList({ userId }: { userId: string }) {
  const { items, unread, loading, error, live, markRead, markAllRead, loadMore, limit } = useNotifications(userId, 25);
  return (
    <div className="card border-0 shadow-sm rounded-3">
      <div className="card-header bg-white d-flex flex-wrap gap-2 justify-content-between align-items-center py-3">
        <span>
          <strong>{unread}</strong> unread
          <span className={`badge ms-2 ${live ? 'bg-success' : 'bg-secondary'}`}>{live ? 'Live' : 'Checking every 20 s'}</span>
        </span>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={markAllRead} disabled={!unread}>
          Mark all as read
        </button>
      </div>
      <ul className="list-group list-group-flush">
        {loading && <li className="list-group-item text-muted">Loading…</li>}
        {!loading && error && <li className="list-group-item text-danger">{error}</li>}
        {!loading && !error && items.length === 0 && <li className="list-group-item text-muted py-4 text-center">No notifications yet.</li>}
        {items.map((n) => (
          <li key={n.id} className="list-group-item py-3" style={{ background: n.read_at ? undefined : 'rgba(13,125,114,0.06)' }}>
            <div className="d-flex justify-content-between gap-3">
              <div>
                <div className={n.read_at ? '' : 'fw-semibold'}>{n.title}</div>
                <div className="text-muted small">{n.body}</div>
                {n.link && <Link href={n.link} className="small" onClick={() => markRead(n.id)}>Open</Link>}
              </div>
              <div className="text-end flex-shrink-0">
                <small className="text-muted d-block">{timeAgo(n.created_at)}</small>
                {!n.read_at && (
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => markRead(n.id)}>Mark read</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {items.length >= limit && (
        <div className="card-footer bg-white text-center">
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={loadMore}>Load more</button>
        </div>
      )}
    </div>
  );
}
