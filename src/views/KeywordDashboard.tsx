import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { 
  Key, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  Download,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  XCircle,
  Search,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { DateRange, DatePreset, getDatePresetRange, getPreviousPeriod, calculatePositionComparison, calculateMetricComparison } from '../lib/seoUtils';
import { getClients, Client, Keyword, KeywordHistory, getKeywords, getKeywordHistory, addKeyword, deleteKeyword, getInsights } from '../services/dataService';
import DateRangeSelector from '../components/DateRangeSelector';
import ClientSelector from '../components/ClientSelector';
import Tooltip from '../components/Tooltip';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';

export default function KeywordDashboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [range, setRange] = useState<DateRange>(getDatePresetRange('last_7_days'));
  const [preset, setPreset] = useState<DatePreset>('last_7_days');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [history, setHistory] = useState<KeywordHistory[]>([]);
  const [prevHistory, setPrevHistory] = useState<KeywordHistory[]>([]);
  const [gscData, setGscData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'query', direction: 'asc' });

  useEffect(() => {
    getClients().then(data => {
      setClients(data);
      if (data.length > 0) setSelectedClient(data[0].id);
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

  const fetchData = async () => {
    if (!selectedClient) return;
    setLoading(true);
    try {
      const [k, h, ph, gsc] = await Promise.all([
        getKeywords(selectedClient),
        getKeywordHistory(selectedClient, range),
        getKeywordHistory(selectedClient, getPreviousPeriod(range)),
        getInsights(selectedClient, range).catch(() => null)
      ]);
      setKeywords(k);
      setHistory(h);
      setPrevHistory(ph);
      setGscData(gsc);
    } catch (error) {
      console.error("Failed to fetch keyword intelligence:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedClient, range]);

  const keywordMetrics = useMemo(() => {
    let result = keywords.map(kw => {
      const h = history.filter(item => item.keyword_id === kw.id);
      const ph = prevHistory.filter(item => item.keyword_id === kw.id);

      const avg = (items: KeywordHistory[], key: keyof KeywordHistory) => {
        if (items.length === 0) return null;
        return items.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0) / items.length;
      };

      const currPos = avg(h, 'position');
      const prevPos = avg(ph, 'position');
      const comp = calculatePositionComparison(currPos || 0, prevPos);

      // Match with Live GSC Data
      const gscMatch = gscData?.queries?.find((q: any) => q.keys[0].toLowerCase() === kw.query.toLowerCase());
      const prevGscMatch = gscData?.prevQueries?.find((q: any) => q.keys[0].toLowerCase() === kw.query.toLowerCase());

      return {
        ...kw,
        currentPos: currPos,
        previousPos: prevPos,
        status: comp.status,
        diff: comp.difference,
        gscClicks: gscMatch?.clicks || 0,
        gscImpressions: gscMatch?.impressions || 0,
        gscPosition: gscMatch?.position || 0,
        prevGscClicks: prevGscMatch?.clicks || 0,
        prevGscPosition: prevGscMatch?.position || 0
      };
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let aValue: any, bValue: any;
        switch (sortConfig.key) {
          case 'query':
            aValue = a.query.toLowerCase();
            bValue = b.query.toLowerCase();
            break;
          case 'currentPos':
            aValue = a.currentPos || 999;
            bValue = b.currentPos || 999;
            break;
          case 'previousPos':
            aValue = a.previousPos || 999;
            bValue = b.previousPos || 999;
            break;
          case 'diff':
            aValue = Math.abs(a.diff || 0);
            bValue = Math.abs(b.diff || 0);
            break;
          case 'gscClicks':
            aValue = a.gscClicks;
            bValue = b.gscClicks;
            break;
          case 'gscPos':
            aValue = a.gscPosition || 999;
            bValue = b.gscPosition || 999;
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [keywords, history, prevHistory, gscData, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const summary = useMemo(() => {
    const total = keywordMetrics.length;
    const improved = keywordMetrics.filter(m => m.status === 'improvement').length;
    const declined = keywordMetrics.filter(m => m.status === 'decline').length;
    const top3 = keywordMetrics.filter(m => (m.currentPos || 100) <= 3).length;
    const top10 = keywordMetrics.filter(m => (m.currentPos || 100) <= 10).length;
    const avgPos = keywordMetrics.reduce((acc, curr) => acc + (curr.currentPos || 0), 0) / (total || 1);

    return { total, improved, declined, top3, top10, avgPos };
  }, [keywordMetrics]);

  const handleBulkAdd = async () => {
    const lines = bulkInput.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const [query, url, priority] = line.split(',').map(s => s.trim());
      await addKeyword(selectedClient, {
        query,
        landing_page_url: url || '',
        priority: priority || 'Medium',
        created_at: new Date().toISOString()
      });
    }
    setBulkInput('');
    setShowAddModal(false);
    fetchData();
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-50">
        <div>
          <h2 className={`text-2xl font-black uppercase tracking-tighter italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Keyword Intelligence</h2>
          <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mt-1">Track ranking signals and trajectory</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ClientSelector 
            clients={clients} 
            selectedId={selectedClient} 
            onSelect={setSelectedClient} 
          />
          <DateRangeSelector 
            currentRange={range} 
            currentPreset={preset} 
            onRangeChange={(r, p) => { setRange(r); setPreset(p); }} 
          />
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
          >
            <Plus size={18} />
            Bulk Inject
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Tracked', value: summary.total },
          { label: 'Trajectory ↑', value: summary.improved, color: 'text-emerald-500' },
          { label: 'Trajectory ↓', value: summary.declined, color: 'text-rose-500' },
          { label: 'Tier 1 (T3)', value: summary.top3 },
          { label: 'Tier 2 (T10)', value: summary.top10 },
          { label: 'Global Avg', value: summary.avgPos.toFixed(1) },
        ].map((stat, i) => (
          <div key={i} className={`p-5 rounded-3xl border shadow-2xl backdrop-blur-xl group hover:border-white/10 transition-all ${
            theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-3">{stat.label}</p>
            <p className={`text-2xl font-black italic tracking-tighter ${stat.color || (theme === 'white' ? 'text-zinc-900' : 'text-white')}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-[40px] border shadow-2xl backdrop-blur-xl ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`border-b text-[9px] font-black text-zinc-500 uppercase tracking-widest ${
                theme === 'white' ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-950/50 border-white/5'
              }`}>
                <th className="px-8 py-5 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('query')}>
                  <div className="flex items-center gap-2">
                    <Tooltip content="The primary search query being monitored for visibility shifts.">
                      Strategic Keyword
                    </Tooltip>
                    {sortConfig?.key === 'query' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('gscClicks')}>
                  <div className="flex items-center gap-2 justify-center">
                    <Tooltip content="Live Clicks from Search Console for this keyword">
                      Live Clicks
                    </Tooltip>
                    {sortConfig?.key === 'gscClicks' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('gscPos')}>
                  <div className="flex items-center gap-2 justify-center">
                    <Tooltip content="Live Position from Search Console for this keyword">
                      GSC Pos
                    </Tooltip>
                    {sortConfig?.key === 'gscPos' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('currentPos')}>
                  <div className="flex items-center gap-2">
                    <Tooltip content="Tracked ranking within the specified temporal Window (Manual/Internal).">
                      Tracked Pos
                    </Tooltip>
                    {sortConfig?.key === 'currentPos' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-6 py-5 cursor-pointer hover:text-blue-500 transition-colors" onClick={() => handleSort('diff')}>
                  <div className="flex items-center gap-2">
                    <Tooltip content="Calculated variance in units between detection windows.">
                      Drift
                    </Tooltip>
                    {sortConfig?.key === 'diff' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </div>
                </th>
                <th className="px-8 py-5 text-right">Node Controls</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${theme === 'white' ? 'divide-zinc-100' : 'divide-white/5'}`}>
              {loading ? (
                Array(5).fill(0).map((_, i) => <tr key={i} className={`h-16 animate-pulse ${theme === 'white' ? 'bg-zinc-50' : 'bg-white/5'}`} />)
              ) : keywordMetrics.map((kw) => (
                <tr key={kw.id} className={`transition-colors group ${theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className={`font-black uppercase tracking-tight text-sm italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{kw.query}</p>
                      {kw.landing_page_url && (
                        <a href={kw.landing_page_url} target="_blank" className="text-[9px] font-black text-zinc-500 hover:text-blue-500 flex items-center gap-1 uppercase tracking-widest transition-all">
                          Target <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-black font-mono italic ${theme === 'white' ? 'text-zinc-700' : 'text-white'}`}>
                        {kw.gscClicks.toLocaleString()}
                      </span>
                      {kw.prevGscClicks > 0 && (
                        <span className={`text-[9px] font-black mt-0.5 ${kw.gscClicks >= kw.prevGscClicks ? 'text-emerald-500' : 'text-red-500'}`}>
                          {kw.gscClicks >= kw.prevGscClicks ? '+' : ''}{kw.gscClicks - kw.prevGscClicks}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`text-sm font-black font-mono italic ${kw.gscPosition <= 3 ? 'text-emerald-500' : kw.gscPosition <= 10 ? 'text-blue-500' : 'text-zinc-500'}`}>
                        {kw.gscPosition > 0 ? kw.gscPosition.toFixed(1) : 'NR'}
                      </span>
                      {kw.prevGscPosition > 0 && kw.gscPosition > 0 && (kw.prevGscPosition - kw.gscPosition !== 0) && (
                        <div className={`flex items-center text-[9px] font-black ${kw.gscPosition < kw.prevGscPosition ? 'text-emerald-500' : 'text-red-500'}`}>
                          {kw.gscPosition < kw.prevGscPosition ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`text-sm font-black font-mono italic ${theme === 'white' ? 'text-zinc-700' : 'text-white'}`}>
                      {kw.currentPos ? kw.currentPos.toFixed(1) : '---'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {kw.status === 'improvement' ? (
                      <span className="inline-flex items-center gap-2 text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
                        <TrendingUp size={12} /> Traj Up ({Math.abs(kw.diff || 0).toFixed(1)})
                      </span>
                    ) : kw.status === 'decline' ? (
                      <span className="inline-flex items-center gap-2 text-[9px] font-black text-rose-500 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20 uppercase tracking-widest">
                        <TrendingDown size={12} /> Traj Down ({Math.abs(kw.diff || 0).toFixed(1)})
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-2 text-[9px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                        theme === 'white' ? 'text-zinc-500 bg-zinc-100 border-zinc-200' : 'text-zinc-500 bg-zinc-800 border-white/5'
                      }`}>
                        <Minus size={12} /> Static
                      </span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2 grayscale group-hover:grayscale-0 transition-all">
                      <Tooltip content="Edit Keyword" position="left">
                        <button className={`p-2 rounded-xl transition-all border border-transparent shadow-sm ${
                          theme === 'white' ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900' : 'text-zinc-500 hover:bg-white/5 hover:text-white hover:border-white/10'
                        }`}>
                          <Edit2 size={16} />
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete Keyword" position="left">
                        <button 
                          onClick={async () => {
                            if (confirm('Decommission signal node?')) {
                              await deleteKeyword(selectedClient, kw.id);
                              fetchData();
                            }
                          }}
                          className="p-2 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all border border-transparent hover:border-rose-500/20 shadow-sm"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`rounded-[48px] w-full max-w-2xl shadow-2xl overflow-hidden border relative ${
            theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
          }`}>
            <div className={`p-10 border-b flex items-center justify-between backdrop-blur-xl ${
              theme === 'white' ? 'bg-zinc-100/80 border-zinc-100' : 'bg-zinc-950/80 border-white/5'
            }`}>
              <h3 className={`text-2xl font-black uppercase italic tracking-tighter ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Bulk Signal Injection</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className={`p-3 rounded-2xl transition-all ${
                  theme === 'white' ? 'bg-zinc-100 text-zinc-500 hover:text-zinc-900' : 'bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                Data Format: <span className="text-blue-400">keyword, landing_page, priority</span> (line delimited)
              </p>
              <textarea
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className={`w-full h-64 p-8 border rounded-[32px] font-mono text-sm outline-none focus:border-blue-500 resize-none shadow-inner ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-zinc-100'
                }`}
                placeholder={`organic coffee, https://shop.com/coffee, High\nroasted beans, https://shop.com/beans, Medium`}
              />
            </div>
            <div className={`p-10 flex justify-end gap-4 border-t ${
              theme === 'white' ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-950 border-white/5'
            }`}>
              <button 
                onClick={() => setShowAddModal(false)} 
                className={`px-8 py-3 font-black uppercase text-[10px] tracking-widest transition-colors ${
                  theme === 'white' ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'
                }`}
              >
                Abort
              </button>
              <button 
                onClick={handleBulkAdd} 
                className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/20"
              >
                Initiate Injection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const XCircleIcon = ({ className, size }: { className?: string, size?: number }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);
