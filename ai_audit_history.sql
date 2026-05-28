-- Create AI Audit History table
CREATE TABLE IF NOT EXISTS public.ai_audit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.ai_audit_history ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anonymous users
DROP POLICY IF EXISTS "Allow all access to ai_audit_history" ON public.ai_audit_history;
CREATE POLICY "Allow all access to ai_audit_history" ON public.ai_audit_history FOR ALL USING (true) WITH CHECK (true);
