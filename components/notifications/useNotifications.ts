'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { subscribeLive } from '@/lib/realtime';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const FALLBACK_POLL_MS = 20_000;

/**
 * The signed-in user's notifications (RLS: own rows only). Live through Supabase Realtime;
 * if the channel is not connected, checks every 20 seconds instead.
 */
export function useNotifications(userId: string | null, pageSize = 15) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [limit, setLimit] = useState(pageSize);
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const sb = () => (supabaseRef.current ??= createClient());

  const load = useCallback(async () => {
    if (!userId) return;
    const supabase = sb();
    const [list, count] = await Promise.all([
      supabase.from('notifications').select('id, type, title, body, link, read_at, created_at')
        .order('created_at', { ascending: false }).limit(limit),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    ]);
    if (list.error) setError('Could not load notifications.');
    else {
      setError(null);
      setItems(list.data as AppNotification[]);
      setUnread(count.count ?? 0);
    }
    setLoading(false);
  }, [userId, limit]);

  useEffect(() => {
    if (!userId) return;
    const initial = setTimeout(load, 0);
    const stop = subscribeLive(sb(), `notifications:${userId}`, [{ table: 'notifications', filter: `user_id=eq.${userId}` }],
      () => { void load(); }, { fallbackMs: FALLBACK_POLL_MS, onStatus: setLive });
    return () => {
      clearTimeout(initial);
      stop();
    };
  }, [userId, load]);

  const markRead = useCallback(async (id: string) => {
    setItems((xs) => xs.map((x) => (x.id === id && !x.read_at ? { ...x, read_at: new Date().toISOString() } : x)));
    setUnread((u) => Math.max(0, u - (items.find((x) => x.id === id && !x.read_at) ? 1 : 0)));
    await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null);
  }, [items]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((xs) => xs.map((x) => (x.read_at ? x : { ...x, read_at: now })));
    setUnread(0);
    await sb().from('notifications').update({ read_at: now }).is('read_at', null);
  }, []);

  return { items, unread, loading, error, live, markRead, markAllRead, reload: load, loadMore: () => setLimit((l) => l + pageSize), limit };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(Date.parse(iso));
}
