import React from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase/admin';
import SlipsActionCenter from '@/components/slips/SlipsActionCenter';
import { CheckCircle2, Calendar, Clock, User, Stethoscope, CreditCard, ArrowRight, Home } from 'lucide-react';
import { formatDate, formatTime } from '@/lib/format';

export const metadata = {
    title: 'Appointment Confirmation | Clinic',
    description: 'Appointment booking confirmation and payment receipt'
};

export default async function ConfirmationPage({
    searchParams
}: {
    searchParams: Promise<{ appointment_id?: string; tran_id?: string }>;
}) {
    const params = await searchParams;
    let appointmentId = params.appointment_id;
    const tranId = params.tran_id;

    if (!appointmentId && tranId) {
        const { data: p } = await supabaseAdmin
            .from('payments')
            .select('appointment_id')
            .eq('tran_id', tranId)
            .single();
        if (p?.appointment_id) {
            appointmentId = p.appointment_id;
        }
    }

    let appointment: any = null;
    let patient: any = null;
    let doctor: any = null;
    let specialityName: string = '';
    let payment: any = null;

    if (appointmentId) {
        const { data: appt } = await supabaseAdmin
            .from('appointments')
            .select('*')
            .eq('id', appointmentId)
            .single();

        appointment = appt;

        if (appt) {
            // Fetch patient
            if (appt.patient_id) {
                const { data: pt } = await supabaseAdmin
                    .from('patients')
                    .select('*')
                    .eq('id', appt.patient_id)
                    .single();
                patient = pt;
            }

            // Fetch doctor
            if (appt.doctor_id) {
                const { data: doc } = await supabaseAdmin
                    .from('users')
                    .select('id, full_name, avatar_url')
                    .eq('id', appt.doctor_id)
                    .single();
                doctor = doc;

                // Speciality
                const { data: specs } = await supabaseAdmin
                    .from('doctor_specialities')
                    .select('specialities(name)')
                    .eq('doctor_id', appt.doctor_id);
                if (specs && specs.length > 0) {
                    specialityName = specs.map((s: any) => s.specialities?.name).filter(Boolean).join(', ');
                }
            }

            // Fetch payment
            const { data: pay } = await supabaseAdmin
                .from('payments')
                .select('*')
                .eq('appointment_id', appt.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            payment = pay;
        }
    }

    return (
        <main className="min-vh-100 py-5" style={{ backgroundColor: '#f4f7f9' }}>
            <style>{`
                @media print {
                    body { background: white !important; }
                    .no-print { display: none !important; }
                    .print-card { box-shadow: none !important; border: 1px solid #ccc !important; }
                }
            `}</style>
            
            <div className="container" style={{ maxWidth: '820px' }}>
                {/* Status Hero Card */}
                <div className="card border-0 shadow-sm rounded-3 overflow-hidden print-card mb-4">
                    <div className="p-4 p-md-5 text-center text-white" style={{ backgroundColor: '#0D7D72' }}>
                        <div className="d-inline-flex p-3 rounded-circle bg-white text-success mb-3 shadow-sm">
                            <CheckCircle2 size={48} color="#0D7D72" />
                        </div>
                        <h2 className="fw-bold mb-2">Appointment Confirmed & Paid</h2>
                        <p className="lead mb-0 text-white-50 fs-6">
                            Your payment has been received and consultation slot is successfully booked.
                        </p>
                    </div>

                    <div className="card-body p-4 p-md-5">
                        {/* Token Serial Display */}
                        <div className="bg-light p-4 rounded-3 border text-center mb-4">
                            <span className="text-muted text-uppercase fw-semibold small tracking-wide d-block mb-1">
                                Your Queue Serial Number
                            </span>
                            <span className="display-4 fw-bold" style={{ color: '#0D7D72' }}>
                                #{appointment?.serial_no || '-'}
                            </span>
                            <p className="text-muted small mt-2 mb-0">
                                Please arrive at least 15 minutes before your scheduled appointment time.
                            </p>
                        </div>

                        {/* Details Grid */}
                        <div className="row g-4 mb-4">
                            {/* Doctor Column */}
                            <div className="col-md-6">
                                <div className="border p-3 rounded-3 h-100 bg-white">
                                    <div className="d-flex align-items-center gap-2 mb-2 text-muted small fw-semibold">
                                        <Stethoscope size={16} color="#0D7D72" />
                                        <span>DOCTOR & SPECIALITY</span>
                                    </div>
                                    <h5 className="fw-bold text-dark mb-1">{doctor?.full_name || 'Consulting Doctor'}</h5>
                                    <p className="text-muted small mb-0">{specialityName || 'General Consultation'}</p>
                                </div>
                            </div>

                            {/* Schedule Column */}
                            <div className="col-md-6">
                                <div className="border p-3 rounded-3 h-100 bg-white">
                                    <div className="d-flex align-items-center gap-2 mb-2 text-muted small fw-semibold">
                                        <Calendar size={16} color="#0D7D72" />
                                        <span>DATE & TIME</span>
                                    </div>
                                    <h5 className="fw-bold text-dark mb-1">
                                        {appointment?.appointment_date ? formatDate(appointment.appointment_date) : '-'}
                                    </h5>
                                    <p className="text-muted small mb-0 d-flex align-items-center gap-1">
                                        <Clock size={14} />
                                        <span>Slot: {appointment?.start_time ? formatTime(appointment.start_time) : '-'}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Patient Column */}
                            <div className="col-md-6">
                                <div className="border p-3 rounded-3 h-100 bg-white">
                                    <div className="d-flex align-items-center gap-2 mb-2 text-muted small fw-semibold">
                                        <User size={16} color="#0D7D72" />
                                        <span>PATIENT INFORMATION</span>
                                    </div>
                                    <h6 className="fw-bold text-dark mb-1">{patient?.full_name || 'Patient'}</h6>
                                    <div className="text-muted small">
                                        <div>UHID: <strong className="text-dark">{patient?.uhid || '-'}</strong></div>
                                        <div>Contact: {patient?.mobile_no || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Receipt Column */}
                            <div className="col-md-6">
                                <div className="border p-3 rounded-3 h-100 bg-white">
                                    <div className="d-flex align-items-center gap-2 mb-2 text-muted small fw-semibold">
                                        <CreditCard size={16} color="#0D7D72" />
                                        <span>PAYMENT RECEIPT</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="text-muted small">Amount Paid:</span>
                                        <span className="fw-bold text-success fs-6">
                                            BDT {appointment?.paid_amount || payment?.amount || '1,200.00'}
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center mb-1 text-muted small">
                                        <span>Payment Status:</span>
                                        <span className="badge bg-success py-1 px-2">PAID</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center text-muted small">
                                        <span>Method:</span>
                                        <span className="fw-semibold text-dark">
                                            {payment?.card_brand || payment?.card_type || 'Online Gateway (SSLCommerz)'}
                                        </span>
                                    </div>
                                    {payment?.tran_id && (
                                        <div className="d-flex justify-content-between align-items-center text-muted small mt-1">
                                            <span>Trx ID:</span>
                                            <span className="font-monospace small">{payment.tran_id}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Slip Actions & Downloads: Booking Slip, Payment Slip & Prescription PDF */}
                        <div className="no-print pt-3 border-top d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
                            <SlipsActionCenter
                                appointment={appointment}
                                patient={patient}
                                doctor={doctor}
                                specialityName={specialityName}
                                payment={payment}
                                tranId={tranId}
                            />
                            <div className="d-flex gap-2 justify-content-center justify-content-sm-start">
                                <Link href="/patient/appointments" className="btn btn-outline-primary d-inline-flex align-items-center gap-1">
                                    <ArrowRight size={16} />
                                    <span>My Appointments</span>
                                </Link>
                                <Link href="/" className="btn btn-success d-inline-flex align-items-center gap-1 text-white" style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }}>
                                    <Home size={16} />
                                    <span>Home</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
