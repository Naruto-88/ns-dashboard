/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  LayoutDashboard, 
  Users, 
  Settings, 
  Key, 
  FileText, 
  Calendar,
  LogOut,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertCircle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './views/Dashboard';
import ClientScoreboard from './views/ClientScoreboard';
import KeywordDashboard from './views/KeywordDashboard';
import WeeklyData from './views/WeeklyData';
import ClientManagement from './views/ClientManagement';
import GlobalSettings from './views/GlobalSettings';
import Tooltip from './components/Tooltip';
import { useState, useEffect } from 'react';
import React from 'react';
import { auth, supabase } from './lib/supabase';
import { useTheme } from './contexts/ThemeContext';

function Sidebar({ isCollapsed, onToggle, user }: { isCollapsed: boolean; onToggle: () => void; user: any }) {
  const location = useLocation();
  const { theme } = useTheme();
  
  const navItems = [
    { name: 'Master Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Agency Dashboard', icon: BarChart3, path: '/agency' },
    { name: 'Client Scoreboard', icon: Users, path: '/scoreboard' },
    { name: 'Keyword Tracking', icon: Key, path: '/keywords' },
    { name: 'Weekly Data', icon: Calendar, path: '/weekly' },
  ];

  const adminNavItems = [
    { name: 'Clients', icon: Users, path: '/clients' },
    { name: 'Google Settings', icon: Settings, path: '/settings' },
  ];

  const isAdmin = user?.email === 'weerasinghemelaka1@gmail.com' || user?.email === 'melaka@team.com';

  const visibleItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} ${
      theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5 shadow-[0_0_100px_rgba(37,99,235,0.05)]'
    } border-r h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-30`}>
      <div className="p-6 overflow-hidden">
        <h1 className={`text-xl font-bold flex items-center gap-2 whitespace-nowrap ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
          <TrendingUp className={
            theme === 'mission' ? "text-emerald-500 shrink-0" : 
            theme === 'white' ? "text-zinc-900 shrink-0" :
            "text-blue-500 shrink-0"
          } />
          {!isCollapsed && (
            <span className="tracking-tight uppercase text-sm font-black italic">
              {theme === 'mission' ? 'Mission Control' : theme === 'white' ? 'White Boutique' : 'Midnight Boutique'}
            </span>
          )}
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden pt-4">
        {visibleItems.map((item) => (
          <React.Fragment key={item.path}>
            <Tooltip content={item.name} position="right" className="w-full">
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all duration-200 overflow-hidden whitespace-nowrap ${
                  location.pathname === item.path
                    ? (
                        theme === 'mission' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 
                        theme === 'white' ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' :
                        'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      )
                    : theme === 'white' ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <item.icon size={16} className="shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            </Tooltip>
          </React.Fragment>
        ))}
      </nav>
      <div className={`p-4 border-t ${theme === 'white' ? 'border-zinc-200' : 'border-white/5'} space-y-1`}>
        <button 
          onClick={onToggle}
          className={`flex items-center gap-3 px-3 py-2 w-full text-xs font-bold ${
            theme === 'white' ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
          } rounded-lg transition-all overflow-hidden whitespace-nowrap uppercase tracking-wider`}
        >
          <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
             <ChevronRight size={16} className="shrink-0" />
          </div>
          {!isCollapsed && <span>Collapse</span>}
        </button>
        <button 
          onClick={() => auth.signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full text-xs font-bold text-red-500/80 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all overflow-hidden whitespace-nowrap uppercase tracking-wider"
        >
          <LogOut size={16} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme } = useTheme();

  return (
    <div className={`flex min-h-screen ${
      theme === 'mission' ? 'bg-[#050507]' : 
      theme === 'white' ? 'bg-[#f8f9fa]' :
      'bg-black'
    } ${theme === 'white' ? 'text-slate-900' : 'text-white'}`}>
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} user={user} />
      <main className="flex-1 p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={useLocation().pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Login() {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'google' | 'email'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [supabaseReady, setSupabaseReady] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .then(({ error: readyError }) => {
        if (readyError) console.error('Connection check error:', readyError);
        setSupabaseReady(!readyError || readyError.code === 'PGRST301');
      });
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: loginError } = await auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (loginError) throw loginError;
    } catch (e: any) {
      console.error('Google login error:', e);
      let msg = e.message || 'Login failed';
      if (msg.includes('provider is not enabled')) {
        msg = 'Google Auth is not enabled in your Supabase Dashboard. Go to Auth -> Providers -> Google and enable it.';
      } else if (msg.includes('redirect_uri_mismatch')) {
        msg = 'Redirect URI mismatch. Ensure your Supabase Callback URL is added to the Google Cloud Console.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const team = ['Melaka', 'Amit', 'Sai', 'Vinoj', 'Sash', 'Lidusha'];
      let targetEmail = email.trim().toLowerCase();
      
      // If user provided just a name from the team, convert to team email
      if (team.some(n => n.toLowerCase() === targetEmail)) {
        targetEmail = `${targetEmail}@team.com`;
      }
      // If it doesn't look like an email, assume it's a name and try team email
      else if (!targetEmail.includes('@')) {
        targetEmail = `${targetEmail}@team.com`;
      }
      
      console.log('Attempting login for:', targetEmail);
      
      const { error: loginError } = await auth.signInWithPassword({
        email: targetEmail,
        password: password
      });
      if (loginError) throw loginError;
    } catch (e: any) {
      console.error('Login error detail:', e);
      let msg = e.message || 'Invalid credentials.';
      
      if (msg.includes('Invalid path')) {
        msg = 'Connection Error: Invalid path in database URL. Please check VITE_SUPABASE_URL in settings.';
      } else if (msg.includes('Invalid login credentials')) {
        msg = `Invalid credentials for ${email.trim()}. Hint: Use your name and MelakaWee@123#`;
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      theme === 'mission' ? 'bg-[#050507]' : 
      theme === 'white' ? 'bg-[#f0f2f5]' :
      'bg-black'
    } px-4 font-sans`}>
      <div className={`${
        theme === 'mission' ? 'bg-zinc-900 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 
        theme === 'white' ? 'bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] text-slate-900 border-zinc-200' :
        'bg-zinc-950 shadow-2xl'
      } p-10 rounded-[32px] border border-white/5 max-w-md w-full space-y-10 animate-in fade-in zoom-in duration-500`}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${
              supabaseReady === null ? (theme === 'white' ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-zinc-800 text-zinc-500 border-white/10') :
              supabaseReady ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {supabaseReady === null ? 'SYNC_PENDING' : supabaseReady ? 'SYNC_ACTIVE' : 'SYNC_OFFLINE'}
            </div>
          </div>
          <div className={`w-20 h-20 ${
            theme === 'mission' ? 'bg-emerald-600 shadow-emerald-600/20' : 
            theme === 'white' ? 'bg-zinc-900 shadow-zinc-900/20' :
            'bg-blue-600 shadow-blue-600/20'
          } text-white rounded-[28px] flex items-center justify-center mx-auto shadow-2xl animate-pulse transform hover:scale-110 transition-transform duration-300`}>
            <TrendingUp size={40} />
          </div>
          <div className="space-y-2">
            <h1 className={`text-4xl font-black ${theme === 'white' ? 'text-zinc-900' : 'text-white'} tracking-tighter uppercase italic italic`}>SEO_HUB</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Operational Intelligence</p>
          </div>
        </div>
        
        {error && (
          <div className={`p-5 bg-red-500/10 border border-red-500/20 text-red-500 text-[11px] font-black rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 uppercase tracking-tighter`}>
            <AlertCircle size={20} className="flex-shrink-0" />
            <div className="flex-1">
              <div>{error}</div>
            </div>
          </div>
        )}

        {mode === 'google' ? (
          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-4 px-6 py-4 border rounded-2xl font-black text-xs transition-all shadow-xl active:scale-95 disabled:opacity-50 uppercase tracking-widest ${
                theme === 'white' ? 'bg-zinc-100 text-zinc-900 border-zinc-200 hover:bg-zinc-200' : 'bg-zinc-900 border-white/5 text-white hover:bg-zinc-800'
              }`}
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 grayscale group-hover:grayscale-0" alt="Google" />
              {loading ? 'Initializing...' : 'Decrypt via Google'}
            </button>
            <p className="text-[10px] text-zinc-600 text-center px-6 leading-relaxed uppercase font-bold tracking-widest">
              Centralized Auth Gateway. If unconfigured, utilize <span className="text-zinc-400">Team Vector</span>.
            </p>
            <button 
              onClick={() => setMode('email')}
              className={`w-full py-2 text-[10px] font-black transition-colors uppercase tracking-[0.2em] ${
                theme === 'white' ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'
              }`}
            >
              / Switch to Team Credentials
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-1">Vector Identity</label>
              <div className="relative group">
                <input 
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ID: AMIT, SAI, MELAKA..."
                  className={`w-full px-6 py-4 border rounded-2xl font-black text-xs outline-none focus:border-blue-500 transition-all pl-14 uppercase tracking-widest ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`}
                />
                <Users className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                  theme === 'white' ? 'text-zinc-300 group-focus-within:text-blue-500' : 'text-zinc-700 group-focus-within:text-blue-500'
                }`} size={22} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em] pl-1">Access Phrase</label>
              <div className="relative group">
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-6 py-4 border rounded-2xl font-black text-xs outline-none focus:border-blue-500 transition-all pl-14 tracking-widest ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`}
                />
                <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                  theme === 'white' ? 'text-zinc-300 group-focus-within:text-blue-500' : 'text-zinc-700 group-focus-within:text-blue-500'
                }`} size={22} />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 ${theme === 'mission' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-blue-600 shadow-blue-500/30'} text-white rounded-2xl font-black text-xs shadow-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-[0.2em]`}
            >
              {loading ? 'Authenticating...' : 'Engage Dashboard'}
              {!loading && <ChevronRight size={20} />}
            </button>
            <button 
              type="button"
              onClick={() => setMode('google')}
              className={`w-full py-2 text-[10px] font-black transition-colors uppercase tracking-[0.2em] ${
                theme === 'white' ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'
              }`}
            >
              / Return to Global Auth
            </button>
          </form>
        )}

        <div className={`pt-8 border-t space-y-6 ${theme === 'white' ? 'border-zinc-100' : 'border-white/5'}`}>
          <div className="flex flex-wrap justify-center gap-3">
            {['Melaka', 'Amit', 'Sai', 'Vinoj', 'Sash', 'Lidusha'].map(name => (
              <span key={name} className={`text-[9px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                theme === 'white' ? 'bg-zinc-50 text-zinc-500 border-zinc-200' : 'bg-zinc-900 text-zinc-500 border-white/5'
              }`}>{name}</span>
            ))}
          </div>
          <div className="text-center space-y-4">
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
              Access Code: <span className={theme === 'mission' ? "text-emerald-500 font-mono" : "text-blue-500 font-mono"}>MelakaWee@123#</span>
            </p>
            
            <div className="space-y-2">
              <button 
                type="button"
                onClick={async () => {
                    setError('Connecting to Sync Service...');
                    try {
                      // Check health first to clarify 'Failed to fetch'
                      const healthRes = await fetch('/api/health').catch(() => null);
                      if (!healthRes) {
                        throw new Error('Backend server is not responding. Please wait 10s and try again.');
                      }

                      const res = await fetch('/api/admin/seed', { 
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                      });
                      
                      const text = await res.text();
                      let data;
                      try { data = JSON.parse(text); } catch { throw new Error('Server returned invalid response'); }
                      
                      if (!res.ok || data.error) {
                        console.error('Seed error data:', data.error);
                        const msg = typeof data?.error === 'string' ? data.error : (data?.error?.message || JSON.stringify(data?.error || 'Unknown Error'));
                        setError('Sync Failed: ' + msg);
                      } else {
                      // Construct a summary message from the results arrays
                      const clientSummary = data.clients.filter((c: string) => !c.includes('exists')).length;
                      const userSummary = data.users.filter((u: string) => !u.includes('exist')).length;
                      
                      setError(`✓ Sync Complete! Clients: ${data.clients.length}, Users: ${data.users.length}`);
                      
                      const detail = `Results:\n\nClients:\n${data.clients.join('\n')}\n\nUsers:\n${data.users.join('\n')}`;
                      console.log('Sync Detail:', detail);
                      
                      if (clientSummary > 0 || userSummary > 0) {
                        alert(`Sync Success!\n\nAdded/Updated ${clientSummary} clients and ${userSummary} users.\n\nYou can now log in with the password provided.`);
                      }
                    }
                  } catch (e: any) {
                    console.error('Full catch error:', e);
                    const msg = e.message === 'Failed to fetch' 
                      ? 'Server Connection Lost. Please wait 10 seconds for the server to restart and try again.'
                      : (e.message || 'Check browser console');
                    setError('Connection error: ' + msg);
                  }
                }}
                className="w-full py-3 bg-slate-50 text-[11px] font-black text-slate-600 rounded-xl border-2 border-slate-200 hover:border-blue-200 hover:bg-white hover:text-blue-600 transition-all flex items-center justify-center gap-2"
              >
                <Settings size={16} />
                INITIALIZE / SYNC TEAM DATABASE
              </button>
              <p className="text-[9px] text-slate-400 text-center leading-relaxed italic">
                First time? Click above to create accounts for Amit, Sai, Melaka, etc.
              </p>
            </div>

            <div className="pt-2">
              <button 
                type="button"
                onClick={() => {
                  const sql = `
-- RUN THIS IN SUPABASE SQL EDITOR --

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SCHEMA FIXES (Run this to fix missing columns)
DO $$ 
BEGIN 
  -- Fix Clients table columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='ga4_property_id') THEN
    ALTER TABLE public.clients ADD COLUMN ga4_property_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='gsc_site_url') THEN
    ALTER TABLE public.clients ADD COLUMN gsc_site_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='api_import_enabled') THEN
    ALTER TABLE public.clients ADD COLUMN api_import_enabled BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='notes') THEN
    ALTER TABLE public.clients ADD COLUMN notes TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='timezone') THEN
    ALTER TABLE public.clients ADD COLUMN timezone TEXT DEFAULT 'Australia/Sydney';
  END IF;
  
  -- NEW FIELDS FOR TARGETS & OWNERS
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lead_target_monthly') THEN
    ALTER TABLE public.clients ADD COLUMN lead_target_monthly INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='avg_position_target') THEN
    ALTER TABLE public.clients ADD COLUMN avg_position_target NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='technical_score_target') THEN
    ALTER TABLE public.clients ADD COLUMN technical_score_target INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='project_owner_name') THEN
    ALTER TABLE public.clients ADD COLUMN project_owner_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='project_owner_code') THEN
    ALTER TABLE public.clients ADD COLUMN project_owner_code TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='top_10_target') THEN
    ALTER TABLE public.clients ADD COLUMN top_10_target INTEGER DEFAULT 0;
  END IF;

  -- Fix Weekly Data
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='week_start_date') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='week_start') THEN
      ALTER TABLE public.weekly_data RENAME COLUMN week_start TO week_start_date;
    ELSE
      ALTER TABLE public.weekly_data ADD COLUMN week_start_date DATE;
    END IF;
  END IF;
  -- NEW FIELDS FOR WEEKLY DATA
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='primary_issue_type') THEN
    ALTER TABLE public.weekly_data ADD COLUMN primary_issue_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='primary_insight') THEN
    ALTER TABLE public.weekly_data ADD COLUMN primary_insight TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='next_seo_action') THEN
    ALTER TABLE public.weekly_data ADD COLUMN next_seo_action TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='weekly_activity_summary') THEN
    ALTER TABLE public.weekly_data ADD COLUMN weekly_activity_summary TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='technical_score') THEN
    ALTER TABLE public.weekly_data ADD COLUMN technical_score INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='top_3_count') THEN
    ALTER TABLE public.weekly_data ADD COLUMN top_3_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='top_10_count') THEN
    ALTER TABLE public.weekly_data ADD COLUMN top_10_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='tracked_keywords_avg_position') THEN
    ALTER TABLE public.weekly_data ADD COLUMN tracked_keywords_avg_position NUMERIC DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='backlinks_built') THEN
    ALTER TABLE public.weekly_data ADD COLUMN backlinks_built INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='target_leads') THEN
    ALTER TABLE public.weekly_data ADD COLUMN target_leads INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='leads_total') THEN
    ALTER TABLE public.weekly_data ADD COLUMN leads_total INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='leads_legit') THEN
    ALTER TABLE public.weekly_data ADD COLUMN leads_legit INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='pages_optimized') THEN
    ALTER TABLE public.weekly_data ADD COLUMN pages_optimized INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='blogs_published') THEN
    ALTER TABLE public.weekly_data ADD COLUMN blogs_published INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='tech_fixes') THEN
    ALTER TABLE public.weekly_data ADD COLUMN tech_fixes INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='schema_updates') THEN
    ALTER TABLE public.weekly_data ADD COLUMN schema_updates INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='internal_links') THEN
    ALTER TABLE public.weekly_data ADD COLUMN internal_links INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ga4_new_users') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ga4_new_users INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ga4_returning_users') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ga4_returning_users INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ga4_traffic') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ga4_traffic INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='gsc_clicks') THEN
    ALTER TABLE public.weekly_data ADD COLUMN gsc_clicks INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='gsc_impressions') THEN
    ALTER TABLE public.weekly_data ADD COLUMN gsc_impressions INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='gsc_position') THEN
    ALTER TABLE public.weekly_data ADD COLUMN gsc_position NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='gsc_ctr') THEN
    ALTER TABLE public.weekly_data ADD COLUMN gsc_ctr NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 3. TABLES
-- Clients
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  short_code TEXT UNIQUE,
  ga4_property_id TEXT,
  gsc_site_url TEXT,
  lead_event_names TEXT DEFAULT 'generate_lead',
  keyword_tracking_enabled BOOLEAN DEFAULT true,
  api_import_enabled BOOLEAN DEFAULT true,
  notes TEXT,
  timezone TEXT DEFAULT 'Australia/Sydney',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Weekly Data
CREATE TABLE IF NOT EXISTS public.weekly_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  ga4_traffic INTEGER DEFAULT 0,
  ga4_new_users INTEGER DEFAULT 0,
  ga4_returning_users INTEGER DEFAULT 0,
  gsc_clicks INTEGER DEFAULT 0,
  gsc_impressions INTEGER DEFAULT 0,
  gsc_ctr NUMERIC DEFAULT 0,
  gsc_position NUMERIC DEFAULT 0,
  leads_total INTEGER DEFAULT 0,
  leads_legit INTEGER DEFAULT 0,
  target_leads INTEGER DEFAULT 0,
  top_3_count INTEGER DEFAULT 0,
  top_10_count INTEGER DEFAULT 0,
  tracked_keywords_avg_position NUMERIC DEFAULT 0,
  technical_score INTEGER DEFAULT 0,
  primary_issue_type TEXT,
  primary_insight TEXT,
  next_seo_action TEXT,
  weekly_activity_summary TEXT,
  pages_optimized INTEGER DEFAULT 0,
  blogs_published INTEGER DEFAULT 0,
  backlinks_built INTEGER DEFAULT 0,
  tech_fixes INTEGER DEFAULT 0,
  schema_updates INTEGER DEFAULT 0,
  internal_links INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, week_start_date)
);

-- Keywords
CREATE TABLE IF NOT EXISTS public.keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  landing_page_url TEXT,
  priority TEXT DEFAULT 'Medium',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Keyword History
CREATE TABLE IF NOT EXISTS public.keyword_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword_id UUID REFERENCES public.keywords(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr NUMERIC,
  position NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Google Tokens
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id TEXT PRIMARY KEY,
  email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date BIGINT,
  last_connected TIMESTAMPTZ
);

-- Import Logs
CREATE TABLE IF NOT EXISTS public.import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  imported_at TIMESTAMPTZ DEFAULT now(),
  operation_type TEXT,
  status TEXT,
  message TEXT
);

-- 4. PERMISSIONS (Allow ALL for internal tool)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_access" ON public.clients;
CREATE POLICY "public_access" ON public.clients FOR ALL USING (true);

DROP POLICY IF EXISTS "public_access" ON public.weekly_data;
CREATE POLICY "public_access" ON public.weekly_data FOR ALL USING (true);

DROP POLICY IF EXISTS "public_access" ON public.keywords;
CREATE POLICY "public_access" ON public.keywords FOR ALL USING (true);

DROP POLICY IF EXISTS "public_access" ON public.keyword_history;
CREATE POLICY "public_access" ON public.keyword_history FOR ALL USING (true);

DROP POLICY IF EXISTS "public_access" ON public.google_tokens;
CREATE POLICY "public_access" ON public.google_tokens FOR ALL USING (true);

DROP POLICY IF EXISTS "public_access" ON public.import_logs;
CREATE POLICY "public_access" ON public.import_logs FOR ALL USING (true);

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- 6. GOOGLE AUTH SETUP
-- Go to Supabase Dashboard -> Authentication -> Providers -> Google
-- Enable Google, enter Client ID and Secret from .env
-- Copy the 'Callback URL' from Supabase and paste it into Google Cloud Console -> APIs -> Credentials -> OAuth 2.0 Client IDs -> Redirect URIs
                  `;
                  navigator.clipboard.writeText(sql);
                  alert('SQL Code copied to clipboard! Paste it in the Supabase Dashboard -> SQL Editor and click RUN.');
                }}
                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 underline mx-auto block"
              >
                Show SQL setup code (Manual)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import MasterDashboard from './views/MasterDashboard';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Login />;

  const isAdmin = user.email === 'weerasinghemelaka1@gmail.com' || user.email === 'melaka@team.com';

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<MasterDashboard />} />
          <Route path="/agency" element={<Dashboard />} />
          <Route path="/scoreboard" element={<ClientScoreboard />} />
          <Route path="/keywords" element={<KeywordDashboard />} />
          <Route path="/weekly" element={<WeeklyData />} />
          {isAdmin && (
            <>
              <Route path="/clients" element={<ClientManagement />} />
              <Route path="/settings" element={<GlobalSettings />} />
            </>
          )}
          {/* Support for back-compatibility or alternative access */}
          {!isAdmin && <Route path="/clients" element={<MasterDashboard />} />}
          {!isAdmin && <Route path="/settings" element={<MasterDashboard />} />}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
