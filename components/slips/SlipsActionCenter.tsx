'use client';

import React, { useState, useRef } from 'react';
import { Printer, Download, CreditCard, FileText, CheckCircle2, X, ExternalLink, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PrescriptionSlip from './PrescriptionSlip';
import SSLCommerzPaymentSlip from './SSLCommerzPaymentSlip';
import BookingSlip from './BookingSlip';

interface SlipsActionCenterProps {
    appointment: any;
    patient: any;
    doctor: any;
    specialityName?: string;
    payment?: any;
    tranId?: string;
}

export default function SlipsActionCenter({
    appointment,
    patient,
    doctor,
    specialityName,
    payment,
    tranId
}: SlipsActionCenterProps) {
    const [activeModal, setActiveModal] = useState<'prescription' | 'payment' | 'booking' | null>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const hiddenPrescriptionRef = useRef<HTMLDivElement>(null);

    // Direct PDF generator using html2canvas + jsPDF matching exact sample-pres.pdf
    const handleDownloadPrescriptionPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            // Find or use the hidden render container
            const element = hiddenPrescriptionRef.current || document.getElementById('prescription-slip-sheet');
            if (!element) {
                setActiveModal('prescription');
                setIsGeneratingPdf(false);
                return;
            }

            const canvas = await html2canvas(element, {
                scale: 2, // High resolution rendering
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            const fileName = `Prescription-${patient?.uhid || 'UHID'}-${appointment?.serial_no || '22'}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('Error generating PDF:', err);
            // Fallback: open prescription modal and trigger print
            setActiveModal('prescription');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handlePrintElement = (elementId: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            window.print();
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Document | Clinic</title>
                    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet" />
                    <style>
                        body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 8mm; size: auto; }
                        }
                    </style>
                </head>
                <body>
                    ${element.outerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 350);
    };

    return (
        <div>
            {/* Action Buttons Toolbar on Confirmation Page */}
            <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-sm-start">
                {/* 1. Print Booking Slip */}
                <button
                    type="button"
                    onClick={() => setActiveModal('booking')}
                    className="btn btn-primary d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold"
                    style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }}
                >
                    <Printer size={16} />
                    <span>Print Booking Slip</span>
                </button>

                {/* 2. SSLCommerz Payment Slip */}
                <button
                    type="button"
                    onClick={() => setActiveModal('payment')}
                    className="btn btn-outline-dark d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold"
                    style={{ borderColor: '#000000', backgroundColor: '#ffffff', color: '#000000' }}
                >
                    <CreditCard size={16} color="#eb2c2d" />
                    <span>Payment Slip (SSLCommerz)</span>
                </button>

                {/* 3. Download Prescription (sample-pres.pdf exact replica) */}
                <button
                    type="button"
                    onClick={handleDownloadPrescriptionPdf}
                    disabled={isGeneratingPdf}
                    className="btn btn-outline-success d-inline-flex align-items-center gap-2 px-3 py-2 fw-semibold"
                    style={{ borderColor: '#16a34a', color: '#15803d', backgroundColor: '#f0fdf4' }}
                >
                    {isGeneratingPdf ? <Loader2 size={16} className="spinner-border spinner-border-sm" /> : <Download size={16} />}
                    <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Prescription (PDF)'}</span>
                </button>
            </div>

            {/* Hidden Off-Screen Container for Instant PDF Export */}
            <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '794px' }}>
                <div ref={hiddenPrescriptionRef}>
                    <PrescriptionSlip
                        appointment={appointment}
                        patient={patient}
                        doctor={doctor}
                        specialityName={specialityName}
                        payment={payment}
                    />
                </div>
            </div>

            {/* Modal: Interactive Viewer & Print Window */}
            {activeModal && (
                <div
                    className="modal d-block"
                    tabIndex={-1}
                    style={{
                        backgroundColor: 'rgba(0, 0, 0, 0.65)',
                        zIndex: 1060,
                        overflowY: 'auto'
                    }}
                >
                    <div
                        className="modal-dialog modal-dialog-centered"
                        style={{
                            maxWidth: activeModal === 'prescription' ? '860px' : '740px',
                            margin: '1.75rem auto'
                        }}
                    >
                        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                            {/* Modal Header */}
                            <div className="modal-header text-white d-flex align-items-center justify-content-between px-4 py-3" style={{ backgroundColor: '#0D7D72' }}>
                                <div className="d-flex align-items-center gap-2">
                                    {activeModal === 'prescription' && <FileText size={18} />}
                                    {activeModal === 'payment' && <CreditCard size={18} />}
                                    {activeModal === 'booking' && <Printer size={18} />}
                                    <h5 className="modal-title fw-bold m-0" style={{ fontSize: '16px' }}>
                                        {activeModal === 'prescription' && 'OPD Ticket & Prescription (sample-pres.pdf)'}
                                        {activeModal === 'payment' && 'Official SSLCommerz Payment Slip'}
                                        {activeModal === 'booking' && 'Appointment Booking Token Slip'}
                                    </h5>
                                </div>

                                <div className="d-flex align-items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const targetId =
                                                activeModal === 'prescription'
                                                    ? 'modal-prescription-content'
                                                    : activeModal === 'payment'
                                                    ? 'sslcommerz-payment-slip-sheet'
                                                    : 'appointment-booking-slip-sheet';
                                            handlePrintElement(targetId);
                                        }}
                                        className="btn btn-sm btn-light d-inline-flex align-items-center gap-1.5 fw-semibold"
                                        title="Print Document"
                                    >
                                        <Printer size={14} />
                                        <span>Print</span>
                                    </button>

                                    {activeModal === 'prescription' && (
                                        <button
                                            type="button"
                                            onClick={handleDownloadPrescriptionPdf}
                                            disabled={isGeneratingPdf}
                                            className="btn btn-sm btn-warning d-inline-flex align-items-center gap-1.5 fw-semibold text-dark"
                                            title="Download PDF"
                                        >
                                            <Download size={14} />
                                            <span>Download PDF</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => setActiveModal(null)}
                                        className="btn-close btn-close-white"
                                        aria-label="Close"
                                    />
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="modal-body p-3 p-md-4 bg-light" style={{ maxHeight: 'calc(85vh - 70px)', overflowY: 'auto' }}>
                                {activeModal === 'prescription' && (
                                    <div id="modal-prescription-content">
                                        <PrescriptionSlip
                                            appointment={appointment}
                                            patient={patient}
                                            doctor={doctor}
                                            specialityName={specialityName}
                                            payment={payment}
                                        />
                                    </div>
                                )}

                                {activeModal === 'payment' && (
                                    <SSLCommerzPaymentSlip
                                        appointment={appointment}
                                        patient={patient}
                                        doctor={doctor}
                                        specialityName={specialityName}
                                        payment={payment}
                                        tranId={tranId}
                                    />
                                )}

                                {activeModal === 'booking' && (
                                    <BookingSlip
                                        appointment={appointment}
                                        patient={patient}
                                        doctor={doctor}
                                        specialityName={specialityName}
                                        payment={payment}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

