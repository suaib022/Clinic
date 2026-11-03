-- Migration: 20261013000000_payment_system.sql
-- Description: SSLCommerz payment gateway schema, payments table, indexes and RLS policies

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tran_id TEXT UNIQUE NOT NULL,
    val_id TEXT,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    doctor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'BDT',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'refunded')),
    payment_method TEXT,
    bank_tran_id TEXT,
    card_type TEXT,
    card_brand TEXT,
    card_issuer TEXT,
    card_no TEXT,
    store_amount NUMERIC(10, 2),
    tran_date TIMESTAMPTZ,
    gateway_session_key TEXT,
    gateway_response JSONB,
    error_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_tran_id ON public.payments(tran_id);
CREATE INDEX IF NOT EXISTS idx_payments_appointment_id ON public.payments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON public.payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Ensure payment_status and paid_amount columns exist on appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10, 2) DEFAULT 0.00;

-- RLS policies for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Allow service role full access on payments'
    ) THEN
        CREATE POLICY "Allow service role full access on payments"
            ON public.payments
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Patients can view their own payments'
    ) THEN
        CREATE POLICY "Patients can view their own payments"
            ON public.payments
            FOR SELECT
            TO authenticated
            USING (
                patient_id IN (
                    SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;

