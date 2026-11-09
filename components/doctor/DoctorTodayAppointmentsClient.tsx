'use client';

import React, { useState, useMemo } from 'react';
import { formatTime } from '@/lib/format';
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
    CheckCircle2,
    AlertCircle,
    Phone,
    ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

export interface TodayAppointment {
    id: string;
    serial_no: number | null;
    start_time: string;
    end_time?: string;
    appointment_date?: string;
    status: string;
    visit_type?: string;
    visit_source?: string;
    is_priority?: boolean;
    priority_reason?: string;
    checked_in_at?: string | null;
    consult_started_at?: string | null;
    consult_ended_at?: string | null;
    payment_status?: string | null;
    paid_amount?: number | string | null;
    prescription_record_id?: string | null;
    patient?: {
        id?: string;
        full_name?: string;
        uhid?: string;
        mobile?: string;
        gender?: string;
        dob?: string;
    } | null;
}

interface Props {
    appointments: TodayAppointment[];
    todayDate: string;
    doctorName: string;
    specialityName?: string;
    session: {
        status: string;
        started_at?: string | null;
        delay_minutes?: number;
        delay_reason?: string | null;
    } | null;
}

type FilterTab = 'all' | 'waiting' | 'in_room' | 'scheduled' | 'completed';

export default function DoctorTodayAppointmentsClient({
    appointments: initialAppointments,
    todayDate,
    doctorName,
    specialityName = 'Specialist Physician',
    session
}: Props) {
    const [appointments] = useState<TodayAppointment[]>(initialAppointments);
    const [selectedTab, setSelectedTab] = useState<FilterTab>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [detailModalAppt, setDetailModalAppt] = useState<TodayAppointment | null>(null);

    // Filter counts
    const counts = useMemo(() => {
        return {
            all: appointments.length,
            waiting: appointments.filter(a => a.status === 'checked_in').length,
            in_room: appointments.filter(a => a.status === 'in_consultation').length,
            scheduled: appointments.filter(a => a.status === 'scheduled').length,
            completed: appointments.filter(a => a.status === 'completed').length,
        };
    }, [appointments]);

    // Filtered list
    const filtered = useMemo(() => {
        return appointments.filter(apt => {
            // Tab filter
            if (selectedTab === 'waiting' && apt.status !== 'checked_in') return false;
            if (selectedTab === 'in_room' && apt.status !== 'in_consultation') return false;
            if (selectedTab === 'scheduled' && apt.status !== 'scheduled') return false;
            if (selectedTab === 'completed' && apt.status !== 'completed') return false;

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const name = (apt.patient?.full_name || '').toLowerCase();
                const uhid = (apt.patient?.uhid || '').toLowerCase();
                const mobile = (apt.patient?.mobile || '').toLowerCase();
                const serial = String(apt.serial_no || '');
                if (!name.includes(q) && !uhid.includes(q) && !mobile.includes(q) && !serial.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [appointments, selectedTab, searchQuery]);

    const chamberStatus = session?.status || 'not_started';
    const inConsult = appointments.find(a => a.status === 'in_consultation');

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
                .doctor-today-pill {
                    background-color: #ffffff !important;
                    color: #475569 !important;
                    border: 1px solid #cbd5e1 !important;
                }
                .doctor-today-pill.active-all {
                    background-color: #0D7D72 !important;
                    color: #ffffff !important;
                    border-color: #0D7D72 !important;
                }
                .doctor-today-pill.active-waiting {
                    background-color: #0ab1a9 !important;
                    color: #ffffff !important;
                    border-color: #0ab1a9 !important;
                }
                .doctor-today-pill.active-in-room {
                    background-color: #0d6efd !important;
                    color: #ffffff !important;
                    border-color: #0d6efd !important;
                }
                .doctor-today-pill.active-scheduled {
                    background-color: #64748b !important;
                    color: #ffffff !important;
                    border-color: #64748b !important;
                }
                .doctor-today-pill.active-completed {
                    background-color: #16a34a !important;
                    color: #ffffff !important;
                    border-color: #16a34a !important;
                }
            `}</style>

            {/* Chamber Status Bar */}
            <div className="card border-0 shadow-sm rounded-0 mb-4" style={{ borderLeft: '5px solid #0D7D72' }}>
                <div className="card-body p-4">
                    <div className="row align-items-center g-3">
                        <div className="col-md-7">
                            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2">
                                Chamber Status:
                                <span className={`badge ${
                                    chamberStatus === 'open' ? 'bg-success' :
                                    chamberStatus === 'paused' ? 'bg-warning text-dark' : 'bg-secondary'
                                } px-3 py-1.5 fs-6`}>
                                    {chamberStatus === 'open' ? 'ACTIVE / OPEN' :
                                     chamberStatus === 'paused' ? 'PAUSED' : 'NOT STARTED'}
                                </span>
                            </h5>
                            <small className="text-muted">
                                {session?.started_at ? `Started at ${session.started_at.slice(11, 16)}` : 'Chamber not yet started by staff'}
                                {session && session.delay_minutes && session.delay_minutes > 0 ? (
                                    <span className="text-danger ms-2 fw-semibold">
                                        · Delay: {session.delay_minutes} min ({session.delay_reason || 'Emergency delay'})
                                    </span>
                                ) : null}
                            </small>
                        </div>
                        <div className="col-md-5 text-md-end">
                            <span className="badge bg-light text-dark border px-3 py-2 fs-6">
                                Currently Inside: <strong>{inConsult ? `#${inConsult.serial_no} (${inConsult.patient?.full_name})` : 'Room Available'}</strong>
                            </span>
                        </div>
                    </div>

                    <div className="row g-2 mt-3 pt-3 border-top text-center">
                        <div className="col-3">
                            <small className="text-muted d-block fw-semibold">Present & Waiting</small>
                            <strong className="fs-5 text-info">{counts.waiting}</strong>
                        </div>
                        <div className="col-3">
                            <small className="text-muted d-block fw-semibold">Not Yet Arrived</small>
                            <strong className="fs-5 text-secondary">{counts.scheduled}</strong>
                        </div>
                        <div className="col-3">
                            <small className="text-muted d-block fw-semibold">Completed</small>
                            <strong className="fs-5 text-success">{counts.completed}</strong>
                        </div>
                        <div className="col-3">
                            <small className="text-muted d-block fw-semibold">Total Today</small>
                            <strong className="fs-5 text-dark">{counts.all}</strong>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-3 p-md-4 mb-4 shadow-sm border rounded-0">
                <div className="row g-3 align-items-center">
                    {/* Status Tabs */}
                    <div className="col-lg-8 col-md-12">
                        <div className="d-flex flex-wrap gap-2">
                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-today-pill ${
                                    selectedTab === 'all' ? 'active-all shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTab('all')}
                            >
                                <span>All Today</span>
                                <span className={`badge rounded-pill ${selectedTab === 'all' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {counts.all}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-today-pill ${
                                    selectedTab === 'waiting' ? 'active-waiting shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTab('waiting')}
                            >
                                <span>Waiting (Arrived)</span>
                                <span className={`badge rounded-pill ${selectedTab === 'waiting' ? 'bg-white text-dark' : 'bg-info text-dark'}`} style={{ fontSize: '11px' }}>
                                    {counts.waiting}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-today-pill ${
                                    selectedTab === 'in_room' ? 'active-in-room shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTab('in_room')}
                            >
                                <span>In Room</span>
                                <span className={`badge rounded-pill ${selectedTab === 'in_room' ? 'bg-white text-dark' : 'bg-primary text-white'}`} style={{ fontSize: '11px' }}>
                                    {counts.in_room}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-today-pill ${
                                    selectedTab === 'scheduled' ? 'active-scheduled shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTab('scheduled')}
                            >
                                <span>Expected</span>
                                <span className={`badge rounded-pill ${selectedTab === 'scheduled' ? 'bg-white text-dark' : 'bg-secondary text-white'}`} style={{ fontSize: '11px' }}>
                                    {counts.scheduled}
                                </span>
                            </button>

                            <button
                                type="button"
                                className={`btn btn-sm px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1.5 transition-all doctor-today-pill ${
                                    selectedTab === 'completed' ? 'active-completed shadow-sm' : ''
                                }`}
                                onClick={() => setSelectedTab('completed')}
                            >
                                <span>Completed</span>
                                <span className={`badge rounded-pill ${selectedTab === 'completed' ? 'bg-white text-dark' : 'bg-success text-white'}`} style={{ fontSize: '11px' }}>
                                    {counts.completed}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="col-lg-4 col-md-12">
                        <div className="input-group input-group-sm">
                            <span className="input-group-text bg-light text-muted border-secondary-subtle">
                                <Search size={14} />
                            </span>
                            <input
                                type="text"
                                className="form-control border-secondary-subtle"
                                placeholder="Patient, UHID, Mobile, Serial #..."
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

            {/* Queue Table */}
            <div className="card border-0 shadow-sm rounded-0">
                <div className="card-body p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <i className="bi bi-inbox fs-1"></i>
                            <p className="mt-2 mb-0">No appointments found matching this criteria.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover mb-0 align-middle">
                                <thead className="table-light border-bottom">
                                    <tr>
                                        <th className="px-4 py-3" style={{ color: '#0D7D72' }}>Serial</th>
                                        <th className="py-3" style={{ color: '#0D7D72' }}>Patient Details</th>
                                        <th className="py-3" style={{ color: '#0D7D72' }}>Slot & Arrival</th>
                                        <th className="py-3" style={{ color: '#0D7D72' }}>Visit Type</th>
                                        <th className="py-3 text-center" style={{ color: '#0D7D72' }}>Download Slips</th>
                                        <th className="px-4 py-3 text-end" style={{ color: '#0D7D72' }}>Status & Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((apt) => {
                                        const p = apt.patient;
                                        const isInRoom = apt.status === 'in_consultation';

                                        return (
                                            <tr 
                                                key={apt.id}
                                                className={`appointment-row ${isInRoom ? 'table-primary' : ''}`}
                                                onClick={() => setDetailModalAppt(apt)}
                                                title="Click anywhere to view full appointment details"
                                            >
                                                {/* Serial / Token */}
                                                <td className="px-4 py-3">
                                                    <div 
                                                        className={`d-inline-flex flex-column align-items-center justify-content-center px-2 py-1 text-center border ${
                                                            isInRoom ? 'bg-primary text-white border-primary' : 'bg-light border-secondary-subtle'
                                                        }`}
                                                        style={{ minWidth: '48px' }}
                                                    >
                                                        <span className="small" style={{ fontSize: '10px', lineHeight: 1 }}>TOKEN</span>
                                                        <span className="fw-bold fs-6" style={{ lineHeight: 1.2 }}>
                                                            #{apt.serial_no || '-'}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Patient Details */}
                                                <td className="py-3">
                                                    <div className="fw-bold text-dark d-flex align-items-center gap-2">
                                                        {p?.full_name || 'Patient'}
                                                        {apt.is_priority && (
                                                            <span className="badge bg-danger text-white py-0.5 px-1.5" style={{ fontSize: '10px' }}>
                                                                <i className="bi bi-lightning-fill me-1"></i>PRIORITY
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-muted small" style={{ fontSize: '12px' }}>
                                                        <span className="badge bg-light text-secondary border me-1">{p?.uhid || 'UHID'}</span>
                                                        {p?.gender && <span className="me-2">{p.gender}</span>}
                                                        {p?.mobile && <span className="text-secondary"><Phone size={11} className="inline me-0.5" />{p.mobile}</span>}
                                                    </div>
                                                </td>

                                                {/* Slot & Arrival */}
                                                <td className="py-3">
                                                    <div className="fw-semibold text-dark">
                                                        <Clock size={13} className="inline me-1 text-muted" />
                                                        {formatTime(apt.start_time)}
                                                    </div>
                                                    <div className="small">
                                                        {apt.checked_in_at ? (
                                                            <span className="text-success fw-semibold">
                                                                <CheckCircle2 size={12} className="inline me-0.5" /> Arrived {apt.checked_in_at.slice(11, 16)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted">Not checked in</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Visit Type */}
                                                <td className="py-3">
                                                    <span className="badge bg-light text-dark border text-capitalize px-2 py-1 me-1">
                                                        {apt.visit_type ? apt.visit_type.replace('_', ' ') : 'General'}
                                                    </span>
                                                    <span className="badge bg-light text-secondary border text-capitalize px-2 py-1">
                                                        {apt.visit_source || 'Online'}
                                                    </span>
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
                                                            title="Open or print booking slip"
                                                        >
                                                            <Download size={12} className="text-primary" />
                                                            <span>Booking Slip</span>
                                                        </a>

                                                        <a
                                                            href={`/appointment/slips/prescription?appointment_id=${apt.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-sm py-1 px-2.5 d-inline-flex align-items-center gap-1 text-white shadow-xs"
                                                            style={{ backgroundColor: '#0D7D72', fontSize: '11px', borderColor: '#0D7D72' }}
                                                            title="Open official prescription ticket"
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
            {detailModalAppt && (
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
                            <div className="modal-header text-white py-3 px-4" style={{ backgroundColor: '#0D7D72' }}>
                                <div className="d-flex align-items-center gap-3">
                                    <div className="bg-white text-dark rounded px-2.5 py-1 text-center shadow-xs">
                                        <div className="small text-muted" style={{ fontSize: '9px', lineHeight: 1 }}>TOKEN</div>
                                        <div className="fw-bold fs-6" style={{ color: '#0D7D72', lineHeight: 1.2 }}>
                                            #{detailModalAppt.serial_no || '-'}
                                        </div>
                                    </div>
                                    <div>
                                        <h5 className="modal-title fw-bold m-0 text-white">
                                            Appointment & Consultation Overview
                                        </h5>
                                        <small className="text-white-50">
                                            {todayDate} · {formatTime(detailModalAppt.start_time)}
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
                                                    <strong className="text-dark">{detailModalAppt.patient?.full_name || 'Patient'}</strong>
                                                </div>
                                                <div>
                                                    <span className="text-muted">UHID: </span>
                                                    <span className="badge bg-light text-dark border">{detailModalAppt.patient?.uhid || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Mobile: </span>
                                                    <span className="text-dark">{detailModalAppt.patient?.mobile || 'N/A'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Gender: </span>
                                                    <span className="text-dark">{detailModalAppt.patient?.gender || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Consultation & Chamber Card */}
                                    <div className="col-md-6">
                                        <div className="card border-0 shadow-xs h-100 p-3 bg-white">
                                            <h6 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                                                <Clock size={16} className="text-primary" />
                                                Visit & Chamber Status
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
                                                        {detailModalAppt.visit_type ? detailModalAppt.visit_type.replace('_', ' ') : 'General Visit'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Arrival: </span>
                                                    <span className="text-dark">
                                                        {detailModalAppt.checked_in_at 
                                                            ? `Checked in at ${detailModalAppt.checked_in_at.slice(11, 16)}` 
                                                            : 'Not yet arrived in waiting lobby'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-muted">Consulting Doctor: </span>
                                                    <span className="text-dark fw-semibold">{doctorName} ({specialityName})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
                                        style={{ backgroundColor: '#0D7D72' }}
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
            )}
        </div>
    );
}

