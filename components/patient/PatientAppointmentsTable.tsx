'use client';

import React, { useState } from 'react';
import { getStatusLabel, getStatusBadgeColor } from '@/lib/appointmentStatus';
import { getAppointmentFeedbackStatus, FeedbackInfo } from '@/lib/feedbackStatus';
import { 
    submitAppointmentFeedback, 
    requestAppointmentRefund, 
    rebookCancelledAppointment 
} from '@/app/patient/actions';

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
    doctors?: { id?: string; full_name: string } | null;
    medical_records?: Array<{ id: string; title: string; file_path: string; record_type: string }> | null;
    appointment_feedbacks?: FeedbackInfo | FeedbackInfo[] | null;
}

export interface PatientProfile {
    id: string;
    full_name: string;
}

export interface DoctorOption {
    id: string;
    full_name: string;
}

interface Props {
    initialAppointments: AppointmentRow[];
    patients: PatientProfile[];
    availableDoctors?: DoctorOption[];
}

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

export default function PatientAppointmentsTable({ initialAppointments, patients, availableDoctors = [] }: Props) {
    const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
    
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

    // Refund Modal state (Feature 1)
    const [refundModalAppt, setRefundModalAppt] = useState<AppointmentRow | null>(null);
    const [isProcessingRefund, setIsProcessingRefund] = useState<boolean>(false);
    const [refundError, setRefundError] = useState<string | null>(null);

    // Rebook Modal state (Feature 1)
    const [rebookModalAppt, setRebookModalAppt] = useState<AppointmentRow | null>(null);
    const [rebookDoctorId, setRebookDoctorId] = useState<string>('');
    const [rebookDate, setRebookDate] = useState<string>('');
    const [rebookTime, setRebookTime] = useState<string>('10:00:00');
    const [isProcessingRebook, setIsProcessingRebook] = useState<boolean>(false);
    const [rebookError, setRebookError] = useState<string | null>(null);

    // Tomorrow date helper for min rebook date
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

            // Update row optimistically
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

            // Update old row to rebooked
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
            {successMessage && (
                <div className="alert alert-success alert-dismissible fade show mb-4 d-flex align-items-center gap-2 shadow-sm" role="alert">
                    <i className="bi bi-check-circle-fill fs-5"></i>
                    <div>{successMessage}</div>
                    <button type="button" className="btn-close" onClick={() => setSuccessMessage(null)}></button>
                </div>
            )}

            <div className="card border-0 shadow-sm rounded-0">
                <div className="card-body p-0">
                    {appointments && appointments.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th className="px-4 py-3">Serial No</th>
                                        <th className="py-3">Patient</th>
                                        <th className="py-3">Date</th>
                                        <th className="py-3">Time</th>
                                        <th className="py-3">Doctor</th>
                                        <th className="py-3">Prescription</th>
                                        <th className="py-3">Visit Feedback</th>
                                        <th className="px-4 py-3 text-end">Status & Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((apt) => {
                                        const p = patients.find(pat => pat.id === apt.patient_id);
                                        const rxRecord = apt.medical_records?.find(
                                            (m) => m.record_type === 'prescription'
                                        );
                                        const fbStatus = getAppointmentFeedbackStatus(apt);
                                        const isCancelledByDoctor = apt.status === 'cancelled' && apt.cancelled_by_role === 'doctor';

                                        return (
                                            <tr key={apt.id} className={isCancelledByDoctor ? 'table-danger-subtle' : ''}>
                                                <td className="px-4 py-3 fw-bold">#{apt.serial_no || '-'}</td>
                                                <td className="py-3 fw-medium">{p?.full_name}</td>
                                                <td className="py-3">{apt.appointment_date}</td>
                                                <td className="py-3">{apt.start_time}</td>
                                                <td className="py-3">{apt.doctors?.full_name}</td>
                                                
                                                {/* Prescription Column */}
                                                <td className="py-3">
                                                    {rxRecord ? (
                                                        <a 
                                                            href="/patient/records" 
                                                            className="btn btn-sm btn-outline-primary py-1 px-2 fw-semibold"
                                                            title="View and download prescription in records vault"
                                                        >
                                                            <i className="bi bi-file-earmark-pdf me-1"></i>Prescription
                                                        </a>
                                                    ) : apt.status === 'prescription_pending' ? (
                                                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning px-2 py-1">
                                                            <i className="bi bi-hourglass-split me-1"></i>Staff Uploading
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>

                                                {/* Visit Feedback Column */}
                                                <td className="py-3">
                                                    {fbStatus.status === 'submitted' && fbStatus.feedback ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-light border py-1 px-2 text-dark d-inline-flex align-items-center gap-1 shadow-xs"
                                                            title="View submitted feedback"
                                                            onClick={() => setViewFeedbackAppt({ appt: apt, feedback: fbStatus.feedback! })}
                                                        >
                                                            <i className="bi bi-star-fill text-warning"></i>
                                                            <span className="fw-bold">{fbStatus.feedback.overall_rating.toFixed(1)}</span>
                                                            <span className="text-muted small">· View Review</span>
                                                        </button>
                                                    ) : fbStatus.status === 'available' ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-warning py-1 px-2 fw-bold text-dark d-inline-flex align-items-center gap-1 shadow-sm"
                                                            title={`Feedback expires in ${fbStatus.daysLeft} day(s)`}
                                                            onClick={() => handleOpenFeedback(apt)}
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
                                                            <i className="bi bi-clock-history me-1"></i>Feedback Expired
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>

                                                {/* Status & Doctor Cancellation Actions */}
                                                <td className="px-4 py-3 text-end">
                                                    {isCancelledByDoctor ? (
                                                        <div className="d-flex flex-column align-items-end gap-1">
                                                            <span className="badge bg-danger py-1 px-2">
                                                                <i className="bi bi-calendar-x me-1"></i>Cancelled by Doctor
                                                            </span>
                                                            {apt.cancel_reason && (
                                                                <small className="text-muted text-end text-truncate d-inline-block" style={{ maxWidth: '200px' }} title={apt.cancel_reason}>
                                                                    Reason: {apt.cancel_reason}
                                                                </small>
                                                            )}

                                                            {/* Refund & Rebook Buttons */}
                                                            {apt.payment_status === 'paid' && apt.refund_status === 'eligible' && (
                                                                <div className="d-flex gap-1 mt-1">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-outline-danger py-0 px-2 fw-bold"
                                                                        style={{ fontSize: '0.75rem' }}
                                                                        onClick={() => { setRefundModalAppt(apt); setRefundError(null); }}
                                                                    >
                                                                        <i className="bi bi-cash-coin me-1"></i>Refund (BDT {apt.paid_amount})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-sm btn-primary py-0 px-2 fw-bold text-white"
                                                                        style={{ fontSize: '0.75rem' }}
                                                                        onClick={() => handleOpenRebook(apt)}
                                                                    >
                                                                        <i className="bi bi-arrow-repeat me-1"></i>Rebook
                                                                    </button>
                                                                </div>
                                                            )}

                                                            {apt.refund_status === 'processed' && (
                                                                <span className="badge bg-success-subtle text-success border border-success mt-1" style={{ fontSize: '0.75rem' }}>
                                                                    <i className="bi bi-check-circle me-1"></i>Refund Processed (BDT {apt.paid_amount})
                                                                </span>
                                                            )}

                                                            {apt.refund_status === 'rebooked' && (
                                                                <span className="badge bg-primary-subtle text-primary border border-primary mt-1" style={{ fontSize: '0.75rem' }}>
                                                                    <i className="bi bi-arrow-repeat me-1"></i>Rebooked (Fee Transferred)
                                                                </span>
                                                            )}

                                                            {apt.payment_status !== 'paid' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary py-0 px-2 mt-1 fw-bold"
                                                                    style={{ fontSize: '0.75rem' }}
                                                                    onClick={() => handleOpenRebook(apt)}
                                                                >
                                                                    <i className="bi bi-calendar-plus me-1"></i>Rebook Another Day
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className={`badge ${getStatusBadgeColor(apt.status)}`}>
                                                            {getStatusLabel(apt.status)}
                                                        </span>
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
                            <i className="bi bi-calendar-x" style={{ fontSize: '3rem' }}></i>
                            <p className="mt-3 mb-0">You have no appointments yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal 1: Submit Visit Feedback */}
            {activeFeedbackAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleSubmitFeedback}>
                                <div className="modal-header text-white" style={{ backgroundColor: '#0D7D72' }}>
                                    <h5 className="modal-title fw-bold">
                                        <i className="bi bi-star-half me-2"></i>Rate Your Visit Experience
                                    </h5>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        disabled={isSubmitting}
                                        onClick={() => setActiveFeedbackAppt(null)}
                                    ></button>
                                </div>
                                <div className="modal-body p-4">
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
                                <div className="modal-footer d-flex justify-content-between">
                                    <button 
                                        type="button" 
                                        className="btn btn-outline-secondary" 
                                        disabled={isSubmitting}
                                        onClick={() => setActiveFeedbackAppt(null)}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-success fw-bold px-4"
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
                </div>
            )}

            {/* Modal 2: View Submitted Feedback */}
            {viewFeedbackAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header text-white" style={{ backgroundColor: '#0D7D72' }}>
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-star-fill text-warning me-2"></i>Your Submitted Feedback
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    onClick={() => setViewFeedbackAppt(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
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
                                        <div className="p-3 bg-white border rounded text-dark fst-italic">
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
                            <div className="modal-footer">
                                <button 
                                    type="button" 
                                    className="btn btn-secondary px-4" 
                                    onClick={() => setViewFeedbackAppt(null)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 3: Claim Refund Confirmation (Feature 1) */}
            {refundModalAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-header bg-danger text-white">
                                <h5 className="modal-title fw-bold">
                                    <i className="bi bi-cash-coin me-2"></i>Claim Visit Refund
                                </h5>
                                <button 
                                    type="button" 
                                    className="btn-close btn-close-white" 
                                    disabled={isProcessingRefund}
                                    onClick={() => setRefundModalAppt(null)}
                                ></button>
                            </div>
                            <div className="modal-body p-4">
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
                            <div className="modal-footer d-flex justify-content-between">
                                <button 
                                    type="button" 
                                    className="btn btn-outline-secondary" 
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
                </div>
            )}

            {/* Modal 4: Rebook Cancelled Appointment (Feature 1) */}
            {rebookModalAppt && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <form onSubmit={handleProcessRebook}>
                                <div className="modal-header text-white" style={{ backgroundColor: '#0D7D72' }}>
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

                                    {/* Fee Transfer Alert if Paid */}
                                    {rebookModalAppt.payment_status === 'paid' && Number(rebookModalAppt.paid_amount) > 0 && (
                                        <div className="alert alert-success py-2 px-3 small mb-3 d-flex align-items-center gap-2">
                                            <i className="bi bi-check-circle-fill fs-5"></i>
                                            <div>
                                                <strong>Paid Fee Transferred:</strong> Your previous payment of <strong>BDT {rebookModalAppt.paid_amount}</strong> will be applied directly to this new appointment at no additional charge.
                                            </div>
                                        </div>
                                    )}

                                    {/* Doctor Choice */}
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

                                    {/* New Date */}
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

                                    {/* New Time */}
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
