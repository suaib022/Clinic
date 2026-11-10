'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StaffSnapshot } from '@/lib/queue/server';
import { createClient } from '@/lib/supabase/client';
import { subscribeLive } from '@/lib/realtime';

const FALLBACK_MS = 10_000;   // DSS-68: check every 10 s when live updates are down
const MIN_GAP_MS = 1_500;     // never reload more often than this
const TICK_MS = 30_000;       // estimates depend on the clock, so refresh twice a minute anyway

/** Keeps a doctor's staff snapshot fresh: Realtime on appointments / events / sessions, debounced reloads, fallback poll. */
export function useLiveSnapshot(doctorId: string, initial: StaffSnapshot | null) {
  const [snap, setSnap] = useState<StaffSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  // client time the current snapshot arrived (timers count from here)
  const [lastUpdated, setLastUpdated] = useState<number>(() => (initial ? Date.now() : 0));
  const last = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    last.current = Date.now();
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    try {
      const res = await fetch(`/api/queue/snapshot?doctorId=${doctorId}`, { signal: ctl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'You are not assigned to this doctor.' : 'Could not load the queue.');
      const data = (await res.json()) as StaffSnapshot;
      setSnap(data);
      setError(null);
      setLastUpdated(Date.now());
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    }
  }, [doctorId]);

  /** Debounced reload for bursts of live events. */
  const schedule = useCallback(() => {
    if (pending.current) return;
    const wait = Math.max(300, MIN_GAP_MS - (Date.now() - last.current));
    pending.current = setTimeout(() => { pending.current = null; void load(); }, wait);
  }, [load]);

  useEffect(() => {
    const first = initial ? null : setTimeout(load, 0);
    const tick = setInterval(schedule, TICK_MS);
    const stop = subscribeLive(createClient(), `queue:${doctorId}`, [
      { table: 'appointments', filter: `doctor_id=eq.${doctorId}` },
      { table: 'queue_events', filter: `doctor_id=eq.${doctorId}` },
      { table: 'doctor_sessions', filter: `doctor_id=eq.${doctorId}` },
      { table: 'doctor_session_pauses' },
    ], schedule, { fallbackMs: FALLBACK_MS, onStatus: setLive });
    return () => {
      if (first) clearTimeout(first);
      clearInterval(tick);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      inflight.current?.abort();
      stop();
    };
  }, [doctorId, initial, load, schedule]);

  /** Server responses (e.g. after an action) always replace what is on screen. */
  const replace = useCallback((s: StaffSnapshot) => { setSnap(s); setError(null); setLastUpdated(Date.now()); }, []);

  return { snap, error, live, lastUpdated, reload: load, replace };
}
