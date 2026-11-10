'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

/**
 * Modern Notification Bell & Dropdown Bar
 * Designed with category iconography, unread filters, and smooth micro-interactions.
 */
export default function NotificationBell({ userId }: { userId: string }) {
  const { items, unread, loading, error, markRead, markAllRead } = useNotifications(userId, 10);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n: AppNotification) => {
    if (!n.read_at) {
      await markRead(n.id);
    }
    setOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  const displayedItems = useMemo(() => {
    if (tab === 'unread') {
      return items.filter((x) => !x.read_at);
    }
    return items;
  }, [items, tab]);

  return (
    <div ref={ref} className="position-relative dss-notification-wrapper">
      {/* The Bell Trigger Button */}
      <button
        type="button"
        className="btn dss-bell-btn d-flex align-items-center justify-content-center position-relative p-0"
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 38,
          height: 38,
          borderRadius: '50%',
          backgroundColor: open ? '#e6f4f2' : '#f8fafc',
          border: '1px solid',
          borderColor: open ? '#0D7D72' : '#e2e8f0',
          color: '#0D7D72',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <i
          className={`bi ${unread > 0 ? 'bi-bell-fill' : 'bi-bell'}`}
          style={{ fontSize: '18px', transition: 'transform 0.2s ease' }}
          aria-hidden="true"
        />

        {unread > 0 && (
          <span
            className="position-absolute d-flex align-items-center justify-content-center text-white fw-bold dss-badge-pulse"
            style={{
              top: -3,
              right: -3,
              minWidth: 18,
              height: 18,
              padding: '0 4px',
              fontSize: '10px',
              lineHeight: 1,
              borderRadius: '999px',
              backgroundColor: '#dc2626',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 5px rgba(220, 38, 38, 0.45)',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel ("The Notification Bar") */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="dss-notification-panel card border-0 position-absolute end-0 shadow-lg"
          style={{
            top: 'calc(100% + 10px)',
            width: 'min(400px, calc(100vw - 28px))',
            zIndex: 1060,
            borderRadius: '16px',
            backgroundColor: '#ffffff',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
            transformOrigin: 'top right',
            animation: 'dssDropdownFade 0.2s ease-out forwards',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="px-3 py-3 border-bottom d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9' }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 32, height: 32, backgroundColor: '#e6f7f5', color: '#0D7D72' }}
              >
                <i className="bi bi-bell-fill fs-6" />
              </div>
              <div>
                <h6 className="m-0 fw-bold text-dark" style={{ fontSize: '15px' }}>
                  Notifications
                </h6>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  {unread > 0 ? `${unread} unread update${unread > 1 ? 's' : ''}` : 'All caught up'}
                </span>
              </div>
            </div>

            {unread > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none fw-semibold p-1"
                style={{ color: '#0D7D72', fontSize: '12px' }}
                onClick={markAllRead}
              >
                <i className="bi bi-check2-all me-1" />
                Mark all read
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div
            className="d-flex px-3 pt-2 pb-2 border-bottom gap-2"
            style={{ backgroundColor: '#fbfcfd', borderColor: '#f1f5f9' }}
          >
            <button
              type="button"
              className={`btn btn-sm px-3 py-1 rounded-pill transition-all ${tab === 'all' ? 'fw-semibold text-white' : 'text-muted'}`}
              style={{
                fontSize: '12px',
                backgroundColor: tab === 'all' ? '#0D7D72' : 'transparent',
                border: 'none',
              }}
              onClick={() => setTab('all')}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              className={`btn btn-sm px-3 py-1 rounded-pill transition-all ${tab === 'unread' ? 'fw-semibold text-white' : 'text-muted'}`}
              style={{
                fontSize: '12px',
                backgroundColor: tab === 'unread' ? '#0D7D72' : 'transparent',
                border: 'none',
              }}
              onClick={() => setTab('unread')}
            >
              Unread {unread > 0 && (
                <span
                  className="badge rounded-pill ms-1"
                  style={{
                    fontSize: '10px',
                    backgroundColor: tab === 'unread' ? 'rgba(255,255,255,0.25)' : '#dc2626',
                    color: '#ffffff',
                  }}
                >
                  {unread}
                </span>
              )}
            </button>
          </div>

          {/* Scrollable Notification List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {loading && (
              <div className="py-5 text-center text-muted small">
                <div
                  className="spinner-border spinner-border-sm mb-2"
                  role="status"
                  style={{ color: '#0D7D72', width: 22, height: 22 }}
                />
                <div>Loading updates…</div>
              </div>
            )}

            {!loading && error && (
              <div className="p-3 text-center text-danger small">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {error}
              </div>
            )}

            {!loading && !error && displayedItems.length === 0 && (
              <div className="py-5 px-3 text-center">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                  style={{ width: 48, height: 48, backgroundColor: '#f0fdf4', color: '#10b981' }}
                >
                  <i className="bi bi-check2-circle fs-3" />
                </div>
                <div className="fw-semibold text-dark" style={{ fontSize: '14px' }}>
                  {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </div>
                <p className="text-muted small m-0 mt-1" style={{ fontSize: '12px' }}>
                  {tab === 'unread' ? 'You have reviewed all live updates.' : 'Queue and clinic alerts will appear here.'}
                </p>
              </div>
            )}

            {displayedItems.map((n) => {
              const meta = getNotificationMeta(n.type);
              const isUnread = !n.read_at;

              return (
                <div
                  key={n.id}
                  onClick={() => openItem(n)}
                  className="px-3 py-2.5 border-bottom d-flex align-items-start gap-2.5 position-relative dss-notif-item"
                  style={{
                    backgroundColor: isUnread ? '#f0fdf9' : '#ffffff',
                    cursor: 'pointer',
                    borderColor: '#f1f5f9',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Unread Indicator Bar / Dot */}
                  {isUnread && (
                    <span
                      className="position-absolute rounded-pill"
                      style={{
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: '3.5px',
                        backgroundColor: '#0D7D72',
                      }}
                    />
                  )}

                  {/* Category Icon */}
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-1"
                    style={{
                      width: 34,
                      height: 34,
                      backgroundColor: meta.bg,
                      color: meta.color,
                    }}
                  >
                    <i className={`bi ${meta.icon}`} style={{ fontSize: '14px' }} />
                  </div>

                  {/* Body Text */}
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-baseline justify-content-between gap-2 mb-0.5">
                      <span
                        className="text-truncate"
                        style={{
                          fontSize: '13px',
                          fontWeight: isUnread ? 600 : 500,
                          color: isUnread ? '#0f172a' : '#475569',
                        }}
                        title={n.title}
                      >
                        {n.title}
                      </span>
                      <span
                        className="text-muted text-nowrap flex-shrink-0"
                        style={{ fontSize: '11px' }}
                      >
                        {timeAgo(n.created_at)}
                      </span>
                    </div>

                    <p
                      className="m-0 mb-1.5"
                      style={{
                        fontSize: '12px',
                        lineHeight: 1.45,
                        color: isUnread ? '#334155' : '#64748b',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {n.body}
                    </p>

                    <div className="d-flex align-items-center justify-content-between">
                      <span
                        className="badge rounded-pill"
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          backgroundColor: meta.bg,
                          color: meta.color,
                          fontWeight: 600,
                        }}
                      >
                        {meta.badgeText}
                      </span>

                      {isUnread && (
                        <button
                          type="button"
                          className="btn btn-link p-0 text-muted small text-decoration-none dss-mark-read-btn"
                          style={{ fontSize: '11px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          title="Mark as read"
                        >
                          <i className="bi bi-check me-0.5" />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Bar */}
          <div
            className="px-3 py-2.5 border-top d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#fbfcfd', borderColor: '#f1f5f9' }}
          >
            <Link
              href="/notifications"
              className="w-100 btn btn-sm d-flex align-items-center justify-content-center gap-1.5 fw-semibold"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#0D7D72',
                borderRadius: '8px',
                fontSize: '12px',
                padding: '6px 14px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setOpen(false)}
            >
              <span>See all notifications</span>
              <i className="bi bi-arrow-right" />
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .dss-bell-btn:hover {
          background-color: #e6f4f2 !important;
          border-color: #0D7D72 !important;
          transform: translateY(-1px);
        }
        .dss-bell-btn:active {
          transform: scale(0.96);
        }
        .dss-notif-item:hover {
          background-color: #eef7f6 !important;
        }
        .dss-mark-read-btn:hover {
          color: #0D7D72 !important;
          font-weight: 600;
        }
        @keyframes dssDropdownFade {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes dssPulse {
          0% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.45);
          }
          70% {
            box-shadow: 0 0 0 5px rgba(220, 38, 38, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(220, 38, 38, 0);
          }
        }
        .dss-badge-pulse {
          animation: dssPulse 2s infinite;
        }
      `}</style>
    </div>
  );
}
