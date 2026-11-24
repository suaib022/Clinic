// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock('@/lib/lab/followUpActions', () => ({ patientEnterFollowUp: vi.fn() }));
vi.mock('@/lib/feedback/store', () => ({ writeClassification: vi.fn() }));
vi.mock('@/app/patient/lab-actions', () => ({ submitLabFeedback: vi.fn() }));

import PatientLabCard from '@/components/lab/PatientLabCard';

const report = (over: Record<string, unknown> = {}) => ({
  orderId: 'o1',
  patientName: 'Pat A',
  test: 'CBC',
  status: 'report_ready' as const,
  appointmentId: null,
  doctorName: null,
  feedbackSubmitted: false,
  ...over,
});

describe('PatientLabCard rate-this-test', () => {
  afterEach(() => cleanup());

  it('offers a rating button for a ready report that is not rated yet', () => {
    render(<PatientLabCard initial={{ places: [], reports: [report()] }} />);
    expect(screen.getByRole('button', { name: /rate this test/i })).toBeTruthy();
  });

  it('hides the button once rated', () => {
    render(<PatientLabCard initial={{ places: [], reports: [report({ feedbackSubmitted: true })] }} />);
    expect(screen.queryByRole('button', { name: /rate this test/i })).toBeNull();
  });

  it('hides the button while the report is not ready', () => {
    render(<PatientLabCard initial={{ places: [], reports: [report({ status: 'collected' })] }} />);
    expect(screen.queryByRole('button', { name: /rate this test/i })).toBeNull();
  });
});
