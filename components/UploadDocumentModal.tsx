'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

type UploadFileState = {
    id: string;
    file: File;
    category: string;
    title: string;
    document_date: string;
    notes: string;
    visit_id: string;
    progress: number;
    error: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
};

export default function UploadDocumentModal({
    isOpen,
    onClose,
    patients,
    visits,
    defaultPatientId,
    defaultVisitId,
    uploaderRole,
    onSuccess
}: {
    isOpen: boolean;
    onClose: () => void;
    patients: any[];
    visits?: any[];
    defaultPatientId?: string;
    defaultVisitId?: string;
    uploaderRole: 'patient' | 'doctor' | 'compounder';
    onSuccess?: () => void;
}) {
    const supabase = createClient();
    
    const [selectedPatientId, setSelectedPatientId] = useState(defaultPatientId || (patients.length === 1 ? patients[0].id : ''));
    const [files, setFiles] = useState<UploadFileState[]>([]);
    
    // Auto-update if props change
    useEffect(() => {
        if (defaultPatientId) setSelectedPatientId(defaultPatientId);
    }, [defaultPatientId]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => {
                const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                return {
                    id: Math.random().toString(36).substring(7),
                    file,
                    category: 'other',
                    title: nameWithoutExt,
                    document_date: format(new Date(), 'yyyy-MM-dd'),
                    notes: '',
                    visit_id: defaultVisitId || '',
                    progress: 0,
                    error: '',
                    status: 'pending' as const
                };
            });
            setFiles(prev => [...prev, ...newFiles].slice(0, 10)); // max 10
        }
    };

    const updateFile = (id: string, updates: Partial<UploadFileState>) => {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const uploadFile = async (f: UploadFileState) => {
        if (f.status === 'success' || !selectedPatientId) return;
        
        updateFile(f.id, { status: 'uploading', progress: 10, error: '' });
        
        try {
            // 1. Upload to storage
            const fileExt = f.file.name.split('.').pop();
            const fileName = `${selectedPatientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            
            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('medical_documents')
                .upload(fileName, f.file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;
            
            updateFile(f.id, { progress: 60 });

            // 2. Insert into DB
            const { data: userData } = await supabase.auth.getUser();
            const { error: dbError } = await supabase.from('medical_records').insert({
                patient_id: selectedPatientId,
                doctor_id: visits?.find(v => v.id === f.visit_id)?.doctor_id || null,
                uploaded_by: userData.user?.id,
                record_type: f.category,
                title: f.title,
                description: f.notes || null,
                file_path: fileName,
                document_date: f.document_date,
                appointment_id: f.visit_id || null,
                file_size: f.file.size,
                file_type: f.file.type
            });

            if (dbError) throw dbError;
            
            updateFile(f.id, { status: 'success', progress: 100 });
        } catch (err: any) {
            updateFile(f.id, { status: 'error', error: err.message || 'Upload failed' });
        }
    };

    const handleUploadAll = async () => {
        if (!selectedPatientId) {
            alert('Please select a patient first');
            return;
        }
        const pendingFiles = files.filter(f => f.status === 'pending' || f.status === 'error');
        for (const f of pendingFiles) {
            await uploadFile(f);
        }
    };

    const allCompleted = files.length > 0 && files.every(f => f.status === 'success');
    const isUploading = files.some(f => f.status === 'uploading');

    const handleDone = () => {
        if (onSuccess && files.some(f => f.status === 'success')) {
            onSuccess();
        }
        onClose();
        // optionally reset state
        setFiles([]);
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content border-0 rounded-4 shadow">
                    <div className="modal-header border-bottom-0 pb-0">
                        <h5 className="modal-title fw-bold text-dark">Upload Documents</h5>
                        <button type="button" className="btn-close" onClick={onClose} disabled={isUploading}></button>
                    </div>
                    <div className="modal-body py-4">
                        
                        {!allCompleted && (
                            <div className="mb-4">
                                <label className="form-label fw-medium">Select Patient</label>
                                <select 
                                    className="form-select" 
                                    value={selectedPatientId} 
                                    onChange={e => setSelectedPatientId(e.target.value)}
                                    disabled={isUploading || !!defaultPatientId}
                                >
                                    <option value="">-- Choose Profile --</option>
                                    {patients.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name} {p.uhid ? `(${p.uhid})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {!allCompleted && selectedPatientId && files.length < 10 && (
                            <div className="mb-4">
                                <label className="btn btn-outline-primary border-dashed w-100 py-4 rounded-3 d-flex flex-column align-items-center justify-content-center" style={{ borderStyle: 'dashed' }}>
                                    <i className="bi bi-cloud-arrow-up fs-2 mb-2"></i>
                                    <span>Select Files (Images or PDF)</span>
                                    <small className="text-muted">Up to 10 files</small>
                                    <input type="file" multiple accept="image/*,.pdf" className="d-none" onChange={handleFileChange} />
                                </label>
                            </div>
                        )}

                        <div className="d-flex flex-column gap-3">
                            {files.map((f, i) => (
                                <div key={f.id} className="card shadow-sm border-0 bg-light">
                                    <div className="card-body">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <h6 className="mb-0 text-truncate me-2" style={{ maxWidth: '200px' }}>{f.file.name}</h6>
                                            {f.status === 'success' ? (
                                                <span className="badge bg-success"><i className="bi bi-check-circle"></i> Uploaded</span>
                                            ) : (
                                                <button className="btn btn-sm text-danger p-0" onClick={() => removeFile(f.id)} disabled={f.status === 'uploading'}>
                                                    <i className="bi bi-x-circle fs-5"></i>
                                                </button>
                                            )}
                                        </div>

                                        {f.status === 'error' && (
                                            <div className="alert alert-danger py-1 px-2 small mb-2">{f.error}</div>
                                        )}

                                        <div className="row g-2 mb-2">
                                            <div className="col-md-6">
                                                <input type="text" className="form-control form-control-sm" placeholder="Title" value={f.title} onChange={e => updateFile(f.id, { title: e.target.value })} disabled={f.status === 'success' || f.status === 'uploading'} />
                                            </div>
                                            <div className="col-md-6">
                                                <select className="form-select form-select-sm" value={f.category} onChange={e => updateFile(f.id, { category: e.target.value })} disabled={f.status === 'success' || f.status === 'uploading'}>
                                                    <option value="other">Other</option>
                                                    <option value="prescription">Prescription</option>
                                                    <option value="test_report">Test Report</option>
                                                    <option value="imaging">Imaging</option>
                                                    <option value="discharge_summary">Discharge Summary</option>
                                                </select>
                                            </div>
                                            <div className="col-md-6">
                                                <input type="date" className="form-control form-control-sm" value={f.document_date} max={format(new Date(), 'yyyy-MM-dd')} onChange={e => updateFile(f.id, { document_date: e.target.value })} disabled={f.status === 'success' || f.status === 'uploading'} />
                                            </div>
                                            <div className="col-md-6">
                                                <select className="form-select form-select-sm" value={f.visit_id} onChange={e => updateFile(f.id, { visit_id: e.target.value })} disabled={f.status === 'success' || f.status === 'uploading'}>
                                                    <option value="">-- No specific visit --</option>
                                                    {visits?.filter(v => v.patient_id === selectedPatientId).map(v => (
                                                        <option key={v.id} value={v.id}>{format(new Date(v.appointment_date), 'MMM d, yyyy')} - Dr. {v.doctors?.full_name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="col-12">
                                                <input type="text" className="form-control form-control-sm" placeholder="Optional notes..." value={f.notes} onChange={e => updateFile(f.id, { notes: e.target.value })} disabled={f.status === 'success' || f.status === 'uploading'} />
                                            </div>
                                        </div>

                                        {f.status === 'uploading' && (
                                            <div className="progress mt-2" style={{ height: '4px' }}>
                                                <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" style={{ width: `${f.progress}%` }}></div>
                                            </div>
                                        )}
                                        
                                        {f.status === 'error' && (
                                            <button className="btn btn-sm btn-outline-primary mt-2" onClick={() => uploadFile(f)}>
                                                <i className="bi bi-arrow-clockwise"></i> Retry
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="modal-footer border-top-0">
                        {allCompleted ? (
                            <button type="button" className="btn btn-success px-4 rounded-pill" onClick={handleDone}>Done</button>
                        ) : (
                            <>
                                <button type="button" className="btn btn-light rounded-pill" onClick={onClose} disabled={isUploading}>Cancel</button>
                                <button type="button" className="btn text-white px-4 rounded-pill" style={{ backgroundColor: '#0ab1a9' }} onClick={handleUploadAll} disabled={isUploading || files.length === 0 || !selectedPatientId}>
                                    {isUploading ? 'Uploading...' : 'Upload All'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
