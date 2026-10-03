'use client';

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase/client';
import UploadDocumentModal from '@/components/UploadDocumentModal';

export default function CompounderUploadClient({ patients, recentUploads }: { patients: any[], recentUploads: any[] }) {
    const supabase = createClient();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();

    const handleUploadClick = (patientId?: string) => {
        setSelectedPatientId(patientId);
        setIsUploadOpen(true);
    };

    const handleRetract = async (recordId: string, path: string) => {
        if (!confirm('Are you sure you want to retract this document? This cannot be undone.')) return;
        
        // Compounders can only retract if within 15 minutes, enforced by RLS.
        const { error } = await supabase.from('medical_records').update({ is_deleted: true }).eq('id', recordId);
        if (error) {
            alert('Failed to retract: ' + error.message);
            return;
        }
        
        // Soft deleted in DB, now remove from storage
        await supabase.storage.from('medical_documents').remove([path]);
        
        window.location.reload();
    };

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <h2 className="m-0" style={{ color: '#0D7D72' }}>Document Upload</h2>
                <button className="btn btn-primary" onClick={() => handleUploadClick()}>
                    <i className="bi bi-upload"></i> General Upload
                </button>
            </div>

            <div className="row g-4">
                <div className="col-md-7">
                    <div className="card border-0 shadow-sm rounded-3">
                        <div className="card-header bg-white pt-3 pb-2 border-bottom">
                            <h5 className="mb-0 fw-bold">Today's Patients</h5>
                        </div>
                        <div className="card-body p-0">
                            {patients.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-calendar-x fs-2 d-block mb-2"></i>
                                    No patients booked today.
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush">
                                    {patients.map(p => (
                                        <li key={p.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                                            <div>
                                                <h6 className="mb-0 fw-medium">{p.full_name}</h6>
                                                <small className="text-muted">UHID: {p.uhid}</small>
                                            </div>
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => handleUploadClick(p.id)}>
                                                Select
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-md-5">
                    <div className="card border-0 shadow-sm rounded-3">
                        <div className="card-header bg-white pt-3 pb-2 border-bottom">
                            <h5 className="mb-0 fw-bold">Recent Uploads (Receipts)</h5>
                        </div>
                        <div className="card-body p-0">
                            {recentUploads.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    <i className="bi bi-receipt fs-2 d-block mb-2"></i>
                                    No recent uploads.
                                </div>
                            ) : (
                                <ul className="list-group list-group-flush">
                                    {recentUploads.map((r: any) => {
                                        const uploadTime = new Date(r.created_at).getTime();
                                        const now = new Date().getTime();
                                        const isRetractable = (now - uploadTime) <= 15 * 60 * 1000;

                                        return (
                                            <li key={r.id} className="list-group-item py-3">
                                                <div className="d-flex justify-content-between">
                                                    <div>
                                                        <h6 className="mb-1 text-truncate" style={{ maxWidth: '200px' }}>{r.title}</h6>
                                                        <div className="small text-muted">
                                                            <div>Patient: {r.patient_name}</div>
                                                            <div>{format(parseISO(r.created_at), 'h:mm a')}</div>
                                                        </div>
                                                    </div>
                                                    {isRetractable && (
                                                        <button 
                                                            className="btn btn-sm btn-outline-danger h-100" 
                                                            onClick={() => handleRetract(r.id, r.file_path)}
                                                            title="Retract document"
                                                        >
                                                            <i className="bi bi-arrow-counterclockwise"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <UploadDocumentModal 
                isOpen={isUploadOpen} 
                onClose={() => setIsUploadOpen(false)} 
                patients={patients} 
                visits={[]} 
                defaultPatientId={selectedPatientId} 
                uploaderRole="compounder" 
                onSuccess={() => window.location.reload()} 
            />
        </div>
    );
}
