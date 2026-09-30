import os

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content.strip() + '\n')

# Admin Schedule Page
write_file('app/admin/schedule/page.tsx', '''
import React from 'react';
import Header from "@/components/Header";

export default function AdminSchedulePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header />
      <main className="container pt-5 mt-5">
        <h2 className="mb-4">Admin: Manage Doctor Schedules</h2>
        <div className="card shadow-sm p-4 mb-4">
          <h4>Leave & Break Requests</h4>
          <p className="text-muted">Approve or reject doctor requests here.</p>
          {/* Placeholder for list of requests */}
          <table className="table table-bordered mt-3">
             <thead>
                <tr>
                   <th>Doctor</th>
                   <th>Type</th>
                   <th>Date</th>
                   <th>Reason</th>
                   <th>Status</th>
                   <th>Action</th>
                </tr>
             </thead>
             <tbody>
                <tr>
                   <td colSpan={6} className="text-center text-muted">No pending requests</td>
                </tr>
             </tbody>
          </table>
        </div>
        
        <div className="card shadow-sm p-4">
          <h4>Weekly Schedules</h4>
          <p className="text-muted">Select a doctor to edit their weekly working days, start/end times, and slot duration.</p>
          <div className="row g-3">
             <div className="col-md-4">
                <select className="form-select">
                   <option>Select Doctor...</option>
                </select>
             </div>
             <div className="col-md-2">
                <button className="btn btn-primary w-100">Load Schedule</button>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
''')

# Doctor Leave Page
write_file('app/doctor/leave/page.tsx', '''
'use client';
import React from 'react';
import Header from "@/components/Header";

export default function DoctorLeavePage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      <Header />
      <main className="container pt-5 mt-5">
        <h2 className="mb-4">Doctor: Leave & Break Requests</h2>
        
        <div className="row">
           <div className="col-md-6">
              <div className="card shadow-sm p-4 mb-4">
                 <h4>Submit New Request</h4>
                 <form className="mt-3">
                    <div className="mb-3">
                       <label className="form-label">Request Type</label>
                       <select className="form-select">
                          <option value="full_day">Full Day Leave</option>
                          <option value="partial_day">Partial Day Break</option>
                       </select>
                    </div>
                    <div className="row mb-3">
                       <div className="col">
                          <label className="form-label">Start Date</label>
                          <input type="date" className="form-control" />
                       </div>
                       <div className="col">
                          <label className="form-label">End Date</label>
                          <input type="date" className="form-control" />
                       </div>
                    </div>
                    <div className="mb-3">
                       <label className="form-label">Reason</label>
                       <textarea className="form-control" rows={3}></textarea>
                    </div>
                    <button type="button" className="btn btn-primary">Submit Request</button>
                 </form>
              </div>
           </div>
           
           <div className="col-md-6">
              <div className="card shadow-sm p-4">
                 <h4>My Requests</h4>
                 <table className="table mt-3">
                    <thead>
                       <tr>
                          <th>Type</th>
                          <th>Dates</th>
                          <th>Status</th>
                          <th>Action</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr>
                          <td colSpan={4} className="text-center text-muted">No requests found</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
''')

print("Admin and Doctor pages created.")
