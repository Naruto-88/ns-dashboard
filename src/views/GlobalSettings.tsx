import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle, RefreshCw, Unlink, Globe, Lock, AlertCircle, ExternalLink, Palette, Monitor, Zap } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface AuthStatus {
  connected: boolean;
  email?: string;
  last_connected?: string;
  token_status?: string;
  redirect_uri?: string;
  is_initialized?: boolean;
}

export default function GlobalSettings() {
  const { theme, setTheme } = useTheme();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [authorizedSites, setAuthorizedSites] = useState<string[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/google/status');
      const data = await res.json();
      setStatus(data);
      if (data.redirect_uri) setRedirectUri(data.redirect_uri);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    setLoadingSites(true);
    setAuthorizedSites([]);
    try {
      const res = await fetch('/api/auth/google/list-sites');
      const data = await res.json();
      if (data.sites) {
        setAuthorizedSites(data.sites);
      } else if (data.error) {
        alert('Permission Scan Failed: ' + data.error);
      }
    } catch (e: any) {
      alert('Network Error during scan: ' + e.message);
    } finally {
      setLoadingSites(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      if (!res.ok) {
        const error = await res.json();
        alert('Failed to get Auth URL: ' + (error.error || 'Unknown error'));
        return;
      }
      const data = await res.json();
      if (data.url) {
        // Open in a new tab as requested by user
        window.open(data.url, '_blank');
      } else {
        alert('Server did not return a Google Auth URL.');
      }
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className={`text-3xl font-black font-heading uppercase tracking-tighter italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Command Center</h2>
          <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Operational configuration and satellite links</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* THEME SELECTOR */}
          <section className={`rounded-[40px] border shadow-2xl p-10 backdrop-blur-xl relative overflow-hidden group transition-all duration-300 ${
            theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <Palette size={120} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-3 rounded-2xl border ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                  <Palette size={24} />
                </div>
                <div>
                  <h3 className={`text-xl font-black font-heading uppercase italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Visual Protocol</h3>
                  <p className={`text-[10px] uppercase tracking-widest font-black ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Select operational aesthetic</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button 
                  onClick={() => setTheme('midnight')}
                  className={`relative p-6 rounded-[32px] border transition-all text-left group/btn ${
                    theme === 'midnight' 
                      ? 'bg-blue-600 border-blue-500 shadow-[0_0_40px_rgba(37,99,235,0.2)]' 
                      : theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 hover:border-[#76c9be]/30' : 'bg-zinc-800/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Monitor size={24} className={theme === 'midnight' ? 'text-white' : theme === 'white' ? 'text-zinc-400' : 'text-zinc-500'} />
                    {theme === 'midnight' && <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_#fff]" />}
                  </div>
                  <h4 className={`text-sm font-black uppercase tracking-widest ${theme === 'midnight' ? 'text-white' : theme === 'white' ? 'text-zinc-900' : 'text-zinc-400'}`}>Midnight Boutique</h4>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${theme === 'midnight' ? 'text-blue-100' : theme === 'white' ? 'text-zinc-500' : 'text-zinc-600'}`}>Dark & Premium</p>
                </button>

                <button 
                  onClick={() => setTheme('mission')}
                  className={`relative p-6 rounded-[32px] border transition-all text-left group/btn ${
                    theme === 'mission' 
                      ? 'bg-emerald-600 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]' 
                      : theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10 hover:border-[#76c9be]/30' : 'bg-zinc-800/50 border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Zap size={24} className={theme === 'mission' ? 'text-white' : theme === 'white' ? 'text-zinc-400' : 'text-zinc-500'} />
                    {theme === 'mission' && <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_10px_#fff]" />}
                  </div>
                  <h4 className={`text-sm font-black uppercase tracking-widest ${theme === 'mission' ? 'text-white' : theme === 'white' ? 'text-zinc-900' : 'text-zinc-400'}`}>Mission Control</h4>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${theme === 'mission' ? 'text-emerald-100' : theme === 'white' ? 'text-zinc-500' : 'text-zinc-600'}`}>Technical & Precise</p>
                </button>

                <button 
                  onClick={() => setTheme('white')}
                  className={`relative p-6 rounded-[24px] border transition-all text-left group/btn ${
                    theme === 'white' 
                      ? 'bg-[#082a36] border-[#082a36] shadow-xl' 
                      : 'bg-white border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Palette size={24} className={theme === 'white' ? 'text-white' : 'text-zinc-500'} />
                    {theme === 'white' && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_#10b981]" />}
                  </div>
                  <h4 className={`text-sm font-black font-heading uppercase tracking-widest ${theme === 'white' ? 'text-white' : 'text-zinc-900'}`}>White Boutique</h4>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${theme === 'white' ? 'text-[#76c9be]' : 'text-zinc-500'}`}>High Contrast Light</p>
                </button>
              </div>
            </div>
          </section>

          <section className={`rounded-[24px] border shadow-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden group ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className={`p-10 border-b flex items-center justify-between transition-colors ${
              theme === 'white' ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-950/50 border-white/5'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl border transition-all ${
                  theme === 'white' ? 'bg-[#76c9be]/5 border-[#76c9be]/20 text-[#76c9be]' : 'bg-zinc-800 text-blue-400 border-white/5'
                }`}>
                  <Globe size={24} />
                </div>
                <div>
                  <h3 className={`text-xl font-black font-heading uppercase italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Satellite Uplink</h3>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Central Google OAuth Protocol</p>
                </div>
              </div>
              {!status?.is_initialized && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-500 text-[9px] font-black rounded-full border border-rose-500/20 uppercase tracking-widest">
                  <AlertCircle size={12} />
                  Engine Offline
                </div>
              )}
              {status?.connected && status?.is_initialized && (
                <div className={`flex items-center gap-2 px-3 py-1 text-[9px] font-black rounded-full border uppercase tracking-widest ${
                  theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                }`}>
                  <CheckCircle2 size={12} />
                  Active Link
                </div>
              )}
            </div>

            <div className="p-10 space-y-10">
              {!status?.is_initialized && (
                <div className={`p-6 border rounded-3xl space-y-3 shadow-2xl ${
                  theme === 'white' ? 'bg-zinc-50 border-rose-200 shadow-rose-500/5' : 'bg-zinc-950 border-rose-500/20'
                }`}>
                  <h4 className="text-xs font-black text-rose-500 flex items-center gap-2 uppercase tracking-widest">
                    <AlertCircle size={16} />
                    OAuth Authentication Failure
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-black uppercase tracking-loose leading-relaxed">
                    Google Client ID and Secret are missing from the environment variables. 
                    Please add them to the <span className={theme === 'white' ? 'text-zinc-900' : 'text-white'}>Secrets</span> panel in AI Studio to enable satellite link.
                  </p>
                </div>
              )}

              {status?.redirect_uri && (
                <div className="space-y-6">
                  <div className={`p-8 border rounded-[32px] space-y-4 shadow-inner transition-colors ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-zinc-950 border-white/5'
                  }`}>
                    <label className={`text-[9px] font-black uppercase tracking-widest ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-600'}`}>Callback Terminal (Redirect URI)</label>
                    <div className="flex gap-3">
                      <input 
                        readOnly 
                        value={status.redirect_uri}
                        className={`flex-1 border rounded-2xl px-5 py-3 text-xs font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-white/5 text-zinc-400'
                        }`}
                      />
                      <button 
                        onClick={() => copyToClipboard(status.redirect_uri!)}
                        className={`px-6 border rounded-2xl text-[10px] font-black transition-all uppercase tracking-widest active:scale-95 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36] hover:bg-[#082a36]/90' : 'bg-zinc-800 border-white/5 text-white hover:bg-zinc-700'
                        }`}
                      >
                        Copy
                      </button>
                    </div>
                    <div className={`flex gap-3 p-4 border rounded-2xl transition-colors ${
                      theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-900 border-white/5'
                    }`}>
                      <AlertCircle size={16} className={`shrink-0 mt-0.5 ${theme === 'white' ? 'text-[#76c9be]' : 'text-zinc-600'}`} />
                      <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed italic ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                        Protocol: You must copy the exact terminal path above into your G-Console credentials. Subdomain-only links will trigger a 
                        <span className={theme === 'white' ? 'text-[#082a36]' : 'text-white'}> Security Exception (403)</span>.
                      </p>
                    </div>
                  </div>

                  {!status?.connected && (
                    <div className={`p-8 rounded-[32px] border space-y-4 transition-colors ${
                      theme === 'white' ? 'bg-[#f47b20]/5 border-[#f47b20]/20' : 'bg-amber-500/5 border-amber-500/20'
                    }`}>
                      <h4 className={`text-sm font-black flex items-center gap-2 uppercase italic tracking-tighter ${theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}`}>
                        <Zap size={18} />
                        Resolution Protocols for Access Block
                      </h4>
                      <ul className={`text-[10px] space-y-3 uppercase tracking-widest font-black leading-relaxed ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400'}`}>
                        <li className="flex gap-3"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Set state to <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>"Production"</span> in OAuth Consent Screen (Fixes 403).</span></li>
                        <li className="flex gap-3 items-start"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Add your email to <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>"Authorized Test Users"</span>.</span></li>
                        <li className="flex gap-3 items-start"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Whitelist <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>run.app</span> as an Authorized Domain.</span></li>
                        <li className="flex gap-3 items-start"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Initiate link via <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>Incognito Node</span> to prevent session collisions.</span></li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {status?.connected ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="space-y-1">
                      <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Identified Link</label>
                      <p className={`text-sm font-black font-heading italic truncate ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{status.email}</p>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Last Pulse Detected</label>
                      <p className={`text-xs font-black font-mono ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-400'}`}>
                        {status.last_connected ? new Date(status.last_connected).toLocaleString() : 'PENDING'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-[9px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Encryption Integrity</label>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${status.token_status?.includes('Valid') ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500')}`}>
                        {status.token_status || 'UNKNOWN'}
                      </p>
                    </div>
                  </div>
                  <div className={`p-8 rounded-[32px] border space-y-6 relative group/card transition-colors ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-zinc-950 border-white/5'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Shield size={18} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
                      <h4 className={`text-xs font-black font-heading uppercase tracking-widest ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Security Clearance</h4>
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed italic ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>
                      Automated reporting nodes use vault-encrypted keys. Access level is strictly set to read-only surveillance.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleConnect}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-zinc-800 border-white/5 text-white'
                        } hover:brightness-110`}
                      >
                        <RefreshCw size={14} />
                        Cycle Satellite Link
                      </button>
                      <button 
                        onClick={fetchSites}
                        disabled={loadingSites}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${
                          theme === 'white' ? 'bg-[#76c9be] text-white hover:bg-[#76c9be]/90' : 'bg-blue-600 text-white hover:brightness-110'
                        }`}
                      >
                        {loadingSites ? <RefreshCw size={14} className="animate-spin" /> : <Monitor size={14} />}
                        Scan Authorized Sites
                      </button>
                      <button 
                        onClick={async () => {
                          if (confirm('Sever all connections to this account?')) {
                            try {
                              await fetch('/api/auth/google/disconnect', { method: 'POST' });
                              fetchStatus();
                            } catch (e) {
                              alert('Protocol Failure: Disconnect Aborted');
                            }
                          }
                        }}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
                      >
                        <Unlink size={14} />
                        Decommission Account
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-8">
                  <div className={`w-24 h-24 rounded-[40px] border flex items-center justify-center shadow-2xl relative transition-colors ${
                    theme === 'white' ? 'bg-zinc-100 border-zinc-200 text-zinc-300' : 'bg-zinc-900 border-white/5 text-zinc-700'
                  }`}>
                    <Lock size={40} />
                    <div className="absolute inset-0 bg-blue-500/5 blur-[40px] rounded-full" />
                  </div>
                  <div className="max-w-md space-y-3">
                    <h4 className={`text-xl font-black font-heading uppercase italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Link Required</h4>
                    <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed px-10 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                      Automated surveillance nodes require a high-clearance Google account for global data collection.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                    <button 
                      onClick={handleConnect}
                      className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                        theme === 'white' ? 'bg-[#f47b20] text-white shadow-[#f47b20]/20 hover:bg-[#f47b20]/90' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                      }`}
                    >
                      Establish Link
                    </button>
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 border rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${
                        theme === 'white' ? 'bg-[#76c9be]/10 border-[#76c9be]/20 text-[#082a36] hover:bg-[#76c9be]/20' : 'bg-zinc-800 border-white/5 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      Bypass Node (iFrame) <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {authorizedSites.length > 0 && (
            <section className={`rounded-[40px] border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-500 overflow-hidden transition-colors ${
              theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
            }`}>
               <div className={`p-10 border-b flex items-center justify-between ${
                 theme === 'white' ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-950/50 border-white/5'
               }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl border transition-all ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#76c9be]/20 text-[#76c9be]' : 'bg-blue-600/10 text-blue-400 border-white/5'
                  }`}>
                    <Monitor size={24} />
                  </div>
                  <div>
                    <h3 className={`text-xl font-black font-heading uppercase italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Asset Synchronization</h3>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Authorized GSC Properties Detected</p>
                  </div>
                </div>
                <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  {authorizedSites.length} SECURED NODES
                </div>
              </div>
              <div className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authorizedSites.map((site) => (
                    <div key={site} className={`flex items-center justify-between p-4 border rounded-2xl group transition-all ${
                      theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5 hover:border-[#76c9be]/30' : 'bg-zinc-950 border-white/5'
                    }`}>
                      <div className="flex items-center gap-4 overflow-hidden">
                        <Globe size={16} className={`transition-colors shrink-0 ${theme === 'white' ? 'text-[#76c9be]' : 'text-zinc-600 group-hover:text-blue-500'}`} />
                        <span className={`text-[11px] font-black transition-colors truncate uppercase tracking-tighter ${
                          theme === 'white' ? 'text-[#607a80] group-hover:text-[#082a36]' : 'text-zinc-400 group-hover:text-white'
                        }`}>{site}</span>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(site)}
                        className={`p-2 transition-colors ${theme === 'white' ? 'text-[#607a80] hover:text-[#082a36]' : 'text-zinc-700 hover:text-white'}`}
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className={`mt-8 p-6 border rounded-3xl flex items-start gap-4 transition-colors ${
                  theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-950 border-blue-500/10'
                }`}>
                  <AlertCircle size={18} className={theme === 'white' ? 'text-[#76c9be] shrink-0 mt-1' : 'text-blue-500 shrink-0 mt-1'} />
                  <p className={`text-[10px] font-black uppercase tracking-widest leading-relaxed ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                    Deployment Note: You must use the <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>EXACT</span> URL strings listed above in your Client Management settings. 
                    Adding or omitting a trailing slash (/) will result in a <span className="text-rose-500">Permission Denied</span> error from Google Satellite.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-8">
          <section className={`rounded-[40px] border p-10 shadow-2xl backdrop-blur-xl transition-all ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <h3 className={`text-lg font-black font-heading uppercase italic tracking-tighter mb-6 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Database Ops</h3>
            <div className="space-y-4">
              <p className={`text-[9px] font-black uppercase tracking-widest leading-relaxed mb-6 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                Initialize client nodes and operational officer accounts.
              </p>
              <button 
                onClick={async () => {
                  if (confirm('Finalize database seeding sequence?')) {
                    try {
                      const res = await fetch('/api/admin/seed', { method: 'POST' });
                      const result = await res.json();
                      alert('Sequence Success: System Initialized');
                    } catch (e: any) {
                      alert('Sequence Failure: System Compromised');
                    }
                  }
                }}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 border rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  theme === 'white' ? 'bg-[#76c9be]/5 text-[#082a36] border-[#163f4d]/10 hover:bg-[#76c9be]/10' : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700'
                }`}
              >
                <RefreshCw size={16} />
                Seed Database
              </button>
            </div>
          </section>

          <section className={`rounded-[40px] border p-10 shadow-2xl backdrop-blur-xl transition-all ${
            theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <h3 className={`text-lg font-black font-heading uppercase italic tracking-tighter mb-8 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Pulse Scheduler</h3>
            <div className="space-y-6">
              <div className={`p-6 rounded-[32px] border transition-colors ${
                theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-950 border-white/5'
              }`}>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Weekly Cycle</p>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-4 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Monday 0400 Local Time</p>
                <div className="flex items-center justify-between">
                  <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${
                    theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>Active</span>
                  <button className={`text-[9px] font-black uppercase tracking-widest transition-colors ${theme === 'white' ? 'text-[#76c9be] hover:text-[#082a36]' : 'text-blue-400 hover:text-blue-300'}`}>Mod Spec</button>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
