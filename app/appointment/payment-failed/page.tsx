import React from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Calendar, ArrowLeft } from 'lucide-react';

export const metadata = {
    title: 'Payment Incomplete | Clinic',
    description: 'Appointment payment status'
};

export default async function PaymentFailedPage({
    searchParams
}: {
    searchParams: Promise<{ appointment_id?: string; tran_id?: string; error?: string }>;
}) {
    const params = await searchParams;
    const appointmentId = params.appointment_id;
    const tranId = params.tran_id;
    const errorMsg = params.error || 'The payment process was not completed.';

    return (
        <main className="min-vh-100 py-5" style={{ backgroundColor: '#f8fafc' }}>
            <div className="container" style={{ maxWidth: '640px' }}>
                <div className="card border-0 shadow-sm rounded-3 overflow-hidden text-center">
                    <div className="p-4 p-md-5 bg-danger bg-opacity-10 text-danger border-bottom border-danger-subtle">
                        <div className="d-inline-flex p-3 rounded-circle bg-white text-danger mb-3 shadow-sm">
                            <AlertCircle size={48} />
                        </div>
                        <h2 className="fw-bold mb-2">Payment Incomplete</h2>
                        <p className="lead mb-0 text-muted fs-6">
                            {errorMsg}
                        </p>
                    </div>

                    <div className="card-body p-4 p-md-5">
                        <div className="alert alert-warning text-start rounded-3 mb-4 small">
                            <p className="fw-semibold mb-1">
                                <i className="bi bi-info-circle me-1"></i>What happens to my appointment?
                            </p>
                            <p className="mb-0 text-secondary">
                                If you booked an appointment, your time slot may still be temporarily reserved as <strong>Unpaid</strong>. 
                                You can retry payment online now, pay later from your patient dashboard, or settle the fee at the clinic counter.
                            </p>
                            {tranId && (
                                <p className="mb-0 mt-2 font-monospace text-muted small">
                                    Reference Trx: {tranId}
                                </p>
                            )}
                        </div>

                        <div className="d-flex flex-column flex-sm-row justify-content-center gap-2">
                            {appointmentId ? (
                                <Link
                                    href={`/patient/appointments`}
                                    className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2 px-4 py-2"
                                    style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }}
                                >
                                    <RefreshCw size={16} />
                                    <span>View & Pay in Appointments</span>
                                </Link>
                            ) : (
                                <Link
                                    href="/appointment"
                                    className="btn btn-primary d-inline-flex align-items-center justify-content-center gap-2 px-4 py-2"
                                    style={{ backgroundColor: '#0D7D72', borderColor: '#0D7D72' }}
                                >
                                    <Calendar size={16} />
                                    <span>Book Appointment Again</span>
                                </Link>
                            )}
                            <Link
                                href="/"
                                className="btn btn-outline-secondary d-inline-flex align-items-center justify-content-center gap-2 px-4 py-2"
                            >
                                <ArrowLeft size={16} />
                                <span>Back to Home</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
