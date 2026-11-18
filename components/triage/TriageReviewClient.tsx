'use client';

import React, { useState } from 'react';
import {
    Activity,
    ShieldAlert,
    Clock,
    CheckCircle2,
    Search,
    Filter,
    Paperclip,
    ChevronRight,
    User,
    Calendar,
    X,
    FileText,
    Bot,
    Save,
    Send
} from 'lucide-react';
import ConversationTranscriptViewer, { TranscriptTurn, EvidenceItem } from '@/components/chat/ConversationTranscriptViewer';
import { formatDateTime } from '@/lib/format';

export interface TriageIntakeItem {
    id: string;
    triage_ref: string;
    patient_id?: string;
    patient_name?: string;
    patient_phone?: string;
    patient_mrn?: string;
    conversation_id: string;
    symptom_summary: string;
    severity: 'mild' | 'moderate' | 'urgent' | 'immediate_review';
    duration_days: number;
    has_file_attachment: boolean;
    status: 'pending_review' | 'under_review' | 'reviewed' | 'escalated' | 'resolved';
    triage_protocol?: string;
    escalated_to_nurse?: boolean;
    nurse_urgency_reason?: string;
    transcript?: TranscriptTurn[];
    raw_transcript?: string;
    sync_status?: string;
    doctor_notes?: string;
    created_at: string;
    attachments?: EvidenceItem[];
}

interface TriageReviewClientProps {
    initialIntakes: TriageIntakeItem[];
}

export default function TriageReviewClient({ initialIntakes }: TriageReviewClientProps) {
    const [intakes, setIntakes] = useState<TriageIntakeItem[]>(initialIntakes);
    const [selectedIntake, setSelectedIntake] = useState<TriageIntakeItem | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [doctorNoteInput, setDoctorNoteInput] = useState('');
    const [searchFilter, setSearchFilter] = useState('');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    // Metrics computation
    const metrics = React.useMemo(() => {
        const total = intakes.length;
        const urgent = intakes.filter(
            (i) => i.severity === 'urgent' || i.severity === 'immediate_review' || i.escalated_to_nurse
        ).length;
        const pending = intakes.filter((i) => i.status === 'pending_review' || i.status === 'under_review').length;
        const reviewed = intakes.filter((i) => i.status === 'reviewed' || i.status === 'resolved').length;
        return { total, urgent, pending, reviewed };
    }, [intakes]);

    // Filtered data table
    const filteredIntakes = React.useMemo(() => {
        return intakes.filter((item) => {
            if (severityFilter !== 'all' && item.severity !== severityFilter) {
                return false;
            }
            if (statusFilter !== 'all' && item.status !== statusFilter) {
                return false;
            }
            if (searchFilter.trim()) {
                const q = searchFilter.toLowerCase();
                return (
                    item.triage_ref?.toLowerCase().includes(q) ||
                    item.patient_name?.toLowerCase().includes(q) ||
                    item.patient_mrn?.toLowerCase().includes(q) ||
                    item.symptom_summary?.toLowerCase().includes(q) ||
                    item.conversation_id?.toLowerCase().includes(q)
                );
            }
            return true;
        });
    }, [intakes, severityFilter, statusFilter, searchFilter]);

    const handleOpenDrawer = (intake: TriageIntakeItem) => {
        setSelectedIntake(intake);
        setDoctorNoteInput(intake.doctor_notes || '');
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
    };

    // Manual sync with ElevenLabs
    const handleSyncSession = async () => {
        if (!selectedIntake) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/triage/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: selectedIntake.conversation_id,
                    intake_id: selectedIntake.id
                })
            });
            const data = await res.json();
            if (data.success && data.transcript) {
                const updatedItem: TriageIntakeItem = {
                    ...selectedIntake,
                    transcript: data.transcript,
                    sync_status: 'settled',
                    has_file_attachment: data.attachmentsCount > 0
                };
                setSelectedIntake(updatedItem);
                setIntakes((prev) => prev.map((item) => (item.id === updatedItem.id ? updatedItem : item)));
            }
        } catch (err) {
            console.error('Error syncing session:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    // Update triage status
    const handleUpdateStatus = (newStatus: TriageIntakeItem['status']) => {
        if (!selectedIntake) return;
        const updated: TriageIntakeItem = {
            ...selectedIntake,
            status: newStatus,
            doctor_notes: doctorNoteInput
        };
        setSelectedIntake(updated);
        setIntakes((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    };

    const getSeverityBadge = (sev: string) => {
        switch (sev) {
            case 'immediate_review':
            case 'urgent':
                return 'bg-danger text-white';
            case 'moderate':
                return 'bg-warning text-dark';
            case 'mild':
                return 'bg-success text-white';
            default:
                return 'bg-secondary text-white';
        }
    };

    return (
        <div className="container-fluid py-4 px-md-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
                <div>
                    <h2 className="fw-bold mb-1" style={{ color: '#1B2978' }}>
                        <Bot className="me-2 d-inline" size={28} />
                        Aura Clinical Triage & Intake Portal
                    </h2>
                    <p className="text-muted small mb-0">
                        24/7 AI-Assisted Patient Symptom Triage, Nurse Escalations & Multimodal Review Desk
                    </p>
                </div>
            </div>

            {/* 1. HIGH-LEVEL METRIC CARDS */}
            <div className="row g-3 mb-4">
                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Total Intakes</span>
                                <h3 className="fw-bold mt-1 mb-0 text-dark">{metrics.total}</h3>
                            </div>
                            <div className="p-3 rounded-circle bg-teal-50 text-teal-800" style={{ backgroundColor: '#e6f5f3', color: '#1B2978' }}>
                                <Activity size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Urgent Cases</span>
                                <h3 className="fw-bold mt-1 mb-0 text-danger">{metrics.urgent}</h3>
                            </div>
                            <div className="p-3 rounded-circle bg-danger bg-opacity-10 text-danger">
                                <ShieldAlert size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Pending Review</span>
                                <h3 className="fw-bold mt-1 mb-0 text-warning">{metrics.pending}</h3>
                            </div>
                            <div className="p-3 rounded-circle bg-warning bg-opacity-10 text-warning">
                                <Clock size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-sm-6 col-xl-3">
                    <div className="card border-0 shadow-sm rounded-3 p-3 h-100 bg-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <span className="text-muted small text-uppercase fw-semibold">Completed / Resolved</span>
                                <h3 className="fw-bold mt-1 mb-0 text-success">{metrics.reviewed}</h3>
                            </div>
                            <div className="p-3 rounded-circle bg-success bg-opacity-10 text-success">
                                <CheckCircle2 size={24} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. INTERACTIVE DATA TABLE */}
            <div className="card border-0 shadow-sm rounded-3 overflow-hidden bg-white mb-4">
                {/* Search & Filters Header */}
                <div className="p-3 border-bottom bg-light d-flex flex-wrap items-center justify-content-between gap-2.5">
                    <div className="input-group" style={{ maxWidth: '340px' }}>
                        <span className="input-group-text bg-white border-end-0">
                            <Search size={15} className="text-muted" />
                        </span>
                        <input
                            type="text"
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            placeholder="Search by Patient, MRN, Ref, or Symptom..."
                            className="form-control form-control-sm border-start-0 ps-0"
                        />
                    </div>

                    <div className="d-flex items-center gap-2">
                        {/* Severity Filter */}
                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="form-select form-select-sm"
                            style={{ width: '150px' }}
                        >
                            <option value="all">All Severities</option>
                            <option value="immediate_review">Immediate Review</option>
                            <option value="urgent">Urgent</option>
                            <option value="moderate">Moderate</option>
                            <option value="mild">Mild</option>
                        </select>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="form-select form-select-sm"
                            style={{ width: '150px' }}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending_review">Pending Review</option>
                            <option value="under_review">Under Review</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="escalated">Escalated</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted small text-uppercase">
                            <tr>
                                <th className="ps-4">Triage Ref</th>
                                <th>Patient Name & MRN</th>
                                <th>Symptom Summary</th>
                                <th>Severity</th>
                                <th>Evidence</th>
                                <th>Date / Time</th>
                                <th>Status</th>
                                <th className="pe-4 text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredIntakes.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-5 text-muted">
                                        No clinical triage intakes found.
                                    </td>
                                </tr>
                            ) : (
                                filteredIntakes.map((intake) => (
                                    <tr key={intake.id} className="cursor-pointer" onClick={() => handleOpenDrawer(intake)}>
                                        <td className="ps-4 font-monospace fw-bold text-dark">
                                            {intake.triage_ref}
                                        </td>
                                        <td>
                                            <div className="fw-bold text-dark">{intake.patient_name || 'Patient'}</div>
                                            <div className="text-muted small font-mono">
                                                MRN: {intake.patient_mrn || 'UHID-PND'}
                                            </div>
                                        </td>
                                        <td>
                                            <p className="text-secondary small mb-0 text-truncate" style={{ maxWidth: '280px' }} title={intake.symptom_summary}>
                                                {intake.symptom_summary}
                                            </p>
                                        </td>
                                        <td>
                                            <span className={`badge px-2 py-1 ${getSeverityBadge(intake.severity)}`}>
                                                {intake.severity.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            {intake.has_file_attachment ? (
                                                <span className="badge bg-teal-50 text-teal-800 border border-teal-200 d-inline-flex align-items-center gap-1" style={{ color: '#1B2978' }}>
                                                    <Paperclip size={12} />
                                                    <span>Reports Attached</span>
                                                </span>
                                            ) : (
                                                <span className="text-muted small">None</span>
                                            )}
                                        </td>
                                        <td className="text-muted small">
                                            {formatDateTime(intake.created_at)}
                                        </td>
                                        <td>
                                            <span className="badge bg-light text-secondary border text-capitalize">
                                                {intake.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="pe-4 text-end">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenDrawer(intake);
                                                }}
                                                className="btn btn-sm btn-outline-primary py-1 px-2.5 d-inline-flex align-items-center gap-1 font-semibold"
                                                style={{ borderColor: '#1B2978', color: '#1B2978' }}
                                            >
                                                <span>Review</span>
                                                <ChevronRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 3. SLIDE-OVER REVIEW DRAWER */}
            {isDrawerOpen && selectedIntake && (
                <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
                    <div
                        className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300"
                        style={{ maxWidth: '820px' }}
                    >
                        {/* Drawer Header */}
                        <div
                            className="p-4 text-white flex items-center justify-between"
                            style={{ backgroundColor: '#1B2978' }}
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="fw-bold mb-0 text-white fs-5">
                                        Clinical Intake: {selectedIntake.triage_ref}
                                    </h4>
                                    <span className={`badge px-2 py-1 ${getSeverityBadge(selectedIntake.severity)}`}>
                                        {selectedIntake.severity.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-teal-100 text-xs mb-0 mt-1">
                                    Patient: <strong>{selectedIntake.patient_name || 'Patient'}</strong> (MRN: {selectedIntake.patient_mrn || 'UHID-PND'}) · Phone: {selectedIntake.patient_phone || 'N/A'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleCloseDrawer}
                                className="text-white/80 hover:text-white p-2 rounded-lg"
                                aria-label="Close Drawer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Scrollable Body */}
                        <div className="p-4 flex-grow overflow-y-auto space-y-4 bg-gray-50/50">
                            {/* Clinical Summary Alert */}
                            <div className="card border-0 shadow-xs rounded-xl p-3 bg-white">
                                <h6 className="fw-bold text-dark mb-1">Reported Symptoms & AI Assessment</h6>
                                <p className="text-secondary small mb-2">{selectedIntake.symptom_summary}</p>
                                <div className="d-flex flex-wrap gap-2 text-xs text-muted">
                                    <span>Duration: <strong>{selectedIntake.duration_days} day(s)</strong></span>
                                    <span>·</span>
                                    <span>Protocol: <strong>{selectedIntake.triage_protocol || 'Emergency Protocol Delta-1'}</strong></span>
                                    {selectedIntake.escalated_to_nurse && (
                                        <>
                                            <span>·</span>
                                            <span className="text-danger fw-bold">Escalated to On-Call Nurse</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Full Dedicated Conversation Transcript Viewer */}
                            <ConversationTranscriptViewer
                                conversationId={selectedIntake.conversation_id}
                                triageRef={selectedIntake.triage_ref}
                                transcript={selectedIntake.transcript || []}
                                evidence={selectedIntake.attachments || []}
                                onSyncSession={handleSyncSession}
                                isSyncing={isSyncing}
                            />

                            {/* Clinician Action / Notes Card */}
                            <div className="card border-0 shadow-xs rounded-xl p-3 bg-white">
                                <h6 className="fw-bold text-dark mb-2">Physician / Clinician Disposition</h6>
                                <textarea
                                    rows={3}
                                    value={doctorNoteInput}
                                    onChange={(e) => setDoctorNoteInput(e.target.value)}
                                    placeholder="Enter clinical assessment, prescription notes, or nurse instructions..."
                                    className="form-control form-control-sm mb-3"
                                />

                                <div className="d-flex flex-wrap items-center justify-between gap-2">
                                    <div className="d-flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus('reviewed')}
                                            className="btn btn-sm btn-success px-3"
                                        >
                                            Mark as Reviewed
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus('escalated')}
                                            className="btn btn-sm btn-danger px-3"
                                        >
                                            Escalate to Emergency
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateStatus('resolved')}
                                            className="btn btn-sm btn-outline-secondary px-3"
                                        >
                                            Resolve
                                        </button>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(selectedIntake.status)}
                                        className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1.5"
                                        style={{ backgroundColor: '#1B2978', borderColor: '#1B2978' }}
                                    >
                                        <Save size={14} />
                                        <span>Save Notes</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

