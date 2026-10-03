import React from 'react';
import DashboardSidebar from '@/components/DashboardSidebar';
import { requireRole } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import WalkInClient from './WalkInClient';

export default async function WalkInPage() {
    const { user } = await requireRole(['compounder']);
    const supabase = await createClient();

    const { data: compounder } = await supabase
        .from('compounders')
        .select('assigned_doctor_id')
        .eq('id', user.id)
        .single();

    const doctorId = compounder?.assigned_doctor_id;

    if (!doctorId) {
        return (
            <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
                <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                    <DashboardSidebar role="compounder" />
                    <div className="flex-grow-1 p-4 p-md-5">
                        <div className="text-center py-5">
                            <i className="bi bi-info-circle display-1 text-muted"></i>
                            <h3 className="mt-3 text-muted">No Doctor Assigned</h3>
                            <p className="text-muted">Contact the admin to get assigned to a doctor.</p>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // Check if doctor is on break
    const { data: breakData } = await supabase.rpc('is_doctor_on_break', {
        p_doctor_id: doctorId,
        p_day_of_week: new Date().getDay(),
        p_time: new Date().toTimeString().split(' ')[0]
    });

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <WalkInClient doctorOnBreak={breakData === true} />
                </div>
            </div>
        </main>
    );
}
