'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useNotifications, timeAgo, type AppNotification } from './useNotifications';

interface NotificationMeta {
  icon: string;
  color: string;
  bg: string;
  badgeText: string;
}

function getNotificationMeta(type: string): NotificationMeta {
  switch (type) {
    case 'suggestion':
    case 'queue_suggestion':
      return {
        icon: 'bi-lightbulb-fill',
        color: '#d97706',
        bg: '#fef3c7',
        badgeText: 'Queue Suggestion',
      };
    case 'doctor_cancellation':
      return {
        icon: 'bi-calendar-x-fill',
        color: '#dc2626',
        bg: '#fee2e2',
        badgeText: 'Cancelled',
      };
    case 'called':
      return {
        icon: 'bi-megaphone-fill',
        color: '#059669',
        bg: '#d1fae5',
        badgeText: 'Chamber Call',
      };
    case 'next':
    case 'near_turn':
      return {
        icon: 'bi-hourglass-split',
        color: '#2563eb',
        bg: '#dbeafe',
        badgeText: 'Queue Turn',
      };
    case 'doctor_delay':
      return {
        icon: 'bi-clock-history',
        color: '#b45309',
        bg: '#fef3c7',
        badgeText: 'Doctor Delay',
      };
    case 'session_paused':
      return {
        icon: 'bi-pause-circle-fill',
        color: '#b45309',
        bg: '#fef3c7',
        badgeText: 'Doctor Break',
      };
    case 'session_resumed':
      return {
        icon: 'bi-play-circle-fill',
        color: '#059669',
        bg: '#d1fae5',
        badgeText: 'Queue Resumed',
      };
    case 'no_show':
      return {
        icon: 'bi-person-x-fill',
        color: '#dc2626',
        bg: '#fee2e2',
        badgeText: 'Marked Absent',
      };
    case 'checked_in':
      return {
        icon: 'bi-check-circle-fill',
        color: '#0D7D72',
        bg: '#ccfbf1',
        badgeText: 'Checked In',
      };
    case 'eta_changed':
      return {
        icon: 'bi-clock-history',
        color: '#4f46e5',
        bg: '#e0e7ff',
        badgeText: 'Time Update',
      };
    default:
      return {
        icon: 'bi-bell-fill',
        color: '#0D7D72',
        bg: '#e6f7f5',
        badgeText: 'Update',
      };
  }
}

export default function NotificationsList({ userId }: { userId: string }) {
  const { items, unread, loading, error, live, markRead, markAllRead, loadMore, limit } = useNotifications(userId, 25);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const displayedItems = useMemo(() => {
    if (tab === 'unread') {
      return items.filter((x) => !x.read_at);
    }
    return items;
  }, [items, tab]);

  return (
    <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div className="card-header bg-white px-4 py-3 border-bottom d-flex flex-wrap gap-3 justify-content-between align-items-center" style={{ borderColor: '#f1f5f9' }}>
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-dark">
            {unread > 0 ? (
              <span className="badge rounded-pill bg-danger me-2" style={{ fontSize: '12px' }}>
                {unread} Unread
              </span>
            ) : (
              <span className="badge rounded-pill bg-light text-secondary border me-2" style={{ fontSize: '12px' }}>
                All Read
              </span>
            )}
          </span>
          <span
            className={`badge rounded-pill px-2.5 py-1 ${live ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary'}`}
            style={{ fontSize: '11px', letterSpacing: '0.2px' }}
          >
            <i className={`bi ${live ? 'bi-broadcast' : 'bi-clock'} me-1`} />
            {live ? 'Real-time Live' : 'Polling Sync'}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
              style={{ fontSize: '12px', borderRadius: '8px' }}
              onClick={markAllRead}
            >
              <i className="bi bi-check2-all" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex px-4 pt-3 pb-2 border-bottom gap-2" style={{ backgroundColor: '#fafbfc', borderColor: '#f1f5f9' }}>
        <button
          type="button"
          className={`btn btn-sm px-3.5 py-1.5 rounded-pill transition-all ${tab === 'all' ? 'fw-semibold text-white' : 'text-muted'}`}
          style={{
            fontSize: '13px',
            backgroundColor: tab === 'all' ? '#0D7D72' : 'transparent',
            border: 'none',
          }}
          onClick={() => setTab('all')}
        >
          All Notifications ({items.length})
        </button>
        <button
          type="button"
          className={`btn btn-sm px-3.5 py-1.5 rounded-pill transition-all ${tab === 'unread' ? 'fw-semibold text-white' : 'text-muted'}`}
          style={{
            fontSize: '13px',
            backgroundColor: tab === 'unread' ? '#0D7D72' : 'transparent',
            border: 'none',
          }}
          onClick={() => setTab('unread')}
        >
          Unread Only {unread > 0 && <span className="badge rounded-pill bg-danger ms-1.5" style={{ fontSize: '10px' }}>{unread}</span>}
        </button>
      </div>

      {/* List */}
      <div className="list-group list-group-flush">
        {loading && (
          <div className="py-5 text-center text-muted">
            <div className="spinner-border spinner-border-sm mb-2" role="status" style={{ color: '#0D7D72' }} />
            <div>Loading notifications…</div>
          </div>
        )}

        {!loading && error && (
          <div className="py-4 px-4 text-center text-danger small">
            <i className="bi bi-exclamation-triangle-fill me-1" />
            {error}
          </div>
        )}

        {!loading && !error && displayedItems.length === 0 && (
          <div className="py-5 px-4 text-center">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
              style={{ width: 56, height: 56, backgroundColor: '#f0fdf4', color: '#10b981' }}
            >
              <i className="bi bi-check2-circle fs-2" />
            </div>
            <h6 className="fw-semibold text-dark mt-2 mb-1">
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h6>
            <p className="text-muted small m-0">
              {tab === 'unread' ? 'All clinic and queue updates have been read.' : 'You have no notifications at this time.'}
            </p>
          </div>
        )}

        {displayedItems.map((n) => {
          const meta = getNotificationMeta(n.type);
          const isUnread = !n.read_at;

          return (
            <div
              key={n.id}
              className="list-group-item px-4 py-3.5 border-bottom d-flex align-items-start gap-3 position-relative"
              style={{
                backgroundColor: isUnread ? '#f0fdf9' : '#ffffff',
                borderColor: '#f1f5f9',
                transition: 'background-color 0.15s ease',
              }}
            >
              {isUnread && (
                <span
                  className="position-absolute"
                  style={{
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: '4px',
                    backgroundColor: '#0D7D72',
                  }}
                />
              )}

              {/* Icon */}
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                style={{ width: 40, height: 40, backgroundColor: meta.bg, color: meta.color }}
              >
                <i className={`bi ${meta.icon} fs-5`} />
              </div>

              {/* Text */}
              <div className="flex-grow-1 min-w-0">
                <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-1">
                  <div className="d-flex align-items-center gap-2">
                    <span
                      style={{
                        fontSize: '14.5px',
                        fontWeight: isUnread ? 700 : 500,
                        color: isUnread ? '#0f172a' : '#334155',
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      className="badge rounded-pill"
                      style={{
                        fontSize: '10.5px',
                        padding: '3px 9px',
                        backgroundColor: meta.bg,
                        color: meta.color,
                        fontWeight: 600,
                      }}
                    >
                      {meta.badgeText}
                    </span>
                  </div>
                  <small className="text-muted text-nowrap" style={{ fontSize: '11.5px' }}>
                    <i className="bi bi-clock me-1" />
                    {timeAgo(n.created_at)}
                  </small>
                </div>

                <p
                  className="m-0 text-secondary mb-2"
                  style={{ fontSize: '13px', lineHeight: 1.5, color: isUnread ? '#334155' : '#64748b' }}
                >
                  {n.body}
                </p>

                <div className="d-flex align-items-center gap-3">
                  {n.link && (
                    <Link
                      href={n.link}
                      className="btn btn-sm btn-outline-teal d-inline-flex align-items-center gap-1"
                      style={{
                        fontSize: '12px',
                        padding: '3px 12px',
                        color: '#0D7D72',
                        borderColor: '#0D7D72',
                        borderRadius: '6px',
                        fontWeight: 500,
                      }}
                      onClick={() => {
                        if (isUnread) markRead(n.id);
                      }}
                    >
                      <span>Open Page</span>
                      <i className="bi bi-arrow-right" />
                    </Link>
                  )}

                  {isUnread && (
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-muted small text-decoration-none"
                      style={{ fontSize: '12px' }}
                      onClick={() => markRead(n.id)}
                    >
                      <i className="bi bi-check2 me-1" />
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length >= limit && (
        <div className="card-footer bg-white text-center py-3 border-top" style={{ borderColor: '#f1f5f9' }}>
          <button
            type="button"
            className="btn btn-sm px-4 py-2"
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              color: '#0D7D72',
              fontWeight: 600,
              borderRadius: '8px',
              fontSize: '13px',
            }}
            onClick={loadMore}
          >
            Load more notifications
          </button>
        </div>
      )}
    </div>
  );
}
