// Staff actions in the simulator follow the app's rules (skip, rejoin, priority, undo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseScenario, simulateDay, type FlowEvent } from '../../packages/flowq/src';

const RAW = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/default.json'), 'utf8'));
const run = (staff: Record<string, number>, seed = 3) => simulateDay(parseScenario({ ...RAW, staff: { ...RAW.staff, ...staff } }), seed, { route: 'engine' });
const OFF = { awayWhenCalledP: 0, skipLateP: 0, priorityP: 0, undoCallP: 0 };
const appt = (e: FlowEvent) => e.objects.find((o) => o.type === 'appointment')?.id;

describe('staff actions', () => {
  it('switched off: no skip, rejoin, priority or undo events', () => {
    const acts = new Set(run(OFF).events.map((e) => e.activity));
    for (const a of ['skip', 'rejoin', 'priority_set', 'undo'] as const) expect(acts.has(a)).toBe(false);
  });

  it('switching staff on does not change who comes or when (separate random stream)', () => {
    const arrivals = (d: ReturnType<typeof run>) => d.events.filter((e) => e.activity === 'check_in' || e.activity === 'walk_in').map((e) => `${appt(e)}@${e.time}`).sort();
    expect(arrivals(run({ ...OFF, awayWhenCalledP: 0.3 }))).toEqual(arrivals(run(OFF)));
  });

  it('a patient away when called is skipped, rejoins, and is only seen after rejoining', () => {
    const d = run({ ...OFF, awayWhenCalledP: 1, comesBackP: 1 });
    const t: Record<string, Record<string, number>> = {};
    for (const e of d.events) { const a = appt(e); if (a) (t[a] ??= {})[e.activity] ??= e.time; }
    const skipped = Object.values(t).filter((x) => x.skip != null && x.consult_start != null);
    expect(skipped.length).toBeGreaterThan(0);
    for (const x of skipped) {
      expect(x.rejoin).toBeGreaterThan(x.skip);
      expect(x.consult_start).toBeGreaterThanOrEqual(x.rejoin);
    }
  });

  it('a late booked patient is skipped at grace and rejoins on arrival', () => {
    const d = run({ ...OFF, skipLateP: 1 }, 9);
    const late = d.events.filter((e) => e.activity === 'skip' && e.attrs.reason === 'late').map(appt);
    expect(late.length).toBeGreaterThan(0);
    const rejoined = new Set(d.events.filter((e) => e.activity === 'rejoin' && e.attrs.reason === 'late_arrival').map(appt));
    const noShow = new Set(d.events.filter((e) => e.activity === 'no_show').map(appt));
    for (const a of late) expect(rejoined.has(a) || noShow.has(a)).toBe(true);
  });

  it('priority is set right after check-in (booked and walk-in, not emergencies)', () => {
    const d = run({ ...OFF, priorityP: 1 });
    const arrivals = d.events.filter((e) => e.activity === 'check_in' || (e.activity === 'walk_in' && e.attrs.priority === 0));
    const set = d.events.filter((e) => e.activity === 'priority_set');
    expect(set.length).toBe(arrivals.length);
    for (const e of set) expect(arrivals.some((x) => appt(x) === appt(e) && x.time === e.time)).toBe(true);
  });

  it('an undone call is followed by an undo, and that patient is not seen at that moment', () => {
    const d = run({ ...OFF, undoCallP: 1 });
    const undos = d.events.filter((e) => e.activity === 'undo');
    expect(undos.length).toBeGreaterThan(0);
    for (const u of undos) {
      const startsNow = d.events.filter((e) => e.activity === 'consult_start' && e.time === u.time).map(appt);
      expect(startsNow).not.toContain(appt(u));
    }
  });

  it('a skipped patient who never comes back ends as a no-show', () => {
    const d = run({ ...OFF, awayWhenCalledP: 1, comesBackP: 0 });
    const skipped = new Set(d.events.filter((e) => e.activity === 'skip').map(appt));
    const ns = new Set(d.events.filter((e) => e.activity === 'no_show').map(appt));
    for (const a of skipped) expect(ns.has(a)).toBe(true);
  });
});
