import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle, RefreshCw, Unlink, Globe, Lock, AlertCircle, ExternalLink, Palette, Monitor, Zap, BrainCircuit, FileSpreadsheet } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';

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

  const [savingKeyId, setSavingKeyId] = useState<string | null>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiKey2, setGeminiKey2] = useState('');
  const [geminiKey3, setGeminiKey3] = useState('');
  const [geminiKey4, setGeminiKey4] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [gptKey, setGptKey] = useState('');
  const [ahrefsKey, setAhrefsKey] = useState('');
  const [googleSheetId, setGoogleSheetId] = useState('');

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/admin/keys');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}: ${res.statusText}`);
      }
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        throw new Error('Invalid JSON response from server');
      }
      if (data.keys) {
        const gemini = data.keys.find((k: any) => k.id === 'gemini');
        const gemini2 = data.keys.find((k: any) => k.id === 'gemini_2');
        const gemini3 = data.keys.find((k: any) => k.id === 'gemini_3');
        const gemini4 = data.keys.find((k: any) => k.id === 'gemini_4');
        const claude = data.keys.find((k: any) => k.id === 'claude');
        const gpt = data.keys.find((k: any) => k.id === 'gpt');
        const ahrefs = data.keys.find((k: any) => k.id === 'ahrefs');
        const sheet = data.keys.find((k: any) => k.id === 'google_sheet_id');
        
        if (gemini) setGeminiKey(gemini.key_value);
        if (gemini2) setGeminiKey2(gemini2.key_value);
        if (gemini3) setGeminiKey3(gemini3.key_value);
        if (gemini4) setGeminiKey4(gemini4.key_value);
        if (claude) setClaudeKey(claude.key_value);
        if (gpt) setGptKey(gpt.key_value);
        if (ahrefs) setAhrefsKey(ahrefs.key_value);
        if (sheet) setGoogleSheetId(sheet.key_value);
      }
    } catch (e) {
      console.error('Error fetching API keys:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchKeys();
  }, []);

  const handleSaveKey = async (id: string, value: string) => {
    setSavingKeyId(id);
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, key_value: value })
      });
      if (res.ok) {
        alert(`${id.toUpperCase()} Integration Key saved successfully!`);
        fetchKeys();
      } else {
        const text = await res.text();
        let errorMessage = 'Failed to save key';
        try {
          const data = JSON.parse(text);
          errorMessage = data.error || errorMessage;
        } catch (parseError) {
          errorMessage = `Server returned status ${res.status}: ${res.statusText || 'Unknown Error'}`;
        }
        throw new Error(errorMessage);
      }
    } catch (e: any) {
      alert('Save failed: ' + e.message);
    } finally {
      setSavingKeyId(null);
    }
  };

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
          <h2 className={`text-3xl font-medium font-heading  tracking-tighter italic ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Command Center</h2>
          <p className={`text-sm font-medium   mt-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Operational configuration and satellite links</p>
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
                  <h3 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Visual Protocol</h3>
                  <p className={`text-sm   font-medium ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Select operational aesthetic</p>
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
                  <h4 className={`text-sm font-medium   ${theme === 'midnight' ? 'text-white' : theme === 'white' ? 'text-zinc-900' : 'text-zinc-400'}`}>Midnight Boutique</h4>
                  <p className={`text-sm font-medium   mt-1 ${theme === 'midnight' ? 'text-blue-100' : theme === 'white' ? 'text-zinc-500' : 'text-zinc-600'}`}>Dark & Premium</p>
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
                  <h4 className={`text-sm font-medium   ${theme === 'mission' ? 'text-white' : theme === 'white' ? 'text-zinc-900' : 'text-zinc-400'}`}>Mission Control</h4>
                  <p className={`text-sm font-medium   mt-1 ${theme === 'mission' ? 'text-emerald-100' : theme === 'white' ? 'text-zinc-500' : 'text-zinc-600'}`}>Technical & Precise</p>
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
                  <h4 className={`text-sm font-medium font-heading   ${theme === 'white' ? 'text-white' : 'text-zinc-900'}`}>White Boutique</h4>
                  <p className={`text-sm font-medium   mt-1 ${theme === 'white' ? 'text-[#76c9be]' : 'text-zinc-500'}`}>High Contrast Light</p>
                </button>
              </div>
            </div>
          </section>

          {/* AI INTEGRATION KEYS */}
          <section className={`rounded-[40px] border shadow-2xl p-10 backdrop-blur-xl relative overflow-hidden group transition-all duration-300 ${
            theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <BrainCircuit size={120} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-3 rounded-2xl border ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                  <BrainCircuit size={24} />
                </div>
                <div>
                  <h3 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>AI Synthesis Credentials</h3>
                  <p className={`text-sm   font-medium ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Manage LLM audit integrations</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Gemini Key */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Google Gemini API Key</label>
                  <Tooltip content="Secure key for Google Gemini 1.5 Pro integrations executing keyword intelligence analytics" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={geminiKey ? '••••••••••••••••••••' : 'Add Gemini API Key...'}
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('gemini', geminiKey)}
                        disabled={savingKeyId === 'gemini'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'gemini' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* Gemini Key 2 (Failover) */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Google Gemini API Key 2 (Failover)</label>
                  <Tooltip content="Secondary failover key for Google Gemini 1.5 Pro to bypass free tier rate limits, ensuring continuous SEO optimisation" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={geminiKey2 ? '••••••••••••••••••••' : 'Add Gemini API Key 2 (Failover)...'}
                        value={geminiKey2}
                        onChange={(e) => setGeminiKey2(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('gemini_2', geminiKey2)}
                        disabled={savingKeyId === 'gemini_2'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'gemini_2' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* Gemini Key 3 (Failover) */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Google Gemini API Key 3 (Failover)</label>
                  <Tooltip content="Tertiary failover key for Google Gemini 1.5 Pro to bypass free tier rate limits, ensuring continuous SEO optimisation" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={geminiKey3 ? '••••••••••••••••••••' : 'Add Gemini API Key 3 (Failover)...'}
                        value={geminiKey3}
                        onChange={(e) => setGeminiKey3(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('gemini_3', geminiKey3)}
                        disabled={savingKeyId === 'gemini_3'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'gemini_3' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* Gemini Key 4 (Failover) */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Google Gemini API Key 4 (Failover)</label>
                  <Tooltip content="Quaternary failover key for Google Gemini 1.5 Pro to bypass free tier rate limits, ensuring continuous SEO optimisation" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={geminiKey4 ? '••••••••••••••••••••' : 'Add Gemini API Key 4 (Failover)...'}
                        value={geminiKey4}
                        onChange={(e) => setGeminiKey4(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('gemini_4', geminiKey4)}
                        disabled={savingKeyId === 'gemini_4'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'gemini_4' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* Claude Key */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Anthropic Claude API Key</label>
                  <Tooltip content="Secure key for Anthropic Claude 3.5 Sonnet synthesising premium content audits" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={claudeKey ? '••••••••••••••••••••' : 'Add Claude API Key...'}
                        value={claudeKey}
                        onChange={(e) => setClaudeKey(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('claude', claudeKey)}
                        disabled={savingKeyId === 'claude'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'claude' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* OpenAI Key */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">OpenAI GPT API Key</label>
                  <Tooltip content="Secure key for OpenAI GPT-4o compiling deep technical site audits and code plans" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={gptKey ? '••••••••••••••••••••' : 'Add GPT API Key...'}
                        value={gptKey}
                        onChange={(e) => setGptKey(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('gpt', gptKey)}
                        disabled={savingKeyId === 'gpt'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'gpt' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>

                {/* Ahrefs Key */}
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Ahrefs API Key</label>
                  <Tooltip content="Secure API key for Ahrefs integrations executing site authority metrics queries" className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder={ahrefsKey ? '••••••••••••••••••••' : 'Add Ahrefs API Key...'}
                        value={ahrefsKey}
                        onChange={(e) => setAhrefsKey(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('ahrefs', ahrefsKey)}
                        disabled={savingKeyId === 'ahrefs'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'ahrefs' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>
          </section>

          {/* GOOGLE SHEETS INTEGRATION */}
          <section className={`rounded-[40px] border shadow-2xl p-10 backdrop-blur-xl relative overflow-hidden group transition-all duration-300 ${
            theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
              <FileSpreadsheet size={120} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <div className={`p-3 rounded-2xl border ${theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-blue-600/10 text-blue-500 border-blue-500/20'}`}>
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <h3 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Google Sheets Sync Protocol</h3>
                  <p className={`text-sm   font-medium ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Set global target Google Sheet URL or ID</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className={`p-5 rounded-2xl border ${theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5'}`}>
                  <label className="text-sm font-medium   text-zinc-500">Target Google Sheet ID / URL</label>
                  <Tooltip content="Paste the complete URL of your Google Sheet or its ID. Weekly data will be synced directly to this document." className="w-full mt-2">
                    <div className="flex gap-3 w-full">
                      <input 
                        type="text" 
                        placeholder="e.g. https://docs.google.com/spreadsheets/d/1A2B3C... or Sheet ID"
                        value={googleSheetId}
                        onChange={(e) => setGoogleSheetId(e.target.value)}
                        className={`flex-1 border rounded-2xl px-4 py-2.5 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600 focus:border-[#76c9be]' : 'bg-zinc-900 border-white/5 text-zinc-400 focus:border-blue-500'
                        }`}
                      />
                      <button 
                        onClick={() => handleSaveKey('google_sheet_id', googleSheetId)}
                        disabled={savingKeyId === 'google_sheet_id'}
                        className={`px-5 rounded-2xl text-sm font-medium transition-all border   active:scale-95 flex items-center justify-center gap-1 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                        }`}
                      >
                        {savingKeyId === 'google_sheet_id' ? <RefreshCw size={10} className="animate-spin" /> : 'Save'}
                      </button>
                    </div>
                  </Tooltip>
                </div>
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
                  <h3 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Satellite Uplink</h3>
                  <p className={`text-sm font-medium   ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>Central Google OAuth Protocol</p>
                </div>
              </div>
              {!status?.is_initialized && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 text-rose-500 text-sm font-medium rounded-full border border-rose-500/20  ">
                  <AlertCircle size={12} />
                  Engine Offline
                </div>
              )}
              {status?.connected && status?.is_initialized && (
                <div className={`flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full border   ${
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
                  <h4 className="text-sm font-medium text-rose-500 flex items-center gap-2  ">
                    <AlertCircle size={16} />
                    OAuth Authentication Failure
                  </h4>
                  <p className="text-sm text-zinc-500 font-medium  tracking-loose leading-relaxed">
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
                    <label className={`text-sm font-medium   ml-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-600'}`}>Callback Terminal (Redirect URI)</label>
                    <div className="flex gap-3">
                      <input 
                        readOnly 
                        value={status.redirect_uri}
                        className={`flex-1 border rounded-2xl px-5 py-3 text-sm font-mono focus:outline-none transition-colors ${
                          theme === 'white' ? 'bg-white border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-white/5 text-zinc-400'
                        }`}
                      />
                      <button 
                        onClick={() => copyToClipboard(status.redirect_uri!)}
                        className={`px-6 border rounded-2xl text-sm font-medium transition-all   active:scale-95 ${
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
                      <p className={`text-sm font-medium   leading-relaxed italic ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-500'}`}>
                        Protocol: You must copy the exact terminal path above into your G-Console credentials. Subdomain-only links will trigger a 
                        <span className={theme === 'white' ? 'text-[#082a36]' : 'text-white'}> Security Exception (403)</span>.
                      </p>
                    </div>
                  </div>

                  {!status?.connected && (
                    <div className={`p-8 rounded-[32px] border space-y-4 transition-colors ${
                      theme === 'white' ? 'bg-[#f47b20]/5 border-[#f47b20]/20' : 'bg-amber-500/5 border-amber-500/20'
                    }`}>
                      <h4 className={`text-sm font-medium flex items-center gap-2  italic tracking-tighter ${theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}`}>
                        <Zap size={18} />
                        Resolution Protocols for Access Block
                      </h4>
                      <ul className={`text-sm space-y-3   font-medium leading-relaxed ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-400'}`}>
                        <li className="flex gap-3"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Set state to <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>"Production"</span> in OAuth Consent Screen (Fixes 403).</span></li>
                        <li className="flex gap-3 items-start"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Add your email to <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>"Authorised Test Users"</span>.</span></li>
                        <li className="flex gap-3 items-start"><span className={theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500'}>→</span> <span>Whitelist <span className={theme === 'white' ? 'text-[#082a36] italic' : 'text-white italic'}>run.app</span> as an Authorised Domain.</span></li>
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
                      <label className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Identified Link</label>
                      <p className={`text-sm font-medium font-heading italic truncate ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>{status.email}</p>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Last Pulse Detected</label>
                      <p className={`text-sm font-medium font-mono ${theme === 'white' ? 'text-[#082a36]' : 'text-zinc-400'}`}>
                        {status.last_connected ? new Date(status.last_connected).toLocaleString() : 'PENDING'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Encryption Integrity</label>
                      <p className={`text-sm font-medium   ${status.token_status?.includes('Valid') ? (theme === 'white' ? 'text-[#76c9be]' : 'text-emerald-500') : (theme === 'white' ? 'text-[#f47b20]' : 'text-amber-500')}`}>
                        {status.token_status || 'UNKNOWN'}
                      </p>
                    </div>
                  </div>
                  <div className={`p-8 rounded-[32px] border space-y-6 relative group/card transition-colors ${
                    theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/10' : 'bg-zinc-950 border-white/5'
                  }`}>
                    <div className="flex items-center gap-3">
                      <Shield size={18} className={theme === 'white' ? 'text-[#76c9be]' : 'text-blue-500'} />
                      <h4 className={`text-sm font-medium font-heading   ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Security Clearance</h4>
                    </div>
                    <p className={`text-sm font-medium   leading-relaxed italic ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>
                      Automated reporting nodes use vault-encrypted keys. Access level is strictly set to read-only surveillance.
                    </p>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={handleConnect}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-3 border rounded-2xl text-sm font-medium   transition-all active:scale-95 ${
                          theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-zinc-800 border-white/5 text-white'
                        } hover:brightness-110`}
                      >
                        <RefreshCw size={14} />
                        Cycle Satellite Link
                      </button>
                      <button 
                        onClick={fetchSites}
                        disabled={loadingSites}
                        className={`w-full flex items-center justify-center gap-3 px-6 py-3 rounded-2xl text-sm font-medium   transition-all active:scale-95 disabled:opacity-50 ${
                          theme === 'white' ? 'bg-[#76c9be] text-white hover:bg-[#76c9be]/90' : 'bg-blue-600 text-white hover:brightness-110'
                        }`}
                      >
                        {loadingSites ? <RefreshCw size={14} className="animate-spin" /> : <Monitor size={14} />}
                        Scan Authorised Sites
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
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-rose-500 text-white rounded-2xl text-sm font-medium   hover:brightness-110 transition-all"
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
                    <h4 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Link Required</h4>
                    <p className={`text-sm font-medium   leading-relaxed px-10 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
                      Automated surveillance nodes require a high-clearance Google account for global data collection.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                    <button 
                      onClick={handleConnect}
                      className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-medium text-sm   transition-all shadow-xl active:scale-95 ${
                        theme === 'white' ? 'bg-[#f47b20] text-white shadow-[#f47b20]/20 hover:bg-[#f47b20]/90' : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500'
                      }`}
                    >
                      Establish Link
                    </button>
                    <button 
                      onClick={() => window.open(window.location.href, '_blank')}
                      className={`flex-1 flex items-center justify-center gap-3 px-8 py-4 border rounded-2xl font-medium text-sm   transition-all active:scale-95 ${
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
                    <h3 className={`text-xl font-medium font-heading  italic tracking-tighter ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Asset Synchronisation</h3>
                    <p className={`text-sm font-medium   ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>Authorised GSC Properties Detected</p>
                  </div>
                </div>
                <div className="text-sm font-medium text-zinc-500  ">
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
                        <span className={`text-sm font-medium transition-colors truncate  tracking-tighter ${
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
                  <p className={`text-sm font-medium   leading-relaxed ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
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
            <h3 className={`text-lg font-medium font-heading  italic tracking-tighter mb-6 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Database Ops</h3>
            <div className="space-y-4">
              <p className={`text-sm font-medium   leading-relaxed mb-6 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-500'}`}>
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
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 border rounded-2xl text-sm font-medium   transition-all active:scale-95 ${
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
            <h3 className={`text-lg font-medium font-heading  italic tracking-tighter mb-8 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Pulse Scheduler</h3>
            <div className="space-y-6">
              <div className={`p-6 rounded-[32px] border transition-colors ${
                theme === 'white' ? 'bg-[#76c9be]/5 border-[#163f4d]/5' : 'bg-zinc-950 border-white/5'
              }`}>
                <p className={`text-sm font-medium   mb-1 ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>Weekly Cycle</p>
                <p className={`text-sm font-medium   mb-4 ${theme === 'white' ? 'text-[#607a80]' : 'text-zinc-600'}`}>Monday 0400 Local Time</p>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium px-2.5 py-1 rounded-full border   ${
                    theme === 'white' ? 'bg-[#76c9be]/10 text-[#76c9be] border-[#76c9be]/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}>Active</span>
                  <button className={`text-sm font-medium   transition-colors ${theme === 'white' ? 'text-[#76c9be] hover:text-[#082a36]' : 'text-blue-400 hover:text-blue-300'}`}>Mod Spec</button>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
