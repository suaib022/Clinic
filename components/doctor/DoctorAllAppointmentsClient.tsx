'use client';

import React, { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { getStatusBadgeColor, getStatusLabel } from '@/lib/appointmentStatus';
import { 
    Calendar, 
    Clock, 
    User, 
    Search, 
    X, 
    FileText, 
    Download, 
    Printer, 
    Eye,
    Phone,
    Star,
    Filter
} from 'lucide-react';

export interface DoctorAppointmentItem {
    id: string;
    serial_no: number | null;
    appointment_date: string;
    start_time: string;
    end_time?: string;
    status: string;
    visit_type?: string;
    visit_source?: string;
    payment_status?: string | null;
    paid_amount?: number | string | null;
    prescription_record_id?: string | null;
    patients?: {
        id?: string;
        full_name?: string;
        uhid?: string;
        mobile_no?: string;
        gender?: string;
        dob?: string;
    } | null;
    appointment_feedbacks?: {
        doctor_rating?: number;
        service_rating?: number;
        overall_rating?: number;
        comment?: string | null;
    } | Array<{
        doctor_rating?: number;
        service_rating?: number;
        overall_rating?: number;
        comment?: string | null;
    }> | null;
}

interface Props {
    appointments: DoctorAppointmentItem[];
    doctorName: string;
    todayDate: string;
}

type TimeTab = 'all' | 'upcoming' | 'today' | 'prev';

export default function DoctorAllAppointmentsClient({
    appointments: initialAppointments,
    doctorName,
    todayDate
}: Props) {
    const [appointments] = useState<DoctorAppointmentItem[]>(initialAppointments);
    const [selectedTimeTab, setSelectedTimeTab] = useState<TimeTab>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [detailModalAppt, setDetailModalAppt] = useState<DoctorAppointmentItem | null>(null);

    // Classify time helper matching patient portal standard (Dhaka Timezone)
    const classifyTime = (aptDate: string, startTime: string) => {
        try {
            const now = toZonedTime(new Date(), 'Asia/Dhaka');
            const todayStr = todayDate || format(now, 'yyyy-MM-dd');
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

    // Filter counts based on Bangladesh time
    const timeCounts = useMemo(() => {
        let all = 0;
        let upcoming = 0;
        let today = 0;
        let prev = 0;

        appointments.forEach(apt => {
            all++;
            const { isToday, isUpcoming, isPrevious } = classifyTime(apt.appointment_date, apt.start_time);
            if (isUpcoming) upcoming++;
            if (isToday) today++;
            if (isPrevious) prev++;
        });

        return { all, upcoming, today, prev };
    }, [appointments, todayDate]);

    // Filter appointments
    const filteredAppointments = useMemo(() => {
        return appointments.filter(apt => {
            // 1. Time Tab Filter
            if (selectedTimeTab !== 'all') {
                const { isToday, isUpcoming, isPrevious } = classifyTime(apt.appointment_date, apt.start_time);
                if (selectedTimeTab === 'upcoming' && !isUpcoming) return false;
                if (selectedTimeTab === 'today' && !isToday) return false;
                if (selectedTimeTab === 'prev' && !isPrevious) return false;
            }

            // 2. Status Dropdown Filter
            if (statusFilter !== 'all' && apt.status !== statusFilter) {
                return false;
            }

            // 3. Search Query Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const p = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;
                const name = (p?.full_name || '').toLowerCase();
                const uhid = (p?.uhid || '').toLowerCase();
                const mobile = (p?.mobile_no || '').toLowerCase();
                const serial = String(apt.serial_no || '');
                const date = apt.appointment_date || '';

                if (!name.includes(q) && !uhid.includes(q) && !mobile.includes(q) && !serial.includes(q) && !date.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [appointments, selectedTimeTab, statusFilter, searchQuery]);

    return (
        <div>
            <style>{`
                .appointment-row {
                    cursor: pointer;
                    transition: background-color 0.15s ease;
                }
                .appointment-row:hover td {
                    background-color: #f0fdf4 !important;
                }
                .doctor-time-pill {
                    background-color: #ffffff !important;
                    color: #475569 !important;
                    border: 1px solid #cbd5e1 !important;
                }
                .doctor-time-pill.active-all {
                    background-color: #1B2978 !important;
                    color: #ffffff !important;
                    border-color: #1B2978 !important;
                }
                .doctor-time-pill.active-upcoming {
                    background-color: #3346B5 !important;
                    color: #ffffff !important;
                    border-color: #3346B5 !important;
                }
                .doctor-time-pill.active-today {
                    background-color: #1B2978 !important;
                    color: #ffffff !important;
                    border-color: #1B2978 !important;
                }
                .doctor-time-pill.active-prev {
                    background-color: #475569 !important;
                    color: #ffffff !important;
                    border-color: #475569 !important;
                }
            `}</style>

            {/* Filter Control Bar */}
            <div className="bg-white p-3 p-md-4 mb-4 shadow-sm border rounded-0">
                <div className="row g-3 align-items-center">
                    {/* Time Tab Buttons */}
                    <div className="col-lg-6 col-md-12">
                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-time-pill ${
                                    selectedTimeTab === 'all' ? 'active-all shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTimeTab('all')}
                            >
                                <span>All Visits</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'all' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.all}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-time-pill ${
                                    selectedTimeTab === 'upcoming' ? 'active-upcoming shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTimeTab('upcoming')}
                            >
                                <Calendar size={13} />
                                <span>Upcoming</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'upcoming' ? 'bg-white text-dark' : 'bg-primary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.upcoming}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-time-pill ${
                                    selectedTimeTab === 'today' ? 'active-today shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTimeTab('today')}
                            >
                                <Clock size={13} />
                                <span>Today</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'today' ? 'bg-white text-dark' : 'bg-success text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.today}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-time-pill ${
                                    selectedTimeTab === 'prev' ? 'active-prev shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTimeTab('prev')}
                            >
                                <span>Previous</span>
                                <span className={`badge rounded-pill ${selectedTimeTab === 'prev' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {timeCounts.prev}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Status Dropdown & Search Input */}
                    <div className="col-lg-6 col-md-12">
                        <div className="row g-2 justify-content-lg-end">
                            {/* Status Filter */}
                            <div className="col-sm-5">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light text-muted border-secondary-subtle">
                                        <Filter size={13} />
                                    </span>
                                    <select
                                        className="form-select border-secondary-subtle"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                    >
                                        <option value="all">All Statuses</option>
                                        <option value="scheduled">Scheduled</option>
                                        <option value="checked_in">Checked In</option>
                                        <option value="in_consultation">In Consultation</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="no_show">No Show</option>
                                    </select>
                                </div>
                            </div>

                            {/* Search Input */}
                            <div className="col-sm-7">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-light text-muted border-secondary-subtle">
                                        <Search size={13} />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-secondary-subtle"
                                        placeholder="Patient, UHID, Mobile, Serial..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button 
                                            className="btn btn-outline-secondary border-secondary-subtle" 
                                            type="button" 
                                            onClick={() => setSearchQuery('')}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Appointments Table */}
            <div className="card border-0 shadow-sm rounded-0">
                <div className="card-body p-0">
                    {filteredAppointments.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-1"></i>
                            <p className="mt-2 mb-0">No appointments found matching this criteria.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light border-bottom">
                                    <tr>
                                        <th className="px-4 py-3" style={{ color: '#1B2978' }}>Serial</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Patient Details</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Date & Slot</th>
                                        <th className="py-3" style={{ color: '#1B2978' }}>Visit Type</th>
                                        <th className="py-3 text-center" style={{ color: '#1B2978' }}>Rating & Feedback</th>
                                        <th className="py-3 text-center" style={{ color: '#1B2978' }}>Download Slips</th>
                                        <th className="px-4 py-3 text-end" style={{ color: '#1B2978' }}>Status & Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAppointments.map((apt) => {
                                        const p = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;
                                        const fb = Array.isArray(apt.appointment_feedbacks) ? apt.appointment_feedbacks[0] : apt.appointment_feedbacks;

                                        return (
                                            <tr 
                                                key={apt.id}
                                                className="appointment-row"
                                                onClick={() => setDetailModalAppt(apt)}
                                                title="Click anywhere to view full appointment details"
                                            >
                                                {/* Serial / Token */}
                                                <td className="px-4 py-3">
                                                    <div 
                                                        className="d-inline-flex flex-column align-items-center justify-content-center bg-light border border-secondary-subtle px-2 py-1 text-center"
                                                        style={{ minWidth: '48px' }}
                                                    >
                                                        <span className="small text-muted" style={{ fontSize: '10px', lineHeight: 1 }}>TOKEN</span>
                                                        <span className="fw-bold fs-6 text-dark" style={{ lineHeight: 1.2 }}>
                                                            #{apt.serial_no || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Patient Details */}
                                                <td className="py-3">
                                                    <div className="fw-bold text-dark">{p?.full_name || 'Patient'}</div>
                                                    <div className="text-muted small" style={{ fontSize: '12px' }}>
                                                        <span className="badge bg-light text-secondary border me-1">{p?.uhid || 'UHID'}</span>
                                                        {p?.gender && <span className="me-2">{p.gender}</span>}
                                                        {p?.mobile_no && <span className="text-secondary"><Phone size={11} className="inline me-0.5" />{p.mobile_no}</span>}
                                                    </div>
                                                </td>

                                                {/* Date & Slot */}
                                                <td className="py-3">
                                                    <div className="fw-semibold text-dark">
                                                        <Calendar size={13} className="inline me-1 text-muted" />
                                                        {apt.appointment_date ? format(parseISO(apt.appointment_date), 'MMM dd, yyyy') : 'N/A'}
                                                    </div>
                                                    <div className="text-muted small">
                                                        <Clock size={12} className="inline me-1 text-muted" />
                                                        {apt.start_time || 'N/A'}
                                                    </div>
                                                </td>

                                                {/* Visit Type */}
                                                <td className="py-3">
                                                    <span className="badge bg-light text-dark border text-capitalize px-2 py-1">
                                                        {apt.visit_type ? apt.visit_type.replace('_', ' ') : 'General'}
                                                    </span>
                                                </td>

                                                {/* Rating & Feedback */}
                                                <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {fb && fb.overall_rating ? (
                                                        <div>
                                                            <span className="badge bg-warning text-dark fw-bold px-2 py-1 me-1 shadow-xs">
                                                                <Star size={11} className="inline me-0.5 fill-current" />
                                                                {Number(fb.overall_rating).toFixed(1)}
                                                            </span>
                                                            {fb.comment && (
                                                                <span className="small text-muted text-truncate d-inline-block align-middle" style={{ maxWidth: '140px' }} title={fb.comment}>
                                                                    "{fb.comment}"
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : apt.status === 'completed' ? (
                                                        <span className="small text-muted">Awaiting Review</span>
                                                    ) : (
                                                        <span className="text-muted small">-</span>
                                                    )}
                                                </td>

                                                {/* Download Slips */}
                                                <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <div className="d-flex flex-column gap-1.5 align-items-center justify-content-center">
                                                        <a
                                                            href={`/appointment/slips/booking?appointment_id=${apt.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm btn-outline-dark py-1 px-2.5 d-inline-flex align-items-center gap-1 shadow-xs"
                                                            style={{ fontSize: '11px' }}
                                                            title="Download booking slip"
                                                        >
                                                            <Download size={12} className="text-primary" />
                                                            <span>Booking Slip</span>
                                                        </a>

                                                        <a
                                                            href={`/appointment/slips/prescription?appointment_id=${apt.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1 text-white shadow-xs"
                                                            style={{ backgroundColor: '#1B2978', fontSize: '11px', borderColor: '#1B2978' }}
                                                            title="Download prescription ticket"
                                                        >
                                                            <FileText size={12} />
                                                            <span>Prescription</span>
                                                        </a>
                                                    </div>
                                                </td>

                                                {/* Status & Action */}
                                                <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                                                    <div className="d-flex align-items-center justify-content-end gap-2">
                                                        <span className={`badge ${getStatusBadgeColor(apt.status)} px-2.5 py-1.5`}>
                                                            {getStatusLabel(apt.status)}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 py-1 px-2"
                                                            onClick={() => setDetailModalAppt(apt)}
                                                        >
                                                            <Eye size={13} />
                                                            <span>Details</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Appointment Detail Modal */}
            {detailModalAppt && (() => {
                const p = Array.isArray(detailModalAppt.patients) ? detailModalAppt.patients[0] : detailModalAppt.patients;
                const fb = Array.isArray(detailModalAppt.appointment_feedbacks) ? detailModalAppt.appointment_feedbacks[0] : detailModalAppt.appointment_feedbacks;

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
                            overflowY: 'auto'
                        }}
                        onClick={() => setDetailModalAppt(null)}
                    >
                        <div className="modal-dialog modal-dialog-centered modal-lg my-4" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content border-0 shadow-lg rounded-3 overflow-hidden">
                                {/* Modal Header */}
                                <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#1B2978' }}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-white text-dark rounded px-2.5 py-1 text-center shadow-xs">
                                            <div className="small text-muted" style={{ fontSize: '9px', lineHeight: 1 }}>TOKEN</div>
                                            <div className="fw-bold fs-6" style={{ color: '#1B2978', lineHeight: 1.2 }}>
                                                #{detailModalAppt.serial_no || '-'}
                                            </div>
                                        </div>
                                        <div>
                                            <h5 className="modal-title fw-bold m-0 text-white">
                                                Appointment Details
                                            </h5>
                                            <small className="text-white-50">
                                                {detailModalAppt.appointment_date} · {detailModalAppt.start_time}
                                            </small>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn-close btn-close-white" 
                                        onClick={() => setDetailModalAppt(null)}
                                        aria-label="Close"
                                    ></button>
                                </div>

                                {/* Modal Body */}
                                <div className="modal-body p-4 bg-light">
                                    <div className="row g-3">
                                        {/* Patient Info Card */}
                                        <div className="col-md-6">
                                            <div className="card border-0 shadow-xs h-100 p-3 bg-white">
                                                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                                                    <User size={16} className="text-primary" />
                                                    Patient Information
                                                </h6>
                                                <div className="d-flex flex-column gap-1.5 small">
                                                    <div>
                                                        <span className="text-muted">Full Name: </span>
                                                        <strong className="text-dark">{p?.full_name || 'Patient'}</strong>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">UHID: </span>
                                                        <span className="badge bg-light text-dark border">{p?.uhid || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">Mobile: </span>
                                                        <span className="text-dark">{p?.mobile_no || 'N/A'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">Gender: </span>
                                                        <span className="text-dark">{p?.gender || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Consultation Details */}
                                        <div className="col-md-6">
                                            <div className="card border-0 shadow-xs h-100 p-3 bg-white">
                                                <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                                                    <Clock size={16} className="text-primary" />
                                                    Consultation Information
                                                </h6>
                                                <div className="d-flex flex-column gap-1.5 small">
                                                    <div>
                                                        <span className="text-muted">Status: </span>
                                                        <span className={`badge ${getStatusBadgeColor(detailModalAppt.status)}`}>
                                                            {getStatusLabel(detailModalAppt.status)}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">Visit Type: </span>
                                                        <span className="text-capitalize text-dark fw-semibold">
                                                            {detailModalAppt.visit_type ? detailModalAppt.visit_type.replace('_', ' ') : 'General'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">Payment: </span>
                                                        <span className="text-dark fw-semibold">
                                                            {detailModalAppt.payment_status === 'paid' ? `Paid (BDT ${detailModalAppt.paid_amount || '0'})` : 'Pay at Counter / Unpaid'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <span className="text-muted">Doctor: </span>
                                                        <span className="text-dark fw-semibold">{doctorName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Patient Feedback (if submitted) */}
                                        {fb && fb.overall_rating && (
                                            <div className="col-12">
                                                <div className="card border-0 shadow-xs p-3 bg-white">
                                                    <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-2">
                                                        <Star size={16} className="text-warning fill-current" />
                                                        Patient Review & Rating
                                                    </h6>
                                                    <div className="d-flex align-items-center gap-3">
                                                        <span className="badge bg-warning text-dark fs-6 px-3 py-1.5">
                                                            ★ {Number(fb.overall_rating).toFixed(1)} / 5.0
                                                        </span>
                                                        {fb.comment && (
                                                            <span className="text-secondary small fst-italic">
                                                                "{fb.comment}"
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="modal-footer bg-white p-3 d-flex justify-content-between flex-wrap gap-2">
                                    <div className="d-flex gap-2 flex-wrap">
                                        <a
                                            href={`/appointment/slips/booking?appointment_id=${detailModalAppt.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline-dark d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold rounded-2"
                                        >
                                            <Download size={15} className="text-primary" />
                                            <span>Booking Slip</span>
                                        </a>

                                        <a
                                            href={`/appointment/slips/prescription?appointment_id=${detailModalAppt.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn text-white d-inline-flex align-items-center gap-1.5 px-3 py-2 fw-semibold rounded-2"
                                            style={{ backgroundColor: '#1B2978' }}
                                        >
                                            <FileText size={15} />
                                            <span>Prescription Ticket</span>
                                        </a>

                                        <a
                                            href={`/appointment/slips/prescription?appointment_id=${detailModalAppt.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-outline-secondary d-inline-flex align-items-center gap-1.5 px-3 py-2 rounded-2"
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
            })()}
        </div>
    );
}

