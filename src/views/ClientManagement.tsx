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
import Tooltip from '../components/Tooltip';

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
    top_10_target: 0,
    target_monthly_clicks: 0,
    target_monthly_sessions: 0,
    target_monthly_blogs: 0,
    lead_api_url: '',
    target_dr: 0
  };

  const owners = [
    { name: 'Melaka', code: 'MW' },
    { name: 'Amit', code: 'AS' },
    { name: 'Sai', code: 'SR' },
    { name: 'Vinoj', code: 'VK' },
    { name: 'Sash', code: 'SP' },
    { name: 'Lidusha', code: 'LB' },
    { name: 'Dinesh', code: 'DS' }
  ];

  const [formData, setFormData] = useState(initialFormState);
  const [authorizedSites, setAuthorizedSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [showGscDropdown, setShowGscDropdown] = useState(false);

  const [debugLog, setDebugLog] = useState<string[]>([]);
  const logDebug = (msg: string) => {
    console.log('CLIENT_DEBUG:', msg);
    setDebugLog(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev].slice(0, 10));
  };

  const fetchData = () => {
    logDebug('Fetching clients...');
    setLoading(true);
    getClients().then(async (data) => {
      logDebug(`Fetched ${data.length} clients`);
      setClients(data);
      setLoading(false);

      // Restore GSC and GA4 test access results from Supabase import logs
      try {
        const { data: logs, error } = await supabase
          .from('import_logs')
          .select('*')
          .eq('operation_type', 'access_test')
          .order('imported_at', { ascending: false });

        if (!error && logs) {
          const latestLogs: Record<string, any> = {};
          logs.forEach(log => {
            if (!latestLogs[log.client_id]) {
              const errors = log.message ? log.message.split('; ').filter(Boolean) : [];
              const ga4Status = errors.some((e: string) => e.toLowerCase().includes('ga4')) ? 'Failed' : 'Success';
              const gscStatus = errors.some((e: string) => e.toLowerCase().includes('gsc')) ? 'Failed' : 'Success';
              latestLogs[log.client_id] = {
                ga4Status,
                gscStatus,
                errors
              };
            }
          });
          setTestResults(latestLogs);
        }
      } catch (logErr) {
        console.error('Failed to load cached access logs:', logErr);
      }
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
    if (!window.confirm('This will scan all clients and try to automatically fix their GSC URLs to match your authorised properties. Proceed?')) return;
    
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

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='lead_api_url') THEN
    ALTER TABLE public.clients ADD COLUMN lead_api_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='target_dr') THEN
    ALTER TABLE public.clients ADD COLUMN target_dr INTEGER DEFAULT 0;
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='phone_calls') THEN
    ALTER TABLE public.weekly_data ADD COLUMN phone_calls INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ga4_organic_traffic') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ga4_organic_traffic INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ahrefs_dr') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ahrefs_dr INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ahrefs_backlinks') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ahrefs_backlinks INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='weekly_data' AND column_name='ahrefs_ref_domains') THEN
    ALTER TABLE public.weekly_data ADD COLUMN ahrefs_ref_domains INTEGER DEFAULT 0;
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
  lead_api_url TEXT,
  target_dr INTEGER DEFAULT 0,
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
  ga4_organic_traffic INTEGER DEFAULT 0,
  gsc_clicks INTEGER DEFAULT 0,
  gsc_impressions INTEGER DEFAULT 0,
  gsc_ctr NUMERIC DEFAULT 0,
  gsc_position NUMERIC DEFAULT 0,
  leads_total INTEGER DEFAULT 0,
  leads_legit INTEGER DEFAULT 0,
  target_leads INTEGER DEFAULT 0,
  phone_calls INTEGER DEFAULT 0,
  ahrefs_dr INTEGER DEFAULT 0,
  ahrefs_backlinks INTEGER DEFAULT 0,
  ahrefs_ref_domains INTEGER DEFAULT 0,
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

-- AI Audit History
CREATE TABLE IF NOT EXISTS public.ai_audit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PERMISSIONS (Allow ALL for internal tool)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyword_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_audit_history ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "public_access" ON public.ai_audit_history;
CREATE POLICY "public_access" ON public.ai_audit_history FOR ALL USING (true);

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
      alert(`Database Success!\n\n- Current Client Count: ${data.length}\n- Connection: Active and Authorised as ${user.email}`);
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
      target_monthly_clicks: client.target_monthly_clicks || 0,
      target_monthly_sessions: client.target_monthly_sessions || 0,
      target_monthly_blogs: client.target_monthly_blogs || 0,
      lead_api_url: client.lead_api_url || '',
      target_dr: client.target_dr || 0,
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
    if (!searchTerm.trim()) return true;
    const name = client.name || '';
    const code = client.short_code || '';
    const terms = searchTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    return terms.some(term =>
      name.toLowerCase().includes(term) ||
      code.toLowerCase().includes(term)
    );
  });

  const filteredSites = authorizedSites.filter(site =>
    site.toLowerCase().includes(formData.gsc_site_url.toLowerCase())
  );

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
          <h2 className={`text-2xl font-black font-heading uppercase tracking-tighter italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>Client Management</h2>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 italic ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>Configure security and tracking nodes</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isWhite ? 'text-[#607a80]' : 'text-zinc-600'}`} size={16} />
            <input 
              type="text" 
              placeholder="Search nodes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 pr-6 py-2.5 border rounded-2xl text-xs font-black focus:outline-none transition-all w-64 uppercase tracking-widest ${
                isWhite ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-white focus:border-blue-500'
              }`}
            />
          </div>
          <button 
            onClick={checkDbConnection}
            className={`px-5 py-2.5 border rounded-2xl font-black text-[9px] uppercase tracking-widest hover:brightness-110 transition-all ${
              isWhite ? 'bg-white border-[#163f4d]/10 text-[#607a80]' : 'bg-zinc-900 border-white/5 text-zinc-400'
            }`}
          >
            Pings DB
          </button>
            <button 
              onClick={handleCopySql}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] transition-all border flex items-center gap-2 uppercase tracking-widest shadow-lg ${
                isWhite ? 'bg-[#f47b20]/10 text-[#f47b20] border-[#f47b20]/20 shadow-[#f47b20]/5 hover:bg-[#f47b20]/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5 hover:bg-amber-500/20'
              }`}
              title="Fix database columns if you see schema errors"
            >
              <Shield size={14} />
              Repair SQL
            </button>
            <button 
              onClick={handleBootstrap}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] transition-all uppercase tracking-widest border ${
                isWhite ? 'bg-[#76c9be]/5 text-[#082a36] border-[#163f4d]/10 hover:bg-[#76c9be]/10' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'
              }`}
            >
              Seed Accounts
            </button>
            <button 
              onClick={handleScanAllAccess}
              disabled={repairing}
              className={`px-5 py-2.5 rounded-2xl font-black text-[9px] hover:brightness-110 transition-all border flex items-center gap-2 uppercase tracking-widest shadow-lg disabled:opacity-50 ${
                isWhite ? 'bg-[#082a36] text-white border-[#082a36] shadow-[#082a36]/20' : 'bg-blue-500 text-white border-blue-400 shadow-blue-500/20'
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
                  ? (isWhite ? 'bg-[#76c9be] text-white border-[#76c9be] shadow-[#76c9be]/20 animate-bounce' : 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20 animate-bounce') 
                  : (isWhite ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20 shadow-[#76c9be]/5' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5')
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
                  isWhite ? 'bg-[#f47b20] text-white hover:bg-[#f47b20]/90 shadow-[#f47b20]/20' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                <Plus size={18} />
                Deploy Client Node
              </button>
          </div>
      </div>
      <div className={`rounded-[20px] border shadow-2xl overflow-hidden backdrop-blur-xl ${
        isWhite ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10">
              <tr className={`border-b text-[10px] font-black uppercase tracking-widest ${
                isWhite ? 'bg-[#082a36] border-[#163f4d]/20 text-white' : 'bg-zinc-950/50 border-white/5 text-zinc-500'
              }`}>
                <th className="px-8 py-2 rounded-tl-[20px]">Client Identity</th>
                <th className="px-6 py-2">Account Manager</th>
                <th className="px-6 py-2">Monthly Leads</th>
                <th className="px-6 py-2">Target Pos</th>
                <th className="px-6 py-2">Access Status</th>
                <th className="px-8 py-2 text-right whitespace-nowrap rounded-tr-[20px]">Operational Actions</th>
              </tr>
            </thead>
                  <tbody className={`divide-y ${isWhite ? 'divide-[#163f4d]/5' : 'divide-white/5'}`}>
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
                  <td className="px-8 py-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs uppercase border shadow-xl transition-all ${
                        isWhite 
                          ? 'bg-[#76c9be]/5 text-[#082a36] border-[#163f4d]/10 group-hover:bg-[#082a36] group-hover:text-white' 
                          : 'bg-zinc-800 text-blue-400 border-white/5 group-hover:bg-blue-600 group-hover:text-white'
                      }`}>
                        {client.short_code}
                      </div>
                      <div>
                        <p className={`font-black font-heading uppercase tracking-tight text-sm italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>{client.name}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>{client.timezone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-2">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                      isWhite ? 'text-[#607a80] bg-[#76c9be]/5 border-[#163f4d]/5' : 'text-zinc-400 bg-zinc-800 border-white/5'
                    }`}>{client.project_owner_code || 'MW'}</span>
                  </td>
                  <td className={`px-6 py-2 text-[11px] font-black uppercase font-mono ${isWhite ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                    {client.lead_target_monthly} <span className={isWhite ? 'text-[#607a80]' : 'text-zinc-600'}>/ MO</span>
                  </td>
                  <td className={`px-6 py-2 text-[11px] font-black uppercase font-mono ${isWhite ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                    {client.avg_position_target || '-'}
                  </td>
                  <td className="px-6 py-2 text-[9px] font-black uppercase tracking-widest min-w-[200px]">
                    {testResults[client.id] ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${testResults[client.id].ga4Status === 'Success' ? (isWhite ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20') : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                            {testResults[client.id].ga4Status === 'Success' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                            GA4: {testResults[client.id].ga4Status}
                          </span>
                          <span className={`px-2 py-1 rounded-lg border flex items-center gap-1.5 ${testResults[client.id].gscStatus.includes('Success') ? (isWhite ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20') : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
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
                  <td className="px-8 py-2 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                      <Tooltip content="Sync Current Week">
                        <button 
                          onClick={() => handleSyncWeekly(client.id)}
                          disabled={testingId === client.id}
                          className={`p-2 rounded-xl transition-all disabled:opacity-50 border border-transparent shadow-sm ${
                              isWhite ? 'bg-[#76c9be]/5 text-[#76c9be] hover:bg-[#76c9be] hover:text-white hover:border-[#76c9be]' : 'text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                          }`}
                        >
                          {testingId === client.id ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                        </button>
                      </Tooltip>
                      <Tooltip content="Test API Access">
                        <button 
                          onClick={() => handleTestAccess(client.id)}
                          disabled={testingId === client.id}
                          className={`p-2 rounded-xl transition-all disabled:opacity-50 border border-transparent shadow-sm ${
                              isWhite ? 'bg-[#76c9be]/5 text-[#082a36] hover:bg-[#082a36] hover:text-white hover:border-[#082a36]' : 'text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/20'
                          }`}
                        >
                          {testingId === client.id ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        </button>
                      </Tooltip>
                      <Tooltip content="Edit Client">
                        <button 
                          onClick={() => openEditModal(client)}
                          className={`p-2 rounded-xl transition-all border border-transparent shadow-sm ${
                            isWhite ? 'bg-[#76c9be]/5 text-[#607a80] hover:bg-[#082a36] hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <SettingsIcon size={16} />
                        </button>
                      </Tooltip>
                      <Tooltip content="Manage Keywords">
                        <button 
                          onClick={() => setShowKeywordsModal(client)}
                          className={`p-2 rounded-xl transition-all border border-transparent shadow-sm ${
                            isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-900 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                          }`}
                        >
                          <KeyIcon size={16} />
                        </button>
                      </Tooltip>
                      {client.gsc_site_url && (
                        <Tooltip content="Open Search Console">
                          <a 
                            href={`https://search.google.com/search-console?resource_id=${encodeURIComponent(client.gsc_site_url)}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`p-2 rounded-xl transition-all border border-transparent shadow-sm flex items-center justify-center ${
                              isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-blue-600 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                            }`}
                          >
                            <TableIcon size={16} />
                          </a>
                        </Tooltip>
                      )}
                      {client.ga4_property_id && (
                        <Tooltip content="Open Analytics">
                          <a 
                            href={`https://analytics.google.com/analytics/web/#/p${client.ga4_property_id}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`p-2 rounded-xl transition-all border border-transparent shadow-sm flex items-center justify-center ${
                              isWhite ? 'bg-zinc-100 text-zinc-600 hover:bg-orange-500 hover:text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                            }`}
                          >
                            <Activity size={16} />
                          </a>
                        </Tooltip>
                      )}
                      <Tooltip content="Delete Client">
                        <button 
                          onClick={() => handleDeleteClient(client.id)}
                          className={`p-2 rounded-xl transition-all border border-transparent shadow-sm ${
                              isWhite ? 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white' : 'text-zinc-500 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20'
                          }`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </Tooltip>
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
                <Tooltip content="Select the primary campaign manager owning this client project node" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Assigned Officer</label>
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
                </Tooltip>
                <Tooltip content="Set the targeted number of qualified organic leads to generate for this client per calendar month" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Monthly Lead Target</label>
                    <input 
                      type="number" 
                      value={formData.lead_target_monthly}
                      onChange={(e) => setFormData({...formData, lead_target_monthly: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <Tooltip content="Target average ranking position across all tracked keywords in Google Search Console" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Rank Benchmark (Avg Pos)</label>
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
                </Tooltip>
                <Tooltip content="Desired minimum target percentage score for technical site performance and SEO health checks" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Tech Health Target (%)</label>
                    <input 
                      type="number" 
                      value={formData.technical_score_target}
                      onChange={(e) => setFormData({...formData, technical_score_target: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <Tooltip content="Set the targeted number of Google Search Console organic clicks to achieve per calendar month" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Target Monthly Clicks (GSC)</label>
                    <input 
                      type="number" 
                      value={formData.target_monthly_clicks}
                      onChange={(e) => setFormData({...formData, target_monthly_clicks: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
                <Tooltip content="Set the targeted number of Google Analytics 4 sessions to achieve per calendar month" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Target Monthly Sessions (GA4)</label>
                    <input 
                      type="number" 
                      value={formData.target_monthly_sessions}
                      onChange={(e) => setFormData({...formData, target_monthly_sessions: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <Tooltip content="Set the monthly content production goal for blogs and article nodes" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-[#607a80]'}`}>Target Blogs Published</label>
                    <input 
                      type="number" 
                      value={formData.target_monthly_blogs}
                      onChange={(e) => setFormData({...formData, target_monthly_blogs: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
                <Tooltip content="Target number of keywords to rank in Google's top 10 organic search results" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>T10 Visibility Goal</label>
                    <input 
                      type="number" 
                      value={formData.top_10_target}
                      onChange={(e) => setFormData({...formData, top_10_target: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <Tooltip content="Set the target Ahrefs Domain Rating (DR) to track for this client node" className="w-full">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Target Domain Rating (DR)</label>
                    <input 
                      type="number" 
                      value={formData.target_dr}
                      onChange={(e) => setFormData({...formData, target_dr: parseInt(e.target.value) || 0})}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="space-y-2">
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Property Name</label>
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
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Strategic Short Code</label>
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
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Node Timezone</label>
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
                      Scan Authorised properties
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
                      onChange={(e) => {
                        setFormData({...formData, gsc_site_url: e.target.value});
                        setShowGscDropdown(true);
                      }}
                      onFocus={() => setShowGscDropdown(true)}
                      onBlur={() => setTimeout(() => setShowGscDropdown(false), 200)}
                      className={`w-full px-5 py-3 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 font-mono ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                      }`} 
                      placeholder="https://example.com/ or sc-domain:example.com"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      {loadingSites && <RefreshCw className="animate-spin text-zinc-600" size={14} />}
                      {!loadingSites && authorizedSites.length > 0 && <Shield className="text-blue-500/50" size={14} />}
                    </div>

                    {showGscDropdown && authorizedSites.length > 0 && (
                      <div className={`absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border shadow-xl z-50 transition-all font-mono text-[10px] ${
                        theme === 'white' 
                          ? 'bg-white border-zinc-200 text-zinc-900 shadow-zinc-200/50' 
                          : 'bg-zinc-900 border-white/10 text-white shadow-black/80'
                      }`}>
                        {filteredSites.length === 0 ? (
                          <div className="px-4 py-3 text-zinc-500 italic">No matching verified properties found</div>
                        ) : (
                          filteredSites.map(site => (
                            <button
                              key={site}
                              type="button"
                              onClick={() => {
                                setFormData({...formData, gsc_site_url: site});
                                setShowGscDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2.5 transition-colors border-b last:border-0 flex items-center justify-between ${
                                theme === 'white'
                                  ? 'border-zinc-100 hover:bg-zinc-50'
                                  : 'border-white/5 hover:bg-white/5'
                              } ${formData.gsc_site_url === site ? 'bg-blue-600/10 text-blue-500 font-bold' : ''}`}
                            >
                              <span className="truncate">{site}</span>
                              {formData.gsc_site_url === site && <CheckCircle2 size={12} className="text-blue-500 flex-shrink-0 ml-2" />}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  
                  {authorizedSites.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] text-blue-600 font-black uppercase tracking-widest flex items-center gap-1.5 ml-1">
                        <CheckCircle2 size={10} />
                        {filteredSites.length < authorizedSites.length ? 'Filtered matching properties' : 'Verified properties found'} (Click to apply):
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1">
                        {filteredSites.length === 0 ? (
                          <p className="text-[9px] text-zinc-500 italic ml-1">No matching properties found. Type to search or refresh list.</p>
                        ) : (
                          filteredSites.map(site => (
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
                          ))
                        )}
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
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Genuine Leads Filtering API URL (Optional)</label>
                <input 
                  type="text" 
                  value={formData.lead_api_url}
                  onChange={(e) => setFormData({...formData, lead_api_url: e.target.value})}
                  placeholder="https://your-custom-app.com/api/genuine-leads"
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

