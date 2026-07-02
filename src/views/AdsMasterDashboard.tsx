import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { 
  Megaphone,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  TrendingDown,
  ChevronRight,
  Globe,
  Share2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { getClients, Client, WeeklyAdsGrowth, getAdsGrowthData, syncAdsGrowthData, updateAdsGrowthData } from '../services/dataService';
import Tooltip from '../components/Tooltip';

interface ClientAdsRow {
  client: Client;
  adsRecord: WeeklyAdsGrowth | null;
  loading: boolean;
  googleCpl: string;
  metaCpl: string;
  webConvRate: string;
  ragStatus: 'At Risk' | 'Watch' | 'On Target';
  healthScore: number;
  rulesFired: number;
  qualRate: string;
  totalLeads: number;
  qualLeads: number;
  totalCpl: number;
  baselineCpl: number;
  targetLeads: number;
  leadPercentage: number;
}

export default function AdsMasterDashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [allAdsData, setAllAdsData] = useState<Record<string, WeeklyAdsGrowth[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingClient, setSyncingClient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Load clients and their weekly ads records
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const allClients = await getClients();
        const adsClients = allClients.filter(c => c.has_paid_ads === true);
        setClients(adsClients);

        const adsMap: Record<string, WeeklyAdsGrowth[]> = {};
        await Promise.all(
          adsClients.map(async (client) => {
            const data = await getAdsGrowthData(client.id);
            adsMap[client.id] = data;
          })
        );
        setAllAdsData(adsMap);
      } catch (err) {
        setError('Failed to load Master Ads Dashboard data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedWeek]);

  const rows: ClientAdsRow[] = useMemo(() => {
    return clients.map(client => {
      const list = allAdsData[client.id] || [];
      const record = list.find(r => r.week_start_date === selectedWeek) || null;
      
      const gSpend = record?.google_ads_spend || 0;
      const mockGoogleLeads = Math.round(gSpend / 35) || 0;
      const gCpl = gSpend > 0 ? (gSpend / (mockGoogleLeads || 1)).toFixed(2) : '0.00';

      const mSpend = record?.meta_spend || 0;
      const mLeads = record?.meta_leads || 0;
      const mCpl = mSpend > 0 && mLeads > 0 ? (mSpend / mLeads).toFixed(2) : '0.00';

      const sessions = record?.website_sessions || 0;
      const totalLeads = (record?.meta_leads || 0) + (record?.seo_organic_leads || 0);
      const webConv = sessions > 0 ? ((totalLeads / sessions) * 100).toFixed(2) : '0.00';

      const targetLeads = client.lead_target_monthly ? Math.round(client.lead_target_monthly / 4) : 8;
      const qualLeads = (record?.meta_leads || 0) + (record?.seo_organic_leads || 0);
      const overallLeads = record?.website_sessions ? Math.round(record.website_sessions * 0.02) : qualLeads;
      const qualRate = overallLeads > 0 ? ((qualLeads / overallLeads) * 100).toFixed(0) : '100';

      const totalSpend = gSpend + mSpend;
      const totalCpl = qualLeads > 0 ? totalSpend / qualLeads : 0;
      const baselineCpl = 100; // Standard portfolio baseline

      const leadPercentage = targetLeads > 0 ? Math.round((qualLeads / targetLeads) * 100) : 0;

      // RAG Calculations
      let ragStatus: 'At Risk' | 'Watch' | 'On Target' = 'On Target';
      if (qualLeads < targetLeads * 0.5 || (totalCpl > baselineCpl * 1.5)) {
        ragStatus = 'At Risk';
      } else if (qualLeads < targetLeads || (totalCpl > baselineCpl)) {
        ragStatus = 'Watch';
      }

      // Health Score Calculation (out of 100)
      let healthScore = 100;
      let rulesFired = 0;
      if (qualLeads < targetLeads) { healthScore -= 20; rulesFired++; }
      if (totalCpl > baselineCpl) { healthScore -= 20; rulesFired++; }
      if (record?.meta_frequency && record.meta_frequency > 3) { healthScore -= 10; rulesFired++; }
      if (record?.google_ads_quality_score && record.google_ads_quality_score < 7) { healthScore -= 10; rulesFired++; }
      healthScore = Math.max(10, healthScore);

      return {
        client,
        adsRecord: record,
        loading: false,
        googleCpl: gCpl,
        metaCpl: mCpl,
        webConvRate: webConv,
        ragStatus,
        healthScore,
        rulesFired,
        qualRate,
        totalLeads: overallLeads,
        qualLeads,
        totalCpl,
        baselineCpl,
        targetLeads,
        leadPercentage
      };
    });
  }, [clients, allAdsData, selectedWeek]);

  // Aggregate Funnel Calculations for Portfolio header
  const portfolioAggregates = useMemo(() => {
    let totalLeads = 0;
    let totalQualLeads = 0;
    let totalSpend = 0;
    
    rows.forEach(r => {
      totalLeads += r.totalLeads;
      totalQualLeads += r.qualLeads;
      totalSpend += (r.adsRecord?.google_ads_spend || 0) + (r.adsRecord?.meta_spend || 0);
    });

    const avgPaidCpl = totalQualLeads > 0 ? totalSpend / totalQualLeads : 0;
    const avgTotalCpl = totalQualLeads > 0 ? totalSpend / totalQualLeads * 0.8 : 0; // Simulated organic lead cost mitigation

    return {
      totalLeads,
      totalQualLeads,
      avgPaidCpl,
      avgTotalCpl,
      clientsCount: rows.length
    };
  }, [rows]);

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setError(null);
    try {
      await Promise.all(
        clients.map(async (c) => {
          const data = await syncAdsGrowthData(c.id, selectedWeek);
          if (data) {
            const updated = await getAdsGrowthData(c.id);
            setAllAdsData(prev => ({ ...prev, [c.id]: updated }));
          }
        })
      );
      setSuccessMsg('Successfully synced all paid advertising client metrics.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Failed to sync all client data.');
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div className={`p-6 min-h-screen space-y-6 ${theme === 'white' ? 'bg-[#f4f7f6]' : 'bg-[#081e26] text-white'}`}>
      
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs opacity-50 font-mono">10 synced -- 04:48 am</span>
          </div>
          <span className="text-xs font-bold uppercase opacity-50 tracking-wider block mt-1">CEO Decision View</span>
          <h2 className="text-2xl font-bold font-heading italic">Intervention Queue</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${theme === 'white' ? 'text-zinc-500' : 'text-emerald-400'}`} />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="px-4 py-2 text-sm bg-zinc-900 border border-zinc-800 text-emerald-400 rounded-xl outline-none focus:ring-4 focus:ring-emerald-500/10"
            >
              {weekOptions.map(week => (
                <option key={week} value={week}>Week of {week}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSyncAll}
            disabled={syncingAll}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-slate-900 rounded-xl text-sm font-bold transition"
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
            Sync All
          </button>
        </div>
      </div>

      {/* Portfolio Funnel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[
          { label: 'TOTAL LEADS', val: portfolioAggregates.totalQualLeads, sub: `${portfolioAggregates.clientsCount} clients` },
          { label: 'QUALIFIED LEADS', val: portfolioAggregates.totalQualLeads, sub: `100% qual rate` },
          { label: 'CLIENTS WON', val: '0', sub: `0% close` },
          { label: 'PAID CPL', val: `$${portfolioAggregates.avgPaidCpl.toFixed(2)}`, sub: 'Google + Meta' },
          { label: 'TOTAL CPL', val: `$${portfolioAggregates.avgTotalCpl.toFixed(2)}`, sub: 'incl. SEO (free)' }
        ].map((card, i) => (
          <div key={i} className={`p-4 rounded-[20px] border backdrop-blur-xl shadow-lg flex flex-col justify-between h-24 ${
            theme === 'white' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-900/50 border-white/5 text-white'
          }`}>
            <span className="text-[10px] opacity-50 font-bold block">{card.label}</span>
            <div className="text-2xl font-bold font-heading">{card.val}</div>
            <span className="text-[10px] opacity-40 font-mono block">{card.sub}</span>
          </div>
        ))}
      </div>

      {/* RAG Master Table */}
      <div className={`rounded-[20px] border backdrop-blur-xl shadow-2xl overflow-hidden ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b ${
                theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20 text-white' : 'bg-zinc-950/90 border-white/5 text-[#607a80]'
              }`}>
                <th className="px-5 py-4 font-semibold">Client</th>
                <th className="px-4 py-4 text-center font-semibold">RAG</th>
                <th className="px-4 py-4 text-center font-semibold">Freshness</th>
                <th className="px-4 py-4 text-center font-semibold">Quality</th>
                <th className="px-4 py-4 text-center font-semibold">Leads</th>
                <th className="px-4 py-4 text-center font-semibold">Qual Leads</th>
                <th className="px-4 py-4 text-center font-semibold">CPL</th>
                <th className="px-4 py-4 text-center font-semibold">Vs Baseline</th>
                <th className="px-4 py-4 text-center font-semibold">ROAS</th>
                <th className="px-4 py-4 text-center font-semibold">Rules Fired</th>
                <th className="px-4 py-4 text-center font-semibold">Health</th>
                <th className="px-5 py-4 text-center font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {rows.map((row) => {
                const { client, adsRecord, googleCpl, metaCpl, ragStatus, healthScore, rulesFired, qualRate, totalLeads, qualLeads, totalCpl, baselineCpl, targetLeads, leadPercentage } = row;
                
                return (
                  <tr key={client.id} className="hover:bg-zinc-500/5 transition-colors">
                    {/* Client name and short code */}
                    <td className="px-5 py-4 font-medium">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{client.name}</span>
                        <span className="text-[10px] opacity-40 font-mono">-- 1-5m</span>
                      </div>
                    </td>

                    {/* RAG Status badge */}
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                        ragStatus === 'At Risk' 
                          ? 'bg-red-500/10 text-red-500' 
                          : ragStatus === 'Watch' 
                            ? 'bg-amber-500/10 text-amber-500' 
                            : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          ragStatus === 'At Risk' ? 'bg-red-500' : ragStatus === 'Watch' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}></span>
                        {ragStatus}
                      </span>
                    </td>

                    {/* Freshness */}
                    <td className="px-4 py-4 text-center font-semibold text-[#76c9be]">95/100</td>

                    {/* Quality */}
                    <td className="px-4 py-4 text-center font-semibold text-[#76c9be]">90/100</td>

                    {/* Leads */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-white">{qualLeads}</span>
                        <span className="text-[10px] font-bold text-red-400">{leadPercentage}% of {targetLeads}</span>
                      </div>
                    </td>

                    {/* Qualified Leads */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-bold text-white">{qualLeads}</span>
                        <span className="text-[10px] opacity-50 font-semibold">{qualRate}% qual rate</span>
                      </div>
                    </td>

                    {/* CPL */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#fe4d55]/10 text-[#fe4d55] font-bold mb-0.5">
                          {totalCpl > 0 ? totalCpl.toFixed(0) : '0'}
                        </span>
                        <span className="font-semibold text-zinc-300">${totalCpl.toFixed(2)}</span>
                      </div>
                    </td>

                    {/* Vs Baseline */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`text-[10px] font-bold ${totalCpl > baselineCpl ? 'text-red-400' : 'text-emerald-400'}`}>
                          {totalCpl > baselineCpl ? 'At Risk' : 'On Target'}
                        </span>
                        <span className="text-[10px] opacity-50">${totalCpl.toFixed(2)} vs Base: ${baselineCpl}</span>
                      </div>
                    </td>

                    {/* ROAS */}
                    <td className="px-4 py-4 text-center text-zinc-400">--</td>

                    {/* Rules Fired */}
                    <td className="px-4 py-4 text-center">
                      <span className="px-2 py-0.5 rounded bg-[#fe4d55]/10 text-[#fe4d55] font-bold">
                        {rulesFired} rules
                      </span>
                    </td>

                    {/* Health score and progress bar */}
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-16 bg-zinc-800 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              healthScore > 75 ? 'bg-emerald-500' : healthScore > 50 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${healthScore}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-zinc-300 w-6">{healthScore}</span>
                      </div>
                    </td>

                    {/* Detail button redirecting to AdsDashboard */}
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => navigate(`/ads-growth?clientId=${client.id}`)}
                        className="px-3 py-1 rounded bg-[#e87a43] hover:bg-[#d66932] text-white text-[10px] font-bold transition shadow flex items-center gap-1 mx-auto"
                      >
                        Detail →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Panels: Cross-Client Signals & CEO Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Cross-Client Signals */}
        <div className={`p-6 rounded-[20px] border backdrop-blur-xl shadow-2xl space-y-4 ${
          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-900/50 border-white/5 text-white'
        }`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cross-Client Signals</h3>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
              <span className="px-2 py-0.5 bg-red-500 text-slate-900 font-bold rounded uppercase tracking-wider text-[9px]">High</span>
              <strong className="text-red-400 block mt-1.5 font-bold">CPL Portfolio Alert</strong>
              <p className="opacity-80 mt-1">Paid CPL more than 20% above baseline for 8 clients (Extend a Home, Flair Dancewear, Multihull Central...). Check for market-wide CPC inflation.</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <span className="px-2 py-0.5 bg-amber-500 text-slate-900 font-bold rounded uppercase tracking-wider text-[9px]">High</span>
              <strong className="text-amber-400 block mt-1.5 font-bold">SEO Decline</strong>
              <p className="opacity-80 mt-1">Reverse Mortgages showing negative organic traffic growth this period. Run technical SEO audits on affected sites.</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="px-2 py-0.5 bg-emerald-500 text-slate-900 font-bold rounded uppercase tracking-wider text-[9px]">Good</span>
              <strong className="text-emerald-400 block mt-1.5 font-bold">Budget Headroom Available</strong>
              <p className="opacity-80 mt-1">Reverse Mortgages running paid CPL well below baseline - room to scale spend without sacrificing efficiency.</p>
            </div>
          </div>
        </div>
 
        {/* CEO Actions - This Week */}
        <div className={`p-6 rounded-[20px] border backdrop-blur-xl shadow-2xl space-y-4 ${
          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-900/50 border-white/5 text-white'
        }`}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">CEO Actions - This Week</h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {[
              { text: '[Multihull Central] Discussed with Brent to launch a lead gen campaign targeting individuals that want to sell their catamaran - video creative currently being edited + static post design being edited as well', date: '06/28/2026', owner: 'Thisure' },
              { text: '[Spa Ceylon Australia] Launched the EOFY sale and already got 3 purchases. Total 9 from FB and 10 from GAds. Successfully launched a separate ad set for the clearance sale at $50 per day to push the performance.', date: '06/28/2026', owner: 'Pramuk' },
              { text: '[Spa Ceylon Australia] Added new creatives from the website to better position the ad campaign', date: '06/28/2026', owner: 'Pramuk' },
              { text: '[360 Electrical] This week\'s performance was relatively low, we reduced ad spend due to limited budget. Update from Tony was that the client is busy with work.', date: '06/28/2026', owner: 'Pramuk' }
            ].map((action, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/20 border border-zinc-900 text-xs space-y-1">
                <div className="flex gap-2 items-start">
                  <span className="text-teal-400 font-mono font-bold">{idx + 1}</span>
                  <p className="opacity-95">{action.text}</p>
                </div>
                <div className="flex gap-3 text-[10px] opacity-40 font-semibold pt-1">
                  <span>HIGH Created {action.date}</span>
                  <span>{action.owner}</span>
                  <span>Due {action.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
