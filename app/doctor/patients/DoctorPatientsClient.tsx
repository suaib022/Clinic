'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import Link from 'next/link';

export default function DoctorPatientsClient({ initialPatients, initialQuery, currentPage }: { initialPatients: any[], initialQuery: string, currentPage: number }) {
    const [search, setSearch] = useState(initialQuery);
    const router = useRouter();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.push(`/doctor/patients?q=${encodeURIComponent(search)}&page=1`);
    };

    const handlePageChange = (newPage: number) => {
        router.push(`/doctor/patients?q=${encodeURIComponent(search)}&page=${newPage}`);
    };

    return (
        <div className="container-fluid max-w-1200 mx-auto">
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <h2 className="m-0" style={{ color: '#0D7D72' }}>Patient Records</h2>
                <form onSubmit={handleSearch} className="d-flex gap-2">
                    <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Search name, UHID, phone..." 
                        value={search} 
                        onChange={e => setSearch(e.target.value)} 
                        style={{ width: '250px' }}
                    />
                    <button type="submit" className="btn btn-sm btn-primary">Search</button>
                </form>
            </div>

            <div className="card border-0 shadow-sm rounded-3 p-4">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                            <tr>
                                <th>Patient Name</th>
                                <th>UHID</th>
                                <th>Mobile No</th>
                                <th>Total Visits</th>
                                <th>Last Visit</th>
                                <th>Next Appt</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {initialPatients.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-5 text-muted">
                                        <i className="bi bi-person-x fs-2 d-block mb-2"></i>
                                        No patients found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                initialPatients.map((p: any) => (
                                    <tr key={p.patient_id}>
                                        <td className="fw-medium">{p.full_name}</td>
                                        <td>{p.uhid || '-'}</td>
                                        <td>{p.mobile_no}</td>
                                        <td>{p.total_visits}</td>
                                        <td>{p.last_visit_date ? format(parseISO(p.last_visit_date), 'MMM d, yyyy') : '-'}</td>
                                        <td>{p.next_appointment_date ? format(parseISO(p.next_appointment_date), 'MMM d, yyyy') : '-'}</td>
                                        <td>
                                            <Link href={`/doctor/patients/${p.patient_id}`} className="btn btn-sm btn-outline-primary">
                                                View Records
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="d-flex justify-content-between align-items-center mt-4">
                    <button 
                        className="btn btn-sm btn-outline-secondary" 
                        disabled={currentPage <= 1} 
                        onClick={() => handlePageChange(currentPage - 1)}
                    >
                        <i className="bi bi-chevron-left"></i> Previous
                    </button>
                    <span className="small text-muted">Page {currentPage}</span>
                    <button 
                        className="btn btn-sm btn-outline-secondary" 
                        disabled={initialPatients.length < 10} 
                        onClick={() => handlePageChange(currentPage + 1)}
                    >
                        Next <i className="bi bi-chevron-right"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
