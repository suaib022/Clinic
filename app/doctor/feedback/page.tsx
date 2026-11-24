import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import FeedbackBoard from '@/components/feedback/FeedbackBoard';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { loadAppointmentFeedback, summaryOf } from '@/lib/feedback/query';

export const dynamic = 'force-dynamic';

const ACCENT = '#1B2978';

/** Doctor sees only feedback for their own consultations (enforced by RLS in the query). */
export default async function DoctorFeedbackPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireRole(['doctor']);
  const supabase = await createClient();
  const sp = await searchParams;
  const cat = ['positive', 'negative', 'improvement', 'staff'].includes(sp.cat ?? '') ? (sp.cat as string) : null;

  const rows = await loadAppointmentFeedback(supabase);
  const summary = summaryOf(rows);

  return (
    <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
      <DashboardSidebar role="doctor" />
      <div className="flex-grow-1 p-4 p-md-5">
        <div className="container-fluid">
          <div className="mb-4 pb-3" style={{ borderBottom: `3px solid ${ACCENT}` }}>
            <h2 className="fw-bold m-0" style={{ color: ACCENT }}>Patient Feedback</h2>
            <p className="text-muted small mb-0">Feedback on your consultations.</p>
          </div>
          <FeedbackBoard
            rows={rows}
            summary={summary}
            labelA="Doctor"
            labelB="Hospital service"
            basePath="/doctor/feedback"
            activeCategory={cat}
            whoHeading="Doctor"
          />
        </div>
      </div>
    </div>
  );
}
