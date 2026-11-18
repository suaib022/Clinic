import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import NotificationsList from '@/components/notifications/NotificationsList';

export const metadata = { title: 'Notifications' };

/** Full notifications page for every role (each user sees only their own, enforced by RLS). */
export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single();
  const role = (me?.role ?? 'patient') as 'patient' | 'doctor' | 'admin' | 'compounder';
  return (
    <main className="main pt-5" style={{ backgroundColor: '#F5F9FC' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role={role} />
        <div className="flex-grow-1 p-3 p-md-5">
          <div className="container-fluid" style={{ maxWidth: 1100 }}>
            <h2 className="mb-4 pb-3 fw-bold" style={{ color: '#1B2978', borderBottom: '1px solid #E3EAF3', fontSize: '28px' }}>
              <i className="bi bi-bell-fill me-2" aria-hidden="true"></i>Notifications Center
            </h2>
            <NotificationsList userId={user.id} />
          </div>
        </div>
      </div>
    </main>
  );
}
