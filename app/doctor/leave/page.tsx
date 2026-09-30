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
