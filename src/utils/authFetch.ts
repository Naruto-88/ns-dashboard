import { supabase } from '../lib/supabase';

/**
 * Drop-in wrapper around window.fetch that automatically attaches the active
 * Supabase session JWT in the Authorization Bearer header for protected API routes.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;

  const headers = new Headers(init.headers || {});
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
