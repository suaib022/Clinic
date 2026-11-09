'use client';

import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import UploadDocumentModal from '@/components/UploadDocumentModal';

export interface Patient {
    id: string;
    uhid?: string;
    full_name: string;
    gender?: string;
    dob?: string;
    relationship?: string;
    mobile_no?: string;
}

export interface Visit {
    id: string;
    serial_no: number | null;
    appointment_date: string;
    start_time: string;
    status: string;
    patient_id: string;
    doctors?: { id?: string; full_name: string } | null;
}

export interface MedicalRecord {
    id: string;
    patient_id: string;
    doctor_id?: string | null;
    uploaded_by: string;
    record_type: string;
    title: string;
    description?: string | null;
    file_path: string;
    created_at: string;
    document_date: string;
    appointment_id?: string | null;
    file_size?: number | null;
    file_type?: string | null;
    uploader?: { role?: string; full_name?: string } | null;
    doctor?: { full_name?: string } | null;
    appointment?: {
        id: string;
        serial_no: number | null;
        appointment_date: string;
        start_time: string;
        status?: string;
        doctors?: { id?: string; full_name: string } | null;
    } | null;
}

interface Props {
    patients: Patient[];
    visits: Visit[];
    records: MedicalRecord[];
    userId: string;
}

type ViewTab = 'all' | 'timeline' | 'standalone';

export default function RecordsClient({ patients, visits, records, userId }: Props) {
    const supabase = createClient();

    // Filters
    const [selectedPatientId, setSelectedPatientId] = useState<string>('ALL');
    const [selectedVisitId, setSelectedVisitId] = useState<string>('ALL');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [activeTab, setActiveTab] = useState<ViewTab>('all');

    // Upload Modal State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadDefaultPatientId, setUploadDefaultPatientId] = useState<string | undefined>(undefined);
    const [uploadDefaultVisitId, setUploadDefaultVisitId] = useState<string | undefined>(undefined);

    // Patient lookup map
    const patientsMap = useMemo(() => {
        const map = new Map<string, Patient>();
        patients.forEach(p => map.set(p.id, p));
        return map;
    }, [patients]);

    // Count documents per patient
    const patientDocCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        records.forEach(r => {
            counts[r.patient_id] = (counts[r.patient_id] || 0) + 1;
        });
        return counts;
    }, [records]);

    // Count visits per patient
    const patientVisitCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        visits.forEach(v => {
            counts[v.patient_id] = (counts[v.patient_id] || 0) + 1;
        });
        return counts;
    }, [visits]);

    // Unique doctors across visits and records
    const uniqueDoctors = useMemo(() => {
        const docs = new Map<string, string>();
        visits.forEach(v => {
            if (v.doctors?.id && v.doctors.full_name) {
                docs.set(v.doctors.id, v.doctors.full_name);
            }
        });
        records.forEach(r => {
            if (r.doctor_id && r.doctor?.full_name) {
                docs.set(r.doctor_id, r.doctor.full_name);
            }
            if (r.appointment?.doctors?.id && r.appointment.doctors.full_name) {
                docs.set(r.appointment.doctors.id, r.appointment.doctors.full_name);
            }
        });
        return Array.from(docs.entries()).map(([id, name]) => ({ id, name }));
    }, [visits, records]);

    // Available visits for the currently selected patient
    const availableVisits = useMemo(() => {
        if (selectedPatientId === 'ALL') return visits;
        return visits.filter(v => v.patient_id === selectedPatientId);
    }, [visits, selectedPatientId]);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            // Patient filter
            if (selectedPatientId !== 'ALL' && r.patient_id !== selectedPatientId) return false;

            // Visit filter
            if (selectedVisitId === 'NONE') {
                if (r.appointment_id) return false; // Standalone only
            } else if (selectedVisitId !== 'ALL') {
                if (r.appointment_id !== selectedVisitId) return false;
            }

            // Doctor filter
            if (selectedDoctorId !== 'ALL') {
                const linkedDocId = r.doctor_id || r.appointment?.doctors?.id;
                if (linkedDocId !== selectedDoctorId) return false;
            }

            // Category filter
            if (selectedCategory !== 'ALL' && r.record_type !== selectedCategory) return false;

            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const titleMatch = r.title?.toLowerCase().includes(q);
                const descMatch = r.description?.toLowerCase().includes(q);
                const docMatch = r.doctor?.full_name?.toLowerCase().includes(q) || r.appointment?.doctors?.full_name?.toLowerCase().includes(q);
                const uploaderMatch = r.uploader?.full_name?.toLowerCase().includes(q);
                const patientName = patientsMap.get(r.patient_id)?.full_name?.toLowerCase() || '';
                const patientMatch = patientName.includes(q);

                if (!titleMatch && !descMatch && !docMatch && !uploaderMatch && !patientMatch) {
                    return false;
                }
            }

            return true;
        });
    }, [records, selectedPatientId, selectedVisitId, selectedDoctorId, selectedCategory, searchTerm, patientsMap]);

    // Segmented record sets
    const standaloneRecords = useMemo(() => {
        return filteredRecords.filter(r => !r.appointment_id);
    }, [filteredRecords]);

    const visitLinkedRecords = useMemo(() => {
        return filteredRecords.filter(r => !!r.appointment_id);
    }, [filteredRecords]);

    // Group filtered visits for timeline view
    const timelineVisits = useMemo(() => {
        return availableVisits.filter(v => {
            if (selectedDoctorId !== 'ALL' && v.doctors?.id !== selectedDoctorId) return false;
            if (selectedVisitId !== 'ALL' && selectedVisitId !== 'NONE' && v.id !== selectedVisitId) return false;
            return true;
        });
    }, [availableVisits, selectedDoctorId, selectedVisitId]);

    const formatFileSize = (bytes?: number | null) => {
        if (!bytes) return 'N/A';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Human-friendly Uploader Information
    const renderUploaderBadge = (r: MedicalRecord) => {
        const uploaderRole = r.uploader?.role;
        const uploaderName = r.uploader?.full_name;
        const isSelf = r.uploaded_by === userId;

        if (isSelf) {
            return (
                <span className="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1 px-2.5 py-1">
                    <i className="bi bi-person-check-fill"></i>
                    <span>Uploaded by: <strong>Patient (Self / Account Holder)</strong></span>
                </span>
            );
        }

        if (uploaderRole === 'doctor') {
            return (
                <span className="badge bg-primary-subtle text-primary border border-primary-subtle d-inline-flex align-items-center gap-1 px-2.5 py-1">
                    <i className="bi bi-heart-pulse-fill"></i>
                    <span>Uploaded by: <strong>Dr. {uploaderName || 'Consulting Doctor'}</strong></span>
                </span>
            );
        }

        if (uploaderRole === 'compounder') {
            return (
                <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle d-inline-flex align-items-center gap-1 px-2.5 py-1">
                    <i className="bi bi-person-badge-fill"></i>
                    <span>Uploaded by: <strong>Clinic Staff / Compounder ({uploaderName || 'Staff'})</strong></span>
                </span>
            );
        }

        if (uploaderRole === 'admin') {
            return (
                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle d-inline-flex align-items-center gap-1 px-2.5 py-1">
                    <i className="bi bi-shield-check"></i>
                    <span>Uploaded by: <strong>Hospital Administration</strong></span>
                </span>
            );
        }

        return (
            <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 px-2.5 py-1">
                <i className="bi bi-person-fill"></i>
                <span>Uploaded by: <strong>{uploaderName || 'Hospital Staff'}</strong></span>
            </span>
        );
    };

    // Category / Record Type Badge
    const renderCategoryBadge = (category: string) => {
        const typeMap: Record<string, { label: string; color: string; icon: string }> = {
            prescription: { label: 'Prescription', color: 'bg-emerald text-white', icon: 'bi-file-earmark-medical' },
            test_report: { label: 'Lab / Test Report', color: 'bg-info text-white', icon: 'bi-clipboard2-pulse' },
            imaging: { label: 'Imaging / X-Ray', color: 'bg-purple text-white', icon: 'bi-camera' },
            discharge_summary: { label: 'Discharge Summary', color: 'bg-warning text-dark', icon: 'bi-file-text' },
            invoice: { label: 'Billing Receipt', color: 'bg-success text-white', icon: 'bi-receipt' },
            other: { label: 'General Document', color: 'bg-secondary text-white', icon: 'bi-file-earmark' }
        };

        const config = typeMap[category] || { label: category.replace('_', ' '), color: 'bg-secondary text-white', icon: 'bi-file-earmark' };

        return (
            <span className={`badge ${config.color} d-inline-flex align-items-center gap-1 px-2.5 py-1 fw-semibold`} style={{ fontSize: '11px' }}>
                <i className={`bi ${config.icon}`}></i>
                <span className="text-capitalize">{config.label}</span>
            </span>
        );
    };

    const handleView = async (path: string) => {
        try {
            const { data, error } = await supabase.storage.from('medical_documents').createSignedUrl(path, 120);
            if (error) {
                alert('Could not open document: ' + error.message);
            } else if (data?.signedUrl) {
                window.open(data.signedUrl, '_blank');
            }
        } catch (err: any) {
            alert('Error viewing document: ' + err.message);
        }
    };

    const handleDownload = async (path: string, fileName: string) => {
        try {
            const { data, error } = await supabase.storage.from('medical_documents').download(path);
            if (error) {
                alert('Could not download file: ' + error.message);
                return;
            }

            let downloadName = fileName;
            const extMatch = path.match(/\.([^.]+)$/);
            if (extMatch && !fileName.endsWith(extMatch[0])) {
                downloadName += extMatch[0];
            }

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err: any) {
            alert('Error downloading: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to permanently delete this document from the vault?')) {
            const { error } = await supabase.from('medical_records').update({ is_deleted: true }).eq('id', id);
            if (error) {
                alert('Failed to delete document: ' + error.message);
            } else {
                window.location.reload();
            }
        }
    };

    const handlePatientCardClick = (patientId: string) => {
        setSelectedPatientId(patientId);
        setSelectedVisitId('ALL'); // Reset visit filter when switching patient
    };

    const handleOpenUploadForPatient = (patientId?: string, visitId?: string) => {
        setUploadDefaultPatientId(patientId || (selectedPatientId !== 'ALL' ? selectedPatientId : undefined));
        setUploadDefaultVisitId(visitId);
        setIsUploadOpen(true);
    };

    // Render single Document Row / Card
    const renderDocumentCard = (r: MedicalRecord) => {
        const patient = patientsMap.get(r.patient_id);
        const isPdf = r.file_type?.includes('pdf') || r.file_path?.endsWith('.pdf');
        const canDelete = r.uploaded_by === userId;

        // Upload timestamp
        let formattedUploadTime = 'Unknown date';
        try {
            formattedUploadTime = format(parseISO(r.created_at), 'MMMM d, yyyy · hh:mm a');
        } catch {
            formattedUploadTime = r.created_at || 'Recently';
        }

        // Document date
        let formattedDocDate = '';
        if (r.document_date) {
            try {
                formattedDocDate = format(parseISO(r.document_date), 'MMMM d, yyyy');
            } catch {
                formattedDocDate = r.document_date;
            }
        }

        return (
            <div key={r.id} className="card border shadow-sm mb-3 rounded-2 overflow-hidden hover-shadow transition-all bg-white">
                <div className="card-body p-3 p-md-4">
                    <div className="row align-items-center g-3">
                        {/* File Icon */}
                        <div className="col-auto">
                            <div 
                                className="d-flex align-items-center justify-content-center rounded-3 p-3"
                                style={{ 
                                    backgroundColor: isPdf ? '#fef2f2' : '#f0fdf4',
                                    color: isPdf ? '#dc2626' : '#16a34a',
                                    width: '56px',
                                    height: '56px'
                                }}
                            >
                                <i className={`bi ${isPdf ? 'bi-file-earmark-pdf fs-2' : 'bi-file-earmark-image fs-2'}`}></i>
                            </div>
                        </div>

                        {/* Document Main Info */}
                        <div className="col">
                            <div className="d-flex align-items-center flex-wrap gap-2 mb-1.5">
                                <h6 className="mb-0 fw-bold text-dark fs-6">{r.title}</h6>
                                {renderCategoryBadge(r.record_type)}
                                
                                {/* Visit Linked vs Standalone Badge */}
                                {r.appointment ? (
                                    <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                        <i className="bi bi-calendar-check text-primary"></i>
                                        <span>
                                            Visit: <strong>{r.appointment.appointment_date}</strong> · Dr. {r.appointment.doctors?.full_name || 'Specialist'} (#{r.appointment.serial_no || '-'})
                                        </span>
                                    </span>
                                ) : (
                                    <span className="badge bg-warning-subtle text-dark border border-warning d-inline-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                        <i className="bi bi-file-earmark-check text-warning"></i>
                                        <span>Standalone Record (Profile Direct Upload · No Visit Linked)</span>
                                    </span>
                                )}
                            </div>

                            {/* Uploader & When - Clearly Highlighted */}
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                {renderUploaderBadge(r)}
                                <span className="small text-muted d-inline-flex align-items-center gap-1">
                                    <i className="bi bi-clock-history text-muted"></i>
                                    <span>Uploaded on: <strong>{formattedUploadTime}</strong></span>
                                </span>
                            </div>

                            {/* Meta Row: Patient, Doc Date, Size, Doctor */}
                            <div className="d-flex flex-wrap align-items-center gap-3 small text-muted">
                                {patient && (
                                    <span>
                                        <i className="bi bi-person me-1 text-secondary"></i>
                                        Patient: <strong className="text-dark">{patient.full_name}</strong> ({patient.uhid})
                                    </span>
                                )}

                                {formattedDocDate && (
                                    <span>
                                        <i className="bi bi-calendar3 me-1 text-secondary"></i>
                                        Document Date: <strong>{formattedDocDate}</strong>
                                    </span>
                                )}

                                {r.doctor?.full_name && (
                                    <span>
                                        <i className="bi bi-heart-pulse me-1 text-secondary"></i>
                                        Doctor: <strong>Dr. {r.doctor.full_name}</strong>
                                    </span>
                                )}

                                <span>
                                    <i className="bi bi-hdd me-1 text-secondary"></i>
                                    Size: <strong>{formatFileSize(r.file_size)}</strong>
                                </span>
                            </div>

                            {/* Description / Clinical Notes if present */}
                            {r.description && (
                                <div className="mt-2 text-muted small bg-light p-2 rounded border">
                                    <i className="bi bi-chat-left-text me-1.5 text-muted"></i>
                                    <span>{r.description}</span>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="col-12 col-md-auto text-md-end mt-2 mt-md-0">
                            <div className="d-flex gap-2 justify-content-end">
                                <button 
                                    type="button"
                                    className="btn btn-sm btn-outline-primary px-3 d-inline-flex align-items-center gap-1 fw-semibold"
                                    onClick={() => handleView(r.file_path)}
                                    title="View Document"
                                >
                                    <i className="bi bi-eye"></i>
                                    <span>View</span>
                                </button>

                                <button 
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary px-2.5 d-inline-flex align-items-center gap-1"
                                    onClick={() => handleDownload(r.file_path, r.title)}
                                    title="Download Document"
                                >
                                    <i className="bi bi-download"></i>
                                    <span className="d-none d-sm-inline">Download</span>
                                </button>

                                {canDelete && (
                                    <button 
                                        type="button"
                                        className="btn btn-sm btn-outline-danger px-2.5"
                                        onClick={() => handleDelete(r.id)}
                                        title="Delete Document"
                                    >
                                        <i className="bi bi-trash"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <div>
                    <h2 className="m-0 fw-bold" style={{ color: '#0D7D72' }}>Medical Records Vault</h2>
                    <p className="text-muted small m-0 mt-1">
                        Central repository for all family members' prescriptions, lab test reports, and clinical documents.
                    </p>
                </div>
                <div className="d-flex gap-2">
                    <button 
                        className="btn btn-sm text-white px-3 py-2 fw-semibold d-inline-flex align-items-center gap-1.5 shadow-sm" 
                        style={{ backgroundColor: '#0D7D72' }} 
                        onClick={() => handleOpenUploadForPatient(selectedPatientId !== 'ALL' ? selectedPatientId : undefined, undefined)}
                    >
                        <i className="bi bi-upload"></i>
                        <span>Upload Document</span>
                    </button>
                    <a href="/patient/records/access-log" className="btn btn-sm btn-outline-secondary px-3 py-2 d-inline-flex align-items-center gap-1.5">
                        <i className="bi bi-shield-check"></i>
                        <span>Access Log</span>
                    </a>
                </div>
            </div>

            {/* SECTION 1: Patient Cards Carousel / Grid (Clicking filters to that patient's documents from the beginning) */}
            <div className="mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-uppercase small text-muted m-0">
                        <i className="bi bi-people-fill me-1.5" style={{ color: '#0D7D72' }}></i>
                        Family Members & Patient Profiles ({patients.length})
                    </h6>
                    <span className="small text-muted">Click any profile to view all documents</span>
                </div>

                <div className="row g-3">
                    {/* All Profiles Summary Card */}
                    <div className="col-12 col-sm-6 col-md-4 col-lg-3">
                        <div 
                            className={`card h-100 border transition-all ${selectedPatientId === 'ALL' ? 'shadow-sm' : ''}`}
                            style={{ 
                                cursor: 'pointer',
                                borderColor: selectedPatientId === 'ALL' ? '#0D7D72' : '#dee2e6',
                                borderWidth: selectedPatientId === 'ALL' ? '2px' : '1px',
                                backgroundColor: selectedPatientId === 'ALL' ? '#f0fdf4' : '#ffffff'
                            }}
                            onClick={() => handlePatientCardClick('ALL')}
                        >
                            <div className="card-body p-3 d-flex flex-column justify-content-between">
                                <div className="d-flex align-items-center gap-2.5 mb-2">
                                    <div 
                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                        style={{ width: '42px', height: '42px', backgroundColor: '#0D7D72', fontSize: '15px' }}
                                    >
                                        <i className="bi bi-collection-fill"></i>
                                    </div>
                                    <div>
                                        <h6 className="m-0 fw-bold text-dark">All Profiles</h6>
                                        <span className="small text-muted">Combined Records</span>
                                    </div>
                                </div>
                                <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-2">
                                    <span className="badge bg-secondary text-white rounded-pill px-2.5">
                                        {records.length} Total Docs
                                    </span>
                                    <span className="badge bg-light text-dark border rounded-pill px-2.5">
                                        {visits.length} Visits
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Individual Patient Cards */}
                    {patients.map(p => {
                        const isSelected = selectedPatientId === p.id;
                        const docCount = patientDocCounts[p.id] || 0;
                        const visitCount = patientVisitCounts[p.id] || 0;
                        const initials = p.full_name
                            .split(' ')
                            .map(n => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                        return (
                            <div key={p.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                <div 
                                    className={`card h-100 border transition-all ${isSelected ? 'shadow-sm' : ''}`}
                                    style={{ 
                                        cursor: 'pointer',
                                        borderColor: isSelected ? '#0D7D72' : '#dee2e6',
                                        borderWidth: isSelected ? '2px' : '1px',
                                        backgroundColor: isSelected ? '#f0fdf4' : '#ffffff'
                                    }}
                                    onClick={() => handlePatientCardClick(p.id)}
                                >
                                    <div className="card-body p-3 d-flex flex-column justify-content-between">
                                        <div>
                                            <div className="d-flex align-items-center justify-content-between mb-2">
                                                <div className="d-flex align-items-center gap-2.5">
                                                    <div 
                                                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                                                        style={{ 
                                                            width: '42px', 
                                                            height: '42px', 
                                                            backgroundColor: isSelected ? '#0D7D72' : '#0ab1a9',
                                                            fontSize: '14px' 
                                                        }}
                                                    >
                                                        {initials || 'PT'}
                                                    </div>
                                                    <div>
                                                        <h6 className="m-0 fw-bold text-dark text-truncate" style={{ maxWidth: '140px' }} title={p.full_name}>
                                                            {p.full_name}
                                                        </h6>
                                                        <span className="badge bg-light text-secondary border" style={{ fontSize: '10px' }}>
                                                            {p.uhid || 'UHID'}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <i className="bi bi-check-circle-fill fs-5" style={{ color: '#0D7D72' }}></i>
                                                )}
                                            </div>

                                            <div className="small text-muted mb-2">
                                                {p.gender && <span className="me-2">{p.gender}</span>}
                                                {p.relationship && <span className="badge bg-light text-muted border">{p.relationship}</span>}
                                            </div>
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-2">
                                            <span className={`badge ${isSelected ? 'bg-success' : 'bg-primary'} text-white rounded-pill px-2.5`}>
                                                {docCount} Docs
                                            </span>
                                            <button 
                                                type="button" 
                                                className="btn btn-xs btn-outline-secondary p-0 px-1.5 py-0.5" 
                                                style={{ fontSize: '11px' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenUploadForPatient(p.id, undefined);
                                                }}
                                                title={`Upload document directly for ${p.full_name}`}
                                            >
                                                <i className="bi bi-plus-lg me-1"></i>Upload
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTION 2: Filter Control Bar */}
            <div className="card border-0 shadow-sm mb-4 bg-white">
                <div className="card-body p-3 p-md-4">
                    <div className="row g-2 g-md-3">
                        {/* Profile Selector */}
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-muted mb-1">Patient Profile</label>
                            <select 
                                className="form-select form-select-sm" 
                                value={selectedPatientId} 
                                onChange={e => handlePatientCardClick(e.target.value)}
                            >
                                <option value="ALL">All Profiles ({patients.length})</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name} ({p.uhid})</option>
                                ))}
                            </select>
                        </div>

                        {/* Visit / Appointment Selector (Allows filtering Standalone or specific visit) */}
                        <div className="col-12 col-sm-6 col-md-3">
                            <label className="form-label small fw-semibold text-muted mb-1">Visit / Consultation</label>
                            <select 
                                className="form-select form-select-sm" 
                                value={selectedVisitId} 
                                onChange={e => setSelectedVisitId(e.target.value)}
                            >
                                <option value="ALL">All Visits & Standalone</option>
                                <option value="NONE">Standalone / Direct Profile (No Visit)</option>
                                {availableVisits.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.appointment_date} · Dr. {v.doctors?.full_name || 'Specialist'} (#{v.serial_no || '-'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Doctor Filter */}
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label small fw-semibold text-muted mb-1">Consulting Doctor</label>
                            <select 
                                className="form-select form-select-sm" 
                                value={selectedDoctorId} 
                                onChange={e => setSelectedDoctorId(e.target.value)}
                            >
                                <option value="ALL">All Doctors</option>
                                {uniqueDoctors.map(d => (
                                    <option key={d.id} value={d.id}>Dr. {d.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Category Filter */}
                        <div className="col-12 col-sm-6 col-md-2">
                            <label className="form-label small fw-semibold text-muted mb-1">Document Type</label>
                            <select 
                                className="form-select form-select-sm" 
                                value={selectedCategory} 
                                onChange={e => setSelectedCategory(e.target.value)}
                            >
                                <option value="ALL">All Document Types</option>
                                <option value="prescription">Prescription</option>
                                <option value="test_report">Lab / Test Report</option>
                                <option value="imaging">Imaging (X-Ray, MRI, USG)</option>
                                <option value="discharge_summary">Discharge Summary</option>
                                <option value="invoice">Billing / Payment Slip</option>
                                <option value="other">General / Other</option>
                            </select>
                        </div>

                        {/* Keyword Search */}
                        <div className="col-12 col-md-2">
                            <label className="form-label small fw-semibold text-muted mb-1">Search</label>
                            <div className="input-group input-group-sm">
                                <input 
                                    type="text" 
                                    className="form-control" 
                                    placeholder="Title, doctor, notes..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)} 
                                />
                                {searchTerm && (
                                    <button 
                                        className="btn btn-outline-secondary" 
                                        type="button" 
                                        onClick={() => setSearchTerm('')}
                                    >
                                        <i className="bi bi-x"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: View Tabs (All Documents, Visits Timeline, Standalone Documents) */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="d-flex gap-2">
                    <button
                        type="button"
                        className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                            activeTab === 'all'
                                ? 'text-white shadow-sm'
                                : 'btn-outline-secondary bg-white text-secondary'
                        }`}
                        style={{ backgroundColor: activeTab === 'all' ? '#0D7D72' : undefined, borderColor: activeTab === 'all' ? '#0D7D72' : undefined }}
                        onClick={() => setActiveTab('all')}
                    >
                        <i className="bi bi-file-earmark-text"></i>
                        <span>All Documents</span>
                        <span className={`badge rounded-pill ${activeTab === 'all' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                            {filteredRecords.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                            activeTab === 'timeline'
                                ? 'text-white shadow-sm'
                                : 'btn-outline-secondary bg-white text-secondary'
                        }`}
                        style={{ backgroundColor: activeTab === 'timeline' ? '#0ab1a9' : undefined, borderColor: activeTab === 'timeline' ? '#0ab1a9' : undefined }}
                        onClick={() => setActiveTab('timeline')}
                    >
                        <i className="bi bi-calendar-event"></i>
                        <span>Visits Timeline</span>
                        <span className={`badge rounded-pill ${activeTab === 'timeline' ? 'bg-white text-dark' : 'bg-primary text-white'}`} style={{ fontSize: '11px' }}>
                            {visitLinkedRecords.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                            activeTab === 'standalone'
                                ? 'text-white shadow-sm'
                                : 'btn-outline-secondary bg-white text-secondary'
                        }`}
                        style={{ backgroundColor: activeTab === 'standalone' ? '#5c636a' : undefined, borderColor: activeTab === 'standalone' ? '#5c636a' : undefined }}
                        onClick={() => setActiveTab('standalone')}
                    >
                        <i className="bi bi-file-earmark-check"></i>
                        <span>Standalone / General</span>
                        <span className={`badge rounded-pill ${activeTab === 'standalone' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                            {standaloneRecords.length}
                        </span>
                    </button>
                </div>

                <div className="small text-muted">
                    Showing <strong>{activeTab === 'all' ? filteredRecords.length : activeTab === 'timeline' ? visitLinkedRecords.length : standaloneRecords.length}</strong> records
                </div>
            </div>

            {/* SECTION 4: Records Content Display */}
            {activeTab === 'all' && (
                <div>
                    {filteredRecords.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded shadow-sm border p-4">
                            <i className="bi bi-folder-x display-4 text-muted mb-3" style={{ color: '#0D7D72' }}></i>
                            <h5 className="text-dark fw-bold">No medical records found</h5>
                            <p className="text-muted small mb-3">
                                {selectedPatientId !== 'ALL' || selectedCategory !== 'ALL' || selectedDoctorId !== 'ALL' || searchTerm
                                    ? 'No documents match the selected filters.'
                                    : 'No medical documents have been uploaded for this account yet.'}
                            </p>
                            <button 
                                className="btn btn-sm text-white px-3" 
                                style={{ backgroundColor: '#0D7D72' }}
                                onClick={() => handleOpenUploadForPatient(selectedPatientId !== 'ALL' ? selectedPatientId : undefined, undefined)}
                            >
                                <i className="bi bi-upload me-1"></i> Upload First Document
                            </button>
                        </div>
                    ) : (
                        filteredRecords.map(renderDocumentCard)
                    )}
                </div>
            )}

            {activeTab === 'timeline' && (
                <div>
                    {timelineVisits.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded shadow-sm border p-4">
                            <i className="bi bi-calendar-x display-4 text-muted mb-3"></i>
                            <h5 className="text-dark fw-bold">No visits found</h5>
                            <p className="text-muted small mb-0">Appointments and consultations for the selected profile will appear here.</p>
                        </div>
                    ) : (
                        <div className="timeline">
                            {timelineVisits.map(v => {
                                const visitRecords = filteredRecords.filter(r => r.appointment_id === v.id);
                                const patient = patientsMap.get(v.patient_id);

                                return (
                                    <div key={v.id} className="card border shadow-sm mb-4 rounded-3 overflow-hidden">
                                        <div className="card-header bg-light d-flex justify-content-between align-items-center flex-wrap gap-2 py-3 px-4">
                                            <div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <h6 className="mb-0 fw-bold text-dark fs-6">
                                                        Visit on {format(parseISO(v.appointment_date), 'MMMM d, yyyy')}
                                                    </h6>
                                                    <span className="badge bg-secondary text-white" style={{ fontSize: '11px' }}>
                                                        Token #{v.serial_no || '-'}
                                                    </span>
                                                    {patient && (
                                                        <span className="badge bg-light text-secondary border" style={{ fontSize: '11px' }}>
                                                            {patient.full_name} ({patient.uhid})
                                                        </span>
                                                    )}
                                                </div>
                                                <small className="text-muted mt-1 d-block">
                                                    <i className="bi bi-heart-pulse me-1"></i>Dr. {v.doctors?.full_name || 'Consulting Specialist'} · Slot: {v.start_time}
                                                </small>
                                            </div>

                                            <button 
                                                type="button"
                                                className="btn btn-sm btn-outline-primary fw-semibold d-inline-flex align-items-center gap-1.5"
                                                onClick={() => handleOpenUploadForPatient(v.patient_id, v.id)}
                                                title="Upload documents linked directly to this visit"
                                            >
                                                <i className="bi bi-plus-circle"></i>
                                                <span>Add Document to Visit</span>
                                            </button>
                                        </div>

                                        <div className="card-body p-3 p-md-4">
                                            {visitRecords.length === 0 ? (
                                                <div className="text-center py-3 text-muted small bg-light rounded border border-dashed">
                                                    <i className="bi bi-file-earmark-plus me-1"></i>
                                                    No documents attached to this visit yet. Click <strong>Add Document to Visit</strong> above to attach prescriptions or reports.
                                                </div>
                                            ) : (
                                                visitRecords.map(renderDocumentCard)
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'standalone' && (
                <div>
                    {standaloneRecords.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded shadow-sm border p-4">
                            <i className="bi bi-folder-check display-4 text-muted mb-3" style={{ color: '#0D7D72' }}></i>
                            <h5 className="text-dark fw-bold">No standalone documents found</h5>
                            <p className="text-muted small mb-3">
                                Documents uploaded directly to patient profiles without being tied to any specific clinic visit will appear here.
                            </p>
                            <button 
                                className="btn btn-sm text-white px-3" 
                                style={{ backgroundColor: '#0D7D72' }}
                                onClick={() => handleOpenUploadForPatient(selectedPatientId !== 'ALL' ? selectedPatientId : undefined, undefined)}
                            >
                                <i className="bi bi-upload me-1"></i> Upload Standalone Document
                            </button>
                        </div>
                    ) : (
                        standaloneRecords.map(renderDocumentCard)
                    )}
                </div>
            )}

            {/* Document Upload Modal */}
            <UploadDocumentModal 
                isOpen={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
                patients={patients} 
                visits={visits} 
                defaultPatientId={uploadDefaultPatientId} 
                defaultVisitId={uploadDefaultVisitId} 
                uploaderRole="patient" 
                onSuccess={() => window.location.reload()} 
            />
        </div>
    );
}
