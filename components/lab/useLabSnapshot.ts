'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LabSnapshot } from '@/lib/lab/server';
import { createClient } from '@/lib/supabase/client';
import { subscribeLive } from '@/lib/realtime';

const FALLBACK_MS = 10_000;
const MIN_GAP_MS = 1_500;
const TICK_MS = 30_000;

/** Keeps one lab line fresh: Realtime on the line's queue and counter, debounced reloads, fallback poll (same as the doctor queue). */
export function useLabSnapshot(lineId: string, initial: LabSnapshot | null) {
  const [snap, setSnap] = useState<LabSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const last = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    last.current = Date.now();
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    try {
      const res = await fetch(`/api/lab/snapshot?lineId=${lineId}`, { signal: ctl.signal, cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 403 ? 'You are not allowed to see this line.' : 'Could not load the lab line.');
      setSnap((await res.json()) as LabSnapshot);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    }
  }, [lineId]);

  const schedule = useCallback(() => {
    if (pending.current) return;
    const wait = Math.max(300, MIN_GAP_MS - (Date.now() - last.current));
    pending.current = setTimeout(() => { pending.current = null; void load(); }, wait);
  }, [load]);

  useEffect(() => {
    const first = initial ? null : setTimeout(load, 0);
    const tick = setInterval(schedule, TICK_MS);
    const stop = subscribeLive(createClient(), `lab:${lineId}`, [
      { table: 'lab_queue_items', filter: `line_id=eq.${lineId}` },
      { table: 'lab_line_sessions', filter: `line_id=eq.${lineId}` },
      { table: 'lab_orders' },
    ], schedule, { fallbackMs: FALLBACK_MS, onStatus: setLive });
    return () => {
      if (first) clearTimeout(first);
      clearInterval(tick);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      inflight.current?.abort();
      stop();
    };
  }, [lineId, initial, load, schedule]);

  const replace = useCallback((s: LabSnapshot) => { setSnap(s); setError(null); }, []);
  return { snap, error, live, reload: load, replace };
}
