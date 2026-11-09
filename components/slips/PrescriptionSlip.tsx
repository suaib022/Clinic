'use client';

import React from 'react';
import BarcodeSvg from './BarcodeSvg';
import { differenceInYears, differenceInMonths, differenceInDays, addYears, addMonths } from 'date-fns';

export interface PrescriptionSlipProps {
    appointment: any;
    patient: any;
    doctor: any;
    specialityName?: string;
    payment?: any;
}

export function calculateDetailedAge(dobString?: string): string {
    if (!dobString) return '28Y 06M 15D';
    try {
        const dob = new Date(dobString);
        const now = new Date();
        const y = differenceInYears(now, dob);
        const dateAfterY = addYears(dob, y);
        const m = differenceInMonths(now, dateAfterY);
        const dateAfterM = addMonths(dateAfterY, m);
        const d = differenceInDays(now, dateAfterM);
        return `${String(y).padStart(2, '0')}Y ${String(m).padStart(2, '0')}M ${String(d).padStart(2, '0')}D`;
    } catch {
        return '28Y 06M 15D';
    }
}

export default function PrescriptionSlip({
    appointment,
    patient,
    doctor,
    specialityName = 'Medicine Specialist',
    payment
}: PrescriptionSlipProps) {
    const patientName = patient?.full_name?.toUpperCase() || 'SAFI';
    const uhid = patient?.uhid || 'UHID61569802';
    const patientNumericId = uhid.replace(/\D/g, '') || '2504026023';
    const ticketId = `RX${patientNumericId.slice(-6)}${appointment?.serial_no || '22'}`;
    const ageString = calculateDetailedAge(patient?.dob);
    const visitDateStr = appointment?.appointment_date || new Date().toISOString().split('T')[0];
    const slotTimeStr = appointment?.start_time || '12:30:00';
    const feeAmount = appointment?.paid_amount || payment?.amount || '1100';
    const serialNo = appointment?.serial_no || '22';
    const doctorName = doctor?.full_name ? `Dr. ${doctor.full_name.replace(/^Dr\.?\s*/i, '')}` : 'Dr. Abed Hussain Khan';

    const printTimestamp = new Date().toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

    return (
        <div
            id="prescription-slip-sheet"
            style={{
                width: '100%',
                maxWidth: '794px', // A4 width at 96 DPI
                minHeight: '1123px', // A4 height at 96 DPI
                margin: '0 auto',
                backgroundColor: '#ffffff',
                color: '#000000',
                fontFamily: '"Times New Roman", Times, "SolaimanLipi", serif',
                padding: '30px 38px 24px 38px',
                boxSizing: 'border-box',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}
        >
            <div>
                {/* 1. Header with Government/Hospital Emblem on Left, Hospital Name in Center, Medical Cross on Right */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    {/* Left Emblem */}
                    <div style={{ width: '70px', height: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="68" height="68" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="#0D7D72" stroke="#004d40" strokeWidth="3" />
                            <circle cx="50" cy="50" r="32" fill="#d32f2f" />
                            <polygon points="50,24 57,40 74,40 60,50 66,66 50,56 34,66 40,50 26,40 43,40" fill="#ffd700" />
                            <circle cx="50" cy="50" r="48" fill="none" stroke="#ffd700" strokeWidth="2" strokeDasharray="3 3" />
                        </svg>
                    </div>

                    {/* Center Hospital Name & Contact */}
                    <div style={{ textAlign: 'center', flexGrow: 1, padding: '0 10px' }}>
                        <h2 style={{ margin: 0, fontSize: '21px', fontWeight: 'bold', color: '#000000', letterSpacing: '-0.3px' }}>
                            ক্লিনিক মাল্টিক্যার স্পেশালাইজড হাসপাতাল
                        </h2>
                        <h3 style={{ margin: '2px 0 0 0', fontSize: '17px', fontWeight: 'bold', color: '#000000' }}>
                            Clinic Multicare Specialized Hospital
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '11.5px', color: '#000000' }}>
                            Address: New airport Road, Dhaka Cantonment, Dhaka 1206
                        </p>
                        <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#000000' }}>
                            Contact: 02-55062388 | Email: info@clinic.hospital | Hotline: 10606
                        </p>
                    </div>

                    {/* Right Medical Emblem */}
                    <div style={{ width: '70px', height: '70px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="68" height="68" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="46" fill="#e8f5e9" stroke="#2e7d32" strokeWidth="3" />
                            <rect x="42" y="22" width="16" height="56" rx="2" fill="#d32f2f" />
                            <rect x="22" y="42" width="56" height="16" rx="2" fill="#d32f2f" />
                            <circle cx="50" cy="50" r="10" fill="#ffffff" />
                            <text x="50" y="90" fontSize="10" fontWeight="bold" textAnchor="middle" fill="#2e7d32">HOSPITAL</text>
                        </svg>
                    </div>
                </div>

                {/* 2. Double Horizontal Rule Divider */}
                <div style={{ borderTop: '2px solid #000000', borderBottom: '1px solid #000000', height: '3px', margin: '6px 0 10px 0' }} />

                {/* 3. Document Title */}
                <div style={{ textAlign: 'center', margin: '4px 0 12px 0' }}>
                    <span style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1.5px solid #000000', paddingBottom: '2px' }}>
                        OPD TICKET
                    </span>
                </div>

                {/* 4. Patient Information & Ticket Meta Grid */}
                <div style={{ width: '100%', marginBottom: '10px', fontSize: '12.5px', lineHeight: '1.45' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '36% 36% 28%', gap: '8px', alignItems: 'start' }}>
                        {/* Col 1 */}
                        <div>
                            <div><strong>Ticket ID</strong> : {ticketId}</div>
                            <div><strong>Patient ID</strong> : PT{patientNumericId}</div>
                            <div><strong>National ID Number</strong> : -</div>
                            <div><strong>Category</strong> : Online</div>
                            <div><strong>Ticket Price</strong> : {feeAmount} BDT</div>
                            <div><strong>Visit Date</strong> : {visitDateStr} ({slotTimeStr})</div>
                        </div>

                        {/* Col 2 */}
                        <div>
                            <div><strong>Name</strong> : {patientName}</div>
                            <div><strong>Age</strong> : {ageString}</div>
                            <div><strong>Contact</strong> : {patient?.mobile_no || '01867271008'}</div>
                            <div><strong>Gender</strong> : {patient?.gender || 'Male'}</div>
                        </div>

                        {/* Col 3: Health ID & Vertical Barcode */}
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <div style={{ marginBottom: '6px' }}><strong>Health ID</strong> : {uhid}</div>
                            <BarcodeSvg value={ticketId} height={36} fontSize={9} />
                        </div>
                    </div>
                </div>

                {/* 5. Department & Room Banner Box */}
                <div
                    style={{
                        border: '1.5px solid #000000',
                        padding: '6px 12px',
                        fontWeight: 'bold',
                        fontSize: '13.5px',
                        backgroundColor: '#ffffff',
                        marginBottom: '14px'
                    }}
                >
                    Department: {specialityName} ({doctorName}) পুরুষ কক্ষ-৩৭৩-এ (Serial: {serialNo})
                </div>

                {/* 6. Prescription Body with Large Latin ℞ & Clinical Margin */}
                <div style={{ display: 'flex', minHeight: '520px', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                    {/* Left Column: Clinical Notes / Vitals */}
                    <div
                        style={{
                            width: '32%',
                            borderRight: '1.5px solid #000000',
                            paddingRight: '14px',
                            fontSize: '12px',
                            lineHeight: '1.6'
                        }}
                    >
                        <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', textDecoration: 'underline' }}>
                            Clinical Assessment
                        </div>
                        <div style={{ marginBottom: '14px' }}>
                            <strong>Chief Complaints (C/C):</strong>
                            <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }} />
                            <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }} />
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <strong>On Examination (O/E):</strong>
                            <div style={{ marginTop: '4px' }}>• BP : ______ / ______ mmHg</div>
                            <div style={{ marginTop: '2px' }}>• Pulse : ______ bpm</div>
                            <div style={{ marginTop: '2px' }}>• Weight : ______ kg</div>
                            <div style={{ marginTop: '2px' }}>• Temp : ______ °F</div>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                            <strong>Investigations (Advised):</strong>
                            <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }} />
                            <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }} />
                            <div style={{ borderBottom: '1px dotted #94a3b8', height: '22px' }} />
                        </div>
                    </div>

                    {/* Right Column: Traditional ℞ Prescription Treatment Area */}
                    <div style={{ width: '68%', paddingLeft: '18px', position: 'relative' }}>
                        <div
                            style={{
                                fontFamily: '"Times New Roman", Times, serif',
                                fontSize: '34px',
                                fontWeight: 'bold',
                                lineHeight: '1',
                                marginBottom: '14px'
                            }}
                        >
                            ℞
                        </div>

                        {/* Blank guided lines for physician's medication handwriting or digital prescription entries */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px', marginTop: '16px' }}>
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                            <div style={{ borderBottom: '1px dashed #cbd5e1', height: '10px' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 7. Bottom Signature & Follow-up Section */}
            <div>
                {/* Doctor Signature Block on Right */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '18px' }}>
                    <div style={{ textAlign: 'left', minWidth: '220px', fontSize: '12px', lineHeight: '1.35' }}>
                        <div style={{ borderTop: '1px solid #000000', paddingTop: '4px', marginBottom: '2px' }}>
                            <strong>Signature & Seal</strong>
                        </div>
                        <div>Name: {doctorName}</div>
                        <div>Designation: {specialityName}</div>
                        <div>BMDC Reg No.: A-48291</div>
                    </div>
                </div>

                {/* Follow-up Notes & Bengali Instructions */}
                <div
                    style={{
                        borderTop: '1px solid #000000',
                        borderBottom: '1px solid #000000',
                        padding: '6px 0',
                        textAlign: 'center',
                        fontSize: '12.5px',
                        lineHeight: '1.45'
                    }}
                >
                    <div>
                        পরবর্তী সাক্ষাত: ___________________ দিন / সপ্তাহ / মাস পর
                    </div>
                    <div style={{ fontSize: '11.5px', marginTop: '2px' }}>
                        বি.দ্র: পরবর্তী সাক্ষাতকারে প্রয়োজনীয় কাগজপত্র সহ টিকিটটি সঙ্গে নিয়ে আসবেন
                    </div>
                    <div style={{ fontSize: '11px', color: '#334155', marginTop: '1px' }}>
                        Note: This ticket is valid for consultation on {visitDateStr} ({slotTimeStr})
                    </div>
                </div>

                {/* Footer Meta: Powered by & Printed by */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '9.5px',
                        color: '#64748b',
                        paddingTop: '6px',
                        fontFamily: 'sans-serif'
                    }}
                >
                    <div>Powered By: Clinic Healthcare Hospital Management System</div>
                    <div>Printed By: {patientName}, at Online Ticket Counter, {printTimestamp}</div>
                </div>
            </div>
        </div>
    );
}

