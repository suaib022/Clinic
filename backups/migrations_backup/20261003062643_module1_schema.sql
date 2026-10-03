-- Migration: Add appointment lifecycle columns and rules

-- 0. Add helper for compounder
CREATE OR REPLACE FUNCTION public.compounder_doctor_id(c_id uuid) RETURNS uuid AS $$
  SELECT assigned_doctor_id FROM public.compounders WHERE id = c_id LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 1. Drop Old Constraints
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_doctor_id_appointment_date_start_time_key;

-- 2. Add New Columns to Appointments
ALTER TABLE public.appointments
ADD COLUMN serial_no INT,
ADD COLUMN scheduled_start TIMESTAMPTZ,
ADD COLUMN slot_minutes INT,
ADD COLUMN visit_type TEXT DEFAULT 'new' CHECK (visit_type IN ('new', 'follow_up')),
ADD COLUMN is_priority BOOLEAN DEFAULT false,
ADD COLUMN priority_reason TEXT,
ADD COLUMN checked_in_at TIMESTAMPTZ,
ADD COLUMN consult_started_at TIMESTAMPTZ,
ADD COLUMN consult_ended_at TIMESTAMPTZ,
ADD COLUMN cancelled_at TIMESTAMPTZ,
ADD COLUMN cancelled_by_role TEXT,
ADD COLUMN cancel_reason TEXT,
ADD COLUMN no_show_marked_at TIMESTAMPTZ,
ADD COLUMN status_changed_at TIMESTAMPTZ,
ADD COLUMN status_changed_by UUID,
ADD COLUMN visit_source TEXT DEFAULT 'online' CHECK (visit_source IN ('online', 'walk_in'));

-- 3. Migrate Existing Appointments Data
UPDATE public.appointments
SET status = 'completed',
    consult_started_at = created_at,
    consult_ended_at = created_at + interval '15 minutes',
    checked_in_at = created_at
WHERE status = 'hold' AND appointment_date < CURRENT_DATE AT TIME ZONE 'Asia/Dhaka';

UPDATE public.appointments
SET status = 'scheduled'
WHERE status = 'hold' AND appointment_date >= CURRENT_DATE AT TIME ZONE 'Asia/Dhaka';

-- 4. Apply New Status Constraint
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('hold', 'scheduled', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show'));

-- 5. Add Logical Timestamp Checks
ALTER TABLE public.appointments
ADD CONSTRAINT chk_timestamps_order 
CHECK (
  (checked_in_at IS NULL OR consult_started_at IS NULL OR checked_in_at <= consult_started_at) AND
  (consult_started_at IS NULL OR consult_ended_at IS NULL OR consult_started_at <= consult_ended_at)
);

ALTER TABLE public.appointments
ADD CONSTRAINT chk_status_timestamps 
CHECK (
  (status != 'completed' OR (consult_started_at IS NOT NULL AND consult_ended_at IS NOT NULL))
);

-- 6. Create Doctor Sessions Tables
CREATE TABLE public.doctor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paused', 'ended')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- I chose a child table for pauses because it's easier to query and aggregate duration in SQL views later.
CREATE TABLE public.doctor_session_pauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.doctor_sessions(id) ON DELETE CASCADE,
    paused_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resumed_at TIMESTAMPTZ,
    reason TEXT
);

-- 7. Create Queue Events Table
CREATE TABLE public.queue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    actor_user_id UUID,
    actor_role TEXT,
    occurred_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 8. Indexes and Unique Constraints
CREATE INDEX idx_appointments_doctor_date_status ON public.appointments(doctor_id, appointment_date, status);
CREATE INDEX idx_appointments_patient_date ON public.appointments(patient_id, appointment_date);
CREATE INDEX idx_appointments_scheduled_start ON public.appointments(scheduled_start);
CREATE INDEX idx_queue_events_doctor_time ON public.queue_events(doctor_id, occurred_at);

-- Partial Unique Indexes
CREATE UNIQUE INDEX idx_unique_active_slot ON public.appointments(doctor_id, appointment_date, start_time) 
WHERE status NOT IN ('cancelled', 'no_show');

CREATE UNIQUE INDEX idx_one_in_consultation ON public.appointments(doctor_id) 
WHERE status = 'in_consultation';

CREATE UNIQUE INDEX idx_patient_one_appt_per_doc_date ON public.appointments(patient_id, doctor_id, appointment_date) 
WHERE status NOT IN ('cancelled', 'no_show', 'completed');

CREATE UNIQUE INDEX idx_doctor_open_session ON public.doctor_sessions(doctor_id, session_date) 
WHERE status != 'ended';

-- 9. Triggers
-- Deny updates/deletes on queue_events
CREATE OR REPLACE FUNCTION public.prevent_queue_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'queue_events is an append-only audit log. Updates and deletes are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_queue_events_mutation
BEFORE UPDATE OR DELETE ON public.queue_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_queue_events_mutation();

-- Enforce state transitions on appointments
CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;
    
    -- Check valid transitions
    IF OLD.status = 'hold' AND NEW.status NOT IN ('scheduled', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from hold to %', NEW.status;
    ELSIF OLD.status = 'scheduled' AND NEW.status NOT IN ('checked_in', 'cancelled', 'no_show') THEN
        RAISE EXCEPTION 'Invalid transition from scheduled to %', NEW.status;
    ELSIF OLD.status = 'checked_in' AND NEW.status NOT IN ('in_consultation', 'no_show', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid transition from checked_in to %', NEW.status;
    ELSIF OLD.status = 'in_consultation' AND NEW.status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Invalid transition from in_consultation to %', NEW.status;
    ELSIF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Status % is final and cannot be changed.', OLD.status;
    ELSIF OLD.status = 'no_show' AND NEW.status != 'scheduled' THEN
        RAISE EXCEPTION 'no_show can only be reverted to scheduled.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_status_transition
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_status_transition();

-- 10. RLS setup for new tables
ALTER TABLE public.doctor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_session_pauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doctor_sessions view access" ON public.doctor_sessions FOR SELECT TO authenticated
USING (
    doctor_id = auth.uid() 
    OR public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'compounder' AND doctor_id = public.compounder_doctor_id(auth.uid()))
);

CREATE POLICY "doctor_session_pauses view access" ON public.doctor_session_pauses FOR SELECT TO authenticated
USING (
    session_id IN (
        SELECT id FROM public.doctor_sessions WHERE doctor_id = auth.uid() 
        OR public.get_user_role() = 'admin'
        OR (public.get_user_role() = 'compounder' AND doctor_id = public.compounder_doctor_id(auth.uid()))
    )
);

CREATE POLICY "queue_events view access" ON public.queue_events FOR SELECT TO authenticated
USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'doctor' AND doctor_id = auth.uid())
    OR (public.get_user_role() = 'compounder' AND doctor_id = public.compounder_doctor_id(auth.uid()))
);
