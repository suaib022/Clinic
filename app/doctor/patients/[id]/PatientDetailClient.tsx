'use client';

import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import UploadDocumentModal from '@/components/UploadDocumentModal';
import Link from 'next/link';

export default function PatientDetailClient({ patient, records, myVisits, userId }: { patient: any, records: any[], myVisits: any[], userId: string }) {
    const supabase = createClient();
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    // Group records by document_date
    const groupedRecords = useMemo(() => {
        const groups: Record<string, any[]> = {};
        records.forEach(r => {
            const d = r.document_date || format(parseISO(r.created_at), 'yyyy-MM-dd');
            if (!groups[d]) groups[d] = [];
            groups[d].push(r);
        });
        
        // Sort dates descending
        return Object.entries(groups)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
    }, [records]);

    const formatFileSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const getUploaderText = (uploader: any, doctor: any, recordUploadedBy: string) => {
        if (recordUploadedBy === userId) return 'You';
        if (!uploader) return 'Clinic staff';
        if (uploader.role === 'patient') return 'Patient';
        if (uploader.role === 'doctor') return `Dr. ${doctor?.full_name || uploader.full_name}`;
        if (uploader.role === 'compounder') return `Compounder (${uploader.full_name})`;
        return 'Clinic staff';
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

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <div>
                    <Link href="/doctor/patients" className="btn btn-sm btn-link text-muted px-0 text-decoration-none mb-1"><i className="bi bi-arrow-left"></i> Back to Patients</Link>
                    <h2 className="m-0" style={{ color: '#0D7D72' }}>{patient.full_name}</h2>
                    <p className="text-muted small mb-0 mt-1">UHID: {patient.uhid || 'N/A'} • {patient.gender}, {format(parseISO(patient.dob), 'MMM d, yyyy')}</p>
                </div>
                <div className="d-flex gap-2">
                    <button className="btn btn-sm text-white" style={{ backgroundColor: '#0ab1a9' }} onClick={() => setIsUploadOpen(true)}>
                        <i className="bi bi-upload"></i> Upload Document
                    </button>
                </div>
            </div>

            {groupedRecords.length === 0 ? (
                <div className="text-center py-5 bg-white rounded shadow-sm">
                    <i className="bi bi-folder2-open display-4 text-muted mb-3"></i>
                    <h5 className="text-muted">No medical records found.</h5>
                    <p className="text-muted small">Upload a document to start building the patient's history.</p>
                </div>
            ) : (
                <div className="timeline">
                    {groupedRecords.map(([dateStr, dateRecords]) => (
                        <div key={dateStr} className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-light">
                                <h6 className="mb-0 fw-bold">{format(parseISO(dateStr), 'MMMM d, yyyy')}</h6>
                            </div>
                            <div className="card-body">
                                {dateRecords.map(r => (
                                    <div key={r.id} className="card border-1 shadow-none mb-3">
                                        <div className="card-body d-flex align-items-center">
                                            <div className="me-3 text-primary fs-3">
                                                <i className={r.file_type?.includes('pdf') ? 'bi bi-file-earmark-pdf' : 'bi bi-file-image'}></i>
                                            </div>
                                            <div className="flex-grow-1">
                                                <h6 className="mb-1 fw-bold">{r.title}</h6>
                                                <div className="text-muted small">
                                                    <span className="me-3"><i className="bi bi-tag"></i> {r.record_type.replace('_', ' ')}</span>
                                                    <span className="me-3"><i className="bi bi-person"></i> {getUploaderText(r.uploader, r.doctor, r.uploaded_by)}</span>
                                                    <span><i className="bi bi-hdd"></i> {formatFileSize(r.file_size)}</span>
                                                </div>
                                                {r.description && <p className="small mb-0 mt-2 text-muted">{r.description}</p>}
                                            </div>
                                            <div className="ms-3 d-flex gap-2">
                                                <button className="btn btn-outline-primary btn-sm" onClick={() => handleView(r.file_path)}><i className="bi bi-eye"></i></button>
                                                <button className="btn btn-outline-secondary btn-sm" onClick={() => handleDownload(r.file_path, r.title)}><i className="bi bi-download"></i></button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <UploadDocumentModal 
                isOpen={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
                patients={[patient]} 
                visits={myVisits} 
                defaultPatientId={patient.id} 
                uploaderRole="doctor" 
                onSuccess={() => window.location.reload()} 
            />
        </div>
    );
}
