import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Plus,
  Edit2,
  Settings,
  Target,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BarChart3,
  Calendar,
  Globe,
  Share2,
  Mail,
  FileText,
  MousePointerClick,
  Eye,
  Percent,
  RefreshCw,
  Clock,
  Sparkles,
  Users
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getClients, Client, WeeklyAdsGrowth, getAdsGrowthData, updateAdsGrowthData, syncAdsGrowthData } from '../services/dataService';
import ClientSelector from '../components/ClientSelector';
import Tooltip from '../components/Tooltip';

function formatWeekPeriod(weekStartStr: string): string {
  if (!weekStartStr) return '';
  const parts = weekStartStr.split('-');
  if (parts.length !== 3) return weekStartStr;
  
  const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  if (isNaN(start.getTime())) return weekStartStr;
  
  const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  const startFormatted = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endFormatted = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  return `${startFormatted} – ${endFormatted}`;
}

export default function AdsDashboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [adsData, setAdsData] = useState<WeeklyAdsGrowth[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const location = useLocation();

  // Form edit states
  const [formState, setFormState] = useState<Partial<WeeklyAdsGrowth>>({});

  useEffect(() => {
    async function loadInitialData() {
      try {
        const c = await getClients();
        setClients(c);
        
        const params = new URLSearchParams(location.search);
        const clientIdParam = params.get('clientId');
        if (clientIdParam) {
          setSelectedClient(clientIdParam);
        } else if (c.length > 0) {
          setSelectedClient(c[0].id);
        }
      } catch (err) {
        setError('Failed to load clients list.');
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [location.search]);

  useEffect(() => {
    if (!selectedClient) return;
    async function loadClientAdsData() {
      setLoading(true);
      setError(null);
      try {
        const data = await getAdsGrowthData(selectedClient);
        setAdsData(data);
        if (data.length > 0) {
          setSelectedWeek(data[0].week_start_date);
          setFormState(data[0]);
        } else {
          // Align today to Monday
          const today = new Date();
          const day = today.getDay();
          const diff = today.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(today.setDate(diff));
          const y = monday.getFullYear();
          const m = String(monday.getMonth() + 1).padStart(2, '0');
          const d = String(monday.getDate()).padStart(2, '0');
          const defaultWeek = `${y}-${m}-${d}`;
          
          setSelectedWeek(defaultWeek);
          setFormState({
            week_start_date: defaultWeek,
            google_ads_spend: 0,
            google_ads_conversions: 0,
            google_ads_roas: 0,
            google_ads_ctr: 0,
            google_ads_quality_score: 0,
            meta_spend: 0,
            meta_reach: 0,
            meta_leads: 0,
            meta_roas: 0,
            meta_ctr: 0,
            meta_frequency: 0,
            website_sessions: 0,
            bounce_rate: 0,
            avg_time_on_site: '',
            top_converting_page: '',
            active_ab_tests: 0,
            landing_pages_live: 0,
            followers_total: 0,
            social_impressions: 0,
            engagement_rate: 0,
            social_posts_published: 0,
            organic_social_reach: 0,
            top_platform: '',
            blogs_written: 0,
            avg_blog_quality: 0,
            backlinks_created: 0,
            social_posts_content_total: 0,
            creatives_produced: 0,
            emails_automation: 0,
            seo_organic_leads: 0
          });
        }
      } catch (err) {
        setError('Failed to retrieve advertising data.');
      } finally {
        setLoading(false);
      }
    }
    loadClientAdsData();
  }, [selectedClient]);

  const activeRecord = useMemo(() => {
    return adsData.find(d => d.week_start_date === selectedWeek) || null;
  }, [adsData, selectedWeek]);

  // Load selected week into form
  useEffect(() => {
    if (activeRecord) {
      setFormState(activeRecord);
    } else {
      setFormState({
        week_start_date: selectedWeek,
        google_ads_spend: 0,
        google_ads_conversions: 0,
        google_ads_roas: 0,
        google_ads_ctr: 0,
        google_ads_quality_score: 0,
        meta_spend: 0,
        meta_reach: 0,
        meta_leads: 0,
        meta_roas: 0,
        meta_ctr: 0,
        meta_frequency: 0,
        website_sessions: 0,
        bounce_rate: 0,
        avg_time_on_site: '',
        top_converting_page: '',
        active_ab_tests: 0,
        landing_pages_live: 0,
        followers_total: 0,
        social_impressions: 0,
        engagement_rate: 0,
        social_posts_published: 0,
        organic_social_reach: 0,
        top_platform: '',
        blogs_written: 0,
        avg_blog_quality: 0,
        backlinks_created: 0,
        social_posts_content_total: 0,
        creatives_produced: 0,
        emails_automation: 0,
        seo_organic_leads: 0
      });
    }
  }, [selectedWeek, activeRecord]);

  const handleSync = async () => {
    if (!selectedClient || !selectedWeek) return;
    setSyncing(true);
    setError(null);
    try {
      const data = await syncAdsGrowthData(selectedClient, selectedWeek);
      if (data) {
        setSuccessMsg('Simulated API Sync complete!');
        // Refresh client data list
        const updatedList = await getAdsGrowthData(selectedClient);
        setAdsData(updatedList);
        setFormState(data);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !selectedWeek) return;
    setSaving(true);
    setError(null);
    try {
      const data = await updateAdsGrowthData(selectedClient, {
        ...formState,
        week_start_date: selectedWeek
      });
      if (data) {
        setSuccessMsg('Advertising data saved successfully!');
        const updatedList = await getAdsGrowthData(selectedClient);
        setAdsData(updatedList);
        setIsEditing(false);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // Helper calculations
  const googleCpl = useMemo(() => {
    const spend = Number(formState.google_ads_spend) || 0;
    const conversions = Number(formState.google_ads_conversions) || 0;
    return spend > 0 && conversions > 0 ? `$${(spend / conversions).toFixed(2)}` : '—';
  }, [formState.google_ads_spend, formState.google_ads_conversions]);

  const metaCpl = useMemo(() => {
    const spend = Number(formState.meta_spend) || 0;
    const leads = Number(formState.meta_leads) || 0;
    return spend > 0 && leads > 0 ? `$${(spend / leads).toFixed(2)}` : '—';
  }, [formState.meta_spend, formState.meta_leads]);

  const webConvRate = useMemo(() => {
    const sessions = Number(formState.website_sessions) || 0;
    const leads = (Number(formState.meta_leads) || 0) + (Number(formState.seo_organic_leads) || 0);
    return sessions > 0 ? ((leads / sessions) * 100).toFixed(2) : '0.00';
  }, [formState.website_sessions, formState.meta_leads, formState.seo_organic_leads]);

  const currentClientName = clients.find(c => c.id === selectedClient)?.name || 'Select Client';

  // Generate list of weeks (Mondays) for selection
  const weekOptions = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    // Go back 10 weeks
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - (i * 7);
      const monday = new Date(d.setDate(diff));
      const y = monday.getFullYear();
      const m = String(monday.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(monday.getDate()).padStart(2, '0');
      list.push(`${y}-${m}-${dayOfMonth}`);
    }
    // Make sure current selected week is included
    if (selectedWeek && !list.includes(selectedWeek)) {
      list.unshift(selectedWeek);
    }
    return list;
  }, [selectedWeek]);

  return (
    <div className={`p-6 min-h-screen space-y-6 ${theme === 'white' ? 'bg-[#f4f7f6]' : 'bg-[#081e26]'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
            Ads & Growth Analytics
          </h1>
          <p className={`text-sm ${theme === 'white' ? 'text-zinc-500' : 'text-emerald-400/60'}`}>
            Monitor paid campaigns, conversion rates, and deliverables for {currentClientName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ClientSelector
            clients={clients}
            selectedId={selectedClient}
            onSelect={setSelectedClient}
          />

          {selectedWeek && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
              theme === 'white'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <Calendar size={13} />
              <span>Period: {formatWeekPeriod(selectedWeek)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border focus:ring-4 outline-none font-medium ${
                theme === 'white'
                  ? 'bg-white border-zinc-200 text-zinc-800 focus:ring-blue-500/5'
                  : 'bg-zinc-900 border-zinc-800 text-emerald-400 focus:ring-emerald-500/10'
              }`}
            >
              {weekOptions.map(week => (
                <option key={week} value={week}>
                  {formatWeekPeriod(week)} ({week})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSync}
            disabled={syncing}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
              theme === 'white'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-zinc-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-slate-900 disabled:bg-zinc-700'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Ads'}
          </button>

          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition ${
              theme === 'white'
                ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                : 'bg-zinc-900 border-zinc-800 text-emerald-400 hover:bg-zinc-800'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            {isEditing ? 'View Mode' : 'Edit Metrics'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {isEditing ? (
        /* Edit Metrics Form */
        <form onSubmit={handleSave} className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-6`}>
          <div className="flex justify-between items-center pb-4 border-b border-zinc-800/40">
            <h2 className={`font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>Update Ads & Analytics Metrics</h2>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                theme === 'white'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900'
              }`}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Google Ads Group */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Google Ads Parameters
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-75 block mb-1">Spend ($)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_spend || ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_spend: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">ROAS (x)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_roas || ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_roas: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">CTR (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_ctr || ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_ctr: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Quality Score (1-10)</label>
                  <input
                    type="number" max="10" min="0"
                    value={formState.google_ads_quality_score || ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_quality_score: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Conversions</label>
                  <input
                    type="number"
                    value={formState.google_ads_conversions || ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_conversions: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Meta Ads Group */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Meta Ads (Facebook)
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-75 block mb-1">Spend ($)</label>
                  <input
                    type="number" step="any"
                    value={formState.meta_spend || ''}
                    onChange={(e) => setFormState({ ...formState, meta_spend: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Reach</label>
                  <input
                    type="number"
                    value={formState.meta_reach || ''}
                    onChange={(e) => setFormState({ ...formState, meta_reach: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Leads (Total)</label>
                  <input
                    type="number"
                    value={formState.meta_leads || ''}
                    onChange={(e) => setFormState({ ...formState, meta_leads: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-75 block mb-1">ROAS (x)</label>
                    <input
                      type="number" step="any"
                      value={formState.meta_roas || ''}
                      onChange={(e) => setFormState({ ...formState, meta_roas: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs opacity-75 block mb-1">Frequency</label>
                    <input
                      type="number" step="any"
                      value={formState.meta_frequency || ''}
                      onChange={(e) => setFormState({ ...formState, meta_frequency: parseFloat(e.target.value) || 0 })}
                      className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Web Analytics Group */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Web Analytics & SEO Leads
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-75 block mb-1">Website Sessions</label>
                  <input
                    type="number"
                    value={formState.website_sessions || ''}
                    onChange={(e) => setFormState({ ...formState, website_sessions: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Bounce Rate (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.bounce_rate || ''}
                    onChange={(e) => setFormState({ ...formState, bounce_rate: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">SEO / Organic Leads</label>
                  <input
                    type="number"
                    value={formState.seo_organic_leads || ''}
                    onChange={(e) => setFormState({ ...formState, seo_organic_leads: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Top Converting Page (Path)</label>
                  <input
                    type="text"
                    value={formState.top_converting_page || ''}
                    onChange={(e) => setFormState({ ...formState, top_converting_page: e.target.value })}
                    placeholder="/services/..."
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-850">
            {/* Social Media Metrics Group */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-sky-400">Social Media & Organic Analytics</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-75 block mb-1">Followers (Total)</label>
                  <input
                    type="number"
                    value={formState.followers_total || ''}
                    onChange={(e) => setFormState({ ...formState, followers_total: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Engagement Rate (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.engagement_rate || ''}
                    onChange={(e) => setFormState({ ...formState, engagement_rate: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Social Impressions</label>
                  <input
                    type="number"
                    value={formState.social_impressions || ''}
                    onChange={(e) => setFormState({ ...formState, social_impressions: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Posts Published</label>
                  <input
                    type="number"
                    value={formState.social_posts_published || ''}
                    onChange={(e) => setFormState({ ...formState, social_posts_published: parseInt(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Agency Outputs Group */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-emerald-400">Agency Deliverables & Activity</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs opacity-75 block mb-1">Blogs Written</label>
                  <input
                    type="number"
                    value={formState.blogs_written || ''}
                    onChange={(e) => setFormState({ ...formState, blogs_written: parseInt(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Blog Quality (1-5)</label>
                  <input
                    type="number" max="5" min="0" step="any"
                    value={formState.avg_blog_quality || ''}
                    onChange={(e) => setFormState({ ...formState, avg_blog_quality: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Backlinks Built</label>
                  <input
                    type="number"
                    value={formState.backlinks_created || ''}
                    onChange={(e) => setFormState({ ...formState, backlinks_created: parseInt(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Creatives Made</label>
                  <input
                    type="number"
                    value={formState.creatives_produced || ''}
                    onChange={(e) => setFormState({ ...formState, creatives_produced: parseInt(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Emails Sent</label>
                  <input
                    type="number"
                    value={formState.emails_automation || ''}
                    onChange={(e) => setFormState({ ...formState, emails_automation: parseInt(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-xs opacity-75 block mb-1">Social Total</label>
                  <input
                    type="number"
                    value={formState.social_posts_content_total || ''}
                    onChange={(e) => setFormState({ ...formState, social_posts_content_total: parseInt(e.target.value) || 0 })}
                    className={`w-full px-2 py-2 text-sm rounded-lg outline-none border ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-zinc-800 text-white'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Analytics View Panels */
        <div className="space-y-6">
          
          {/* Main PPC Metrics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Google Ads */}
            <div className={`p-6 rounded-2xl border ${
              theme === 'white' ? 'bg-white border-zinc-100 shadow-sm' : 'bg-zinc-950/40 border-zinc-900/60'
            }`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`font-bold font-heading flex items-center gap-2 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Google Ads Performance
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-650' : 'bg-zinc-900 text-emerald-400/80'
                }`}>Weekly Summary</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60 flex items-center gap-1">Ad Spend</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    ${Number(formState.google_ads_spend || 0).toLocaleString()}
                  </div>
                </div>

                 <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60 flex items-center gap-1">
                    G Ads Cost/Conv.
                    <Tooltip position="top" content="Calculated dynamically: Google Ads Spend / Google conversions">
                      <HelpCircle className="w-3.5 h-3.5 opacity-60 cursor-pointer" />
                    </Tooltip>
                  </div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 text-blue-400`}>
                    {googleCpl}
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60">ROAS (x)</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.google_ads_roas || '0.0'}x
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60">Ad CTR (%)</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.google_ads_ctr || '0.00'}%
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-sm">
                <span className="opacity-75">Average Quality Score:</span>
                <span className="font-bold text-blue-400">{formState.google_ads_quality_score || '0'} / 10</span>
              </div>
            </div>

            {/* Meta Ads (Facebook) */}
            <div className={`p-6 rounded-2xl border ${
              theme === 'white' ? 'bg-white border-zinc-100 shadow-sm' : 'bg-zinc-950/40 border-zinc-900/60'
            }`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className={`font-bold font-heading flex items-center gap-2 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Meta Ads Performance
                </h2>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-650' : 'bg-zinc-900 text-emerald-400/80'
                }`}>Weekly Summary</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60">Meta Spend</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    ${Number(formState.meta_spend || 0).toLocaleString()}
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60 flex items-center gap-1">
                    Meta Cost/Conv.
                    <Tooltip position="top" content="Auto-calculated: Meta Spend / Meta Conversions">
                      <HelpCircle className="w-3.5 h-3.5 opacity-60 cursor-pointer" />
                    </Tooltip>
                  </div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 text-purple-400`}>
                    {metaCpl}
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60 flex items-center gap-1">Ad Conversions</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.meta_leads || '0'}
                  </div>
                </div>

                <div className={`p-4 rounded-xl ${theme === 'white' ? 'bg-zinc-50' : 'bg-zinc-900/30'}`}>
                  <div className="text-xs opacity-60">ROAS (x)</div>
                  <div className={`text-xl font-bold font-heading tracking-tight mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.meta_roas || '0.0'}x
                  </div>
                </div>
              </div>

              {/* Meta Frequency Fatigue Alert */}
              <div className={`mt-4 flex items-center justify-between p-3 rounded-lg border text-sm ${
                (formState.meta_frequency || 0) > 3 
                  ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                  : 'bg-purple-500/5 border-purple-500/10'
              }`}>
                <span className="opacity-75 flex items-center gap-2">
                  Ad Frequency:
                  {(formState.meta_frequency || 0) > 3 && (
                    <Tooltip position="top" content="Meta Frequency over 3.0 represents risk of creative fatigue. Recommend updating creatives.">
                      <AlertCircle className="w-4 h-4 cursor-pointer text-red-400" />
                    </Tooltip>
                  )}
                </span>
                <span className="font-bold">{formState.meta_frequency || '0.00'}x</span>
              </div>
            </div>
          </div>

          {/* Web Analytics and SEO Conversion Rates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Conversion performance */}
            <div className={`p-6 rounded-2xl border ${
              theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'
            } flex flex-col justify-between`}>
              <div>
                <h3 className={`text-sm font-bold opacity-75 mb-4 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>Website Conversions</h3>
                <div className="text-4xl font-extrabold font-heading text-emerald-400 mt-2">{webConvRate}%</div>
                <p className="text-xs opacity-65 mt-2">Overall Web Conversion Rate (Leads / Sessions)</p>
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-850 flex justify-between text-sm">
                <span className="opacity-75">SEO Organic Leads:</span>
                <span className={`font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>{formState.seo_organic_leads || 0}</span>
              </div>
            </div>

            {/* GA4 Web Sessions */}
            <div className={`p-6 rounded-2xl border ${
              theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'
            } space-y-4`}>
              <h3 className={`text-sm font-bold opacity-75 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>Web Traffic (GA4)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs opacity-60">Sessions</div>
                  <div className={`text-xl font-bold font-heading mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {Number(formState.website_sessions || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-60">Bounce Rate</div>
                  <div className={`text-xl font-bold font-heading mt-1 ${
                    (formState.bounce_rate || 0) < 40 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {formState.bounce_rate || '0.0'}%
                  </div>
                </div>
              </div>
              <div className="pt-2 text-xs opacity-65 flex justify-between border-t border-zinc-850/40">
                <span>Avg Time on Site:</span>
                <span className="font-semibold">{formState.avg_time_on_site || 'N/A'}</span>
              </div>
            </div>

            {/* Landing Pages status */}
            <div className={`p-6 rounded-2xl border ${
              theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'
            } space-y-4`}>
              <h3 className={`text-sm font-bold opacity-75 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>Optimizations & A/B Tests</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs opacity-60">Landing Pages</div>
                  <div className={`text-xl font-bold font-heading mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.landing_pages_live || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs opacity-60">A/B Tests Live</div>
                  <div className={`text-xl font-bold font-heading mt-1 ${theme === 'white' ? 'text-zinc-850' : 'text-white'}`}>
                    {formState.active_ab_tests || 0}
                  </div>
                </div>
              </div>
              <div className="pt-2 text-xs opacity-65 border-t border-zinc-850/40 flex justify-between">
                <span>Top Converting Page:</span>
                <span className="font-semibold text-blue-400 truncate max-w-[150px]" title={formState.top_converting_page || 'None'}>
                  {formState.top_converting_page || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Social Media & Organic Analytics */}
          <div className={`p-6 rounded-2xl border ${
            theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'
          }`}>
            <h2 className={`font-bold font-heading mb-6 flex items-center gap-2 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
              Social Media Engagement
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <span className="text-xs opacity-60 block">Followers Total</span>
                <span className={`text-lg font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {Number(formState.followers_total || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs opacity-60 block">Impressions</span>
                <span className={`text-lg font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {Number(formState.social_impressions || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs opacity-60 block">Engagement Rate</span>
                <span className={`text-lg font-bold text-sky-400`}>
                  {formState.engagement_rate || '0.0'}%
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs opacity-60 block">Posts Published</span>
                <span className={`text-lg font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.social_posts_published || 0}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-xs opacity-60 block">Top Platform</span>
                <span className={`text-lg font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.top_platform || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Agency Deliverables Produced Section */}
          <div className={`p-6 rounded-2xl border ${
            theme === 'white' ? 'bg-white border-zinc-100' : 'bg-zinc-950/40 border-zinc-900/60'
          }`}>
            <h2 className={`font-bold font-heading mb-6 ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
              Agency Deliverables Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <FileText className="w-5 h-5 mx-auto mb-2 text-emerald-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Blogs Written</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.blogs_written || 0}
                </span>
                <span className="text-[10px] block opacity-40">Quality: {formState.avg_blog_quality || '0'}/5</span>
              </div>

              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <Globe className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Backlinks</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.backlinks_created || 0}
                </span>
              </div>

              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <Share2 className="w-5 h-5 mx-auto mb-2 text-purple-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Social Posts</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.social_posts_content_total || 0}
                </span>
              </div>

              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Creatives</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.creatives_produced || 0}
                </span>
              </div>

              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <Mail className="w-5 h-5 mx-auto mb-2 text-sky-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Emails</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.emails_automation || 0}
                </span>
              </div>

              <div className={`p-4 rounded-xl border text-center ${
                theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/20 border-zinc-900/50'
              }`}>
                <Target className="w-5 h-5 mx-auto mb-2 text-rose-400" />
                <span className="text-[11px] opacity-60 block uppercase font-semibold">Social Published</span>
                <span className={`text-xl font-bold font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
                  {formState.social_posts_published || 0}
                </span>
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
