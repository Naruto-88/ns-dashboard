-- Table for Next Actions (Task Management)
CREATE TABLE IF NOT EXISTS public.client_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    deadline DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.client_actions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated/anon users (matching existing app patterns)
DROP POLICY IF EXISTS "Allow all access to client_actions" ON public.client_actions;
CREATE POLICY "Allow all access to client_actions" ON public.client_actions FOR ALL USING (true) WITH CHECK (true);
