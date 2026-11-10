import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import SettingsForm from './SettingsForm';
import type { SettingsValues } from '@/lib/queue/adminActions';

export const metadata = { title: 'Queue Settings' };
const fmt = (s: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));

export default async function QueueSettingsPage() {
  await requireRole(['admin']);
  const supabase = await createClient();
  const { data: row } = await supabase.from('dss_settings').select('*').eq('id', 1).single();
  const { data: log } = await supabase.from('dss_settings_log').select('changed_at, old_values, new_values, changed_by').order('changed_at', { ascending: false }).limit(20);
  const values = Object.fromEntries(Object.entries(row ?? {}).filter(([k]) => !['id', 'updated_at', 'updated_by'].includes(k)));
  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="admin" />
        <div className="flex-grow-1 p-3 p-md-5">
          <div className="container-fluid" style={{ maxWidth: 1000 }}>
            <h2 className="mb-4 pb-3" style={{ color: '#0D7D72', borderBottom: '3px solid #0D7D72' }}><i className="bi bi-sliders me-2" aria-hidden="true"></i>Queue Settings</h2>
            {row ? <SettingsForm initial={values as SettingsValues} /> : <div className="alert alert-warning">Settings table not found.</div>}
            <h5 className="mt-5 mb-3">Change log</h5>
            <ul className="list-group">
              {(log ?? []).length === 0 && <li className="list-group-item text-muted">No changes yet.</li>}
              {(log ?? []).map((l, i) => {
                const changed = Object.keys(l.new_values as object).filter((k) => !['updated_at', 'updated_by'].includes(k)
                  && JSON.stringify((l.old_values as Record<string, unknown>)[k]) !== JSON.stringify((l.new_values as Record<string, unknown>)[k]));
                return (
                  <li key={i} className="list-group-item small">
                    <strong>{fmt(l.changed_at)}</strong>: {changed.length ? changed.map((k) => `${k} ${(l.old_values as Record<string, unknown>)[k]} → ${(l.new_values as Record<string, unknown>)[k]}`).join(', ') : 'no value changed'}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
