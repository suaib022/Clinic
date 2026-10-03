CREATE TABLE public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Internal table: restrict entirely
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies -> default deny all except postgres/service_role
