CREATE OR REPLACE FUNCTION public.enforce_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    v_role text;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow admins to bypass transition rules
    -- We can check if the current user is an admin by checking their role in the auth token
    -- or querying public.users.
    SELECT (auth.jwt() ->> 'role')::text INTO v_role;
    
    -- If the JWT role is not available, try to get from public.users using auth.uid()
    IF v_role IS NULL OR v_role = 'authenticated' THEN
        SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
    END IF;

    IF v_role = 'admin' THEN
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
