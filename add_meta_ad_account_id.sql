-- Add meta_ad_account_id column to clients table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='meta_ad_account_id') THEN
    ALTER TABLE public.clients ADD COLUMN meta_ad_account_id TEXT;
  END IF;
END $$;
