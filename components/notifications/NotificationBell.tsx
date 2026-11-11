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

/**
 * Modern Notification Bell & Dropdown Bar (Large Sizing)
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
      {/* The Bell Trigger Button (Large 46x46) */}
      <button
        type="button"
        className={`dss-bell-btn d-flex align-items-center justify-content-center position-relative ${open ? 'is-open' : ''}`}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <i
          className={`bi ${unread > 0 ? 'bi-bell-fill' : 'bi-bell'}`}
          style={{ fontSize: '21px', transition: 'transform 0.2s ease' }}
          aria-hidden="true"
        />

        {unread > 0 && (
          <span
            className="position-absolute d-flex align-items-center justify-content-center text-white fw-bold dss-badge-pulse"
            style={{
              top: -3,
              right: -3,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              fontSize: '11px',
              lineHeight: 1,
              borderRadius: '999px',
              backgroundColor: '#dc2626',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.45)',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Large Dropdown Panel (The Notification Bar) */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="dss-notification-panel card border-0 position-absolute end-0 shadow-lg"
          style={{
            top: 'calc(100% + 12px)',
            width: 'min(500px, calc(100vw - 24px))',
            zIndex: 1060,
            borderRadius: '18px',
            backgroundColor: '#ffffff',
            boxShadow: '0 24px 50px -10px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            transformOrigin: 'top right',
            animation: 'dssDropdownFade 0.2s ease-out forwards',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            className="px-4 py-3.5 border-bottom d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#ffffff', borderColor: '#f1f5f9' }}
          >
            <div className="d-flex align-items-center gap-2.5">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 38, height: 38, backgroundColor: '#e6f7f5', color: '#0D7D72' }}
              >
                <i className="bi bi-bell-fill fs-5" />
              </div>
              <div>
                <h6 className="m-0 fw-bold text-dark" style={{ fontSize: '16.5px' }}>
                  Notifications
                </h6>
                <span className="text-muted" style={{ fontSize: '12px' }}>
                  {unread > 0 ? `${unread} unread update${unread > 1 ? 's' : ''}` : 'All caught up'}
                </span>
              </div>
            </div>

            {unread > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none fw-semibold p-1"
                style={{ color: '#0D7D72', fontSize: '13px' }}
                onClick={markAllRead}
              >
                <i className="bi bi-check2-all me-1 fs-6" />
                Mark all read
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div
            className="d-flex px-4 pt-2.5 pb-2.5 border-bottom gap-2.5"
            style={{ backgroundColor: '#fbfcfd', borderColor: '#f1f5f9' }}
          >
            <button
              type="button"
              className={`btn px-3.5 py-1.5 rounded-pill transition-all ${tab === 'all' ? 'fw-bold text-white shadow-xs' : 'text-muted fw-semibold'}`}
              style={{
                fontSize: '13px',
                backgroundColor: tab === 'all' ? '#0D7D72' : 'transparent',
                border: 'none',
              }}
              onClick={() => setTab('all')}
            >
              All ({items.length})
            </button>
            <button
              type="button"
              className={`btn px-3.5 py-1.5 rounded-pill transition-all ${tab === 'unread' ? 'fw-bold text-white shadow-xs' : 'text-muted fw-semibold'}`}
              style={{
                fontSize: '13px',
                backgroundColor: tab === 'unread' ? '#0D7D72' : 'transparent',
                border: 'none',
              }}
              onClick={() => setTab('unread')}
            >
              Unread {unread > 0 && (
                <span
                  className="badge rounded-pill ms-1.5"
                  style={{
                    fontSize: '11px',
                    backgroundColor: tab === 'unread' ? 'rgba(255,255,255,0.28)' : '#dc2626',
                    color: '#ffffff',
                    padding: '2px 7px',
                  }}
                >
                  {unread}
                </span>
              )}
            </button>
          </div>

          {/* Scrollable Notification Bars List */}
          <div style={{ maxHeight: '460px', overflowY: 'auto' }}>
            {loading && (
              <div className="py-5 text-center text-muted small">
                <div
                  className="spinner-border spinner-border-sm mb-2"
                  role="status"
                  style={{ color: '#0D7D72', width: 24, height: 24 }}
                />
                <div style={{ fontSize: '14px' }}>Loading updates…</div>
              </div>
            )}

            {!loading && error && (
              <div className="p-4 text-center text-danger small">
                <i className="bi bi-exclamation-triangle-fill me-1 fs-6" />
                <span style={{ fontSize: '13px' }}>{error}</span>
              </div>
            )}

            {!loading && !error && displayedItems.length === 0 && (
              <div className="py-5 px-4 text-center">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-2"
                  style={{ width: 54, height: 54, backgroundColor: '#f0fdf4', color: '#10b981' }}
                >
                  <i className="bi bi-check2-circle fs-2" />
                </div>
                <div className="fw-bold text-dark" style={{ fontSize: '15px' }}>
                  {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </div>
                <p className="text-muted m-0 mt-1" style={{ fontSize: '13px' }}>
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
                  className="px-4 py-3.5 border-bottom d-flex align-items-start gap-3 position-relative dss-notif-item"
                  style={{
                    backgroundColor: isUnread ? '#f0fdf9' : '#ffffff',
                    cursor: 'pointer',
                    borderColor: '#f1f5f9',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Unread Accent Bar */}
                  {isUnread && (
                    <span
                      className="position-absolute"
                      style={{
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: '5px',
                        backgroundColor: '#0D7D72',
                      }}
                    />
                  )}

                  {/* Category Icon Circle */}
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0 mt-0.5"
                    style={{
                      width: 42,
                      height: 42,
                      backgroundColor: meta.bg,
                      color: meta.color,
                    }}
                  >
                    <i className={`bi ${meta.icon}`} style={{ fontSize: '18px' }} />
                  </div>

                  {/* Body Text */}
                  <div className="flex-grow-1 min-w-0">
                    <div className="d-flex align-items-baseline justify-content-between gap-2 mb-1">
                      <span
                        className="text-truncate"
                        style={{
                          fontSize: '15px',
                          fontWeight: isUnread ? 700 : 600,
                          color: isUnread ? '#0f172a' : '#334155',
                        }}
                        title={n.title}
                      >
                        {n.title}
                      </span>
                      <span
                        className="text-muted text-nowrap flex-shrink-0"
                        style={{ fontSize: '12px' }}
                      >
                        {timeAgo(n.created_at)}
                      </span>
                    </div>

                    <p
                      className="m-0 mb-2"
                      style={{
                        fontSize: '13.5px',
                        lineHeight: 1.55,
                        color: isUnread ? '#1e293b' : '#64748b',
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
                          fontSize: '11px',
                          padding: '3px 9px',
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
                          className="btn btn-link p-0 text-muted text-decoration-none dss-mark-read-btn d-inline-flex align-items-center gap-0.5"
                          style={{ fontSize: '12px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            markRead(n.id);
                          }}
                          title="Mark as read"
                        >
                          <i className="bi bi-check fs-6" />
                          <span>Mark read</span>
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
            className="px-4 py-3 border-top d-flex align-items-center justify-content-between"
            style={{ backgroundColor: '#fbfcfd', borderColor: '#f1f5f9' }}
          >
            <Link
              href="/notifications"
              className="w-100 btn d-flex align-items-center justify-content-center gap-2 fw-semibold"
              style={{
                backgroundColor: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#0D7D72',
                borderRadius: '10px',
                fontSize: '14px',
                padding: '9px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
              onClick={() => setOpen(false)}
            >
              <span>See all notifications in center</span>
              <i className="bi bi-arrow-right fs-6" />
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .dss-bell-btn {
          background-color: #ffffff !important;
          border: 1.5px solid #cbd5e1 !important;
          color: #0D7D72 !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }
        .dss-bell-btn i {
          color: #0D7D72 !important;
        }
        .dss-bell-btn:hover {
          background-color: #0D7D72 !important;
          border-color: #0D7D72 !important;
          color: #ffffff !important;
          box-shadow: 0 6px 18px rgba(13, 125, 114, 0.35) !important;
          transform: translateY(-2px) scale(1.04) !important;
        }
        .dss-bell-btn:hover i {
          color: #ffffff !important;
        }
        .dss-bell-btn.is-open {
          background-color: #0D7D72 !important;
          border-color: #0D7D72 !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(13, 125, 114, 0.3) !important;
        }
        .dss-bell-btn.is-open i {
          color: #ffffff !important;
        }
        .dss-bell-btn:active {
          transform: scale(0.95);
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
            box-shadow: 0 0 0 6px rgba(220, 38, 38, 0);
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
