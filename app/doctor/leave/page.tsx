import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import LeaveForm from './LeaveForm';
import { requireRole } from '@/lib/auth/requireRole';

export default async function DoctorLeavePage() {
    const cookieStore = await cookies();
    const { user: { id: staffSession } } = await requireRole(['admin', 'doctor', 'compounder']);
    const { role } = await requireRole(['admin', 'doctor', 'compounder']);
    
    if (role !== 'doctor' || !staffSession) {
        redirect('/doctor/login');
    }

    const supabase = await createClient();
    
    const { data: requests } = await supabase
        .from('doctor_leave_requests')
        .select('*')
        .eq('doctor_id', staffSession)
        .order('created_at', { ascending: false });

  return (
    <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
      <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
        <DashboardSidebar role="doctor" />
        <div className="flex-grow-1 p-4 p-md-5">
          <div className="container-fluid max-w-1200 mx-auto">
            <h2 className="mb-4" style={{ color: '#0D7D72' }}>Doctor: Leave & Break Requests</h2>
        
        <div className="row">
           <div className="col-md-5">
              <div className="card border-0 shadow-sm rounded-0 p-4 mb-4">
                 <h5 className="mb-0 text-secondary fw-bold">Submit New Request</h5>
                 <LeaveForm />
              </div>
           </div>
           
           <div className="col-md-7">
              <div className="card border-0 shadow-sm rounded-0 p-4">
                 <h5 className="mb-0 text-secondary fw-bold">My Requests</h5>
                 <div className="table-responsive mt-3">
                     <table className="table table-hover mb-0">
                        <thead className="table-light">
                           <tr>
                              <th className="py-3">Type</th>
                              <th className="py-3">Dates & Time</th>
                              <th className="py-3">Status</th>
                           </tr>
                        </thead>
                        <tbody>
                           {requests && requests.length > 0 ? (
                               requests.map((req) => (
                                   <tr key={req.id}>
                                      <td className="py-3">{req.type === 'full_day' ? 'Full Day' : 'Partial Day'}</td>
                                      <td className="py-3">
                                        <div>{req.start_date} to {req.end_date}</div>
                                        {req.type === 'partial_day' && req.start_time && req.end_time && (
                                            <small className="text-muted">{req.start_time.substring(0,5)} - {req.end_time.substring(0,5)}</small>
                                        )}
                                      </td>
                                      <td className="py-3">
                                        <span className={`badge ${req.status === 'pending' ? 'bg-warning text-dark' : req.status === 'approved' ? 'bg-success' : 'bg-danger'}`}>
                                            {req.status.toUpperCase()}
                                        </span>
                                      </td>
                                   </tr>
                               ))
                           ) : (
                               <tr>
                                  <td colSpan={3} className="text-center text-muted py-4">No requests found</td>
                               </tr>
                           )}
                        </tbody>
                     </table>
                 </div>
              </div>
           </div>
          </div>
        </div>
      </div>
      </div>
    </main>
  );
}
