'use client';
import React from 'react';
import { getStatusLabel, getStatusBadgeColor, AppointmentStatus } from '@/lib/appointmentStatus';

export function StatusBadge({ status }: { status: AppointmentStatus | string }) {
    return (
        <span className={`badge ${getStatusBadgeColor(status as AppointmentStatus)} rounded-pill px-3 py-2`}>
            {getStatusLabel(status as AppointmentStatus)}
        </span>
    );
}

export function VisitSourceBadge({ source }: { source: 'online' | 'walk_in' | string }) {
    if (source === 'walk_in') {
        return <span className="badge bg-warning text-dark rounded-pill px-2 py-1" style={{ fontSize: '0.7rem' }}>Walk-in</span>;
    }
    return <span className="badge bg-light text-dark border rounded-pill px-2 py-1" style={{ fontSize: '0.7rem' }}>Online</span>;
}

export function PriorityFlag({ isPriority, reason }: { isPriority: boolean; reason?: string }) {
    if (!isPriority) return null;
    return (
        <span className="badge bg-danger rounded-pill px-2 py-1" title={reason || 'Priority'} style={{ fontSize: '0.7rem' }}>
            <i className="bi bi-exclamation-triangle-fill me-1"></i>Priority
        </span>
    );
}
