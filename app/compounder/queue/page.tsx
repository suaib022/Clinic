import DashboardSidebar from '@/components/DashboardSidebar';
import QueueConsole from '@/components/queue/QueueConsole';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { getQueueSnapshot, listManagedDoctors, syncEstimates, type StaffSnapshot } from '@/lib/queue/server';

export const metadata = { title: 'Live Queue' };

/** DSS-60..72: compounder live queue for one assigned doctor, today. Reads only the staff snapshot (no medical data). */
export default async function CompounderQueuePage({ searchParams }: { searchParams: Promise<{ doctor?: string }> }) {
  const { user } = await requireRole(['compounder']);
  const supabase = await createClient();
  const doctors = await listManagedDoctors(supabase, user.id, 'compounder');
  const { doctor } = await searchParams;
  const doctorId = doctors.find((d) => d.id === doctor)?.id ?? doctors[0]?.id;

  let initial: StaffSnapshot | null = null;
  if (doctorId) {
    try {
      initial = await getQueueSnapshot(supabase, doctorId);
      await syncEstimates(supabase, initial);
    } catch {
      initial = null; // the client shows the error state and retries
    }
  }

  return (
    <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="compounder" />
        <div className="flex-grow-1 p-2 p-sm-3 p-md-4" style={{ minWidth: 0 }}>
          <div className="container-fluid px-1 px-sm-2" style={{ maxWidth: 1100 }}>
            <h2 className="mb-3 pb-2" style={{ color: '#1B2978', borderBottom: '1px solid #E3EAF3' }}>
              <i className="bi bi-broadcast me-2" aria-hidden="true"></i>Live Queue
            </h2>
            {doctorId ? (
              <QueueConsole key={doctorId} mode="compounder" doctors={doctors} doctorId={doctorId} initial={initial} />
            ) : (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-info-circle display-4 d-block mb-2" aria-hidden="true"></i>
                You are not assigned to any doctor yet. Ask the admin to assign you.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
