'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parse } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getStatusLabel, getStatusBadgeColor } from '@/lib/appointmentStatus';
import { getAppointmentFeedbackStatus, FeedbackInfo } from '@/lib/feedbackStatus';
import { 
    submitAppointmentFeedback, 
    requestAppointmentRefund, 
    rebookCancelledAppointment 
} from '@/app/patient/actions';
import PrescriptionSlip from '@/components/slips/PrescriptionSlip';
import BookingSlip from '@/components/slips/BookingSlip';
import { 
    FileText, 
    Download, 
    Printer, 
    Eye, 
    Calendar, 
    Clock, 
    User, 
    CreditCard, 
    CheckCircle2, 
    AlertCircle, 
    ExternalLink, 
    Search, 
    Filter,
    X,
    Loader2
} from 'lucide-react';

export interface AppointmentRow {
    id: string;
    serial_no: number | null;
    appointment_date: string;
    start_time: string;
    status: string;
    patient_id: string;
    doctor_id?: string;
    prescription_record_id?: string | null;
    cancelled_at?: string | null;
    cancelled_by_role?: string | null;
    cancel_reason?: string | null;
    payment_status?: string | null;
    paid_amount?: number | string | null;
    refund_status?: string | null;
    doctors?: { id?: string; full_name: string; avatar_url?: string } | null;
    medical_records?: Array<{ id: string; title: string; file_path: string; record_type: string }> | null;
    appointment_feedbacks?: FeedbackInfo | FeedbackInfo[] | null;
}

export interface PatientProfile {
    id: string;
    uhid?: string;
    full_name: string;
    gender?: string;
    dob?: string;
    mobile_no?: string;
    email?: string;
    address?: string;
    city?: string;
}

export interface DoctorOption {
    id: string;
    full_name: string;
}

interface Props {
    initialAppointments: AppointmentRow[];
    patients: PatientProfile[];
    availableDoctors?: DoctorOption[];
    payments?: any[];
    docSpecsMap?: Record<string, string>;
}

type TimeTab = 'all' | 'upcoming' | 'today' | 'prev';

const RATING_DESCRIPTIONS: Record<number, string> = {
    1: 'Poor (1/5)',
    2: 'Fair (2/5)',
    3: 'Average (3/5)',
    4: 'Very Good (4/5)',
    5: 'Excellent (5/5)'
};

function StarRating({ 
    value, 
    onChange, 
    disabled = false 
}: { 
    value: number; 
    onChange?: (val: number) => void; 
    disabled?: boolean;
}) {
    const [hover, setHover] = useState(0);

    return (
        <div className="d-flex align-items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = hover ? star <= hover : star <= value;
                return (
                    <button
                        key={star}
                        type="button"
                        className="btn p-0 border-0 bg-transparent text-warning"
                        style={{ cursor: disabled ? 'default' : 'pointer', fontSize: '1.4rem', lineHeight: 1 }}
                        disabled={disabled}
                        onMouseEnter={() => !disabled && setHover(star)}
                        onMouseLeave={() => !disabled && setHover(0)}
                        onClick={() => !disabled && onChange && onChange(star)}
                    >
                        <i className={`bi ${isFilled ? 'bi-star-fill text-warning' : 'bi-star text-secondary text-opacity-50'}`}></i>
                    </button>
                );
            })}
            <span className="ms-2 small text-muted fw-semibold">
                {RATING_DESCRIPTIONS[hover || value] || 'Select rating'}
            </span>
        </div>
    );
}

export default function PatientAppointmentsTable({ 
    initialAppointments, 
    patients, 
    availableDoctors = [],
    payments = [],
    docSpecsMap = {}
}: Props) {
    const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
    
    // Filtering states
    const [selectedTimeTab, setSelectedTimeTab] = useState<TimeTab>('all');
    const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Detail modal state
    const [detailModalAppt, setDetailModalAppt] = useState<AppointmentRow | null>(null);

    // Direct PDF generator states
    const [generatingPdfKey, setGeneratingPdfKey] = useState<string | null>(null);
    const [activeSlipTarget, setActiveSlipTarget] = useState<{
        appt: AppointmentRow;
        type: 'booking' | 'prescription';
    } | null>(null);

    const hiddenSlipRef = useRef<HTMLDivElement>(null);

    // Feedback submission modal state
    const [activeFeedbackAppt, setActiveFeedbackAppt] = useState<AppointmentRow | null>(null);
    const [doctorRating, setDoctorRating] = useState<number>(5);
    const [serviceRating, setServiceRating] = useState<number>(5);
    const [comment, setComment] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // View submitted feedback modal state
    const [viewFeedbackAppt, setViewFeedbackAppt] = useState<{
        appt: AppointmentRow;
        feedback: FeedbackInfo;
    } | null>(null);

    // Refund Modal state
    const [refundModalAppt, setRefundModalAppt] = useState<AppointmentRow | null>(null);
    const [isProcessingRefund, setIsProcessingRefund] = useState<boolean>(false);
    const [refundError, setRefundError] = useState<string | null>(null);

    // Rebook Modal state
    const [rebookModalAppt, setRebookModalAppt] = useState<AppointmentRow | null>(null);
    const [rebookDoctorId, setRebookDoctorId] = useState<string>('');
    const [rebookDate, setRebookDate] = useState<string>('');
    const [rebookTime, setRebookTime] = useState<string>('10:00:00');
    const [isProcessingRebook, setIsProcessingRebook] = useState<boolean>(false);
    const [rebookError, setRebookError] = useState<string | null>(null);

    const [payingApptId, setPayingApptId] = useState<string | null>(null);
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Lock body scroll when any modal is open
    useEffect(() => {
        const hasOpenModal = !!(detailModalAppt || activeFeedbackAppt || viewFeedbackAppt || refundModalAppt || rebookModalAppt);
        if (hasOpenModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [detailModalAppt, activeFeedbackAppt, viewFeedbackAppt, refundModalAppt, rebookModalAppt]);

    // Handle Escape key to close modals
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (detailModalAppt) setDetailModalAppt(null);
                if (activeFeedbackAppt && !isSubmitting) setActiveFeedbackAppt(null);
                if (viewFeedbackAppt) setViewFeedbackAppt(null);
                if (refundModalAppt && !isProcessingRefund) setRefundModalAppt(null);
                if (rebookModalAppt && !isProcessingRebook) setRebookModalAppt(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [detailModalAppt, activeFeedbackAppt, isSubmitting, viewFeedbackAppt, refundModalAppt, isProcessingRefund, rebookModalAppt, isProcessingRebook]);

    // Classify time helper
    const classifyTime = (aptDate: string, startTime: string) => {
        try {
            const now = toZonedTime(new Date(), 'Asia/Dhaka');
            const todayStr = format(now, 'yyyy-MM-dd');
            const currentTimeStr = format(now, 'HH:mm:ss');

            const isToday = aptDate === todayStr;
            const isFutureDate = aptDate > todayStr;
            const isPastDate = aptDate < todayStr;

            // Upcoming: future date OR (today with future/current time)
            const isUpcoming = isFutureDate || (isToday && (startTime || '23:59:59') >= currentTimeStr);
            // Previous: past date OR (today with past time)
            const isPrevious = isPastDate || (isToday && (startTime || '00:00:00') < currentTimeStr);

            return { isToday, isUpcoming, isPrevious };
        } catch {
            return { isToday: false, isUpcoming: false, isPrevious: true };
        }
    };

    // Calculate counts for tabs
    const timeCounts = useMemo(() => {
        let all = 0;
        let upcoming = 0;
        let today = 0;
        let prev = 0;

        const baseList = selectedPatientId === 'all'
            ? appointments
            : appointments.filter(a => a.patient_id === selectedPatientId);

        baseList.forEach(a => {
            all++;
            const { isToday, isUpcoming, isPrevious } = classifyTime(a.appointment_date, a.start_time);
            if (isUpcoming) upcoming++;
            if (isToday) today++;
            if (isPrevious) prev++;
        });

        return { all, upcoming, today, prev };
    }, [appointments, selectedPatientId]);

    // Filter appointments
    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            // Patient filter
            if (selectedPatientId !== 'all' && a.patient_id !== selectedPatientId) {
                return false;
            }

            // Time Tab filter
            if (selectedTimeTab !== 'all') {
                const { isToday, isUpcoming, isPrevious } = classifyTime(a.appointment_date, a.start_time);
                if (selectedTimeTab === 'upcoming' && !isUpcoming) return false;
                if (selectedTimeTab === 'today' && !isToday) return false;
                if (selectedTimeTab === 'prev' && !isPrevious) return false;
            }

            // Text search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const p = patients.find(pat => pat.id === a.patient_id);
                const docName = a.doctors?.full_name?.toLowerCase() || '';
                const patName = p?.full_name?.toLowerCase() || '';
                const uhid = p?.uhid?.toLowerCase() || '';
                const serial = String(a.serial_no || '');
                if (!docName.includes(q) && !patName.includes(q) && !uhid.includes(q) && !serial.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [appointments, selectedPatientId, selectedTimeTab, searchQuery, patients]);

    // Download PDF Generator (jsPDF + html2canvas)
    const handleDownloadSlipPdf = async (apt: AppointmentRow, type: 'booking' | 'prescription') => {
        const key = `${apt.id}_${type}`;
        setGeneratingPdfKey(key);
        setActiveSlipTarget({ appt: apt, type });

        // Wait a tick for hidden render tree to mount
        await new Promise(r => setTimeout(r, 200));

        try {
            const containerId = type === 'booking' ? 'hidden-booking-slip' : 'hidden-prescription-slip';
            const element = document.getElementById(containerId);
            if (!element) {
                // Fallback: redirect to dedicated slip route
                window.open(`/appointment/slips/${type}?appointment_id=${apt.id}`, '_blank');
                setGeneratingPdfKey(null);
                setActiveSlipTarget(null);
                return;
            }

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            const p = patients.find(pat => pat.id === apt.patient_id);
            const uhid = p?.uhid || 'UHID';
            const fileName = type === 'booking' 
                ? `BookingSlip-${uhid}-Serial${apt.serial_no || '22'}.pdf`
                : `Prescription-${uhid}-Serial${apt.serial_no || '22'}.pdf`;

            pdf.save(fileName);
        } catch (err) {
            console.error('PDF generation error:', err);
            window.open(`/appointment/slips/${type}?appointment_id=${apt.id}`, '_blank');
        } finally {
            setGeneratingPdfKey(null);
            setActiveSlipTarget(null);
        }
    };

    const handlePayOnline = async (appointmentId: string) => {
        try {
            setPayingApptId(appointmentId);
            const res = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointment_id: appointmentId })
            });
            const data = await res.json();
            if (res.ok && data.gatewayUrl) {
                window.location.href = data.gatewayUrl;
            } else {
                setPayingApptId(null);
                alert(data.error || 'Failed to initiate payment gateway');
            }
        } catch (err: any) {
            setPayingApptId(null);
            alert(err?.message || 'Error connecting to payment gateway');
        }
    };

    const tomorrowStr = React.useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }, []);

    const handleOpenFeedback = (apt: AppointmentRow) => {
        setActiveFeedbackAppt(apt);
        setDoctorRating(5);
        setServiceRating(5);
        setComment('');
        setSubmitError(null);
    };

    const handleOpenRebook = (apt: AppointmentRow) => {
        setRebookModalAppt(apt);
        setRebookDoctorId(apt.doctor_id || apt.doctors?.id || (availableDoctors[0]?.id || ''));
        setRebookDate(tomorrowStr);
        setRebookTime('10:00:00');
        setRebookError(null);
    };

    const handleSubmitFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeFeedbackAppt) return;

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const res = await submitAppointmentFeedback({
                appointmentId: activeFeedbackAppt.id,
                doctorRating,
                serviceRating,
                comment,
            });

            if (!res.success) {
                setSubmitError(res.error || 'Failed to submit feedback.');
                setIsSubmitting(false);
                return;
            }

            const newFeedback: FeedbackInfo = {
                id: res.feedbackId || 'temp-id',
                doctor_rating: doctorRating,
                service_rating: serviceRating,
                overall_rating: Number(((doctorRating + serviceRating) / 2).toFixed(2)),
                comment: comment || null,
                created_at: new Date().toISOString()
            };

            setAppointments(prev => prev.map(a => {
                if (a.id === activeFeedbackAppt.id) {
                    return {
                        ...a,
                        appointment_feedbacks: newFeedback
                    };
                }
                return a;
            }));

            setSuccessMessage('Thank you! Your feedback has been recorded.');
            setActiveFeedbackAppt(null);

            setTimeout(() => {
                setSuccessMessage(null);
            }, 5000);
        } catch (err: any) {
            setSubmitError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleProcessRefund = async () => {
        if (!refundModalAppt) return;
        setIsProcessingRefund(true);
        setRefundError(null);

        try {
            const res = await requestAppointmentRefund(refundModalAppt.id);
            if (!res.success) {
                setRefundError(res.error || 'Failed to process refund.');
                setIsProcessingRefund(false);
                return;
            }

            setAppointments(prev => prev.map(a => {
                if (a.id === refundModalAppt.id) {
                    return {
                        ...a,
                        refund_status: 'processed'
                    };
                }
                return a;
            }));

            setSuccessMessage(res.message || 'Refund processed successfully.');
            setRefundModalAppt(null);
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err: any) {
            setRefundError(err.message || 'Unexpected refund error.');
        } finally {
            setIsProcessingRefund(false);
        }
    };

    const handleProcessRebook = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rebookModalAppt || !rebookDoctorId || !rebookDate) return;

        setIsProcessingRebook(true);
        setRebookError(null);

        try {
            const res = await rebookCancelledAppointment({
                oldAppointmentId: rebookModalAppt.id,
                newDoctorId: rebookDoctorId,
                newDate: rebookDate,
                newTime: rebookTime
            });

            if (!res.success) {
                setRebookError(res.error || 'Failed to rebook appointment.');
                setIsProcessingRebook(false);
                return;
            }

            setAppointments(prev => prev.map(a => {
                if (a.id === rebookModalAppt.id) {
                    return {
                        ...a,
                        refund_status: 'rebooked'
                    };
                }
                return a;
            }));

            setSuccessMessage(res.message || 'Appointment successfully rebooked!');
            setRebookModalAppt(null);
            setTimeout(() => setSuccessMessage(null), 6000);
        } catch (err: any) {
            setRebookError(err.message || 'Unexpected rebooking error.');
        } finally {
            setIsProcessingRebook(false);
        }
    };

    return (
        <>
            <style>{`
                .appointment-table-row {
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .appointment-table-row:hover td {
                    background-color: #f0fdf4 !important;
                }
            `}</style>

            {successMessage && (
                <div className="alert alert-success alert-dismissible fade show mb-4 d-flex align-items-center gap-2 shadow-sm" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{successMessage}</div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
                </div>
            )}

            {/* Filter Control Bar */}
            <div className="bg-white p-3 p-md-4 mb-4 shadow-sm border rounded-0">
                <div className="row g-3 align-items-center">
                    {/* Time Filtering Pills */}
                    <div className="col-lg-6 col-md-12">
                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                                    selectedTimeTab === 'all'
                                        ? 'text-white shadow-sm'
                                        : 'btn-outline-secondary bg-white text-secondary'
                                }`}
                                style={{ backgroundColor: selectedTimeTab === 'all' ? '#1B2978' : undefined, borderColor: selectedTimeTab === 'all' ? '#1B2978' : undefined }}
                                onClick={() => setSelectedTimeTab('all')}
                            >
                                <span>All Visits</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'all' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.all}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                                    selectedTimeTab === 'upcoming'
                                        ? 'text-white shadow-sm'
                                        : 'btn-outline-secondary bg-white text-secondary'
                                }`}
                                style={{ backgroundColor: selectedTimeTab === 'upcoming' ? '#3346B5' : undefined, borderColor: selectedTimeTab === 'upcoming' ? '#3346B5' : undefined }}
                                onClick={() => setSelectedTimeTab('upcoming')}
                            >
                                <Calendar size={14} />
                                <span>Upcoming</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'upcoming' ? 'bg-white text-dark' : 'bg-primary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.upcoming}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                                    selectedTimeTab === 'today'
                                        ? 'text-white shadow-sm'
                                        : 'btn-outline-secondary bg-white text-secondary'
                                }`}
                                style={{ backgroundColor: selectedTimeTab === 'today' ? '#1B2978' : undefined, borderColor: selectedTimeTab === 'today' ? '#1B2978' : undefined }}
                                onClick={() => setSelectedTimeTab('today')}
                            >
                                <Clock size={14} />
                                <span>Today</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'today' ? 'bg-white text-dark' : 'bg-success text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.today}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all ${
                                    selectedTimeTab === 'prev'
                                        ? 'text-white shadow-sm'
                                        : 'btn-outline-secondary bg-white text-secondary'
                                }`}
                                style={{ backgroundColor: selectedTimeTab === 'prev' ? '#5c636a' : undefined, borderColor: selectedTimeTab === 'prev' ? '#5c636a' : undefined }}
                                onClick={() => setSelectedTimeTab('prev')}
                            >
                                <span>Previous</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'prev' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.prev}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Patient Filter & Keyword Search */}
                    <div className="col-lg-6 col-md-12">
                        <div className="row g-2 justify-content-lg-end">
                            {/* Patient Select */}
                            <div className="col-sm-6">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light text-muted border-secondary-subtle">
                                        <User size={14} />
                                    </span>
                                    <select
                                        className="form-select border-secondary-subtle"
                                        value={selectedPatientId}
                                        onChange={(e) => setSelectedPatientId(e.target.value)}
                                    >
                                        <option value="all">All Family Members ({patients.length})</option>
                                        {patients.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.full_name} ({p.uhid})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Search Box */}
                            <div className="col-sm-6">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light text-muted border-secondary-subtle">
                                        <Search size={14} />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-secondary-subtle"
                                        placeholder="Doctor, Patient, Serial..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button 
                                            className="btn btn-outline-secondary border-secondary-subtle" 
                                            type="button" 
                                            onClick={() => setSearchQuery('')}
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Appointments Table Card */}
            <div className="card border-0 shadow-sm rounded-0">
                <div className="card-body p-0">
                    {filteredAppointments && filteredAppointments.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light border-bottom">
                                    <tr>
                                        <th className="px-4 py-3" style={{ color: '#1B2978' }}>Serial</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Patient Details</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Date & Slot</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Consulting Doctor</th>
                                        <th className="py-3 text-center" style={{ color: '#1B2978' }}>Download Slips</th>
                                        <th className="py-3 text-center" style={{ color: '#1B2978' }}>Visit Feedback</th>
                                        <th className="px-4 py-3 text-end" style={{ color: '#1B2978' }}>Status & Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((apt) => {
                                        const p = patients.find(pat => pat.id === apt.patient_id);
                                        const payment = payments.find(pay => pay.appointment_id === apt.id);
                                        const docSpec = docSpecsMap[apt.doctor_id || ''] || 'General Physician';
                                        const fbStatus = getAppointmentFeedbackStatus(apt);
                                        const isCancelledByDoctor = apt.status === 'cancelled' && apt.cancelled_by_role === 'doctor';
                                        const isGeneratingBooking = generatingPdfKey === `${apt.id}_booking`;
                                        const isGeneratingRx = generatingPdfKey === `${apt.id}_prescription`;

                                        return (
                                            <tr 
                                                key={apt.id} 
                                                className={`appointment-table-row ${isCancelledByDoctor ? 'table-danger-subtle' : ''}`}
                                                onClick={() => setDetailModalAppt(apt)}
                                                title="Click anywhere to view full appointment details"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                {/* Serial / Token */}
                                                <td className="px-4 py-3">
                                                    <div 
                                                        className="d-inline-flex flex-column align-items-center justify-content-center bg-light border border-secondary-subtle px-2 py-1 text-center"
                                                        style={{ minWidth: '48px', cursor: 'pointer' }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDetailModalAppt(apt);
                                                        }}
                                                        title="Click to view full appointment details"
                                                    >
                                                        <span className="small text-muted" style={{ fontSize: '10px', lineHeight: 1 }}>TOKEN</span>
                                                        <span className="fw-bold fs-6 text-dark" style={{ color: '#1B2978', lineHeight: 1.2 }}>
                                                            #{apt.serial_no || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Patient */}
                                                <td className="py-3">
                                                    <div className="fw-bold text-dark">{p?.full_name || 'Patient'}</div>
                                                    <div className="text-muted small" style={{ fontSize: '12px' }}>
                                                        <span className="badge bg-light text-secondary border me-1">{p?.uhid || 'UHID'}</span>
                                                        {p?.gender && <span>{p.gender}</span>}
                                                    </div>
                                                </td>

                                                {/* Date & Time */}
                                                <td className="py-3">
                                                    <div className="fw-semibold text-dark">
                                                        <i className="bi bi-calendar3 me-1.5 text-muted"></i>
                                                        {apt.appointment_date}
                                                    </div>
                                                    <div className="text-muted small">
                                                        <i className="bi bi-clock me-1 text-muted"></i>
                                                        {apt.start_time}
                                                    </div>
                                                </td>

                                                {/* Doctor */}
                                                <td className="py-3">
                                                    <div className="fw-semibold text-dark">{apt.doctors?.full_name}</div>
                                                    <div className="text-muted small text-truncate" style={{ maxWidth: '180px' }} title={docSpec}>
                                                        {docSpec}
                                                    </div>
                                                </td>

                                                {/* Download Slips Column (Booking Slip & Prescription) */}
                                                <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="d-flex flex-column gap-1.5 align-items-center justify-content-center">
                                                        {/* Booking Slip Download */}
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-dark py-1 px-2.5 d-inline-flex align-items-center gap-1 shadow-xs"
                                                            style={{ fontSize: '11px' }}
                                                            title="Download official appointment booking slip PDF"
                                                            disabled={isGeneratingBooking}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadSlipPdf(apt, 'booking');
                                                            }}
                                                        >
                                                            {isGeneratingBooking ? (
                                                                <Loader2 size={12} className="animate-spin text-primary" />
                                                            ) : (
                                                                <Download size={12} className="text-primary" />
                                                            )}
                                                            <span>Booking Slip</span>
                                                        </button>

                                                        {/* Prescription Slip Download */}
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1 text-white shadow-xs"
                                                            style={{ backgroundColor: '#1B2978', fontSize: '11px', borderColor: '#1B2978' }}
                                                            title="Download hospital prescription ticket PDF (sample-pres replica)"
                                                            disabled={isGeneratingRx}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadSlipPdf(apt, 'prescription');
                                                            }}
                                                        >
                                                            {isGeneratingRx ? (
                                                                <Loader2 size={12} className="animate-spin text-white" />
                                                            ) : (
                                                                <FileText size={12} />
                                                            )}
                                                            <span>Prescription</span>
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Visit Feedback Column */}
                                                <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {fbStatus.status === 'submitted' && fbStatus.feedback ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-light border py-1 px-2 text-dark d-inline-flex align-items-center gap-1 shadow-xs"
                                                            title="View submitted feedback"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewFeedbackAppt({ appt: apt, feedback: fbStatus.feedback! });
                                                            }}
                                                        >
                                                            <i className="bi bi-star-fill text-warning"></i>
                                                            <span className="fw-bold">{fbStatus.feedback.overall_rating.toFixed(1)}</span>
                                                            <span className="text-muted small">· Review</span>
                                                        </button>
                                                    ) : fbStatus.status === 'available' ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-warning py-1 px-2 fw-bold text-dark d-inline-flex align-items-center gap-1 shadow-sm"
                                                            title={`Feedback expires in ${fbStatus.daysLeft} day(s)`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenFeedback(apt);
                                                            }}
                                                        >
                                                            <i className="bi bi-star me-1"></i>Rate Visit
                                                            <span className="badge bg-dark bg-opacity-75 text-white ms-1" style={{ fontSize: '0.7rem' }}>
                                                                {fbStatus.daysLeft}d left
                                                            </span>
                                                        </button>
                                                    ) : fbStatus.status === 'expired' ? (
                                                        <span 
                                                            className="badge bg-light text-muted border px-2 py-1"
                                                            title="The 7-day feedback window for this visit has expired"
                                                        >
                                                            <i className="bi bi-clock-history me-1"></i>Expired
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>

                                                {/* Status & Action */}
                                                <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                                                    {isCancelledByDoctor ? (
                                                        <div className="d-flex flex-column align-items-end gap-1">
                                                            <span className="badge bg-danger py-1 px-2">
                                                                <i className="bi bi-calendar-x me-1"></i>Cancelled
                                                            </span>
                                                            {apt.payment_status === 'paid' && apt.refund_status === 'eligible' && (
                                                                <div className="d-flex gap-1 mt-1">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger py-0 px-2 fw-bold"
                                                                        style={{ fontSize: '0.75rem' }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setRefundModalAppt(apt);
                                                                            setRefundError(null);
                                                                        }}
                                                                    >
                                                                        Refund (BDT {apt.paid_amount})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-primary py-0 px-2 fw-bold text-white"
                                                                        style={{ fontSize: '0.75rem' }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenRebook(apt);
                                                                        }}
                                                                    >
                                                                        Rebook
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {apt.refund_status === 'processed' && (
                                                                <span className="badge bg-success-subtle text-success border border-success mt-1" style={{ fontSize: '0.75rem' }}>
                                                                    Refunded
                                                                </span>
                                                            )}
                                                            {apt.refund_status === 'rebooked' && (
                                                                <span className="badge bg-primary-subtle text-primary border border-primary mt-1" style={{ fontSize: '0.75rem' }}>
                                                                    Rebooked
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="d-flex flex-column align-items-end gap-1">
                                                            <div className="d-flex align-items-center gap-1.5">
                                                                <span className={`badge ${getStatusBadgeColor(apt.status)}`}>
                                                                    {getStatusLabel(apt.status)}
                                                                </span>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-secondary py-0.5 px-2 text-dark d-inline-flex align-items-center gap-1"
                                                                    style={{ fontSize: '11px' }}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setDetailModalAppt(apt);
                                                                    }}
                                                                    title="View full appointment details modal"
                                                                >
                                                                    <Eye size={12} />
                                                                    <span>Details</span>
                                                                </button>
                                                            </div>

                                                            {apt.status === 'scheduled' && apt.payment_status !== 'paid' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-success py-0 px-2 fw-semibold"
                                                                    style={{ fontSize: '0.72rem' }}
                                                                    disabled={payingApptId === apt.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handlePayOnline(apt.id);
                                                                    }}
                                                                >
                                                                    {payingApptId === apt.id ? (
                                                                        <span>Connecting...</span>
                                                                    ) : (
                                                                        <><i className="bi bi-credit-card me-1"></i>Pay Online</>
                                                                    )}
                                                                </button>
                                                            )}

                                                            {apt.payment_status === 'paid' && (
                                                                <span className="badge bg-success-subtle text-success border border-success" style={{ fontSize: '0.7rem' }}>
                                                                    <i className="bi bi-check-circle me-1"></i>Paid (BDT {apt.paid_amount || '1,100'})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="p-5 text-center text-muted">
                            <i className="bi bi-calendar-x" style={{ fontSize: '3rem', color: '#1B2978' }}></i>
                            <h5 className="mt-3 mb-1 fw-bold text-dark">No appointments found</h5>
                            <p className="text-muted small mb-3">
                                {selectedTimeTab !== 'all' || selectedPatientId !== 'all' || searchQuery 
                                    ? 'No bookings match your current time, patient, or search filters.'
                                    : 'You have no appointments scheduled in this account yet.'}
                            </p>
                            <a href="/patient/book" className="btn btn-sm text-white px-3" style={{ backgroundColor: '#1B2978' }}>
                                Book an Appointment
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* DETAIL MODAL (Opens on appointment click) */}
            {mounted && detailModalAppt && createPortal((() => {
                const p = patients.find(pat => pat.id === detailModalAppt.patient_id);
                const payment = payments.find(pay => pay.appointment_id === detailModalAppt.id);
                const docSpec = docSpecsMap[detailModalAppt.doctor_id || ''] || 'General Physician';
                const isPaid = detailModalAppt.payment_status === 'paid';
                const isGeneratingBooking = generatingPdfKey === `${detailModalAppt.id}_booking`;
                const isGeneratingRx = generatingPdfKey === `${detailModalAppt.id}_prescription`;

                return (
                    <div 
                        className="modal d-block" 
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        style={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.65)', 
                            zIndex: 99999, 
                            position: 'fixed', 
                            top: 0, 
                            left: 0, 
                            width: '100vw', 
                            height: '100vh', 
                            overflowY: 'auto',
                            display: 'block'
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setDetailModalAppt(null);
                        }}
                    >
                        <div 
                            className="modal-dialog modal-dialog-centered modal-lg my-4" 
                            style={{ maxWidth: '820px' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                                {/* Header */}
                                <div className="modal-header text-white rounded-0 py-3 px-4" style={{ backgroundColor: '#1B2978' }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-white text-dark fw-bold px-2.5 py-1 text-center" style={{ minWidth: '45px', border: '2px solid #3346B5', borderRadius: '4px' }}>
                                            <div style={{ fontSize: '9px', lineHeight: 1, letterSpacing: '1px' }}>TOKEN</div>
                                            <div className="fs-5" style={{ color: '#1B2978', lineHeight: 1.1 }}>#{detailModalAppt.serial_no || '-'}</div>
                                        </div>
                                        <div>
                                            <h5 className="modal-title fw-bold m-0 text-white">Appointment Details</h5>
                                            <div className="text-white text-opacity-75 small">
                                                Appointment ID: {detailModalAppt.id}
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        onClick={() => setDetailModalAppt(null)}
                                        aria-label="Close"
                                    ></button>
                                </div>

                                {/* Body */}
                                <div className="modal-body p-4 bg-light">
                                    <div className="row g-3">
                                        {/* Status & Time Alert */}
                                        <div className="col-12">
                                            <div className="p-3 bg-white border d-flex justify-content-between align-items-center flex-wrap gap-2 rounded">
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="small text-muted fw-bold text-uppercase">Status:</span>
                                                    <span className={`badge ${getStatusBadgeColor(detailModalAppt.status)} fs-6 py-1 px-2.5`}>
                                                        {getStatusLabel(detailModalAppt.status)}
                                                    </span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2 small text-muted">
                                                    <Calendar size={15} className="text-primary" />
                                                    <strong className="text-dark">{detailModalAppt.appointment_date}</strong>
                                                    <span>at</span>
                                                    <Clock size={15} className="text-primary ms-1" />
                                                    <strong className="text-dark">{detailModalAppt.start_time}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Patient Details Card */}
                                        <div className="col-md-6">
                                            <div className="card h-100 border shadow-none rounded">
                                                <div className="card-header bg-white py-2 px-3 border-bottom d-flex align-items-center gap-2">
                                                    <User size={15} style={{ color: '#1B2978' }} />
                                                    <span className="fw-bold small text-uppercase" style={{ color: '#1B2978' }}>Patient Information</span>
                                                </div>
                                                <div className="card-body p-3">
                                                    <div className="mb-2">
                                                        <div className="small text-muted">Full Name</div>
                                                        <div className="fw-bold text-dark fs-6">{p?.full_name || 'Patient'}</div>
                                                    </div>
                                                    <div className="row g-2 mb-2">
                                                        <div className="col-6">
                                                            <div className="small text-muted">UHID</div>
                                                            <div className="fw-bold text-primary">{p?.uhid || 'UHID'}</div>
                                                        </div>
                                                        <div className="col-6">
                                                            <div className="small text-muted">Gender</div>
                                                            <div className="fw-semibold text-dark">{p?.gender || 'Male'}</div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="small text-muted">Phone Number</div>
                                                        <div className="fw-semibold text-dark">{p?.mobile_no || '+8801XXXXXXXXX'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Doctor Details Card */}
                                        <div className="col-md-6">
                                            <div className="card h-100 border shadow-none rounded">
                                                <div className="card-header bg-white py-2 px-3 border-bottom d-flex align-items-center gap-2">
                                                    <i className="bi bi-person-badge fs-6" style={{ color: '#1B2978' }}></i>
                                                    <span className="fw-bold small text-uppercase" style={{ color: '#1B2978' }}>Doctor & Department</span>
                                                </div>
                                                <div className="card-body p-3">
                                                    <div className="mb-2">
                                                        <div className="small text-muted">Consulting Specialist</div>
                                                        <div className="fw-bold text-dark fs-6">{detailModalAppt.doctors?.full_name}</div>
                                                    </div>
                                                    <div className="mb-2">
                                                        <div className="small text-muted">Department / Speciality</div>
                                                        <div className="fw-semibold text-dark">{docSpec}</div>
                                                    </div>
                                                    <div>
                                                        <div className="small text-muted">Hospital Chamber</div>
                                                        <div className="fw-semibold text-muted small">
                                                            LABAID CARDIAC HOSPITAL · Room #304 (Level 3)
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Billing & Payment Card */}
                                        <div className="col-12">
                                            <div className="card border shadow-none rounded">
                                                <div className="card-header bg-white py-2 px-3 border-bottom d-flex justify-content-between align-items-center">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <CreditCard size={15} style={{ color: '#1B2978' }} />
                                                        <span className="fw-bold small text-uppercase" style={{ color: '#1B2978' }}>Payment & Billing Receipt</span>
                                                    </div>
                                                    <span className={`badge ${isPaid ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                        {isPaid ? 'PAID' : 'PAYMENT DUE'}
                                                    </span>
                                                </div>
                                                <div className="card-body p-3">
                                                    <div className="row g-3 align-items-center">
                                                        <div className="col-sm-4">
                                                            <div className="small text-muted">Consultation Fee</div>
                                                            <div className="fw-bold fs-5 text-success">
                                                                BDT {detailModalAppt.paid_amount || '1,100'}
                                                            </div>
                                                        </div>
                                                        <div className="col-sm-4">
                                                            <div className="small text-muted">Payment Channel</div>
                                                            <div className="fw-semibold text-dark small">
                                                                {payment?.card_brand || (isPaid ? 'SSLCommerz Gateway' : 'Pay at Counter')}
                                                            </div>
                                                        </div>
                                                        <div className="col-sm-4">
                                                            <div className="small text-muted">Transaction ID</div>
                                                            <div className="text-muted small text-truncate" style={{ fontFamily: 'monospace' }}>
                                                                {payment?.tran_id || '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer with Download Buttons */}
                                <div className="modal-footer bg-white p-3 d-flex justify-content-between flex-wrap gap-2">
                                    <div className="d-flex gap-2 flex-wrap">
                                        {/* Download Booking Slip */}
                                        <button
                                            type="button"
                                            className="btn btn-outline-dark d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold rounded-2"
                                            disabled={isGeneratingBooking}
                                            onClick={() => handleDownloadSlipPdf(detailModalAppt, 'booking')}
                                        >
                                            {isGeneratingBooking ? <Loader2 size={15} className="animate-spin text-primary" /> : <Download size={15} className="text-primary" />}
                                            <span>Download Booking Slip</span>
                                        </button>

                                        {/* Download Prescription */}
                                        <button
                                            type="button"
                                            className="btn text-white d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold rounded-2"
                                            style={{ backgroundColor: '#1B2978' }}
                                            disabled={isGeneratingRx}
                                            onClick={() => handleDownloadSlipPdf(detailModalAppt, 'prescription')}
                                        >
                                            {isGeneratingRx ? <Loader2 size={15} className="animate-spin text-white" /> : <FileText size={15} />}
                                            <span>Download Prescription</span>
                                        </button>

                                        {/* External Printable Slip Link */}
                                        <a
                                            href={`/appointment/slips/prescription?appointment_id=${detailModalAppt.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded-2"
                                            title="Open full-page printable view in a new tab"
                                        >
                                            <Printer size={15} />
                                            <span>Print View</span>
                                        </a>
                                    </div>

                                    <button 
                                        type="button" 
                                        className="btn btn-secondary px-4 py-2 rounded-2" 
                                        onClick={() => setDetailModalAppt(null)}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })(), document.body)}

            {/* Hidden Slips Render Tree for jsPDF + html2canvas generation */}
            {activeSlipTarget && (
                <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '794px', zIndex: -1 }}>
                    {activeSlipTarget.type === 'booking' ? (
                        <div id="hidden-booking-slip" style={{ width: '680px', backgroundColor: '#ffffff', padding: '16px' }}>
                            <BookingSlip
                                appointment={activeSlipTarget.appt}
                                patient={patients.find(p => p.id === activeSlipTarget.appt.patient_id)}
                                doctor={activeSlipTarget.appt.doctors}
                                specialityName={docSpecsMap[activeSlipTarget.appt.doctor_id || ''] || 'Medicine Specialist'}
                                payment={payments.find(pay => pay.appointment_id === activeSlipTarget.appt.id)}
                            />
                        </div>
                    ) : (
                        <div id="hidden-prescription-slip" style={{ width: '794px', backgroundColor: '#ffffff', padding: '16px' }}>
                            <PrescriptionSlip
                                appointment={activeSlipTarget.appt}
                                patient={patients.find(p => p.id === activeSlipTarget.appt.patient_id)}
                                doctor={activeSlipTarget.appt.doctors}
                                specialityName={docSpecsMap[activeSlipTarget.appt.doctor_id || ''] || 'Medicine Specialist'}
                                payment={payments.find(pay => pay.appointment_id === activeSlipTarget.appt.id)}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Modal 1: Submit Visit Feedback */}
            {mounted && activeFeedbackAppt && createPortal(
                <div 
                    className="modal d-block" 
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.65)', 
                        zIndex: 99999, 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100vw', 
                        height: '100vh', 
                        overflowY: 'auto',
                        display: 'block'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isSubmitting) setActiveFeedbackAppt(null);
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered my-4" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                            <form onSubmit={handleSubmitFeedback}>
                                <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#1B2978' }}>
                                    <h5 className="modal-title fw-bold m-0 text-white">
                                        <i className="bi bi-star-half me-2"></i>Rate Your Visit Experience
                                    </h5>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        disabled={isSubmitting}
                                        onClick={() => setActiveFeedbackAppt(null)}
                                        aria-label="Close"
                                    ></button>
                                </div>
                                <div className="modal-body p-4 bg-white">
                                    <div className="bg-light p-3 rounded mb-3 border">
                                        <div className="fw-bold fs-6 text-dark">
                                            Dr. {activeFeedbackAppt.doctors?.full_name || 'Consulting Doctor'}
                                        </div>
                                        <div className="text-muted small">
                                            Visit Date: <strong>{activeFeedbackAppt.appointment_date}</strong> · Serial: <strong>#{activeFeedbackAppt.serial_no}</strong>
                                        </div>
                                    </div>

                                    {submitError && (
                                        <div className="alert alert-danger py-2 px-3 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-1"></i>{submitError}
                                        </div>
                                    )}

                                    <div className="alert alert-warning py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                                        <i className="bi bi-clock-history fs-5"></i>
                                        <div>
                                            Feedback is accepted within <strong>7 days</strong> of your visit. Your review helps us ensure top quality medical care.
                                        </div>
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label fw-bold mb-1">
                                            Doctor Consultation & Care <span className="text-danger">*</span>
                                        </label>
                                        <div className="small text-muted mb-2">How satisfied were you with the doctor's diagnosis, explanation, and treatment?</div>
                                        <StarRating 
                                            value={doctorRating} 
                                            onChange={setDoctorRating} 
                                            disabled={isSubmitting} 
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label className="form-label fw-bold mb-1">
                                            Clinic Service & Staff Support <span className="text-danger">*</span>
                                        </label>
                                        <div className="small text-muted mb-2">How was the waiting room experience, compounder support, and overall clinic service?</div>
                                        <StarRating 
                                            value={serviceRating} 
                                            onChange={setServiceRating} 
                                            disabled={isSubmitting} 
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold mb-1">
                                            Comments or Suggestions <span className="text-muted fw-normal">(Optional)</span>
                                        </label>
                                        <textarea
                                            className="form-control"
                                            rows={3}
                                            maxLength={500}
                                            placeholder="Write any thoughts about your visit, doctor advice, or how we can serve you better..."
                                            value={comment}
                                            disabled={isSubmitting}
                                            onChange={(e) => setComment(e.target.value)}
                                        />
                                        <div className="text-muted small mt-1 text-end">
                                            {comment.length}/500 characters
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary px-3" 
                                        disabled={isSubmitting}
                                        onClick={() => setActiveFeedbackAppt(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-success fw-bold px-4 text-white"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Submitting...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-send-check me-1"></i>Submit Feedback
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 2: View Submitted Feedback */}
            {mounted && viewFeedbackAppt && createPortal(
                <div 
                    className="modal d-block" 
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.65)', 
                        zIndex: 99999, 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100vw', 
                        height: '100vh', 
                        overflowY: 'auto',
                        display: 'block'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setViewFeedbackAppt(null);
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered my-4" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                            <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#1B2978' }}>
                                <h5 className="modal-title fw-bold m-0 text-white">
                                    <i className="bi bi-star-fill text-warning me-2"></i>Your Submitted Feedback
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setViewFeedbackAppt(null)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body p-4 bg-white">
                                <div className="bg-light p-3 rounded mb-3 border">
                                    <div className="fw-bold fs-6 text-dark">
                                        Dr. {viewFeedbackAppt.appt.doctors?.full_name || 'Consulting Doctor'}
                                    </div>
                                    <div className="text-muted small">
                                        Visit Date: <strong>{viewFeedbackAppt.appt.appointment_date}</strong> · Serial: <strong>#{viewFeedbackAppt.appt.serial_no}</strong>
                                    </div>
                                </div>

                                <div className="p-3 rounded bg-light border mb-3 text-center">
                                    <div className="text-muted small text-uppercase fw-bold">Overall Rating</div>
                                    <div className="display-6 fw-bold text-dark my-1">
                                        <i className="bi bi-star-fill text-warning me-2" style={{ fontSize: '1.8rem' }}></i>
                                        {viewFeedbackAppt.feedback.overall_rating.toFixed(1)} / 5.0
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <span className="fw-semibold">Doctor Consultation:</span>
                                        <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                                            {viewFeedbackAppt.feedback.doctor_rating} / 5 Stars
                                        </span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                        <span className="fw-semibold">Clinic & Service Quality:</span>
                                        <span className="badge bg-warning text-dark fw-bold px-2 py-1">
                                            {viewFeedbackAppt.feedback.service_rating} / 5 Stars
                                        </span>
                                    </div>
                                </div>

                                {viewFeedbackAppt.feedback.comment ? (
                                    <div className="mb-3">
                                        <label className="fw-bold small text-muted text-uppercase mb-1">Your Comments:</label>
                                        <div className="p-3 bg-light border rounded text-dark fst-italic">
                                            "{viewFeedbackAppt.feedback.comment}"
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-muted small fst-italic mb-3">No additional comments provided.</div>
                                )}

                                <div className="text-muted small text-end">
                                    Submitted on: {new Date(viewFeedbackAppt.feedback.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </div>
                            </div>
                            <div className="modal-footer bg-light p-3">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary px-4 rounded-2" 
                                    onClick={() => setViewFeedbackAppt(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 3: Claim Refund Confirmation */}
            {mounted && refundModalAppt && createPortal(
                <div 
                    className="modal d-block" 
                    tabIndex={-1}
                    role="dialog"
                    aria-modal="true"
                    style={{ 
                        backgroundColor: 'rgba(0, 0, 0, 0.65)', 
                        zIndex: 99999, 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100vw', 
                        height: '100vh', 
                        overflowY: 'auto',
                        display: 'block'
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isProcessingRefund) setRefundModalAppt(null);
                    }}
                >
                    <div className="modal-dialog modal-dialog-centered my-4" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                            <div className="modal-header bg-danger text-white py-3 px-4">
                                <h5 className="modal-title fw-bold m-0 text-white">
                                    <i className="bi bi-cash-coin me-2"></i>Claim Visit Refund
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    disabled={isProcessingRefund}
                                    onClick={() => setRefundModalAppt(null)}
                                    aria-label="Close"
                                ></button>
                            </div>
                            <div className="modal-body p-4 bg-white">
                                <p className="mb-3">
                                    Your appointment with <strong>Dr. {refundModalAppt.doctors?.full_name}</strong> on <strong>{refundModalAppt.appointment_date}</strong> was cancelled by the doctor.
                                </p>
                                
                                <div className="p-3 rounded bg-light border mb-3">
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="text-muted">Serial No:</span>
                                        <span className="fw-bold">#{refundModalAppt.serial_no}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="text-muted">Cancellation Reason:</span>
                                        <span className="text-danger fw-semibold">{refundModalAppt.cancel_reason || 'Doctor unavailable'}</span>
                                    </div>
                                    <div className="d-flex justify-content-between pt-2 border-top">
                                        <span className="fw-bold text-dark">Refund Amount:</span>
                                        <span className="fw-bold text-success fs-5">BDT {refundModalAppt.paid_amount}</span>
                                    </div>
                                </div>

                                {refundError && (
                                    <div className="alert alert-danger py-2 px-3 small mb-3">
                                        <i className="bi bi-exclamation-triangle-fill me-1"></i>{refundError}
                                    </div>
                                )}

                                <div className="alert alert-info py-2 px-3 small mb-0">
                                    <i className="bi bi-info-circle-fill me-1"></i>
                                    Clicking confirm will immediately initiate a full refund of <strong>BDT {refundModalAppt.paid_amount}</strong> back to your original payment channel.
                                </div>
                            </div>
                            <div className="modal-footer bg-light p-3 d-flex justify-content-between">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary px-3" 
                                    disabled={isProcessingRefund}
                                    onClick={() => setRefundModalAppt(null)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="btn btn-danger fw-bold px-4" 
                                    disabled={isProcessingRefund}
                                    onClick={handleProcessRefund}
                                >
                                    {isProcessingRefund ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-check2-circle me-1"></i>Confirm Refund
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Modal 4: Rebook Cancelled Appointment */}
            {rebookModalAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleProcessRebook}>
                                <div className="modal-header text-white" style={{ backgroundColor: '#1B2978' }}>
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-arrow-repeat me-2"></i>Rebook Appointment
                                    </h5>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        disabled={isProcessingRebook}
                                        onClick={() => setRebookModalAppt(null)}
                                    ></button>
                                </div>
                                <div className="modal-body p-4">
                                    {rebookError && (
                                        <div className="alert alert-danger py-2 px-3 small mb-3">
                                            <i className="bi bi-exclamation-triangle-fill me-1"></i>{rebookError}
                                        </div>
                                    )}

                                    {rebookModalAppt.payment_status === 'paid' && Number(rebookModalAppt.paid_amount) > 0 && (
                                        <div className="alert alert-success py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                                            <i className="bi bi-check-circle-fill fs-5"></i>
                                            <div>
                                                <strong>Paid Fee Transferred:</strong> Your previous payment of <strong>BDT {rebookModalAppt.paid_amount}</strong> will be applied directly to this new appointment at no additional charge.
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label fw-bold mb-1">Select Doctor <span className="text-danger">*</span></label>
                                        <select
                                            className="form-select form-select-sm"
                                            value={rebookDoctorId}
                                            disabled={isProcessingRebook}
                                            onChange={(e) => setRebookDoctorId(e.target.value)}
                                            required
                                        >
                                            {availableDoctors.map((doc) => (
                                                <option key={doc.id} value={doc.id}>
                                                    Dr. {doc.full_name} {doc.id === rebookModalAppt.doctor_id ? '(Same Doctor)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold mb-1">New Appointment Date <span className="text-danger">*</span></label>
                                        <input
                                            type="date"
                                            className="form-control form-control-sm"
                                            min={tomorrowStr}
                                            value={rebookDate}
                                            disabled={isProcessingRebook}
                                            onChange={(e) => setRebookDate(e.target.value)}
                                            required
                                        />
                                        <small className="text-muted">Choose an upcoming date when the doctor is available.</small>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold mb-1">Preferred Time <span className="text-danger">*</span></label>
                                        <input
                                            type="time"
                                            className="form-control form-control-sm"
                                            value={rebookTime}
                                            disabled={isProcessingRebook}
                                            onChange={(e) => setRebookTime(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="modal-footer d-flex justify-content-between">
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary" 
                                        disabled={isProcessingRebook}
                                        onClick={() => setRebookModalAppt(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary fw-bold px-4"
                                        disabled={isProcessingRebook || !rebookDoctorId || !rebookDate}
                                    >
                                        {isProcessingRebook ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                                Booking...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-calendar-check me-1"></i>Confirm Rebooking
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
