-- 1. Table to cache monthly data for the Goals & Targets dashboard
CREATE TABLE IF NOT EXISTS public.monthly_data_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    month_start_date DATE NOT NULL,
    gsc_clicks INTEGER DEFAULT 0,
    gsc_impressions INTEGER DEFAULT 0,
    gsc_ctr NUMERIC DEFAULT 0,
    gsc_position NUMERIC DEFAULT 0,
    gsc_top3 INTEGER DEFAULT 0,
    gsc_top10 INTEGER DEFAULT 0,
    ga4_traffic INTEGER DEFAULT 0,
    ga4_new_users INTEGER DEFAULT 0,
    ga4_returning_users INTEGER DEFAULT 0,
    ga4_organic_traffic INTEGER DEFAULT 0,
    phone_calls INTEGER DEFAULT 0,
    leads_total INTEGER DEFAULT 0,
    leads_legit INTEGER DEFAULT 0,
    blogs_published INTEGER DEFAULT 0,
    ahrefs_dr INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_client_month UNIQUE (client_id, month_start_date)
);

ALTER TABLE public.monthly_data_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to monthly_data_cache" ON public.monthly_data_cache;
CREATE POLICY "Allow all access to monthly_data_cache" ON public.monthly_data_cache FOR ALL USING (true) WITH CHECK (true);


-- 2. Table to cache weekly WoW (Week-over-Week) data separately
CREATE TABLE IF NOT EXISTS public.dashboard_cache_weekly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    current_data JSONB NOT NULL,
    prev_data JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_client_weekly UNIQUE (client_id)
);

ALTER TABLE public.dashboard_cache_weekly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to dashboard_cache_weekly" ON public.dashboard_cache_weekly;
CREATE POLICY "Allow all access to dashboard_cache_weekly" ON public.dashboard_cache_weekly FOR ALL USING (true) WITH CHECK (true);


-- 3. Table to cache monthly MoM (Month-over-Month) data separately
CREATE TABLE IF NOT EXISTS public.dashboard_cache_monthly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    current_data JSONB NOT NULL,
    prev_data JSONB NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_client_monthly_cache UNIQUE (client_id)
);

ALTER TABLE public.dashboard_cache_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access to dashboard_cache_monthly" ON public.dashboard_cache_monthly;
CREATE POLICY "Allow all access to dashboard_cache_monthly" ON public.dashboard_cache_monthly FOR ALL USING (true) WITH CHECK (true);
