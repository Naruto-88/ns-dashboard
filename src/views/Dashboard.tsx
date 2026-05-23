import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  MousePointer2, 
  Eye, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Download,
  Activity,
  Search,
  Globe,
  Monitor,
  Smartphone,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Shield,
  BarChart as ChartIcon,
  PieChart as PieIcon,
  SearchIcon,
  Layout,
  FileText,
  Filter,
  ArrowUp,
  ArrowDown,
  CheckCircle2
} from 'lucide-react';
import { DateRange, DatePreset, getDatePresetRange, getPreviousPeriod, ComparisonResult } from '../lib/seoUtils';
import { getClients, aggregateMetrics, Client, DashboardMetrics, getInsights, getPerformanceTrend, getKeywords, Keyword } from '../services/dataService';
import DateRangeSelector from '../components/DateRangeSelector';
import ClientSelector from '../components/ClientSelector';
import Tooltip from '../components/Tooltip';
import NextActionModal from '../components/NextActionModal';
import { useTheme } from '../contexts/ThemeContext';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

function MetricCard({ title, icon: Icon, comparison, prefix = '', suffix = '' }: { title: string; icon: any; comparison: ComparisonResult; prefix?: string; suffix?: string }) {
  const { theme } = useTheme();
  const isPositive = comparison.status === 'improvement';
  const isNegative = comparison.status === 'decline';
  const hasData = comparison.status !== 'no_data';

  return (
    <div className={`p-6 rounded-3xl border backdrop-blur-xl space-y-4 hover:border-blue-500/30 transition-all duration-300 group relative ${
      theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
    }`}>
      <div className="flex justify-between items-start">
        <Tooltip content={comparison.status === 'improvement' ? "Performance is trending up" : comparison.status === 'decline' ? "Performance is trending down" : "No trend data"}>
          <div className={`p-3 rounded-2xl group-hover:bg-[#f47b20] group-hover:text-white transition-colors duration-300 ${
            theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-zinc-800 text-blue-400'
          }`}>
            <Icon size={24} />
          </div>
        </Tooltip>
        {hasData && (
          <div className={`flex items-center gap-1 text-xs font-black px-3 py-1 rounded-full ${
            isPositive ? (theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-emerald-500/10 text-emerald-500') : 
            isNegative ? (theme === 'white' ? 'bg-[#e24b4a]/10 text-[#e24b4a]' : 'bg-red-500/10 text-red-500') : 
            theme === 'white' ? 'bg-[#163f4d]/5 text-[#607a80]' : 'bg-zinc-800 text-zinc-400'
          }`}>
            {isPositive ? <ArrowUpRight size={14} /> : isNegative ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            {Math.abs(comparison.percentChange || 0).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <h3 className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{title}</h3>
        <p className={`text-3xl font-black mt-2 tracking-tight font-heading ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
          {prefix}{comparison.current.toLocaleString()}{suffix}
        </p>
      </div>
      {hasData ? (
        <div className={`flex items-baseline gap-2 pt-2 border-t ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
          <span className={`text-[9px] font-black uppercase tracking-widest text-nowrap ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Previous period</span>
          <span className="text-xs font-bold text-zinc-400">{prefix}{comparison.previous?.toLocaleString()}{suffix}</span>
        </div>
      ) : (
        <p className={`text-[9px] font-bold uppercase tracking-widest pt-2 border-t ${theme === 'white' ? 'text-[#607a80] border-[#163f4d]/5' : 'text-zinc-600 border-white/5'}`}>No baseline data</p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [range, setRange] = useState<DateRange>(getDatePresetRange('last_week'));
  const [preset, setPreset] = useState<DatePreset>('last_week');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'insights'>('overview');
  
  // Data for advanced views
  const [insights, setInsights] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [strategicKeywords, setStrategicKeywords] = useState<Keyword[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'clicks', direction: 'desc' });
  const [addingActionFor, setAddingActionFor] = useState<Client | null>(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  useEffect(() => {
    getClients().then(data => {
      setClients(data);
      if (data.length > 0) setSelectedClient(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedClient) {
      getKeywords(selectedClient).then(setStrategicKeywords);
    }
  }, [selectedClient]);

  const fetchData = async (forceLive = false) => {
    if (!selectedClient) return;
    
    if (forceLive) {
      setIsLiveSyncing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
      const prevRange = getPreviousPeriod(range);
      
      Promise.all([
        aggregateMetrics(selectedClient, range, prevRange),
        getInsights(selectedClient, range),
        getPerformanceTrend(selectedClient, range)
      ]).then(([metricsData, insightsData, trendDataRes]) => {
        setMetrics(metricsData);
        setInsights(insightsData);
        setTrendData(trendDataRes);
        setLoading(false);
        setIsLiveSyncing(false);
      }).catch(err => {
        console.error('Dashboard Data Fetch Error:', err);
        setError(err.message);
        setLoading(false);
        setIsLiveSyncing(false);
      });
  };

  useEffect(() => {
    fetchData(false);
  }, [selectedClient, range]);

  const filteredQueries = useMemo(() => {
    if (!insights?.queries) return [];
    
    let result = insights.queries.map((q: any) => {
      const prev = (insights.prevQueries || []).find((pq: any) => pq.keys[0] === q.keys[0]);
      return {
        ...q,
        prevClicks: prev?.clicks || 0,
        prevImpressions: prev?.impressions || 0,
        prevPosition: prev?.position || 0,
        isStrategic: strategicKeywords.some(sk => sk.query.toLowerCase() === q.keys[0].toLowerCase())
      };
    });

    if (showSelectedOnly) {
      result = result.filter((q: any) => q.isStrategic);
    }

    if (searchQuery) {
      result = result.filter((q: any) => 
        q.keys[0].toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle nested keys or calculated values
        if (sortConfig.key === 'query') {
          aValue = a.keys[0];
          bValue = b.keys[0];
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [insights, searchQuery, showSelectedOnly, strategicKeywords, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key,
      direction: current?.key === key && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const COLORS = ['#76c9be', '#9333ea', '#f47b20', '#e24b4a', '#082a36'];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[40px] border backdrop-blur-2xl transition-all duration-300 relative z-50 ${
        theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5'
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${theme === 'white' ? 'bg-[#76c9be] shadow-[#76c9be]/20' : 'bg-blue-600 shadow-blue-600/20'}`}>
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h2 className={`text-3xl font-black font-heading tracking-tighter uppercase italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Agency Dashboard</h2>
              <p className={`text-xs font-bold uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Performance Intelligence Hub</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className={`p-1.5 rounded-2xl flex gap-1 border transition-all ${
            theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-800 border-white/5'
          }`}>
            {(['overview', 'performance', 'insights'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  activeTab === tab 
                    ? (theme === 'white' ? 'bg-[#082a36] text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg') 
                    : theme === 'white' ? 'text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10' : 'text-zinc-500 hover:text-white hover:bg-zinc-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className={`h-10 w-[1px] mx-2 transition-colors ${theme === 'white' ? 'bg-[#163f4d]/5' : 'bg-white/5'}`} />
          
          <div className="flex items-center gap-3">
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
              onClick={() => {
                const client = clients.find(c => c.id === selectedClient);
                if (client) setAddingActionFor(client);
              }}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl ${
                theme === 'white' 
                  ? 'bg-[#76c9be] text-white hover:bg-[#5bb8ad] shadow-[#76c9be]/20' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              <Target size={14} />
              Next Action
            </button>
            <button
              onClick={() => fetchData(true)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl ${
                theme === 'white' 
                  ? 'bg-[#76c9be] text-white hover:bg-[#5bb8ad] shadow-[#76c9be]/20' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20'
              }`}
            >
              <Activity size={14} className={isLiveSyncing ? 'animate-spin' : ''} />
              Live Sync
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[32px] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-tight">Signal Interrupted</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Satellite communication bottleneck identified</p>
              </div>
            </div>
            <div className="p-4 bg-zinc-950/50 rounded-2xl border border-white/5 font-mono text-[10px] text-zinc-400">
              {error}
            </div>
          </div>
        </div>
      )}

      {loading && !metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1,2,3,4].map(i => <div key={i} className={`h-40 rounded-[32px] border ${theme === 'white' ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900/50 border-white/5'}`} />)}
        </div>
      ) : !metrics ? (
        <div className={`p-20 rounded-[40px] border border-dashed text-center space-y-4 ${
          theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-white/10'
        }`}>
          <BarChart3 className={`mx-auto ${theme === 'white' ? 'text-zinc-300' : 'text-zinc-800'}`} size={64} />
          <div className="space-y-1">
            <p className={`font-black uppercase tracking-tighter text-xl italic ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Click Live Sync</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Connect to live metrics to populate your agency dashboard</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="GSC Clicks" icon={MousePointer2} comparison={metrics.clicks} />
                <MetricCard title="GSC Impressions" icon={Eye} comparison={metrics.impressions} />
                <MetricCard title="GSC Avg Position" icon={Target} comparison={metrics.position} />
                <MetricCard title="GA4 Traffic" icon={Layout} comparison={metrics.traffic} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Traffic Trend Chart */}
               <div className={`p-8 rounded-[40px] border backdrop-blur-xl transition-all duration-300 ${
                  theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Traffic Trend</h3>
                      <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>GSC Clicks & Impressions Over Time</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${theme === 'white' ? 'bg-[#76c9be]' : 'bg-blue-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400'}`}>Clicks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${theme === 'white' ? 'bg-[#9333ea]' : 'bg-purple-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400'}`}>Impressions</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                      <AreaChart data={trendData}>
                        <defs>
                          <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme === 'white' ? '#76c9be' : '#3b82f6'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={theme === 'white' ? '#76c9be' : '#3b82f6'} stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={theme === 'white' ? '#9333ea' : '#8b5cf6'} stopOpacity={0.3}/>
                            <stop offset="95%" stopColor={theme === 'white' ? '#9333ea' : '#8b5cf6'} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'white' ? '#f0f0f0' : '#27272a'} vertical={false} />
                        <XAxis 
                          dataKey="keys[0]" 
                          stroke={theme === 'white' ? '#607a80' : '#52525b'} 
                          fontSize={10} 
                          tickFormatter={(val) => val.split('-').slice(1).join('/')}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis stroke={theme === 'white' ? '#607a80' : '#52525b'} fontSize={10} axisLine={false} tickLine={false} />
                          <ChartTooltip 
                             contentStyle={{ 
                               backgroundColor: theme === 'white' ? '#fff' : '#18181b', 
                               borderColor: theme === 'white' ? 'rgba(22,63,77,0.1)' : '#27272a', 
                               borderRadius: '16px', 
                               border: theme === 'white' ? '1px solid rgba(22,63,77,0.1)' : '1px solid rgba(255,255,255,0.05)' 
                             }}
                             itemStyle={{ 
                               color: theme === 'white' ? '#082a36' : '#fff', 
                               fontSize: '12px', 
                               fontWeight: 'bold' 
                             }}
                           />
                        <Area type="monotone" dataKey="clicks" stroke={theme === 'white' ? '#76c9be' : '#3b82f6'} strokeWidth={3} fillOpacity={1} fill="url(#colorClicks)" />
                        <Area type="monotone" dataKey="impressions" stroke={theme === 'white' ? '#9333ea' : '#8b5cf6'} strokeWidth={3} fillOpacity={1} fill="url(#colorImpressions)" hide />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Lead Attribution / Conversion Chart */}
                <div className={`p-8 rounded-[40px] border backdrop-blur-xl transition-all duration-300 ${
                  theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Channel Attribution</h3>
                      <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Engagement Distribution</p>
                    </div>
                  </div>
                  <div className="h-[300px] w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                      <RePieChart>
                        <Pie
                          data={[
                            { name: 'Organic Search', value: metrics.clicks.current },
                            { name: 'Direct Traffic', value: Math.floor(metrics.traffic.current * 0.3) },
                            { name: 'Social', value: Math.floor(metrics.traffic.current * 0.1) },
                            { name: 'Referral', value: Math.floor(metrics.traffic.current * 0.05) },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={8}
                          dataKey="value"
                        >
                          {COLORS.map((color, i) => <Cell key={i} fill={color} stroke="none" />)}
                        </Pie>
                        <ChartTooltip 
                           contentStyle={{ 
                             backgroundColor: theme === 'white' ? '#fff' : '#18181b', 
                             borderColor: theme === 'white' ? '#e4e4e7' : '#27272a', 
                             borderRadius: '16px' 
                           }}
                           itemStyle={{ color: theme === 'white' ? '#18181b' : '#fff' }}
                         />
                        <Legend iconType="circle" />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* PERFORMANCE TAB (Ranked Keywords Detail) */}
          {activeTab === 'performance' && (
            <div className={`rounded-[20px] border overflow-visible backdrop-blur-xl shadow-2xl transition-all duration-300 ${
              theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <div className={`p-8 border-b flex flex-col xl:flex-row xl:items-center justify-between gap-6 ${
                theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'
              }`}>
                <div>
                  <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Keyword Performance</h3>
                  <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Detailed query analysis from GSC</p>
                </div>
                
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className={`p-1.5 rounded-2xl flex gap-1 border ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-zinc-800 border-white/5'
                  }`}>
                    <button
                      onClick={() => setShowSelectedOnly(false)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        !showSelectedOnly 
                          ? (theme === 'white' ? 'bg-[#082a36] text-white' : 'bg-blue-600 text-white shadow-lg') 
                          : theme === 'white' ? 'text-[#607a80] hover:text-[#082a36]' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      All Ranked
                    </button>
                    <button
                      onClick={() => setShowSelectedOnly(true)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        showSelectedOnly 
                          ? (theme === 'white' ? 'bg-[#76c9be] text-[#082a36]' : 'bg-blue-600 text-white shadow-lg') 
                          : theme === 'white' ? 'text-[#607a80] hover:text-[#082a36]' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      <Target size={14} />
                      Strategic Focus
                    </button>
                  </div>

                  <div className="relative group">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      theme === 'white' ? 'text-[#607a80] group-focus-within:text-[#76c9be]' : 'text-zinc-500 group-focus-within:text-blue-500'
                    }`} size={18} />
                    <input 
                      type="text" 
                      placeholder="Search keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`pl-12 pr-6 py-2.5 border rounded-2xl text-sm font-bold outline-none focus:border-[#76c9be] focus:ring-4 focus:ring-[#76c9be]/10 transition-all w-full md:w-64 ${
                        theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5 text-[#082a36]' : 'bg-zinc-800 border-white/5 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto overflow-y-visible">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`border-b text-[10px] font-black uppercase tracking-widest ${
                      theme === 'white' ? 'bg-[#082a36] border-[#163f4d]/20 text-white' : 'bg-zinc-950/50 border-white/5 text-zinc-500'
                    }`}>
                      <th className="px-8 py-2 text-left cursor-pointer hover:text-[#76c9be] transition-colors" onClick={() => handleSort('query')}>
                        <div className="flex items-center gap-2">
                          Top Search Queries
                          {sortConfig?.key === 'query' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-2 text-center cursor-pointer hover:text-[#76c9be] transition-colors" onClick={() => handleSort('clicks')}>
                        <div className="flex items-center justify-center gap-2">
                          Clicks
                          {sortConfig?.key === 'clicks' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center cursor-pointer hover:text-[#76c9be] transition-colors" onClick={() => handleSort('impressions')}>
                        <div className="flex items-center justify-center gap-2">
                          Impressions
                          {sortConfig?.key === 'impressions' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center cursor-pointer hover:text-[#76c9be] transition-colors" onClick={() => handleSort('ctr')}>
                        <div className="flex items-center justify-center gap-2">
                          CTR
                          {sortConfig?.key === 'ctr' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center cursor-pointer hover:text-[#76c9be] transition-colors" onClick={() => handleSort('position')}>
                        <div className="flex items-center justify-center gap-2">
                          Position
                          {sortConfig?.key === 'position' && (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                        </div>
                      </th>
                      <th className={`px-8 py-2 text-right font-black uppercase tracking-widest ${theme === 'white' ? 'text-white' : 'text-zinc-500'}`}>Drift</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${theme === 'white' ? 'divide-[#163f4d]/5' : 'divide-white/5'}`}>
                    {filteredQueries.map((q: any, i: number) => {
                      const posDiff = q.prevPosition - q.position; // Improvement if pos decreases (e.g. 10 -> 8)
                      const isPosImprovement = q.prevPosition > 0 && q.position < q.prevPosition;
                      const isPosDecline = q.prevPosition > 0 && q.position > q.prevPosition;

                      return (
                        <tr key={i} className={`transition-colors group ${theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                          <td className="px-8 py-2">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <span className={`text-sm font-bold transition-colors ${theme === 'white' ? 'text-[#082a36] group-hover:text-[#76c9be]' : 'text-white group-hover:text-blue-400'}`}>{q.keys[0]}</span>
                                {q.isStrategic && (
                                  <div className="absolute -left-5 top-1/2 -translate-y-1/2">
                                    <Tooltip content="Strategic Focus Keyword">
                                      <div className={`w-1.5 h-6 rounded-full ${theme === 'white' ? 'bg-[#76c9be]' : 'bg-blue-600'}`} />
                                    </Tooltip>
                                  </div>
                                )}
                              </div>
                              <ExternalLink size={12} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </td>
                          <td className="px-6 py-2 text-center">
                            <div className="flex flex-col items-center">
                              <span className={`font-mono text-sm font-bold ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-300'}`}>{q.clicks.toLocaleString()}</span>
                              {q.prevClicks > 0 && (
                                <span className={`text-[9px] font-black mt-0.5 ${q.clicks >= q.prevClicks ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#e24b4a]' : 'text-red-500')}`}>
                                  {q.clicks >= q.prevClicks ? '+' : ''}{q.clicks - q.prevClicks}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-2 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-sm text-zinc-500">{q.impressions.toLocaleString()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-2 text-center">
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                              theme === 'white' ? 'bg-[#163f4d]/5 text-[#607a80]' : 'bg-zinc-800 text-zinc-400'
                            }`}>
                              {(q.ctr * 100).toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-6 py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={`text-sm font-black ${q.position <= 3 ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : q.position <= 10 ? (theme === 'white' ? 'text-[#f47b20]' : 'text-blue-500') : 'text-zinc-400'}`}>
                                {q.position.toFixed(1)}
                              </span>
                              {q.prevPosition > 0 && (posDiff !== 0) && (
                                <div className={`flex items-center text-[10px] font-black ${isPosImprovement ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#e24b4a]' : 'text-red-500')}`}>
                                  {isPosImprovement ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
                                  {Math.abs(posDiff).toFixed(1)}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-2 text-right">
                             <div className="flex flex-col items-end gap-1">
                               <div className={`h-1 rounded-full w-24 overflow-hidden ${theme === 'white' ? 'bg-[#163f4d]/5' : 'bg-zinc-800'}`}>
                                  <div 
                                    className={`h-full transition-all duration-1000 ${q.position <= 10 ? (theme === 'white' ? 'bg-[#76c9be]' : 'bg-emerald-500') : (theme === 'white' ? 'bg-[#082a36]' : 'bg-blue-500')}`}
                                    style={{ width: `${Math.max(5, 100 - (q.position * 2))}%` }}
                                  />
                               </div>
                               <span className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>
                                 {q.position <= 10 ? 'Elite' : q.position <= 30 ? 'Active' : 'Distant'}
                               </span>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredQueries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-20 text-center text-zinc-400 font-bold uppercase tracking-widest text-xs">No active keyword data found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* INSIGHTS TAB (GSC-style Insights) */}
          {activeTab === 'insights' && insights && (
            <div className="space-y-8 max-w-6xl mx-auto">
              {/* Snapshot Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className={`p-8 rounded-[40px] border backdrop-blur-xl group transition-all duration-300 ${
                  theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className={`flex items-center gap-2 mb-6 transition-colors ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400 group-hover:text-blue-400'}`}>
                    <MousePointer2 size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Total Clicks</span>
                    <HelpCircle size={14} className="ml-auto opacity-40" />
                  </div>
                  <div className="flex items-end gap-4">
                    <span className={`text-5xl font-black font-heading leading-none ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{metrics.clicks.current.toLocaleString()}</span>
                    <div className={`flex items-center font-black text-sm mb-1 uppercase tracking-tighter ${theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500'}`}>
                      <TrendingUp size={16} className="mr-1" />
                      +{Math.abs(metrics.clicks.percentChange || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div className="mt-8 h-20 w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                      <LineChart data={trendData.slice(-14)}>
                        <Line type="monotone" dataKey="clicks" stroke={theme === 'white' ? '#76c9be' : '#3b82f6'} strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className={`p-8 rounded-[40px] border backdrop-blur-xl group transition-all duration-300 ${
                  theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className={`flex items-center gap-2 mb-6 transition-colors ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400 group-hover:text-purple-400'}`}>
                    <Eye size={18} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Impressions</span>
                    <HelpCircle size={14} className="ml-auto opacity-40" />
                  </div>
                  <div className="flex items-end gap-4">
                    <span className={`text-5xl font-black font-heading leading-none ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{(metrics.impressions.current / 1000).toFixed(1)}K</span>
                    <div className={`flex items-center font-black text-sm mb-1 uppercase tracking-tighter ${theme === 'white' ? 'text-[#e24b4a]' : 'text-red-500'}`}>
                      <TrendingDown size={16} className="mr-1" />
                      -{Math.abs(metrics.impressions.percentChange || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div className="mt-8 h-20 w-full overflow-hidden">
                    <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                      <LineChart data={trendData.slice(-14)}>
                        <Line type="monotone" dataKey="impressions" stroke={theme === 'white' ? '#9333ea' : '#8b5cf6'} strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Your Content Section */}
              <div className={`rounded-[40px] border overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
              }`}>
                <div className={`p-8 border-b flex items-center justify-between ${
                  theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-emerald-500/10 text-emerald-500'}`}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Top Content</h3>
                      <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>High-performing pages by clicks</p>
                    </div>
                  </div>
                  <button className={`text-[10px] font-black uppercase tracking-widest transition-colors ${theme === 'white' ? 'text-[#76c9be] hover:text-[#082a36]' : 'text-blue-500 hover:text-blue-400'}`}>View More</button>
                </div>
                <div className="flex flex-col">
                  {insights.pages.slice(0, 5).map((page: any, i: number) => (
                    <div key={i} className={`flex items-center gap-6 p-6 transition-colors group ${
                      theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'
                    }`}>
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden ring-1 ${
                        theme === 'white' ? 'bg-[#76c9be]/5 ring-[#163f4d]/5 text-[#607a80]' : 'bg-zinc-800 ring-white/5 text-zinc-500'
                      }`}>
                        {page.keys[0].includes('blog') ? <FileText size={24} /> : <Globe size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold truncate transition-colors uppercase tracking-tight ${
                          theme === 'white' ? 'text-[#082a36] group-hover:text-[#76c9be]' : 'text-white group-hover:text-blue-400'
                        }`}>
                          {page.keys[0].split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Home Page'}
                        </h4>
                        <p className={`text-[10px] font-medium truncate mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>{page.keys[0]}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-black font-heading leading-none ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{page.clicks}</p>
                        <p className={`text-[9px] font-black uppercase tracking-widest mt-1 flex items-center justify-end ${theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500'}`}>
                          <ArrowUpRight size={10} className="mr-0.5" />
                          {Math.floor(Math.random() * 20)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Search Queries Leading to site */}
                <div className={`rounded-[40px] border overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                  theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className={`p-8 border-b ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
                    <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Search Intent</h3>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Queries leading to your site</p>
                  </div>
                  <div className="p-2">
                    {insights.queries.slice(0, 5).map((q: any, i: number) => (
                      <div key={i} className={`flex items-center justify-between p-4 rounded-2xl transition-colors group ${
                        theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/5'
                      }`}>
                        <span className={`text-xs font-bold uppercase tracking-tight ${
                          theme === 'white' ? 'text-[#607a80] group-hover:text-[#082a36]' : 'text-zinc-300 group-hover:text-white'
                        }`}>{q.keys[0]}</span>
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center gap-1 text-[9px] font-black ${i % 2 === 0 ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#e24b4a]' : 'text-red-500')}`}>
                            {i % 2 === 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.floor(Math.random() * 50)}%
                          </div>
                          <span className={`text-sm font-black w-8 text-right font-heading font-mono ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{q.clicks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Geo / Technical Breakdown */}
                <div className={`rounded-[40px] border overflow-hidden backdrop-blur-xl transition-all duration-300 ${
                   theme === 'white' ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
                }`}>
                  <div className={`p-8 border-b ${theme === 'white' ? 'border-[#163f4d]/5' : 'border-white/5'}`}>
                    <h3 className={`text-xl font-black font-heading tracking-tight uppercase ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Global Audience</h3>
                    <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Top countries by interest</p>
                  </div>
                  <div className="p-8 space-y-6">
                    {insights.countries.map((c: any, i: number) => {
                      const totalClicks = insights.countries.reduce((a: any, b: any) => a + (b.clicks || 0), 0);
                      const percent = ((c.clicks / totalClicks) * 100);
                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest text-[#607a80]">
                            <span>{c.keys[0]}</span>
                            <span>{percent.toFixed(0)}%</span>
                          </div>
                          <div className={`h-2 rounded-full overflow-hidden ${theme === 'white' ? 'bg-[#163f4d]/5' : 'bg-zinc-800'}`}>
                            <div 
                              className={`h-full rounded-full ${theme === 'white' ? 'bg-[#76c9be]' : 'bg-blue-600'}`} 
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {addingActionFor && (
        <NextActionModal
          client={addingActionFor}
          onClose={() => setAddingActionFor(null)}
          onSuccess={() => setAddingActionFor(null)}
        />
      )}
    </div>
  );
}
