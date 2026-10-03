'use client';

import React, { useState } from 'react';
import { submitLeaveRequest } from './actions';

export default function LeaveForm() {
    const [requestType, setRequestType] = useState('full_day');

    return (
        <form action={async (formData) => { await submitLeaveRequest(formData); }} className="mt-3">
            <div className="mb-3">
               <label className="form-label">Request Type</label>
               <select name="type" className="form-select" value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                  <option value="full_day">Full Day Leave</option>
                  <option value="partial_day">Partial Day Break</option>
               </select>
            </div>
            <div className="row mb-3">
               <div className="col">
                  <label className="form-label">Start Date</label>
                  <input type="date" name="start_date" className="form-control" required />
               </div>
               <div className="col">
                  <label className="form-label">End Date</label>
                  <input type="date" name="end_date" className="form-control" required />
               </div>
            </div>
            
            {requestType === 'partial_day' && (
                <div className="row mb-3">
                   <div className="col">
                      <label className="form-label">Start Time</label>
                      <input type="time" name="start_time" className="form-control" required />
                   </div>
                   <div className="col">
                      <label className="form-label">End Time</label>
                      <input type="time" name="end_time" className="form-control" required />
                   </div>
                </div>
            )}

            <div className="mb-3">
               <label className="form-label">Reason</label>
               <textarea name="reason" className="form-control" rows={3}></textarea>
            </div>
            <button type="submit" className="btn btn-primary text-white" style={{ backgroundColor: '#0ab1a9', border: 'none' }}>Submit Request</button>
         </form>
    );
}
