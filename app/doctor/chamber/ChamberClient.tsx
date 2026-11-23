'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import UploadDocumentModal from '@/components/UploadDocumentModal';
import { queueAction } from '@/lib/queue/actions';
import { labAction, type TestType } from '@/lib/lab/actions';
import type { StaffSnapshot } from '@/lib/queue/server';
import type { HealthData } from '@/lib/extraction/healthData';

const PRIMARY_COLOR = '#1B2978';
const ACCENT_COLOR = '#3346B5';

const newKey = () => (globalThis.crypto?.randomUUID?.() ?? `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

function calculateAge(dob: string | null | undefined): string {
    if (!dob) return 'N/A';
    try {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return `${age}`;
    } catch {
        return 'N/A';
    }
}

function formatFileSize(bytes?: number | null): string {
    if (!bytes || isNaN(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(val: string | null | undefined): string {
    if (!val) return '—';
    try {
        if (val.includes('T')) {
            return format(parseISO(val), 'h:mm a');
        }
        if (val.includes(':')) {
            const [h, m] = val.split(':');
            const hour = parseInt(h, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const formattedHour = hour % 12 || 12;
            return `${formattedHour}:${m} ${ampm}`;
        }
        return val;
    } catch {
        return val;
    }
}

interface ChamberClientProps {
    doctorId: string;
    doctorName: string;
    activeAppt: any | null;
    patient: any | null;
    records: any[];
    labOrders: any[];
    allVisits: any[];
    health: HealthData;
    snapshot: StaffSnapshot | null;
    allTestTypes: TestType[];
}

export default function ChamberClient({
    doctorId,
    doctorName,
    activeAppt,
    patient,
    records,
    labOrders,
    allVisits,
    health,
    snapshot,
    allTestTypes,
}: ChamberClientProps) {
    const router = useRouter();
    const supabase = createClient();

    // Active Tab in Chamber
    const [activeTab, setActiveTab] = useState<
        'overview' | 'summary' | 'labs' | 'meds' | 'orders' | 'documents' | 'history' | 'profile'
    >('overview');

    // UI State
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [chosenTests, setChosenTests] = useState<string[]>([]);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string; filePath: string } | null>(null);

    // Live Consultation Stopwatch Timer
    const [elapsedSec, setElapsedSec] = useState<number>(0);

    useEffect(() => {
        if (!activeAppt?.consult_started_at) {
            setElapsedSec(0);
            return;
        }
        const startMs = new Date(activeAppt.consult_started_at).getTime();
        const updateTimer = () => {
            const nowMs = Date.now();
            const diff = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            setElapsedSec(diff);
        };
        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [activeAppt?.consult_started_at]);

    const mm = Math.floor(elapsedSec / 60);
    const ss = elapsedSec % 60;
    const targetMin = activeAppt?.slot_minutes || 10;
    const isOvertime = mm >= targetMin;

    const say = useCallback((kind: 'ok' | 'warn' | 'err', text: string) => {
        setToast({ kind, text });
        setTimeout(() => setToast(null), 4500);
    }, []);

    // Next patient in line from snapshot
    const nextApptId = snapshot?.result?.line?.[0];
    const nextAppt = useMemo(() => {
        if (!nextApptId || !snapshot?.appointments) return null;
        return snapshot.appointments.find((a) => a.id === nextApptId) || null;
    }, [nextApptId, snapshot]);

    // Handle Call Next Patient
    const handleCallNext = async () => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await queueAction({
                kind: 'call_next',
                doctorId,
                expectedCurrent: activeAppt?.id ?? null,
                requestKey: newKey(),
            });
            if (res.ok) {
                say('ok', res.message || 'Next patient called into chamber!');
                router.refresh();
            } else {
                say('warn', res.message || 'Could not call next patient.');
            }
        } catch (e: any) {
            say('err', e.message || 'Failed to call next patient.');
        } finally {
            setBusy(false);
        }
    };

    // Handle Complete Consultation (Done, don't call next)
    const handleEndConsult = async () => {
        if (!activeAppt?.id || busy) return;
        setBusy(true);
        try {
            const res = await queueAction({
                kind: 'end_consult',
                appointmentId: activeAppt.id,
                requestKey: newKey(),
            });
            if (res.ok) {
                say('ok', 'Consultation finished. Chamber is now ready.');
                router.refresh();
            } else {
                say('warn', res.message || 'Could not end consultation.');
            }
        } catch (e: any) {
            say('err', e.message || 'Failed to end consultation.');
        } finally {
            setBusy(false);
        }
    };

    // Handle Call a specific waiting patient into the chamber
    const handleCallSpecific = async (targetApptId: string) => {
        if (busy) return;
        setBusy(true);
        try {
            const res = await queueAction({
                kind: 'call_next',
                doctorId,
                expectedCurrent: activeAppt?.id ?? null,
                requestKey: newKey(),
            });
            if (res.ok) {
                say('ok', 'Patient called into chamber!');
                router.refresh();
            } else {
                say('warn', res.message || 'Failed to call patient.');
            }
        } catch (e: any) {
            say('err', e.message || 'Action failed.');
        } finally {
            setBusy(false);
        }
    };

    // Handle Submit Lab Test Orders
    const handleOrderTestsSubmit = async () => {
        if (!activeAppt?.id || chosenTests.length === 0 || busy) return;
        setBusy(true);
        try {
            const res = await labAction({
                kind: 'order_tests',
                appointmentId: activeAppt.id,
                testTypeIds: chosenTests,
                requestKey: newKey(),
            });
            if (res.ok) {
                say('ok', res.message || `${chosenTests.length} tests ordered successfully!`);
                setChosenTests([]);
                setIsOrderModalOpen(false);
                router.refresh();
            } else {
                say('warn', res.message || 'Could not order tests.');
            }
        } catch (e: any) {
            say('err', e.message || 'Order failed.');
        } finally {
            setBusy(false);
        }
    };

    // Handle Preview Document
    const handleViewDocument = async (filePath: string, title?: string) => {
        try {
            const { data, error } = await supabase.storage.from('medical_documents').createSignedUrl(filePath, 3600);
            if (error || !data?.signedUrl) {
                alert('Could not generate document preview URL: ' + (error?.message || 'File not found'));
                return;
            }
            setPreviewDoc({ url: data.signedUrl, title: title || 'Medical Document', filePath });
        } catch (e: any) {
            alert('Failed to preview document: ' + e.message);
        }
    };

    // Handle Download Document
    const handleDownloadDocument = async (filePath: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage.from('medical_documents').download(filePath);
            if (error || !data) {
                alert('Could not download file: ' + (error?.message || 'File not found'));
                return;
            }
            let downloadName = fileName;
            const extMatch = filePath.match(/\.([^.]+)$/);
            if (extMatch && !fileName.endsWith(extMatch[0])) {
                downloadName += extMatch[0];
            }
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert('Download failed: ' + e.message);
        }
    };

    const patientAge = useMemo(() => calculateAge(patient?.dob), [patient?.dob]);

    return (
        <div className="container-fluid px-1 px-md-3" style={{ maxWidth: 1400 }}>
            {/* Toast Notification */}
            {toast && (
                <div
                    className={`position-fixed top-0 start-50 translate-middle-x mt-4 alert shadow-lg d-flex align-items-center gap-2 px-4 py-2 rounded-pill z-3 ${
                        toast.kind === 'ok'
                            ? 'alert-success border-success'
                            : toast.kind === 'warn'
                            ? 'alert-warning border-warning'
                            : 'alert-danger border-danger'
                    }`}
                    style={{ minWidth: 320 }}
                >
                    <i
                        className={`bi ${
                            toast.kind === 'ok'
                                ? 'bi-check-circle-fill'
                                : toast.kind === 'warn'
                                ? 'bi-exclamation-triangle-fill'
                                : 'bi-x-circle-fill'
                        }`}
                    />
                    <span className="fw-semibold small">{toast.text}</span>
                </div>
            )}

            {/* Top Navigation & Status Bar */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom">
                <div>
                    <div className="d-flex align-items-center gap-2">
                        <span className="badge rounded-pill px-3 py-1" style={{ backgroundColor: '#1B2978', color: '#fff' }}>
                            <i className="bi bi-door-open-fill me-1" /> Chamber Desk
                        </span>
                        <h3 className="m-0 fw-bold" style={{ color: PRIMARY_COLOR }}>
                            Dr. {doctorName}
                        </h3>
                    </div>
                    <p className="text-muted small m-0 mt-1">
                        Live Consultation Room · In-Person Chamber & Clinical EMR Desk
                    </p>
                </div>
                <div className="d-flex align-items-center gap-2">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                        onClick={() => router.refresh()}
                        disabled={busy}
                    >
                        <i className="bi bi-arrow-clockwise me-1" /> Refresh
                    </button>
                    <Link
                        href="/doctor/queue"
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 d-inline-flex align-items-center gap-1"
                    >
                        <i className="bi bi-broadcast" /> Live Queue Desk
                    </Link>
                </div>
            </div>

            {/* ===================== ACTIVE CONSULTATION / EMPTY CHAMBER BANNER ===================== */}
            {activeAppt && patient ? (
                /* Active Patient In Consultation Hero Card */
                <div
                    className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                        borderLeft: `6px solid ${isOvertime ? '#dc3545' : '#10b981'}`,
                    }}
                >
                    <div className="card-body p-3 p-md-4">
                        <div className="row g-3 align-items-center">
                            {/* Patient Avatar & Title */}
                            <div className="col-12 col-lg-7">
                                <div className="d-flex align-items-center gap-3">
                                    <div
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow-sm flex-shrink-0"
                                        style={{
                                            width: 64,
                                            height: 64,
                                            fontSize: 22,
                                            background: 'linear-gradient(135deg, #1B2978 0%, #3346B5 100%)',
                                        }}
                                    >
                                        {patient.full_name
                                            ? patient.full_name
                                                  .split(' ')
                                                  .map((w: string) => w[0])
                                                  .slice(0, 2)
                                                  .join('')
                                                  .toUpperCase()
                                            : 'PT'}
                                    </div>
                                    <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                        <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2 py-1 small fw-semibold">
                                                <span
                                                    className="spinner-grow spinner-grow-sm me-1 text-success"
                                                    style={{ width: '7px', height: '7px' }}
                                                    role="status"
                                                />
                                                IN CHAMBER NOW
                                            </span>
                                            <span className="badge rounded-pill px-2 py-1 text-white fw-bold" style={{ backgroundColor: PRIMARY_COLOR }}>
                                                Serial #{activeAppt.serial_no}
                                            </span>
                                            {activeAppt.visit_reason === 'report_review' && (
                                                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle rounded-pill px-2 py-1 small">
                                                    <i className="bi bi-file-earmark-check me-1" /> Report Review
                                                </span>
                                            )}
                                            {activeAppt.visit_type === 'follow_up' && (
                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-2 py-1 small">
                                                    Follow-Up Visit
                                                </span>
                                            )}
                                            {activeAppt.is_priority && (
                                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-1 small">
                                                    <i className="bi bi-star-fill text-warning me-1" /> Priority
                                                </span>
                                            )}
                                        </div>

                                        <h3 className="fw-bold mb-1 text-truncate" style={{ color: PRIMARY_COLOR }}>
                                            {patient.title ? `${patient.title} ` : ''}
                                            {patient.full_name}
                                        </h3>
                                        <div className="text-muted small d-flex flex-wrap gap-x-3 gap-y-1 align-items-center">
                                            <span>
                                                <strong>UHID:</strong> {patient.uhid || 'N/A'}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <strong>Age/Gender:</strong> {patientAge} yrs, {patient.gender || '—'}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <i className="bi bi-telephone me-1" /> {patient.mobile_no || '—'}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                <i className="bi bi-geo-alt me-1" /> {patient.address || ''} {patient.city || ''}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timer & Primary Actions */}
                            <div className="col-12 col-lg-5">
                                <div className="bg-white rounded-3 p-3 shadow-sm border d-flex flex-wrap align-items-center justify-content-between gap-3">
                                    {/* Stopwatch */}
                                    <div>
                                        <div className="small text-muted text-uppercase fw-semibold" style={{ fontSize: '11px' }}>
                                            Consultation Duration
                                        </div>
                                        <div className="d-flex align-items-baseline gap-2">
                                            <span
                                                className={`font-monospace fs-3 fw-bold ${
                                                    isOvertime ? 'text-danger' : 'text-dark'
                                                }`}
                                            >
                                                <i className="bi bi-stopwatch me-1" />
                                                {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
                                            </span>
                                            <span className="small text-muted">/ ~{targetMin}m target</span>
                                        </div>
                                        {isOvertime && (
                                            <div className="badge bg-danger text-white rounded-pill small mt-1" style={{ fontSize: '10px' }}>
                                                Running overtime
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="d-flex flex-column gap-2 flex-grow-1" style={{ minWidth: 160 }}>
                                        <button
                                            type="button"
                                            className="btn btn-sm py-2 px-3 fw-bold text-white shadow-sm rounded-pill d-flex align-items-center justify-content-center gap-1"
                                            style={{ backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR }}
                                            disabled={busy}
                                            onClick={handleCallNext}
                                        >
                                            <i className="bi bi-megaphone-fill" />
                                            {nextAppt ? `Done · Call #${nextAppt.serialNo}` : 'Done · Call Next'}
                                        </button>
                                        <div className="d-flex gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-secondary rounded-pill flex-grow-1"
                                                disabled={busy}
                                                onClick={handleEndConsult}
                                            >
                                                Done (Finish)
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary rounded-pill flex-grow-1"
                                                onClick={() => setIsOrderModalOpen(true)}
                                            >
                                                <i className="bi bi-droplet-fill me-1 text-primary" /> Tests
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-success rounded-pill"
                                                title="Upload new record/prescription"
                                                onClick={() => setIsUploadOpen(true)}
                                            >
                                                <i className="bi bi-upload" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Empty Chamber State Card */
                <div className="card border-0 shadow-sm rounded-4 mb-4 p-4 text-center bg-white">
                    <div className="py-4">
                        <div
                            className="rounded-circle d-inline-flex align-items-center justify-content-center bg-light text-primary mb-3"
                            style={{ width: 80, height: 80 }}
                        >
                            <i className="bi bi-door-open fs-1" style={{ color: PRIMARY_COLOR }} />
                        </div>
                        <h4 className="fw-bold mb-1" style={{ color: PRIMARY_COLOR }}>
                            Chamber Ready · No Patient Inside
                        </h4>
                        <p className="text-muted small mx-auto mb-4" style={{ maxWidth: 480 }}>
                            The consultation room is currently empty. You can call the next checked-in patient from the waiting line into the chamber now.
                        </p>

                        {nextAppt ? (
                            <div className="card border-1 bg-light rounded-3 p-3 mx-auto shadow-none mb-3" style={{ maxWidth: 460 }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <div className="text-start">
                                        <div className="small text-muted fw-semibold">NEXT PATIENT UP</div>
                                        <div className="fw-bold fs-5" style={{ color: PRIMARY_COLOR }}>
                                            #{nextAppt.serialNo} {nextAppt.patientName}
                                        </div>
                                        <div className="small text-muted">
                                            {nextAppt.patientUhid} · {nextAppt.visitType}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-lg text-white rounded-pill px-4 fw-bold shadow-sm"
                                        style={{ backgroundColor: PRIMARY_COLOR }}
                                        disabled={busy}
                                        onClick={handleCallNext}
                                    >
                                        <i className="bi bi-megaphone-fill me-2" />
                                        Call #{nextAppt.serialNo}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted small">No patients waiting in queue today.</div>
                        )}
                    </div>
                </div>
            )}

            {/* If patient is active, show the full clinical records and details */}
            {activeAppt && patient && (
                <>
                    {/* Navigation Pills Bar */}
                    <div className="d-flex flex-wrap gap-2 mb-4 pb-2 border-bottom">
                        {[
                            { key: 'overview', label: 'Overview & Highlights', icon: 'bi-grid-fill' },
                            { key: 'summary', label: `Vision AI Impression (${health.insights.length})`, icon: 'bi-stars' },
                            { key: 'labs', label: `Lab Test Results (${health.labs.length})`, icon: 'bi-graph-up' },
                            { key: 'meds', label: `Prescriptions & Meds (${health.medications.length})`, icon: 'bi-capsule' },
                            { key: 'orders', label: `Lab Orders (${labOrders.length})`, icon: 'bi-droplet-fill' },
                            { key: 'documents', label: `Medical Files (${records.length})`, icon: 'bi-folder2-open' },
                            { key: 'history', label: `Visit History (${allVisits.length})`, icon: 'bi-clock-history' },
                            { key: 'profile', label: 'Full DB Profile', icon: 'bi-person-lines-fill' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`btn btn-sm rounded-pill px-3 fw-semibold ${
                                    activeTab === tab.key ? 'text-white' : 'btn-outline-secondary bg-white'
                                }`}
                                style={activeTab === tab.key ? { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR } : undefined}
                                onClick={() => setActiveTab(tab.key as any)}
                            >
                                <i className={`bi ${tab.icon} me-1`} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Quick Metric Bar */}
                    <div className="row g-3 mb-4">
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                    <i className="bi bi-file-earmark-check text-primary" /> Active Test Reports
                                </div>
                                <div className="fs-3 fw-bold" style={{ color: PRIMARY_COLOR }}>
                                    {records.filter((r) => r.record_type === 'test_report').length}
                                </div>
                                <div className="small text-muted">Ready in database</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                    <i className="bi bi-capsule text-success" /> Medicines Prescribed
                                </div>
                                <div className="fs-3 fw-bold text-success">{health.medications.length}</div>
                                <div className="small text-muted">Active & past items</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                    <i className="bi bi-graph-up text-info" /> Measured Analytes
                                </div>
                                <div className="fs-3 fw-bold text-info">{health.labs.length}</div>
                                <div className="small text-muted">Extracted readings</div>
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm rounded-3 p-3 bg-white h-100">
                                <div className="small text-muted d-flex align-items-center gap-1">
                                    <i className="bi bi-calendar-check text-warning" /> Total Clinic Visits
                                </div>
                                <div className="fs-3 fw-bold text-warning">{allVisits.length}</div>
                                <div className="small text-muted">Lifetime appointments</div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Layout (Left: Selected Clinical Area, Right: Demographics & Context) */}
                    <div className="row g-4">
                        {/* ================= LEFT COLUMN ================= */}
                        <div className="col-12 col-xl-8">
                            {/* TAB: OVERVIEW */}
                            {activeTab === 'overview' && (
                                <div className="d-flex flex-column gap-4">
                                    {/* Vision AI Highlight Card */}
                                    {health.insights.length > 0 && (
                                        <div
                                            className="card border-0 shadow-sm rounded-4 p-4 text-white position-relative overflow-hidden"
                                            style={{ background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}
                                        >
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge rounded-pill bg-primary px-3 py-1">
                                                        <i className="bi bi-stars me-1" /> Vision AI Clinical Impression
                                                    </span>
                                                    <span className="small text-white-50">Multimodal Verified</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-light rounded-pill px-3"
                                                    onClick={() => handleViewDocument(records[0]?.file_path, records[0]?.title)}
                                                >
                                                    <i className="bi bi-eye me-1" /> View Original Scanned Document
                                                </button>
                                            </div>
                                            <blockquote className="blockquote fs-6 text-light my-2 fst-italic">
                                                "{health.insights[0].summary}"
                                            </blockquote>
                                            {health.insights[0].abnormal_findings?.length > 0 && (
                                                <div className="d-flex flex-wrap gap-2 mt-2">
                                                    {health.insights[0].abnormal_findings.map((f: string, idx: number) => (
                                                        <span key={idx} className="badge bg-warning text-dark rounded-pill">
                                                            {f}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Test Results & Analyte Trends Preview */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                                <i className="bi bi-graph-up me-2" /> Extracted Test Results & Analytes
                                            </h5>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none fw-semibold"
                                                onClick={() => setActiveTab('labs')}
                                            >
                                                View all ({health.labs.length}) →
                                            </button>
                                        </div>

                                        {health.labs.length === 0 ? (
                                            <p className="text-muted small m-0">No lab analytes extracted yet.</p>
                                        ) : (
                                            <div className="row g-3">
                                                {health.labs.slice(0, 6).map((l) => (
                                                    <div key={l.id} className="col-12 col-md-4">
                                                        <div className="border rounded-3 p-3 bg-light h-100">
                                                            <div className="small text-muted">{l.test_name || 'Lab Reading'}</div>
                                                            <div className="fw-bold fs-6 text-truncate" title={l.analyte}>
                                                                {l.analyte}
                                                            </div>
                                                            <div className="d-flex align-items-baseline gap-1 my-1">
                                                                <span className="fs-5 fw-bold" style={{ color: PRIMARY_COLOR }}>
                                                                    {l.value_num ?? l.value_text ?? '—'}
                                                                </span>
                                                                {l.unit && <span className="small text-muted">{l.unit}</span>}
                                                            </div>
                                                            <div className="small text-muted" style={{ fontSize: '11px' }}>
                                                                Ref: {l.ref_text || (l.ref_low != null && l.ref_high != null ? `${l.ref_low} - ${l.ref_high}` : 'Standard')}
                                                            </div>
                                                            <div className="mt-2 pt-1 border-top d-flex justify-content-between align-items-center">
                                                                <span className="badge bg-success-subtle text-success small">Verified</span>
                                                                {records.find((r) => r.id === l.record_id)?.file_path && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-link p-0 text-decoration-none small"
                                                                        style={{ fontSize: '11px' }}
                                                                        onClick={() =>
                                                                            handleViewDocument(
                                                                                records.find((r) => r.id === l.record_id)!.file_path,
                                                                                l.analyte
                                                                            )
                                                                        }
                                                                    >
                                                                        <i className="bi bi-file-earmark-text me-1" />
                                                                        Source
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Prescribed Medications Card */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                                <i className="bi bi-capsule me-2" /> Prescribed Medications
                                            </h5>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-link text-decoration-none fw-semibold"
                                                onClick={() => setActiveTab('meds')}
                                            >
                                                Full list ({health.medications.length}) →
                                            </button>
                                        </div>

                                        {health.medications.length === 0 ? (
                                            <p className="text-muted small m-0">No prescribed medications recorded.</p>
                                        ) : (
                                            <div className="table-responsive">
                                                <table className="table table-sm table-hover align-middle mb-0 small">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Medication</th>
                                                            <th>Dosage / Frequency</th>
                                                            <th>Strength</th>
                                                            <th>Instructions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {health.medications.slice(0, 4).map((m) => (
                                                            <tr key={m.id}>
                                                                <td className="fw-bold">{[m.form, m.drug_name].filter(Boolean).join(' ')}</td>
                                                                <td>{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}</td>
                                                                <td>{m.strength || '—'}</td>
                                                                <td className="text-muted">{m.instructions || 'As directed'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    {/* Diagnostic Lab Orders Tracker */}
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                                <i className="bi bi-droplet-fill me-2 text-primary" /> Active Lab Investigations
                                            </h5>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                onClick={() => setIsOrderModalOpen(true)}
                                            >
                                                <i className="bi bi-plus-circle me-1" /> Order New Tests
                                            </button>
                                        </div>

                                        {labOrders.length === 0 ? (
                                            <p className="text-muted small m-0">No lab investigations ordered for this patient yet.</p>
                                        ) : (
                                            <div className="d-flex flex-column gap-2">
                                                {labOrders.map((ord) => (
                                                    <div
                                                        key={ord.id}
                                                        className="p-3 border rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-2"
                                                    >
                                                        <div>
                                                            <div className="fw-bold text-dark">{ord.test_type?.name || 'Lab Test'}</div>
                                                            <div className="small text-muted">
                                                                Ordered: {ord.order_date} · Turnaround: ~{ord.test_type?.turnaround_min || 120} min
                                                                {ord.test_type?.must_first ? ' · Fasting required' : ''}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {ord.status === 'report_ready' ? (
                                                                <>
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill">
                                                                        <i className="bi bi-check-circle-fill me-1" /> Report Ready
                                                                    </span>
                                                                    {records.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                                            onClick={() => handleViewDocument(records[0].file_path, ord.test_type?.name)}
                                                                        >
                                                                            <i className="bi bi-file-earmark-text me-1" /> View Report
                                                                        </button>
                                                                    )}
                                                                </>
                                                            ) : ord.status === 'collected' ? (
                                                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill">
                                                                    Sample Taken
                                                                </span>
                                                            ) : (
                                                                <span className="badge bg-secondary-subtle text-secondary px-3 py-1 rounded-pill">
                                                                    {ord.status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: VISION AI IMPRESSION */}
                            {activeTab === 'summary' && (
                                <div className="d-flex flex-column gap-4">
                                    <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                        <h5 className="fw-bold mb-3" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-stars me-2 text-warning" /> Multimodal Vision AI Diagnostic Impressions
                                        </h5>
                                        {health.insights.length === 0 ? (
                                            <div className="p-4 text-center text-muted">No vision report insights generated yet.</div>
                                        ) : (
                                            <div className="d-flex flex-column gap-4">
                                                {health.insights.map((ins, i) => (
                                                    <div key={i} className="p-4 rounded-3 border bg-light">
                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                            <span className="badge bg-primary text-white rounded-pill px-3 py-1">
                                                                Report Extract #{i + 1}
                                                            </span>
                                                            <span className="small text-muted">{formatTime(ins.created_at)}</span>
                                                        </div>
                                                        <p className="fs-6 my-2 text-dark">{ins.summary}</p>
                                                        {ins.abnormal_findings?.length > 0 && (
                                                            <div className="mt-3">
                                                                <div className="small fw-semibold text-muted mb-1">Identified Key Findings:</div>
                                                                <div className="d-flex flex-wrap gap-2">
                                                                    {ins.abnormal_findings.map((f: string, fi: number) => (
                                                                        <span key={fi} className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill">
                                                                            {f}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {records[i]?.file_path && (
                                                            <div className="mt-3 pt-2 border-top">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                                    onClick={() => handleViewDocument(records[i].file_path, records[i].title)}
                                                                >
                                                                    <i className="bi bi-eye me-1" /> View Scanned Source Document
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: LAB RESULTS */}
                            {activeTab === 'labs' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-graph-up me-2" /> Extracted Diagnostic Analytes & Lab Results
                                        </h5>
                                        <span className="badge bg-light text-dark border rounded-pill px-3">
                                            {health.labs.length} Readings
                                        </span>
                                    </div>

                                    {health.labs.length === 0 ? (
                                        <p className="text-muted small m-0">No lab analytes recorded.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light small">
                                                    <tr>
                                                        <th>Analyte / Parameter</th>
                                                        <th>Category</th>
                                                        <th>Measured Value</th>
                                                        <th>Normal Reference</th>
                                                        <th>Status / Flag</th>
                                                        <th>Sample Date</th>
                                                        <th>Source</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {health.labs.map((l) => (
                                                        <tr key={l.id}>
                                                            <td className="fw-bold">{l.analyte}</td>
                                                            <td className="small text-muted">{l.test_name || 'Prescription / Lab'}</td>
                                                            <td>
                                                                <span className="fw-bold fs-6" style={{ color: PRIMARY_COLOR }}>
                                                                    {l.value_num ?? l.value_text ?? '—'}
                                                                </span>{' '}
                                                                <span className="small text-muted">{l.unit || ''}</span>
                                                            </td>
                                                            <td className="small text-muted">
                                                                {l.ref_text || (l.ref_low != null && l.ref_high != null ? `${l.ref_low} - ${l.ref_high}` : 'Standard')}
                                                            </td>
                                                            <td>
                                                                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                                                                    {l.flag || 'Normal'}
                                                                </span>
                                                            </td>
                                                            <td className="small text-muted">{l.sample_date || '—'}</td>
                                                            <td>
                                                                {records.find((r) => r.id === l.record_id)?.file_path && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-secondary rounded-pill px-2 py-0"
                                                                        onClick={() =>
                                                                            handleViewDocument(
                                                                                records.find((r) => r.id === l.record_id)!.file_path,
                                                                                l.analyte
                                                                            )
                                                                        }
                                                                    >
                                                                        <i className="bi bi-file-earmark-text" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: MEDICATIONS */}
                            {activeTab === 'meds' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-capsule me-2" /> Prescribed Medications & Orders
                                        </h5>
                                        <span className="badge bg-light text-dark border rounded-pill px-3">
                                            {health.medications.length} Prescriptions
                                        </span>
                                    </div>

                                    {health.medications.length === 0 ? (
                                        <p className="text-muted small m-0">No prescribed medications recorded.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light small">
                                                    <tr>
                                                        <th>Drug Name</th>
                                                        <th>Generic</th>
                                                        <th>Strength & Form</th>
                                                        <th>Dosage & Frequency</th>
                                                        <th>Duration</th>
                                                        <th>Instructions</th>
                                                        <th>Prescribed On</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {health.medications.map((m) => (
                                                        <tr key={m.id}>
                                                            <td className="fw-bold">{m.drug_name}</td>
                                                            <td className="small text-muted">{m.generic_name || '—'}</td>
                                                            <td>
                                                                {[m.form, m.strength].filter(Boolean).join(' ') || '—'}
                                                            </td>
                                                            <td>{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}</td>
                                                            <td>{m.duration || '—'}</td>
                                                            <td className="small text-muted">{m.instructions || '—'}</td>
                                                            <td className="small text-muted">{m.prescribed_on || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: LAB ORDERS */}
                            {activeTab === 'orders' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-droplet-fill me-2 text-primary" /> Diagnostic Investigations & Orders
                                        </h5>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                            onClick={() => setIsOrderModalOpen(true)}
                                        >
                                            <i className="bi bi-plus-circle me-1" /> Order Tests
                                        </button>
                                    </div>

                                    {labOrders.length === 0 ? (
                                        <p className="text-muted small m-0">No lab orders found.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light small">
                                                    <tr>
                                                        <th>Investigation</th>
                                                        <th>Code</th>
                                                        <th>Ordered Date</th>
                                                        <th>Sample Collection</th>
                                                        <th>Turnaround</th>
                                                        <th>Status</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {labOrders.map((ord) => (
                                                        <tr key={ord.id}>
                                                            <td className="fw-bold">{ord.test_type?.name || 'Lab Test'}</td>
                                                            <td>
                                                                <span className="badge bg-light text-dark border">
                                                                    {ord.test_type?.code || 'TEST'}
                                                                </span>
                                                            </td>
                                                            <td className="small text-muted">{ord.order_date}</td>
                                                            <td className="small text-muted">
                                                                {ord.collected_at ? formatTime(ord.collected_at) : 'Pending'}
                                                            </td>
                                                            <td className="small text-muted">
                                                                ~{ord.test_type?.turnaround_min || 120} min
                                                                {ord.test_type?.must_first ? ' (Fasting)' : ''}
                                                            </td>
                                                            <td>
                                                                {ord.status === 'report_ready' ? (
                                                                    <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                                                                        Report Ready
                                                                    </span>
                                                                ) : ord.status === 'collected' ? (
                                                                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill">
                                                                        Sample Taken
                                                                    </span>
                                                                ) : (
                                                                    <span className="badge bg-secondary-subtle text-secondary rounded-pill">
                                                                        {ord.status}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                {records.length > 0 && ord.status === 'report_ready' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-primary rounded-pill px-2 py-1"
                                                                        onClick={() => handleViewDocument(records[0].file_path, ord.test_type?.name)}
                                                                    >
                                                                        <i className="bi bi-file-earmark-text me-1" /> View Report
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: MEDICAL DOCUMENTS */}
                            {activeTab === 'documents' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <h5 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-folder2-open me-2" /> Medical Documents & Uploaded Files
                                        </h5>
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                            onClick={() => setIsUploadOpen(true)}
                                        >
                                            <i className="bi bi-upload me-1" /> Upload Document
                                        </button>
                                    </div>

                                    {records.length === 0 ? (
                                        <p className="text-muted small m-0">No documents uploaded for this patient.</p>
                                    ) : (
                                        <div className="d-flex flex-column gap-3">
                                            {records.map((r) => (
                                                <div
                                                    key={r.id}
                                                    className="p-3 border rounded-3 d-flex flex-wrap align-items-center justify-content-between gap-3 bg-light"
                                                >
                                                    <div className="d-flex align-items-center gap-3">
                                                        <div className="fs-2 text-primary">
                                                            <i
                                                                className={
                                                                    r.file_type?.includes('pdf')
                                                                        ? 'bi bi-file-earmark-pdf text-danger'
                                                                        : 'bi bi-file-earmark-image text-primary'
                                                                }
                                                            />
                                                        </div>
                                                        <div>
                                                            <h6 className="fw-bold mb-1">{r.title}</h6>
                                                            <div className="text-muted small">
                                                                <span className="me-3">
                                                                    <i className="bi bi-tag me-1" />
                                                                    {r.record_type?.replace('_', ' ')}
                                                                </span>
                                                                <span className="me-3">
                                                                    <i className="bi bi-person me-1" />
                                                                    {r.uploader?.role === 'technician' ? 'Lab Staff' : r.uploader?.full_name || 'Staff'}
                                                                </span>
                                                                <span>
                                                                    <i className="bi bi-hdd me-1" />
                                                                    {formatFileSize(r.file_size)}
                                                                </span>
                                                            </div>
                                                            {r.description && <div className="small text-muted mt-1">{r.description}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="d-flex gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-primary rounded-pill px-3"
                                                            onClick={() => handleViewDocument(r.file_path, r.title)}
                                                        >
                                                            <i className="bi bi-eye me-1" /> View
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                                            onClick={() => handleDownloadDocument(r.file_path, r.title)}
                                                        >
                                                            <i className="bi bi-download me-1" /> Download
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: VISIT HISTORY */}
                            {activeTab === 'history' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <h5 className="fw-bold mb-3" style={{ color: PRIMARY_COLOR }}>
                                        <i className="bi bi-clock-history me-2" /> Complete Consultation & Visit History
                                    </h5>
                                    {allVisits.length === 0 ? (
                                        <p className="text-muted small m-0">No past visits recorded.</p>
                                    ) : (
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0">
                                                <thead className="table-light small">
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Serial #</th>
                                                        <th>Consulting Doctor</th>
                                                        <th>Visit Type</th>
                                                        <th>Reason</th>
                                                        <th>Status</th>
                                                        <th>Payment</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {allVisits.map((v) => (
                                                        <tr key={v.id} className={v.id === activeAppt.id ? 'table-primary' : ''}>
                                                            <td className="fw-bold">{v.appointment_date}</td>
                                                            <td>
                                                                <span className="badge rounded-pill bg-secondary">#{v.serial_no}</span>
                                                            </td>
                                                            <td>Dr. {v.doctor?.full_name || 'Clinic Doctor'}</td>
                                                            <td className="text-capitalize">{v.visit_type?.replace('_', ' ')}</td>
                                                            <td className="text-capitalize">{v.visit_reason?.replace('_', ' ') || 'General'}</td>
                                                            <td>
                                                                <span
                                                                    className={`badge rounded-pill ${
                                                                        v.status === 'in_consultation'
                                                                            ? 'bg-success'
                                                                            : v.status === 'completed'
                                                                            ? 'bg-primary'
                                                                            : 'bg-secondary'
                                                                    }`}
                                                                >
                                                                    {v.status?.replace('_', ' ')}
                                                                </span>
                                                            </td>
                                                            <td className="small text-muted">{v.payment_status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: FULL DATABASE PROFILE */}
                            {activeTab === 'profile' && (
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <h5 className="fw-bold mb-3" style={{ color: PRIMARY_COLOR }}>
                                        <i className="bi bi-person-lines-fill me-2" /> Comprehensive Patient Database Record
                                    </h5>
                                    <div className="table-responsive">
                                        <table className="table table-bordered align-middle mb-0">
                                            <thead className="table-light small">
                                                <tr>
                                                    <th style={{ width: '30%' }}>Database Field</th>
                                                    <th>Stored Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Patient ID (UUID)</td>
                                                    <td><code>{patient.id}</code></td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Universal Health ID (UHID)</td>
                                                    <td><strong style={{ color: PRIMARY_COLOR }}>{patient.uhid || '—'}</strong></td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Title & Full Name</td>
                                                    <td>{patient.title ? `${patient.title} ` : ''}{patient.full_name}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Gender</td>
                                                    <td>{patient.gender || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Date of Birth (DOB)</td>
                                                    <td>{patient.dob} (Age: {patientAge} years)</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Father / Guardian Name</td>
                                                    <td>{patient.father_name || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Primary Mobile Number</td>
                                                    <td>{patient.mobile_no || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Email Address</td>
                                                    <td>{patient.email || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Residential Address</td>
                                                    <td>{patient.address || '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">City / District</td>
                                                    <td>{patient.city || 'Dhaka'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Country</td>
                                                    <td>{patient.country || 'Bangladesh'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Record Created In DB</td>
                                                    <td>{patient.created_at ? format(parseISO(patient.created_at), 'PPP p') : '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="fw-semibold text-muted">Associated Auth User ID</td>
                                                    <td><code>{patient.auth_user_id || '—'}</code></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ================= RIGHT COLUMN (PATIENT SNAPSHOT & WAITING QUEUE) ================= */}
                        <div className="col-12 col-xl-4">
                            <div className="d-flex flex-column gap-4">
                                {/* Demographics & Contact Card */}
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <h6 className="fw-bold mb-3" style={{ color: PRIMARY_COLOR }}>
                                        <i className="bi bi-person-badge me-2" /> Patient Profile
                                    </h6>
                                    <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Full Name:</span>
                                            <span className="fw-bold">{patient.full_name}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">UHID:</span>
                                            <span className="font-monospace fw-semibold">{patient.uhid}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Age / Sex:</span>
                                            <span>
                                                {patientAge} yrs, {patient.gender}
                                            </span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">DOB:</span>
                                            <span>{patient.dob || '—'}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Mobile:</span>
                                            <span>{patient.mobile_no || '—'}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Email:</span>
                                            <span className="text-truncate" style={{ maxWidth: 170 }}>
                                                {patient.email || '—'}
                                            </span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Guardian:</span>
                                            <span>{patient.father_name || '—'}</span>
                                        </li>
                                        <li className="pt-2 border-top">
                                            <span className="text-muted d-block mb-1">Address:</span>
                                            <span className="fw-semibold">
                                                {patient.address}, {patient.city}
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Current Visit Details */}
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <h6 className="fw-bold mb-3" style={{ color: PRIMARY_COLOR }}>
                                        <i className="bi bi-info-circle me-2" /> Current Chamber Visit
                                    </h6>
                                    <ul className="list-unstyled mb-0 d-flex flex-column gap-2 small">
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Serial No:</span>
                                            <span className="fw-bold fs-6" style={{ color: PRIMARY_COLOR }}>
                                                #{activeAppt.serial_no}
                                            </span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Visit Type:</span>
                                            <span className="badge bg-light text-dark border text-capitalize">
                                                {activeAppt.visit_type?.replace('_', ' ')}
                                            </span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Reason:</span>
                                            <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle text-capitalize">
                                                {activeAppt.visit_reason?.replace('_', ' ')}
                                            </span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Source:</span>
                                            <span className="text-capitalize">{activeAppt.visit_source}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Checked In:</span>
                                            <span>{formatTime(activeAppt.checked_in_at)}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Consult Started:</span>
                                            <span>{formatTime(activeAppt.consult_started_at)}</span>
                                        </li>
                                        <li className="d-flex justify-content-between">
                                            <span className="text-muted">Payment Status:</span>
                                            <span className="badge bg-secondary-subtle text-secondary text-capitalize">
                                                {activeAppt.payment_status}
                                            </span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Next Up Waiting Card */}
                                <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <h6 className="fw-bold m-0" style={{ color: PRIMARY_COLOR }}>
                                            <i className="bi bi-people me-2" /> Next In Queue
                                        </h6>
                                        <Link href="/doctor/queue" className="small text-decoration-none">
                                            View all →
                                        </Link>
                                    </div>
                                    {nextAppt ? (
                                        <div className="p-3 bg-light rounded-3">
                                            <div className="d-flex align-items-center justify-content-between">
                                                <div>
                                                    <div className="fw-bold" style={{ color: PRIMARY_COLOR }}>
                                                        #{nextAppt.serialNo} {nextAppt.patientName}
                                                    </div>
                                                    <div className="small text-muted">
                                                        {nextAppt.patientUhid} · {nextAppt.visitType}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary rounded-pill px-3"
                                                    disabled={busy}
                                                    onClick={() => handleCallSpecific(nextAppt.id)}
                                                >
                                                    Call Next
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted small m-0">No waiting patients in queue.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ===================== DOCUMENT PREVIEW MODAL ===================== */}
            {previewDoc && (
                <div
                    className="modal show d-block"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }}
                    tabIndex={-1}
                >
                    <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header text-white" style={{ backgroundColor: PRIMARY_COLOR }}>
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-file-earmark-medical me-2" />
                                    {previewDoc.title}
                                </h5>
                                <div className="d-flex align-items-center gap-2">
                                    <a
                                        href={previewDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-sm btn-outline-light rounded-pill px-3"
                                    >
                                        <i className="bi bi-box-arrow-up-right me-1" /> Open in New Tab
                                    </a>
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-outline-light rounded-pill px-3"
                                        onClick={() => handleDownloadDocument(previewDoc.filePath, previewDoc.title)}
                                    >
                                        <i className="bi bi-download me-1" /> Download
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        onClick={() => setPreviewDoc(null)}
                                        aria-label="Close"
                                    />
                                </div>
                            </div>
                            <div className="modal-body p-0 d-flex justify-content-center align-items-center bg-dark" style={{ minHeight: '70vh' }}>
                                {previewDoc.filePath.toLowerCase().endsWith('.pdf') ? (
                                    <iframe src={previewDoc.url} title="Document Preview" className="w-100 border-0" style={{ height: '75vh' }} />
                                ) : (
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.title}
                                        className="img-fluid p-2"
                                        style={{ maxHeight: '75vh', objectFit: 'contain' }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== ORDER LAB TESTS MODAL ===================== */}
            {isOrderModalOpen && activeAppt && (
                <div
                    className="modal show d-block"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }}
                    tabIndex={-1}
                >
                    <div className="modal-dialog modal-lg modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                            <div className="modal-header text-white" style={{ backgroundColor: PRIMARY_COLOR }}>
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-droplet-fill me-2" /> Order Diagnostic Lab Tests
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setIsOrderModalOpen(false)}
                                    aria-label="Close"
                                />
                            </div>
                            <div className="modal-body p-4">
                                <p className="text-muted small mb-3">
                                    Select the laboratory investigations to order for Serial #{activeAppt.serial_no} (
                                    {patient?.full_name}):
                                </p>
                                <div className="row g-2">
                                    {allTestTypes.map((t) => {
                                        const checked = chosenTests.includes(t.id);
                                        return (
                                            <div key={t.id} className="col-12 col-md-6">
                                                <div
                                                    className={`p-3 border rounded-3 cursor-pointer d-flex align-items-center gap-3 ${
                                                        checked ? 'border-primary bg-primary-subtle' : 'bg-light'
                                                    }`}
                                                    onClick={() =>
                                                        setChosenTests((prev) =>
                                                            checked ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                                                        )
                                                    }
                                                    style={{ cursor: 'pointer' }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input flex-shrink-0"
                                                        checked={checked}
                                                        onChange={() => {}} // handled by parent div
                                                    />
                                                    <div className="flex-grow-1">
                                                        <div className="fw-bold small">{t.name}</div>
                                                        <div className="small text-muted" style={{ fontSize: '11px' }}>
                                                            {t.code?.toUpperCase()} · ~{t.turnaround_min || 120} min
                                                            {t.must_first ? ' · Fasting required' : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="modal-footer bg-light">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                                    onClick={() => setIsOrderModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-sm text-white rounded-pill px-4 fw-bold"
                                    style={{ backgroundColor: PRIMARY_COLOR }}
                                    disabled={busy || chosenTests.length === 0}
                                    onClick={handleOrderTestsSubmit}
                                >
                                    {busy ? (
                                        'Submitting...'
                                    ) : (
                                        <>
                                            <i className="bi bi-check2-circle me-1" /> Order {chosenTests.length} Selected Test
                                            {chosenTests.length === 1 ? '' : 's'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload Document Modal */}
            {patient && (
                <UploadDocumentModal
                    isOpen={isUploadOpen}
                    onClose={() => setIsUploadOpen(false)}
                    patients={[patient]}
                    visits={allVisits}
                    defaultPatientId={patient.id}
                    uploaderRole="doctor"
                    onSuccess={() => {
                        setIsUploadOpen(false);
                        say('ok', 'Document uploaded successfully!');
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}
