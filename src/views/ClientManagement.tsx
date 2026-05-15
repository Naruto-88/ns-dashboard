import { useState, useEffect } from 'react';
import React from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Play,
  Settings as SettingsIcon,
  Trash2,
  Table as TableIcon,
  Key as KeyIcon,
  RefreshCw,
  Shield,
  Activity,
  AlertCircle,
  Zap,
  Sparkles
} from 'lucide-react';
import { auth, supabase } from '../lib/supabase';
import { getClients, addClient, updateClient, deleteClient, addKeyword, Client } from '../services/dataService';
import { useTheme } from '../contexts/ThemeContext';

export default function ClientManagement() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState<'add' | 'edit' | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showKeywordsModal, setShowKeywordsModal] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);

  const initialFormState = {
    name: '',
    short_code: '',
    ga4_property_id: '',
    gsc_site_url: '',
    lead_event_names: 'generate_lead, form_submission',
    keyword_tracking_enabled: true,
    api_import_enabled: true,
    notes: '',
    timezone: 'Australia/Sydney',
    initial_keywords: '',
    lead_target_monthly: 0,
    avg_position_target: 0,
    technical_score_target: 90,
    project_owner_name: 'Melaka',
    project_owner_code: 'MW',
    top_10_target: 0
  };

  const owners = [
    { name: 'Melaka', code: 'MW' },
    { name: 'Amit', code: 'AS' },
    { name: 'Sai', code: 'SR' },
    { name: 'Vinoj', code: 'VK' },
    { name: 'Sash', code: 'SP' },
    { name: 'Lidusha', code: 'LB' }
  ];

  const [formData, setFormData] = useState(initialFormState);
  const [authorizedSites, setAuthorizedSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const [debugLog, setDebugLog] = useState<string[]>([]);
  const logDebug = (msg: string) => {
    console.log('CLIENT_DEBUG:', msg);
    setDebugLog(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev].slice(0, 10));
  };

  const fetchData = () => {
    logDebug('Fetching clients...');
    setLoading(true);
    getClients().then(data => {
      logDebug(`Fetched ${data.length} clients`);
      setClients(data);
      setLoading(false);
    }).catch(err => {
      logDebug('Fetch Error: ' + err.message);
      setLoading(false);
    });
  };

  const fetchAuthorizedSites = async () => {
    setLoadingSites(true);
    try {
      const res = await fetch('/api/auth/google/list-sites');
      const data = await res.json();
      if (data.sites) {
        // Correctly map the site objects to their URLs to avoid React "Objects are not valid as children" error
        const siteUrls = data.sites.map((s: any) => s.siteUrl).filter(Boolean);
        setAuthorizedSites(siteUrls);
      }
    } catch (e) {
      console.error('Failed to fetch authorized sites:', e);
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAuthorizedSites();
  }, []);

  const handleSyncWeekly = async (clientId: string) => {
    const today = new Date();
    // Monday of current week
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff)).toISOString().split('T')[0];
    
    setTestingId(clientId); // Reuse testingId for spinner
    try {
      const res = await fetch(`/api/clients/${clientId}/sync-weekly-data?weekStart=${monday}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      alert(`Successfully synced data for week of ${monday}`);
    } catch (e: any) {
      alert(`Sync Failed: ${e.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleFixGscUrl = async (clientId: string, suggestedUrl: string) => {
    setFixingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/fix-gsc-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: suggestedUrl })
      });
      if (res.ok) {
        alert('GSC URL updated successfully! Re-testing access...');
        fetchData();
        handleTestAccess(clientId);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update URL');
      }
    } catch (e: any) {
      alert('Fix failed: ' + e.message);
    } finally {
      setFixingId(null);
    }
  };

  const repairsAvailable = Object.values(testResults).some((res: any) => 
    res.errors?.some((err: string) => err.includes('[FIX_SUGGESTION:'))
  );

  const handleScanAllAccess = async () => {
    setRepairing(true);
    logDebug('Starting full system access scan...');
    for (const client of clients) {
      await handleTestAccess(client.id);
    }
    logDebug('Full scan complete.');
    setRepairing(false);
  };

  const handleBulkRepairGsc = async () => {
    if (!window.confirm('This will scan all clients and try to automatically fix their GSC URLs to match your authorized properties. Proceed?')) return;
    
    setRepairing(true);
    try {
      const res = await fetch('/api/admin/bulk-repair-gsc', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Bulk repair complete!\n\nRepaired ${data.repairs_count} client URLs.`);
        fetchData();
      } else {
        throw new Error(data.error || 'Bulk repair failed');
      }
    } catch (e: any) {
      alert('Repair failed: ' + e.message);
    } finally {
      setRepairing(false);
    }
  };

  const renderErrorWithFix = (clientId: string, error: string) => {
    const fixMatch = error.match(/\[FIX_SUGGESTION:(.*?)\]/);
    const cleanError = error.replace(/\[FIX_SUGGESTION:.*?\]/, '').trim();
    
    return cleanError ? (
      <div className={`p-3 rounded-2xl mt-1 border leading-relaxed break-words whitespace-normal max-w-[300px] shadow-sm animate-in fade-in slide-in-from-top-1 ${
        isWhite ? 'bg-rose-50 border-rose-100 text-rose-600' : 'bg-red-500/10 border-red-500/20 text-red-300'
      }`}>
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={10} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-black italic tracking-tight">
              {cleanError}
            </p>
          </div>
          {fixMatch && (
            <button
              onClick={() => handleFixGscUrl(clientId, fixMatch[1])}
              disabled={fixingId === clientId}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                isWhite 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/10' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
              }`}
            >
              {fixingId === clientId ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
              Auto-fix Property URL
            </button>
          )}
        </div>
      </div>
    ) : null;
  };


  const handleCopySql = () => {
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lead_event_names') THEN
    ALTER TABLE public.clients ADD COLUMN lead_event_names TEXT DEFAULT 'generate_lead, form_submission';
  END IF;
  
  -- Targets & Owners
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

  -- Fix Weekly Data table columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='week_start_date') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='week_start') THEN
      ALTER TABLE public.weekly_data RENAME COLUMN week_start TO week_start_date;
    ELSE
      ALTER TABLE public.weekly_data ADD COLUMN week_start_date DATE;
    END IF;
  END IF;

  -- New fields for Weekly Data
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
  lead_event_names TEXT DEFAULT 'generate_lead, form_submission',
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
    `;
    navigator.clipboard.writeText(sql);
    alert('Database Setup SQL copied to clipboard!\n\nPaste this in Supabase -> SQL Editor and click RUN to ensure all columns exist.');
  };

  const handleBootstrap = async () => {
    logDebug('Bootstrap button clicked');
    if (!window.confirm('This will add 15 default clients and create team accounts. Continue?')) {
      logDebug('Bootstrap cancelled by user');
      return;
    }
    try {
      logDebug('Starting bootstrap request...');
      setLoading(true);
      const res = await fetch('/api/admin/seed', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      logDebug(`Seed response status: ${res.status}`);
      const results = await res.json();
      logDebug('Seed results received');

      if (!res.ok) {
        throw new Error(results.error || `Server error: ${res.status}`);
      }
      
      alert(`Seeding complete!\n\n- Clients: ${results.clients?.length || 0} processed\n- Users: ${results.users?.length || 0} processed`);
      fetchData();
    } catch (e: any) {
      logDebug('Bootstrap Exception: ' + e.message);
      alert(`Bootstrap Failed!\n\nError: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkDbConnection = async () => {
    logDebug('Checking DB connection...');
    try {
      const { data: { user } } = await auth.getUser();
      if (!user) {
        logDebug('Error: No current user');
        throw new Error('You must be signed in to perform this test. Please log in first.');
      }
      logDebug(`Authenticated as: ${user.email}`);
      const { data, error } = await supabase.from('clients').select('*');
      if (error) throw error;
      logDebug(`DB Success: Found ${data.length} docs`);
      alert(`Database Success!\n\n- Current Client Count: ${data.length}\n- Connection: Active and Authorized as ${user.email}`);
    } catch (e: any) {
      logDebug('DB Error: ' + e.message);
      alert(`Database Connection Failed!\n\nError: ${e.message}`);
    }
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let clientId = '';
      const { initial_keywords, ...submitData } = formData as any;

      if (showModal === 'edit' && editingClient) {
        await updateClient(editingClient.id, submitData);
        clientId = editingClient.id;
      } else {
        clientId = await addClient({
          ...submitData,
          created_at: new Date().toISOString()
        });
      }

      // Handle initial keywords if provided
      if (initial_keywords && initial_keywords.trim()) {
        const keywords = initial_keywords.split('\n').filter((k: string) => k.trim());
        for (const k of keywords) {
          const [query, url] = k.split(',').map((s: string) => s.trim());
          await addKeyword(clientId, {
            query,
            landing_page_url: url || '',
            priority: 'Medium',
            created_at: new Date().toISOString()
          });
        }
      }

      setShowModal(null);
      setFormData(initialFormState);
      setEditingClient(null);
      fetchData();
      alert('Client saved successfully!');
    } catch (error: any) {
      console.error('Save Error:', error);
      alert('Failed to save client: ' + (error.message || JSON.stringify(error)));
    }
  };

  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name || '',
      short_code: client.short_code || '',
      ga4_property_id: client.ga4_property_id || '',
      gsc_site_url: client.gsc_site_url || '',
      lead_event_names: client.lead_event_names || '',
      keyword_tracking_enabled: client.keyword_tracking_enabled ?? true,
      api_import_enabled: client.api_import_enabled ?? true,
      notes: client.notes || '',
      timezone: client.timezone || 'Australia/Sydney',
      lead_target_monthly: client.lead_target_monthly || 0,
      avg_position_target: client.avg_position_target || 0,
      technical_score_target: client.technical_score_target || 90,
      project_owner_name: client.project_owner_name || 'Melaka',
      project_owner_code: client.project_owner_code || 'MW',
      top_10_target: client.top_10_target || 0,
      initial_keywords: ''
    } as any);
    setShowModal('edit');
  };

  const handleTestAccess = async (clientId: string) => {
    setTestingId(clientId);
    try {
      const res = await fetch(`/api/clients/${clientId}/test-access`, { method: 'POST' });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [clientId]: data }));
    } catch (error) {
      console.error(error);
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      await deleteClient(id);
      fetchData();
    }
  };

  const filteredClients = clients.filter(client => {
    const name = client.name || '';
    const code = client.short_code || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           code.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="space-y-8 pb-12">
      {debugLog.length > 0 && (
        <div className={`p-4 rounded-2xl font-mono text-[10px] border shadow-2xl ${
          theme === 'white' ? 'bg-zinc-50 text-zinc-600 border-zinc-200' : 'bg-zinc-950 text-zinc-500 border-white/5'
        }`}>
          <p className={`${theme === 'white' ? 'text-zinc-400' : 'text-zinc-700'} mb-2 uppercase font-black tracking-widest text-[9px]`}>Terminal Output</p>
          <div className="space-y-1">
            {debugLog.map((log, i) => (
              <div key={i} className="flex gap-3">
                <span className="text-blue-500 shrink-0">{i === 0 ? '▶' : ' '}</span>
                <span>{log}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className={`text-2xl font-black uppercase tracking-tighter italic ${isWhite ? 'text-zinc-900' : 'text-white'}`}>Client Management</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1 italic">Configure security and tracking nodes</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text" 
              placeholder="Search nodes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 pr-6 py-2.5 border rounded-2xl text-xs font-black focus:outline-none focus:border-blue-500 transition-all w-64 uppercase tracking-widest ${
                theme === 'white' ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
              }`}
            />
          </div>
          <button 
            onClick={checkDbConnection}
            className={`px-5 py-2.5 border rounded-2xl font-black text-[9px] uppercase tracking-widest hover:brightness-110 transition-all ${
              theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-white/5 text-zinc-400'
            }`}
          >
            Pings DB
          </button>
            <button 
              onClick={handleCopySql}
              className="px-5 py-2.5 bg-amber-500/10 text-amber-500 rounded-2xl font-black text-[9px] hover:bg-amber-500/20 transition-all border border-amber-500/20 flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-amber-500/5"
              title="Fix database columns if you see schema errors"
            >
              <Shield size={14} />
              Repair SQL
            </button>
            <button 
              onClick={handleBootstrap}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] hover:bg-zinc-700 transition-all uppercase tracking-widest border ${
                theme === 'white' ? 'bg-zinc-100 text-zinc-900 border-zinc-200' : 'bg-zinc-800 text-white border-white/5'
              }`}
            >
              Seed Accounts
            </button>
            <button 
              onClick={handleScanAllAccess}
              disabled={repairing}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] hover:brightness-110 transition-all border flex items-center gap-2 uppercase tracking-widest shadow-lg disabled:opacity-50 ${
                theme === 'white' ? 'bg-blue-600 text-white border-blue-500' : 'bg-blue-500 text-white border-blue-400'
              }`}
            >
              {repairing ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
              Scan All Access
            </button>
            <button 
              onClick={handleBulkRepairGsc}
              disabled={repairing}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] hover:brightness-110 transition-all border flex items-center gap-2 uppercase tracking-widest shadow-lg disabled:opacity-50 ${
                repairsAvailable 
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20 animate-bounce' 
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5'
              }`}
            >
              {repairing ? <RefreshCw size={14} className="animate-spin" /> : (repairsAvailable ? <Sparkles size={14} /> : <Shield size={14} />)}
              {repairsAvailable ? 'Fix All Verified URLs' : 'Auto-fix All GSC'}
            </button>
              <button 
                onClick={() => {
                  setFormData(initialFormState);
                  setShowModal('add');
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                  isWhite ? 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-zinc-900/10' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                <Plus size={18} />
                Deploy Client Node
              </button>
          </div>
      </div>

      <div className={`rounded-[24px] border shadow-2xl overflow-hidden backdrop-blur-xl ${
        isWhite ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={`border-b text-[9px] font-black text-zinc-500 uppercase tracking-widest ${
                isWhite ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-950/50 border-white/5'
              }`}>
                <th className="px-8 py-5">Client Identity</th>
                <th className="px-6 py-5">Account Manager</th>
                <th className="px-6 py-5">Monthly Leads</th>
                <th className="px-6 py-5">Target Pos</th>
                <th className="px-6 py-5">Access Status</th>
                <th className="px-8 py-5 text-right whitespace-nowrap">Operational Actions</th>
              </tr>
            </thead>
                  <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-white/5'}`}>
              {!loading && filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className={`px-8 py-20 text-center font-black uppercase tracking-widest text-sm ${theme === 'white' ? 'text-zinc-400' : 'text-zinc-700'}`}>
                    Zero properties identified.
                  </td>
                </tr>
              )}
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={6} className={`px-8 py-6 h-16 ${theme === 'white' ? 'bg-zinc-50' : 'bg-white/5'}`} />
                  </tr>
                ))
              ) : filteredClients.map((client) => (
                <tr key={client.id} className={`transition-colors group ${theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase border shadow-xl transition-all ${
                        isWhite 
                          ? 'bg-zinc-100 text-zinc-900 border-zinc-200 group-hover:bg-zinc-900 group-hover:text-white' 
                          : 'bg-zinc-800 text-blue-400 border-white/5 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                        {client.short_code}
                      </div>
                      <div>
                        <p className={`font-black uppercase tracking-tight text-sm italic ${isWhite ? 'text-zinc-900' : 'text-white'}`}>{client.name}</p>
                        <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-0.5">{client.timezone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                      theme === 'white' ? 'text-zinc-600 bg-zinc-100 border-zinc-200' : 'text-zinc-400 bg-zinc-800 border-white/5'
                    }`}>{client.project_owner_code || 'MW'}</span>
                  </td>
                  <td className={`px-6 py-5 text-[11px] font-black uppercase font-mono ${theme === 'white' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    {client.lead_target_monthly} <span className="text-zinc-600">/ MO</span>
                  </td>
                  <td className={`px-6 py-5 text-[11px] font-black uppercase font-mono ${theme === 'white' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    {client.avg_position_target || '-'}
                  </td>
                  <td className="px-6 py-5 text-[9px] font-black uppercase tracking-widest min-w-[200px]">
                    {testResults[client.id] ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${testResults[client.id].ga4Status === 'Success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {testResults[client.id].ga4Status === 'Success' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            GA4: {testResults[client.id].ga4Status}
                          </span>
                          <span className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${testResults[client.id].gscStatus.includes('Success') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {testResults[client.id].gscStatus.includes('Success') ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            GSC: {testResults[client.id].gscStatus}
                          </span>
                        </div>
                        {testResults[client.id].errors?.length > 0 && 
                          renderErrorWithFix(client.id, testResults[client.id].errors[0])
                        }
                      </div>
                    ) : (
                      <span className={isWhite ? 'text-zinc-300' : 'text-zinc-700'}>Monitoring Offline</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                      <button 
                        onClick={() => handleSyncWeekly(client.id)}
                        disabled={testingId === client.id}
                        className={`p-2 rounded-xl transition-all disabled:opacity-50 border border-transparent shadow-sm group relative ${
                            isWhite ? 'bg-zinc-100 text-emerald-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-500' : 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                        }`}
                      >
                        {testingId === client.id ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                          isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                        }`}>Sync Current Week</span>
                      </button>
                      <button 
                        onClick={() => handleTestAccess(client.id)}
                        disabled={testingId === client.id}
                        className={`p-2 rounded-xl transition-all disabled:opacity-50 border border-transparent shadow-sm group relative ${
                            isWhite ? 'bg-zinc-100 text-blue-600 hover:bg-blue-600 hover:text-white hover:border-blue-500' : 'text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/20'
                        }`}
                      >
                        {testingId === client.id ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                          isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                        }`}>Test API Access</span>
                      </button>
                      <button 
                        onClick={() => openEditModal(client)}
                        className={`p-2 rounded-xl transition-all border border-transparent shadow-sm group relative ${
                          isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-900 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                        }`}
                      >
                        <SettingsIcon size={16} />
                        <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                          isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                        }`}>Edit Client</span>
                      </button>
                      <button 
                        onClick={() => setShowKeywordsModal(client)}
                        className={`p-2 rounded-xl transition-all border border-transparent shadow-sm group relative ${
                          isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-900 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                        }`}
                      >
                        <KeyIcon size={16} />
                        <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                          isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                        }`}>Manage Keywords</span>
                      </button>
                      {client.gsc_site_url && (
                        <a 
                          href={`https://search.google.com/search-console?resource_id=${encodeURIComponent(client.gsc_site_url)}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`p-2 rounded-xl transition-all border border-transparent shadow-sm flex items-center justify-center group relative ${
                            isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-blue-600 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <TableIcon size={16} />
                          <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                            isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                          }`}>Open Search Console</span>
                        </a>
                      )}
                      {client.ga4_property_id && (
                        <a 
                          href={`https://analytics.google.com/analytics/web/#/p${client.ga4_property_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`p-2 rounded-xl transition-all border border-transparent shadow-sm flex items-center justify-center group relative ${
                            isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-orange-500 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <Activity size={16} />
                          <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                            isWhite ? 'bg-white/95 border-zinc-200 text-zinc-900' : 'bg-black/95 text-white border-white/10'
                          }`}>Open Analytics</span>
                        </a>
                      )}
                      <button 
                        onClick={() => handleDeleteClient(client.id)}
                        className={`p-2 rounded-xl transition-all border border-transparent shadow-sm group relative ${
                            isWhite ? 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white' : 'text-zinc-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20'
                        }`}
                      >
                        <Trash2 size={16} />
                        <span className={`absolute bottom-full right-0 mb-2 hidden group-hover:block w-32 p-2.5 text-[9px] rounded-xl font-black z-[110] shadow-2xl border uppercase tracking-widest backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 text-center ${
                          isWhite ? 'bg-white/95 border-rose-600 text-rose-600' : 'bg-black/95 text-rose-400 border-white/10 text-center'
                        }`}>Delete Client</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`rounded-[48px] w-full max-w-2xl shadow-2xl overflow-hidden border relative ${
            theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
          }`}>
            <div className={`p-10 border-b flex items-center justify-between backdrop-blur-xl ${
              theme === 'white' ? 'bg-zinc-50/80 border-zinc-100' : 'bg-zinc-950/80 border-white/5'
            }`}>
              <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                {showModal === 'edit' ? 'Edit Surveillance Node' : 'Initialize New Node'}
              </h3>
              <button 
                onClick={() => setShowModal(null)} 
                className={`p-3 rounded-2xl transition-all ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveClient} className="p-10 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* officer and target */}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Assigned Officer</label>
                  <select 
                    value={formData.project_owner_name}
                    onChange={(e) => {
                      const owner = owners.find(o => o.name === e.target.value);
                      setFormData({
                        ...formData, 
                        project_owner_name: e.target.value,
                        project_owner_code: owner?.code || 'MW'
                      });
                    }}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 appearance-none uppercase tracking-widest ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`}
                  >
                    {owners.map(o => <option key={o.code} value={o.name}>{o.name} ({o.code})</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Monthly Lead Target</label>
                  <input 
                    type="number" 
                    value={formData.lead_target_monthly}
                    onChange={(e) => setFormData({...formData, lead_target_monthly: parseInt(e.target.value) || 0})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Rank Benchmark (Avg Pos)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    value={formData.avg_position_target}
                    onChange={(e) => setFormData({...formData, avg_position_target: parseFloat(e.target.value) || 0})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Tech Health Target (%)</label>
                  <input 
                    type="number" 
                    value={formData.technical_score_target}
                    onChange={(e) => setFormData({...formData, technical_score_target: parseInt(e.target.value) || 0})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">T10 Visibility Goal</label>
                  <input 
                    type="number" 
                    value={formData.top_10_target}
                    onChange={(e) => setFormData({...formData, top_10_target: parseInt(e.target.value) || 0})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Property Name</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className={`w-full px-5 py-3 border rounded-2xl text-sm font-black outline-none focus:border-blue-500 uppercase tracking-tight ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                    placeholder="e.g. Acme Corp"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Strategic Short Code</label>
                  <input 
                    required
                    type="text" 
                    value={formData.short_code}
                    onChange={(e) => setFormData({...formData, short_code: e.target.value.toUpperCase()})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 uppercase tracking-widest ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`} 
                    placeholder="e.g. ACME"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Node Timezone</label>
                  <select 
                    value={formData.timezone}
                    onChange={(e) => setFormData({...formData, timezone: e.target.value})}
                    className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 appearance-none uppercase ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                    }`}
                  >
                    <option value="Australia/Sydney">Australia/Sydney</option>
                    <option value="Asia/Colombo">Asia/Colombo</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">GA4 Property ID (Precise)</label>
                <input 
                  required
                  type="text" 
                  value={formData.ga4_property_id}
                  onChange={(e) => setFormData({...formData, ga4_property_id: e.target.value})}
                  className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`} 
                  placeholder="123456789"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">GSC Site URL (Verification Path)</label>
                  {authorizedSites.length === 0 ? (
                    <button 
                      type="button"
                      onClick={fetchAuthorizedSites}
                      disabled={loadingSites}
                      className="text-[8px] font-black text-blue-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      {loadingSites ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                      Scan Authorized properties
                    </button>
                  ) : (
                    <button 
                      type="button"
                      onClick={fetchAuthorizedSites}
                      className="text-[8px] font-black text-zinc-500 uppercase tracking-widest hover:text-blue-500 transition-colors"
                    >
                      Refresh List
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <input 
                      required
                      type="text" 
                      value={formData.gsc_site_url}
                      onChange={(e) => setFormData({...formData, gsc_site_url: e.target.value})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                      placeholder="https://example.com/ or sc-domain:example.com"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {loadingSites && <RefreshCw className="animate-spin text-zinc-600" size={14} />}
                      {!loadingSites && authorizedSites.length > 0 && <Shield className="text-blue-500/50" size={14} />}
                    </div>
                  </div>
                  
                  {authorizedSites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <CheckCircle2 size={10} />
                        Verified properties found (Click to apply):
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {authorizedSites.map(site => (
                        <button
                          key={site}
                          type="button"
                          onClick={() => setFormData({...formData, gsc_site_url: site})}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-mono transition-all border shadow-sm ${
                            formData.gsc_site_url === site 
                              ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' 
                              : isWhite 
                                ? 'bg-white border-zinc-200 text-zinc-600 hover:border-blue-400 hover:text-blue-600'
                                : 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {site}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Target Lead Events (CSV)</label>
                <input 
                  type="text" 
                  value={formData.lead_event_names}
                  onChange={(e) => setFormData({...formData, lead_event_names: e.target.value})}
                  className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`} 
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Pre-Seed Keywords (Optional CSV)</label>
                <textarea 
                  value={(formData as any).initial_keywords}
                  onChange={(e) => setFormData({...formData, initial_keywords: e.target.value} as any)}
                  placeholder="keyword, https://landingpage.com..."
                  className={`w-full px-5 py-4 border rounded-2xl text-[10px] font-black outline-none focus:border-blue-500 h-28 font-mono resize-none ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Internal Strategic Notes</label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className={`w-full px-5 py-4 border rounded-2xl text-[10px] font-black outline-none focus:border-blue-500 h-28 uppercase tracking-widest resize-none ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                  }`}
                />
              </div>
            </form>
            <div className={`p-10 flex justify-end gap-4 border-t ${
              theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-950 border-white/5'
            }`}>
              <button 
                onClick={() => setShowModal(null)}
                className={`px-8 py-3 font-black uppercase text-[10px] tracking-widest transition-colors ${
                  theme === 'white' ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Abort
              </button>
              <button 
                onClick={handleSaveClient}
                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20"
              >
                Deploy Node
              </button>
            </div>
          </div>
        </div>
      )}

      {showKeywordsModal && (
        <KeywordsModal 
          client={showKeywordsModal} 
          onClose={() => setShowKeywordsModal(null)} 
        />
      )}
    </div>
  );
}

function KeywordsModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const { theme } = useTheme();
  const isWhite = theme === 'white';
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState('');
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
    supabase.from('keywords').select('*').eq('client_id', client.id)
      .then(({ data }) => {
        setKeywords(data || []);
        setLoading(false);
      });
  }, [client.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    
    const { data, error } = await supabase.from('keywords').insert({
      client_id: client.id,
      query: newKeyword.trim(),
      landing_page_url: newUrl.trim() || null,
      priority: 'Medium'
    }).select().single();

    if (!error && data) {
      setKeywords([...keywords, data]);
      setNewKeyword('');
      setNewUrl('');
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('keywords').delete().eq('id', id);
    if (!error) {
      setKeywords(keywords.filter(k => k.id !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
      <div className={`rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden border relative flex flex-col ${
        isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
      }`}>
        <div className={`p-10 border-b flex items-center justify-between ${
          isWhite ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-950 border-white/5'
        }`}>
          <div>
            <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${isWhite ? 'text-zinc-900' : 'text-white'}`}>Keyword Assets</h3>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Satellite target configuration for {client.name}</p>
          </div>
          <button 
            onClick={onClose}
            className={`p-3 rounded-2xl transition-all ${
              isWhite ? 'bg-zinc-100 text-zinc-500 hover:text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:text-white'
            }`}
          >
            <XCircle size={24} />
          </button>
        </div>

        <div className="p-10 flex-1 overflow-y-auto max-h-[60vh] space-y-8">
          <form onSubmit={handleAdd} className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-3xl border ${
            isWhite ? 'bg-zinc-50 border-zinc-100' : 'bg-blue-500/5 border-blue-500/10'
          }`}>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Keyphrase Target</label>
              <input 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="e.g. SEO services sydney"
                className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 uppercase ${
                  isWhite ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                }`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Landing Node (URL)</label>
              <input 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                  isWhite ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                }`}
              />
            </div>
            <button 
              type="submit"
              className={`md:col-span-2 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all font-mono ${
                isWhite ? 'bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/10' : 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-500'
              }`}
            >
              Initialize Keyphrase Link
            </button>
          </form>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Active Tracking Nodes</h4>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className={`h-12 rounded-2xl animate-pulse ${isWhite ? 'bg-zinc-100' : 'bg-white/5'}`} />)}
              </div>
            ) : keywords.length === 0 ? (
              <div className={`p-10 text-center rounded-[32px] border border-dashed ${isWhite ? 'border-zinc-200 text-zinc-400' : 'border-white/5 text-zinc-700'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest italic">No tracking nodes active for this property.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keywords.map(k => (
                  <div key={k.id} className={`flex items-center justify-between p-4 border rounded-2xl group transition-all ${
                    isWhite ? 'bg-white border-zinc-100 hover:bg-zinc-50' : 'bg-zinc-900 border-white/5 hover:bg-zinc-800'
                  }`}>
                    <div className="overflow-hidden">
                      <p className={`text-[11px] font-black uppercase tracking-tight truncate ${isWhite ? 'text-zinc-900' : 'text-white'}`}>{k.query}</p>
                      <p className="text-[9px] text-zinc-500 font-mono italic truncate">{k.landing_page_url || 'No URL mapped'}</p>
                    </div>
                    <button 
                      onClick={() => handleDelete(k.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`p-10 flex justify-end border-t ${
          isWhite ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-950 border-white/5'
        }`}>
          <button 
            onClick={onClose}
            className={`px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all font-mono ${
                isWhite ? 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            Close Operational Access
          </button>
        </div>
      </div>
    </div>
  );
}

