import { createClient } from '@supabase/supabase-js';

const getSafeEnv = (key: string) => {
  const val = (import.meta as any).env?.[key];
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return undefined;
  return trimmed;
};

const supabaseUrl = (getSafeEnv('VITE_SUPABASE_URL') || 'https://pzjfqrvmwlwfrtgojejl.supabase.co')
  .replace(/\/$/, '')
  .replace(/\/rest\/v1$/, '')
  .replace(/\/auth\/v1$/, '');

const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amZxcnZtd2x3ZnJ0Z29qZWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0ODAzNDksImV4cCI6MjA5MzA1NjM0OX0.E0LluX_rAyY5VtzaMrtWPfX4Tm9oSJYRSIgWB-w29rw';

console.log('Supabase initialized with URL:', supabaseUrl);

if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
  console.warn('Supabase URL seems invalid:', supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const auth = supabase.auth;
