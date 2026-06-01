import { useState, useEffect } from 'react';
import React from 'react';
import { 
  Target, 
  MousePointer, 
  Globe, 
  FileText, 
  Sparkles, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  Edit2, 
  X, 
  ChevronRight,
  User,
  Circle
} from 'lucide-react';
import { getClients, updateClient, Client, WeeklyData, getWeeklyData, getLiveMetrics, getMonthlyCache, triggerMonthlySync } from '../services/dataService';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import Tooltip from '../components/Tooltip';
import NextActionModal from '../components/NextActionModal';

interface ClientWithActuals extends Client {
  actualClicks: number;
  actualSessions: number;
  actualBlogs: number;
  actualLeads: number;
  actualDR: number;
  pendingActions?: any[];
}

export default function GoalsAndTargets() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';
  
  const [clients, setClients] = useState<ClientWithActuals[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<ClientWithActuals | null>(null);
  
  // Quick-editor states
  const [editForm, setEditForm] = useState({
    target_monthly_clicks: 0,
    target_monthly_sessions: 0,
    target_monthly_blogs: 0,
    lead_target_monthly: 0,
    target_dr: 0
  });

  // Calculate elapsed proportion of the current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDay = today.getDate();
  const elapsedPercent = (currentDay / daysInMonth) * 100;
  const daysRemaining = daysInMonth - currentDay;

  const monthName = today.toLocaleString('default', { month: 'long' });

  const [addingActionFor, setAddingActionFor] = useState<ClientWithActuals | null>(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchClientTargetsAndActuals = async (forceLive = false) => {
    if (forceLive) setIsLiveSyncing(true);
    setLoading(true);
    setError(null);
    try {
      const clientList = await getClients();
      
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const startOfMonth = `${currentYear}-${monthStr}-01`;
      
      // If live sync requested, trigger the server-side cron first to refresh the monthly cache
      if (forceLive) {
        const syncSuccess = await triggerMonthlySync();
        if (!syncSuccess) {
          throw new Error('Monthly cache sync request failed. Please check Google OAuth connectivity.');
        }
      }
      
      // Fetch monthly cache records and pending actions in parallel
      const [monthlyRecords, actionsData] = await Promise.all([
        getMonthlyCache(startOfMonth),
        supabase
          .from('client_actions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      ]);

      const pendingActionsData = actionsData?.data || [];

      // Map monthly cache metrics directly
      const enrichedClients = clientList.map((client) => {
        const cacheRecord = monthlyRecords.find(r => r.client_id === client.id);

        const actualClicks = cacheRecord?.gsc_clicks || 0;
        const actualSessions = cacheRecord?.ga4_traffic || 0;
        const actualBlogs = cacheRecord?.blogs_published || 0;
        const actualLeads = cacheRecord?.leads_total || 0;
        const actualDR = cacheRecord?.ahrefs_dr || 0;
        
        const pendingActions = pendingActionsData.filter(a => a.client_id === client.id);

        return {
          ...client,
          actualClicks,
          actualSessions,
          actualBlogs,
          actualLeads,
          actualDR,
          pendingActions
        };
      });

      setClients(enrichedClients);
      if (forceLive) {
        setSuccessMsg('Live monthly target and performance cache successfully synced!');
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (err: any) {
      console.error('Error fetching goals data:', err);
      setError(err.message || 'Live monthly sync failed.');
    } finally {
      setLoading(false);
      setIsLiveSyncing(false);
    }
  };

  useEffect(() => {
    fetchClientTargetsAndActuals();
  }, []);

  const handleOpenEditor = (client: ClientWithActuals) => {
    setEditingClient(client);
    setEditForm({
      target_monthly_clicks: client.target_monthly_clicks || 0,
      target_monthly_sessions: client.target_monthly_sessions || 0,
      target_monthly_blogs: client.target_monthly_blogs || 0,
      lead_target_monthly: client.lead_target_monthly || 0,
      target_dr: client.target_dr || 0
    });
  };

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      await updateClient(editingClient.id, {
        target_monthly_clicks: Number(editForm.target_monthly_clicks),
        target_monthly_sessions: Number(editForm.target_monthly_sessions),
        target_monthly_blogs: Number(editForm.target_monthly_blogs),
        lead_target_monthly: Number(editForm.lead_target_monthly),
        target_dr: Number(editForm.target_dr)
      });

      alert('Targets updated successfully!');
      setEditingClient(null);
      fetchClientTargetsAndActuals();
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    }
  };

  // Helper algorithm to compute target stats
  const getTargetStats = (actual: number, target: number) => {
    if (!target || target <= 0) {
      return {
        percent: 0,
        remaining: 0,
        status: 'None' as const,
        color: isWhite ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-zinc-800 text-zinc-500 border-white/5',
        barColor: 'bg-zinc-600'
      };
    }

    const percent = Math.min(100, Math.round((actual / target) * 100));
    const remaining = Math.max(0, target - actual);
    
    let status: 'Achieved' | 'On Track' | 'Behind' | 'At Risk' = 'On Track';
    let color = '';
    let barColor = '';

    if (actual >= target) {
      status = 'Achieved';
      color = isWhite 
        ? 'bg-[#76c9be]/10 text-[#082a36] border-[#76c9be]/30' 
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      barColor = isWhite ? 'bg-[#76c9be]' : 'bg-emerald-500';
    } else {
      // If we are at the end of the month or >80% elapsed, and progress is low
      if (percent < 40 && elapsedPercent > 80) {
        status = 'At Risk';
        color = isWhite
          ? 'bg-rose-50 text-rose-700 border-rose-100'
          : 'bg-red-500/10 text-red-400 border-red-500/20';
        barColor = 'bg-red-500';
      } else if (percent < elapsedPercent) {
        status = 'Behind';
        color = isWhite
          ? 'bg-amber-50 text-amber-700 border-amber-100'
          : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
        barColor = 'bg-yellow-500';
      } else {
        status = 'On Track';
        color = isWhite
          ? 'bg-blue-50 text-blue-700 border-blue-100'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        barColor = 'bg-blue-500';
      }
    }

    return { percent, remaining, status, color, barColor };
  };

  const filteredClients = clients.filter(c => {
    if (!searchTerm.trim()) return true;
    const terms = searchTerm.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (terms.length === 0) return true;
    return terms.some(term =>
      c.name.toLowerCase().includes(term) ||
      (c.short_code || '').toLowerCase().includes(term) ||
      (c.project_owner_name || '').toLowerCase().includes(term)
    );
  });

  // Calculate aggregated agency scoreboard metrics
  const aggregateScoreboard = () => {
    let totalTargetClicks = 0;
    let totalActualClicks = 0;
    let totalTargetSessions = 0;
    let totalActualSessions = 0;
    let totalTargetBlogs = 0;
    let totalActualBlogs = 0;
    let totalTargetLeads = 0;
    let totalActualLeads = 0;

    clients.forEach(c => {
      totalTargetClicks += c.target_monthly_clicks || 0;
      totalActualClicks += c.actualClicks || 0;
      totalTargetSessions += c.target_monthly_sessions || 0;
      totalActualSessions += c.actualSessions || 0;
      totalTargetBlogs += c.target_monthly_blogs || 0;
      totalActualBlogs += c.actualBlogs || 0;
      totalTargetLeads += c.lead_target_monthly || 0;
      totalActualLeads += c.actualLeads || 0;
    });

    return {
      clicks: { actual: totalActualClicks, target: totalTargetClicks },
      sessions: { actual: totalActualSessions, target: totalTargetSessions },
      blogs: { actual: totalActualBlogs, target: totalTargetBlogs },
      leads: { actual: totalActualLeads, target: totalTargetLeads }
    };
  };

  const scoreboard = aggregateScoreboard();

  return (
    <div className="space-y-8 pb-16">
      {/* Title Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className={`text-2xl font-medium font-heading  tracking-tighter italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
            Goals & Performance Targets
          </h2>
          <p className={`text-sm font-medium   mt-1 italic ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
            Month-end target velocity • {monthName} {currentYear} • {daysRemaining} Days Remaining
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isWhite ? 'text-[#607a80]' : 'text-zinc-600'}`} size={16} />
            <input 
              type="text" 
              placeholder="Search clients..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-12 pr-6 py-2.5 border rounded-2xl text-sm font-medium focus:outline-none transition-all w-64   ${
                isWhite ? 'bg-[#76c9be]/5 border-[#163f4d]/10 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-white focus:border-blue-500'
              }`}
            />
          </div>
              <button
                onClick={() => fetchClientTargetsAndActuals(true)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium   transition-all shadow-xl active:scale-95 ${
                  isWhite 
                    ? 'bg-[#76c9be] text-white hover:bg-[#5bb8ad] shadow-[#76c9be]/20' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                <Clock size={14} className={isLiveSyncing ? 'animate-spin' : ''} />
                Live Sync
              </button>
        </div>
      </div>

      {/* Elapsed month indicator panel */}
      <Tooltip content="Tracks calendar progression to gauge target run-rates; alerts trigger when actual success lags elapsed days" className="w-full">
        <div className={`p-6 rounded-[24px] border shadow-2xl overflow-hidden relative backdrop-blur-xl w-full ${
          isWhite ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5'
        }`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <h3 className={`text-sm font-medium   ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                Month Elapsed Progress
              </h3>
              <p className={`text-sm font-medium   ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                Velocity status is measured against the current elapsed {elapsedPercent.toFixed(1)}% of the calendar month
              </p>
            </div>
            <div className="w-full md:w-2/3 space-y-2">
              <div className="flex justify-between text-sm font-medium   text-zinc-500">
                <span>Day 1</span>
                <span className={isWhite ? 'text-[#76c9be]' : 'text-emerald-500'}>Today: Day {currentDay} ({elapsedPercent.toFixed(0)}%)</span>
                <span>Day {daysInMonth}</span>
              </div>
              <div className={`h-3 rounded-full overflow-hidden ${isWhite ? 'bg-zinc-100' : 'bg-zinc-950'}`}>
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${isWhite ? 'bg-[#76c9be]' : 'bg-emerald-500'}`}
                  style={{ width: `${elapsedPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Tooltip>

      {/* Agency-wide Aggregate Scoreboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Clicks (GSC)', score: scoreboard.clicks, icon: MousePointer, color: 'text-blue-500', barColor: 'bg-blue-500', tooltip: 'Aggregated click-through traffic from Search Console across all active client properties' },
          { label: 'Total Sessions (GA4)', score: scoreboard.sessions, icon: Globe, color: 'text-emerald-500', barColor: 'bg-emerald-500', tooltip: 'Aggregated session metrics from Google Analytics 4 tracked across all active client nodes' },
          { label: 'Total Blogs Published', score: scoreboard.blogs, icon: FileText, color: 'text-amber-500', barColor: 'bg-amber-500', tooltip: 'Total successful blog posts published inside the active month across the agency' },
          { label: 'Total organic Leads', score: scoreboard.leads, icon: Sparkles, color: 'text-purple-500', barColor: 'bg-purple-500', tooltip: 'Aggregated organic conversions and marketing leads generated for all active properties' }
        ].map((item, idx) => {
          const pct = item.score.target > 0 ? Math.min(100, Math.round((item.score.actual / item.score.target) * 100)) : 0;
          return (
            <Tooltip key={idx} content={item.tooltip} className="w-full">
              <div 
                className={`p-6 rounded-[24px] border shadow-xl backdrop-blur-xl flex flex-col justify-between h-full w-full ${
                  isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-medium   ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                      {item.label}
                    </p>
                    <h4 className={`text-xl font-medium font-mono tracking-tight mt-1 ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                      {item.score.actual.toLocaleString()}
                      <span className={`text-sm font-medium tracking-normal ${isWhite ? 'text-zinc-400' : 'text-zinc-600'} ml-1`}>
                        / {item.score.target.toLocaleString()} target
                      </span>
                    </h4>
                  </div>
                  <div className={`p-2.5 rounded-xl ${isWhite ? 'bg-zinc-100' : 'bg-zinc-800'} ${item.color}`}>
                    <item.icon size={16} />
                  </div>
                </div>

                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium  ">
                    <span className={isWhite ? 'text-zinc-400' : 'text-zinc-600'}>Agency Success Velocity</span>
                    <span className={isWhite ? 'text-[#082a36]' : 'text-white'}>{pct}%</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isWhite ? 'bg-zinc-100' : 'bg-zinc-950'}`}>
                    <div 
                      className={`h-full rounded-full ${item.barColor} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>

      {/* Clients Target Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className={`p-8 h-80 rounded-[24px] border animate-pulse ${isWhite ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/50 border-white/5'}`} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className={`p-20 text-center rounded-[24px] border ${isWhite ? 'bg-white border-zinc-100' : 'bg-zinc-900/30 border-white/5'}`}>
          <Target size={48} className="mx-auto text-zinc-600 mb-4" />
          <h4 className={`text-base font-medium   ${isWhite ? 'text-zinc-600' : 'text-zinc-400'}`}>
            No Client Nodes Found
          </h4>
          <p className="text-sm text-zinc-500   mt-1">
            Create or edit client nodes to begin measuring goals
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredClients.map((client) => {
            const metrics = [
              { label: 'Clicks (GSC)', key: 'clicks', actual: client.actualClicks, target: client.target_monthly_clicks || 0, icon: MousePointer, color: 'text-blue-400' },
              { label: 'Sessions (GA4)', key: 'sessions', actual: client.actualSessions, target: client.target_monthly_sessions || 0, icon: Globe, color: 'text-emerald-400' },
              { label: 'Blogs Published', key: 'blogs', actual: client.actualBlogs, target: client.target_monthly_blogs || 0, icon: FileText, color: 'text-amber-400' },
              { label: 'Monthly Leads', key: 'leads', actual: client.actualLeads, target: client.lead_target_monthly || 0, icon: Sparkles, color: 'text-purple-400' },
              { label: 'Domain Rating (DR)', key: 'dr', actual: client.actualDR, target: client.target_dr || 0, icon: Target, color: 'text-rose-400' }
            ];

            return (
              <div 
                key={client.id}
                className={`p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl flex flex-col justify-between transition-all hover:scale-[1.01] duration-300 relative group ${
                  isWhite ? 'bg-white border-[#163f4d]/10 hover:shadow-lg' : 'bg-zinc-900/50 border-white/5 hover:border-white/10'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-4 mb-6 border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-medium text-sm  border shadow-xl ${
                      isWhite 
                        ? 'bg-[#76c9be]/5 text-[#082a36] border-[#163f4d]/10' 
                        : 'bg-zinc-800 text-blue-400 border-white/5'
                    }`}>
                      {client.short_code}
                    </div>
                    <div>
                      <h3 className={`font-medium font-heading  tracking-tight text-sm italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                        {client.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-sm font-medium px-2 py-0.5 rounded-full border   ${
                          isWhite ? 'text-[#607a80] bg-[#76c9be]/5 border-[#163f4d]/5' : 'text-zinc-400 bg-zinc-800 border-white/5'
                        }`}>
                          Owner: {client.project_owner_code || 'MW'}
                        </span>
                        <span className="text-sm text-zinc-600  ">{client.timezone}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setAddingActionFor(client)}
                      className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border text-sm font-medium   transition-all ${
                        isWhite 
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-[#76c9be]/10 hover:text-[#082a36] hover:border-[#76c9be]/30' 
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/20'
                      }`}
                      title="Add Next Action for this client"
                    >
                      <Sparkles size={10} />
                      Action
                    </button>
                    <button 
                      onClick={() => handleOpenEditor(client)}
                      className={`p-2 rounded-xl border transition-all ${
                        isWhite 
                          ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-[#f47b20]/10 hover:text-[#f47b20] hover:border-[#f47b20]/20' 
                          : 'bg-zinc-900 border-white/5 text-zinc-400 hover:bg-blue-600/10 hover:text-blue-400 hover:border-blue-500/20'
                      }`}
                      title="Quick Edit targets"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Target metrics grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {metrics.map((metric, mIdx) => {
                    const stats = getTargetStats(metric.actual, metric.target);
                    const metricTooltip = metric.target > 0
                      ? `Monthly actual: ${metric.actual.toLocaleString()} against target ${metric.target.toLocaleString()}. Status: ${stats.status} (${stats.percent}% achieved)`
                      : `Set up monthly targets for ${metric.label} using the client edit button`;
                    return (
                      <Tooltip key={mIdx} content={metricTooltip} className="w-full">
                        <div 
                          className={`p-4 rounded-2xl border w-full text-left h-full ${
                            isWhite ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-950/40 border-white/5'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-1.5">
                              <metric.icon size={12} className={metric.color} />
                              <span className={`text-sm font-medium   ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                                {metric.label}
                              </span>
                            </div>
                            {metric.target > 0 ? (
                              <span className={`px-2 py-0.5 rounded-lg border text-sm font-medium   transition-all ${stats.color}`}>
                                {stats.status}
                              </span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-lg border text-sm font-medium   ${isWhite ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-zinc-900 text-zinc-600 border-white/5'}`}>
                                Unset
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex items-baseline gap-1">
                            <span className={`text-lg font-medium font-mono tracking-tight ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                              {metric.actual.toLocaleString()}
                            </span>
                            <span className={`text-sm font-medium ${isWhite ? 'text-zinc-400' : 'text-zinc-600'}`}>
                              / {metric.target > 0 ? metric.target.toLocaleString() : '-'} target
                            </span>
                          </div>

                          {metric.target > 0 ? (
                            <div className="mt-3 space-y-1.5">
                              <div className="h-1.5 rounded-full overflow-hidden bg-zinc-800/10 dark:bg-zinc-950">
                                <div 
                                  className={`h-full rounded-full ${stats.barColor} transition-all duration-500`}
                                  style={{ width: `${stats.percent}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-sm font-medium   text-zinc-500">
                                <span>{stats.percent}% achieved</span>
                                <span>
                                  {stats.remaining > 0 ? `${stats.remaining.toLocaleString()} remaining` : 'achieved!'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-zinc-600   font-medium mt-4">
                              Setup target to activate tracking
                            </p>
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                  {/* Render Pending Actions as the 6th card in the grid to fill empty space */}
                  <div className={`p-4 rounded-2xl border w-full text-left h-full flex flex-col ${
                    isWhite ? 'bg-[#76c9be]/5 border-[#76c9be]/10' : 'bg-blue-600/5 border-blue-500/10'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Target size={12} className={isWhite ? 'text-[#082a36]' : 'text-blue-400'} />
                        <span className={`text-sm font-medium   ${isWhite ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                          Pending Actions
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg border text-sm font-medium   ${isWhite ? 'bg-white text-zinc-600 border-zinc-200' : 'bg-zinc-900 text-zinc-400 border-white/5'}`}>
                        {client.pendingActions?.length || 0}
                      </span>
                    </div>
                    {client.pendingActions && client.pendingActions.length > 0 ? (
                      <div className="flex flex-col gap-1.5 overflow-y-auto pr-2 custom-scrollbar flex-1">
                        {client.pendingActions.map(action => (
                          <div key={action.id} className="flex items-start gap-1.5">
                            <Circle size={6} className={`mt-1 shrink-0 ${isWhite ? 'text-[#76c9be]' : 'text-emerald-500'} fill-current`} />
                            <span className={`text-sm leading-snug font-medium ${isWhite ? 'text-zinc-700' : 'text-zinc-400'} line-clamp-2`} title={action.action_text}>
                              {action.action_text}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center justify-center flex-1 text-center ${isWhite ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        <span className="text-sm  font-medium  mt-2">No pending actions</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Editor Slide-Over Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className={`w-full max-w-md rounded-[28px] border shadow-2xl overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-200 ${
              isWhite ? 'bg-white border-[#163f4d]/20 text-[#082a36]' : 'bg-zinc-950 border-white/10 text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4 mb-6 border-white/5">
              <div>
                <h4 className="text-base font-medium  tracking-tight italic">
                  Quick Adjust Targets
                </h4>
                <p className={`text-sm font-medium   mt-0.5 ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                  {editingClient.name} • {monthName} Targets
                </p>
              </div>
              <button 
                onClick={() => setEditingClient(null)}
                className={`p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all ${
                  isWhite ? 'text-zinc-400 hover:text-zinc-600' : 'text-zinc-500 hover:text-white'
                }`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveTargets} className="space-y-5">
              <div className="space-y-4">
                {/* 1. Monthly Clicks */}
                <Tooltip content="Set the targeted number of Google Search Console organic clicks to achieve per calendar month" className="w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium   text-zinc-500 flex items-center gap-1.5">
                      <MousePointer size={10} className="text-blue-400" />
                      Target Monthly Clicks (GSC)
                    </label>
                    <input 
                      type="number" 
                      value={editForm.target_monthly_clicks}
                      onChange={(e) => setEditForm(prev => ({ ...prev, target_monthly_clicks: Number(e.target.value) }))}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </Tooltip>

                {/* 2. Monthly Sessions */}
                <Tooltip content="Set the targeted number of Google Analytics 4 sessions to achieve per calendar month" className="w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium   text-zinc-500 flex items-center gap-1.5">
                      <Globe size={10} className="text-emerald-400" />
                      Target Monthly Sessions (GA4)
                    </label>
                    <input 
                      type="number" 
                      value={editForm.target_monthly_sessions}
                      onChange={(e) => setEditForm(prev => ({ ...prev, target_monthly_sessions: Number(e.target.value) }))}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </Tooltip>

                {/* 3. Target Blogs */}
                <Tooltip content="Set the monthly content production goal for blogs and article nodes" className="w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium   text-zinc-500 flex items-center gap-1.5">
                      <FileText size={10} className="text-amber-400" />
                      Target blogs published
                    </label>
                    <input 
                      type="number" 
                      value={editForm.target_monthly_blogs}
                      onChange={(e) => setEditForm(prev => ({ ...prev, target_monthly_blogs: Number(e.target.value) }))}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </Tooltip>

                {/* 4. Monthly Leads */}
                <Tooltip content="Set the targeted number of qualified organic leads to generate for this client per calendar month" className="w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium   text-zinc-500 flex items-center gap-1.5">
                      <Sparkles size={10} className="text-purple-400" />
                      Target Monthly Leads
                    </label>
                    <input 
                      type="number" 
                      value={editForm.lead_target_monthly}
                      onChange={(e) => setEditForm(prev => ({ ...prev, lead_target_monthly: Number(e.target.value) }))}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </Tooltip>

                {/* 5. Target DR */}
                <Tooltip content="Set the target Ahrefs Domain Rating (DR) to achieve for this client node" className="w-full">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium   text-zinc-500 flex items-center gap-1.5">
                      <Target size={10} className="text-rose-400" />
                      Target Domain Rating (DR)
                    </label>
                    <input 
                      type="number" 
                      value={editForm.target_dr}
                      onChange={(e) => setEditForm(prev => ({ ...prev, target_dr: Number(e.target.value) }))}
                      className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${
                        isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </Tooltip>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className={`w-1/2 py-2.5 rounded-xl border text-sm font-medium   transition-all ${
                    isWhite ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200' : 'bg-zinc-900 hover:bg-zinc-800 border-white/5'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className={`w-1/2 py-2.5 rounded-xl font-medium text-sm   hover:brightness-110 active:scale-95 transition-all shadow-lg ${
                    isWhite ? 'bg-[#082a36] text-white' : 'bg-blue-600 text-white shadow-blue-500/20'
                  }`}
                >
                  Save Targets
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {addingActionFor && (
        <NextActionModal
          client={addingActionFor}
          onClose={() => setAddingActionFor(null)}
          onSuccess={() => {
            setAddingActionFor(null);
            fetchClientTargetsAndActuals(); // Light refetch without forceLive
          }}
        />
      )}

      {/* Floating Success Notification Toast */}
      {successMsg && (
        <div className={`print:hidden fixed top-6 right-6 z-50 p-5 rounded-[20px] border flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 fade-in duration-300 max-w-sm ${
          isWhite ? 'bg-white/95 border-[#76c9be]/40 text-[#082a36]' : 'bg-zinc-950/95 border-emerald-500/20 text-emerald-400'
        }`}>
          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-500 animate-bounce" size={16} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold tracking-wider uppercase text-zinc-500">Live Sync Successful</h5>
              <button onClick={() => setSuccessMsg(null)} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium leading-none ml-2 transition-all">🞨</button>
            </div>
            <p className="text-sm font-medium mt-1 leading-normal break-words">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Floating Error Notification Toast */}
      {error && (
        <div className={`print:hidden fixed top-6 right-6 z-50 p-5 rounded-[20px] border flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 fade-in duration-300 max-w-sm ${
          isWhite ? 'bg-white/95 border-rose-200 text-rose-950' : 'bg-zinc-950/95 border-red-500/20 text-red-400'
        }`}>
          <AlertCircle className="shrink-0 mt-0.5 text-rose-500 animate-pulse" size={16} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold tracking-wider uppercase text-zinc-500">Live Sync Failed</h5>
              <button onClick={() => setError(null)} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium leading-none ml-2 transition-all">🞨</button>
            </div>
            <p className="text-sm font-medium mt-1 leading-normal break-words">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
