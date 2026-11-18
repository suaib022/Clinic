import DashboardSidebar from '@/components/DashboardSidebar';
import QueueConsole from '@/components/queue/QueueConsole';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { getQueueSnapshot, syncEstimates, type StaffSnapshot } from '@/lib/queue/server';

export const metadata = { title: 'Live Queue' };

/** DSS-90/91: the doctor runs their own session (start, pause, resume, end) and can Call next / Done without a compounder. */
export default async function DoctorQueuePage() {
  const { user } = await requireRole(['doctor']);
  const supabase = await createClient();
  const { data: me } = await supabase.from('users').select('full_name').eq('id', user.id).single();
  let initial: StaffSnapshot | null = null;
  try {
    initial = await getQueueSnapshot(supabase, user.id);
    await syncEstimates(supabase, initial);
  } catch {
    initial = null;
  }
  return (
    <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="doctor" />
        <div className="flex-grow-1 p-2 p-sm-3 p-md-4" style={{ minWidth: 0 }}>
          <div className="container-fluid px-1 px-sm-2" style={{ maxWidth: 1100 }}>
            <h2 className="mb-3 pb-2" style={{ color: '#1B2978', borderBottom: '1px solid #E3EAF3' }}>
              <i className="bi bi-broadcast me-2" aria-hidden="true"></i>My Live Queue
            </h2>
            <QueueConsole mode="doctor" doctors={[{ id: user.id, full_name: me?.full_name ?? null }]} doctorId={user.id} initial={initial} />
          </div>
        </div>
      </div>
    </main>
  );
}
