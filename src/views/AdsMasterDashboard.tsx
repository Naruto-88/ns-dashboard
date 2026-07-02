import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { 
  Megaphone,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  Globe,
  Share2,
  BarChart3,
  FileText,
  Sparkles,
  Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
}

export default function AdsMasterDashboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [allAdsData, setAllAdsData] = useState<Record<string, WeeklyAdsGrowth[]>>({});
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingClient, setSyncingClient] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ clientId: string; field: keyof WeeklyAdsGrowth; value: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'paid' | 'analytics' | 'deliverables'>('paid');

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
      const mockGoogleLeads = Math.round(gSpend / 35) || 1;
      const gCpl = gSpend > 0 ? (gSpend / mockGoogleLeads).toFixed(2) : '0.00';

      const mSpend = record?.meta_spend || 0;
      const mLeads = record?.meta_leads || 0;
      const mCpl = mSpend > 0 && mLeads > 0 ? (mSpend / mLeads).toFixed(2) : '0.00';

      const sessions = record?.website_sessions || 0;
      const totalLeads = (record?.meta_leads || 0) + (record?.seo_organic_leads || 0);
      const webConv = sessions > 0 ? ((totalLeads / sessions) * 100).toFixed(2) : '0.00';

      return {
        client,
        adsRecord: record,
        loading: false,
        googleCpl: gCpl,
        metaCpl: mCpl,
        webConvRate: webConv
      };
    });
  }, [clients, allAdsData, selectedWeek]);

  const handleSyncClient = async (clientId: string) => {
    setSyncingClient(clientId);
    setError(null);
    try {
      const data = await syncAdsGrowthData(clientId, selectedWeek);
      if (data) {
        const updatedList = await getAdsGrowthData(clientId);
        setAllAdsData(prev => ({
          ...prev,
          [clientId]: updatedList
        }));
      }
    } catch (err) {
      setError('Sync failed.');
    } finally {
      setSyncingClient(null);
    }
  };

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

  const handleCellUpdateSubmit = async () => {
    if (!editingCell) return;
    const { clientId, field, value } = editingCell;
    const clientList = allAdsData[clientId] || [];
    const existing = clientList.find(r => r.week_start_date === selectedWeek);

    const parsedVal = field === 'avg_time_on_site' || field === 'top_converting_page' || field === 'top_platform'
      ? value
      : parseFloat(value) || 0;

    const payload = {
      ...(existing || {}),
      week_start_date: selectedWeek,
      [field]: parsedVal
    };

    try {
      const updated = await updateAdsGrowthData(clientId, payload);
      if (updated) {
        const newList = await getAdsGrowthData(clientId);
        setAllAdsData(prev => ({
          ...prev,
          [clientId]: newList
        }));
        setEditingCell(null);
      }
    } catch (err) {
      setError('Failed to update metric.');
    }
  };

  return (
    <div className={`p-6 min-h-screen space-y-6 ${theme === 'white' ? 'bg-[#f4f7f6]' : 'bg-[#081e26]'}`}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ${theme === 'white' ? 'bg-[#082a36]' : 'bg-blue-600'}`}>
            <Megaphone className="text-white" size={24} />
          </div>
          <div>
            <h2 className={`text-3xl font-medium font-heading tracking-tighter italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              Ads Master Dashboard
            </h2>
            <p className="text-zinc-500 text-sm font-medium leading-none mt-1">
              Centralized PPC Performance overview (Clients with active ads)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${theme === 'white' ? 'text-zinc-500' : 'text-emerald-400'}`} />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className={`px-4 py-2 text-sm rounded-xl border focus:ring-4 outline-none ${
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
            onClick={handleSyncAll}
            disabled={syncingAll || clients.length === 0}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition ${
              theme === 'white'
                ? 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-zinc-350'
                : 'bg-emerald-600 hover:bg-emerald-700 text-slate-900 disabled:bg-zinc-800'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncingAll ? 'animate-spin' : ''}`} />
            Sync All Ads
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`p-1.5 rounded-2xl flex gap-1 border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/50 border-white/5'}`}>
        <button
          onClick={() => setActiveTab('paid')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'paid'
              ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
              : theme === 'white' ? 'text-zinc-650 hover:bg-zinc-100' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
          }`}
        >
          Paid Advertising (PPC)
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'analytics'
              ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
              : theme === 'white' ? 'text-zinc-650 hover:bg-zinc-100' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
          }`}
        >
          Web & Social Analytics
        </button>
        <button
          onClick={() => setActiveTab('deliverables')}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'deliverables'
              ? theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg'
              : theme === 'white' ? 'text-zinc-650 hover:bg-zinc-100' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
          }`}
        >
          Agency Deliverables
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">{successMsg}</span>
        </div>
      )}

      {/* Main Table */}
      {loading ? (
        <div className="py-20 text-center text-sm opacity-60">Loading metrics table...</div>
      ) : clients.length === 0 ? (
        <div className={`py-20 text-center rounded-2xl border ${theme === 'white' ? 'bg-white border-zinc-150' : 'bg-zinc-950/20 border-zinc-900/60'}`}>
          <Megaphone className="w-12 h-12 mx-auto opacity-20 mb-4" />
          <p className="text-sm opacity-60">No clients currently marked as having active Paid Advertising.</p>
          <p className="text-xs opacity-40 mt-1">Configure clients inside "Client Management" toggle "Paid Ads Active".</p>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border ${
          theme === 'white' ? 'bg-white border-zinc-200/80 shadow-md' : 'bg-zinc-950/40 border-zinc-900/60'
        }`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${
                  theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20 text-white' : 'bg-zinc-950/90 border-white/5 backdrop-blur-xl text-[#607a80]'
                }`}>
                  <th className="px-5 py-3 text-sm font-medium">Client</th>
                  
                  {activeTab === 'paid' && (
                    <>
                      <th className="px-4 py-3 text-sm font-medium text-center">Google Spend</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Google CPL</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Google CTR</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Google ROAS</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Quality Score</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Meta Spend</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Meta Leads</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Meta CPL</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Meta CTR</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Meta ROAS</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Frequency</th>
                    </>
                  )}

                  {activeTab === 'analytics' && (
                    <>
                      <th className="px-4 py-3 text-sm font-medium text-center">Sessions</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Bounce Rate</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Avg Time</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Conv. Rate</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Top Converting Page</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">A/B Tests</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">LP Live</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Followers</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Social Reach</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Social Imps</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Engagement</th>
                    </>
                  )}

                  {activeTab === 'deliverables' && (
                    <>
                      <th className="px-4 py-3 text-sm font-medium text-center">Blogs Written</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Blog Quality</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Backlinks Built</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Social Published</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Social Total</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Creatives Produced</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">Emails Sent</th>
                      <th className="px-4 py-3 text-sm font-medium text-center">SEO Leads</th>
                    </>
                  )}

                  <th className="px-5 py-3 text-sm font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-zinc-900/60'}`}>
                {rows.map(({ client, adsRecord, googleCpl, metaCpl, webConvRate }) => {
                  return (
                    <tr key={client.id} className="hover:bg-zinc-500/5 transition-colors">
                      {/* Client */}
                      <td className="px-5 py-4 font-medium">
                        <Link to={`/ads-growth?clientId=${client.id}`} className="flex items-center gap-1.5 group hover:underline text-sm">
                          {client.short_code && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold font-mono ${
                              theme === 'white' ? 'bg-zinc-150 text-zinc-700' : 'bg-blue-600/20 text-blue-400'
                            }`}>
                              {client.short_code}
                            </span>
                          )}
                          <span className={`font-semibold ${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>{client.name}</span>
                          <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      {/* Render Tab Specific Cells */}
                      {activeTab === 'paid' && (
                        <>
                          {/* Google Spend */}
                          <td className="px-4 py-4 text-center font-mono">
                            {editingCell?.clientId === client.id && editingCell?.field === 'google_ads_spend' ? (
                              <input
                                autoFocus
                                type="number"
                                value={editingCell.value}
                                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellUpdateSubmit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                onBlur={handleCellUpdateSubmit}
                                className="w-16 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                              />
                            ) : (
                              <span 
                                onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'google_ads_spend', value: String(adsRecord?.google_ads_spend || 0) })}
                                className="cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded"
                              >
                                ${Number(adsRecord?.google_ads_spend || 0).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center font-mono text-blue-400">${googleCpl}</td>
                          <td className="px-4 py-4 text-center font-mono">
                            {editingCell?.clientId === client.id && editingCell?.field === 'google_ads_ctr' ? (
                              <input
                                autoFocus
                                type="number" step="any"
                                value={editingCell.value}
                                onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellUpdateSubmit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                                onBlur={handleCellUpdateSubmit}
                                className="w-14 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                              />
                            ) : (
                              <span 
                                onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'google_ads_ctr', value: String(adsRecord?.google_ads_ctr || 0) })}
                                className="cursor-pointer hover:bg-white/10 px-1 py-0.5 rounded"
                              >
                                {adsRecord?.google_ads_ctr || '0.00'}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.google_ads_roas || '0.0'}x</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.google_ads_quality_score || '0'}</td>
                          <td className="px-4 py-4 text-center font-mono">${Number(adsRecord?.meta_spend || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.meta_leads || 0}</td>
                          <td className="px-4 py-4 text-center font-mono text-purple-400">${metaCpl}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.meta_ctr || '0.00'}%</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.meta_roas || '0.0'}x</td>
                          <td className={`px-4 py-4 text-center font-mono font-bold ${
                            (adsRecord?.meta_frequency || 0) > 3 ? 'text-red-400' : ''
                          }`}>{adsRecord?.meta_frequency || '0.00'}x</td>
                        </>
                      )}

                      {activeTab === 'analytics' && (
                        <>
                          <td className="px-4 py-4 text-center font-mono">{Number(adsRecord?.website_sessions || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.bounce_rate || '0.0'}%</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.avg_time_on_site || 'N/A'}</td>
                          <td className="px-4 py-4 text-center font-mono text-emerald-400">{webConvRate}%</td>
                          <td className="px-4 py-4 text-center truncate max-w-[120px]" title={adsRecord?.top_converting_page || ''}>
                            {adsRecord?.top_converting_page || 'N/A'}
                          </td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.active_ab_tests || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.landing_pages_live || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{Number(adsRecord?.followers_total || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-center font-mono">{Number(adsRecord?.organic_social_reach || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-center font-mono">{Number(adsRecord?.social_impressions || 0).toLocaleString()}</td>
                          <td className="px-4 py-4 text-center font-mono text-sky-400">{adsRecord?.engagement_rate || '0.0'}%</td>
                        </>
                      )}

                      {activeTab === 'deliverables' && (
                        <>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.blogs_written || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.avg_blog_quality || '0.0'}/5</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.backlinks_created || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.social_posts_published || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.social_posts_content_total || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.creatives_produced || 0}</td>
                          <td className="px-4 py-4 text-center font-mono">{adsRecord?.emails_automation || 0}</td>
                          <td className="px-4 py-4 text-center font-mono text-blue-400">{adsRecord?.seo_organic_leads || 0}</td>
                        </>
                      )}

                      {/* Action */}
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleSyncClient(client.id)}
                          disabled={syncingClient === client.id}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            theme === 'white'
                              ? 'bg-white border-zinc-200 hover:bg-zinc-55 text-zinc-700'
                              : 'bg-zinc-900 border-zinc-800 text-emerald-400 hover:bg-zinc-800'
                          }`}
                        >
                          {syncingClient === client.id ? 'Syncing...' : 'Sync'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
