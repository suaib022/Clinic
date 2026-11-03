'use client';

import React, { useState } from 'react';
import {
    Calendar,
    Clock,
    User,
    Stethoscope,
    CheckCircle2,
    Copy,
    Check,
    Video,
    MapPin,
    AlertTriangle,
    ShieldAlert,
    Pill,
    Building2,
    ArrowRight,
    FileText,
    MessageSquare
} from 'lucide-react';
import {
    ParsedCard,
    AppointmentCardData,
    TriageCardData,
    PrescriptionCardData,
    ActionChoiceCardData
} from '@/lib/chat/messageParser';

interface ConfirmationCardProps {
    card: ParsedCard;
    onActionSelect?: (actionKey: string) => void;
}

export default function ConfirmationCard({ card, onActionSelect }: ConfirmationCardProps) {
    const [copied, setCopied] = useState(false);
    const [selectedAction, setSelectedAction] = useState<string | null>(null);

    const handleCopy = (text: string) => {
        if (!navigator.clipboard) return;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadICS = (appt: AppointmentCardData) => {
        const title = `Clinic Appointment with ${appt.doctorName}`;
        const description = `Specialty: ${appt.specialty}\\nLocation: ${appt.roomOrLink}\\nBooking Reference: ${appt.bookingId}`;
        const now = new Date();
        const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Clinic//Aura Assistant//EN',
            'BEGIN:VEVENT',
            `SUMMARY:${title}`,
            `DESCRIPTION:${description}`,
            `LOCATION:${appt.roomOrLink}`,
            `DTSTART:${formatDate(start)}`,
            `DTEND:${formatDate(end)}`,
            'STATUS:CONFIRMED',
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${appt.bookingId}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // 1. APPOINTMENT CARD (Neo-Brutalist 2px black border)
    if (card.type === 'appointment') {
        const data = card.data as AppointmentCardData;
        return (
            <div
                style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: '12px',
                    boxShadow: '2px 2px 0px #000000',
                    padding: '14px',
                    margin: '8px 0',
                    color: '#000000'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1.5px solid #000000' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ backgroundColor: '#fed7aa', padding: '4px', borderRadius: '6px', border: '1px solid #000000', display: 'flex' }}>
                            <Calendar size={16} color="#000000" />
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Appointment Confirmed</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleCopy(data.bookingId)}
                        style={{
                            background: '#ffffff',
                            border: '1.5px solid #000000',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            boxShadow: '1px 1px 0px #000000'
                        }}
                        title="Copy Reference"
                    >
                        {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{data.bookingId}</span>
                    </button>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Stethoscope size={15} color="#000000" />
                        <span style={{ fontWeight: 700, fontSize: '13px' }}>{data.doctorName}</span>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, backgroundColor: '#f1f5f9', border: '1px solid #000000', padding: '1px 6px', borderRadius: '4px' }}>
                            {data.specialty}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                        {data.isTelehealth ? <Video size={14} color="#000000" /> : <MapPin size={14} color="#000000" />}
                        <span>{data.roomOrLink}</span>
                    </div>
                </div>

                {/* Milestone Checklist */}
                <div style={{ backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '8px', border: '1px solid #000000', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Verification Status
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '11.5px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                            <CheckCircle2 size={13} />
                            <span>Scheduled</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                            <CheckCircle2 size={13} />
                            <span>Confirmed</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
                            <CheckCircle2 size={13} />
                            <span>Assigned</span>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => handleDownloadICS(data)}
                        style={{
                            backgroundColor: '#f59e0b',
                            border: '1.5px solid #000000',
                            borderRadius: '6px',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            flexGrow: 1,
                            cursor: 'pointer',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        <Calendar size={13} />
                        <span>Add to Calendar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => handleCopy(data.bookingId)}
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #000000',
                            borderRadius: '6px',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: '12px',
                            padding: '6px 12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            cursor: 'pointer',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        {copied ? <Check size={13} color="#16a34a" /> : <Copy size={13} />}
                        <span>{copied ? 'Copied' : 'Copy ID'}</span>
                    </button>
                </div>
            </div>
        );
    }

    // 2. CLINICAL TRIAGE CARD
    if (card.type === 'triage') {
        const data = card.data as TriageCardData;
        const isUrgent = data.urgency === 'Immediate Nurse Review';
        const isModerate = data.urgency === 'Moderate';

        return (
            <div
                style={{
                    backgroundColor: isUrgent ? '#fef2f2' : '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: '12px',
                    boxShadow: '2px 2px 0px #000000',
                    padding: '14px',
                    margin: '8px 0',
                    color: '#000000'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1.5px solid #000000' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isUrgent ? (
                            <ShieldAlert size={18} color="#dc2626" />
                        ) : (
                            <AlertTriangle size={18} color={isModerate ? '#d97706' : '#16a34a'} />
                        )}
                        <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Clinical Triage Intake</span>
                    </div>
                    <span
                        style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1.5px solid #000000',
                            backgroundColor: isUrgent ? '#ef4444' : isModerate ? '#f59e0b' : '#22c55e',
                            color: isUrgent ? '#ffffff' : '#000000',
                            boxShadow: '1px 1px 0px #000000'
                        }}
                    >
                        {data.urgency}
                    </span>
                </div>

                <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                    <div style={{ color: '#475569', marginBottom: '4px' }}>
                        Reference ID:
                        <span style={{ fontWeight: 700, color: '#000000', marginLeft: '6px', fontFamily: 'monospace' }}>{data.referenceId}</span>
                    </div>
                    <div style={{ color: '#475569', marginBottom: '6px' }}>
                        Assigned Protocol: <strong style={{ color: '#000000' }}>{data.protocol}</strong>
                    </div>
                    {data.summary && (
                        <p style={{ margin: 0, backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #000000', color: '#334155', fontSize: '12px', lineHeight: 1.4 }}>
                            {data.summary}
                        </p>
                    )}
                </div>

                {data.escalatedToNurse && (
                    <div style={{ backgroundColor: '#fee2e2', border: '1.5px solid #dc2626', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                        <ShieldAlert size={14} color="#dc2626" />
                        <span>High-priority alert dispatched to on-call triage desk.</span>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => handleCopy(data.referenceId)}
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #000000',
                            borderRadius: '6px',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy Reference'}</span>
                    </button>
                </div>
            </div>
        );
    }

    // 3. PRESCRIPTION REFILL CARD
    if (card.type === 'prescription') {
        const data = card.data as PrescriptionCardData;
        return (
            <div
                style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: '12px',
                    boxShadow: '2px 2px 0px #000000',
                    padding: '14px',
                    margin: '8px 0',
                    color: '#000000'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1.5px solid #000000' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Pill size={16} color="#000000" />
                        <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Prescription Refill</span>
                    </div>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '11px', backgroundColor: '#f1f5f9', border: '1px solid #000000', padding: '2px 6px', borderRadius: '4px' }}>
                        {data.refillId}
                    </span>
                </div>

                <div style={{ fontSize: '12px', marginBottom: '10px' }}>
                    <div style={{ marginBottom: '4px' }}>
                        <span style={{ color: '#64748b' }}>Medication: </span>
                        <strong style={{ fontSize: '13px' }}>{data.medication}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '4px' }}>
                        <div><span style={{ color: '#64748b' }}>Dosage:</span> {data.dosage}</div>
                        <div><span style={{ color: '#64748b' }}>Ready:</span> <strong style={{ color: '#16a34a' }}>{data.estimatedReady}</strong></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', marginTop: '4px' }}>
                        <Building2 size={13} color="#000000" />
                        <span>Pharmacy: {data.pharmacy}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={() => handleCopy(data.refillId)}
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1.5px solid #000000',
                            borderRadius: '6px',
                            color: '#000000',
                            fontWeight: 700,
                            fontSize: '11.5px',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        {copied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copied ? 'Copied' : 'Copy Refill ID'}</span>
                    </button>
                </div>
            </div>
        );
    }

    // 4. ACTION CHOICE BUTTONS
    if (card.type === 'action_choice') {
        const data = card.data as ActionChoiceCardData;
        return (
            <div
                style={{
                    backgroundColor: '#ffffff',
                    border: '2px solid #000000',
                    borderRadius: '12px',
                    boxShadow: '2px 2px 0px #000000',
                    padding: '12px 14px',
                    margin: '8px 0',
                    color: '#000000'
                }}
            >
                <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', fontWeight: 600 }}>
                    {data.prompt}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedAction(data.primaryAction.actionKey);
                            onActionSelect?.(data.primaryAction.actionKey);
                        }}
                        style={{
                            backgroundColor: selectedAction === data.primaryAction.actionKey ? '#f59e0b' : '#ffffff',
                            border: '2px solid #000000',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        <FileText size={14} />
                        <span>{data.primaryAction.label}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedAction(data.secondaryAction.actionKey);
                            onActionSelect?.(data.secondaryAction.actionKey);
                        }}
                        style={{
                            backgroundColor: '#ffffff',
                            border: '2px solid #000000',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#000000',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '1.5px 1.5px 0px #000000'
                        }}
                    >
                        <MessageSquare size={14} />
                        <span>{data.secondaryAction.label}</span>
                    </button>
                </div>
            </div>
        );
    }

    return null;
}
