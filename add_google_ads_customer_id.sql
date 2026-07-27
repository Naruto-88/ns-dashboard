-- Add google_ads_customer_id column to clients table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='google_ads_customer_id') THEN
    ALTER TABLE public.clients ADD COLUMN google_ads_customer_id TEXT;
  END IF;
END $$;
