import { describe, it, expect } from 'vitest';
import { toOcelJson, toXes, type FlowEvent } from '../../packages/flowq/src';

const T = Date.UTC(2026, 10, 17, 12, 0);
const ev = (id: string, activity: FlowEvent['activity'], min: number, patient: string, extra: FlowEvent['objects'] = [], attrs: FlowEvent['attrs'] = {}): FlowEvent =>
  ({ id, activity, time: T + min * 60_000, objects: [{ type: 'patient', id: patient }, ...extra], attrs });
const EVENTS: FlowEvent[] = [
  ev('e1', 'check_in', 0, 'p1', [{ type: 'doctor', id: 'dr' }], { role: 'compounder' }),
  ev('e3', 'consult_end', 15, 'p1', [{ type: 'doctor', id: 'dr' }], { role: 'doctor' }),
  ev('e2', 'consult_start', 5, 'p1', [{ type: 'doctor', id: 'dr' }], { role: 'doctor', priority: 0 }),
  ev('e4', 'check_in', 2, 'p2', [{ type: 'doctor', id: 'dr' }], { role: 'R&D' }),
  ev('e5', 'lab_queue', 20, 'p1', [{ type: 'lab_line', id: 'blood' }], { role: 'lab_staff' }),
  ev('e6', 'sample_collected', 25, 'p1', [{ type: 'lab_line', id: 'blood' }], { role: 'lab_staff' }),
];

describe('OCEL 2.0', () => {
  const o = toOcelJson(EVENTS);
  it('has the four top-level parts', () => expect(Object.keys(o).sort()).toEqual(['eventTypes', 'events', 'objectTypes', 'objects']));
  it('relationships point at existing objects', () => {
    const ids = new Set(o.objects.map((x) => x.id));
    for (const e of o.events) for (const r of e.relationships) expect(ids.has(r.objectId)).toBe(true);
  });
  it('times are UTC ISO', () => { for (const e of o.events) expect(e.time.endsWith('Z')).toBe(true); });
  it('numeric attributes are typed float', () => {
    expect(o.eventTypes.find((t) => t.name === 'consult_start')!.attributes).toContainEqual({ name: 'priority', type: 'float' });
  });
});

describe('XES', () => {
  const x = toXes(EVENTS);
  it('one trace per patient', () => expect(x.match(/<trace>/g)).toHaveLength(2));
  it('events in time order inside a trace', () => {
    const p1 = x.split('<trace>')[1];
    const order = [...p1.matchAll(/concept:name" value="([a-z_]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['check_in', 'consult_start', 'consult_end', 'lab_queue', 'sample_collected']);
  });
  it('escapes XML', () => expect(x).toContain('R&amp;D'));
});
