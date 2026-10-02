import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardSidebar from '@/components/DashboardSidebar';
import { uploadMedicalRecord } from '../actions';

export default async function CompounderUpload() {
    const cookieStore = await cookies();
    const role = cookieStore.get('staff_role')?.value;
    const compounderId = cookieStore.get('staff_session')?.value;
    if (role !== 'compounder' || !compounderId) redirect('/login');

    const supabase = await createClient();
    
    const { data: compounder } = await supabase.from('compounders').select('assigned_doctor_id').eq('id', compounderId).single();
    const doctorId = compounder?.assigned_doctor_id;

    // Get unique patients for this doctor
    const { data: appointments } = await supabase
        .from('appointments')
        .select(`
            patient:patients(id, full_name, mobile_no)
        `)
        .eq('doctor_id', doctorId);

    // Filter unique patients
    const uniquePatients = Array.from(new Map(appointments?.map((a: any) => [a.patient?.id, a.patient])).values());

    return (
        <main className="main pt-5" style={{ backgroundColor: '#f6f9ff' }}>
            <div className="d-flex align-items-stretch" style={{ minHeight: 'calc(100vh - 100px)' }}>
                <DashboardSidebar role="compounder" />
                <div className="flex-grow-1 p-4 p-md-5">
                    <div className="container-fluid max-w-1200 mx-auto">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                            <h2 className="m-0" style={{ color: '#0D7D72' }}>Upload Medical Documents</h2>
                        </div>
                        <div className="card border-0 shadow-sm rounded-3 p-4 max-w-800">
                            <form action={uploadMedicalRecord}>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Select Patient</label>
                                    <select name="patient_id" className="form-select" required>
                                        <option value="">-- Choose Patient --</option>
                                        {uniquePatients.map((p: any) => (
                                            p && <option key={p.id} value={p.id}>{p.full_name} ({p.mobile_no})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Document Type</label>
                                    <select name="record_type" className="form-select" required>
                                        <option value="prescription">Prescription</option>
                                        <option value="test_report">Test Report</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-bold">Document Title</label>
                                    <input type="text" name="title" className="form-control" placeholder="e.g. Blood Test Report" required />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label fw-bold">File (PDF/Image)</label>
                                    <input type="file" name="file" className="form-control" />
                                    <div className="form-text text-muted">This simulates file upload. The actual file won't be stored in this demo.</div>
                                </div>
                                <button type="submit" className="btn text-white w-100" style={{ backgroundColor: '#0ab1a9' }}>
                                    Upload Document on Behalf of Patient
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
