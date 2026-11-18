import { describe, it, expect } from 'vitest';
import { toLineInput, lineResult, type RawLabSnapshot } from '@/lib/lab/snapshotInput';

const NOW = '2026-11-18T12:00:00.000Z';
const at = (m: number) => new Date(Date.parse(NOW) + m * 60_000).toISOString();
const item = (id: string, queuedMin: number, extra: Partial<RawLabSnapshot['items'][number]> = {}): RawLabSnapshot['items'][number] => ({
  id, patient_id: `p-${id}`, status: 'queued', priority_level: 0, queued_at: at(queuedMin), called_at: null, collected_at: null,
  skipped_at: null, rejoined_at: null, patient_name: null, patient_uhid: null, tests: [], other_lines: [], ...extra,
});
const raw = (items: RawLabSnapshot['items'], session: RawLabSnapshot['session'] = { id: 's', status: 'open', opened_at: at(-120), closed_at: null, pauses: [] }): RawLabSnapshot => ({
  server_now: NOW, date: '2026-11-18', settings: null, line: { id: 'L', code: 'blood', name: 'Blood', typical_min: 4 },
  session, items, history: [], my_undo: null,
});

describe('lab snapshot mapper', () => {
  it('maps sessions: open -> active, paused, closed with nobody waiting -> ended, closed with people waiting -> active', () => {
    expect(toLineInput(raw([])).input.session.state).toBe('active');
    expect(toLineInput(raw([], null)).input.session.state).toBe('not_started');
    expect(toLineInput(raw([], { id: 's', status: 'closed', opened_at: at(-120), closed_at: at(-5), pauses: [] })).input.session.state).toBe('ended');
    expect(toLineInput(raw([item('a', -3)], { id: 's', status: 'closed', opened_at: at(-120), closed_at: at(-5), pauses: [] })).input.session.state).toBe('active');
  });
  it('a skipped place is skipped; a rejoined place counts from the rejoin', () => {
    const { input } = toLineInput(raw([item('a', -10, { skipped_at: at(-5) }), item('b', -10, { rejoined_at: at(-2) })]));
    expect(input.items.map((i) => i.status)).toEqual(['skipped', 'queued']);
    expect(input.items[1].queuedAt).toBe(Date.parse(at(-2)));
  });
  it('lab lines sum averages over a long history', () => {
    expect(toLineInput(raw([])).input.settings).toMatchObject({ historyWindow: 200, sumWith: 'mean' });
  });
  it('wait for a newcomer: two people ahead at 4 min each, counter free', () => {
    expect(lineResult(raw([item('a', -3), item('b', -2)])).waitMin).toBe(8);
  });
  it('a closed counter with nobody waiting has no wait (Infinity)', () => {
    expect(lineResult(raw([], { id: 's', status: 'closed', opened_at: at(-120), closed_at: at(-5), pauses: [] })).waitMin).toBe(Infinity);
  });
});
