import type { FlowEvent } from './events';

const iso = (t: number) => new Date(t).toISOString();
type AttrType = 'string' | 'float' | 'boolean';
const typeOf = (v: unknown): AttrType => (typeof v === 'number' ? 'float' : typeof v === 'boolean' ? 'boolean' : 'string');

/** OCEL 2.0 JSON (https://www.ocel-standard.org). Objects carry no attributes; events carry their attrs. */
export function toOcelJson(events: FlowEvent[]) {
  const objects = new Map<string, string>();
  const eventTypes = new Map<string, Map<string, AttrType>>();
  for (const e of events) {
    for (const o of e.objects) objects.set(o.id, o.type);
    const attrs = eventTypes.get(e.activity) ?? new Map<string, AttrType>();
    for (const [k, v] of Object.entries(e.attrs)) if (v != null && !attrs.has(k)) attrs.set(k, typeOf(v));
    eventTypes.set(e.activity, attrs);
  }
  return {
    objectTypes: [...new Set(objects.values())].sort().map((name) => ({ name, attributes: [] })),
    eventTypes: [...eventTypes.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attrs]) => ({ name, attributes: [...attrs.entries()].map(([n, type]) => ({ name: n, type })) })),
    objects: [...objects.entries()].map(([id, type]) => ({ id, type, attributes: [], relationships: [] })),
    events: events.map((e) => ({
      id: e.id,
      type: e.activity,
      time: iso(e.time),
      attributes: Object.entries(e.attrs).filter(([, v]) => v != null).map(([name, value]) => ({ name, value })),
      relationships: e.objects.map((o) => ({ objectId: o.id, qualifier: o.qualifier ?? o.type })),
    })),
  };
}
