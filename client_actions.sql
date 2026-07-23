CREATE TABLE IF NOT EXISTS public.client_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    deadline DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.client_actions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (since it's an internal dashboard)
CREATE POLICY "Allow all operations for client_actions" 
ON public.client_actions FOR ALL USING (true) WITH CHECK (true);
