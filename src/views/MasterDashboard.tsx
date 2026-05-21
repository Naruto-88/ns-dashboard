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
  TrendingDown
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
  const { theme } = useTheme();
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
    let result = rows;
    if (searchTerm.trim()) {
      const terms = searchTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      result = rows.filter(r =>
        terms.some(term =>
          r.client.name.toLowerCase().includes(term) ||
          r.client.short_code.toLowerCase().includes(term)
        )
      );
    }

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
            aValue = a.gscTraffic.top10 || a.currentData?.top_10_count || 0;
            bValue = b.gscTraffic.top10 || b.currentData?.top_10_count || 0;
            break;
          case 'top3':
            aValue = a.gscTraffic.top3 || a.currentData?.top_3_count || 0;
            bValue = b.gscTraffic.top3 || b.currentData?.top_3_count || 0;
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
    <div className="space-y-8 pb-12">
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[40px] border relative z-50 ${theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5 backdrop-blur-2xl'
        }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${theme === 'white' ? 'bg-[#76c9be] shadow-[#76c9be]/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h2 className={`text-3xl font-black font-heading tracking-tighter uppercase italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Master Dashboard</h2>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest leading-none">Cross-Property Intelligence</p>
                {viewingPeriod && (
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-blue-600/10 text-blue-600'}`}>
                    {format(viewingPeriod.start, 'MMM dd')} - {format(viewingPeriod.end, 'MMM dd, yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className={`p-1.5 rounded-2xl flex gap-1 border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800 border-white/5'
            }`}>
            <Tooltip content="Week over Week Performance">
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative ${viewMode === 'weekly'
                    ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
                    : theme === 'white'
                      ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-700'
                  }`}
              >
                Weekly (WoW)
              </button>
            </Tooltip>
            <Tooltip content="Month over Month Performance">
              <button
                onClick={() => setViewMode('monthly')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative ${viewMode === 'monthly'
                    ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
                    : theme === 'white'
                      ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-700'
                  }`}
              >
                Monthly (MoM)
              </button>
            </Tooltip>
            <Tooltip content="Rolling Last 7 Days vs Previous 7 Days">
              <button
                onClick={() => setViewMode('rolling')}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative ${viewMode === 'rolling'
                    ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
                    : theme === 'white'
                      ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-700'
                  }`}
              >
                Rolling 7D
              </button>
            </Tooltip>
          </div>

          {viewMode === 'custom' && (
            <div className={`p-1.5 rounded-2xl flex items-center gap-2 border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800 border-white/5'}`}>
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className={`bg-transparent text-[10px] font-black uppercase outline-none px-2 ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}
              />
              <Minus size={12} className="text-zinc-500" />
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className={`bg-transparent text-[10px] font-black uppercase outline-none px-2 ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}
              />
              <button 
                onClick={() => setViewMode('weekly')}
                className="p-1 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <button 
            onClick={() => setViewMode('custom')}
            className={`p-2.5 rounded-xl border transition-all ${
              viewMode === 'custom'
                ? theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36] shadow-lg' : 'bg-blue-600 text-white border-blue-600 shadow-lg'
                : theme === 'white'
                  ? 'bg-white border-[#163f4d]/10 text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10'
                  : 'bg-zinc-800 border-white/5 text-zinc-500 hover:text-white hover:bg-zinc-700'
            }`}
          >
            <Calendar size={18} />
          </button>

          <div className="relative group">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${theme === 'white' ? 'text-[#607a80] group-focus-within:text-[#76c9be]' : 'text-zinc-500 group-focus-within:text-blue-500'}`} size={18} />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 pr-6 py-2.5 border rounded-2xl text-sm font-bold outline-none transition-all ${theme === 'white' 
                ? 'bg-white border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' 
                : 'bg-zinc-800 border-white/5 text-white focus:border-blue-500'
                } w-48`}
            />
          </div>
        </div>
      </div>

      <div className={`rounded-[20px] border backdrop-blur-xl shadow-2xl overflow-hidden ${theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
        }`}>
        <div className="overflow-x-auto overflow-y-visible custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-[30]">
              <tr className={`border-b ${theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20' : 'bg-zinc-950/90 border-white/5 backdrop-blur-xl'}`}>
                <th
                  className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest sticky left-0 z-[40] border-r cursor-pointer transition-colors rounded-tl-[20px] ${
                    theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20 text-white hover:text-[#76c9be]' : 'bg-zinc-950 border-white/5 shadow-[2px_0_10px_rgba(3,7,18,0.5)] text-[#607a80] hover:text-[#76c9be]'
                  }`}
                  onClick={() => handleSort('client')}
                  style={{ width: '80px' }}
                >
                  <div className="flex items-center gap-2">
                    CODE
                    {sortConfig?.key === 'client' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('pm')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Project Manager Code" position="bottom">PM</Tooltip>
                    {sortConfig?.key === 'pm' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('leads')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Verified high-quality leads" position="bottom">Legit Leads</Tooltip>
                    {sortConfig?.key === 'leads' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('top3')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Keywords in top 3 positions" position="bottom">Top 3</Tooltip>
                    {sortConfig?.key === 'top3' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('top10')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Actual vs Target keywords in top 10" position="bottom">Top 10 (A/T)</Tooltip>
                    {sortConfig?.key === 'top10' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`} onClick={() => handleSort('ctr')}>
                  <div className="flex items-center justify-center gap-1">
                    Avg CTR {sortConfig?.key === 'ctr' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`} onClick={() => handleSort('impressions')}>
                  <div className="flex items-center justify-center gap-1">
                    Impressions {sortConfig?.key === 'impressions' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-4 text-center text-[10px] font-black uppercase tracking-widest cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`} onClick={() => handleSort('position')}>
                  <div className="flex items-center justify-center gap-1">
                    Avg Pos {sortConfig?.key === 'position' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('gsc')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Current vs Previous GSC Clicks" position="bottom">GSC Traffic (C/P)</Tooltip>
                    {sortConfig?.key === 'gsc' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer hover:text-[#76c9be] transition-colors ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`} onClick={() => handleSort('ga4')}>
                  <div className="flex items-center justify-center gap-2">
                    <Tooltip content="Current vs Previous GA4 Users" position="bottom">GA4 Traffic (C/P)</Tooltip>
                    {sortConfig?.key === 'ga4' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`}>
                  <Tooltip content="Weekly production activities" position="bottom">Activity</Tooltip>
                </th>
                <th className={`px-4 py-5 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`}>Intelligence</th>
                <th className={`px-8 py-2 text-[10px] font-black uppercase tracking-widest text-center sticky right-0 z-[40] border-l cursor-pointer hover:text-[#76c9be] transition-colors rounded-tr-[20px] ${
                  theme === 'white' ? 'bg-[#082a36] text-white border-[#163f4d]/20' : 'bg-inherit text-[#607a80] shadow-[-2px_0_10px_rgba(3,7,18,0.5)]'
                }`} onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-2">
                    Status
                    {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'white' ? 'divide-[#163f4d]/5' : 'divide-white/5'}`}>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={12} className={`px-6 py-8 ${theme === 'white' ? 'bg-zinc-50' : 'bg-white/5'}`} />
                  </tr>
                ))
              ) : filteredRows.map((row) => (
                <tr key={row.client.id} className={`transition-colors group ${theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                  <td className={`px-6 py-2 sticky left-0 z-[19] border-r transition-colors ${theme === 'white' ? 'bg-white border-zinc-100 group-hover:bg-zinc-50' : 'bg-zinc-900 group-hover:bg-zinc-800 border-white/5 shadow-[2px_0_10px_rgba(3,7,18,0.5)]'
                    }`}>
                    <Tooltip content={row.client.name} position="right">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs uppercase ring-1 transition-all ${theme === 'white'
                          ? 'bg-[#76c9be]/10 text-[#76c9be] ring-[#76c9be]/20 group-hover:bg-[#082a36] group-hover:text-white'
                          : 'bg-blue-600/10 text-blue-500 ring-blue-500/20 group-hover:bg-blue-600 group-hover:text-white'
                        }`}>
                        {row.client.short_code}
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-4">
                    <Tooltip content={`Project Officer: ${row.client.project_owner_name}`} className="flex justify-center">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black border transition-colors ${theme === 'white' ? 'bg-[#76c9be]/5 text-[#607a80] border-[#163f4d]/10 group-hover:bg-[#76c9be]/10' : 'bg-zinc-800 text-zinc-400 border-white/5 group-hover:bg-zinc-700 group-hover:text-white'
                        }`}>
                        {row.client.project_owner_code}
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingLeads?.clientId === row.client.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          autoFocus
                          type="number"
                          className={`w-16 px-2 py-1.5 text-xs font-black border rounded-lg outline-none ring-4 ${theme === 'white' ? 'bg-white border-blue-500 text-zinc-900 ring-blue-500/5' : 'bg-zinc-800 border-blue-500 text-white ring-blue-500/10'
                            }`}
                          value={editingLeads.value}
                          onChange={(e) => setEditingLeads({ ...editingLeads, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleLeadsUpdate(row);
                            if (e.key === 'Escape') setEditingLeads(null);
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        className="space-y-1 cursor-pointer select-none"
                        onDoubleClick={() => setEditingLeads({ clientId: row.client.id, value: row.leads.legit.toString() })}
                      >
                        <div className="flex flex-col items-center">
                          <span className={`font-black font-heading text-xs tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{row.leads.legit}</span>
                          <TrendIndicator value={row.leads.change} theme={theme} />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
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
                      <span className={`font-black text-xs tracking-tighter ${theme === 'white' ? 'text-blue-600' : 'text-blue-400'}`}>
                        {row.gscTraffic.top3 || row.currentData?.top_3_count || 0}
                      </span>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest opacity-60">LIVE</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
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
                      <span className={`font-black text-xs tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {row.gscTraffic.top10 || row.currentData?.top_10_count || 0}
                      </span>
                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">TAR: {row.client.top_10_target || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {row.gscTraffic.ctr.toFixed(2)}%
                      </span>
                      <TrendIndicator value={calculateChange(row.gscTraffic.ctr, row.gscTraffic.prevCtr)} theme={theme} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {(row.gscTraffic.impressions / 1000).toFixed(1)}K
                      </span>
                      <TrendIndicator value={calculateChange(row.gscTraffic.impressions, row.gscTraffic.prevImpressions)} theme={theme} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-xs font-black ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {(row.currentData?.tracked_keywords_avg_position || row.gscTraffic.position || 0).toFixed(1)}
                      </span>
                      <TrendIndicator value={calculatePosChange(row.currentData?.tracked_keywords_avg_position, row.prevData?.tracked_keywords_avg_position)} theme={theme} inverse />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Tooltip content={
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4"><span>CURRENT:</span> <span>{row.currentRangeStr}</span></div>
                        <div className="flex justify-between gap-4"><span>PREVIOUS:</span> <span>{row.prevRangeStr}</span></div>
                      </div>
                    }>
                      <div className="flex flex-col items-center">
                        <div className="flex items-baseline gap-1">
                          <span className={`font-black font-heading text-xs tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{row.gscTraffic.current.toLocaleString()}</span>
                          <span className="text-[9px] text-[#607a80] font-bold opacity-60">/ {row.gscTraffic.previous.toLocaleString()}</span>
                        </div>
                        <TrendIndicator value={row.gscTraffic.change} theme={theme} />
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Tooltip content={
                      <div className="space-y-1">
                        <div className="flex justify-between gap-4"><span>CURRENT:</span> <span>{row.currentRangeStr}</span></div>
                        <div className="flex justify-between gap-4"><span>PREVIOUS:</span> <span>{row.prevRangeStr}</span></div>
                      </div>
                    }>
                      <div className="flex flex-col items-center">
                        <div className="flex items-baseline gap-1">
                          <span className={`font-black font-heading text-xs tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{row.ga4Traffic.current.toLocaleString()}</span>
                          <span className="text-[9px] text-[#607a80] font-bold opacity-60">/ {row.ga4Traffic.previous.toLocaleString()}</span>
                        </div>
                        <TrendIndicator value={row.ga4Traffic.change} theme={theme} />
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className={`flex items-center justify-center gap-2 translate-y-1 border-t pt-2 ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
                      <MiniMetric
                        count={row.latestData?.blogs_published || row.currentData?.blogs_published || 0}
                        color="blue"
                        theme={theme}
                        tooltip="Blogs Published"
                        prefix="B"
                      />
                      <MiniMetric
                        count={row.latestData?.backlinks_built || row.currentData?.backlinks_built || 0}
                        color="purple"
                        theme={theme}
                        tooltip="Backlinks Built"
                        prefix="BL"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => setSelectedIntelligence({
                        client: row.client,
                        currentData: row.currentData,
                        latestData: row.latestData,
                        gsc: row.gscTraffic,
                        ga4: row.ga4Traffic
                      })}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] hover:bg-[#f47b20] hover:text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-blue-600 hover:text-white'
                        } shadow-lg`}
                    >
                      <Activity size={18} />
                    </button>
                  </td>
                  <td className="px-8 py-2 text-center sticky right-0 z-[19] border-l bg-inherit shadow-[-2px_0_10px_rgba(3,7,18,0.5)]">
                    <Tooltip content={`Performance Status: ${row.status.reason}`} position="top" align="end">
                      <div className={`w-3 h-3 rounded-full mx-auto ring-4 ${theme === 'white' ? 'ring-zinc-100' : 'ring-zinc-900'
                        } ${row.status.color === 'green' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' :
                          row.status.color === 'orange' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]' :
                            'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                        }`} />
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
    blue: 'bg-[#76c9be]',
    purple: 'bg-[#9333ea]',
    amber: 'bg-[#f47b20]'
  };
  return (
    <Tooltip content={tooltip}>
      <div className="flex flex-col items-center gap-0.5 group/metric cursor-default">
        <div className={`w-1 h-3 rounded-full transition-all group-hover/metric:h-4 ${count > 0 ? colors[color] : theme === 'white' ? 'bg-[#163f4d]/10' : 'bg-zinc-800'}`} />
        <span className={`text-[8px] font-black ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'} group-hover/metric:text-[#76c9be] transition-colors`}>
          <span className="opacity-40 mr-0.5">{prefix}</span>
          {count}
        </span>
      </div>
    </Tooltip>
  );
}

function TrendIndicator({ value, theme, inverse = false }: { value: number; theme?: string; inverse?: boolean }) {
  if (value === 0) return <div className={`flex items-center gap-1 text-[10px] font-bold ${theme === 'white' ? 'text-[#607a80]' : 'text-slate-400'}`}><Minus size={10} /> 0%</div>;

  const isPositive = inverse ? value < 0 : value > 0;
  const colorClass = isPositive ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#e24b4a]' : 'text-red-500');
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={`flex items-center gap-0.5 text-[10px] font-black ${colorClass}`}>
      <Icon size={12} />
      {Math.abs(value).toFixed(1)}%
    </div>
  );
}

function ActivityBadge({ count, label, color }: { count: number; label: string; color: 'blue' | 'purple' | 'amber' }) {
  const colors = {
    blue: 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20',
    purple: 'bg-[#9333ea]/10 text-[#9333ea] border-[#9333ea]/20',
    amber: 'bg-[#f47b20]/10 text-[#f47b20] border-[#f47b20]/20'
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
        <div className={`p-8 border-b flex items-center justify-between shrink-0 ${theme === 'white' ? 'border-[#163f4d]/10' : 'border-white/5'}`}>
          <div className="flex items-center gap-8">
            <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center shadow-2xl ${theme === 'white' ? 'bg-[#76c9be] shadow-[#76c9be]/40' : 'bg-blue-600 shadow-blue-600/40'}`}>
              <Activity className="text-white" size={32} />
            </div>
            <div>
              <h3 className={`text-4xl font-black font-heading tracking-tighter uppercase italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Mission Intelligence</h3>
              <p className="text-[#607a80] text-sm font-black uppercase tracking-[0.3em] mt-1">{data.client.name} • Search Performance Command</p>
            </div>
            <button 
              onClick={fetchAutoReport}
              className={`ml-4 px-4 py-2 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#082a36] hover:bg-[#76c9be]/20' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
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
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <AlertCircle size={20} className={`${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`} />
                  <span className="text-sm font-black text-[#607a80] uppercase tracking-widest">Performance Intelligence</span>
                </div>

                <div className="space-y-8">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Activity size={32} className={`${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-600'} animate-spin`} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#607a80]">Syncing with Google Search Console...</p>
                    </div>
                  ) : autoReport ? (
                    <div className={`text-sm leading-relaxed font-medium space-y-8 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                        <div className="grid grid-cols-4 gap-4">
                          <AutoMetric label="Total Clicks" curr={data.gsc.current} prev={data.gsc.previous} theme={theme} />
                          <AutoMetric label="Total Impressions" curr={data.gsc.current * 75} prev={data.gsc.previous * 75} theme={theme} format="K" />
                          <AutoMetric label="CTR" curr={((data.gsc.current / (data.gsc.current * 75 || 1)) * 100)} prev={((data.gsc.previous / (data.gsc.previous * 75 || 1)) * 100)} theme={theme} suffix="%" />
                          <AutoMetric label="Avg Position" curr={data.latestData?.tracked_keywords_avg_position || data.gsc.position || 22.7} prev={21.1} theme={theme} inverse />
                        </div>

                        <div className={`p-6 rounded-2xl border italic text-sm leading-relaxed ${theme === 'white' ? 'bg-[#76c9be]/5 border-[#76c9be]/10 text-[#082a36]' : 'bg-blue-50/50 border-blue-100 text-blue-800'}`}>
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
                          <p className={`font-black uppercase tracking-widest text-xs ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`}>Top Gaining Keywords</p>
                          <div className="grid grid-cols-1 gap-3">
                            {autoReport.gaining.slice(0, 10).map((k: any, i: number) => (
                              <p key={i} className="text-lg font-medium">• <span className={k.is_focus ? `${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} font-bold underline text-xl` : 'text-xl'}>{k.keys[0]}</span> – <span className="text-xl font-black font-heading">{k.clicks}</span> clicks (↑ {Math.max(1, k.clicks - (k.prevClicks || 0))})</p>
                            ))}
                          </div>
                        </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <Activity size={20} className={theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'} />
                  <span className="text-sm font-black text-[#607a80] uppercase tracking-widest">Activity & Keyword Trends</span>
                </div>

                <div className="space-y-6">
                  <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-black/20 border-white/5'}`}>
                    <p className={`text-xs font-black uppercase tracking-widest mb-3 ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`}>Work Detail Notes</p>
                    <div className="space-y-3">
                      {(data.latestData?.weekly_activity_summary || data.currentData?.weekly_activity_summary || data.latestData?.notes || 'No detailed activity notes recorded for this period.')
                        .split('\n')
                        .filter(line => line.trim())
                        .map((point, i) => (
                          <div key={i} className="flex gap-3 group/point">
                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 transition-transform group-hover/point:scale-125 ${theme === 'white' ? 'bg-[#76c9be] shadow-[0_0_8px_rgba(118,201,190,0.5)]' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`} />
                            <p className={`text-lg leading-relaxed font-medium break-words ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400'}`}>
                              {renderTextWithLinks(point.trim())}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>

                  {autoReport?.oneClickGainers.length > 0 && (
                    <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-blue-500/5 border-white/5'}`}>
                      <p className="text-lg italic opacity-80 leading-relaxed">
                        <span className={`font-black ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`}>The following keywords increased by 1 click each:</span> {autoReport.oneClickGainers.join(', ')}.
                      </p>
                    </div>
                  )}

                  {autoReport?.highImprNoClicks.length > 0 && (
                    <div className={`p-6 rounded-2xl border ${theme === 'white' ? 'bg-[#f47b20]/5 border-[#f47b20]/20' : 'bg-amber-500/5 border-white/5'}`}>
                      <p className={`font-black uppercase tracking-widest text-xs mb-2 ${theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}`}>High Impressions / No Clicks</p>
                      <p className={`italic text-lg leading-relaxed ${theme === 'white' ? 'text-[#f47b20]/80' : 'text-amber-500/80'}`}>
                        <span className="font-black">These keywords gained more impressions but did not generate clicks:</span> {autoReport.highImprNoClicks.join(', ')}.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-6">
              <div className={`p-8 rounded-[32px] border h-full ${theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900 border-white/5'}`}>
                <div className="flex items-center gap-3 mb-8">
                  <Activity size={20} className={theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'} />
                  <span className="text-sm font-black text-[#607a80] uppercase tracking-widest">Operations Hub</span>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-3">
                    <ActivityItem label="Blogs" value={data.latestData?.blogs_published || data.currentData?.blogs_published || 0} theme={theme} />
                    <ActivityItem label="Links" value={data.latestData?.backlinks_built || data.currentData?.backlinks_built || 0} theme={theme} color="text-purple-500" />
                    <ActivityItem label="Tech" value={data.latestData?.tech_fixes || data.currentData?.tech_fixes || 0} theme={theme} />
                    <ActivityItem label="Onsite" value={data.latestData?.pages_optimized || data.currentData?.pages_optimized || 0} theme={theme} />
                  </div>

                  <div className={`pt-6 border-t ${theme === 'white' ? 'border-[#76c9be]/10' : 'border-emerald-500/10'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-4 italic ${theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500'}`}>Next SEO Action Plan</p>
                    <p className={`text-2xl font-black font-heading tracking-tighter uppercase italic leading-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                      {data.latestData?.next_seo_action || data.currentData?.next_seo_action || 'No operational action planned.'}
                    </p>
                  </div>

                  <div className={`pt-8 border-t ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${data.gsc.change >= 0 ? (theme === 'white' ? 'bg-[#76c9be] shadow-[0_0_8px_#76c9be]' : 'bg-emerald-500 animate-pulse') : (theme === 'white' ? 'bg-[#f47b20]' : 'bg-amber-500')}`} />
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
    <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-white/5 border-white/5'}`}>
      <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{label}</p>
      <div className="flex flex-col gap-0.5">
        <span className={`text-2xl font-black font-heading tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{formatVal(c)}{suffix}</span>
        <span className={`text-[9px] font-bold opacity-50 italic ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>prev: {formatVal(p)}{suffix}</span>
      </div>
      <div className="mt-2">
        <TrendIndicator value={diff} theme={theme} inverse={inverse} />
      </div>
    </div>
  );
}

function ActivityItem({ label, value, theme, color }: any) {
  return (
    <div className={`p-4 rounded-2xl border flex items-center justify-between ${theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-white/5 border-white/5'}`}>
      <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{label}</span>
      <span className={`text-xl font-black font-heading ${color ? color : (theme === 'white' ? 'text-[#082a36]' : 'text-white')}`}>{value}</span>
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
        theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900 border-white/10'
      }`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className={`text-2xl font-black font-heading tracking-tighter uppercase italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              {type === 'top3' ? 'Top 3' : 'Top 10'} Keywords
            </h2>
            <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{clientName} • {startDate} to {endDate}</p>
          </div>
          <button 
            onClick={onClose}
            className={`p-3 rounded-2xl transition-colors ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#607a80] hover:bg-[#76c9be]/20' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCcw className={`animate-spin ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`} size={32} />
            </div>
          ) : keywords.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">No keywords found in this range.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20' : 'border-white/5'}`}>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-white' : 'text-[#607a80]'}`}>Keyword</th>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`}>Pos</th>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`}>Clicks</th>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-center ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`}>Impr</th>
                  <th className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest text-right ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`}>Ranking Page</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {keywords.map((kw, i) => (
                  <tr key={i} className={`group transition-colors ${theme === 'white' ? 'hover:bg-[#76c9be]/5' : 'hover:bg-white/5'}`}>
                    <td className="py-4">
                      <div className={`text-sm font-black tracking-tight ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {kw.keyword}
                      </div>
                    </td>
                    <td className="py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        kw.position <= 3 ? (theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-emerald-500/10 text-emerald-500') : (theme === 'white' ? 'bg-[#163f4d]/10 text-[#163f4d]' : 'bg-blue-500/10 text-blue-500')
                      }`}>
                        #{kw.position.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-4 text-center font-black text-xs text-[#082a36]">{kw.clicks}</td>
                    <td className="py-4 text-center font-black text-xs text-[#082a36]">
                      {kw.impressions >= 1000 ? (kw.impressions / 1000).toFixed(1) + 'K' : kw.impressions}
                    </td>
                    <td className="py-4 text-right">
                      <a 
                        href={kw.page} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-[10px] font-black hover:underline uppercase tracking-widest ${theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'}`}
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
