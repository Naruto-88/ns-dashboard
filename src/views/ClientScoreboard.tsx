import { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  CheckCircle2, 
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Target,
  Maximize2,
  X,
  FileText,
  Shield
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import { getClients, Client, getWeeklyData, WeeklyData, getKeywords, KeywordHistory, getKeywordHistory, getLiveMetrics } from '../services/dataService';
import { format, startOfWeek, subWeeks, startOfMonth, subMonths, endOfMonth, endOfWeek, parseISO } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

export default function ClientScoreboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<Record<string, WeeklyData[]>>({});
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [showFullReport, setShowFullReport] = useState<any | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const clientList = await getClients();
    setClients(clientList);

    const today = new Date();
    const currentStart = subWeeks(today, 1);
    const currentEnd = today;
    const previousStart = subWeeks(today, 2);
    const previousEnd = subWeeks(today, 1);

    const currentRange = {
      startDate: format(currentStart, 'yyyy-MM-dd'),
      endDate: format(currentEnd, 'yyyy-MM-dd')
    };
    
    const previousRange = {
      startDate: format(previousStart, 'yyyy-MM-dd'),
      endDate: format(previousEnd, 'yyyy-MM-dd')
    };

    const dataMap: Record<string, any> = {};
    const weeklyDataMap: Record<string, WeeklyData[]> = {};

    await Promise.all(clientList.map(async (client) => {
      const [liveCurrent, livePrevious, dbData] = await Promise.all([
        getLiveMetrics(client.id, currentRange),
        getLiveMetrics(client.id, previousRange),
        getWeeklyData(client.id, { startDate: format(subMonths(today, 6), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') })
      ]);
      
      dataMap[client.id] = { liveCurrent, livePrevious };
      weeklyDataMap[client.id] = dbData;
    }));

    setAllData(weeklyDataMap as any);
    (window as any).__liveData = dataMap; // Store for useMemo
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [viewMode]);

  const clientStats = useMemo(() => {
    const liveData = (window as any).__liveData || {};
    return clients.map(client => {
      const data = allData[client.id] || [];
      const latestDb = data[0];
      const { liveCurrent, livePrevious } = liveData[client.id] || {};

      // Merge DB data with Live data
      const latest = {
        ...(latestDb || {}),
        gsc_clicks: liveCurrent?.gsc_clicks ?? latestDb?.gsc_clicks ?? 0,
        gsc_position: liveCurrent?.gsc_position ?? latestDb?.gsc_position ?? 0,
        ga4_traffic: liveCurrent?.ga4_traffic ?? latestDb?.ga4_traffic ?? 0,
      };

  const getHealth = () => {
    const score = latest.technical_score || 0;
    if (score < 70) return { status: 'Critical', color: 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]' };
    if (score < 85) return { status: 'Watch', color: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' };
    return { status: 'Healthy', color: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]' };
  };

      const calculateChange = (curr: number, prev: number) => {
        if (!prev) return 0;
        return ((curr - prev) / prev) * 100;
      };

      const trafficChange = liveCurrent && livePrevious ? calculateChange(liveCurrent.ga4_traffic, livePrevious.ga4_traffic) : 0;
      const leadsChange = latestDb && data[1] ? calculateChange(latestDb.leads_total, data[1].leads_total) : 0;

      return {
        ...client,
        latest,
        previous: data[1],
        health: getHealth(),
        trafficChange,
        leadsChange,
        trend: liveCurrent && livePrevious ? (liveCurrent.gsc_clicks >= livePrevious.gsc_clicks ? 'up' : 'down') : 'stable'
      };
    });
  }, [clients, allData, loading]);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading scoreboard...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-50">
        <div>
          <h2 className={`text-2xl font-bold uppercase tracking-tight ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Client Scoreboard</h2>
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mt-1">Property Performance Readiness</p>
        </div>
        <div className={`flex rounded-2xl p-1.5 shadow-xl backdrop-blur-xl h-fit border ${
          theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <button 
            onClick={() => setViewMode('weekly')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              viewMode === 'weekly' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : theme === 'white' 
                  ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                  : 'text-zinc-500 hover:text-white'
            }`}
          >
            Weekly Focus
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
              viewMode === 'monthly' 
                ? 'bg-blue-600 text-white shadow-lg' 
                : theme === 'white' 
                  ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                  : 'text-zinc-500 hover:text-white'
            }`}
          >
            Monthly Goals
          </button>
        </div>
      </div>

    <div className="grid grid-cols-1 gap-4">
      {clientStats.map((client) => (
        <div key={client.id} className={`p-6 rounded-[32px] border transition-all duration-300 group backdrop-blur-xl ${
          theme === 'white' ? 'bg-white border-zinc-200 hover:border-blue-500/50' : 'bg-zinc-900/50 border-white/5 hover:border-blue-500/30'
        }`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8">
            {/* Client Identity - Fixed Width Span */}
            <div className="lg:col-span-3 flex items-center gap-6 overflow-hidden">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl border transition-all shadow-2xl ${
                theme === 'white' ? 'bg-zinc-100 text-zinc-900 border-zinc-200' : 'bg-zinc-800 text-blue-400 border-white/5 group-hover:bg-blue-600 group-hover:text-white'
              }`}>
                {client.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className={`font-black uppercase tracking-tight text-lg transition-colors truncate ${theme === 'white' ? 'text-zinc-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-400'}`}>{client.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${client.health.color}`}>
                    {client.health.status}
                  </span>
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest truncate">ID: {client.ga4_property_id}</span>
                </div>
              </div>
            </div>

            {/* Metrics Section - Shared Grid Span */}
            <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-2 text-center lg:text-left">
                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest cursor-help relative text-nowrap">
                  <Tooltip content="Total organic clicks from GSC for the last 7 days.">
                    Weekly Clicks
                  </Tooltip>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <span className={`text-xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{client.latest?.gsc_clicks || 0}</span>
                  {client.trend === 'up' ? <TrendingUp size={16} className="text-emerald-500" /> : <TrendingDown size={16} className="text-red-500" />}
                </div>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest cursor-help relative text-nowrap">
                  <Tooltip content="Average ranking position across all tracked focus keywords.">
                    Avg Position
                  </Tooltip>
                </div>
                <p className={`text-xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{client.latest?.gsc_position?.toFixed(1) || '-'}</p>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest cursor-help relative text-nowrap">
                  <Tooltip content="Overall technical SEO health percentage.">
                    Tech Score
                  </Tooltip>
                </div>
                <p className={`text-xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{client.latest?.technical_score || 0}%</p>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className="text-[9px] font-black text-zinc-500 uppercase tracking-widest cursor-help relative text-nowrap">
                  <Tooltip content="Combined count of all goal completions.">
                    Total Leads
                  </Tooltip>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <span className={`text-xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{client.latest?.leads_total || 0}</span>
                  <span className="text-[9px] font-black text-zinc-500 uppercase">({client.latest?.leads_legit} L)</span>
                </div>
              </div>
            </div>

            {/* Actions Section - Fixed Width End */}
            <div className="lg:col-span-3 flex items-center gap-4 justify-end">
              <button 
                onClick={() => setShowFullReport(client)}
                className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/20 flex items-center gap-2 whitespace-nowrap"
              >
                <Maximize2 size={16} />
                Generate Deep Detail
              </button>
            </div>
          </div>
        </div>
      ))}

      {clients.length === 0 && (
        <div className={`p-20 rounded-[40px] border border-dashed text-center space-y-4 ${
          theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-white/10'
        }`}>
          <Users className="mx-auto text-zinc-800" size={64} />
          <div className="space-y-1">
            <p className={`font-black uppercase tracking-tighter text-xl italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>No properties synced</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Connect your first client property to begin surveillance</p>
          </div>
        </div>
      )}
    </div>

      {showFullReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl overflow-y-auto animate-in fade-in duration-300">
          <div className={`rounded-[48px] w-full max-w-5xl shadow-2xl my-8 relative border overflow-visible ${
            theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/5 shadow-blue-600/15'
          }`}>
            <div className={`p-10 border-b flex items-center justify-between sticky top-0 backdrop-blur-xl z-10 ${
              theme === 'white' ? 'bg-white/80 border-zinc-100' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center font-black text-2xl shadow-2xl shadow-blue-600/20">
                  {showFullReport.short_code || showFullReport.name.charAt(0)}
                </div>
                <div>
                  <h3 className={`text-3xl font-black tracking-tighter uppercase italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{showFullReport.name}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${showFullReport.health.color}`}>
                      {showFullReport.health.status} STRATEGY
                    </span>
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">W_START: {showFullReport.latest?.week_start_date}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowFullReport(null)}
                className={`p-4 rounded-full transition-all hover:rotate-90 ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-10 space-y-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {[
                  { label: 'Organic Scale', value: showFullReport.trafficChange, format: '%' },
                  { label: 'Lead Velocity', value: showFullReport.leadsChange, format: '%' },
                  { label: 'Search Rank', value: showFullReport.latest?.gsc_position, format: 'n' },
                  { label: 'Build Quality', value: showFullReport.latest?.technical_score, format: '%' }
                ].map((stat, i) => (
                  <div key={i} className={`p-8 rounded-[32px] border group hover:border-blue-500/20 transition-all ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-800/50 border-white/5'
                  }`}>
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-3">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                        {stat.format === '%' ? (stat.value?.toFixed(1) || '0.0') : (stat.value?.toFixed(1) || '-')}
                        {stat.format === '%' && '%'}
                      </span>
                      {stat.format === '%' && (
                        <span className={`text-xs font-black ${stat.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {stat.value >= 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className={`p-10 rounded-[40px] border space-y-8 ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-800/30 border-white/5'
                }`}>
                  <div className={`flex items-center gap-4 border-b pb-6 ${
                    theme === 'white' ? 'border-zinc-200' : 'border-white/5'
                  }`}>
                    <div className="p-3 bg-blue-600/10 text-blue-500 rounded-2xl"><AlertCircle size={24} /></div>
                    <h4 className={`text-xl font-black uppercase tracking-tight ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Deep Intelligence</h4>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Executive Summary</label>
                      <p className={`text-md font-bold italic leading-relaxed uppercase tracking-tight ${theme === 'white' ? 'text-zinc-700' : 'text-zinc-300'}`}>"{showFullReport.latest?.primary_insight || 'No diagnostic data recorded for this period.'}"</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Threat Vector</label>
                      <p className="text-sm font-black text-red-500 uppercase tracking-tight">{showFullReport.latest?.primary_issue_type || 'NORMALIZED'}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Operational Directive</label>
                      <p className="text-md font-black text-blue-400 flex items-center gap-3 uppercase tracking-tighter">
                        <ChevronRight size={20} className="text-blue-600" />
                        {showFullReport.latest?.next_seo_action || 'SUSTAIN CURRENT TARGETS'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-10 rounded-[40px] border space-y-8 ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-800/30 border-white/5'
                }`}>
                  <div className={`flex items-center gap-4 border-b pb-6 ${
                    theme === 'white' ? 'border-zinc-200' : 'border-white/5'
                  }`}>
                    <div className="p-3 bg-emerald-600/10 text-emerald-500 rounded-2xl"><CheckCircle2 size={24} /></div>
                    <h4 className={`text-xl font-black uppercase tracking-tight ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Activation Log</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-8">
                    {[
                      { label: 'Page Optim', value: showFullReport.latest?.pages_optimized },
                      { label: 'Content Push', value: showFullReport.latest?.blogs_published },
                      { label: 'Link Matrix', value: showFullReport.latest?.backlinks_built },
                      { label: 'Tech Inject', value: showFullReport.latest?.tech_fixes },
                      { label: 'Schema Gen', value: showFullReport.latest?.schema_updates },
                      { label: 'Nodes Linked', value: showFullReport.latest?.internal_links }
                    ].map((act, i) => (
                      <div key={i} className={`flex flex-col border-l-2 pl-4 py-1 ${
                        theme === 'white' ? 'border-zinc-200' : 'border-white/5'
                      }`}>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{act.label}</span>
                        <span className={`text-2xl font-black tracking-widest font-mono ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{act.value || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-10 flex flex-col md:flex-row items-center justify-between gap-6 ${
              theme === 'white' ? 'bg-zinc-100' : 'bg-black'
            }`}>
               <div className="flex flex-wrap items-center gap-6 text-zinc-600 text-[10px] font-black uppercase tracking-widest">
                 <span className="flex items-center gap-2"><Target size={14} /> OFFICER: {showFullReport.project_owner_name}</span>
                 <span className={`w-1 h-1 rounded-full ${theme === 'white' ? 'bg-zinc-300' : 'bg-zinc-800'}`} />
                 <span>CORE_ID: {showFullReport.ga4_property_id}</span>
               </div>
               <button 
                onClick={() => setShowFullReport(null)}
                className={`w-full md:w-auto px-12 py-4 rounded-2xl font-black text-xs transition-all uppercase tracking-widest shadow-xl ${
                  theme === 'white' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'bg-white text-black hover:bg-zinc-200'
                }`}
               >
                 Close Surveillance
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
