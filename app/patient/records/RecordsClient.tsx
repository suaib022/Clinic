'use client';
import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import UploadDocumentModal from '@/components/UploadDocumentModal';

export default function RecordsClient({ patients, visits, records, userId }: { patients: any[], visits: any[], records: any[], userId: string }) {
    const [selectedPatientId, setSelectedPatientId] = useState<string>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedDoctorId, setSelectedDoctorId] = useState('ALL');
    
    // Upload Modal State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadDefaultVisitId, setUploadDefaultVisitId] = useState<string | undefined>(undefined);
    
    const supabase = createClient();

    // Derived Data
    const filteredVisits = useMemo(() => {
        return visits.filter(v => {
            if (selectedPatientId !== 'ALL' && v.patient_id !== selectedPatientId) return false;
            if (selectedDoctorId !== 'ALL' && v.doctors?.id !== selectedDoctorId) return false;
            return true;
        });
    }, [visits, selectedPatientId, selectedDoctorId]);

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (selectedPatientId !== 'ALL' && r.patient_id !== selectedPatientId) return false;
            if (selectedCategory !== 'ALL' && r.record_type !== selectedCategory) return false;
            if (selectedDoctorId !== 'ALL' && r.doctor_id !== selectedDoctorId) return false;
            if (searchTerm && !r.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
            return true;
        });
    }, [records, selectedPatientId, selectedCategory, selectedDoctorId, searchTerm]);

    const generalDocuments = filteredRecords.filter(r => !r.appointment_id);
    
    // Group doctors for the filter
    const uniqueDoctors = useMemo(() => {
        const docs = new Map();
        visits.forEach(v => {
            if (v.doctors) docs.set(v.doctors.id, v.doctors.full_name);
        });
        records.forEach(r => {
            if (r.doctor) docs.set(r.doctor_id, r.doctor.full_name);
        });
        return Array.from(docs.entries()).map(([id, name]) => ({ id, name }));
    }, [visits, records]);

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getUploaderText = (uploader: any, recordUploadedBy: string) => {
        if (recordUploadedBy === userId) return 'You';
        if (!uploader) return 'Clinic staff';
        if (uploader.role === 'doctor') return `Dr. ${uploader.full_name}`;
        if (uploader.role === 'compounder') return `Compounder (${uploader.full_name})`;
        return 'Clinic staff';
    };

    const canDelete = (r: any) => {
        return r.uploaded_by === userId;
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this document?')) {
            const { error } = await supabase.from('medical_records').update({ is_deleted: true }).eq('id', id);
            if (error) alert('Failed to delete: ' + error.message);
            else window.location.reload();
        }
    };

    const handleView = async (path: string) => {
        const { data, error } = await supabase.storage.from('medical_documents').createSignedUrl(path, 60);
        if (error) alert('Could not get file url: ' + error.message);
        else window.open(data.signedUrl, '_blank');
    };

    const handleDownload = async (path: string, fileName: string) => {
        const { data, error } = await supabase.storage.from('medical_documents').download(path);
        if (error) {
            alert('Could not download file: ' + error.message);
            return;
        }
        
        let downloadName = fileName;
        // The path in storage usually looks like: patientId/timestamp-random.ext
        const extMatch = path.match(/\.([^.]+)$/);
        if (extMatch && !fileName.endsWith(extMatch[0])) {
            downloadName += extMatch[0];
        }

        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const renderDocumentCard = (r: any) => (
        <div key={r.id} className="card border-0 shadow-sm mb-3">
            <div className="card-body d-flex align-items-center">
                <div className="me-3 text-primary fs-3">
                    <i className={r.file_type?.includes('pdf') ? 'bi bi-file-earmark-pdf' : 'bi bi-file-image'}></i>
                </div>
                <div className="flex-grow-1">
                    <h6 className="mb-1 fw-bold">{r.title}</h6>
                    <div className="text-muted small">
                        <span className="me-3"><i className="bi bi-tag"></i> {r.record_type.replace('_', ' ')}</span>
                        <span className="me-3"><i className="bi bi-calendar"></i> {format(parseISO(r.document_date), 'MMM d, yyyy')}</span>
                        <span className="me-3"><i className="bi bi-person"></i> {getUploaderText(r.uploader, r.uploaded_by)}</span>
                        <span><i className="bi bi-hdd"></i> {formatFileSize(r.file_size)}</span>
                    </div>
                </div>
                <div className="ms-3 d-flex gap-2">
                    <button className="btn btn-outline-primary btn-sm" onClick={() => handleView(r.file_path)}><i className="bi bi-eye"></i> View</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => handleDownload(r.file_path, r.title)}><i className="bi bi-download"></i></button>
                    {canDelete(r) && (
                        <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(r.id)}><i className="bi bi-trash"></i></button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <h2 className="m-0" style={{ color: '#0D7D72' }}>Medical Records Vault</h2>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }} onClick={() => { setUploadDefaultVisitId(undefined); setIsUploadOpen(true); }}>
                        <i className="bi bi-upload"></i> Upload Document
                    </button>
                    <a href="/patient/records/access-log" className="btn btn-sm btn-outline-secondary">
                        <i className="bi bi-journal-text"></i> Access Log
                    </a>
                </div>
            </div>

            {/* Filters */}
            <div className="card border-0 shadow-sm mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label small text-muted mb-1">Profile</label>
                            <select className="form-select form-select-sm" value={selectedPatientId} onChange={e => setSelectedPatientId(e.target.value)}>
                                <option value="ALL">All Profiles</option>
                                {patients.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small text-muted mb-1">Doctor</label>
                            <select className="form-select form-select-sm" value={selectedDoctorId} onChange={e => setSelectedDoctorId(e.target.value)}>
                                <option value="ALL">All Doctors</option>
                                {uniqueDoctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small text-muted mb-1">Category</label>
                            <select className="form-select form-select-sm" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                                <option value="ALL">All Categories</option>
                                <option value="prescription">Prescription</option>
                                <option value="test_report">Test Report</option>
                                <option value="imaging">Imaging</option>
                                <option value="discharge_summary">Discharge Summary</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label small text-muted mb-1">Search</label>
                            <input type="text" className="form-control form-control-sm" placeholder="Search by title..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            <ul className="nav nav-tabs mb-4" id="recordsTab" role="tablist">
                <li className="nav-item" role="presentation">
                    <button className="nav-link active" id="visits-tab" data-bs-toggle="tab" data-bs-target="#visits" type="button" role="tab">Visits Timeline</button>
                </li>
                <li className="nav-item" role="presentation">
                    <button className="nav-link" id="general-tab" data-bs-toggle="tab" data-bs-target="#general" type="button" role="tab">General Documents</button>
                </li>
            </ul>

            <div className="tab-content" id="recordsTabContent">
                <div className="tab-pane fade show active" id="visits" role="tabpanel">
                    {filteredVisits.length === 0 ? (
                        <div className="text-center py-5 bg-white rounded shadow-sm">
                            <i className="bi bi-calendar-x display-4 text-muted mb-3"></i>
                            <h5 className="text-muted">No visits found.</h5>
                            <p className="text-muted small">Completed appointments will appear here.</p>
                        </div>
                    ) : (
                        <div className="timeline">
                            {filteredVisits.map(v => {
                                const visitRecords = filteredRecords.filter(r => r.appointment_id === v.id);
                                return (
                                    <div key={v.id} className="card border-0 shadow-sm mb-4">
                                        <div className="card-header bg-light d-flex justify-content-between align-items-center">
                                            <div>
                                                <h6 className="mb-0 fw-bold">Visit on {format(parseISO(v.appointment_date), 'MMMM d, yyyy')}</h6>
                                                <small className="text-muted">Dr. {v.doctors?.full_name} • Serial: {v.serial_no}</small>
                                            </div>
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => { setUploadDefaultVisitId(v.id); setSelectedPatientId(v.patient_id); setIsUploadOpen(true); }}><i className="bi bi-plus-lg"></i> Add Document</button>
                                        </div>
                                        <div className="card-body">
                                            {visitRecords.length === 0 ? (
                                                <p className="text-muted small mb-0 text-center py-2">No documents attached to this visit.</p>
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
                
                <div className="tab-pane fade" id="general" role="tabpanel">
                    {generalDocuments.length === 0 ? (
                         <div className="text-center py-5 bg-white rounded shadow-sm">
                            <i className="bi bi-folder-x display-4 text-muted mb-3"></i>
                            <h5 className="text-muted">No general documents found.</h5>
                            <p className="text-muted small">Documents not attached to a specific visit will appear here.</p>
                        </div>
                    ) : (
                        generalDocuments.map(renderDocumentCard)
                    )}
                </div>
            </div>

            <UploadDocumentModal 
                isOpen={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
                patients={patients} 
                visits={visits} 
                defaultPatientId={selectedPatientId !== 'ALL' ? selectedPatientId : undefined} 
                defaultVisitId={uploadDefaultVisitId} 
                uploaderRole="patient" 
                onSuccess={() => window.location.reload()} 
            />
        </div>
    );
}
