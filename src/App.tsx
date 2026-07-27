/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  LayoutDashboard, 
  Users, 
  Settings, 
  Key, 
  FileText, 
  Calendar,
  LogOut,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertCircle,
  Lock,
  BrainCircuit,
  Target,
  Megaphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './views/Dashboard';
import ClientScoreboard from './views/ClientScoreboard';
import KeywordDashboard from './views/KeywordDashboard';
import WeeklyData from './views/WeeklyData';
import ClientManagement from './views/ClientManagement';
import GlobalSettings from './views/GlobalSettings';
import GoalsAndTargets from './views/GoalsAndTargets';
import AiStrategicAnalysis from './views/AiStrategicAnalysis';
import LeadGenPlaybook from './views/LeadGenPlaybook';
import ActionCenter from './views/ActionCenter';
import Tooltip from './components/Tooltip';
import AdsDashboard from './views/AdsDashboard';
import AdsMasterDashboard from './views/AdsMasterDashboard';
import AdsWeeklyInputs from './views/AdsWeeklyInputs';
import { useState, useEffect } from 'react';
import React from 'react';
import { auth, supabase } from './lib/supabase';
import { useTheme } from './contexts/ThemeContext';

function Sidebar({ isCollapsed, onToggle, user }: { isCollapsed: boolean; onToggle: () => void; user: any }) {
  const location = useLocation();
  const { theme } = useTheme();
  
  const navItems = [
    { name: 'Master Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Client Dashboard', icon: BarChart3, path: '/agency' },
    { name: 'Client Scoreboard', icon: Users, path: '/scoreboard' },
    { name: 'Ads Master', icon: Megaphone, path: '/ads-master' },
    { name: 'Client Ads Details', icon: Megaphone, path: '/ads-growth' },
    { name: 'Goals & Targets', icon: Target, path: '/goals-targets' },
    { name: 'AI Analysis', icon: BrainCircuit, path: '/strategic-analysis' },
    { name: 'Lead Playbook', icon: FileText, path: '/lead-playbook' },
    { name: 'Action Center', icon: Target, path: '/action-center' },
    { name: 'Keyword Tracking', icon: Key, path: '/keywords' },
    { name: 'Weekly Data', icon: Calendar, path: '/weekly' },
    { name: 'Weekly Ads Entry', icon: Calendar, path: '/ads-inputs' },
  ];

  const adminNavItems = [
    { name: 'Clients', icon: Users, path: '/clients' },
    { name: 'Google Settings', icon: Settings, path: '/settings' },
  ];

  const isAdmin = user?.email === 'weerasinghemelaka1@gmail.com' || user?.email === 'melaka@team.com';

  const visibleItems = isAdmin ? [...navItems, ...adminNavItems] : navItems;

  return (
    <aside className={`${isCollapsed ? 'w-20' : 'w-64'} ${
      theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5 shadow-[0_0_100px_rgba(37,99,235,0.05)]'
    } border-r h-screen sticky top-0 flex flex-col transition-all duration-300 ease-in-out z-30`}>
      <div className="p-6 overflow-hidden">
        <h1 className={`text-xl font-medium flex items-center gap-2 whitespace-nowrap ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
          <TrendingUp className={
            theme === 'mission' ? "text-emerald-500 shrink-0" : 
            theme === 'white' ? "text-[#082a36] shrink-0" :
            "text-blue-500 shrink-0"
          } />
          {!isCollapsed && (
            <span className="tracking-tight text-lg font-bold">
              <span className={theme === 'white' ? 'text-[#082a36]' : 'text-white'}>net</span>
              <span className={
                theme === 'mission' ? 'text-emerald-500' : 
                theme === 'white' ? 'text-[#76c9be]' : 
                'text-blue-500'
              }>Stripes</span>
            </span>
          )}
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto overflow-x-hidden pt-4">
        {visibleItems.map((item) => (
          <React.Fragment key={item.path}>
            <Tooltip content={item.name} position="right" className="w-full">
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium uppercase tracking-wider rounded-lg transition-all duration-200 overflow-hidden whitespace-nowrap ${
                  location.pathname === item.path
                    ? (
                        theme === 'mission' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 
                        theme === 'white' ? 'bg-zinc-900 text-white shadow-lg shadow-zinc-900/20' :
                        'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                      )
                    : theme === 'white' ? 'text-[#082a36] hover:bg-zinc-100 hover:text-[#76c9be]' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'
                }`}
              >
                <item.icon size={16} className="shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            </Tooltip>
          </React.Fragment>
        ))}
      </nav>
      <div className={`p-4 border-t ${theme === 'white' ? 'border-zinc-200' : 'border-white/5'} space-y-1`}>
        <button 
          onClick={onToggle}
          className={`flex items-center gap-3 px-3 py-2 w-full text-sm font-medium ${
            theme === 'white' ? 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
          } rounded-lg transition-all overflow-hidden whitespace-nowrap uppercase tracking-wider`}
        >
          <div className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}>
             <ChevronRight size={16} className="shrink-0" />
          </div>
          {!isCollapsed && <span>Collapse</span>}
        </button>
        <button 
          onClick={() => auth.signOut()}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm font-medium text-red-500/80 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all overflow-hidden whitespace-nowrap uppercase tracking-wider"
        >
          <LogOut size={16} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

function Layout({ children, user }: { children: React.ReactNode; user: any }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme } = useTheme();

  return (
    <div className={`flex min-h-screen ${
      theme === 'mission' ? 'bg-[#050507]' : 
      theme === 'white' ? 'bg-[#f8f9fa]' :
      'bg-black'
    } ${theme === 'white' ? 'text-slate-900' : 'text-white'}`}>
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} user={user} />
      <main className="flex-1 p-8 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={useLocation().pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Login() {
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [supabaseReady, setSupabaseReady] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.from('clients').select('id', { count: 'exact', head: true })
      .then(({ error: readyError }) => {
        if (readyError) console.error('Connection check error:', readyError);
        setSupabaseReady(!readyError || readyError.code === 'PGRST301');
      });
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const team = ['Melaka', 'Amit', 'Sai', 'Vinoj', 'Sash', 'Lidusha', 'Thisura'];
      let targetEmail = email.trim().toLowerCase();
      
      // If user provided just a name from the team, convert to team email
      if (team.some(n => n.toLowerCase() === targetEmail)) {
        targetEmail = `${targetEmail}@team.com`;
      }
      // If it doesn't look like an email, assume it's a name and try team email
      else if (!targetEmail.includes('@')) {
        targetEmail = `${targetEmail}@team.com`;
      }
      
      console.log('Attempting login for:', targetEmail);
      
      const { error: loginError } = await auth.signInWithPassword({
        email: targetEmail,
        password: password
      });
      if (loginError) throw loginError;
    } catch (e: any) {
      console.error('Login error detail:', e);
      let msg = e.message || 'Invalid credentials.';
      
      if (msg.includes('Invalid path')) {
        msg = 'Connection Error: Invalid path in database URL. Please check VITE_SUPABASE_URL in settings.';
      } else if (msg.includes('Invalid login credentials')) {
        msg = `Invalid credentials for ${email.trim()}. Hint: Use your name and MelakaWee@123#`;
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${
      theme === 'mission' ? 'bg-[#050507]' : 
      theme === 'white' ? 'bg-[#f0f2f5]' :
      'bg-black'
    } px-4 font-sans`}>
      <div className={`${
        theme === 'mission' ? 'bg-zinc-900 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 
        theme === 'white' ? 'bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] text-slate-900 border-zinc-200' :
        'bg-zinc-950 shadow-2xl'
      } p-10 rounded-[32px] border border-white/5 max-w-md w-full space-y-10 animate-in fade-in zoom-in duration-500`}>
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className={`px-3 py-1 rounded-full text-sm font-black uppercase tracking-[0.2em] border ${
              supabaseReady === null ? (theme === 'white' ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-zinc-800 text-zinc-500 border-white/10') :
              supabaseReady ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {supabaseReady === null ? 'SYNC_PENDING' : supabaseReady ? 'SYNC_ACTIVE' : 'SYNC_OFFLINE'}
            </div>
          </div>
          <div className={`w-20 h-20 ${
            theme === 'mission' ? 'bg-emerald-600 shadow-emerald-600/20' : 
            theme === 'white' ? 'bg-zinc-900 shadow-zinc-900/20' :
            'bg-blue-600 shadow-blue-600/20'
          } text-white rounded-[28px] flex items-center justify-center mx-auto shadow-2xl animate-pulse transform hover:scale-110 transition-transform duration-300`}>
            <TrendingUp size={40} />
          </div>
          <div className="space-y-2">
            <h1 className={`text-4xl font-black ${theme === 'white' ? 'text-zinc-900' : 'text-white'} tracking-tighter uppercase italic italic`}>SEO_HUB</h1>
            <p className="text-zinc-500 text-sm font-black uppercase tracking-[0.3em]">Operational Intelligence</p>
          </div>
        </div>
        
        {error && (
          <div className={`p-5 bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-black rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-2 duration-300 uppercase tracking-tighter`}>
            <AlertCircle size={20} className="flex-shrink-0" />
            <div className="flex-1">
              <div>{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-black text-zinc-600 uppercase tracking-[0.2em] pl-1">Vector Identity</label>
            <div className="relative group">
              <input 
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ID: AMIT, SAI, MELAKA..."
                className={`w-full px-6 py-4 border rounded-2xl font-black text-sm outline-none focus:border-blue-500 transition-all pl-14 uppercase tracking-widest ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                }`}
              />
              <Users className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                theme === 'white' ? 'text-zinc-300 group-focus-within:text-blue-500' : 'text-zinc-700 group-focus-within:text-blue-500'
              }`} size={22} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-black text-zinc-600 uppercase tracking-[0.2em] pl-1">Access Phrase</label>
            <div className="relative group">
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full px-6 py-4 border rounded-2xl font-black text-sm outline-none focus:border-blue-500 transition-all pl-14 tracking-widest ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-900 border-white/5 text-white'
                }`}
              />
              <Lock className={`absolute left-5 top-1/2 -translate-y-1/2 transition-colors ${
                theme === 'white' ? 'text-zinc-300 group-focus-within:text-blue-500' : 'text-zinc-700 group-focus-within:text-blue-500'
              }`} size={22} />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-5 ${theme === 'mission' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-blue-600 shadow-blue-500/30'} text-white rounded-2xl font-black text-sm shadow-2xl hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-[0.2em]`}
          >
            {loading ? 'Authenticating...' : 'Engage Dashboard'}
            {!loading && <ChevronRight size={20} />}
          </button>
        </form>
      </div>
    </div>
  );
}

import MasterDashboard from './views/MasterDashboard';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Login />;

  const isAdmin = user.email === 'weerasinghemelaka1@gmail.com' || user.email === 'melaka@team.com';

  return (
    <BrowserRouter>
      <Layout user={user}>
        <Routes>
          <Route path="/" element={<MasterDashboard />} />
          <Route path="/agency" element={<Dashboard />} />
          <Route path="/scoreboard" element={<ClientScoreboard />} />
          <Route path="/goals-targets" element={<GoalsAndTargets />} />
          <Route path="/strategic-analysis" element={<AiStrategicAnalysis />} />
          <Route path="/lead-playbook" element={<LeadGenPlaybook />} />
          <Route path="/action-center" element={<ActionCenter />} />
          <Route path="/keywords" element={<KeywordDashboard />} />
          <Route path="/weekly" element={<WeeklyData />} />
          <Route path="/ads-master" element={<AdsMasterDashboard />} />
          <Route path="/ads-growth" element={<AdsDashboard />} />
          <Route path="/ads-inputs" element={<AdsWeeklyInputs />} />
          {isAdmin && (
            <>
              <Route path="/clients" element={<ClientManagement />} />
              <Route path="/settings" element={<GlobalSettings />} />
            </>
          )}
          {/* Support for back-compatibility or alternative access */}
          {!isAdmin && <Route path="/clients" element={<MasterDashboard />} />}
          {!isAdmin && <Route path="/settings" element={<MasterDashboard />} />}
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
