import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { 
  Megaphone,
  LayoutDashboard,
  Calendar,
  RefreshCw,
  Edit2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  ArrowUpRight,
  TrendingDown,
  ChevronRight,
  Globe,
  Share2
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
        // Filter clients that have paid ads active
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

      return {
        client,
        adsRecord: record,
        loading: false,
        googleCpl: gCpl,
        metaCpl: mCpl
      };
    });
  }, [clients, allAdsData, selectedWeek]);

  const handleSyncClient = async (clientId: string) => {
    setSyncingClient(clientId);
    setError(null);
    try {
      const data = await syncAdsGrowthData(clientId, selectedWeek);
      if (data) {
        // Refresh client data list
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
                <tr className={`border-b text-xs uppercase tracking-wider font-semibold ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-200/80 text-zinc-600' : 'bg-zinc-900/50 border-zinc-900/80 text-zinc-500'
                }`}>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4 text-center">Google Ads Spend</th>
                  <th className="px-6 py-4 text-center">Google CPL</th>
                  <th className="px-6 py-4 text-center">Google ROAS</th>
                  <th className="px-6 py-4 text-center">Meta Spend</th>
                  <th className="px-6 py-4 text-center">Meta Leads</th>
                  <th className="px-6 py-4 text-center">Meta CPL</th>
                  <th className="px-6 py-4 text-center">Meta ROAS</th>
                  <th className="px-6 py-4 text-center">Sync / Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-zinc-900/60'}`}>
                {rows.map(({ client, adsRecord, googleCpl, metaCpl }) => {
                  const hasRecord = !!adsRecord;
                  
                  return (
                    <tr key={client.id} className={`text-sm hover:bg-zinc-500/5 transition-colors`}>
                      {/* Client */}
                      <td className="px-6 py-4 font-medium">
                        <Link to="/ads-growth" className="flex items-center gap-2 group hover:underline">
                          {client.short_code && (
                            <span className={`text-xs px-2 py-0.5 rounded-lg font-bold font-mono ${
                              theme === 'white' ? 'bg-zinc-150 text-zinc-700' : 'bg-blue-600/20 text-blue-400'
                            }`}>
                              {client.short_code}
                            </span>
                          )}
                          <span className={`${theme === 'white' ? 'text-zinc-800' : 'text-white'}`}>{client.name}</span>
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>

                      {/* Google Spend */}
                      <td className="px-6 py-4 text-center font-mono">
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
                            className="w-20 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                          />
                        ) : (
                          <span 
                            onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'google_ads_spend', value: String(adsRecord?.google_ads_spend || 0) })}
                            className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
                          >
                            ${Number(adsRecord?.google_ads_spend || 0).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Google CPL */}
                      <td className="px-6 py-4 text-center font-mono text-blue-400">
                        ${googleCpl}
                      </td>

                      {/* Google ROAS */}
                      <td className="px-6 py-4 text-center font-mono">
                        {editingCell?.clientId === client.id && editingCell?.field === 'google_ads_roas' ? (
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
                            className="w-16 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                          />
                        ) : (
                          <span 
                            onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'google_ads_roas', value: String(adsRecord?.google_ads_roas || 0) })}
                            className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
                          >
                            {adsRecord?.google_ads_roas || '0.0'}x
                          </span>
                        )}
                      </td>

                      {/* Meta Spend */}
                      <td className="px-6 py-4 text-center font-mono">
                        {editingCell?.clientId === client.id && editingCell?.field === 'meta_spend' ? (
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
                            className="w-20 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                          />
                        ) : (
                          <span 
                            onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'meta_spend', value: String(adsRecord?.meta_spend || 0) })}
                            className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
                          >
                            ${Number(adsRecord?.meta_spend || 0).toLocaleString()}
                          </span>
                        )}
                      </td>

                      {/* Meta Leads */}
                      <td className="px-6 py-4 text-center font-mono">
                        {editingCell?.clientId === client.id && editingCell?.field === 'meta_leads' ? (
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
                            onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'meta_leads', value: String(adsRecord?.meta_leads || 0) })}
                            className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
                          >
                            {adsRecord?.meta_leads || 0}
                          </span>
                        )}
                      </td>

                      {/* Meta CPL */}
                      <td className="px-6 py-4 text-center font-mono text-purple-400">
                        ${metaCpl}
                      </td>

                      {/* Meta ROAS */}
                      <td className="px-6 py-4 text-center font-mono">
                        {editingCell?.clientId === client.id && editingCell?.field === 'meta_roas' ? (
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
                            className="w-16 px-1 py-0.5 border text-center text-xs rounded outline-none bg-zinc-900 text-white"
                          />
                        ) : (
                          <span 
                            onDoubleClick={() => setEditingCell({ clientId: client.id, field: 'meta_roas', value: String(adsRecord?.meta_roas || 0) })}
                            className="cursor-pointer hover:bg-white/10 px-2 py-1 rounded"
                          >
                            {adsRecord?.meta_roas || '0.0'}x
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-center">
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
