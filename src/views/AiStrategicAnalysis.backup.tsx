import { useState, useEffect } from 'react';
import React from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  Sliders, 
  Play, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  TrendingUp, 
  ArrowRight, 
  CornerDownRight,
  Database,
  ExternalLink,
  Code,
  FileText,
  Link,
  ShieldAlert,
  Zap,
  Globe
} from 'lucide-react';
import { getClients, runAiAnalysis, updateClient, Client } from '../services/dataService';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';

interface ActionableDirective {
  title: string;
  category: 'Technical' | 'Content' | 'Backlinks';
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  expectedImpact: string;
}

interface AnalysisResult {
  trafficGapAnalysis: string;
  expectedImpact: string;
  actionableDirectives: ActionableDirective[];
  implementationGuide: string;
}

export default function AiStrategicAnalysis() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude' | 'gpt'>('gemini');
  const [analysisType, setAnalysisType] = useState<'light' | 'deep'>('light');
  const [simulate, setSimulate] = useState(true); // Default to simulation mode to prevent initial API cost blockers

  // Default dates: GSC has a ~3 day data-lag. Set end date to 3 days ago, start date to 10 days ago.
  const today = new Date();
  const past3Days = new Date(today);
  past3Days.setDate(today.getDate() - 3);
  const past10Days = new Date(today);
  past10Days.setDate(today.getDate() - 10);

  const [startDate, setStartDate] = useState(past10Days.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(past3Days.toISOString().split('T')[0]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadingPhrases = [
    'Verifying API integration keys...',
    'Fetching Google Search Console metrics (Clicks, Impressions, CTR)...',
    'Extracting organic traffic segments from Google Analytics 4...',
    'Evaluating core web vitals and layout shift metrics...',
    'Performing semantic keyword density and priority scans...',
    'Mapping search intent queries and competitor gaps...',
    'Consulting neural strategic blueprints...',
    'Formatting marketer-ready implementation directives...'
  ];

  useEffect(() => {
    getClients().then(data => {
      setClients(data);
      if (data.length > 0) {
        setSelectedClientId(data[0].id);
      }
    });
  }, []);

  // Loading text cycler
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex(prev => (prev + 1) % loadingPhrases.length);
      }, 3500);
    } else {
      setLoadingPhraseIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleRunAudit = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSuccessMsg(null);

    try {
      const response = await runAiAnalysis({
        clientId: selectedClientId,
        model: selectedModel,
        analysisType,
        startDate,
        endDate,
        simulate
      });

      setResult(response);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'The LLM failed to return valid JSON. Please check API integration credentials in Settings or toggle simulation mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitToLog = async () => {
    if (!result || !selectedClientId) return;
    try {
      const client = clients.find(c => c.id === selectedClientId);
      if (!client) return;

      // Format log summary
      const dateStr = new Date().toLocaleDateString();
      const directiveSummaries = result.actionableDirectives
        .map((d, i) => `${i + 1}. [${d.priority} Priority] ${d.title} (${d.category})`)
        .join('\n');

      const updatedNotes = `=== AI AUDIT LOG (${dateStr} | ${selectedModel.toUpperCase()} | ${analysisType.toUpperCase()}) ===\n${result.expectedImpact}\n\nDIRECTIVES:\n${directiveSummaries}\n\n${client.notes || ''}`;

      await updateClient(selectedClientId, { notes: updatedNotes });
      setSuccessMsg(`Audited directives successfully saved to ${client.name}'s active records!`);
      // Update local state list
      setClients(prev => prev.map(c => c.id === selectedClientId ? { ...c, notes: updatedNotes } : c));
    } catch (e: any) {
      setError('Commit failed: ' + e.message);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className="space-y-8 pb-16">
      <style>{`
        @media print {
          /* Hide sidebar, control console, notifications, buttons, and general UI noise */
          aside,
          nav,
          button,
          .no-print,
          .tooltip-container,
          select,
          input,
          .control-console,
          header,
          .top-header,
          .success-notification,
          .error-notification {
            display: none !important;
          }
          
          /* Full page layout reset */
          body,
          main,
          #root,
          .layout-container {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          
          /* Hide parent layout main wrapper paddings and border elements */
          main {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          
          /* Make container print-friendly */
          .printable-report {
            display: block !important;
            background: white !important;
            color: black !important;
            padding: 20px !important;
            width: 100% !important;
          }
          
          /* Cards printing adjustments */
          .printable-card {
            background: white !important;
            border: 1px solid #cbd5e1 !important;
            color: black !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            margin-bottom: 24px !important;
            padding: 24px !important;
            border-radius: 12px !important;
          }
          
          /* High contrast colors for print text */
          .printable-text-primary {
            color: #0f172a !important;
          }
          .printable-text-secondary {
            color: #475569 !important;
          }
          
          /* Force page break before directives list if it overflows */
          .directives-registry {
            page-break-before: auto !important;
          }
          
          /* Implementation playbook styling */
          .playbook-container {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
            padding: 16px !important;
            font-family: monospace !important;
          }
        }
      `}</style>

      {/* Top Header */}
      <div className="print:hidden">
        <div className="flex items-center gap-2">
          <BrainCircuit size={28} className={isWhite ? 'text-[#082a36]' : 'text-blue-400'} />
          <h2 className={`text-2xl font-black font-heading uppercase tracking-tighter italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
            AI Strategic Audit Suite
          </h2>
        </div>
        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 italic ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
          Automated multi-LLM directives • Gemini • Claude • GPT
        </p>
      </div>

      {/* Control Console */}
      <div className={`print:hidden p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl ${
        isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/40 border-white/5'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Column 1: Client & Niche */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Target Client Property</label>
            <Tooltip content="Select which client site property to run this SEO strategic analysis for" className="w-full">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-xl text-xs font-black focus:outline-none transition-all uppercase tracking-wider ${
                  isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-950 border-white/5 text-white focus:border-blue-500'
                }`}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.short_code})</option>
                ))}
              </select>
            </Tooltip>
            {selectedClient && (
              <p className="text-[9px] text-zinc-500 font-medium italic">
                Active Timezone: {selectedClient.timezone} • Owner: {selectedClient.project_owner_code || 'MW'}
              </p>
            )}
          </div>

          {/* Column 2: LLM Engine & Toggles */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">LLM Synthesis Engine</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gemini', label: 'Gemini', tooltip: 'Use Google Gemini 1.5 Pro to conduct advanced analytics on Search Console patterns and keyword metrics' },
                { id: 'claude', label: 'Claude', tooltip: 'Use Anthropic Claude 3.5 Sonnet for premium deep content synthesis and copy directives' },
                { id: 'gpt', label: 'GPT-4o', tooltip: 'Use OpenAI GPT-4o for precise code audits, site layout shifts, and structured tech tasks' }
              ].map(m => (
                <Tooltip key={m.id} content={m.tooltip} className="w-full">
                  <button
                    onClick={() => setSelectedModel(m.id as any)}
                    className={`w-full py-2 px-3 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      selectedModel === m.id
                        ? (isWhite ? 'bg-[#082a36] text-white border-[#082a36]' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20')
                        : (isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100' : 'bg-zinc-950 border-white/5 text-zinc-400 hover:bg-zinc-900')
                    }`}
                  >
                    {m.label}
                  </button>
                </Tooltip>
              ))}
            </div>
            
            <div className="flex items-center justify-between gap-4 pt-2">
              {/* Simulation Mode Toggle */}
              <Tooltip content="Runs the complete SEO audit inside a zero-cost local sandbox using simulated high-fidelity LLM response schemas" position="top">
                <div className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    id="simulateToggle"
                    checked={simulate}
                    onChange={(e) => setSimulate(e.target.checked)}
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-zinc-950 cursor-pointer"
                  />
                  <label htmlFor="simulateToggle" className="text-[9px] font-black uppercase tracking-widest text-zinc-400 cursor-pointer">
                    Simulation (No Cost)
                  </label>
                </div>
              </Tooltip>

              {/* Light vs Deep */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/40 border border-white/5">
                {(['light', 'deep'] as const).map(d => {
                  const tooltipContent = d === 'light'
                    ? "Light Analysis: Audits quick GSC clicks/CTR trends, primary GA4 sessions, basic meta title/description checks, and produces immediate tactical actions"
                    : "Deep Analysis: Full semantic keyword intelligence, query intent density audits, core web vitals speed gap scans, backlink profile analysis, and developer step-by-step code playbooks";
                  return (
                    <Tooltip key={d} content={tooltipContent} position="top">
                      <button
                        onClick={() => setAnalysisType(d)}
                        className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${
                          analysisType === d
                            ? (isWhite ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200' : 'bg-zinc-800 text-white border border-white/5')
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {d}
                      </button>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Column 3: Custom Date Range */}
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Audit Time period</label>
            <Tooltip content="Choose the time window of weekly performance data to compare against the prior identical interval" className="w-full">
              <div className="grid grid-cols-2 gap-2 w-full">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                    isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-950 border-white/5 text-white'
                  }`}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-xs font-mono font-bold focus:outline-none ${
                    isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-950 border-white/5 text-white'
                  }`}
                />
              </div>
            </Tooltip>
            <p className="text-[8px] text-zinc-600 uppercase tracking-widest font-black leading-tight">
              * Accounts for 3-day Google data sync latency
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-zinc-500" />
            <p className={`text-[10px] uppercase font-black tracking-widest ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
              GSC Site URL: <span className="font-mono text-zinc-400">{selectedClient?.gsc_site_url || 'Unconfigured'}</span>
            </p>
          </div>
          <Tooltip content="Synthesize comprehensive metrics via neural audit, comparing traffic profiles and generating prioritised tasks">
            <button
              onClick={handleRunAudit}
              disabled={loading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl disabled:opacity-50 ${
                isWhite 
                  ? 'bg-[#f47b20] text-white hover:bg-[#f47b20]/90 shadow-[#f47b20]/20' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:brightness-110 shadow-blue-500/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Synthesizing Audit...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Compile Strategic Directives
                </>
              )}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Cybernetic Loading Panel */}
      {loading && (
        <div className={`print:hidden p-10 rounded-[24px] border text-center space-y-6 shadow-2xl backdrop-blur-xl animate-pulse ${
          isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-950 border-white/5'
        }`}>
          <BrainCircuit size={48} className="mx-auto text-blue-500 animate-spin" />
          <div className="space-y-2">
            <h4 className={`text-base font-black uppercase tracking-tight italic ${isWhite ? 'text-zinc-900' : 'text-white'}`}>
              AI AUDIT PREPARATION SYSTEM
            </h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black max-w-md mx-auto leading-relaxed">
              Synthesizing historical search console clusters and organic conversion sessions.
            </p>
          </div>
          <div className={`inline-block py-2 px-4 rounded-xl border font-mono text-[9px] font-bold tracking-widest ${
            isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-white/5 text-blue-400'
          }`}>
            CURRENT TASK: {loadingPhrases[loadingPhraseIndex]}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className={`print:hidden p-4 rounded-2xl border flex items-start gap-3 shadow-lg ${
          isWhite ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          <AlertCircle className="shrink-0 mt-0.5" size={16} />
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest">Audit Engine Interruption</h5>
            <p className="text-[10px] font-bold uppercase tracking-wide mt-1 leading-normal">{error}</p>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className={`print:hidden p-4 rounded-2xl border flex items-start gap-3 shadow-lg ${
          isWhite ? 'bg-emerald-50 border-[#76c9be]/20 text-[#082a36]' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <CheckCircle2 className="shrink-0 mt-0.5" size={16} />
          <div>
            <h5 className="text-[10px] font-black uppercase tracking-widest">Audit Logs Integrated</h5>
            <p className="text-[10px] font-bold uppercase tracking-wide mt-1 leading-normal">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Audit Output Results Dashboard */}
      {result && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* Print-Only Professional Letterhead */}
          <div className="hidden print:block mb-8 pb-6 border-b-2 border-slate-900">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 italic">SEO STRATEGIC AUDIT REPORT</h1>
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">OPERATIONAL INTELLIGENCE PLATFORM</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-slate-950 uppercase">{selectedClient?.name || 'Client Audit'}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">
                  Period: {startDate} to {endDate}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100">
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Synthesis Engine</span>
                <span className="text-[10px] font-bold text-slate-800 uppercase">{selectedModel} LLM</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Analysis Level</span>
                <span className="text-[10px] font-bold text-slate-800 uppercase">{analysisType} Audit</span>
              </div>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Generated Date</span>
                <span className="text-[10px] font-bold text-slate-800 uppercase">{new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Row 1: Traffic Gap Analysis Summary & Impact */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gap Analysis */}
            <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl lg:col-span-2 backdrop-blur-xl ${
              isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <div className="flex items-center gap-2 mb-4">
                <Globe size={16} className="text-blue-400" />
                <h4 className={`text-xs font-black uppercase tracking-widest ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                  Performance Gap Audit
                </h4>
              </div>
              <p className={`text-xs font-bold leading-relaxed tracking-wider ${
                isWhite ? 'text-zinc-600' : 'text-zinc-300'
              }`}>
                {result.trafficGapAnalysis}
              </p>
            </div>

            {/* Expected Impact Summary */}
            <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl flex flex-col justify-between ${
              isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <h4 className={`text-xs font-black uppercase tracking-widest ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                    Projected SEO Yield
                  </h4>
                </div>
                <p className={`text-xs font-bold leading-relaxed tracking-wider ${
                  isWhite ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  {result.expectedImpact}
                </p>
              </div>

              {/* Log actions & Export PDF */}
              <div className="print:hidden pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row gap-3">
                <Tooltip content="Record these AI recommendations permanently to the active log history of the client node" className="w-full">
                  <button
                    onClick={handleCommitToLog}
                    className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg border ${
                      isWhite 
                        ? 'bg-[#082a36] text-white border-[#082a36]' 
                        : 'bg-zinc-800 text-white border-white/5 hover:bg-zinc-700 shadow-zinc-900/50'
                    }`}
                  >
                    Push to Client Log
                  </button>
                </Tooltip>
                <Tooltip content="Print or download this Strategic Analysis Report as a beautifully styled PDF" className="w-full">
                  <button
                    onClick={() => window.print()}
                    className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-lg border flex items-center justify-center gap-1.5 ${
                      isWhite 
                        ? 'bg-[#f47b20] text-white border-[#f47b20] hover:bg-[#f47b20]/90 shadow-[#f47b20]/20' 
                        : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-blue-500/20'
                    }`}
                  >
                    <FileText size={12} />
                    Export PDF Report
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Row 2: Actionable Directives */}
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider mb-4 ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
              Strategic Directives Registry
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {result.actionableDirectives.map((directive, idx) => {
                let catColor = '';
                let catIcon = FileText;
                
                if (directive.category === 'Technical') {
                  catColor = 'text-blue-400 border-blue-400/20 bg-blue-500/5';
                  catIcon = Code;
                } else if (directive.category === 'Backlinks') {
                  catColor = 'text-purple-400 border-purple-400/20 bg-purple-500/5';
                  catIcon = Link;
                } else {
                  catColor = 'text-amber-400 border-amber-400/20 bg-amber-500/5';
                  catIcon = FileText;
                }

                let prioColor = '';
                if (directive.priority === 'High') prioColor = isWhite ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-red-500/10 text-red-400 border-red-500/20';
                else if (directive.priority === 'Medium') prioColor = isWhite ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
                else prioColor = isWhite ? 'bg-zinc-100 text-zinc-600 border-zinc-200' : 'bg-zinc-800 text-zinc-400 border-white/5';

                return (
                  <div
                    key={idx}
                    className={`printable-card p-6 rounded-[24px] border shadow-2xl flex flex-col justify-between backdrop-blur-xl ${
                      isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
                    }`}
                  >
                    <div className="space-y-4">
                      {/* Priority and category */}
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase tracking-widest ${prioColor}`}>
                          {directive.priority} priority
                        </span>
                        
                        <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest ${catColor}`}>
                          {React.createElement(catIcon, { size: 10 })}
                          {directive.category}
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className={`text-xs font-black tracking-tight leading-relaxed italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                        {directive.title}
                      </h4>

                      {/* Description */}
                      <p className={`text-[10px] font-bold tracking-wide leading-relaxed ${isWhite ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {directive.description}
                      </p>
                    </div>

                    {/* Yield impact */}
                    <div className={`mt-6 p-4 rounded-xl border text-[9px] font-black tracking-widest leading-normal print:bg-slate-50 print:border-slate-200 print:text-slate-700 ${
                      isWhite ? 'bg-[#76c9be]/5 border-[#163f4d]/5 text-[#607a80]' : 'bg-zinc-950/40 border-white/5 text-zinc-500'
                    }`}>
                      <span className="text-zinc-400 mr-1 italic">Projected Yield:</span>
                      {directive.expectedImpact}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Row 3: Developer Implementation Guide */}
          <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl ${
            isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={16} className="text-blue-400" />
              <h4 className={`text-xs font-black uppercase tracking-widest ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                Tactical Implementation playbook
              </h4>
            </div>

            <div className={`playbook-container p-6 rounded-2xl font-mono text-[10px] border shadow-inner leading-relaxed whitespace-pre-line ${
              isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-950 border-white/5 text-zinc-400'
            }`}>
              {result.implementationGuide}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
