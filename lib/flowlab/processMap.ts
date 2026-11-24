// Flow Lab, event-log tab: a directly-follows process map and trace variants from flowq FlowEvents. Pure, unit-tested.
import type { FlowEvent } from '@/packages/flowq/src';

export interface Edge { from: string; to: string; count: number; medianMin: number; meanMin: number }
export interface Variant { path: string[]; count: number }
export interface ProcessMap {
  events: number;
  /** Appointments with at least one event. */
  cases: number;
  activities: { activity: string; count: number }[];
  edges: Edge[];
  variants: Variant[];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Cases are appointments: every event that names an appointment object is placed on that appointment's trace. */
export function buildProcessMap(events: FlowEvent[], maxVariants = 8): ProcessMap {
  const traces = new Map<string, FlowEvent[]>();
  const counts = new Map<string, number>();
  for (const e of events) {
    counts.set(e.activity, (counts.get(e.activity) ?? 0) + 1);
    const a = e.objects.find((o) => o.type === 'appointment');
    if (!a) continue;
    (traces.get(a.id) ?? traces.set(a.id, []).get(a.id)!).push(e);
  }
  const gaps = new Map<string, number[]>();
  const variants = new Map<string, Variant>();
  for (const t of traces.values()) {
    t.sort((x, y) => x.time - y.time || x.id.localeCompare(y.id));
    for (let i = 1; i < t.length; i++) {
      const k = `${t[i - 1].activity}\u0000${t[i].activity}`;
      (gaps.get(k) ?? gaps.set(k, []).get(k)!).push((t[i].time - t[i - 1].time) / 60000);
    }
    const path = t.map((e) => e.activity);
    const key = path.join('>');
    const v = variants.get(key);
    if (v) v.count++; else variants.set(key, { path, count: 1 });
  }
  const edges: Edge[] = [...gaps.entries()].map(([k, g]) => {
    const [from, to] = k.split('\u0000');
    return { from, to, count: g.length, medianMin: round1(median(g)), meanMin: round1(g.reduce((a, b) => a + b, 0) / g.length) };
  }).sort((a, b) => b.count - a.count || a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  return {
    events: events.length,
    cases: traces.size,
    activities: [...counts.entries()].map(([activity, count]) => ({ activity, count })).sort((a, b) => b.count - a.count || a.activity.localeCompare(b.activity)),
    edges,
    variants: [...variants.values()].sort((a, b) => b.count - a.count || a.path.join().localeCompare(b.path.join())).slice(0, maxVariants),
  };
}
