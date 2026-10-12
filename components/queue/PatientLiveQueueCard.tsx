'use client';
import React, { useEffect, useState } from 'react';
import { QueueEstimate } from '@/lib/queue/decisionSupport';

export default function PatientLiveQueueCard({
    appointmentId,
    initialData
}: {
    appointmentId: string;
    initialData?: QueueEstimate | null;
}) {
    const [estimate, setEstimate] = useState<QueueEstimate | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

    const fetchEstimate = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/queue/estimate?appointment_id=${appointmentId}`);
            const data = await res.json();
            if (data.success) {
                setEstimate(data);
                setLastRefreshed(new Date());
            } else {
                setError(data.error || 'Failed to fetch queue estimate');
            }
        } catch (err: any) {
            setError(err?.message || 'Error connecting to queue service');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEstimate();
        // Poll every 20 seconds for live serial updates
        const interval = setInterval(fetchEstimate, 20000);
        return () => clearInterval(interval);
    }, [appointmentId]);

    if (error) {
        return (
            <div className="card border-0 shadow-sm rounded-3 mb-4 p-3 bg-light">
                <div className="d-flex align-items-center justify-content-between">
                    <div className="text-danger small">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Unable to load live queue: {error}
                    </div>
                    <button className="btn btn-sm btn-outline-secondary" onClick={fetchEstimate}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!estimate && loading) {
        return (
            <div className="card border-0 shadow-sm rounded-3 mb-4 p-4 text-center">
                <div className="spinner-border text-primary mx-auto mb-2" role="status" style={{ width: '2rem', height: '2rem' }}></div>
                <small className="text-muted">Calculating real-time queue estimation & doctor schedule...</small>
            </div>
        );
    }

    if (!estimate) return null;

    const isCurrent = estimate.status === 'in_consultation';
    const isCompleted = estimate.status === 'completed';

    // Urgency colors
    const urgencyBadgeStyle = {
        immediate: { bg: '#dc3545', text: '#fff', label: 'Arrive / Wait in Lobby Now' },
        near: { bg: '#fd7e14', text: '#fff', label: 'Heading to Clinic Recommended' },
        comfortable: { bg: '#198754', text: '#fff', label: 'Comfortable Time at Home' },
    }[estimate.urgencyLevel] || { bg: '#0D7D72', text: '#fff', label: 'Normal' };

    return (
        <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden" style={{ border: '1.5px solid #0D7D72' }}>
            {/* Header Ribbon */}
            <div
                className="card-header text-white px-4 py-3 d-flex justify-content-between align-items-center"
                style={{ backgroundColor: '#0D7D72' }}
            >
                <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-broadcast-pin fs-5 text-warning animate-pulse"></i>
                    <div>
                        <h5 className="m-0 fw-bold">Live Queue & Smart Arrival Assistant</h5>
                        <small className="opacity-75">
                            Real-time Decision Support · Reducing clinic waiting room congestion
                        </small>
                    </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-white text-dark small px-2 py-1">
                        Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                        className="btn btn-sm btn-outline-light border-0"
                        onClick={fetchEstimate}
                        disabled={loading}
                        title="Refresh live queue"
                    >
                        <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
                    </button>
                </div>
            </div>

            <div className="card-body p-4">
                {/* Doctor Chamber Status Bar */}
                <div className="p-3 rounded-3 mb-3" style={{ backgroundColor: '#f0fdf9', border: '1px solid #cceee8' }}>
                    <div className="row align-items-center g-2">
                        <div className="col-md-7">
                            <div className="d-flex align-items-center gap-2">
                                <span className={`badge ${
                                    estimate.chamberStatus === 'open' ? 'bg-success' :
                                    estimate.chamberStatus === 'paused' ? 'bg-warning text-dark' : 'bg-secondary'
                                } px-3 py-2 fw-bold`}>
                                    {estimate.chamberStatus === 'open' ? 'CHAMBER ACTIVE' :
                                     estimate.chamberStatus === 'paused' ? 'ON BREAK' : 'NOT STARTED'}
                                </span>
                                <div>
                                    <div className="fw-bold text-dark">Dr. {estimate.doctorName}</div>
                                    <small className="text-muted">{estimate.specialityName}</small>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-5 text-md-end">
                            <small className="text-muted d-block">
                                Scheduled: <strong>{estimate.scheduledStartTime}</strong>
                                {estimate.actualStartTime && (
                                    <> · Started: <strong>{estimate.actualStartTime}</strong></>
                                )}
                            </small>
                            {estimate.delayMinutes > 0 && (
                                <span className="badge bg-danger-subtle text-danger border border-danger-subtle small fw-semibold mt-1">
                                    <i className="bi bi-clock-history me-1"></i>
                                    Delayed by ~{estimate.delayMinutes} mins
                                    {estimate.delayReason ? ` (${estimate.delayReason})` : ''}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Decision Support Estimation Display */}
                {!isCompleted && !isCurrent ? (
                    <>
                        <div className="row g-3 mb-3">
                            {/* Serial and Queue Position */}
                            <div className="col-md-4">
                                <div className="card h-100 border-0 bg-light rounded-3 p-3 text-center">
                                    <small className="text-muted fw-bold text-uppercase">Your Serial Number</small>
                                    <div className="display-5 fw-bold text-dark my-1">
                                        #{estimate.serialNo}
                                    </div>
                                    <div className="small text-muted">
                                        Currently Serving:{' '}
                                        <strong className="text-primary">
                                            {estimate.currentlyServingSerial ? `#${estimate.currentlyServingSerial}` : 'Waiting to start'}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Estimated Wait Time */}
                            <div className="col-md-4">
                                <div className="card h-100 border-0 rounded-3 p-3 text-center" style={{ backgroundColor: '#eef8f6' }}>
                                    <small className="text-muted fw-bold text-uppercase" style={{ color: '#0D7D72' }}>
                                        Estimated Wait Time
                                    </small>
                                    <div className="display-5 fw-bold my-1" style={{ color: '#0D7D72' }}>
                                        ~{estimate.estimatedWaitMinutes} <span className="fs-6 fw-normal">min</span>
                                    </div>
                                    <div className="small text-muted">
                                        {estimate.patientsAheadTotal} ahead ({estimate.patientsAheadPresent} present in clinic)
                                    </div>
                                </div>
                            </div>

                            {/* Safe Recommended Arrival Time */}
                            <div className="col-md-4">
                                <div className="card h-100 border-0 rounded-3 p-3 text-center" style={{ backgroundColor: '#fff8eb', border: '1px solid #ffeeba' }}>
                                    <small className="text-warning-emphasis fw-bold text-uppercase">
                                        Recommended Arrival
                                    </small>
                                    <div className="display-5 fw-bold text-warning-emphasis my-1">
                                        {estimate.recommendedArrivalTime}
                                    </div>
                                    <div className="small text-muted">
                                        Includes {estimate.safetyBufferMinutes}m safe buffer
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Urgency Guidance Banner */}
                        <div
                            className="p-3 rounded-3 d-flex align-items-center gap-3 text-white"
                            style={{ backgroundColor: urgencyBadgeStyle.bg }}
                        >
                            <i className="bi bi-info-circle-fill fs-4"></i>
                            <div>
                                <div className="fw-bold">{urgencyBadgeStyle.label}</div>
                                <small>{estimate.recommendationMessage}</small>
                            </div>
                        </div>
                    </>
                ) : isCurrent ? (
                    <div className="p-4 rounded-3 text-center bg-primary-subtle text-primary border border-primary-subtle">
                        <i className="bi bi-door-open-fill display-4 mb-2"></i>
                        <h4 className="fw-bold">You are currently with the doctor</h4>
                        <p className="mb-0">Serial #{estimate.serialNo} is currently in consultation.</p>
                    </div>
                ) : (
                    <div className="p-4 rounded-3 text-center bg-success-subtle text-success border border-success-subtle">
                        <i className="bi bi-check-circle-fill display-4 mb-2"></i>
                        <h4 className="fw-bold">Consultation Completed</h4>
                        <p className="mb-0">Thank you for visiting LabAid. Your visit was completed successfully.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
