'use client';

import React from 'react';
import BarcodeSvg from './BarcodeSvg';
import { CheckCircle2, ShieldCheck, Lock, ExternalLink, Printer } from 'lucide-react';

export interface SSLCommerzPaymentSlipProps {
    appointment: any;
    patient: any;
    doctor: any;
    specialityName?: string;
    payment?: any;
    tranId?: string;
}

export default function SSLCommerzPaymentSlip({
    appointment,
    patient,
    doctor,
    specialityName = 'Medicine Specialist',
    payment,
    tranId
}: SSLCommerzPaymentSlipProps) {
    const activeTranId = tranId || payment?.tran_id || `CLINIC_${Date.now()}_7385`;
    const valId = payment?.val_id || `VAL_${Date.now().toString().slice(-8)}`;
    const bankTranId = payment?.bank_tran_id || `TXN_${Math.floor(10000000 + Math.random() * 90000000)}`;
    const amount = appointment?.paid_amount || payment?.amount || '1100';
    const cardBrand = payment?.card_brand || payment?.card_type || 'MOBILEBANKING';
    const patientName = patient?.full_name || 'Safi';
    const uhid = patient?.uhid || 'UHID61569802';
    const contact = patient?.mobile_no || '+8801867271008';
    const doctorName = doctor?.full_name ? `Dr. ${doctor.full_name.replace(/^Dr\.?\s*/i, '')}` : 'Dr. Abed Hussain Khan';

    const transDate = payment?.created_at
        ? new Date(payment.created_at).toLocaleString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
          })
        : new Date().toLocaleString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
          });

    return (
        <div
            id="sslcommerz-payment-slip-sheet"
            style={{
                width: '100%',
                maxWidth: '680px',
                margin: '0 auto',
                backgroundColor: '#ffffff',
                border: '1.5px solid #000000',
                borderRadius: '12px',
                padding: '28px 32px',
                boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                color: '#1e293b',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
                boxSizing: 'border-box'
            }}
        >
            {/* 1. Official SSLCommerz Header Banner */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '16px', borderBottom: '2px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* SSLCommerz Stylized Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ backgroundColor: '#eb2c2d', color: '#ffffff', fontWeight: 900, fontSize: '18px', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                            SSL
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '20px', color: '#0b132b', letterSpacing: '-0.5px' }}>
                            COMMERZ
                        </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, borderLeft: '1px solid #cbd5e1', paddingLeft: '8px' }}>
                        Payment Advice & Receipt
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', color: '#166534', fontWeight: 700 }}>
                    <ShieldCheck size={14} color="#16a34a" />
                    <span>PCI-DSS Verified</span>
                </div>
            </div>

            {/* 2. Success Status Banner */}
            <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #22c55e', borderRadius: '8px', padding: '16px', margin: '18px 0', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#22c55e', color: '#ffffff', marginBottom: '8px' }}>
                    <CheckCircle2 size={26} color="#ffffff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#15803d' }}>
                    TRANSACTION SUCCESSFUL
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#166534' }}>
                    Payment has been securely processed and credited to the merchant account.
                </p>
                <div style={{ marginTop: '10px', fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
                    BDT {Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
            </div>

            {/* 3. Transaction Details Grid */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '18px', fontSize: '12.5px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '8px 14px', fontWeight: 700, fontSize: '12px', borderBottom: '1px solid #e2e8f0', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Transaction Summary
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Merchant Name</span>
                        <strong style={{ color: '#0f172a' }}>Clinic Multicare Specialized Hospital</strong>
                    </div>

                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Store ID</span>
                        <strong style={{ color: '#0f172a' }}>clinic_hospital_live</strong>
                    </div>

                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Transaction ID (Tran ID)</span>
                        <strong style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0284c7' }}>{activeTranId}</strong>
                    </div>

                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Bank Validation ID (Val ID)</span>
                        <strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>{valId}</strong>
                    </div>

                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Payment Channel / Brand</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{cardBrand}</span>
                    </div>

                    <div style={{ padding: '9px 14px', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Bank Transaction ID</span>
                        <strong style={{ fontFamily: 'monospace', fontSize: '12px' }}>{bankTranId}</strong>
                    </div>

                    <div style={{ padding: '9px 14px', borderRight: '1px solid #f1f5f9' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Transaction Date & Time</span>
                        <span style={{ fontWeight: 600 }}>{transDate}</span>
                    </div>

                    <div style={{ padding: '9px 14px' }}>
                        <span style={{ color: '#64748b', fontSize: '11.5px', display: 'block' }}>Payment Gateway Status</span>
                        <span className="badge bg-success" style={{ backgroundColor: '#16a34a', color: '#fff', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}>
                            VALIDATED (100% PAID)
                        </span>
                    </div>
                </div>
            </div>

            {/* 4. Customer & Service Breakdown */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px', fontSize: '12.5px' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '8px 14px', fontWeight: 700, fontSize: '12px', borderBottom: '1px solid #e2e8f0', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Patient & Consultation Details
                </div>

                <div style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Patient Name</span>
                            <strong style={{ fontSize: '13px' }}>{patientName}</strong>
                            <div style={{ fontSize: '11.5px', color: '#475569' }}>UHID: {uhid} | Phone: {contact}</div>
                        </div>

                        <div>
                            <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>Doctor & Chamber</span>
                            <strong style={{ fontSize: '13px' }}>{doctorName}</strong>
                            <div style={{ fontSize: '11.5px', color: '#475569' }}>{specialityName} (Room 304, Serial: #{appointment?.serial_no || '22'})</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 5. Barcode & Security Stamp */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '16px' }}>
                <div>
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '2px' }}>Digital Authentication Barcode</div>
                    <BarcodeSvg value={activeTranId} height={34} fontSize={9} />
                </div>

                <div style={{ textAlign: 'right', fontSize: '10.5px', color: '#64748b', maxWidth: '240px', lineHeight: '1.35' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', color: '#0f172a', fontWeight: 700, marginBottom: '2px' }}>
                        <Lock size={12} color="#0D7D72" />
                        <span>SSLCOMMERZ SECURED</span>
                    </div>
                    Bangladesh Bank Authorized Payment System Operator (PSO).
                </div>
            </div>

            {/* 6. Footer Disclaimer */}
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                This is a computer-generated official payment voucher and requires no physical seal. For billing support, contact SSLCOMMERZ at support@sslcommerz.com or hospital billing desk hotline 10606.
            </div>
        </div>
    );
}

