import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { todayDhaka } from '@/lib/format';
import DoctorScheduleManagementClient from '@/components/doctor/DoctorScheduleManagementClient';

export default async function DoctorSchedulePage() {
    const { user, role } = await requireRole(['admin', 'doctor']);
    const supabase = await createClient();
    const today = todayDhaka();

    // Fetch doctor leave and cancellation records
    const { data: leaves } = await supabase
        .from('doctor_leave_requests')
        .select('*')
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

    // Fetch doctor profile
    const { data: profile } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="doctor" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <div>
                                <h2 className="m-0" style={{ color: '#0D7D72' }}>
                                    <i className="bi bi-calendar3 me-2"></i>Schedule & Availability Management
                                </h2>
                                <small className="text-muted">Manage chamber schedule, cancel daily bookings, and review leave records</small>
                            </div>
                        </div>

                        <DoctorScheduleManagementClient 
                            doctorName={profile?.full_name || 'Doctor'}
                            todayDate={today}
                            initialLeaves={leaves || []}
                        />
                    </div>
                </div>
            </div>
        </main>
    );
}
