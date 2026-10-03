'use client';

import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';

export default function AccessLogClient({ patients, logs }: { patients: any[], logs: any[] }) {
    const [selectedPatientId, setSelectedPatientId] = useState<string>('ALL');

    const filteredLogs = useMemo(() => {
        if (selectedPatientId === 'ALL') return logs;
        return logs.filter(l => l.patient_id === selectedPatientId);
    }, [logs, selectedPatientId]);

    const getPatientName = (id: string) => {
        return patients.find(p => p.id === id)?.full_name || 'Unknown Patient';
    };

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <div>
                    <h2 className="m-0" style={{ color: '#0D7D72' }}>Access Log</h2>
                    <p className="text-muted small mb-0 mt-1">Record of staff who accessed your medical files (excluding your own actions).</p>
                </div>
                <a href="/patient/records" className="btn btn-sm btn-outline-secondary">
                    <i className="bi bi-arrow-left"></i> Back to Vault
                </a>
            </div>

            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row">
                        <div className="col-md-4">
                            <label className="form-label small text-muted mb-1">Filter by Profile</label>
                            <select className="form-select form-select-sm" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                                <option value="ALL">All Profiles</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Date & Time</th>
                                <th>Profile Accessed</th>
                                <th>Accessor Name</th>
                                <th>Role</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-5 text-muted">
                                        <i className="bi bi-shield-check fs-2 d-block mb-2"></i>
                                        No external access recorded for this selection.
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log: any) => (
                                    <tr key={log.id}>
                                        <td className="text-nowrap">{format(parseISO(log.created_at), 'MMM d, yyyy h:mm a')}</td>
                                        <td>{getPatientName(log.patient_id)}</td>
                                        <td className="fw-medium">{log.accessor?.full_name || 'System / Staff'}</td>
                                        <td>
                                            <span className={`badge ${log.role === 'doctor' ? 'bg-primary' : log.role === 'admin' ? 'bg-danger' : 'bg-info'}`}>
                                                {log.role}
                                            </span>
                                        </td>
                                        <td>{log.action}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
