'use client';

import React, { useState, useEffect } from 'react';
import { cancelDoctorSchedule, getScheduleImpactPreview } from '@/app/doctor/actions';

interface LeaveRecord {
    id: string;
    type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
    created_at: string;
}

interface Props {
    doctorName: string;
    todayDate: string;
    initialLeaves: LeaveRecord[];
}

function addDays(baseDateStr: string, days: number): string {
    if (!baseDateStr) return '';
    const [y, m, d] = baseDateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().split('T')[0];
}

export default function DoctorScheduleManagementClient({ doctorName, todayDate, initialLeaves }: Props) {
    const [scope, setScope] = useState<'today' | 'tomorrow' | '3days' | 'custom'>('today');
    const [startDate, setStartDate] = useState<string>(todayDate);
    const [endDate, setEndDate] = useState<string>(todayDate);
    const [reasonPreset, setReasonPreset] = useState<string>('Emergency OT / Surgical Procedure');
    const [customReason, setCustomReason] = useState<string>('');
    const [leaves, setLeaves] = useState<LeaveRecord[]>(initialLeaves);

    // Impact preview state
    const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
    const [impactData, setImpactData] = useState<{
        totalAppointments: number;
        paidAppointments: number;
        appointments: any[];
    } | null>(null);

    // Cancellation modal & action state
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [isCancelling, setIsCancelling] = useState<boolean>(false);
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

    // Handler for selecting cancellation window
    const handleSelectScope = (selectedScope: 'today' | 'tomorrow' | '3days' | 'custom') => {
        setScope(selectedScope);
        if (selectedScope === 'today') {
            setStartDate(todayDate);
            setEndDate(todayDate);
        } else if (selectedScope === 'tomorrow') {
            const tomStr = addDays(todayDate, 1);
            setStartDate(tomStr);
            setEndDate(tomStr);
        } else if (selectedScope === '3days') {
            setStartDate(todayDate);
            setEndDate(addDays(todayDate, 2));
        }
    };

    // Keep dates in sync if todayDate or scope changes externally
    useEffect(() => {
        if (!todayDate) return;
        if (scope === 'today') {
            setStartDate(todayDate);
            setEndDate(todayDate);
        } else if (scope === 'tomorrow') {
            const tomStr = addDays(todayDate, 1);
            setStartDate(tomStr);
            setEndDate(tomStr);
        } else if (scope === '3days') {
            setStartDate(todayDate);
            setEndDate(addDays(todayDate, 2));
        }
    }, [scope, todayDate]);

    // Fetch impact preview whenever startDate or endDate changes
    useEffect(() => {
        if (!startDate || !endDate) return;
        let isMounted = true;
        setIsLoadingPreview(true);

        getScheduleImpactPreview(startDate, endDate).then(res => {
            if (isMounted) {
                if (res.success) {
                    setImpactData({
                        totalAppointments: res.totalAppointments || 0,
                        paidAppointments: res.paidAppointments || 0,
                        appointments: res.appointments || []
                    });
                } else {
                    setImpactData(null);
                }
                setIsLoadingPreview(false);
            }
        });

        return () => { isMounted = false; };
    }, [startDate, endDate]);

    const activeReason = reasonPreset === 'Other' ? customReason.trim() : reasonPreset;

    const handleConfirmCancellation = async () => {
        if (!activeReason) {
            setActionMessage({ type: 'danger', text: 'Please provide a valid cancellation reason.' });
            return;
        }

        setIsCancelling(true);
        setActionMessage(null);

        try {
            const res = await cancelDoctorSchedule({
                startDate,
                endDate,
                reason: activeReason
            });

            if (!res.success) {
                setActionMessage({ type: 'danger', text: res.error || 'Failed to cancel schedule.' });
                setIsCancelling(false);
                return;
            }

            setActionMessage({
                type: 'success',
                text: res.message || 'Schedule cancellation request submitted successfully. It is now pending administrator approval.'
            });

            setShowConfirmModal(false);

            // Add to leaves list optimistically with pending status
            const newLeave: LeaveRecord = {
                id: 'temp-' + Date.now(),
                type: 'full_day',
                start_date: startDate,
                end_date: endDate,
                reason: activeReason.startsWith('Schedule Cancelled:') ? activeReason : 'Schedule Cancelled: ' + activeReason,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            setLeaves(prev => [newLeave, ...prev]);
        } catch (err: any) {
            setActionMessage({ type: 'danger', text: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsCancelling(false);
        }
    };

    return (
        <div>
            {actionMessage && (
                <div className={`alert alert-${actionMessage.type} alert-dismissible fade show mb-4 shadow-sm`} role="alert">
                    <i className={`bi ${actionMessage.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'} me-2 fs-5`}></i>
                    <strong>{actionMessage.type === 'success' ? 'Success: ' : 'Error: '}</strong>
                    {actionMessage.text}
                    <button type="button" className="btn-close" onClick={() => setActionMessage(null)}></button>
                </div>
            )}

            <div className="row g-4">
                {/* Left Column: Cancellation Control Center */}
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm rounded-0 p-4 h-100" style={{ borderTop: '4px solid #d9534f' }}>
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <i className="bi bi-calendar-x text-danger fs-3"></i>
                            <div>
                                <h5 className="fw-bold mb-0 text-dark">Schedule Cancellation Request</h5>
                                <small className="text-muted">Submit leave or cancellation request (requires Admin approval)</small>
                            </div>
                        </div>

                        <style>{`
                            .cancellation-window-btn {
                                background-color: #ffffff !important;
                                color: #334155 !important;
                                border: 1px solid #cbd5e1 !important;
                                font-weight: 500 !important;
                                padding: 8px 12px !important;
                                transition: all 0.15s ease-in-out !important;
                                cursor: pointer !important;
                            }
                            .cancellation-window-btn:hover {
                                background-color: #f8fafc !important;
                                color: #1B2978 !important;
                                border-color: #1B2978 !important;
                            }
                            .cancellation-window-btn.active {
                                background-color: #1B2978 !important;
                                color: #ffffff !important;
                                border-color: #1B2978 !important;
                                font-weight: 700 !important;
                                box-shadow: 0 2px 4px rgba(27, 41, 120, 0.25) !important;
                            }
                        `}</style>

                        <div className="mb-3">
                            <label className="form-label fw-bold small text-uppercase text-secondary">
                                1. Select Cancellation Window
                            </label>
                            <div className="btn-group w-100 mb-3 shadow-xs" role="group">
                                <button
                                    type="button"
                                    className={`btn btn-sm cancellation-window-btn ${scope === 'today' ? 'active' : ''}`}
                                    onClick={() => handleSelectScope('today')}
                                >
                                    Today Only
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm cancellation-window-btn ${scope === 'tomorrow' ? 'active' : ''}`}
                                    onClick={() => handleSelectScope('tomorrow')}
                                >
                                    Tomorrow
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm cancellation-window-btn ${scope === '3days' ? 'active' : ''}`}
                                    onClick={() => handleSelectScope('3days')}
                                >
                                    Next 3 Days
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm cancellation-window-btn ${scope === 'custom' ? 'active' : ''}`}
                                    onClick={() => handleSelectScope('custom')}
                                >
                                    Custom Range
                                </button>
                            </div>

                            <div className="row g-2">
                                <div className="col-6">
                                    <label className="form-label small text-muted">From Date:</label>
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        min={todayDate}
                                        value={startDate}
                                        disabled={scope !== 'custom'}
                                        onClick={() => { if (scope !== 'custom') setScope('custom'); }}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setStartDate(val);
                                            if (endDate && val > endDate) {
                                                setEndDate(val);
                                            }
                                        }}
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label small text-muted">To Date:</label>
                                    <input
                                        type="date"
                                        className="form-control form-control-sm"
                                        min={startDate || todayDate}
                                        value={endDate}
                                        disabled={scope !== 'custom'}
                                        onClick={() => { if (scope !== 'custom') setScope('custom'); }}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Live Impact Preview Card */}
                        <div className="p-3 rounded mb-3 border bg-light">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="small text-muted fw-bold text-uppercase">Impact Preview</span>
                                {isLoadingPreview && (
                                    <span className="spinner-border spinner-border-sm text-secondary" role="status"></span>
                                )}
                            </div>
                            <div className="row text-center g-2 mt-1">
                                <div className="col-6">
                                    <div className="p-2 bg-white rounded border">
                                        <div className="text-muted small">Total Bookings</div>
                                        <div className="fs-4 fw-bold text-danger">
                                            {impactData ? impactData.totalAppointments : 0}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-2 bg-white rounded border">
                                        <div className="text-muted small">Paid Visits (Refunds)</div>
                                        <div className="fs-4 fw-bold text-warning-emphasis">
                                            {impactData ? impactData.paidAppointments : 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="small text-muted mt-2">
                                <i className="bi bi-info-circle me-1"></i>
                                {impactData && impactData.totalAppointments > 0 ? (
                                    <span>
                                        If approved by Hospital Administration, all <strong>{impactData.totalAppointments}</strong> booked patients will receive automated cancellation notifications with instant refund and rebooking options.
                                    </span>
                                ) : (
                                    <span>No active patient bookings found on the selected date(s). Schedule will be blocked from new bookings once approved.</span>
                                )}
                            </div>
                        </div>

                        {/* Reason Selection */}
                        <div className="mb-3">
                            <label className="form-label fw-bold small text-uppercase text-secondary">
                                2. Reason for Cancellation <span className="text-danger">*</span>
                            </label>
                            <select
                                className="form-select form-select-sm mb-2"
                                value={reasonPreset}
                                onChange={(e) => setReasonPreset(e.target.value)}
                            >
                                <option value="Emergency OT / Surgical Procedure">Emergency OT / Surgical Procedure</option>
                                <option value="Urgent Hospital ICU Round">Urgent Hospital ICU Round</option>
                                <option value="Attending Medical Conference / CME">Attending Medical Conference / CME</option>
                                <option value="Doctor Health / Medical Leave">Doctor Health / Medical Leave</option>
                                <option value="Personal / Family Emergency">Personal / Family Emergency</option>
                                <option value="Other">Other (Custom Reason)</option>
                            </select>

                            {reasonPreset === 'Other' && (
                                <textarea
                                    className="form-control form-control-sm"
                                    rows={2}
                                    placeholder="Enter detailed reason to share with patients..."
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    required
                                />
                            )}
                        </div>

                        <button
                            type="button"
                            className="btn btn-danger fw-bold py-2 mt-auto d-flex align-items-center justify-content-center gap-2 shadow-sm"
                            disabled={!activeReason}
                            onClick={() => setShowConfirmModal(true)}
                        >
                            <i className="bi bi-send-check"></i>
                            Submit Cancellation for Admin Approval
                        </button>
                    </div>
                </div>

                {/* Right Column: Cancelled Schedule History & Leave Status */}
                <div className="col-lg-6">
                    <div className="card border-0 shadow-sm rounded-0 p-4 h-100" style={{ borderTop: '4px solid #1B2978' }}>
                        <div className="d-flex align-items-center gap-2 mb-3">
                            <i className="bi bi-clock-history text-secondary fs-3"></i>
                            <div>
                                <h5 className="fw-bold mb-0 text-dark">Schedule Cancellation & Leave Log</h5>
                                <small className="text-muted">History of unavailable dates and approved leaves</small>
                            </div>
                        </div>

                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="py-2">Dates</th>
                                        <th className="py-2">Reason</th>
                                        <th className="py-2 text-end">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaves && leaves.length > 0 ? (
                                        leaves.map((l) => (
                                            <tr key={l.id}>
                                                <td className="py-2 small fw-semibold text-nowrap">
                                                    {l.start_date === l.end_date ? (
                                                        l.start_date
                                                    ) : (
                                                        <span>{l.start_date} <br/><span className="text-muted">to</span> {l.end_date}</span>
                                                    )}
                                                </td>
                                                <td className="py-2 small text-secondary">
                                                    {l.reason}
                                                </td>
                                                <td className="py-2 text-end">
                                                    <span className={`badge ${l.status === 'approved' ? 'bg-success' : l.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger'} px-2 py-1`}>
                                                        {l.status === 'pending' ? (
                                                            <>
                                                                <i className="bi bi-hourglass-split me-1"></i>PENDING APPROVAL
                                                            </>
                                                        ) : l.status === 'approved' ? (
                                                            <>
                                                                <i className="bi bi-check-circle me-1"></i>APPROVED
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="bi bi-x-circle me-1"></i>REJECTED
                                                            </>
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="text-center text-muted py-4 small">
                                                No cancelled days or leave records found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-warning-subtle text-dark border-bottom">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>Submit Cancellation for Approval
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    disabled={isCancelling}
                                    onClick={() => setShowConfirmModal(false)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
                                <p className="mb-3">
                                    You are requesting a schedule cancellation for:
                                </p>
                                <div className="p-3 bg-light rounded border mb-3">
                                    <div className="fw-bold fs-6 text-dark">
                                        {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
                                    </div>
                                    <div className="text-muted small mt-1">
                                        Reason: <strong>{activeReason}</strong>
                                    </div>
                                </div>

                                <div className="alert alert-info py-2 px-3 small mb-3">
                                    <i className="bi bi-info-circle-fill me-1"></i>
                                    <strong>Admin Approval Required:</strong> This request will have status <strong>PENDING</strong> until approved by Hospital Administration. Booked patient appointments (total {impactData?.totalAppointments || 0}) remain active until the request is officially approved.
                                </div>
                            </div>
                            <div className="modal-footer d-flex justify-content-between">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary"
                                    disabled={isCancelling}
                                    onClick={() => setShowConfirmModal(false)}
                                >
                                    Back
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-warning fw-bold px-4 text-dark"
                                    disabled={isCancelling}
                                    onClick={handleConfirmCancellation}
                                >
                                    {isCancelling ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-send-check me-1"></i>Submit for Admin Approval
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
