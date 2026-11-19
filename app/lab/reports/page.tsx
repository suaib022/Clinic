import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { listLabLines } from '@/lib/lab/server';
import LabReports from '@/components/lab/LabReports';
import { labPendingReports } from '@/lib/lab/actions';

export const metadata = { title: 'Reports' };

export default async function LabReportsPage() {
  await requireRole(['technician']);
  const supabase = await createClient();
  const lines = await listLabLines(supabase);
  const { reports } = await labPendingReports();
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="technician" />
        <div className="flex-grow-1 p-2 p-sm-3 p-md-4" style={{ minWidth: 0 }}>
          <div className="container-fluid px-1 px-sm-2" style={{ maxWidth: 1100 }}>
            <h2 className="mb-3 pb-2" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}>Reports</h2>
            <LabReports initial={reports} lines={lines} />
          </div>
        </div>
      </div>
    </main>
  );
}
