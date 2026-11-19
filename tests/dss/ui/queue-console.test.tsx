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
const labAction = vi.fn();
vi.mock('@/lib/lab/actions', () => ({
  labAction: (...a: unknown[]) => labAction(...a),
  listTestTypes: vi.fn(async () => [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', code: 'cbc', name: 'Complete blood count (CBC)', line_id: 'L1', must_first: false, turnaround_min: 150 },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'fbs', name: 'Fasting blood sugar', line_id: 'L1', must_first: true, turnaround_min: 60 },
  ]),
}));
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
    result, suggestions, appointments: inp.appointments, myUndo: null, lastBroadcast: null, settings: inp.settings, lab: [],
  };
}
const view = (snap: StaffSnapshot | null) =>
  render(<QueueConsole mode="compounder" doctors={[{ id: DOC, full_name: 'Dr. Test' }]} doctorId={DOC} initial={snap} />);

const inRoom = appt(3, at(18, 20), { status: 'in_consultation', checkedInAt: at(18, 15), consultStartedAt: at(18, 35) });
const w4 = arrived(4, at(18, 30), at(18, 28));
const w5 = arrived(5, at(18, 40), at(18, 36));

beforeEach(() => {
  queueAction.mockReset();
  labAction.mockReset();
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

const labVisit = (over: Partial<import('@/lib/lab/doctorLab').DoctorLabVisit> = {}): import('@/lib/lab/doctorLab').DoctorLabVisit => ({
  appointmentId: '22222222-2222-4222-8222-222222222222', serialNo: 3, patientName: 'Patient 3', patientUhid: 'UH-3',
  tests: [{ orderId: 'o1', name: 'CBC', status: 'ordered' }], undecidedOrderIds: ['o1'], showLabChoice: true, showReviewOffer: false,
  advice: null, reviewAppointmentId: null, ...over,
});

describe('lab panels in the queue screen', () => {
  it('Lab now sends the undecided orders to the lab; Later hides the choice for the day', async () => {
    labAction.mockResolvedValue({ ok: true, code: 'ok', message: 'Sent to the lab.' });
    queueAction.mockResolvedValue({ ok: true, code: 'ok', message: 'Dismissed.' });
    view({ ...snapshot([inRoom, w4]), lab: [labVisit()] });
    fireEvent.click(screen.getByRole('button', { name: 'Lab now' }));
    await waitFor(() => expect(labAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'enqueue', orderIds: ['o1'] })));
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    await waitFor(() => expect(queueAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dismiss', suggestionKey: 'lab_later:22222222-2222-4222-8222-222222222222' })));
  });

  it('a ready report shows the engine advice and the report-review button', () => {
    const expectedStartAt = at(18, 55);
    view({ ...snapshot([inRoom, w4]), lab: [labVisit({ showLabChoice: false, showReviewOffer: true, tests: [{ orderId: 'o1', name: 'CBC', status: 'report_ready' }], advice: { kind: 'same_day', expectedStartAt } })] });
    expect(screen.getByTestId('advice-22222222-2222-4222-8222-222222222222').textContent).toMatch(/Can show the report today/);
    expect(screen.getByRole('button', { name: 'Add report review' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Book later' })).toBeTruthy();
  });

  it('when there is no time left the advice says book later and offers no same-day button', () => {
    view({ ...snapshot([inRoom, w4]), lab: [labVisit({ showLabChoice: false, showReviewOffer: true, advice: { kind: 'book_later', reason: 'not_enough_time' } })] });
    expect(screen.getByText(/Not enough time left in today/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add report review' })).toBeNull();
  });

  it('Add report review asks first, then adds the patient to the doctor line', async () => {
    queueAction.mockResolvedValue({ ok: true, code: 'ok', message: 'Report review added as serial 9.' });
    view({ ...snapshot([inRoom, w4]), lab: [labVisit({ showLabChoice: false, showReviewOffer: true, advice: { kind: 'same_day', expectedStartAt: at(18, 55) } })] });
    fireEvent.click(screen.getByRole('button', { name: 'Add report review' }));
    expect(queueAction).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Add to line' }));
    await waitFor(() => expect(queueAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'return_review', appointmentId: '22222222-2222-4222-8222-222222222222' })));
  });

  it('the doctor can order tests for the patient in the room; the order goes to the server', async () => {
    labAction.mockResolvedValue({ ok: true, code: 'ok', message: '2 test(s) ordered.' });
    render(<QueueConsole mode="doctor" doctors={[{ id: DOC, full_name: 'Dr. Test' }]} doctorId={DOC} initial={snapshot([inRoom, w4])} />);
    fireEvent.click(screen.getByRole('button', { name: 'Order tests' }));
    fireEvent.click(await screen.findByLabelText('Complete blood count (CBC)'));
    fireEvent.click(screen.getByLabelText(/Fasting blood sugar/));
    fireEvent.click(screen.getByRole('button', { name: 'Order 2 tests' }));
    await waitFor(() => expect(labAction).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'order_tests', testTypeIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    })));
  });

  it('a report-review patient is marked in the waiting list', () => {
    view(snapshot([inRoom, { ...w4, visitReason: 'report_review' }]));
    expect(screen.getAllByText('Report review').length).toBeGreaterThan(0);
  });

  it('no lab panels when there are no lab orders', () => {
    view(snapshot([inRoom, w4]));
    expect(screen.queryByTestId('lab-follow-up')).toBeNull();
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
