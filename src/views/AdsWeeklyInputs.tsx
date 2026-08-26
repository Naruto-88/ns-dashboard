import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { 
  Megaphone,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Save,
  Sparkles,
  Globe,
  Share2,
  BarChart3,
  FileText
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getClients, Client, WeeklyAdsGrowth, getAdsGrowthData, updateAdsGrowthData, syncAdsGrowthData } from '../services/dataService';
import ClientSelector from '../components/ClientSelector';

export default function AdsWeeklyInputs() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs state
  const [formState, setFormState] = useState<Partial<WeeklyAdsGrowth>>({});

  // Generate list of weeks (Mondays)
  const weekOptions = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
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
    return list;
  }, []);

  useEffect(() => {
    if (weekOptions.length > 0 && !selectedWeek) {
      setSelectedWeek(weekOptions[0]);
    }
  }, [weekOptions, selectedWeek]);

  // Load clients list (Only those with Paid Ads active)
  useEffect(() => {
    async function loadClients() {
      try {
        const list = await getClients({ forAds: true });
        const adsClients = list.filter(c => c.has_paid_ads === true || c.keyword_tracking_enabled === false);
        setClients(adsClients);
        if (adsClients.length > 0) {
          setSelectedClient(adsClients[0].id);
        }
      } catch (err) {
        setError('Failed to load clients list.');
      } finally {
        setLoading(false);
      }
    }
    loadClients();
  }, []);

  // Fetch metrics whenever client or week is selected
  useEffect(() => {
    if (!selectedClient || !selectedWeek) return;
    async function loadWeeklyMetrics() {
      setLoading(true);
      setError(null);
      try {
        const list = await getAdsGrowthData(selectedClient);
        const record = list.find(r => r.week_start_date === selectedWeek);
        if (record) {
          setFormState(record);
        } else {
          // Initialize empty
          setFormState({
            week_start_date: selectedWeek,
            google_ads_spend: 0,
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
        setError('Failed to fetch data.');
      } finally {
        setLoading(false);
      }
    }
    loadWeeklyMetrics();
  }, [selectedClient, selectedWeek]);

  // Auto-fill trigger calling backend sync endpoint
  const handleAutoFill = async () => {
    if (!selectedClient || !selectedWeek) return;
    setSyncing(true);
    setError(null);
    try {
      const data = await syncAdsGrowthData(selectedClient, selectedWeek);
      if (data) {
        setFormState(data);
        setSuccessMsg('Successfully auto-filled metrics from GA4, GSC, and Ads platforms!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError('Auto-fill API sync failed.');
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
      const saved = await updateAdsGrowthData(selectedClient, {
        ...formState,
        week_start_date: selectedWeek
      });
      if (saved) {
        setSuccessMsg('Weekly paid marketing & agency activity metrics saved!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen space-y-6 ${theme === 'white' ? 'bg-[#f4f7f6]' : 'bg-[#081e26]'}`}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800/40 pb-4">
        <div>
          <h1 className={`text-2xl font-bold tracking-tight font-heading ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>
            Weekly Data Entry (Ads & Growth)
          </h1>
          <p className="text-zinc-500 text-sm">
            Manual metric updates and API Auto-Fill integration
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ClientSelector
            clients={clients}
            selectedId={selectedClient}
            onSelect={setSelectedClient}
          />

          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${theme === 'white' ? 'text-zinc-500' : 'text-emerald-400'}`} />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className={`px-3 py-1.5 text-sm rounded-lg border focus:ring-4 outline-none ${
                theme === 'white'
                  ? 'bg-white border-zinc-200 text-zinc-800 focus:ring-blue-500/5'
                  : 'bg-zinc-900 border-zinc-800 text-emerald-400 focus:ring-emerald-500/10'
              }`}
            >
              {weekOptions.map(week => (
                <option key={week} value={week}>Week of {week}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleAutoFill}
            disabled={syncing || !selectedClient}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
              theme === 'white'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-zinc-300'
                : 'bg-emerald-600 hover:bg-emerald-700 text-slate-900 disabled:bg-zinc-800'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Fetching...' : 'Auto-Fill from API'}
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

      {loading ? (
        <div className="py-20 text-center opacity-60 text-sm">Loading selected record...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Google Ads */}
            <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150 shadow-sm' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-4`}>
              <h3 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Google Paid Campaigns
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Spend ($)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_spend ?? ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_spend: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">ROAS (x)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_roas ?? ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_roas: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">CTR (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.google_ads_ctr ?? ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_ctr: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Quality Score (1-10)</label>
                  <input
                    type="number" max="10" min="0"
                    value={formState.google_ads_quality_score ?? ''}
                    onChange={(e) => setFormState({ ...formState, google_ads_quality_score: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Meta Ads */}
            <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150 shadow-sm' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-4`}>
              <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Meta (Facebook) Campaigns
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Spend ($)</label>
                  <input
                    type="number" step="any"
                    value={formState.meta_spend ?? ''}
                    onChange={(e) => setFormState({ ...formState, meta_spend: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Reach</label>
                  <input
                    type="number"
                    value={formState.meta_reach ?? ''}
                    onChange={(e) => setFormState({ ...formState, meta_reach: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Leads</label>
                  <input
                    type="number"
                    value={formState.meta_leads ?? ''}
                    onChange={(e) => setFormState({ ...formState, meta_leads: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs opacity-70 block mb-1">ROAS (x)</label>
                    <input
                      type="number" step="any"
                      value={formState.meta_roas ?? ''}
                      onChange={(e) => setFormState({ ...formState, meta_roas: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs opacity-70 block mb-1">Frequency</label>
                    <input
                      type="number" step="any"
                      value={formState.meta_frequency ?? ''}
                      onChange={(e) => setFormState({ ...formState, meta_frequency: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Web Analytics */}
            <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150 shadow-sm' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-4`}>
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Globe className="w-4 h-4" /> Web Analytics & SEO Leads
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Sessions</label>
                  <input
                    type="number"
                    value={formState.website_sessions ?? ''}
                    onChange={(e) => setFormState({ ...formState, website_sessions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Bounce Rate (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.bounce_rate ?? ''}
                    onChange={(e) => setFormState({ ...formState, bounce_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">SEO Organic Leads</label>
                  <input
                    type="number"
                    value={formState.seo_organic_leads ?? ''}
                    onChange={(e) => setFormState({ ...formState, seo_organic_leads: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Top Converting Page</label>
                  <input
                    type="text"
                    value={formState.top_converting_page ?? ''}
                    onChange={(e) => setFormState({ ...formState, top_converting_page: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Social Metrics */}
            <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-4`}>
              <h3 className="text-sm font-bold text-sky-400">Social KPIs</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Followers (Total)</label>
                  <input
                    type="number"
                    value={formState.followers_total ?? ''}
                    onChange={(e) => setFormState({ ...formState, followers_total: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Engagement (%)</label>
                  <input
                    type="number" step="any"
                    value={formState.engagement_rate ?? ''}
                    onChange={(e) => setFormState({ ...formState, engagement_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Impressions</label>
                  <input
                    type="number"
                    value={formState.social_impressions ?? ''}
                    onChange={(e) => setFormState({ ...formState, social_impressions: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Reach (Organic)</label>
                  <input
                    type="number"
                    value={formState.organic_social_reach ?? ''}
                    onChange={(e) => setFormState({ ...formState, organic_social_reach: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Agency Deliverables */}
            <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150' : 'bg-zinc-950/40 border-zinc-900/60'} space-y-4`}>
              <h3 className="text-sm font-bold text-emerald-400">Agency Output Activities</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs opacity-70 block mb-1">Blogs Written</label>
                  <input
                    type="number"
                    value={formState.blogs_written ?? ''}
                    onChange={(e) => setFormState({ ...formState, blogs_written: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Blog Quality (1-5)</label>
                  <input
                    type="number" max="5" min="0" step="any"
                    value={formState.avg_blog_quality ?? ''}
                    onChange={(e) => setFormState({ ...formState, avg_blog_quality: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Backlinks Built</label>
                  <input
                    type="number"
                    value={formState.backlinks_created ?? ''}
                    onChange={(e) => setFormState({ ...formState, backlinks_created: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Creatives Made</label>
                  <input
                    type="number"
                    value={formState.creatives_produced ?? ''}
                    onChange={(e) => setFormState({ ...formState, creatives_produced: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Emails Sent</label>
                  <input
                    type="number"
                    value={formState.emails_automation ?? ''}
                    onChange={(e) => setFormState({ ...formState, emails_automation: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs opacity-70 block mb-1">Social Content Total</label>
                  <input
                    type="number"
                    value={formState.social_posts_content_total ?? ''}
                    onChange={(e) => setFormState({ ...formState, social_posts_content_total: parseInt(e.target.value) || 0 })}
                    className="w-full px-2 py-2 text-sm bg-zinc-900 border border-zinc-800 text-white rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving || !selectedClient}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition shadow-lg ${
                theme === 'white'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-zinc-300'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-slate-900 disabled:bg-zinc-800'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Weekly Metrics'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
