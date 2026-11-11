'use client';

import React from 'react';
import BarcodeSvg from './BarcodeSvg';
import { Calendar, Clock, MapPin, User, Stethoscope, CheckCircle2, AlertCircle } from 'lucide-react';

export interface BookingSlipProps {
    appointment: any;
    patient: any;
    doctor: any;
    specialityName?: string;
    payment?: any;
}

export default function BookingSlip({
    appointment,
    patient,
    doctor,
    specialityName = 'Medicine Specialist',
    payment
}: BookingSlipProps) {
    const serialNo = appointment?.serial_no || '22';
    const patientName = patient?.full_name || 'Safi';
    const uhid = patient?.uhid || 'UHID61569802';
    const contact = patient?.mobile_no || '+8801867271008';
    const doctorName = doctor?.full_name ? `Dr. ${doctor.full_name.replace(/^Dr\.?\s*/i, '')}` : 'Dr. Abed Hussain Khan';
    const apptDate = appointment?.appointment_date || new Date().toISOString().split('T')[0];
    const slotTime = appointment?.start_time || '12:30 PM';
    const bookingRef = appointment?.id ? `APT-${appointment.id.slice(0, 8).toUpperCase()}` : `APT-2026-881290`;
    const feeAmount = appointment?.paid_amount || payment?.amount || '1100';

    return (
        <div
            id="appointment-booking-slip-sheet"
            style={{
                width: '100%',
                maxWidth: '680px',
                margin: '0 auto',
                backgroundColor: '#ffffff',
                border: '2px solid #000000',
                borderRadius: '12px',
                padding: '28px 32px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                color: '#1e293b',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                boxSizing: 'border-box'
            }}
        >
            {/* 1. Header with Hospital Crest and Details */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px', borderBottom: '2px solid #000000' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#1B2978', letterSpacing: '-0.3px' }}>
                        Clinic Multicare Specialized Hospital
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#475569' }}>
                        New Airport Road, Dhaka Cantonment, Dhaka 1206 | Hotline: 10606
                    </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                    <span style={{ backgroundColor: '#1B2978', color: '#ffffff', fontWeight: 700, fontSize: '11px', padding: '3px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                        Official Booking Pass
                    </span>
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>Ref: {bookingRef}</div>
                </div>
            </div>

            {/* 2. Prominent Queue Serial Token */}
            <div style={{ backgroundColor: '#f0fdf4', border: '2px solid #1B2978', borderRadius: '10px', padding: '16px', margin: '18px 0', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#1B2978', display: 'block' }}>
                    Chamber Queue Serial Token
                </span>
                <div style={{ fontSize: '48px', fontWeight: 900, color: '#1B2978', lineHeight: '1.1', margin: '4px 0' }}>
                    #{serialNo}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>
                    Please arrive at least 15 minutes prior to scheduled slot time.
                </div>
            </div>

            {/* 3. Appointment & Doctor Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '12.5px' }}>
                {/* Doctor Box */}
                <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1B2978', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        <Stethoscope size={15} />
                        <span>Doctor & Chamber</span>
                    </div>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block' }}>{doctorName}</strong>
                    <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>{specialityName}</div>
                    <div style={{ color: '#1B2978', fontWeight: 600, fontSize: '12px', marginTop: '4px' }}>Room 304 (3rd Floor)</div>
                </div>

                {/* Date & Time Box */}
                <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '12px', backgroundColor: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1B2978', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
                        <Calendar size={15} />
                        <span>Appointment Time</span>
                    </div>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a', display: 'block' }}>{apptDate}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontSize: '12px', marginTop: '2px' }}>
                        <Clock size={13} />
                        <span>Reporting Slot: {slotTime}</span>
                    </div>
                    <div style={{ color: '#16a34a', fontWeight: 700, fontSize: '11.5px', marginTop: '4px' }}>
                        ● Slot Confirmed
                    </div>
                </div>
            </div>

            {/* 4. Patient Information & Billing Row */}
            <div style={{ border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '12px 14px', backgroundColor: '#ffffff', marginBottom: '16px', fontSize: '12.5px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                    <div>
                        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                            Patient Information
                        </div>
                        <strong style={{ fontSize: '13.5px' }}>{patientName}</strong>
                        <div style={{ color: '#475569', fontSize: '12px', marginTop: '2px' }}>
                            UHID: <strong>{uhid}</strong> | Phone: {contact}
                        </div>
                    </div>

                    <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '14px' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>
                            Payment Verification
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#475569' }}>Fee: BDT {feeAmount}</span>
                            <span style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700, fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>
                                PAID ONLINE
                            </span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>
                            Trx: {payment?.tran_id || 'CLINIC_VERIFIED'}
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Patient Checklist Instructions */}
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '11.5px', color: '#92400e' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Patient Checklist & Chamber Rules:</strong>
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: '1.5' }}>
                    <li>Please report to the Vital/Triage Counter at least 15 minutes before your slot time.</li>
                    <li>Present this appointment slip or your UHID at Room 304 reception.</li>
                    <li>Bring previous prescriptions, diagnostic lab reports, or discharge certificates.</li>
                </ul>
            </div>

            {/* 6. Scanner Barcode & Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <BarcodeSvg value={bookingRef} height={34} fontSize={9} />
                <div style={{ textAlign: 'right', fontSize: '10px', color: '#94a3b8' }}>
                    <div>Clinic Healthcare Hospital System • Online Reception Desk</div>
                    <div>Valid on appointment date only. For assistance, dial 10606.</div>
                </div>
            </div>
        </div>
    );
}

