// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import type { MyQueueStatus } from '@/lib/queue/server';
import PatientLiveQueueCard from '@/components/queue/PatientLiveQueueCard';

vi.mock('@/lib/realtime', () => ({ subscribeLive: () => () => {} }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

const T = Date.UTC(2026, 10, 10, 12, 30);
const status = (over: Partial<MyQueueStatus> = {}): MyQueueStatus => ({
  appointmentId: 'a1', patientName: 'P', doctorName: 'Dr. R', date: '2026-11-10', status: 'checked_in', stage: 'waiting', serialNo: 3,
  nowServingSerial: 1, patientsAhead: 1, bookedAt: T, expectedStartAt: T + 10 * 60000, waitMinLow: 5, waitMinHigh: 20, label: 'on_time',
  confidence: 'medium', rangeNote: null, reason: '', sessionState: 'active', lastUpdated: T, ...over,
});
const serve = (s: MyQueueStatus) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => s })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('patient live queue card: wait range note', () => {
  it('shows the wait range and, in calibrated mode, says where it comes from', async () => {
    serve(status({ rangeNote: 'calibrated' }));
    render(<PatientLiveQueueCard appointmentId="a1" />);
    await waitFor(() => expect(screen.getByText('5–20 min')).toBeTruthy());
    expect(screen.getByTestId('range-note').textContent).toMatch(/most patients start inside it/);
  });
  it('shows no note under the DSS rules', async () => {
    serve(status({ rangeNote: null }));
    render(<PatientLiveQueueCard appointmentId="a1" />);
    await waitFor(() => expect(screen.getByText('5–20 min')).toBeTruthy());
    expect(screen.queryByTestId('range-note')).toBeNull();
  });
  it('shows no note when there is no range yet', async () => {
    serve(status({ rangeNote: 'calibrated', waitMinLow: null, waitMinHigh: null, stage: 'not_arrived', status: 'scheduled' }));
    render(<PatientLiveQueueCard appointmentId="a1" />);
    await waitFor(() => expect(screen.getByText(/After check-in|—/)).toBeTruthy());
    expect(screen.queryByTestId('range-note')).toBeNull();
  });
});
