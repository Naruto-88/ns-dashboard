-- Create weekly_ads_growth table
CREATE TABLE IF NOT EXISTS public.weekly_ads_growth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    
    -- Google Ads
    google_ads_spend NUMERIC DEFAULT 0,
    google_ads_roas NUMERIC DEFAULT 0,
    google_ads_ctr NUMERIC DEFAULT 0,
    google_ads_quality_score NUMERIC DEFAULT 0,
    
    -- Meta Ads
    meta_spend NUMERIC DEFAULT 0,
    meta_reach INTEGER DEFAULT 0,
    meta_leads INTEGER DEFAULT 0,
    meta_roas NUMERIC DEFAULT 0,
    meta_ctr NUMERIC DEFAULT 0,
    meta_frequency NUMERIC DEFAULT 0,
    
    -- Web & Social Analytics
    website_sessions INTEGER DEFAULT 0,
    bounce_rate NUMERIC DEFAULT 0,
    avg_time_on_site TEXT DEFAULT '',
    top_converting_page TEXT DEFAULT '',
    active_ab_tests INTEGER DEFAULT 0,
    landing_pages_live INTEGER DEFAULT 0,
    followers_total INTEGER DEFAULT 0,
    social_impressions INTEGER DEFAULT 0,
    engagement_rate NUMERIC DEFAULT 0,
    social_posts_published INTEGER DEFAULT 0,
    organic_social_reach INTEGER DEFAULT 0,
    top_platform TEXT DEFAULT '',
    
    -- Agency Deliverables
    blogs_written INTEGER DEFAULT 0,
    avg_blog_quality NUMERIC DEFAULT 0,
    backlinks_created INTEGER DEFAULT 0,
    social_posts_content_total INTEGER DEFAULT 0,
    creatives_produced INTEGER DEFAULT 0,
    emails_automation INTEGER DEFAULT 0,
    seo_organic_leads INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_client_week_ads UNIQUE (client_id, week_start_date)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.weekly_ads_growth ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (matching existing internal dashboard patterns)
DROP POLICY IF EXISTS "Allow all access to weekly_ads_growth" ON public.weekly_ads_growth;
CREATE POLICY "Allow all access to weekly_ads_growth" ON public.weekly_ads_growth FOR ALL USING (true) WITH CHECK (true);

-- Alter clients table to support Paid Ads active toggle
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS has_paid_ads BOOLEAN DEFAULT false;
