import React from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import BookingSlip from '@/components/slips/BookingSlip';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import PrintButton from '@/components/PrintButton';

export const metadata = {
    title: 'Appointment Booking Slip | Clinic',
    description: 'Official Hospital Queue Serial Token and Booking Pass'
};

export default async function BookingSlipPage({
    searchParams
}: {
    searchParams: Promise<{ appointment_id?: string }>;
}) {
    const params = await searchParams;
    const appointmentId = params.appointment_id;

    if (!appointmentId) {
        return (
            <div className="container py-5 text-center">
                <h3>Appointment ID is required.</h3>
                <Link href="/" className="btn btn-primary mt-3">Back to Home</Link>
            </div>
        );
    }

    const { data: appointment } = await supabaseAdmin
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

    if (!appointment) {
        return (
            <div className="container py-5 text-center">
                <h3>Appointment not found.</h3>
                <Link href="/" className="btn btn-primary mt-3">Back to Home</Link>
            </div>
        );
    }

    const { data: patient } = await supabaseAdmin
        .from('patients')
        .select('*')
        .eq('id', appointment.patient_id)
        .single();

    const { data: doctor } = await supabaseAdmin
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', appointment.doctor_id)
        .single();

    const { data: specs } = await supabaseAdmin
        .from('doctor_specialities')
        .select('specialities(name)')
        .eq('doctor_id', appointment.doctor_id);

    const specialityName = specs?.map((s: any) => s.specialities?.name).filter(Boolean).join(', ') || 'Medicine Specialist';

    const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('appointment_id', appointment.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    return (
        <div style={{ backgroundColor: '#f1f5f9', minHeight: '100vh', padding: '24px 12px' }}>
            <style>{`
                @media print {
                    body { background: #ffffff !important; margin: 0 !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                    #appointment-booking-slip-sheet { box-shadow: none !important; border: 1px solid #000 !important; }
                    @page { size: auto; margin: 10mm; }
                }
            `}</style>

            {/* Action Bar */}
            <div className="no-print mx-auto mb-4 d-flex justify-content-between align-items-center" style={{ maxWidth: '680px' }}>
                <Link href={`/appointment/confirmation?appointment_id=${appointment.id}`} className="btn btn-outline-secondary d-inline-flex align-items-center gap-1.5">
                    <ArrowLeft size={16} />
                    <span>Back to Confirmation</span>
                </Link>

                <div className="d-flex gap-2">
                    <PrintButton label="Print Booking Slip" />
                </div>
            </div>

            {/* Booking Slip */}
            <BookingSlip
                appointment={appointment}
                patient={patient}
                doctor={doctor}
                specialityName={specialityName}
                payment={payment}
            />
        </div>
    );
}

