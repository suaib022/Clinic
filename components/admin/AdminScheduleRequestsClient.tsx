'use client';

import React, { useState } from 'react';
import { approveLeaveRequest, rejectLeaveRequest } from '@/app/admin/schedule/actions';

export interface DoctorLeaveItem {
    id: string;
    doctor_id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    created_at: string;
    doctor?: {
        full_name?: string;
        email?: string;
    } | Array<{
        full_name?: string;
        email?: string;
    }> | null;
}

interface Props {
    initialRequests: DoctorLeaveItem[];
}

export default function AdminScheduleRequestsClient({ initialRequests }: Props) {
    const [requests, setRequests] = useState<DoctorLeaveItem[]>(initialRequests);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

    const handleApprove = async (id: string) => {
        if (!confirm('Are you sure you want to approve this schedule cancellation? Affected patient appointments will be cancelled and notified.')) {
            return;
        }

        setProcessingId(id);
        setAlertMessage(null);

        try {
            const res = await approveLeaveRequest(id);
            if (!res.success) {
                setAlertMessage({ type: 'danger', text: res.error || 'Failed to approve request.' });
            } else {
                setAlertMessage({ type: 'success', text: res.message || 'Request approved successfully.' });
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
            }
        } catch (err: any) {
            setAlertMessage({ type: 'danger', text: err.message || 'Error processing approval.' });
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (id: string) => {
        const reason = prompt('Optional rejection reason:');
        if (reason === null) return; // User cancelled

        setProcessingId(id);
        setAlertMessage(null);

        try {
            const res = await rejectLeaveRequest(id, reason || undefined);
            if (!res.success) {
                setAlertMessage({ type: 'danger', text: res.error || 'Failed to reject request.' });
            } else {
                setAlertMessage({ type: 'success', text: res.message || 'Request rejected.' });
                setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
            }
        } catch (err: any) {
            setAlertMessage({ type: 'danger', text: err.message || 'Error processing rejection.' });
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div>
            {alertMessage && (
                <div className={`alert alert-${alertMessage.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
                    <i className={`bi ${alertMessage.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2`}></i>
                    {alertMessage.text}
                    <button type="button" className="btn-close" onClick={() => setAlertMessage(null)}></button>
                </div>
            )}

            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead className="table-light">
                        <tr>
                            <th>Doctor</th>
                            <th>Dates</th>
                            <th>Type</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th className="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {requests.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center text-muted py-4">
                                    No doctor leave or schedule cancellation requests found.
                                </td>
                            </tr>
                        ) : (
                            requests.map(req => {
                                const isBusy = processingId === req.id;
                                const doc = Array.isArray(req.doctor) ? req.doctor[0] : req.doctor;
                                return (
                                    <tr key={req.id}>
                                        <td>
                                            <div className="fw-bold text-dark">{doc?.full_name || 'Doctor'}</div>
                                            <small className="text-muted">{doc?.email}</small>
                                        </td>
                                        <td className="small fw-semibold">
                                            {req.start_date === req.end_date ? (
                                                req.start_date
                                            ) : (
                                                <span>{req.start_date} <br/><span className="text-muted">to</span> {req.end_date}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-dark border text-capitalize">
                                                {req.type ? req.type.replace('_', ' ') : 'full day'}
                                            </span>
                                        </td>
                                        <td className="small text-secondary" style={{ maxWidth: '280px' }}>
                                            {req.reason}
                                        </td>
                                        <td>
                                            <span className={`badge ${
                                                req.status === 'approved' ? 'bg-success' : 
                                                req.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger'
                                            } px-2 py-1`}>
                                                {req.status === 'pending' ? 'PENDING APPROVAL' : req.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="text-end">
                                            {req.status === 'pending' ? (
                                                <div className="d-flex justify-content-end gap-2">
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-success fw-bold d-inline-flex align-items-center gap-1 shadow-xs"
                                                        disabled={isBusy}
                                                        onClick={() => handleApprove(req.id)}
                                                    >
                                                        {isBusy ? (
                                                            <span className="spinner-border spinner-border-sm" role="status"></span>
                                                        ) : (
                                                            <>
                                                                <i className="bi bi-check-lg"></i>
                                                                <span>Approve</span>
                                                            </>
                                                        )}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1 shadow-xs"
                                                        disabled={isBusy}
                                                        onClick={() => handleReject(req.id)}
                                                    >
                                                        <i className="bi bi-x-lg"></i>
                                                        <span>Reject</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-muted small">Reviewed</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
