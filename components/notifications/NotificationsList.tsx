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
    case 'session_started':
      return {
        icon: 'bi-door-open-fill',
        color: '#0D7D72',
        bg: '#ccfbf1',
        badgeText: 'Session Started',
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
      {/* Top Controls Header Bar */}
      <div
        className="card-header bg-white px-4 py-3.5 border-bottom d-flex flex-wrap gap-3 justify-content-between align-items-center"
        style={{ borderColor: '#f1f5f9' }}
      >
        <div className="d-flex align-items-center gap-2.5">
          <span className="fw-bold text-dark" style={{ fontSize: '15px' }}>
            {unread > 0 ? (
              <span className="badge rounded-pill bg-danger px-3 py-1.5" style={{ fontSize: '13px' }}>
                {unread} Unread
              </span>
            ) : (
              <span className="badge rounded-pill bg-light text-secondary border px-3 py-1.5" style={{ fontSize: '13px' }}>
                All Caught Up
              </span>
            )}
          </span>
          <span
            className={`badge rounded-pill px-3 py-1.5 d-inline-flex align-items-center ${live ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-secondary-subtle text-secondary'}`}
            style={{ fontSize: '12.5px', letterSpacing: '0.2px' }}
          >
            <i className={`bi ${live ? 'bi-broadcast' : 'bi-clock'} me-1.5 fs-6`} />
            {live ? 'Real-time Live Sync' : 'Polling Sync'}
          </span>
        </div>

        <div className="d-flex align-items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              className="btn btn-outline-secondary d-flex align-items-center gap-1.5 fw-semibold px-3 py-1.5"
              style={{ fontSize: '13.5px', borderRadius: '10px' }}
              onClick={markAllRead}
            >
              <i className="bi bi-check2-all fs-6" />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div
        className="d-flex px-4 pt-3 pb-2.5 border-bottom gap-2.5"
        style={{ backgroundColor: '#fafbfc', borderColor: '#f1f5f9' }}
      >
        <button
          type="button"
          className={`btn px-4 py-2 rounded-pill transition-all ${tab === 'all' ? 'fw-bold text-white shadow-sm' : 'text-muted fw-semibold'}`}
          style={{
            fontSize: '14px',
            backgroundColor: tab === 'all' ? '#0D7D72' : 'transparent',
            border: 'none',
          }}
          onClick={() => setTab('all')}
        >
          All Notifications ({items.length})
        </button>
        <button
          type="button"
          className={`btn px-4 py-2 rounded-pill transition-all ${tab === 'unread' ? 'fw-bold text-white shadow-sm' : 'text-muted fw-semibold'}`}
          style={{
            fontSize: '14px',
            backgroundColor: tab === 'unread' ? '#0D7D72' : 'transparent',
            border: 'none',
          }}
          onClick={() => setTab('unread')}
        >
          Unread Only {unread > 0 && (
            <span
              className="badge rounded-pill ms-2"
              style={{
                fontSize: '11px',
                backgroundColor: tab === 'unread' ? 'rgba(255,255,255,0.28)' : '#dc2626',
                color: '#ffffff',
                padding: '3px 8px',
              }}
            >
              {unread}
            </span>
          )}
        </button>
      </div>

      {/* List of Notification Bars */}
      <div className="list-group list-group-flush p-3 p-md-4 gap-3">
        {loading && (
          <div className="py-5 text-center text-muted">
            <div className="spinner-border spinner-border-sm mb-2" role="status" style={{ color: '#0D7D72', width: 26, height: 26 }} />
            <div style={{ fontSize: '15px' }}>Loading notifications…</div>
          </div>
        )}

        {!loading && error && (
          <div className="py-4 px-4 text-center text-danger">
            <i className="bi bi-exclamation-triangle-fill me-2 fs-5" />
            <span style={{ fontSize: '14px' }}>{error}</span>
          </div>
        )}

        {!loading && !error && displayedItems.length === 0 && (
          <div className="py-5 px-4 text-center">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
              style={{ width: 64, height: 64, backgroundColor: '#f0fdf4', color: '#10b981' }}
            >
              <i className="bi bi-check2-circle fs-1" />
            </div>
            <h5 className="fw-bold text-dark mb-1" style={{ fontSize: '18px' }}>
              {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h5>
            <p className="text-muted m-0" style={{ fontSize: '14px' }}>
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
              className="list-group-item p-4 rounded-3 border d-flex align-items-start gap-3.5 position-relative shadow-xs"
              style={{
                backgroundColor: isUnread ? '#f0fdf9' : '#ffffff',
                borderColor: isUnread ? '#a7f3d0' : '#e2e8f0',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Left Color Accent Bar */}
              <span
                className="position-absolute rounded-start-3"
                style={{
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: '6px',
                  backgroundColor: isUnread ? '#0D7D72' : '#cbd5e1',
                }}
              />

              {/* Large Category Icon Circle */}
              <div
                className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                style={{
                  width: 50,
                  height: 50,
                  backgroundColor: meta.bg,
                  color: meta.color,
                }}
              >
                <i className={`bi ${meta.icon}`} style={{ fontSize: '22px' }} />
              </div>

              {/* Text & Content Area */}
              <div className="flex-grow-1 min-w-0 ps-1">
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-1.5">
                  <div className="d-flex align-items-center gap-2.5 flex-wrap">
                    <span
                      style={{
                        fontSize: '17px',
                        fontWeight: isUnread ? 700 : 600,
                        color: isUnread ? '#0f172a' : '#334155',
                        letterSpacing: '-0.2px',
                      }}
                    >
                      {n.title}
                    </span>
                    <span
                      className="badge rounded-pill"
                      style={{
                        fontSize: '12px',
                        padding: '4px 11px',
                        backgroundColor: meta.bg,
                        color: meta.color,
                        fontWeight: 600,
                      }}
                    >
                      {meta.badgeText}
                    </span>
                  </div>
                  <small className="text-muted text-nowrap d-flex align-items-center" style={{ fontSize: '13px' }}>
                    <i className="bi bi-clock me-1.5" />
                    {timeAgo(n.created_at)}
                  </small>
                </div>

                <p
                  className="m-0 mb-3"
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.6,
                    color: isUnread ? '#1e293b' : '#64748b',
                  }}
                >
                  {n.body}
                </p>

                <div className="d-flex align-items-center gap-3">
                  {n.link && (
                    <Link
                      href={n.link}
                      className="btn btn-sm d-inline-flex align-items-center gap-1.5 fw-semibold px-3 py-1.5"
                      style={{
                        fontSize: '13.5px',
                        color: '#0D7D72',
                        backgroundColor: '#e6f7f5',
                        border: '1px solid #99f6e4',
                        borderRadius: '8px',
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
                      className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 px-3 py-1.5"
                      style={{ fontSize: '13px', borderRadius: '8px' }}
                      onClick={() => markRead(n.id)}
                    >
                      <i className="bi bi-check2" />
                      <span>Mark as read</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {items.length >= limit && (
        <div className="card-footer bg-white text-center py-4 border-top" style={{ borderColor: '#f1f5f9' }}>
          <button
            type="button"
            className="btn btn-sm px-4 py-2.5 fw-semibold"
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0D7D72',
              borderRadius: '10px',
              fontSize: '14px',
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
