'use client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LiveTable {
  table: string;
  filter?: string;
}

/**
 * Subscribes to Postgres changes with the user's own token (so RLS applies to what is delivered), and keeps a
 * fallback poll running whenever the channel is not connected. Returns a cleanup function.
 */
export function subscribeLive(
  supabase: SupabaseClient,
  name: string,
  tables: LiveTable[],
  onChange: () => void,
  opts: { fallbackMs: number; onStatus?: (live: boolean) => void }
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let channel: ReturnType<SupabaseClient['channel']> | null = null;
  const startPolling = () => { timer ??= setInterval(onChange, opts.fallbackMs); };
  const stopPolling = () => { if (timer) clearInterval(timer); timer = null; };
  startPolling();

  void (async () => {
    // Without this the channel can join with the anon key before the session loads, and RLS hides every event.
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;
    if (data.session) supabase.realtime.setAuth(data.session.access_token);
    channel = supabase.channel(`${name}:${Math.random().toString(36).slice(2)}`);
    for (const t of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: t.table, ...(t.filter ? { filter: t.filter } : {}) }, () => onChange());
    }
    channel.subscribe((status) => {
      const ok = status === 'SUBSCRIBED';
      opts.onStatus?.(ok);
      if (ok) stopPolling(); else startPolling();
    });
  })();

  return () => {
    cancelled = true;
    stopPolling();
    if (channel) void supabase.removeChannel(channel);
  };
}
