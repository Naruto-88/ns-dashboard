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
  Shield,
  Activity
} from 'lucide-react';
import Tooltip from '../components/Tooltip';
import NextActionModal from '../components/NextActionModal';
import { getClients, Client, getWeeklyData, WeeklyData, getKeywords, KeywordHistory, getKeywordHistory, getLiveMetrics } from '../services/dataService';
import { supabase } from '../lib/supabase';
import { format, startOfWeek, subWeeks, startOfMonth, subMonths, endOfMonth, endOfWeek, parseISO } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

export default function ClientScoreboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<Record<string, WeeklyData[]>>({});
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
  const [showFullReport, setShowFullReport] = useState<any | null>(null);
  const [addingActionFor, setAddingActionFor] = useState<Client | null>(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  const fetchData = async (forceLive = false) => {
    if (forceLive) setIsLiveSyncing(true);
    setLoading(true);
    
    try {
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

      const actionsData = await supabase.from('client_actions').select('*').eq('status', 'pending');
      const pendingActionsData = actionsData.data || [];

      await Promise.all(clientList.map(async (client) => {
        const [liveCurrent, livePrevious, dbData] = await Promise.all([
          forceLive ? getLiveMetrics(client.id, currentRange) : Promise.resolve(null),
          forceLive ? getLiveMetrics(client.id, previousRange) : Promise.resolve(null),
          getWeeklyData(client.id, { startDate: format(subMonths(today, 6), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') })
        ]);
        
        dataMap[client.id] = { 
          liveCurrent, 
          livePrevious,
          pendingActions: pendingActionsData.filter(a => a.client_id === client.id)
        };
        weeklyDataMap[client.id] = dbData;
      }));

      setAllData(weeklyDataMap as any);
      (window as any).__liveData = dataMap; // Store for useMemo
      setLoading(false);
      setIsLiveSyncing(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
      setIsLiveSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [viewMode]);

  const clientStats = useMemo(() => {
    const liveData = (window as any).__liveData || {};
    return clients.map(client => {
      const data = allData[client.id] || [];
      const latestDb = data[0];
      const { liveCurrent, livePrevious, pendingActions } = liveData[client.id] || {};

      // Merge DB data with Live data
      const latest = {
        ...(latestDb || {}),
        gsc_clicks: liveCurrent?.gsc_clicks || latestDb?.gsc_clicks || 0,
        gsc_position: liveCurrent?.gsc_position || latestDb?.gsc_position || 0,
        ga4_traffic: liveCurrent?.ga4_traffic || latestDb?.ga4_traffic || 0,
      };

  const getHealth = () => {
    const score = latest.technical_score || 0;
    if (score < 70) return { status: 'Critical', color: 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' };
    if (score < 85) return { status: 'Watch', color: theme === 'white' ? 'bg-[#f47b20]/10 text-[#f47b20] border border-[#f47b20]/20 shadow-[0_0_15px_rgba(244,123,32,0.1)]' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' };
    return { status: 'Healthy', color: theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border border-[#76c9be]/20 shadow-[0_0_15px_rgba(118,201,190,0.1)]' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]' };
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
        pendingActions,
        trend: liveCurrent && livePrevious ? (liveCurrent.gsc_clicks >= livePrevious.gsc_clicks ? 'up' : 'down') : 'stable'
      };
    });
  }, [clients, allData, loading]);

  if (loading && !isLiveSyncing) return <div className="h-screen flex items-center justify-center">Loading scoreboard...</div>;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-50">
        <div>
          <h2 className={`text-2xl font-medium font-heading  tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Client Scoreboard</h2>
          <p className={`text-sm font-medium   mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Property Performance Readiness</p>
        </div>
        <div className={`flex rounded-2xl p-1.5 shadow-xl backdrop-blur-xl h-fit border ${
          theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <button 
            onClick={() => setViewMode('weekly')}
            className={`px-6 py-2.5 text-sm font-medium   rounded-xl transition-all ${
              viewMode === 'weekly' 
                ? (theme === 'white' ? 'bg-[#76c9be] text-white shadow-lg shadow-[#76c9be]/20' : 'bg-blue-600 text-white shadow-lg') 
                : theme === 'white' 
                  ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/5'
                  : 'text-zinc-500 hover:text-white'
            }`}
          >
            Weekly Focus
          </button>
          <button 
            onClick={() => setViewMode('monthly')}
            className={`px-6 py-2.5 text-sm font-medium   rounded-xl transition-all ${
              viewMode === 'monthly' 
                ? (theme === 'white' ? 'bg-[#76c9be] text-white shadow-lg shadow-[#76c9be]/20' : 'bg-blue-600 text-white shadow-lg') 
                : theme === 'white' 
                  ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/5'
                  : 'text-zinc-500 hover:text-white'
            }`}
          >
            Monthly Goals
          </button>
        </div>
        <button
          onClick={() => fetchData(true)}
          className={`px-4 py-2.5 rounded-xl text-sm font-medium   transition-all flex items-center gap-2 shadow-xl backdrop-blur-xl border ${
            theme === 'white' 
              ? 'bg-[#76c9be] text-white hover:bg-[#5bb8ad] shadow-lg shadow-[#76c9be]/20 border-transparent' 
              : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20 border-white/5'
          }`}
        >
          <Activity size={14} className={isLiveSyncing ? 'animate-spin' : ''} />
          Live Sync
        </button>
      </div>

    <div className="grid grid-cols-1 gap-4">
      {clientStats.map((client) => (
        <div key={client.id} className={`p-6 rounded-[32px] border transition-all duration-300 group backdrop-blur-xl ${
          theme === 'white' ? 'bg-white border-[#163f4d]/10 hover:border-[#76c9be]/50' : 'bg-zinc-900/50 border-white/5 hover:border-blue-500/30'
        }`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8">
            {/* Client Identity - Fixed Width Span */}
            <div className="lg:col-span-3 flex items-center gap-6 overflow-hidden">
              <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center font-medium text-xl border transition-all shadow-2xl font-heading ${
                theme === 'white' ? 'bg-[#76c9be]/5 text-[#082a36] border-[#163f4d]/10' : 'bg-zinc-800 text-blue-400 border-white/5 group-hover:bg-blue-600 group-hover:text-white'
              }`}>
                {client.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className={`font-medium font-heading  tracking-tight text-lg transition-colors truncate ${theme === 'white' ? 'text-[#082a36] group-hover:text-[#76c9be]' : 'text-white group-hover:text-blue-400'}`}>{client.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-sm font-medium px-3 py-1 rounded-full   ${client.health.color}`}>
                    {client.health.status}
                  </span>
                  <span className={`text-sm font-medium   truncate ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-600'}`}>ID: {client.ga4_property_id}</span>
                </div>
                {client.pendingActions && client.pendingActions.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-2 max-h-16 overflow-y-auto pr-2 custom-scrollbar">
                    {client.pendingActions.map((action: any) => (
                      <div key={action.id} className="flex items-start gap-1">
                        <Target size={8} className={`mt-0.5 shrink-0 ${theme === 'white' ? 'text-[#76c9be]' : 'text-amber-500'}`} />
                        <span className={`text-sm leading-tight font-medium ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'} line-clamp-1`} title={action.action_text}>
                          {action.action_text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Metrics Section - Shared Grid Span */}
            <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="space-y-2 text-center lg:text-left">
                <div className={`text-sm font-medium   cursor-help relative text-nowrap ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                  <Tooltip content="Total organic clicks from GSC for the last 7 days.">
                    Weekly Clicks
                  </Tooltip>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-3">
                  <span className={`text-xl font-medium font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{client.latest?.gsc_clicks || 0}</span>
                  {client.trend === 'up' ? <TrendingUp size={16} className={theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500'} /> : <TrendingDown size={16} className="text-red-500" />}
                </div>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className={`text-sm font-medium   cursor-help relative text-nowrap ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                  <Tooltip content="Average ranking position across all tracked focus keywords.">
                    Avg Position
                  </Tooltip>
                </div>
                <p className={`text-xl font-medium font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{client.latest?.gsc_position?.toFixed(1) || '-'}</p>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className={`text-sm font-medium   cursor-help relative text-nowrap ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                  <Tooltip content="Overall technical SEO health percentage.">
                    Tech Score
                  </Tooltip>
                </div>
                <p className={`text-xl font-medium font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{client.latest?.technical_score || 0}%</p>
              </div>
              <div className="space-y-2 text-center lg:text-left">
                <div className={`text-sm font-medium   cursor-help relative text-nowrap ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                  <Tooltip content="Combined count of all goal completions.">
                    Total Leads
                  </Tooltip>
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <span className={`text-xl font-medium font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{client.latest?.leads_total || 0}</span>
                  <span className={`text-sm font-medium  ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>({client.latest?.leads_legit} L)</span>
                </div>
              </div>
            </div>

            {/* Actions Section - Fixed Width End */}
            <div className="lg:col-span-3 flex items-center gap-2 justify-end">
              <button 
                onClick={() => setShowFullReport(client)}
                className={`px-4 py-3 rounded-2xl text-sm font-medium   transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 whitespace-nowrap ${
                  theme === 'white' ? 'bg-[#f47b20] text-white shadow-[#f47b20]/20 hover:bg-[#f47b20]/90' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                }`}
              >
                <Maximize2 size={16} />
                Deep Detail
              </button>
              <button
                onClick={() => setAddingActionFor(client)}
                className={`p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2 ${
                  theme === 'white' ? 'bg-[#76c9be] text-white shadow-[#76c9be]/20 hover:bg-[#5bb8ad]' : 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500'
                }`}
                title="Log Next Action"
              >
                <Target size={16} />
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
            <p className={`font-medium  tracking-tighter text-xl italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>No properties synced</p>
            <p className="text-sm text-zinc-500 font-medium  ">Connect your first client property to begin surveillance</p>
          </div>
        </div>
      )}
    </div>

      {showFullReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl overflow-y-auto animate-in fade-in duration-300">
          <div className={`rounded-[48px] w-full max-w-5xl shadow-2xl my-8 relative border overflow-visible ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900 border-white/5 shadow-blue-600/15'
          }`}>
            <div className={`p-10 border-b flex items-center justify-between sticky top-0 backdrop-blur-xl z-10 ${
              theme === 'white' ? 'bg-white/80 border-[#163f4d]/5' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center font-medium text-2xl shadow-2xl ${
                  theme === 'white' ? 'bg-[#76c9be] text-white shadow-[#76c9be]/20' : 'bg-blue-600 text-white shadow-blue-600/20'
                }`}>
                  {showFullReport.short_code || showFullReport.name.charAt(0)}
                </div>
                <div>
                  <h3 className={`text-3xl font-medium font-heading tracking-tighter  italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{showFullReport.name}</h3>
                  <div className="flex items-center gap-4 mt-2">
                    <span className={`text-sm font-medium px-4 py-1.5 rounded-full   ${showFullReport.health.color}`}>
                      {showFullReport.health.status} STRATEGY
                    </span>
                    <span className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>W_START: {showFullReport.latest?.week_start_date}</span>
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
                  <div key={i} className={`p-8 rounded-[32px] border group transition-all ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5 hover:border-[#76c9be]/20' : 'bg-zinc-800/50 border-white/5 hover:border-blue-500/20'
                  }`}>
                    <p className={`text-sm font-medium   mb-3 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-3xl font-medium font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {stat.format === '%' ? (stat.value?.toFixed(1) || '0.0') : (stat.value?.toFixed(1) || '-')}
                        {stat.format === '%' && '%'}
                      </span>
                      {stat.format === '%' && (
                        <span className={`text-sm font-medium ${stat.value >= 0 ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : 'text-red-500'}`}>
                          {stat.value >= 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className={`p-10 rounded-[40px] border space-y-8 ${
                  theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-800/30 border-white/5'
                }`}>
                  <div className={`flex items-center gap-4 border-b pb-6 ${
                    theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'
                  }`}>
                    <div className={`p-3 rounded-2xl ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-blue-600/10 text-blue-500'}`}><AlertCircle size={24} /></div>
                    <h4 className={`text-xl font-medium font-heading  tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Deep Intelligence</h4>
                  </div>
                  <div className="space-y-8">
                    <div>
                      <label className={`text-sm font-medium   block mb-2 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Executive Summary</label>
                      <p className={`text-md font-medium italic leading-relaxed  tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-300'}`}>"{showFullReport.latest?.primary_insight || 'No diagnostic data recorded for this period.'}"</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-zinc-500   block mb-2">Threat Vector</label>
                      <p className="text-sm font-medium text-red-500  tracking-tight">{showFullReport.latest?.primary_issue_type || 'NORMALIZED'}</p>
                    </div>
                    <div>
                      <label className={`text-sm font-medium   block mb-2 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Operational Directive</label>
                      <p className={`text-md font-medium flex items-center gap-3  tracking-tighter ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-400'}`}>
                        <ChevronRight size={20} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-600'} />
                        {showFullReport.latest?.next_seo_action || 'SUSTAIN CURRENT TARGETS'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`p-10 rounded-[40px] border space-y-8 ${
                  theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-800/30 border-white/5'
                }`}>
                  <div className={`flex items-center gap-4 border-b pb-6 ${
                    theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'
                  }`}>
                    <div className={`p-3 rounded-2xl ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-emerald-600/10 text-emerald-500'}`}><CheckCircle2 size={24} /></div>
                    <h4 className={`text-xl font-medium font-heading  tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Activation Log</h4>
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
                        theme === 'white' ? 'border-[#163f4d]/10' : 'border-white/5'
                      }`}>
                        <span className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{act.label}</span>
                        <span className={`text-2xl font-medium  font-heading font-mono ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{act.value || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-10 flex flex-col md:flex-row items-center justify-between gap-6 ${
              theme === 'white' ? 'bg-zinc-100' : 'bg-black'
            }`}>
               <div className="flex flex-wrap items-center gap-6 text-zinc-600 text-sm font-medium  ">
                 <span className="flex items-center gap-2"><Target size={14} /> OFFICER: {showFullReport.project_owner_name}</span>
                 <span className={`w-1 h-1 rounded-full ${theme === 'white' ? 'bg-zinc-300' : 'bg-zinc-800'}`} />
                 <span>CORE_ID: {showFullReport.ga4_property_id}</span>
               </div>
                <button 
                onClick={() => setShowFullReport(null)}
                className={`w-full md:w-auto px-12 py-4 rounded-2xl font-medium text-sm transition-all   shadow-xl ${
                  theme === 'white' ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90' : 'bg-white text-black hover:bg-zinc-200'
                }`}
               >
                 Close Surveillance
               </button>
            </div>
          </div>
        </div>
      )}

      {addingActionFor && (
        <NextActionModal
          client={addingActionFor}
          onClose={() => setAddingActionFor(null)}
          onSuccess={() => {
            setAddingActionFor(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
