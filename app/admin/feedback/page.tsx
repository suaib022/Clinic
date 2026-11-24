import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import FeedbackBoard from '@/components/feedback/FeedbackBoard';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { loadAppointmentFeedback, loadLabFeedback, summaryOf } from '@/lib/feedback/query';

export const dynamic = 'force-dynamic';

const ACCENT = '#1B2978';

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; cat?: string }>;
}) {
  await requireRole(['admin']);
  const supabase = await createClient();
  const sp = await searchParams;
  const kind = sp.kind === 'lab' ? 'lab' : 'doctor';
  const cat = ['positive', 'negative', 'improvement', 'staff'].includes(sp.cat ?? '') ? (sp.cat as string) : null;

  const rows = kind === 'lab' ? await loadLabFeedback(supabase) : await loadAppointmentFeedback(supabase);
  const summary = summaryOf(rows);
  const base = `/admin/feedback?kind=${kind}`;

  return (
    <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
      <DashboardSidebar role="admin" />
      <div className="flex-grow-1 p-4 p-md-5">
        <div className="container-fluid">
          <div className="mb-4 pb-3" style={{ borderBottom: `3px solid ${ACCENT}` }}>
            <h2 className="fw-bold m-0" style={{ color: ACCENT }}>Patient Feedback</h2>
          </div>
          <div className="d-flex gap-2 mb-4">
            <a href="/admin/feedback?kind=doctor" className={`btn btn-sm ${kind === 'doctor' ? 'btn-primary' : 'btn-outline-primary'}`}>Doctor visits</a>
            <a href="/admin/feedback?kind=lab" className={`btn btn-sm ${kind === 'lab' ? 'btn-primary' : 'btn-outline-primary'}`}>Lab tests</a>
          </div>
          <FeedbackBoard
            rows={rows}
            summary={summary}
            labelA={kind === 'lab' ? 'Test' : 'Doctor'}
            labelB="Hospital service"
            basePath={base}
            activeCategory={cat}
            whoHeading={kind === 'lab' ? 'Test' : 'Doctor'}
          />
        </div>
      </div>
    </div>
  );
}
