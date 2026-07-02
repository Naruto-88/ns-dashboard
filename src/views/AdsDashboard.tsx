import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  HelpCircle,
  Calendar,
  Globe,
  Share2,
  Mail,
  FileText,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  LineChart,
  Search,
  CheckSquare
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { getClients, Client, WeeklyAdsGrowth, getAdsGrowthData, updateAdsGrowthData, syncAdsGrowthData } from '../services/dataService';
import ClientSelector from '../components/ClientSelector';
import Tooltip from '../components/Tooltip';
import { ResponsiveContainer, LineChart as ReLineChart, XAxis, YAxis, Tooltip as ChartTooltip, Line, CartesianGrid } from 'recharts';

export default function AdsDashboard() {
  const { theme } = useTheme();
  const location = useLocation();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [adsData, setAdsData] = useState<WeeklyAdsGrowth[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [timeRange, setTimeRange] = useState<'week' | '3weeks' | 'month' | '90days'>('week');

  // Load clients list
  useEffect(() => {
    async function loadInitialData() {
      try {
        const c = await getClients();
        const adsClients = c.filter(client => client.has_paid_ads === true);
        setClients(adsClients);
        
        // Parse query parameter clientId
        const params = new URLSearchParams(location.search);
        const clientIdParam = params.get('clientId');
        if (clientIdParam) {
          setSelectedClient(clientIdParam);
        } else if (adsClients.length > 0) {
          setSelectedClient(adsClients[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, [location]);

  // Load selected client ads data
  useEffect(() => {
    if (!selectedClient) return;
    async function loadClientAdsData() {
      setLoading(true);
      try {
        const data = await getAdsGrowthData(selectedClient);
        setAdsData(data);
        if (data.length > 0) {
          setSelectedWeek(data[0].week_start_date);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadClientAdsData();
  }, [selectedClient]);

  const activeRecord = useMemo(() => {
    return adsData.find(d => d.week_start_date === selectedWeek) || null;
  }, [adsData, selectedWeek]);

  const currentClient = clients.find(c => c.id === selectedClient);

  // Sync handler
  const handleSync = async () => {
    if (!selectedClient || !selectedWeek) return;
    setSyncing(true);
    try {
      const data = await syncAdsGrowthData(selectedClient, selectedWeek);
      if (data) {
        const updatedList = await getAdsGrowthData(selectedClient);
        setAdsData(updatedList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  // Advanced metric calculations mimicking screenshot
  const targetLeads = currentClient?.lead_target_monthly ? Math.round(currentClient.lead_target_monthly / 4) : 8;
  const qualLeads = (activeRecord?.meta_leads || 0) + (activeRecord?.seo_organic_leads || 0);
  const totalSpend = (activeRecord?.google_ads_spend || 0) + (activeRecord?.meta_spend || 0);
  const cpl = qualLeads > 0 ? totalSpend / qualLeads : 0;
  const baselineCpl = 100;

  // Chart data formatting
  const chartData = useMemo(() => {
    return [...adsData].reverse().map((r, index) => {
      const gSpend = r.google_ads_spend || 0;
      const mSpend = r.meta_spend || 0;
      const qLeads = (r.meta_leads || 0) + (r.seo_organic_leads || 0);
      const totalCpl = qLeads > 0 ? (gSpend + mSpend) / qLeads : 0;
      return {
        name: `W-${4 - index}`,
        Leads: qLeads,
        CPL: Math.round(totalCpl),
        Target: targetLeads
      };
    });
  }, [adsData, targetLeads]);

  return (
    <div className={`p-6 min-h-screen space-y-6 ${theme === 'white' ? 'bg-[#f4f7f6]' : 'bg-[#081f26] text-white'}`}>
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs opacity-50 uppercase tracking-widest font-semibold block">DRI Operations</span>
          <h1 className="text-2xl font-bold font-heading italic mt-1">
            {currentClient?.name || 'Extend a Home'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time range selection */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/40 text-xs">
            {(['week', '3weeks', 'month', '90days'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 font-bold transition-all ${
                  timeRange === range 
                    ? 'bg-teal-600 text-slate-900' 
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {range === 'week' ? 'WEEK' : range === '3weeks' ? '3 WEEKS' : range === 'month' ? 'MONTH' : '90 DAYS'}
              </button>
            ))}
          </div>

          <ClientSelector
            clients={clients}
            selectedId={selectedClient}
            onSelect={setSelectedClient}
          />

          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Ads
          </button>
        </div>
      </div>

      {/* Today's Brief */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5">
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Needs Action Today</span>
          <p className="text-sm mt-1 opacity-90">
            CPL at ${cpl.toFixed(2)} - {cpl > baselineCpl ? `${Math.round(((cpl - baselineCpl)/baselineCpl)*100)}% above baseline` : 'under control'}. 
            Leads at {qualLeads} - {qualLeads < targetLeads ? `${Math.round(((targetLeads - qualLeads)/targetLeads)*100)}% below this week target of ${targetLeads}` : 'on track'}.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/10 bg-amber-500/5">
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">What Changed Since Last Sync</span>
          <p className="text-sm mt-1 opacity-90">
            Leads: <strong className="text-red-400">{qualLeads}</strong> vs <strong className="text-emerald-400">{targetLeads}</strong>
            <br />
            CPL: <strong className="text-red-400">${cpl.toFixed(2)}</strong> vs <strong className="text-emerald-400">${baselineCpl}</strong>
          </p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">What's Working</span>
          <p className="text-sm mt-1 opacity-80">
            No standout creative/campaign wins this week period.
          </p>
        </div>
      </div>

      {/* Lead Engine Highlight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'TOTAL LEADS', value: qualLeads, detail: `Base: 8` },
          { label: 'QUALIFIED LEADS', value: qualLeads, detail: `Rate: 100%` },
          { label: 'CPL', value: `$${cpl.toFixed(2)}`, detail: `Base: $${baselineCpl}` },
          { label: 'CONV RATE', value: `${activeRecord?.website_sessions ? ((qualLeads / activeRecord.website_sessions) * 100).toFixed(2) : '0.00'}%`, detail: `Base: 2.5%` },
          { label: 'ROAS', value: `${activeRecord?.google_ads_roas || '0.0'}x`, detail: `Portfolio avg: 2.8x` },
          { label: 'ORG TRAFFIC', value: activeRecord?.website_sessions || 0, detail: `Base: 22` }
        ].map((card, i) => (
          <div key={i} className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900/60">
            <span className="text-[10px] opacity-50 block font-semibold">{card.label}</span>
            <div className="text-2xl font-bold font-heading mt-1">{card.value}</div>
            <span className="text-[10px] opacity-40 mt-1 block">{card.detail}</span>
          </div>
        ))}
      </div>

      {/* Insights and Action Plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rules Insights */}
        <div className="p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Rules-Generated Insights
          </h3>
          <div className="space-y-3 text-xs">
            {cpl > baselineCpl && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <strong className="text-red-400 font-bold block">HIGH PAID MEDIA</strong>
                CPL at ${cpl.toFixed(2)} is above target. Review Meta Ads budgets.
              </div>
            )}
            {qualLeads < targetLeads && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <strong className="text-amber-400 font-bold block">LOW ALL LEADS</strong>
                Leads are below target of {targetLeads}. Optimize conversions.
              </div>
            )}
            <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800">
              <strong className="text-zinc-400 font-bold block">CRO OPTIMIZATION</strong>
              Bounce rate is at {activeRecord?.bounce_rate || '0'}%. Adjust landing page buttons.
            </div>
          </div>
        </div>

        {/* Action Plan */}
        <div className="p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
            <CheckSquare className="w-4 h-4" /> Action Plan
          </h3>
          <div className="space-y-3 text-xs">
            {[
              'Decided to open a new Gads account for client to reset campaigns.',
              'GAds campaign has been paused temporarily until setup resolves.',
              'Verify call tracking integration with GA4 leads events.',
              'Coordinate with SEO team regarding Organic Traffic drops.'
            ].map((act, idx) => (
              <div key={idx} className="flex gap-2 items-start bg-zinc-900/20 p-2.5 rounded-lg">
                <span className="text-teal-400 font-mono">0{idx + 1}</span>
                <p className="opacity-95">{act}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Channels Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Google Ads */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex justify-between">
            <span>Google Ads</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-normal">On Track</span>
          </h4>
          <div className="space-y-2 text-xs divide-y divide-zinc-900/50">
            <div className="flex justify-between py-1.5"><span>Spend</span><span>${activeRecord?.google_ads_spend || 0}</span></div>
            <div className="flex justify-between py-1.5"><span>CTR</span><span>{activeRecord?.google_ads_ctr || '0.00'}%</span></div>
            <div className="flex justify-between py-1.5"><span>Quality Score</span><span>{activeRecord?.google_ads_quality_score || 0} / 10</span></div>
            <div className="flex justify-between py-1.5"><span>ROAS</span><span>{activeRecord?.google_ads_roas || '0.0'}x</span></div>
          </div>
        </div>

        {/* Meta Ads */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex justify-between">
            <span>Meta Ads</span>
            <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded font-normal">At Risk</span>
          </h4>
          <div className="space-y-2 text-xs divide-y divide-zinc-900/50">
            <div className="flex justify-between py-1.5"><span>Spend</span><span>${activeRecord?.meta_spend || 0}</span></div>
            <div className="flex justify-between py-1.5"><span>Frequency</span><span>{activeRecord?.meta_frequency || '0.00'}x</span></div>
            <div className="flex justify-between py-1.5"><span>Leads</span><span>{activeRecord?.meta_leads || 0}</span></div>
            <div className="flex justify-between py-1.5"><span>ROAS</span><span>{activeRecord?.meta_roas || '0.0'}x</span></div>
          </div>
        </div>

        {/* Website & CRO */}
        <div className="p-5 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex justify-between">
            <span>CRO & Website</span>
            <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded font-normal">At Risk</span>
          </h4>
          <div className="space-y-2 text-xs divide-y divide-zinc-900/50">
            <div className="flex justify-between py-1.5"><span>Sessions</span><span>{activeRecord?.website_sessions || 0}</span></div>
            <div className="flex justify-between py-1.5"><span>Bounce Rate</span><span>{activeRecord?.bounce_rate || '0.0'}%</span></div>
            <div className="flex justify-between py-1.5"><span>Top Convert Page</span><span className="truncate max-w-[120px] font-mono text-[10px]">{activeRecord?.top_converting_page || '/'}</span></div>
            <div className="flex justify-between py-1.5"><span>A/B Tests Live</span><span>{activeRecord?.active_ab_tests || 0}</span></div>
          </div>
        </div>
      </div>

      {/* Chart and Funnel Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 md:col-span-2 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Lead & Traffic Trend</h3>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ReLineChart data={chartData}>
                  <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <ChartTooltip contentStyle={{ backgroundColor: '#18181b', border: 'none', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="Leads" stroke="#06b6d4" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="CPL" stroke="#e11d48" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Target" stroke="#16a34a" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                </ReLineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center opacity-40 text-xs">No historical chart data available.</div>
            )}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900/60 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Conversion Funnel vs Baseline</h3>
            <div className="space-y-4 mt-6">
              <div className="relative">
                <div className="flex justify-between text-xs mb-1">
                  <span>Sessions</span>
                  <strong>{activeRecord?.website_sessions || 0}</strong>
                </div>
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500" style={{ width: '100%' }}></div>
                </div>
              </div>
              <div className="relative">
                <div className="flex justify-between text-xs mb-1">
                  <span>Leads (Total)</span>
                  <strong>{qualLeads}</strong>
                </div>
                <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: '15%' }}></div>
                </div>
              </div>
            </div>
          </div>
          
          <button className="w-full py-2.5 rounded-lg bg-teal-650 hover:bg-teal-700 text-slate-900 text-xs font-bold transition">
            Analyse This Client
          </button>
        </div>
      </div>
    </div>
  );
}
