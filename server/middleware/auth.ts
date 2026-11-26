import express from 'express';
import { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_ADMIN_EMAILS = [
  'weerasinghemelaka1@gmail.com',
  'melaka@team.com',
];

function getAdminEmailAllowlist(): Set<string> {
  const envAdmins = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ADMIN_EMAILS, ...envAdmins]);
}

export function createAuthMiddleware(supabase: SupabaseClient) {
  /**
   * Verifies that the request carries a valid Supabase session Bearer token.
   */
  const requireAuth = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!token) {
        return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
      }

      (req as any).user = data.user;
      return next();
    } catch (err: any) {
      console.error('[AUTH MIDDLEWARE] Error verifying token:', err?.message || err);
      return res.status(500).json({ error: 'Authentication verification failed.' });
    }
  };

  /**
   * Verifies that the request carries a valid Supabase session Bearer token
   * AND belongs to an authorized agency administrator.
   */
  const requireAdmin = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

      if (!token) {
        return res.status(401).json({ error: 'Admin authentication required.' });
      }

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ error: 'Invalid or expired authentication token.' });
      }

      const email = (data.user.email || '').toLowerCase();
      const allowlist = getAdminEmailAllowlist();

      if (!allowlist.has(email)) {
        console.warn(`[RBAC] Blocked non-admin access attempt by ${email} to ${req.method} ${req.path}`);
        return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
      }

      (req as any).user = data.user;
      return next();
    } catch (err: any) {
      console.error('[RBAC MIDDLEWARE] Error verifying admin:', err?.message || err);
      return res.status(500).json({ error: 'Admin verification failed.' });
    }
  };

  return { requireAuth, requireAdmin };
}
