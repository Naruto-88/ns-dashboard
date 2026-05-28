import { useState, useEffect, useMemo } from 'react';
import { 
  getKeywords, 
  getClients, 
  getWeeklyData, 
  syncWeeklyData,
  Client, 
  WeeklyData as IWeeklyData,
  Keyword,
  KeywordHistory,
  getKeywordHistory 
} from '../services/dataService';
import { supabase } from '../lib/supabase';
import { startOfWeek, endOfWeek, format, parseISO, subDays } from 'date-fns';
import { Save, AlertCircle, CheckCircle2, Download, Search, Info, ExternalLink, X, Maximize2 } from 'lucide-react';
import ClientSelector from '../components/ClientSelector';
import Tooltip from '../components/Tooltip';
import { useTheme } from '../contexts/ThemeContext';

export default function WeeklyData() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const [data, setData] = useState<Partial<IWeeklyData>>({});
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [keywordHistory, setKeywordHistory] = useState<KeywordHistory[]>([]);
  const [showKeywordList, setShowKeywordList] = useState<{ title: string, list: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [syncingMetrics, setSyncingMetrics] = useState(false);
  const [syncingAhrefs, setSyncingAhrefs] = useState(false);
  const [syncingAllAhrefs, setSyncingAllAhrefs] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<{
    total: number;
    current: number;
    statusList: { clientName: string; status: 'pending' | 'syncing' | 'success' | 'failed'; error?: string }[];
  } | null>(null);

  useEffect(() => {
    getClients().then(d => {
      setClients(d);
      if (d.length > 0) setSelectedClient(d[0].id);
    });
  }, []);

  const filteredClients = useMemo(() => {
    if (!clientSearch) return clients;
    const search = clientSearch.toLowerCase();
    return clients.filter(c => 
      c.name.toLowerCase().includes(search) || 
      (c.short_code && c.short_code.toLowerCase().includes(search))
    );
  }, [clients, clientSearch]);

  useEffect(() => {
    if (selectedClient && selectedWeek) {
      fetchData();
    }
  }, [selectedClient, selectedWeek]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: weeklyData, error } = await supabase
        .from('weekly_data')
        .select('*')
        .eq('client_id', selectedClient)
        .eq('week_start_date', selectedWeek)
        .maybeSingle();

      if (error) throw error;

      if (weeklyData) {
        setData(weeklyData as IWeeklyData);
      } else {
        setData({
          week_start_date: selectedWeek,
          gsc_clicks: 0,
          gsc_impressions: 0,
          gsc_ctr: 0,
          gsc_position: 0,
          ga4_traffic: 0,
          ga4_new_users: 0,
          ga4_returning_users: 0,
          ga4_organic_traffic: 0,
          leads_total: 0,
          leads_legit: 0,
          target_leads: 0,
          phone_calls: 0,
          ahrefs_dr: 0,
          ahrefs_backlinks: 0,
          ahrefs_ref_domains: 0,
          technical_score: 90,
          primary_issue_type: '',
          primary_insight: '',
          next_seo_action: '',
          weekly_activity_summary: '',
          pages_optimized: 0,
          blogs_published: 0,
          backlinks_built: 0,
          tech_fixes: 0,
          schema_updates: 0,
          internal_links: 0
        });
        // Auto-sync GSC/GA4/Leads API free metrics in the background
        autoSyncMetrics(selectedClient, selectedWeek);
      }

      // Fetch keywords for the week
      const kwHistory = await getKeywordHistory(selectedClient, {
        startDate: selectedWeek,
        endDate: format(endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      });
      
      const allKws = await getKeywords(selectedClient);
      setKeywords(allKws);

      // Join keyword queries to history
      const displayHistory = kwHistory.map(h => ({
        ...h,
        query: allKws.find(k => k.id === h.keyword_id)?.query || 'Unknown',
        url: allKws.find(k => k.id === h.keyword_id)?.landing_page_url || '-'
      }));
      setKeywordHistory(displayHistory as any);

      // Auto-calculate keyword stats for the data save
      const avg = displayHistory.length ? displayHistory.reduce((acc, curr) => acc + curr.position, 0) / displayHistory.length : 0;
      const top3 = displayHistory.filter(h => h.position <= 3).length;
      const top10 = displayHistory.filter(h => h.position <= 10).length;

      setData(prev => ({
        ...prev,
        tracked_keywords_avg_position: avg,
        top_3_count: top3,
        top_10_count: top10
      }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const autoSyncMetrics = async (clientId: string, weekStart: string) => {
    if (!clientId) return;
    setSyncingMetrics(true);
    setMessage(null);
    try {
      const startDate = weekStart;
      const endDate = format(endOfWeek(parseISO(weekStart), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      
      const res = await fetch(`/api/clients/${clientId}/live-metrics?startDate=${startDate}&endDate=${endDate}`);
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || 'Auto-sync failed');
      
      setData(prev => ({
        ...prev,
        gsc_clicks: dataRes.gsc_clicks ?? prev.gsc_clicks ?? 0,
        gsc_impressions: dataRes.gsc_impressions ?? prev.gsc_impressions ?? 0,
        gsc_ctr: dataRes.gsc_ctr ?? prev.gsc_ctr ?? 0,
        gsc_position: dataRes.gsc_position ?? prev.gsc_position ?? 0,
        ga4_traffic: dataRes.ga4_traffic ?? prev.ga4_traffic ?? 0,
        ga4_new_users: dataRes.ga4_new_users ?? prev.ga4_new_users ?? 0,
        ga4_returning_users: dataRes.ga4_returning_users ?? prev.ga4_returning_users ?? 0,
        ga4_organic_traffic: dataRes.ga4_organic_traffic ?? prev.ga4_organic_traffic ?? 0,
        phone_calls: dataRes.phone_calls ?? prev.phone_calls ?? 0,
        leads_total: dataRes.leads_total ?? prev.leads_total ?? 0,
        leads_legit: dataRes.leads_legit ?? prev.leads_legit ?? 0,
        top_3_count: dataRes.gsc_top3 ?? prev.top_3_count ?? 0,
        top_10_count: dataRes.gsc_top10 ?? prev.top_10_count ?? 0
      }));
      setMessage({ type: 'success', text: 'Free metrics auto-filled in background' });
    } catch (e: any) {
      console.error('Background Sync Error:', e);
    } finally {
      setSyncingMetrics(false);
    }
  };

  const handleAhrefsSync = async () => {
    if (!selectedClient) return;
    setSyncingAhrefs(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${selectedClient}/sync-ahrefs-data?date=${selectedWeek}`);
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || 'Ahrefs sync failed');
      
      setData(prev => ({
        ...prev,
        ahrefs_dr: dataRes.dr ?? prev.ahrefs_dr ?? 0,
        ahrefs_backlinks: dataRes.backlinks ?? prev.ahrefs_backlinks ?? 0,
        ahrefs_ref_domains: dataRes.ref_domains ?? prev.ahrefs_ref_domains ?? 0
      }));
      setMessage({ type: 'success', text: `Ahrefs data synchronised successfully${dataRes._simulated ? ' (simulated fallback)' : ''}` });
    } catch (e: any) {
      console.error('Ahrefs Sync Error:', e);
      setMessage({ type: 'error', text: `Ahrefs Sync failed: ${e.message}` });
    } finally {
      setSyncingAhrefs(false);
    }
  };

  const handleSyncAllAhrefs = async () => {
    if (clients.length === 0) return;
    setSyncingAllAhrefs(true);
    setMessage(null);
    
    // Initialize progress tracking
    const initialStatusList = clients.map(c => ({
      clientName: c.name,
      status: 'pending' as const
    }));
    
    setSyncAllProgress({
      total: clients.length,
      current: 0,
      statusList: initialStatusList
    });

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      for (let i = 0; i < clients.length; i++) {
        const client = clients[i];
        
        // Update status to syncing
        setSyncAllProgress(prev => {
          if (!prev) return null;
          const newList = [...prev.statusList];
          newList[i] = { ...newList[i], status: 'syncing' };
          return { ...prev, statusList: newList };
        });

        try {
          const res = await fetch(`/api/clients/${client.id}/sync-ahrefs-data?date=${selectedWeek}`);
          const dataRes = await res.json();
          
          if (!res.ok) {
            throw new Error(dataRes.error || 'Sync failed');
          }
          
          // Update status to success
          setSyncAllProgress(prev => {
            if (!prev) return null;
            const newList = [...prev.statusList];
            newList[i] = { ...newList[i], status: 'success' };
            return {
              ...prev,
              current: prev.current + 1,
              statusList: newList
            };
          });

          // If the synced client is the currently selected client, reload the local data view
          if (client.id === selectedClient) {
            setData(prev => ({
              ...prev,
              ahrefs_dr: dataRes.dr ?? prev.ahrefs_dr ?? 0,
              ahrefs_backlinks: dataRes.backlinks ?? prev.ahrefs_backlinks ?? 0,
              ahrefs_ref_domains: dataRes.ref_domains ?? prev.ahrefs_ref_domains ?? 0
            }));
          }

        } catch (err: any) {
          console.error(`Error syncing Ahrefs for ${client.name}:`, err);
          // Update status to failed
          setSyncAllProgress(prev => {
            if (!prev) return null;
            const newList = [...prev.statusList];
            newList[i] = { ...newList[i], status: 'failed', error: err.message };
            return {
              ...prev,
              current: prev.current + 1,
              statusList: newList
            };
          });
        }

        // Apply a strict 4-second gap delay between Ahrefs queries (except for the last one) to prevent 429 rate limiting
        if (i < clients.length - 1) {
          await sleep(4000);
        }
      }
      
      setMessage({ type: 'success', text: 'All clients Ahrefs sync completed successfully!' });
    } catch (e: any) {
      console.error('Batch Sync Error:', e);
      setMessage({ type: 'error', text: `Batch sync failed: ${e.message}` });
    } finally {
      setSyncingAllAhrefs(false);
    }
  };

  const handleSync = async () => {
    if (!selectedClient) return;
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/clients/${selectedClient}/sync-weekly-data?weekStart=${selectedWeek}`, { method: 'POST' });
      const dataRes = await res.json();
      if (!res.ok) throw new Error(dataRes.error || 'Sync failed');
      setData(prev => ({ ...prev, ...dataRes }));
      setMessage({ type: 'success', text: 'Data auto-filled from Google APIs' });
    } catch (e: any) {
      console.error('Sync Error:', e);
      setMessage({ type: 'error', text: `Sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await syncWeeklyData(selectedClient, {
        ...data,
        import_source: 'manual',
        imported_at: new Date().toISOString()
      });

      // Automatically sync next_seo_action into client_actions
      if (data.next_seo_action && data.next_seo_action.trim() !== '') {
        const { data: existingActions } = await supabase
          .from('client_actions')
          .select('id')
          .eq('client_id', selectedClient)
          .eq('action_text', data.next_seo_action.trim())
          .eq('status', 'pending');
          
        if (!existingActions || existingActions.length === 0) {
          await supabase
            .from('client_actions')
            .insert([{
              client_id: selectedClient,
              action_text: data.next_seo_action.trim(),
              status: 'pending',
              deadline: selectedWeek
            }]);
        }
      }

      setMessage({ type: 'success', text: 'Data saved successfully' });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof IWeeklyData, value: any) => {
    let parsedValue = Number(value);
    // Explicitly round integer-only fields to prevent PostgreSQL type crashes when entering decimal inputs
    if ([
      'ahrefs_dr', 
      'ahrefs_backlinks', 
      'ahrefs_ref_domains', 
      'gsc_clicks', 
      'gsc_impressions', 
      'ga4_traffic', 
      'ga4_new_users', 
      'ga4_returning_users', 
      'ga4_organic_traffic', 
      'leads_total', 
      'leads_legit', 
      'phone_calls'
    ].includes(field)) {
      parsedValue = Math.round(parsedValue) || 0;
    }
    setData(prev => ({ ...prev, [field]: parsedValue || 0 }));
  };

  const keywordStats = useMemo(() => {
    if (!keywordHistory.length) return { avg: 0, top3: [], top10: [] };
    
    const avg = keywordHistory.reduce((acc, curr) => acc + curr.position, 0) / keywordHistory.length;
    const top3 = keywordHistory.filter(h => h.position <= 3);
    const top10 = keywordHistory.filter(h => h.position <= 10);
    
    return { avg, top3, top10 };
  }, [keywordHistory]);

  const sections = [
    {
      title: 'Search & Traffic Performance',
      fields: [
        { label: 'GSC Clicks', key: 'gsc_clicks', tooltip: 'Total organic clicks from Google Search Console for this week.' },
        { label: 'GSC Impressions', key: 'gsc_impressions', tooltip: 'Total organic search impressions from Google Search Console.' },
        { label: 'GSC CTR (%)', key: 'gsc_ctr', tooltip: 'Average click-through rate percentage from Google Search Console.' },
        { label: 'GSC Avg Position', key: 'gsc_position', tooltip: 'Average organic ranking position from Google Search Console.' },
        { label: 'GA4 Traffic (Sessions)', key: 'ga4_traffic', tooltip: 'Total web sessions from Google Analytics 4.' },
        { label: 'GA4 New Users', key: 'ga4_new_users', tooltip: 'New user count from Google Analytics 4.' },
        { label: 'GA4 Returning Users', key: 'ga4_returning_users', tooltip: 'Returning user count from Google Analytics 4.' },
        { label: 'GA4 Organic Search Sessions', key: 'ga4_organic_traffic', tooltip: 'Organic search sessions from Google Analytics 4.' },
        { label: 'Phone Calls', key: 'phone_calls', tooltip: 'Total click-to-call events matching phone call patterns from GA4.' }
      ]
    },
    {
      title: 'Leads & Conversions',
      fields: [
        { label: 'Total Leads', key: 'leads_total', tooltip: 'Total goal completions (raw count).' },
        { label: 'Legit Leads', key: 'leads_legit', tooltip: 'Filtered, high-intent quality leads.' },
        { label: 'Target Leads', key: 'target_leads', tooltip: 'The lead target set for this client.' },
      ]
    },
    {
      title: 'Activity & Technical',
      fields: [
        { label: 'Pages Optimised', key: 'pages_optimized', tooltip: 'Existing pages updated for SEO.' },
        { label: 'Blogs Published', key: 'blogs_published', tooltip: 'New blog posts or articles created.' },
        { label: 'Backlinks Built', key: 'backlinks_built', tooltip: 'Inbound links acquired this week.' },
        { label: 'Technical Fixes', key: 'tech_fixes', tooltip: 'Structural/code SEO issues resolved.' },
        { label: 'Schema Updates', key: 'schema_updates', tooltip: 'Rich snippet/structured data implementations.' },
        { label: 'Internal Links', key: 'internal_links', tooltip: 'New relevant internal connections made.' },
        { label: 'Tech Score', key: 'technical_score', tooltip: 'Audited technical health score (0-100).' },
      ]
    }
  ];

  const updateTextField = (field: keyof IWeeklyData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-[40px] border backdrop-blur-xl relative z-50 ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="flex-1">
          <h2 className={`text-2xl font-black font-heading uppercase tracking-tighter italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Weekly Data Hub</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
              theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'
            }`}>
              Period: {format(parseISO(selectedWeek), 'MMM d')} - {format(endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 }), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ml-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Surveillance Target</label>
            <ClientSelector 
              clients={clients} 
              selectedId={selectedClient} 
              onSelect={setSelectedClient} 
            />
          </div>
          <div className="flex flex-col">
            <label className={`text-[9px] font-black uppercase tracking-widest mb-1.5 ml-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Week Commencement</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => {
                if (e.target.value) {
                  const date = parseISO(e.target.value);
                  const monday = startOfWeek(date, { weekStartsOn: 1 });
                  setSelectedWeek(format(monday, 'yyyy-MM-dd'));
                } else {
                  setSelectedWeek('');
                }
              }}
              className={`px-4 py-2.5 border rounded-2xl text-xs font-black outline-none transition-all uppercase ${
                theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500'
              }`}
            />
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing || !selectedClient}
            className={`mt-5 flex items-center gap-2 px-6 py-2.5 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${
              theme === 'white' ? 'bg-[#76c9be]/10 border-[#76c9be]/20 text-[#082a36] hover:bg-[#76c9be]/20' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'
            }`}
          >
            {syncing ? 'Scanning...' : 'Auto-fill Intelligence'}
          </button>
          <button 
            onClick={handleSyncAllAhrefs}
            disabled={syncingAllAhrefs || clients.length === 0}
            className={`mt-5 flex items-center gap-2 px-6 py-2.5 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${
              theme === 'white' ? 'bg-[#f47b20]/10 border-[#f47b20]/20 text-[#f47b20] hover:bg-[#f47b20]/20' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'
            }`}
            title="Sync Ahrefs authority metrics (DR, Backlinks, Ref Domains) sequentially for all active clients"
          >
            {syncingAllAhrefs ? 'Syncing...' : 'Sync All Ahrefs'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading data...</div>
      ) : (
        <div className="space-y-8">
            <div className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-6 ${
              theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-xl' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <h3 className={`text-lg font-black font-heading border-b pb-4 flex items-center justify-between uppercase tracking-tight ${
                theme === 'white' ? 'text-[#082a36] border-[#163f4d]/5' : 'text-white border-white/5'
              }`}>
                Visibility Index (Focus Keywords)
                <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                  theme === 'white' ? 'bg-[#76c9be]/5 text-[#607a80] border-[#163f4d]/5' : 'bg-zinc-800 text-zinc-500 border-white/5'
                }`}>Global Snapshots</span>
              </h3>
              <div className="grid grid-cols-3 gap-8">
                <div className={`p-6 rounded-3xl border transition-all ${
                  theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5 hover:border-[#76c9be]' : 'bg-zinc-800/50 border-white/5 hover:border-blue-500/20'
                }`}>
                  <Tooltip content="Average rank of all tracked keywords for this period." className="w-full">
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-2 text-center ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Avg Position</p>
                    <p className={`text-3xl font-black text-center font-heading font-mono tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{keywordStats.avg.toFixed(1)}</p>
                  </Tooltip>
                </div>
                <button 
                  onClick={() => setShowKeywordList({ title: 'Top 3 Visibility', list: keywordStats.top3 })}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer group relative ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#76c9be]/20 hover:bg-[#76c9be]/10 hover:border-[#76c9be]/40' : 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                  }`}
                >
                  <Tooltip content="Total keywords ranking in top 3 positions">
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-2 text-center ${theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500'}`}>Top 3 Index</p>
                    <p className={`text-3xl font-black font-heading text-center flex items-center justify-center gap-3 ${theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-400'}`}>
                      {keywordStats.top3.length}
                      <Maximize2 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </Tooltip>
                </button>
                <button 
                  onClick={() => setShowKeywordList({ title: 'Top 10 Reach', list: keywordStats.top10 })}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer group relative ${
                    theme === 'white' ? 'bg-[#f47b20]/5 border-[#f47b20]/20 hover:bg-[#f47b20]/10 hover:border-[#f47b20]/40' : 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30'
                  }`}
                >
                  <Tooltip content="Total keywords ranking in top 10 positions">
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-2 text-center ${theme === 'white' ? 'text-[#f47b20]' : 'text-blue-500'}`}>Top 10 Reach</p>
                    <p className={`text-3xl font-black font-heading text-center flex items-center justify-center gap-3 ${theme === 'white' ? 'text-[#f47b20]' : 'text-blue-400'}`}>
                      {keywordStats.top10.length}
                      <Maximize2 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </Tooltip>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {sections.map((section, idx) => (
                <div key={idx} className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-6 ${
                  theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-xl' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <h3 className={`text-lg font-black font-heading border-b pb-4 uppercase tracking-tight ${
                    theme === 'white' ? 'text-[#082a36] border-[#163f4d]/5' : 'text-white border-white/5'
                  }`}>{section.title}</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {section.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 relative ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                          {field.label}
                          <Tooltip content={field.tooltip}>
                            <Info size={12} className="text-zinc-700 cursor-help hover:text-blue-500 transition-colors" />
                          </Tooltip>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={data[field.key as keyof IWeeklyData] === undefined ? '' : data[field.key as keyof IWeeklyData]}
                          onChange={(e) => updateField(field.key as keyof IWeeklyData, e.target.value)}
                          className={`w-full px-5 py-3 border rounded-2xl text-md font-black outline-none transition-all font-mono ${
                            theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Ahrefs Authority Card */}
              <div className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-6 ${
                theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-xl' : 'bg-zinc-900/50 border-white/5'
              }`}>
                <h3 className={`text-lg font-black font-heading border-b pb-4 flex items-center justify-between uppercase tracking-tight ${
                  theme === 'white' ? 'text-[#082a36] border-[#163f4d]/5' : 'text-white border-white/5'
                }`}>
                  <span>Ahrefs Authority</span>
                  <Tooltip content="Syncing Ahrefs data queries the Ahrefs API Explorer and consumes API credits (metered/cost-sensitive). Only sync on-demand.">
                    <button
                      type="button"
                      onClick={handleAhrefsSync}
                      disabled={syncingAhrefs}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                        theme === 'white' 
                          ? 'bg-[#76c9be]/10 border-[#76c9be]/20 text-[#082a36] hover:bg-[#76c9be]/20' 
                          : 'bg-zinc-800 border-white/5 text-white hover:bg-zinc-700'
                      }`}
                    >
                      {syncingAhrefs ? 'Syncing...' : 'Sync Ahrefs'}
                    </button>
                  </Tooltip>
                </h3>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 relative ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                      Domain Rating (DR)
                      <Tooltip content="Ahrefs Domain Rating (DR) score (0-100).">
                        <Info size={12} className="text-zinc-700 cursor-help hover:text-blue-500 transition-colors" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={data.ahrefs_dr === undefined ? '' : data.ahrefs_dr}
                      onChange={(e) => updateField('ahrefs_dr', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-md font-black outline-none transition-all font-mono ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 relative ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                      Backlinks
                      <Tooltip content="Total number of external backlinks pointing to this website domain.">
                        <Info size={12} className="text-zinc-700 cursor-help hover:text-blue-500 transition-colors" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={data.ahrefs_backlinks === undefined ? '' : data.ahrefs_backlinks}
                      onChange={(e) => updateField('ahrefs_backlinks', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-md font-black outline-none transition-all font-mono ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-2 relative ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                      Referring Domains
                      <Tooltip content="Total number of unique domains linking to this website.">
                        <Info size={12} className="text-zinc-700 cursor-help hover:text-blue-500 transition-colors" />
                      </Tooltip>
                    </label>
                    <input
                      type="number"
                      value={data.ahrefs_ref_domains === undefined ? '' : data.ahrefs_ref_domains}
                      onChange={(e) => updateField('ahrefs_ref_domains', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-md font-black outline-none transition-all font-mono ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-8 ${
              theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-xl' : 'bg-zinc-900/50 border-white/5'
            }`}>
               <h3 className={`text-lg font-black font-heading border-b pb-4 flex items-center gap-3 uppercase tracking-tight ${
                theme === 'white' ? 'text-[#082a36] border-[#163f4d]/5' : 'text-white border-white/5'
              }`}>
                <Search size={22} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
                Strategic Diagnostics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Threat Assessment (Issue Type)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Technical Debt, Content Gap..."
                      value={data.primary_issue_type || ''}
                      onChange={(e) => updateTextField('primary_issue_type', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-sm font-bold outline-none transition-all placeholder:text-[#607a80]/50 uppercase ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Intelligence Insight</label>
                    <textarea 
                      placeholder="Share a key performance discovery..."
                      value={data.primary_insight || ''}
                      onChange={(e) => updateTextField('primary_insight', e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none transition-all placeholder:text-[#607a80]/50 h-28 resize-none uppercase tracking-tight ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Correction Directive (Next Action)</label>
                    <textarea 
                      placeholder="e.g. Publish pillar page for keyword X..."
                      value={data.next_seo_action || ''}
                      onChange={(e) => updateTextField('next_seo_action', e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none transition-all placeholder:text-[#607a80]/50 h-28 resize-none uppercase tracking-tight ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Activity Log</label>
                    <textarea 
                      placeholder="Describe what was done this week..."
                      value={data.weekly_activity_summary || ''}
                      onChange={(e) => updateTextField('weekly_activity_summary', e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none transition-all placeholder:text-[#607a80]/50 h-28 resize-none uppercase tracking-tight ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/5' : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

          <div className={`flex items-center justify-between p-8 rounded-[40px] border shadow-2xl transition-all ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-xl' : 'bg-zinc-950 border-white/5'
          }`}>
            <div className="flex items-center gap-4 text-sm font-medium">
              {message && (
                <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl uppercase text-[10px] font-black tracking-widest ${message.type === 'success' ? (theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20') : 'bg-red-500/10 text-red-500 border border-red-500/20'} animate-in fade-in slide-in-from-left-2 overflow-hidden`}>
                  {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {message.text}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSave}
                disabled={saving}
                className={`flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 active:scale-95 ${
                  theme === 'white' ? 'bg-[#f47b20] text-white shadow-[#f47b20]/20 hover:bg-[#f47b20]/90' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                }`}
              >
                {saving ? 'Encrypting...' : <><Save size={20} /> Commit Weekly Intel</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showKeywordList && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${
             theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900 border-white/5'
          }`}>
            <div className={`p-8 border-b flex items-center justify-between backdrop-blur-xl sticky top-0 z-10 ${
              theme === 'white' ? 'bg-zinc-50/80 border-zinc-100' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <div>
                <h3 className={`text-xl font-black font-heading uppercase tracking-tight italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{showKeywordList.title}</h3>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>{showKeywordList.list.length} target matches identified</p>
              </div>
              <button 
                onClick={() => setShowKeywordList(null)}
                className={`p-3 rounded-2xl transition-all ${
                  theme === 'white' ? 'bg-[#76c9be]/10 text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/20' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b text-[9px] font-black uppercase tracking-widest ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5 text-[#607a80]' : 'bg-zinc-950/50 border-white/5 text-zinc-500'
                  }`}>
                    <th className="px-8 py-5">Target Query</th>
                    <th className="px-6 py-5 text-center">Precise Rank</th>
                    <th className="px-8 py-5">Assigned Asset (URL)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'white' ? 'divide-[#163f4d]/5' : 'divide-white/5'}`}>
                  {showKeywordList.list.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center text-zinc-400 font-black uppercase tracking-widest text-xs">No visibility matches found in this sector.</td>
                    </tr>
                  ) : showKeywordList.list.map((kw, i) => (
                    <tr key={i} className={`transition-colors group ${theme === 'white' ? 'hover:bg-[#76c9be]/5' : 'hover:bg-white/5'}`}>
                      <td className={`px-8 py-4 font-black font-heading transition-colors uppercase text-xs ${theme === 'white' ? 'text-[#082a36] group-hover:text-[#76c9be]' : 'text-white group-hover:text-blue-400'}`}>{kw.query}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          kw.position <= 3 ? (theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20') : (theme === 'white' ? 'bg-[#f47b20]/10 text-[#f47b20] border border-[#f47b20]/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20')
                        }`}>
                          {kw.position.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <a 
                          href={kw.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 text-[10px] cursor-pointer font-black grayscale hover:grayscale-0 transition-all uppercase tracking-tighter ${theme === 'white' ? 'text-[#607a80] hover:text-[#76c9be]' : 'text-zinc-500 hover:text-blue-400'}`}
                        >
                          <span className="truncate max-w-[180px]">{kw.url}</span>
                          <ExternalLink size={12} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`p-8 border-t flex justify-end ${
              theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-950 border-white/5'
            }`}>
              <button 
                onClick={() => setShowKeywordList(null)}
                className={`px-10 py-3 rounded-2xl font-black text-xs transition-all uppercase tracking-widest ${
                   theme === 'white' ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90' : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                Exit View
              </button>
            </div>
          </div>
        </div>
      )}

      {syncAllProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`rounded-[40px] w-full max-w-2xl shadow-2xl overflow-hidden border animate-in zoom-in-95 duration-200 ${
             theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900 border-white/5'
          }`}>
            <div className={`p-8 border-b flex items-center justify-between backdrop-blur-xl sticky top-0 z-10 ${
              theme === 'white' ? 'bg-zinc-50/80 border-zinc-100' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <div>
                <h3 className={`text-xl font-black font-heading uppercase tracking-tight italic flex items-center gap-2.5 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                  Batch Ahrefs Sync
                  <span className={`px-2 py-0.5 text-[8px] font-black border rounded-md uppercase tracking-widest animate-pulse ${
                    syncingAllAhrefs 
                      ? (theme === 'white' ? 'bg-[#f47b20]/10 text-[#f47b20] border-[#f47b20]/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20')
                      : (theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20')
                  }`}>
                    {syncingAllAhrefs ? 'Rate-Limit Sentinel Active (4s Gap)' : 'Complete'}
                  </span>
                </h3>
                <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                  Syncing Ahrefs v3 stats for all client nodes sequentially
                </p>
              </div>
              {!syncingAllAhrefs && (
                <button 
                  onClick={() => setSyncAllProgress(null)}
                  className={`p-3 rounded-2xl transition-all ${
                    theme === 'white' ? 'bg-[#76c9be]/10 text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/20' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Progress Bar & Summary Stats */}
            <div className="p-8 space-y-4">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest">
                <span className={theme === 'white' ? 'text-zinc-500' : 'text-zinc-400'}>
                  Overall Progress ({syncAllProgress.current} / {syncAllProgress.total})
                </span>
                <span className={theme === 'white' ? 'text-[#082a36]' : 'text-white'}>
                  {Math.round((syncAllProgress.current / syncAllProgress.total) * 100)}%
                </span>
              </div>
              <div className={`h-3 rounded-full overflow-hidden ${theme === 'white' ? 'bg-zinc-100' : 'bg-zinc-950'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${
                    theme === 'white' ? 'bg-[#f47b20]' : 'bg-blue-600'
                  }`}
                  style={{ width: `${(syncAllProgress.current / syncAllProgress.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Client Status List */}
            <div className="max-h-[40vh] overflow-y-auto px-8 pb-8 space-y-3">
              {syncAllProgress.statusList.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                    item.status === 'syncing' 
                      ? (theme === 'white' ? 'bg-[#f47b20]/5 border-[#f47b20]/30 shadow-md' : 'bg-blue-500/5 border-blue-500/20 shadow-md')
                      : item.status === 'success'
                        ? (theme === 'white' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-500/5 border-emerald-500/10')
                        : item.status === 'failed'
                          ? (theme === 'white' ? 'bg-red-500/5 border-red-500/10' : 'bg-red-500/5 border-red-500/10')
                          : (theme === 'white' ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-800/20 border-white/5 opacity-50')
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-xs font-black uppercase tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                      {item.clientName}
                    </span>
                    {item.error && (
                      <span className="text-[9px] text-red-400 font-bold uppercase tracking-tight mt-0.5">
                        Error: {item.error}
                      </span>
                    )}
                  </div>

                  <div>
                    {item.status === 'pending' && (
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        theme === 'white' ? 'bg-zinc-100 text-zinc-400 border border-zinc-200' : 'bg-zinc-800 text-zinc-500 border border-white/5'
                      }`}>
                        Pending
                      </span>
                    )}
                    {item.status === 'syncing' && (
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest animate-pulse ${
                        theme === 'white' ? 'bg-[#f47b20]/10 text-[#f47b20] border border-[#f47b20]/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}>
                        Syncing...
                      </span>
                    )}
                    {item.status === 'success' && (
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        theme === 'white' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        Success
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                        theme === 'white' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        Failed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-8 border-t flex justify-end ${
              theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-950 border-white/5'
            }`}>
              <button 
                onClick={() => setSyncAllProgress(null)}
                disabled={syncingAllAhrefs}
                className={`px-10 py-3 rounded-2xl font-black text-xs transition-all uppercase tracking-widest disabled:opacity-50 ${
                   theme === 'white' ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90' : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {syncingAllAhrefs ? 'Syncing...' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
