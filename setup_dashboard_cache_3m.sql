-- Table to cache 3 Months (MoM 3-month) data separately
CREATE TABLE IF NOT EXISTS public.dashboard_cache_3m (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    current_data JSONB NOT NULL,
    prev_data JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_client_3m UNIQUE (client_id)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.dashboard_cache_3m ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated/anon users (matching existing app patterns)
DROP POLICY IF EXISTS "Allow all access to dashboard_cache_3m" ON public.dashboard_cache_3m;
CREATE POLICY "Allow all access to dashboard_cache_3m" ON public.dashboard_cache_3m FOR ALL USING (true) WITH CHECK (true);
