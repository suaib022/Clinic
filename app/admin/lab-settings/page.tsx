import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import LabSettingsClient, { type LineRow, type TestRow } from './LabSettingsClient';

export const metadata = { title: 'Lab Settings' };

export default async function LabSettingsPage() {
  await requireRole(['admin']);
  const db = await createClient();
  const [{ data: lines }, { data: tests }] = await Promise.all([
    db.from('lab_lines').select('id, code, name, typical_min, active').order('sort_order').order('name'),
    db.from('lab_test_types').select('id, code, name, line_id, must_first, turnaround_min, active').order('name'),
  ]);
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="admin" />
        <div className="flex-grow-1 p-4 p-md-5">
          <div className="container-fluid mx-auto" style={{ maxWidth: 1100 }}>
            <h2 className="mb-4 pb-3" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}>Lab Settings</h2>
            <LabSettingsClient lines={(lines ?? []) as LineRow[]} tests={(tests ?? []) as TestRow[]} />
          </div>
        </div>
      </div>
    </main>
  );
}
