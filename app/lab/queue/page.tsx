import DashboardSidebar from '@/components/DashboardSidebar';
import LabConsole from '@/components/lab/LabConsole';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { getLabSnapshot, listLabLines, type LabSnapshot } from '@/lib/lab/server';

export const metadata = { title: 'Lab Queue' };

/** Lab staff: one sample-collection line at a time (blood, urine, ECG, X-ray, ...). */
export default async function LabQueuePage({ searchParams }: { searchParams: Promise<{ line?: string }> }) {
  await requireRole(['technician']);
  const supabase = await createClient();
  const lines = await listLabLines(supabase);
  const { line } = await searchParams;
  const lineId = lines.find((l) => l.id === line)?.id ?? lines[0]?.id;
  let initial: LabSnapshot | null = null;
  if (lineId) {
    try { initial = await getLabSnapshot(supabase, lineId); } catch { initial = null; }
  }
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="technician" />
        <div className="flex-grow-1 p-2 p-sm-3 p-md-4" style={{ minWidth: 0 }}>
          <div className="container-fluid px-1 px-sm-2" style={{ maxWidth: 1100 }}>
            <h2 className="mb-3 pb-2" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}>
              <i className="bi bi-droplet me-2" aria-hidden="true"></i>Lab Queue
            </h2>
            {lineId ? <LabConsole key={lineId} lines={lines} lineId={lineId} initial={initial} />
              : <div className="text-center py-5 text-muted">No lab lines are set up yet. Ask the admin to add them in Lab Settings.</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
