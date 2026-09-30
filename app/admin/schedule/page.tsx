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
