// Regression tests for the lab estimate fixes (2026-11-17).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeExpectedDurations, DEFAULT_SETTINGS, dhakaClock, parseScenario, simulateDay } from '../../packages/flowq/src';

const RAWB = JSON.parse(readFileSync(path.resolve(__dirname, '../../packages/flowq/scenarios/busy-lab.json'), 'utf8'));

describe('history window', () => {
  it('defaults to the last 30 visits (doctor rule unchanged)', () => {
    expect(DEFAULT_SETTINGS.historyWindow).toBe(30);
    const d = computeExpectedDurations({ history: { new: [...Array(30).fill(20), ...Array(30).fill(5)], follow_up: [] }, settings: DEFAULT_SETTINGS });
    expect(d.new.typical).toBe(20);
    expect(d.new.samples).toBe(30);
  });
  it('a wider window uses more history', () => {
    const d = computeExpectedDurations({
      history: { new: [...Array(30).fill(20), ...Array(31).fill(5)], follow_up: [] }, settings: { ...DEFAULT_SETTINGS, historyWindow: 100 },
    });
    expect(d.new.typical).toBe(5); // the clamp floor is 3
    expect(d.new.samples).toBe(61);
  });
});

describe('simulated lab estimates', () => {
  // The lab closes at 19:00 while chambers run to 21:00, so people are still in line after closing.
  const sc = parseScenario({ ...RAWB, lab: { ...RAWB.lab, close: '19:00' } });
  const close = dhakaClock(sc.day.date, sc.lab.close);
  const day = simulateDay(sc, 4, { route: 'engine' });

  it('patients still waiting after closing time get a real estimate, not "now"', () => {
    const late = day.predictions.filter((p) => p.policy === 'engine' && p.stage === 'lab' && p.madeAt >= close && p.actualStartAt! > p.madeAt + 5 * 60_000);
    expect(late.length).toBeGreaterThan(0);
    expect(late.every((p) => p.predictedAt > p.madeAt)).toBe(true);
  });
});

describe('sum with mean', () => {
  // Skewed history: median 5, mean 8.
  const history = { new: [...Array(10).fill(5), ...Array(5).fill(14)], follow_up: [] };
  it('duration stats carry the mean', () => {
    expect(computeExpectedDurations({ history, settings: DEFAULT_SETTINGS }).new.mean).toBe(8);
  });
  it('default (doctor rule) still adds medians', () => {
    expect(DEFAULT_SETTINGS.sumWith).toBe('median');
  });
});
