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
          leads_total: 0,
          leads_legit: 0,
          target_leads: 0,
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
      setMessage({ type: 'success', text: 'Data saved successfully' });
      fetchData();
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof IWeeklyData, value: any) => {
    setData(prev => ({ ...prev, [field]: Number(value) || 0 }));
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
        { label: 'Pages Optimized', key: 'pages_optimized', tooltip: 'Existing pages updated for SEO.' },
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
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-8 rounded-[40px] border backdrop-blur-xl relative z-50 ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="flex-1">
          <h2 className={`text-2xl font-black uppercase tracking-tighter italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Weekly Data Hub</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-black px-3 py-1 bg-blue-600/10 text-blue-500 rounded-full uppercase tracking-widest border border-blue-500/20">
              Period: {format(parseISO(selectedWeek), 'MMM d')} - {format(endOfWeek(parseISO(selectedWeek), { weekStartsOn: 1 }), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Surveillance Target</label>
            <ClientSelector 
              clients={clients} 
              selectedId={selectedClient} 
              onSelect={setSelectedClient} 
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Week Commencement</label>
            <input
              type="date"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className={`px-4 py-2.5 border rounded-2xl text-xs font-black outline-none focus:border-blue-500 w-40 transition-all uppercase ${
                theme === 'white' ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-800 border-white/5 text-white'
              }`}
            />
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing || !selectedClient}
            className={`mt-5 flex items-center gap-2 px-6 py-2.5 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl disabled:opacity-50 ${
              theme === 'white' ? 'bg-zinc-100 border-zinc-200 text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'
            }`}
          >
            {syncing ? 'Scanning...' : 'Auto-fill Intelligence'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 font-medium">Loading data...</div>
      ) : (
        <div className="space-y-8">
            <div className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-6 ${
              theme === 'white' ? 'bg-white border-zinc-200 shadow-xl' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <h3 className={`text-lg font-black border-b pb-4 flex items-center justify-between uppercase tracking-tight ${
                theme === 'white' ? 'text-zinc-900 border-zinc-100' : 'text-white border-white/5'
              }`}>
                Visibility Index (Focus Keywords)
                <span className={`text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                  theme === 'white' ? 'bg-zinc-50 text-zinc-500 border-zinc-100' : 'bg-zinc-800 text-zinc-500 border-white/5'
                }`}>Global Snapshots</span>
              </h3>
              <div className="grid grid-cols-3 gap-8">
                <div className={`p-6 rounded-3xl border transition-all ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-100 hover:border-blue-500' : 'bg-zinc-800/50 border-white/5 hover:border-blue-500/20'
                }`}>
                  <Tooltip content="Average rank of all tracked keywords for this period." className="w-full">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 text-center">Avg Position</p>
                    <p className={`text-3xl font-black text-center font-mono tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{keywordStats.avg.toFixed(1)}</p>
                  </Tooltip>
                </div>
                <button 
                  onClick={() => setShowKeywordList({ title: 'Top 3 Visibility', list: keywordStats.top3 })}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer group relative ${
                    theme === 'white' ? 'bg-emerald-50 border-emerald-100 hover:border-emerald-300' : 'bg-emerald-500/5 border-emerald-500/10 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                  }`}
                >
                  <Tooltip content="Total keywords ranking in top 3 positions">
                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-2 text-center">Top 3 Index</p>
                    <p className="text-3xl font-black text-emerald-400 text-center flex items-center justify-center gap-3">
                      {keywordStats.top3.length}
                      <Maximize2 size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </p>
                  </Tooltip>
                </button>
                <button 
                  onClick={() => setShowKeywordList({ title: 'Top 10 Reach', list: keywordStats.top10 })}
                  className={`p-6 rounded-3xl border transition-all cursor-pointer group relative ${
                    theme === 'white' ? 'bg-blue-50 border-blue-100 hover:border-blue-300' : 'bg-blue-500/5 border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30'
                  }`}
                >
                  <Tooltip content="Total keywords ranking in top 10 positions">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2 text-center">Top 10 Reach</p>
                    <p className="text-3xl font-black text-blue-400 text-center flex items-center justify-center gap-3">
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
                  theme === 'white' ? 'bg-white border-zinc-200 shadow-xl' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <h3 className={`text-lg font-black border-b pb-4 uppercase tracking-tight ${
                    theme === 'white' ? 'text-zinc-900 border-zinc-100' : 'text-white border-white/5'
                  }`}>{section.title}</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {section.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2 relative ml-1">
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
                          className={`w-full px-5 py-3 border rounded-2xl text-md font-black outline-none focus:border-blue-500 focus:ring-4 transition-all font-mono ${
                            theme === 'white' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:ring-blue-500/5' : 'bg-zinc-800 border-white/5 text-white focus:ring-blue-500/10'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={`p-8 rounded-[40px] border backdrop-blur-xl space-y-8 ${
              theme === 'white' ? 'bg-white border-zinc-200 shadow-xl' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <h3 className={`text-lg font-black border-b pb-4 flex items-center gap-3 uppercase tracking-tight ${
                theme === 'white' ? 'text-zinc-900 border-zinc-100' : 'text-white border-white/5'
              }`}>
                <Search size={22} className="text-blue-500" />
                Strategic Diagnostics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Threat Assessment (Issue Type)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Technical Debt, Content Gap..."
                      value={data.primary_issue_type || ''}
                      onChange={(e) => updateTextField('primary_issue_type', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 transition-all placeholder:text-zinc-700 uppercase ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:ring-blue-500/5' : 'bg-zinc-800 border-white/5 text-white focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Intelligence Insight</label>
                    <textarea 
                      placeholder="Share a key performance discovery..."
                      value={data.primary_insight || ''}
                      onChange={(e) => updateTextField('primary_insight', e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 transition-all placeholder:text-zinc-700 h-28 resize-none uppercase tracking-tight ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:ring-blue-500/5' : 'bg-zinc-800 border-white/5 text-white focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Correction Directive (Next Action)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Publish pillar page for keyword X..."
                      value={data.next_seo_action || ''}
                      onChange={(e) => updateTextField('next_seo_action', e.target.value)}
                      className={`w-full px-5 py-3 border rounded-2xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 transition-all placeholder:text-zinc-700 uppercase ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:ring-blue-500/5' : 'bg-zinc-800 border-white/5 text-white focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Activity Log</label>
                    <textarea 
                      placeholder="Describe what was done this week..."
                      value={data.weekly_activity_summary || ''}
                      onChange={(e) => updateTextField('weekly_activity_summary', e.target.value)}
                      className={`w-full px-5 py-4 border rounded-2xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 transition-all placeholder:text-zinc-700 h-28 resize-none uppercase tracking-tight ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-100 text-zinc-900 focus:ring-blue-500/5' : 'bg-zinc-800 border-white/5 text-white focus:ring-blue-500/10'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

          <div className={`flex items-center justify-between p-8 rounded-[40px] border shadow-2xl transition-all ${
            theme === 'white' ? 'bg-zinc-50 border-zinc-200 shadow-xl' : 'bg-zinc-950 border-white/5'
          }`}>
            <div className="flex items-center gap-4 text-sm font-medium">
              {message && (
                <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl uppercase text-[10px] font-black tracking-widest ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'} animate-in fade-in slide-in-from-left-2 overflow-hidden`}>
                  {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  {message.text}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 disabled:opacity-50 active:scale-95"
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
             theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/5'
          }`}>
            <div className={`p-8 border-b flex items-center justify-between backdrop-blur-xl sticky top-0 z-10 ${
              theme === 'white' ? 'bg-zinc-50/80 border-zinc-100' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <div>
                <h3 className={`text-xl font-black uppercase tracking-tight italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{showKeywordList.title}</h3>
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">{showKeywordList.list.length} target matches identified</p>
              </div>
              <button 
                onClick={() => setShowKeywordList(null)}
                className={`p-3 rounded-2xl transition-all ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={`border-b text-[9px] font-black text-zinc-500 uppercase tracking-widest ${
                    theme === 'white' ? 'bg-zinc-50/50 border-zinc-100 text-zinc-400' : 'bg-zinc-950/50 border-white/5'
                  }`}>
                    <th className="px-8 py-5">Target Query</th>
                    <th className="px-6 py-5 text-center">Precise Rank</th>
                    <th className="px-8 py-5">Assigned Asset (URL)</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-white/5'}`}>
                  {showKeywordList.list.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center text-zinc-400 font-black uppercase tracking-widest text-xs">No visibility matches found in this sector.</td>
                    </tr>
                  ) : showKeywordList.list.map((kw, i) => (
                    <tr key={i} className={`transition-colors group ${theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                      <td className={`px-8 py-4 font-bold transition-colors uppercase text-xs ${theme === 'white' ? 'text-zinc-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-400'}`}>{kw.query}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                          kw.position <= 3 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {kw.position.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-8 py-4">
                        <a 
                          href={kw.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-blue-400 cursor-pointer font-black grayscale hover:grayscale-0 transition-all uppercase tracking-tighter"
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
              theme === 'white' ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-950 border-white/5'
            }`}>
              <button 
                onClick={() => setShowKeywordList(null)}
                className={`px-10 py-3 rounded-2xl font-black text-xs transition-all uppercase tracking-widest ${
                   theme === 'white' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                Exit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
