// @vitest-environment jsdom
// DSS-71: compounder console states and safe-use behaviour. DSS-70: no medical data sources on the queue screens.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act, within } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { runEngine, type QueueAppointment, type SessionInfo } from '@/lib/queue/engine';
import type { StaffSnapshot } from '@/lib/queue/server';
import { at, appt, arrived, activeSession, input } from '../engine/fixtures';

const queueAction = vi.fn();
vi.mock('@/lib/queue/actions', () => ({ queueAction: (...a: unknown[]) => queueAction(...a) }));
vi.mock('@/app/compounder/actions', () => ({ lookupPatient: vi.fn(async () => ({ success: true, patients: [] })) }));
vi.mock('@/lib/realtime', () => ({ subscribeLive: (_s: unknown, _n: unknown, _t: unknown, _c: unknown, o: { onStatus?: (b: boolean) => void }) => { o.onStatus?.(true); return () => {}; } }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import QueueConsole from '@/components/queue/QueueConsole';

const DOC = '11111111-1111-4111-8111-111111111111';
function snapshot(appts: QueueAppointment[], session: SessionInfo = activeSession(), now = at(18, 40)): StaffSnapshot {
  const inp = input(now, appts.map((a) => ({ ...a, patientName: `Patient ${a.serialNo}`, patientUhid: `UH-${a.serialNo}` })), { session });
  const { result, suggestions } = runEngine(inp);
  return {
    doctor: { id: DOC, name: 'Dr. Test', speciality: null }, date: '2026-11-10', serverNow: now,
    session: { ...result.session, startedAt: session.startedAt ?? null, scheduledStartAt: session.scheduledStartAt ?? null, scheduledEndAt: session.scheduledEndAt ?? null, delayReason: null },
    result, suggestions, appointments: inp.appointments, myUndo: null, lastBroadcast: null, settings: inp.settings,
  };
}
const view = (snap: StaffSnapshot | null) =>
  render(<QueueConsole mode="compounder" doctors={[{ id: DOC, full_name: 'Dr. Test' }]} doctorId={DOC} initial={snap} />);

const inRoom = appt(3, at(18, 20), { status: 'in_consultation', checkedInAt: at(18, 15), consultStartedAt: at(18, 35) });
const w4 = arrived(4, at(18, 30), at(18, 28));
const w5 = arrived(5, at(18, 40), at(18, 36));

beforeEach(() => {
  queueAction.mockReset();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // background reloads never resolve unless a test says so
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('QueueConsole', () => {
  it('empty queue', () => {
    view(snapshot([]));
    expect(screen.getByText('Nobody in the room')).toBeTruthy();
    expect(screen.getByText('No patients booked for today yet.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Call next/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('loading', () => {
    view(null);
    expect(screen.getByText('Loading the queue…')).toBeTruthy();
  });

  it('error, with retry', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));
    view(null);
    expect(await screen.findByText('You are not assigned to this doctor.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('active session: now serving, next, live indicator', () => {
    view(snapshot([inRoom, w4, w5]));
    expect(screen.getByText('Active')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Now serving' })).getByText('#3')).toBeTruthy();
    expect(screen.getAllByText('Patient 3').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Done · Call #4/ })).toBeTruthy();
    expect(screen.getByText('● Live')).toBeTruthy();
  });

  it('paused session: reason shown, calling disabled, resume offered', () => {
    const paused = activeSession({ state: 'paused', pauses: [{ pausedAt: at(18, 38), reason: 'Prayer' }] });
    view(snapshot([inRoom, w4], paused));
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.getByText(/Prayer/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Done · Call #4/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: /Resume/ })).toBeTruthy();
  });

  it('confirming a suggestion runs exactly that action', async () => {
    const late = appt(2, at(18, 10)); // 30 min past, not arrived → skip suggestion at 18:25
    const snap = snapshot([late, w4], activeSession(), at(18, 25));
    queueAction.mockResolvedValue({ ok: true, code: 'ok', message: 'Serial 2 skipped for now.', snapshot: snap });
    view(snap);
    fireEvent.click(screen.getByRole('button', { name: 'Skip serial 2' }));
    await waitFor(() => expect(queueAction).toHaveBeenCalledTimes(1));
    expect(queueAction.mock.calls[0][0]).toMatchObject({ kind: 'skip', appointmentId: late.id });
    expect(queueAction.mock.calls[0][0].requestKey).toEqual(expect.any(String));
    expect(await screen.findByText('Serial 2 skipped for now.')).toBeTruthy();
  });

  it('a double tap sends one request; buttons are disabled while it runs', async () => {
    let finish!: (v: unknown) => void;
    queueAction.mockReturnValue(new Promise((r) => { finish = r; }));
    view(snapshot([inRoom, w4, w5]));
    const btn = screen.getByRole('button', { name: /Done · Call #4/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(queueAction).toHaveBeenCalledTimes(1);
    expect(queueAction.mock.calls[0][0]).toMatchObject({ kind: 'call_next', doctorId: DOC, expectedCurrent: inRoom.id });
    await waitFor(() => expect((btn as HTMLButtonElement).disabled).toBe(true));
    await act(async () => finish({ ok: true, code: 'ok', message: 'Serial 4 called.' }));
  });

  it('a collision shows "Already updated by someone else" and takes the server data', async () => {
    const fresh = snapshot([appt(3, at(18, 20), { status: 'prescription_pending', consultStartedAt: at(18, 35), consultEndedAt: at(18, 39) }),
      { ...w4, status: 'in_consultation', consultStartedAt: at(18, 39) }, w5]);
    queueAction.mockResolvedValue({ ok: false, code: 'stale', message: 'Already updated by someone else.', snapshot: fresh });
    view(snapshot([inRoom, w4, w5]));
    fireEvent.click(screen.getByRole('button', { name: /Done · Call #4/ }));
    expect(await screen.findByText('Already updated by someone else.')).toBeTruthy();
    // server wins: serial 4 is now in the room
    expect(within(screen.getByRole('region', { name: 'Now serving' })).getByText('#4')).toBeTruthy();
  });

  it('no-show asks for confirmation first', async () => {
    const late = appt(2, at(18, 0));
    queueAction.mockResolvedValue({ ok: true, code: 'ok', message: 'Serial 2 marked as no-show.' });
    view(snapshot([late], activeSession(), at(18, 45)));
    fireEvent.click(screen.getAllByRole('button', { name: 'No-show' })[0]);
    expect(queueAction).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog').textContent).toContain('Mark serial 2 as no-show?');
    fireEvent.click(screen.getByRole('button', { name: 'Mark no-show' }));
    await waitFor(() => expect(queueAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'no_show', appointmentId: late.id })));
  });
});

describe('DSS-70 privacy: queue screens never read medical data', () => {
  const files = [
    'components/queue/QueueConsole.tsx', ...fs.readdirSync('components/queue/console').map((f) => path.join('components/queue/console', f)),
    'app/compounder/queue/page.tsx', 'lib/queue/server.ts', 'lib/queue/actions.ts',
  ];
  it.each(files)('%s', (f) => {
    const src = fs.readFileSync(f, 'utf8');
    expect(src).not.toMatch(/medical_records|prescription_record|diagnos|symptom|triage_|lab_report/i);
  });
});
