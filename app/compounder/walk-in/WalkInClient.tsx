'use client';
import React, { useState, useTransition } from 'react';
import { lookupPatient, registerNewPatient, createWalkInAppointment } from '../actions';
import { useRouter } from 'next/navigation';

export default function WalkInClient({ doctorOnBreak }: { doctorOnBreak: boolean }) {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [isPending, startTransition] = useTransition();
    
    // Step 1 State
    const [query, setQuery] = useState('');
    const [lookupResult, setLookupResult] = useState<{ id: string, full_name: string, uhid: string, gender: string }[] | null>(null);
    const [lookupError, setLookupError] = useState('');
    
    // Step 2 State (New Patient)
    const [newPatient, setNewPatient] = useState({ fullName: '', mobile: '', gender: 'Male', title: 'Mr.' });
    const [registrationError, setRegistrationError] = useState('');
    
    // Step 3 State (Booking)
    const [selectedPatient, setSelectedPatient] = useState<{ id: string, full_name: string, uhid: string } | null>(null);
    const [visitType, setVisitType] = useState('new');
    const [isPriority, setIsPriority] = useState(false);
    const [priorityReason, setPriorityReason] = useState('');
    const [bookingError, setBookingError] = useState('');
    
    // Step 4 State (Success/Slip)
    const [slipData, setSlipData] = useState<{
        appointmentId: string;
        serialNo: number;
        patientName: string;
        uhid: string;
        visitType: string;
        isPriority: boolean;
        pin?: string;
    } | null>(null);

    const [idempotencyKey] = useState(() => `walkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    const handleLookup = () => {
        if (!query.trim()) return;
        setLookupError('');
        startTransition(async () => {
            const res = await lookupPatient(query);
            if (res.success) {
                setLookupResult(res.patients);
                if (res.patients.length === 0) {
                    // pre-fill mobile if query looks like one
                    if (query.match(/^(\+880|0)1[3-9]\d{8}$/)) {
                        setNewPatient(prev => ({ ...prev, mobile: query }));
                    }
                }
            } else {
                setLookupError(res.error || 'Lookup failed');
            }
        });
    };

    const handleRegister = () => {
        setRegistrationError('');
        if (!newPatient.fullName.trim() || !newPatient.mobile.trim()) {
            setRegistrationError('Full Name and Mobile are required');
            return;
        }
        startTransition(async () => {
            const res = await registerNewPatient(
                newPatient.fullName,
                newPatient.mobile,
                newPatient.gender,
                newPatient.title
            );
            if (res.success && res.patientId && res.uhid) {
                setSelectedPatient({
                    id: res.patientId,
                    full_name: newPatient.fullName,
                    uhid: res.uhid
                });
                setSlipData(prev => ({ ...prev, pin: res.pin } as any)); // store PIN temporarily to show later
                setStep(3);
            } else {
                setRegistrationError(res.error || 'Registration failed');
            }
        });
    };

    const handleBook = () => {
        setBookingError('');
        if (isPriority && !priorityReason.trim()) {
            setBookingError('Priority reason is required');
            return;
        }
        if (!selectedPatient) return;

        startTransition(async () => {
            const res = await createWalkInAppointment(
                selectedPatient.id,
                visitType,
                isPriority,
                priorityReason,
                idempotencyKey
            );
            if (res.success && res.appointmentId) {
                setSlipData(prev => ({
                    ...prev,
                    appointmentId: res.appointmentId,
                    serialNo: res.serialNo || 0,
                    patientName: selectedPatient.full_name,
                    uhid: selectedPatient.uhid,
                    visitType,
                    isPriority
                }));
                setStep(4);
            } else {
                setBookingError(res.error || 'Booking failed');
            }
        });
    };

    return (
        <div className="container-fluid" style={{ maxWidth: '800px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4 pb-3" style={{ borderBottom: '3px solid #0D7D72' }}>
                <h2 className="m-0" style={{ color: '#0D7D72' }}>
                    <i className="bi bi-person-plus me-2"></i>Add Walk-in
                </h2>
                {step < 4 && (
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => router.back()}>Cancel</button>
                )}
            </div>

            {doctorOnBreak && step < 4 && (
                <div className="alert alert-warning">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    <strong>Warning:</strong> The doctor is currently on a scheduled break. Walk-ins can still be booked but consultation will start after the break.
                </div>
            )}

            {/* STEP 1: LOOKUP */}
            {step === 1 && (
                <div className="card border-0 shadow-sm rounded-3 fade-in">
                    <div className="card-body p-4 p-md-5">
                        <h4 className="fw-bold mb-4">Step 1: Patient Lookup</h4>
                        <p className="text-muted mb-4">Search by exact UHID or Mobile Number.</p>
                        
                        <div className="input-group mb-3">
                            <input 
                                type="text" 
                                className="form-control form-control-lg" 
                                placeholder="Enter mobile or UHID..." 
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                            />
                            <button className="btn btn-primary px-4" onClick={handleLookup} disabled={isPending || !query.trim()}>
                                {isPending ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-search"></i>}
                            </button>
                        </div>
                        
                        {lookupError && <div className="alert alert-danger">{lookupError}</div>}

                        {lookupResult && lookupResult.length > 0 && (
                            <div className="mt-4">
                                <h5>Search Results:</h5>
                                <div className="list-group">
                                    {lookupResult.map(p => (
                                        <button 
                                            key={p.id} 
                                            className="list-group-item list-group-item-action d-flex justify-content-between align-items-center p-3"
                                            onClick={() => {
                                                setSelectedPatient({ id: p.id, full_name: p.full_name, uhid: p.uhid });
                                                setStep(3);
                                            }}
                                        >
                                            <div>
                                                <div className="fw-bold">{p.full_name}</div>
                                                <small className="text-muted">{p.uhid} · {p.gender}</small>
                                            </div>
                                            <i className="bi bi-chevron-right text-muted"></i>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {lookupResult && lookupResult.length === 0 && (
                            <div className="mt-4 text-center p-4 bg-light rounded">
                                <p className="mb-3">No patient found matching "{query}".</p>
                                <button className="btn btn-outline-primary" onClick={() => setStep(2)}>
                                    Register New Patient
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* STEP 2: NEW PATIENT */}
            {step === 2 && (
                <div className="card border-0 shadow-sm rounded-3 fade-in">
                    <div className="card-body p-4 p-md-5">
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <button className="btn btn-light btn-sm" onClick={() => setStep(1)}><i className="bi bi-arrow-left"></i> Back</button>
                            <h4 className="fw-bold m-0">Step 2: Register New Patient</h4>
                        </div>
                        
                        {registrationError && <div className="alert alert-danger">{registrationError}</div>}
                        
                        <div className="row g-3">
                            <div className="col-md-3">
                                <label className="form-label">Title</label>
                                <select className="form-select" value={newPatient.title} onChange={e => setNewPatient({...newPatient, title: e.target.value})}>
                                    <option>Mr.</option>
                                    <option>Mrs.</option>
                                    <option>Ms.</option>
                                    <option>Dr.</option>
                                    <option>Md.</option>
                                    <option>Mst.</option>
                                </select>
                            </div>
                            <div className="col-md-9">
                                <label className="form-label">Full Name <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" value={newPatient.fullName} onChange={e => setNewPatient({...newPatient, fullName: e.target.value})} />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Mobile Number <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" value={newPatient.mobile} onChange={e => setNewPatient({...newPatient, mobile: e.target.value})} placeholder="01XXXXXXXXX" />
                            </div>
                            <div className="col-md-6">
                                <label className="form-label">Gender</label>
                                <select className="form-select" value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value})}>
                                    <option>Male</option>
                                    <option>Female</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>
                        
                        <div className="mt-4 text-end">
                            <button className="btn btn-primary px-4" onClick={handleRegister} disabled={isPending}>
                                {isPending ? <span className="spinner-border spinner-border-sm" /> : 'Register & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: BOOKING DETAILS */}
            {step === 3 && selectedPatient && (
                <div className="card border-0 shadow-sm rounded-3 fade-in">
                    <div className="card-body p-4 p-md-5">
                        <div className="d-flex align-items-center gap-3 mb-4">
                            <button className="btn btn-light btn-sm" onClick={() => setStep(1)}><i className="bi bi-arrow-left"></i> Back to Search</button>
                            <h4 className="fw-bold m-0">Step 3: Booking Details</h4>
                        </div>

                        <div className="alert bg-light border p-3 mb-4">
                            <h6 className="m-0 fw-bold">{selectedPatient.full_name}</h6>
                            <small className="text-muted">{selectedPatient.uhid}</small>
                        </div>
                        
                        {bookingError && <div className="alert alert-danger">{bookingError}</div>}

                        <div className="mb-3">
                            <label className="form-label fw-bold">Visit Type</label>
                            <select className="form-select" value={visitType} onChange={e => setVisitType(e.target.value)}>
                                <option value="new">New Visit</option>
                                <option value="follow_up">Follow Up</option>
                                <option value="report_review">Report Review</option>
                            </select>
                        </div>

                        <div className="mb-3">
                            <div className="form-check form-switch">
                                <input className="form-check-input" type="checkbox" role="switch" id="prioritySwitch" checked={isPriority} onChange={e => setIsPriority(e.target.checked)} />
                                <label className="form-check-label text-danger fw-bold" htmlFor="prioritySwitch">
                                    <i className="bi bi-exclamation-triangle me-1"></i>Mark as Priority
                                </label>
                            </div>
                        </div>

                        {isPriority && (
                            <div className="mb-4">
                                <label className="form-label">Priority Reason <span className="text-danger">*</span></label>
                                <input type="text" className="form-control" value={priorityReason} onChange={e => setPriorityReason(e.target.value)} placeholder="e.g. Emergency, Elderly" />
                            </div>
                        )}

                        <div className="mt-4 text-end">
                            <button className="btn btn-success px-5 py-2 fs-5" onClick={handleBook} disabled={isPending}>
                                {isPending ? <span className="spinner-border spinner-border-sm" /> : 'Confirm Walk-in'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 4: SLIP / SUCCESS */}
            {step === 4 && slipData && (
                <div className="card border-0 shadow rounded-3 fade-in overflow-hidden">
                    <div className="bg-success text-white text-center py-4">
                        <i className="bi bi-check-circle display-4"></i>
                        <h3 className="mt-2 mb-0">Walk-in Confirmed</h3>
                    </div>
                    <div className="card-body p-4 p-md-5">
                        
                        {slipData.pin && (
                            <div className="alert alert-warning border-warning">
                                <h5 className="alert-heading fw-bold"><i className="bi bi-key me-2"></i>New Account Created</h5>
                                <p className="mb-1">Please give the patient their login credentials. The PIN cannot be recovered later.</p>
                                <hr/>
                                <div className="fs-5">
                                    <strong>UHID / Username:</strong> {slipData.uhid}<br/>
                                    <strong>PIN:</strong> <span className="font-monospace fs-4 bg-light px-2 py-1 rounded">{slipData.pin}</span>
                                </div>
                            </div>
                        )}

                        <div className="border rounded-3 p-4 bg-light mb-4 text-center print-slip">
                            <h2 className="display-1 fw-bold text-dark mb-0">#{slipData.serialNo}</h2>
                            <p className="text-muted fs-5 mb-4">Serial Number</p>
                            
                            <h4 className="fw-bold">{slipData.patientName}</h4>
                            <p className="text-muted">{slipData.uhid}</p>
                            
                            <div className="d-flex justify-content-center gap-2 mt-3">
                                <span className="badge bg-secondary">{slipData.visitType.replace('_', ' ')}</span>
                                {slipData.isPriority && <span className="badge bg-danger">Priority</span>}
                                <span className="badge bg-warning text-dark">Walk-in</span>
                            </div>
                        </div>
                        
                        <div className="d-flex gap-3 justify-content-center d-print-none">
                            <button className="btn btn-outline-secondary" onClick={() => window.print()}>
                                <i className="bi bi-printer me-2"></i>Print Slip
                            </button>
                            <button className="btn btn-primary" onClick={() => {
                                setStep(1);
                                setQuery('');
                                setLookupResult(null);
                                setSlipData(null);
                            }}>
                                <i className="bi bi-plus-circle me-2"></i>New Walk-in
                            </button>
                            <button className="btn btn-success" onClick={() => router.push('/compounder/bookings')}>
                                <i className="bi bi-calendar-check me-2"></i>View Bookings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .fade-in { animation: fadeIn 0.3s ease-in; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @media print {
                    body * { visibility: hidden; }
                    .print-slip, .print-slip * { visibility: visible; }
                    .print-slip { position: absolute; left: 0; top: 0; width: 100%; border: none !important; background: white !important; }
                }
            `}</style>
        </div>
    );
}
