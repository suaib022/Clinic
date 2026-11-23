import Link from 'next/link';
import DashboardSidebar from '@/components/DashboardSidebar';
import AutoRefresh from '@/components/queue/AutoRefresh';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { todayDhaka } from '@/lib/format';
import { listManagedDoctors } from '@/lib/queue/server';
import { compareModes, type Comparison } from '@/lib/flowlab/compare';
import type { RawSnapshot } from '@/lib/queue/snapshotInput';
import LiveCompare from './LiveCompare';
import Simulator from './Simulator';

export const metadata = { title: 'Flow Lab' };

const TABS = [
  { key: 'live', label: 'Live: DSS vs full engine', icon: 'bi-broadcast' },
  { key: 'sim', label: 'Simulator', icon: 'bi-cpu' },
] as const;
type Tab = (typeof TABS)[number]['key'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Flow Lab: the flowq wait-time engine and its research tools inside the clinic app. Admin only, read-only. */
export default async function FlowLabPage({ searchParams }: { searchParams: Promise<{ tab?: string; doctor?: string }> }) {
  const { user } = await requireRole(['admin']);
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : 'live';
  const supabase = await createClient();

  let doctors: { id: string; full_name: string | null }[] = [];
  let comparison: Comparison | null = null;
  let doctorId: string | null = null;
  let error: string | null = null;
  if (tab === 'live') {
    doctors = await listManagedDoctors(supabase, user.id, 'admin');
    const today = todayDhaka();
    const { data: appts } = await supabase.from('appointments').select('doctor_id').eq('appointment_date', today).not('status', 'in', '(hold,cancelled)');
    const withQueue = new Set((appts ?? []).map((a) => a.doctor_id as string));
    doctors = [...doctors].sort((a, b) => Number(withQueue.has(b.id)) - Number(withQueue.has(a.id)));
    doctorId = sp.doctor && UUID.test(sp.doctor) && doctors.some((d) => d.id === sp.doctor) ? sp.doctor : doctors[0]?.id ?? null;
    if (doctorId) {
      const { data, error: e } = await supabase.rpc('dss_snapshot_input', { p_doctor_id: doctorId, p_date: null });
      if (e || !data) error = 'Could not read this doctor’s queue.';
      else comparison = compareModes(data as RawSnapshot);
    }
  }
  const doctorName = doctors.find((d) => d.id === doctorId)?.full_name ?? null;

  return (
    <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
      {tab === 'live' && <AutoRefresh seconds={15} />}
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="admin" />
        <div className="flex-grow-1 p-3 p-md-5" style={{ minWidth: 0 }}>
          <div className="container-fluid" style={{ maxWidth: 1200 }}>
            <h2 className="mb-2" style={{ color: '#1B2978' }}><i className="bi bi-diagram-3 me-2" aria-hidden="true"></i>Flow Lab</h2>
            <p className="text-muted mb-3 pb-3" style={{ borderBottom: '1px solid #E3EAF3' }}>
              The patient-flow engine behind the queue: compare it with the DSS rules, simulate a clinic day, and export the event log.
            </p>
            <ul className="nav nav-tabs mb-4" role="tablist">
              {TABS.map((t) => (
                <li className="nav-item" key={t.key}>
                  <Link className={`nav-link ${tab === t.key ? 'active' : ''}`} href={`/admin/flow-lab?tab=${t.key}`}>
                    <i className={`bi ${t.icon} me-1`} aria-hidden="true"></i>{t.label}
                  </Link>
                </li>
              ))}
            </ul>
            {tab === 'sim' && <Simulator />}
            {tab === 'live' && (
              <>
                <form method="get" className="d-flex align-items-end gap-2 mb-3 flex-wrap">
                  <input type="hidden" name="tab" value="live" />
                  <div>
                    <label className="form-label small mb-1" htmlFor="doctor">Doctor</label>
                    <select id="doctor" name="doctor" className="form-select" defaultValue={doctorId ?? ''}>
                      {doctors.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                    </select>
                  </div>
                  <button type="submit" className="btn btn-outline-primary">Show</button>
                </form>
                {error && <div className="alert alert-warning">{error}</div>}
                {!doctorId && <div className="alert alert-info">No doctors found.</div>}
                {comparison && <LiveCompare c={comparison} doctorName={doctorName} />}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
