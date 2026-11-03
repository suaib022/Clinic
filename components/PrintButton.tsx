'use client';

import React from 'react';
import { Printer } from 'lucide-react';

interface PrintButtonProps {
    className?: string;
    label?: string;
}

export default function PrintButton({
    className = 'btn btn-outline-secondary d-inline-flex align-items-center gap-2 fw-semibold px-4 py-2',
    label = 'Print Confirmation Slip'
}: PrintButtonProps) {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className={className}
        >
            <Printer size={18} />
            <span>{label}</span>
        </button>
    );
}

