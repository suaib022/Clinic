import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { makeRng, parseScenario } from '../../packages/flowq/src';

const DEFAULT = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/default.json'), 'utf8'));

describe('rng', () => {
  it('same seed, same sequence', () => {
    const a = makeRng(42), b = makeRng(42);
    expect(Array.from({ length: 5 }, () => a.next())).toEqual(Array.from({ length: 5 }, () => b.next()));
  });
  it('different seeds differ', () => expect(makeRng(1).next()).not.toBe(makeRng(2).next()));
  it('lognormal median is close to the requested median', () => {
    const r = makeRng(7);
    const xs = Array.from({ length: 10_000 }, () => r.lognormalMin(9, 0.4)).sort((x, y) => x - y);
    expect(Math.abs(xs[5000] - 9) / 9).toBeLessThan(0.05);
  });
  it('poisson count is close to rate x hours', () => {
    const r = makeRng(3);
    const n = Array.from({ length: 200 }, () => r.poissonTimes(6, 0, 3 * 3_600_000).length).reduce((x, y) => x + y, 0) / 200;
    expect(Math.abs(n - 18)).toBeLessThan(1.5);
  });
});

describe('scenario', () => {
  it('default scenario parses', () => expect(parseScenario(DEFAULT).doctors).toHaveLength(3));
  it('bad probability names its path', () => {
    expect(() => parseScenario({ ...DEFAULT, patients: { ...DEFAULT.patients, noShowP: -0.1 } })).toThrow('scenario.patients.noShowP');
  });
  it('missing lab lines names its path', () => {
    expect(() => parseScenario({ ...DEFAULT, lab: { ...DEFAULT.lab, lines: undefined } })).toThrow('scenario.lab.lines');
  });
});

describe('scenario provenance', () => {
  const REQUIRED = [
    'visits.newMedianMin', 'visits.cv', 'visits.followUpMedianMin', 'visits.followUpShare', 'patients.latenessMeanMin', 'patients.latenessSdMin',
    'patients.noShowP', 'patients.walkInPerHour', 'patients.emergencyShareOfWalkIns', 'doctors.startLateMeanMin', 'doctors.slotMin',
    'lab.orderP', 'lab.nowP', 'lab.outsidePerHour', 'lab.lines.blood.typicalMin', 'lab.lines.blood.turnaroundMin', 'returns.sameDayWillingP',
  ];
  for (const file of ['default.json', 'busy-lab.json']) {
    it(`${file}: every parameter says where it comes from`, () => {
      const sc = parseScenario(JSON.parse(readFileSync(path.resolve(__dirname, `../../packages/flowq/scenarios/${file}`), 'utf8')));
      for (const k of REQUIRED) expect(sc.sources[k], k).toMatch(/^\[(cited|derived|assumption)\] /);
    });
  }
});

describe('scenario engine settings', () => {
  it('defaults to no overrides', () => expect(parseScenario(DEFAULT).engine).toEqual({ doctor: {}, lab: {} }));
  it('accepts known settings', () => {
    expect(parseScenario({ ...DEFAULT, engine: { doctor: { sumWith: 'mean', expectArrivals: true, showP: 0.77 } } }).engine.doctor)
      .toEqual({ sumWith: 'mean', expectArrivals: true, showP: 0.77 });
  });
  it('rejects unknown settings by path', () => {
    expect(() => parseScenario({ ...DEFAULT, engine: { doctor: { magic: 1 } } })).toThrow('scenario.engine.doctor.magic');
  });
});
