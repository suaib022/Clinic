import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import FeedbackBoard from '@/components/feedback/FeedbackBoard';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { loadLabFeedback, summaryOf } from '@/lib/feedback/query';

export const dynamic = 'force-dynamic';

const ACCENT = '#1B2978';

export default async function LabFeedbackPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireRole(['technician']);
  const supabase = await createClient();
  const sp = await searchParams;
  const cat = ['positive', 'negative', 'improvement', 'staff'].includes(sp.cat ?? '') ? (sp.cat as string) : null;

  const rows = await loadLabFeedback(supabase);
  const summary = summaryOf(rows);

  return (
    <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
      <DashboardSidebar role="technician" />
      <div className="flex-grow-1 p-4 p-md-5">
        <div className="container-fluid">
          <div className="mb-4 pb-3" style={{ borderBottom: `3px solid ${ACCENT}` }}>
            <h2 className="fw-bold m-0" style={{ color: ACCENT }}>Lab Test Feedback</h2>
          </div>
          <FeedbackBoard
            rows={rows}
            summary={summary}
            labelA="Test experience"
            labelB="Hospital service"
            basePath="/lab/feedback"
            activeCategory={cat}
            whoHeading="Test"
          />
        </div>
      </div>
    </div>
  );
}
