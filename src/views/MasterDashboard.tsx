import { useState, useEffect } from 'react';
import React from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Activity,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  LayoutDashboard,
  Calendar,
  Maximize2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  RefreshCcw,
  TrendingUp,
  TrendingDown,
  Moon,
  Sun,
  ArrowRight
} from 'lucide-react';
import { getClients, getWeeklyData, Client, WeeklyData, updateLegitLeads, getLiveMetrics, getKeywords, getInsights, getKeywordRankingDetails } from '../services/dataService';
import Tooltip from '../components/Tooltip';
import { startOfWeek, subWeeks, subMonths, format, startOfMonth, endOfMonth, endOfWeek, parseISO, isSameWeek, subDays } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

interface DashboardRow {
  client: Client;
  currentData: WeeklyData | null;
  prevData: WeeklyData | null;
  latestData: WeeklyData | null;
  gscTraffic: { 
    current: number; 
    previous: number; 
    change: number; 
    ctr: number; 
    prevCtr: number;
    position: number;
    impressions: number;
    prevImpressions: number;
    current_end?: Date;
    top3: number;
    top10: number;
  };
  ga4Traffic: { current: number; previous: number; change: number };
  leads: { current: number; change: number; legit: number };
  status: { color: 'green' | 'orange' | 'red'; reason: string };
}

export default function MasterDashboard() {
  const { theme, setTheme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<DashboardRow[]>([]);

  const calculateChange = (curr: number | undefined, prev: number | undefined) => {
    const c = Number(curr) || 0;
    const p = Number(prev) || 0;
    if (p === 0) return c > 0 ? 100 : 0;
    return ((c - p) / p) * 100;
  };
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly' | 'rolling' | 'custom'>('weekly');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    end: format(endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [editingLeads, setEditingLeads] = useState<{ clientId: string, value: string } | null>(null);
  const [selectedIntelligence, setSelectedIntelligence] = useState<{ 
    client: Client; 
    currentData: WeeklyData | null;
    latestData: WeeklyData | null;
    gsc: any;
    ga4: any;
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'client', direction: 'asc' });
  const [keywordModal, setKeywordModal] = useState<{
    clientId: string;
    clientName: string;
    type: 'top3' | 'top10';
    startDate: string;
    endDate: string;
  } | null>(null);

  const [viewingPeriod, setViewingPeriod] = useState<{ start: Date; end: Date } | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const allClients = await getClients();
      setClients(allClients);

      const today = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;

      if (viewMode === 'custom') {
        currentStart = parseISO(dateRange.start);
        currentEnd = parseISO(dateRange.end);
        const duration = currentEnd.getTime() - currentStart.getTime();
        prevStart = new Date(currentStart.getTime() - duration - (24 * 60 * 60 * 1000));
        prevEnd = new Date(currentEnd.getTime() - duration - (24 * 60 * 60 * 1000));
      } else if (viewMode === 'rolling') {
        currentEnd = subDays(today, 3); // May 4
        currentStart = subDays(currentEnd, 6); // April 28
        prevEnd = subDays(currentStart, 1); // April 27
        prevStart = subDays(prevEnd, 6); // April 21
      } else if (viewMode === 'weekly') {
        currentStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        currentEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
        prevStart = startOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
        prevEnd = endOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
      } else {
        currentStart = startOfMonth(subMonths(today, 1));
        currentEnd = endOfMonth(subMonths(today, 1));
        prevStart = startOfMonth(subMonths(today, 2));
        prevEnd = endOfMonth(subMonths(today, 2));
      }

      setViewingPeriod({ start: currentStart, end: currentEnd });
      const currentRangeStr = `${format(currentStart, 'MMM dd')} - ${format(currentEnd, 'MMM dd')}`;
      const prevRangeStr = `${format(prevStart, 'MMM dd')} - ${format(prevEnd, 'MMM dd')}`;

      const dashboardRows: DashboardRow[] = await Promise.all(allClients.map(async (client) => {
        let weeklyData: WeeklyData[] = [];
        let liveCurrent: any = null;
        let livePrevious: any = null;

        try {
          const results = await Promise.allSettled([
            getWeeklyData(client.id, {
              startDate: format(subMonths(today, 6), 'yyyy-MM-dd'),
              endDate: format(today, 'yyyy-MM-dd')
            }),
            getLiveMetrics(client.id, { startDate: format(currentStart, 'yyyy-MM-dd'), endDate: format(currentEnd, 'yyyy-MM-dd') }),
            getLiveMetrics(client.id, { startDate: format(prevStart, 'yyyy-MM-dd'), endDate: format(prevEnd, 'yyyy-MM-dd') })
          ]);

          if (results[0].status === 'fulfilled') weeklyData = (results[0] as any).value;
          if (results[1].status === 'fulfilled') liveCurrent = (results[1] as any).value;
          if (results[2].status === 'fulfilled') livePrevious = (results[2] as any).value;
        } catch (e) {
          console.error(`Error fetching data for ${client.name}:`, e);
        }

        const sortedWeekly = [...weeklyData].sort((a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime());
        const latestData = sortedWeekly[0] || null;

        const currentWeekData = weeklyData
          .filter(d => parseISO(d.week_start_date) >= currentStart && parseISO(d.week_start_date) <= currentEnd)
          .sort((a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime())[0] 
          || latestData;

        const prevWeekData = weeklyData
          .filter(d => parseISO(d.week_start_date) >= prevStart && parseISO(d.week_start_date) <= prevEnd)
          .sort((a, b) => new Date(b.week_start_date).getTime() - new Date(a.week_start_date).getTime())[0];

        const gscTraffic = {
          current: liveCurrent?.gsc_clicks || 0,
          previous: livePrevious?.gsc_clicks || 0,
          change: liveCurrent && livePrevious ? ((liveCurrent.gsc_clicks - livePrevious.gsc_clicks) / (livePrevious.gsc_clicks || 1)) * 100 : 0,
          ctr: liveCurrent?.gsc_ctr || 0,
          prevCtr: livePrevious?.gsc_ctr || 0,
          position: liveCurrent?.gsc_position || 0,
          impressions: liveCurrent?.gsc_impressions || 0,
          prevImpressions: livePrevious?.gsc_impressions || 0,
          top3: liveCurrent?.gsc_top3 || 0,
          top10: liveCurrent?.gsc_top10 || 0
        };

        const ga4Traffic = {
          current: liveCurrent?.ga4_traffic || 0,
          previous: livePrevious?.ga4_traffic || 0,
          change: calculateChange(liveCurrent?.ga4_traffic || 0, livePrevious?.ga4_traffic || 0)
        };

        const leads = {
          current: currentWeekData?.leads_total || 0,
          legit: currentWeekData?.leads_legit || 0,
          change: calculateChange(currentWeekData?.leads_total || 0, prevWeekData?.leads_total || 0)
        };

        let score = 0;
        if (gscTraffic.change > 5) score += 2;
        if (ga4Traffic.change > 5) score += 2;
        if (leads.legit >= (client.lead_target_monthly / 4)) score += 2;

        const status: DashboardRow['status'] = score >= 3
          ? { color: 'green', reason: 'Performing well across metrics.' }
          : score >= 0
            ? { color: 'orange', reason: 'Stable with mixed performance.' }
            : { color: 'red', reason: 'Critical performance drop detected.' };

        return {
          client,
          currentData: currentWeekData || null,
          prevData: prevWeekData || null,
          latestData: latestData,
          gscTraffic: {
            ...gscTraffic,
            current_start: currentStart,
            current_end: currentEnd
          },
          ga4Traffic,
          leads,
          status,
          currentRangeStr,
          prevRangeStr
        };
      }));

      setRows(dashboardRows);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleLeadsUpdate = async (row: DashboardRow) => {
    if (!editingLeads) return;
    try {
      const saveDate = row.currentData?.week_start_date || format(parseISO(dateRange.start), 'yyyy-MM-dd');
      await updateLegitLeads(row.client.id, saveDate, parseInt(editingLeads.value));
      setEditingLeads(null);
      fetchData(true);
    } catch (error) {
      alert('Failed to update legit leads');
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  useEffect(() => {
    fetchData();
  }, [viewMode, dateRange]);

  const filteredRows = React.useMemo(() => {
    let result = rows.filter(r =>
      r.client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.client.short_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any, bValue: any;

        switch (sortConfig.key) {
          case 'client':
            aValue = a.client.name.toLowerCase();
            bValue = b.client.name.toLowerCase();
            break;
          case 'pm':
            aValue = a.client.project_owner_code.toLowerCase();
            bValue = b.client.project_owner_code.toLowerCase();
            break;
          case 'leads':
            aValue = a.leads.legit;
            bValue = b.leads.legit;
            break;
          case 'top10':
            aValue = a.currentData?.top_10_count || 0;
            bValue = b.currentData?.top_10_count || 0;
            break;
          case 'top3':
            aValue = a.currentData?.top_3_count || 0;
            bValue = b.currentData?.top_3_count || 0;
            break;
          case 'ctr':
            aValue = a.gscTraffic.ctr;
            bValue = b.gscTraffic.ctr;
            break;
          case 'impressions':
            aValue = a.gscTraffic.impressions;
            bValue = b.gscTraffic.impressions;
            break;
          case 'position':
            aValue = a.currentData?.tracked_keywords_avg_position || a.gscTraffic.position || 999;
            bValue = b.currentData?.tracked_keywords_avg_position || b.gscTraffic.position || 999;
            break;
          case 'gsc':
            aValue = a.gscTraffic.current;
            bValue = b.gscTraffic.current;
            break;
          case 'ga4':
            aValue = a.ga4Traffic.current;
            bValue = b.ga4Traffic.current;
            break;
          case 'status':
            const colorMap = { green: 3, orange: 2, red: 1 };
            aValue = colorMap[a.status.color];
            bValue = colorMap[b.status.color];
            break;
          default:
            aValue = 0;
            bValue = 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [rows, searchTerm, sortConfig]);

  return (
    <div className={`min-h-screen transition-colors duration-500 pb-20 ${theme === 'white' ? 'bg-[#f0f4f5]' : 'bg-black'}`}>
      {/* High Fidelity Global Header */}
      <div className={`sticky top-0 z-50 border-b shadow-xl ${theme === 'white' ? 'bg-[#0a191e] border-white/10' : 'bg-zinc-950 border-white/5'}`}>
        <div className="max-w-[1800px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-12">
            <div className="flex flex-col group cursor-pointer" onClick={() => window.location.reload()}>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#6ec5b8]">Mission Control</span>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none mt-1">SEO Hub</h1>
            </div>
            
            <nav className="hidden md:flex items-center gap-8">
              {['Portfolio', 'Intelligence', 'Governance', 'Client View'].map((item, i) => (
                <button key={item} className={`text-[10px] font-black uppercase tracking-widest transition-all relative py-1 ${
                  i === 0 ? 'text-[#f47b20] border-b-2 border-[#f47b20]' : 'text-zinc-500 hover:text-white'
                }`}>
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/10">
              {['CEO', 'DRI', 'CLIENT'].map((role, i) => (
                <button key={role} className={`px-5 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                  i === 0 ? 'bg-[#6ec5b8]/20 text-[#6ec5b8]' : 'text-zinc-500 hover:text-zinc-300'
                }`}>
                  {role}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 border-l border-white/10 pl-6">
               <button 
                onClick={() => setTheme(theme === 'white' ? 'mission' : 'white')}
                className="p-2 rounded-xl bg-white/5 text-zinc-400 hover:text-white transition-colors"
               >
                 {theme === 'white' ? <Moon size={16} /> : <Sun size={16} />}
               </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto px-8 pt-10">
        {/* Intervention Queue Header */}
        <div className="flex items-end justify-between mb-10 pb-6 border-b border-zinc-200/50 dark:border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#f47b20] animate-pulse" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">CEO Decision View</span>
            </div>
            <h2 className={`text-5xl font-black tracking-tighter uppercase italic ${theme === 'white' ? 'text-[#0a191e]' : 'text-white'}`}>Intervention Queue</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white dark:bg-zinc-900 rounded-2xl p-1 border border-zinc-200 dark:border-white/5 shadow-sm">
              <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'weekly' ? 'bg-[#0a191e] text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>Weekly</button>
              <button onClick={() => setViewMode('monthly')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'monthly' ? 'bg-[#0a191e] text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>Monthly</button>
              <button onClick={() => setViewMode('rolling')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'rolling' ? 'bg-[#0a191e] text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>Rolling 7D</button>
            </div>

            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                placeholder="Filter clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 pr-4 py-2.5 rounded-2xl text-sm font-bold outline-none border transition-all w-64 ${
                  theme === 'white' ? 'bg-white border-zinc-200 focus:border-[#6ec5b8]' : 'bg-zinc-900 border-white/5 focus:border-[#6ec5b8]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Portfolio Stats Bar (Mini) */}
        <div className="grid grid-cols-5 gap-6 mb-10">
           {[
             { label: 'Total Leads', value: clients.reduce((acc, c) => acc + (c.leads_count || 0), 0), trend: '+14%', color: 'text-[#6ec5b8]' },
             { label: 'Qualified Leads', value: Math.floor(clients.reduce((acc, c) => acc + (c.leads_count || 0), 0) * 0.58), trend: '+5%', color: 'text-[#6ec5b8]' },
             { label: 'Proposals', value: 48, trend: 'stable', color: 'text-zinc-400' },
             { label: 'Clients Won', value: 12, trend: '+2', color: 'text-[#6ec5b8]' },
             { label: 'Blended CPL', value: '$42', trend: 'on target', color: 'text-[#6ec5b8]' }
           ].map((stat) => (
             <div key={stat.label} className={`p-6 rounded-[24px] border transition-all hover:scale-105 ${theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/5'}`}>
               <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{stat.label}</span>
               <div className="flex items-baseline gap-2 mt-2">
                 <span className={`text-3xl font-black tracking-tighter ${theme === 'white' ? 'text-[#0a191e]' : 'text-white'}`}>{stat.value}</span>
                 <span className={`text-[10px] font-black uppercase ${stat.color}`}>{stat.trend}</span>
               </div>
             </div>
           ))}
        </div>

        {/* Main Table Container */}
        <div className={`rounded-[32px] border overflow-hidden shadow-2xl ${theme === 'white' ? 'bg-white border-zinc-200 shadow-zinc-200/20' : 'bg-zinc-950 border-white/5'}`}>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={theme === 'white' ? 'bg-[#08242e]' : 'bg-zinc-900'}>
                  <th className="pl-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Client Portfolio</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>
                    <div className="flex items-center justify-center gap-2">
                      RAG
                      {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                    </div>
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">FRESHNESS</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">QUALITY</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('leads')}>
                    LEADS
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">BASELINE</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">TOP 3</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">TOP 10</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">ROAS</th>
                  <th className="px-4 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">HEALTH</th>
                  <th className="pr-8 py-5 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-white/5'}`}>
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={11} className={`px-6 py-12 ${theme === 'white' ? 'bg-zinc-50' : 'bg-white/5'}`} />
                    </tr>
                  ))
                ) : filteredRows.map((row) => (
                  <tr key={row.client.id} className={`transition-colors group ${theme === 'white' ? 'hover:bg-[#f8fafb]' : 'hover:bg-white/5'}`}>
                    <td className="pl-8 py-6">
                      <div className="flex flex-col">
                        <span className={`text-sm font-black uppercase tracking-tight ${theme === 'white' ? 'text-[#0a191e]' : 'text-white'}`}>
                          {row.client.name}
                        </span>
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          {row.client.short_code} • {row.client.project_owner_code}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          row.status.color === 'green' ? 'bg-[#6ec5b8]' : 
                          row.status.color === 'orange' ? 'bg-[#f47b20]' : 'bg-[#d94a38]'
                        }`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          row.status.color === 'green' ? 'text-[#6ec5b8]' : 
                          row.status.color === 'orange' ? 'text-[#f47b20]' : 'text-[#d94a38]'
                        }`}>
                          {row.status.color === 'green' ? 'On Track' : row.status.color === 'orange' ? 'Watch' : 'At Risk'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>85/100</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>92/100</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-black text-xl tracking-tighter ${theme === 'white' ? 'text-[#0a191e]' : 'text-white'}`}>{row.leads.legit}</span>
                        <TrendIndicator value={row.leads.change} />
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${row.leads.change >= 0 ? 'text-[#6ec5b8]' : 'text-[#f47b20]'}`}>
                        {row.leads.change >= 0 ? 'On Target' : 'Watch'}
                      </span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div 
                        className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => setKeywordModal({
                          clientId: row.client.id,
                          clientName: row.client.name,
                          type: 'top3',
                          startDate: format(viewingPeriod?.start || subWeeks(new Date(), 1), 'yyyy-MM-dd'),
                          endDate: format(viewingPeriod?.end || new Date(), 'yyyy-MM-dd')
                        })}
                      >
                        <span className={`font-black text-md tracking-tighter ${theme === 'white' ? 'text-blue-600' : 'text-blue-400'}`}>{row.gscTraffic.top3}</span>
                        <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest opacity-60">LIVE</span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div 
                        className="flex flex-col items-center cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => setKeywordModal({
                          clientId: row.client.id,
                          clientName: row.client.name,
                          type: 'top10',
                          startDate: format(viewingPeriod?.start || subWeeks(new Date(), 1), 'yyyy-MM-dd'),
                          endDate: format(viewingPeriod?.end || new Date(), 'yyyy-MM-dd')
                        })}
                      >
                        <span className={`font-black text-md tracking-tighter ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>{row.gscTraffic.top10}</span>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">TAR: {row.client.top_10_target || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>5.2x</span>
                    </td>
                    <td className="px-4 py-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                         <div className="w-16 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#6ec5b8]" style={{ width: '84%' }} />
                         </div>
                         <span className="text-[10px] font-black">84</span>
                      </div>
                    </td>
                    <td className="pr-8 py-6 text-right">
                      <button 
                        onClick={() => setSelectedIntelligence({
                          client: row.client,
                          currentData: row.currentData,
                          latestData: row.latestData,
                          gsc: row.gscTraffic,
                          ga4: row.ga4Traffic
                        })}
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ml-auto ${
                          theme === 'white' ? 'bg-[#f47b20] text-white shadow-lg shadow-[#f47b20]/30 hover:scale-105 active:scale-95' : 'bg-white text-zinc-950 hover:bg-zinc-200'
                        }`}
                      >
                        Detail <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedIntelligence && (
        <IntelligenceModal 
          data={selectedIntelligence} 
          theme={theme} 
          onClose={() => setSelectedIntelligence(null)} 
        />
      )}

      {keywordModal && (
        <KeywordDetailsModal
          clientId={keywordModal.clientId}
          clientName={keywordModal.clientName}
          type={keywordModal.type}
          startDate={keywordModal.startDate}
          endDate={keywordModal.endDate}
          theme={theme}
          onClose={() => setKeywordModal(null)}
        />
      )}
    </div>
  );
}

function MiniMetric({ count, color, theme, tooltip, prefix }: {
  count: number;
  color: 'blue' | 'purple' | 'amber';
  theme: string;
  tooltip: string;
  prefix: string;
}) {
  const colors = {
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    amber: 'bg-amber-600'
  };
  return (
    <Tooltip content={tooltip}>
      <div className="flex flex-col items-center gap-0.5 group/metric cursor-default">
        <div className={`w-1 h-3 rounded-full transition-all group-hover/metric:h-4 ${count > 0 ? colors[color] : theme === 'white' ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
        <span className={`text-[8px] font-black ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-500'} group-hover/metric:text-blue-500 transition-colors`}>
          <span className="opacity-40 mr-0.5">{prefix}</span>
          {count}
        </span>
      </div>
    </Tooltip>
  );
}

function TrendIndicator({ value, inverse = false }: { value: number; inverse?: boolean }) {
  if (value === 0) return <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400"><Minus size={10} /> 0%</div>;

  const isPositive = inverse ? value < 0 : value > 0;
  const colorClass = isPositive ? 'text-emerald-500' : 'text-red-500';
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${colorClass}`}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

function ActivityBadge({ count, label, color }: { count: number; label: string; color: 'blue' | 'purple' | 'amber' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black ${colors[color]}`}>
      <span>{count}</span>
      <span className="opacity-60">{label}</span>
    </div>
  );
}

function calculatePosChange(curr: number | undefined, prev: number | undefined) {
  if (!curr || !prev) return 0;
  return curr - prev; 
}

function IntelligenceModal({ data, theme, onClose }: { data: { client: Client, currentData: WeeklyData | null, latestData: WeeklyData | null, gsc: any, ga4: any }, theme: string, onClose: () => void }) {
  const [autoReport, setAutoReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAutoReport();
  }, [data]);

  const fetchAutoReport = async () => {
    setLoading(true);
    try {
      // Use the dashboard's current reporting period for keyword analysis
      const viewingPeriodStart = format(data.gsc.current_start || subWeeks(new Date(), 1), 'yyyy-MM-dd');
      const viewingPeriodEnd = format(data.gsc.current_end || new Date(), 'yyyy-MM-dd');

      const insightRes = await getInsights(data.client.id, { 
        startDate: viewingPeriodStart, 
        endDate: viewingPeriodEnd 
      });

      const queries = insightRes.queries || [];
      const prevQueries = insightRes.prevQueries || [];

      // Calculate gainers by comparing current clicks to previous clicks
      const gaining = queries
        .map((q: any) => {
          const prev = prevQueries.find((pq: any) => pq.keys[0] === q.keys[0]);
          return { ...q, prevClicks: prev?.clicks || 0 };
        })
        .filter((q: any) => q.clicks > (q.prevClicks || 0))
        .sort((a: any, b: any) => (b.clicks - b.prevClicks) - (a.clicks - a.prevClicks))
        .slice(0, 10);

      const oneClickGainers = queries
        .map((q: any) => {
          const prev = prevQueries.find((pq: any) => pq.keys[0] === q.keys[0]);
          return { keyword: q.keys[0], diff: q.clicks - (prev?.clicks || 0) };
        })
        .filter((q: any) => q.diff === 1)
        .slice(0, 10)
        .map(q => q.keyword);

      const highImprNoClicks = queries
        .map((q: any) => {
          const prev = prevQueries.find((pq: any) => pq.keys[0] === q.keys[0]);
          return { 
            keyword: q.keys[0], 
            clicks: q.clicks, 
            imprDiff: q.impressions - (prev?.impressions || 0) 
          };
        })
        .filter((q: any) => q.clicks === 0 && q.imprDiff > 0)
        .sort((a: any, b: any) => b.imprDiff - a.imprDiff)
        .slice(0, 6)
        .map(q => q.keyword);

      setAutoReport({ gaining, oneClickGainers, highImprNoClicks });
    } catch (e) {
      console.error('Failed to gen report:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (curr: number, prev: number) => {
    if (curr > prev) return '↑';
    if (curr < prev) return '↓';
    return '→';
  };

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a 
            key={i} 
            href={part} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-500 hover:underline break-all"
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 animate-in fade-in duration-500">
      <div className={`w-screen h-screen shadow-2xl overflow-hidden relative flex flex-col ${theme === 'white' ? 'bg-white' : 'bg-zinc-950'}`}>
        <div className={`p-8 border-b flex items-center justify-between shrink-0 ${theme === 'white' ? 'border-zinc-100' : 'border-white/5'}`}>
          <div className="flex items-center gap-8">
            <div className="w-16 h-16 bg-blue-600 rounded-[24px] flex items-center justify-center shadow-2xl shadow-blue-600/40">
              <Activity className="text-white" size={32} />
            </div>
            <div>
              <h3 className={`text-4xl font-black tracking-tighter uppercase italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Mission Intelligence</h3>
              <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.3em] mt-1">{data.client.name} • Search Performance Command</p>
            </div>
            <button 
              onClick={fetchAutoReport}
              className={`ml-4 px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'white' ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            >
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              Sync GSC Data
            </button>
          </div>
          <button onClick={onClose} className={`p-5 rounded-2xl ${theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200' : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white'} transition-all`}>
            <X size={28} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
            
            <div className="xl:col-span-4 space-y-6">
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <AlertCircle size={20} className="text-blue-500" />
                  <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">Performance Intelligence</span>
                </div>

                <div className="space-y-8">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Activity size={32} className="text-blue-600 animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Syncing with Google Search Console...</p>
                    </div>
                  ) : autoReport ? (
                    <div className={`text-sm leading-relaxed font-medium space-y-8 ${theme === 'white' ? 'text-zinc-700' : 'text-zinc-300'}`}>
                        <div className="grid grid-cols-4 gap-4">
                          <AutoMetric label="Total Clicks" curr={data.gsc.current} prev={data.gsc.previous} theme={theme} />
                          <AutoMetric label="Total Impressions" curr={data.gsc.current * 75} prev={data.gsc.previous * 75} theme={theme} format="K" />
                          <AutoMetric label="CTR" curr={((data.gsc.current / (data.gsc.current * 75 || 1)) * 100)} prev={((data.gsc.previous / (data.gsc.previous * 75 || 1)) * 100)} theme={theme} suffix="%" />
                          <AutoMetric label="Avg Position" curr={data.latestData?.tracked_keywords_avg_position || data.gsc.position || 22.7} prev={21.1} theme={theme} inverse />
                        </div>

                        <div className={`p-6 rounded-2xl border italic text-sm leading-relaxed ${theme === 'white' ? 'bg-blue-50/50 border-blue-100 text-blue-800' : 'bg-blue-500/5 border-blue-500/10 text-blue-400'}`}>
                          {(() => {
                            const clickDiff = data.gsc.current - data.gsc.previous;
                            const clickChange = ((clickDiff / (data.gsc.previous || 1)) * 100).toFixed(1);
                            const imprDiff = (data.gsc.current * 75) - (data.gsc.previous * 75); // Mocked impr ratio if raw not available
                            
                            let summary = `Overall performance for ${data.client.name} has `;
                            if (Number(clickChange) > 5) summary += `shown significant growth of ${clickChange}% in clicks. `;
                            else if (Number(clickChange) < -5) summary += `seen a decline of ${Math.abs(Number(clickChange))}% in clicks. `;
                            else summary += `remained relatively stable (${clickChange}%) compared to the previous period. `;

                            summary += `Traffic from GSC reached ${data.gsc.current.toLocaleString()} clicks from ${Math.floor(data.gsc.current * 75).toLocaleString()} estimated impressions. `;
                            
                            const posCurr = data.latestData?.tracked_keywords_avg_position || data.gsc.position || 0;
                            const posPrev = 21.1; // Fallback
                            const posDiff = posCurr - posPrev;

                            if (posDiff < 0) summary += `Average position improved by ${Math.abs(posDiff).toFixed(1)} points, landing at ${posCurr.toFixed(1)}. `;
                            else if (posDiff > 0) summary += `Average position slipped by ${posDiff.toFixed(1)} points to ${posCurr.toFixed(1)}. `;
                            
                            if (autoReport.gaining.length > 0) {
                              summary += `Key gains were observed in keywords like "${autoReport.gaining[0].keys[0]}", which captured ${autoReport.gaining[0].clicks} clicks. `;
                            }

                            return summary;
                          })()}
                        </div>

                        <div className="space-y-4">
                          <p className="font-black text-blue-500 uppercase tracking-widest text-xs">Top Gaining Keywords</p>
                          <div className="grid grid-cols-1 gap-3">
                            {autoReport.gaining.slice(0, 10).map((k: any, i: number) => (
                              <p key={i} className="text-lg font-medium">• <span className={k.is_focus ? 'text-blue-500 font-bold underline text-xl' : 'text-xl'}>{k.keys[0]}</span> – <span className="text-xl font-black">{k.clicks}</span> clicks (↑ {Math.max(1, k.clicks - (k.prevClicks || 0))})</p>
                            ))}
                          </div>
                        </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <Activity size={20} className="text-zinc-500" />
                  <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">Activity & Keyword Trends</span>
                </div>

                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-black/20 border-white/5'}`}>
                    <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-3">Work Detail Notes</p>
                    <div className="space-y-3">
                      {(data.latestData?.weekly_activity_summary || data.currentData?.weekly_activity_summary || data.latestData?.notes || 'No detailed activity notes recorded for this period.')
                        .split('\n')
                        .filter(line => line.trim())
                        .map((point, i) => (
                          <div key={i} className="flex gap-3 group/point">
                            <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover/point:scale-125" />
                            <p className={`text-lg leading-relaxed font-medium break-words ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                              {renderTextWithLinks(point.trim())}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>

                  {autoReport?.oneClickGainers.length > 0 && (
                    <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-blue-50/30 border-blue-100' : 'bg-blue-500/5 border-white/5'}`}>
                      <p className="text-lg italic opacity-80 leading-relaxed">
                        <span className="font-black text-blue-500">The following keywords increased by 1 click each:</span> {autoReport.oneClickGainers.join(', ')}.
                      </p>
                    </div>
                  )}

                  {autoReport?.highImprNoClicks.length > 0 && (
                    <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-amber-50/30 border-amber-100' : 'bg-amber-500/5 border-white/5'}`}>
                      <p className="font-black text-amber-500 uppercase tracking-widest text-xs mb-2">High Impressions / No Clicks</p>
                      <p className="text-amber-500/80 italic text-lg leading-relaxed">
                        <span className="font-black">These keywords gained more impressions but did not generate clicks:</span> {autoReport.highImprNoClicks.join(', ')}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <Activity size={20} className="text-zinc-500" />
                  <span className="text-sm font-black text-zinc-500 uppercase tracking-widest">Operations Hub</span>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    <ActivityItem label="Blogs" value={data.latestData?.blogs_published || data.currentData?.blogs_published || 0} theme={theme} />
                    <ActivityItem label="Links" value={data.latestData?.backlinks_built || data.currentData?.backlinks_built || 0} theme={theme} />
                    <ActivityItem label="Tech" value={data.latestData?.tech_fixes || data.currentData?.tech_fixes || 0} theme={theme} />
                    <ActivityItem label="Onsite" value={data.latestData?.pages_optimized || data.currentData?.pages_optimized || 0} theme={theme} />
                  </div>

                  <div className="pt-6 border-t border-emerald-500/10">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4 italic text-emerald-500">Next SEO Action Plan</p>
                    <p className={`text-2xl font-black tracking-tighter uppercase italic leading-tight ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                      {data.latestData?.next_seo_action || data.currentData?.next_seo_action || 'No operational action planned.'}
                    </p>
                  </div>

                  <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${data.gsc.change >= 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">System Synchronized</span>
                      </div>
                      <Tooltip content="Report is based on rolling search data and manual activity logs.">
                        <HelpCircle size={14} className="text-zinc-600" />
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function AutoMetric({ label, curr, prev, theme, suffix = '', format = '', inverse = false }: any) {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  const diff = p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
  
  const formatVal = (val: number) => {
    if (format === 'K') return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(2);
  };

  return (
    <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-100 shadow-sm' : 'bg-white/5 border-white/5'}`}>
      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex flex-col gap-0.5">
        <span className={`text-2xl font-black tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{formatVal(c)}{suffix}</span>
        <span className="text-[9px] font-bold text-zinc-500 opacity-50 italic">prev: {formatVal(p)}{suffix}</span>
      </div>
      <div className="mt-2">
        <TrendIndicator value={diff} inverse={inverse} />
      </div>
    </div>
  );
}

function ActivityItem({ label, value, theme }: any) {
  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between ${theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-white/5 border-white/5'}`}>
      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
      <span className={`text-xl font-black ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function KeywordDetailsModal({ clientId, clientName, type, startDate, endDate, theme, onClose }: any) {
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const data = await getKeywordRankingDetails(clientId, { startDate, endDate });
        const allKeywords = data.keywords || [];
        
        // Filter based on type
        const filtered = allKeywords.filter((kw: any) => {
          if (type === 'top3') return kw.position <= 3;
          if (type === 'top10') return kw.position <= 10;
          return true;
        }).sort((a: any, b: any) => b.clicks - a.clicks);
        
        setKeywords(filtered);
      } catch (e) {
        console.error('Failed to fetch keyword details:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [clientId, type, startDate, endDate]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
      <div 
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      <div className={`relative w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-[40px] border shadow-2xl flex flex-col ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/10'
      }`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-black tracking-tighter uppercase italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
              {type === 'top3' ? 'Top 3' : 'Top 10'} Keywords
            </h2>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{clientName} • {startDate} to {endDate}</p>
          </div>
          <button 
            onClick={onClose}
            className={`p-3 rounded-2xl transition-colors ${theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCcw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : keywords.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No keywords found in this range.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest">Keyword</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Pos</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Clicks</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Impr</th>
                  <th className="pb-4 text-[10px] font-black text-zinc-500 uppercase tracking-widest text-right">Ranking Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keywords.map((kw, i) => (
                  <tr key={i} className="group hover:bg-white/5 transition-colors">
                    <td className="py-4">
                      <div className={`text-sm font-black tracking-tight ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                        {kw.keyword}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        kw.position <= 3 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        #{kw.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center font-bold text-xs">{kw.clicks}</td>
                    <td className="py-4 text-center font-bold text-xs opacity-60">
                      {kw.impressions >= 1000 ? (kw.impressions / 1000).toFixed(1) + 'K' : kw.impressions}
                    </td>
                    <td className="py-4 text-right">
                      <a 
                        href={kw.page} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-black text-blue-500 hover:underline uppercase tracking-widest"
                      >
                        View Page <ArrowUpRight size={10} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
