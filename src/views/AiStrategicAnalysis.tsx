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
  Globe,
  ChevronDown,
  ChevronUp,
  Trash2
} from 'lucide-react';
import { getClients, runAiAnalysis, updateClient, Client } from '../services/dataService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';

interface ActionableDirective {
  title: string;
  category: 'Technical' | 'Content' | 'Backlinks';
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  expectedImpact: string;
}

interface ExecutiveSummary {
  goodThings: string[];
  thingsToImprove: string[];
  actionsToDo: string[];
  expectedResults: string[];
}

interface AnalysisResult {
  trafficGapAnalysis: string;
  expectedImpact: string;
  actionableDirectives: ActionableDirective[];
  implementationGuide: string;
  executiveSummary?: ExecutiveSummary;
  currentMetrics?: any;
  previousMetrics?: any;
  crawlDiagnostics?: any;
}

const playSuccessChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // Tone 1: High crisp bell
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15); // Slide up
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Tone 2: Warm supporting tone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, now + 0.08); // A4
    osc2.frequency.exponentialRampToValueAtTime(660, now + 0.25);
    gain2.gain.setValueAtTime(0.08, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.6);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.8);
  } catch (e) {
    console.warn("Audio context not allowed or supported yet:", e);
  }
};

const renderClickableDescription = (text: string) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s,)'"]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-blue-500 hover:text-blue-400 font-medium hover:underline transition-all break-all border-b border-blue-500/20 hover:border-blue-400 mr-1"
        >
          {part.replace(/https?:\/\/(?:www\.)?/, '')}
          <ExternalLink size={10} className="shrink-0" />
        </a>
      );
    }
    return part;
  });
};

const highlightKeyTerms = (text: string) => {
  if (!text) return '';
  // Match percentages, dates, brackets with ranges, formatted numbers, or single/double quotes
  const regex = /(\d+(?:\.\d+)?%|\d{4}-\d{2}-\d{2}\s+to\s+\d{4}-\d{2}-\d{2}|\(from\s+\d+(?:,\d+)?\s+to\s+\d+(?:,\d+)?\)|\'[^\']+\'|\"[^\"]+\"|\b\d{1,3}(?:,\d{3})+\b|\b\d{2,}\b)/g;
  
  const parts = text.split(regex);
  if (parts.length === 1) return text;
  
  return parts.map((part, index) => {
    if (part.match(regex)) {
      return (
        <span key={index} className="font-medium text-slate-950 dark:text-white bg-blue-500/10 dark:bg-blue-400/10 px-1 py-0.5 rounded mx-0.5 inline">
          {part}
        </span>
      );
    }
    return part;
  });
};

const handleCopyToClipboard = (text: string, label: string, setSuccessMsg: (msg: string | null) => void) => {
  navigator.clipboard.writeText(text);
  setSuccessMsg(`Copied ${label} to clipboard!`);
  setTimeout(() => setSuccessMsg(null), 3000);
};

export default function AiStrategicAnalysis() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude' | 'gpt'>('gemini');
  const [analysisType, setAnalysisType] = useState<'light' | 'deep'>('light');
  const [simulate, setSimulate] = useState(true); // Default to simulation mode to prevent initial API cost blockers
  const [runTechnicalCrawl, setRunTechnicalCrawl] = useState(false);
  const [showCrawlDetails, setShowCrawlDetails] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [generateAiFixes, setGenerateAiFixes] = useState(false);
  const [pageOptimizations, setPageOptimizations] = useState<Record<string, { title: string; metaDescription: string; codePatch: string; loading?: boolean }>>({});
  const [activeDrawerTabs, setActiveDrawerTabs] = useState<Record<string, 'targets' | 'issues' | 'code'>>({});

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

  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchHistory = async (clientId: string) => {
    if (!clientId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('ai_audit_history')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setHistoryList(data);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      console.warn('ai_audit_history table might not exist yet:', err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

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

  useEffect(() => {
    if (selectedClientId) {
      fetchHistory(selectedClientId);
      setResult(null);
      setError(null);
      setSuccessMsg(null);
      setPageOptimizations({});
    }
  }, [selectedClientId]);

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
    setExpandedPages({});
    setPageOptimizations({});

    try {
      const response = await runAiAnalysis({
        clientId: selectedClientId,
        model: selectedModel,
        analysisType,
        startDate,
        endDate,
        simulate,
        runTechnicalCrawl,
        generateAiFixes
      });

      setResult(response);
      playSuccessChime();
      setSuccessMsg(`Strategic audit successfully synthesized and cached in history!`);
      
      try {
        await supabase
          .from('ai_audit_history')
          .insert([{
            client_id: selectedClientId,
            model: selectedModel,
            analysis_type: analysisType,
            start_date: startDate,
            end_date: endDate,
            result: response
          }]);
        fetchHistory(selectedClientId);
      } catch (saveErr) {
        console.warn('Could not save to history table:', saveErr);
      }
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

  const handleOptimisePage = async (pageUrl: string, pageTitle: string, issues: string[]) => {
    setPageOptimizations(prev => ({
      ...prev,
      [pageUrl]: {
        title: '',
        metaDescription: '',
        codePatch: '',
        loading: true
      }
    }));

    try {
      const response = await fetch('/api/ai/optimise-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          url: pageUrl,
          pageTitle,
          issues,
          model: selectedModel,
          simulate
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      setPageOptimizations(prev => ({
        ...prev,
        [pageUrl]: {
          title: data.title,
          metaDescription: data.metaDescription,
          codePatch: data.codePatch,
          loading: false
        }
      }));
      setSuccessMsg(`Optimised title, meta and HTML patch generated successfully for: ${pageUrl}`);
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate AI fix suggestions: ${err.message}`);
      setPageOptimizations(prev => {
        const copy = { ...prev };
        delete copy[pageUrl];
        return copy;
      });
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
          <h2 className={`text-2xl font-medium font-heading normal-case tracking-tighter italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
            AI Strategic Audit Suite
          </h2>
        </div>
        <p className={`text-sm font-medium normal-case tracking-normal mt-1 italic ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
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
            <label className="text-sm font-medium normal-case tracking-normal text-zinc-500">Target Client Property</label>
            <Tooltip content="Select which client site property to run this SEO strategic analysis for" className="w-full">
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all normal-case tracking-normal ${
                  isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36] focus:border-[#76c9be]' : 'bg-zinc-950 border-white/5 text-white focus:border-blue-500'
                }`}
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.short_code})</option>
                ))}
              </select>
            </Tooltip>
            {selectedClient && (
              <p className="text-sm text-zinc-500 font-medium italic">
                Active Timezone: {selectedClient.timezone} • Owner: {selectedClient.project_owner_code || 'MW'}
              </p>
            )}

            {historyList.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <label className="text-sm font-medium normal-case tracking-normal text-blue-400 flex items-center gap-1.5">
                  <Clock size={10} />
                  Restore Cached Audit ({historyList.length})
                </label>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {historyList.map(h => (
                    <div key={h.id} className={`flex items-center justify-between p-2.5 rounded-xl border text-sm font-medium normal-case tracking-normal ${
                      isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                    }`}>
                      <div className="truncate flex-1">
                        <span className="text-zinc-500 mr-1">{new Date(h.created_at).toLocaleDateString()}</span>
                        <span className={`${isWhite ? 'text-[#082a36]' : 'text-white'}`}>{h.analysis_type} ({h.model})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            setResult(h.result);
                            setStartDate(h.start_date.split('T')[0]);
                            setEndDate(h.end_date.split('T')[0]);
                            setSelectedModel(h.model);
                            setAnalysisType(h.analysis_type);
                            setPageOptimizations({});
                            setSuccessMsg(`Restored cached strategic audit from ${new Date(h.created_at).toLocaleDateString()} (${h.model.toUpperCase()})`);
                            setError(null);
                          }}
                          className={`px-2 py-1 rounded-lg hover:scale-105 active:scale-95 transition-all text-sm font-medium tracking-normal ${
                            isWhite ? 'bg-[#082a36]/5 text-[#082a36]' : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          Load
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to permanently delete the cached audit from ${new Date(h.created_at).toLocaleDateString()}?`)) {
                              try {
                                const { error } = await supabase
                                  .from('ai_audit_history')
                                  .delete()
                                  .eq('id', h.id);
                                if (!error) {
                                  setHistoryList(prev => prev.filter(item => item.id !== h.id));
                                  setSuccessMsg("Cached audit successfully deleted from database records!");
                                } else {
                                  setError("Could not delete from table: " + error.message);
                                }
                              } catch (err: any) {
                                setError("Delete failed: " + err.message);
                              }
                            }
                          }}
                          className="p-1 text-rose-400 hover:text-rose-500 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: LLM Engine & Toggles */}
          <div className="space-y-2">
            <label className="text-sm font-medium normal-case tracking-normal text-zinc-500">LLM Synthesis Engine</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gemini', label: 'Gemini', tooltip: 'Use Google Gemini 1.5 Pro to conduct advanced analytics on Search Console patterns and keyword metrics' },
                { id: 'claude', label: 'Claude', tooltip: 'Use Anthropic Claude 3.5 Sonnet for premium deep content synthesis and copy directives' },
                { id: 'gpt', label: 'GPT-4o', tooltip: 'Use OpenAI GPT-4o for precise code audits, site layout shifts, and structured tech tasks' }
              ].map(m => (
                <Tooltip key={m.id} content={m.tooltip} className="w-full">
                  <button
                    onClick={() => setSelectedModel(m.id as any)}
                    className={`w-full py-2 px-3 border rounded-xl text-sm font-medium normal-case tracking-normal transition-all ${
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
              <div className="flex flex-col gap-2">
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
                    <label htmlFor="simulateToggle" className="text-sm font-medium normal-case tracking-normal text-zinc-400 cursor-pointer">
                      Simulation (No Cost)
                    </label>
                  </div>
                </Tooltip>

                {/* Deep Technical Crawl Toggle */}
                <Tooltip content="Active technical HTML analysis scanning the sitemap and all published URLs page-by-page to detect Alt tags, heading issues, broken links and meta gaps" position="top">
                  <div className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="crawlToggle"
                      checked={runTechnicalCrawl}
                      onChange={(e) => setRunTechnicalCrawl(e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500 h-4 w-4 bg-zinc-950 cursor-pointer"
                    />
                    <label htmlFor="crawlToggle" className="text-sm font-medium normal-case tracking-normal text-zinc-400 cursor-pointer flex items-center gap-1">
                      Deep Technical Crawl
                    </label>
                  </div>
                </Tooltip>


              </div>

              {/* Light vs Deep */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/40 border border-white/5 self-end">
                {(['light', 'deep'] as const).map(d => {
                  const tooltipContent = d === 'light'
                    ? "Light Analysis: Audits quick GSC clicks/CTR trends, primary GA4 sessions, basic meta title/description checks, and produces immediate tactical actions"
                    : "Deep Analysis: Full semantic keyword intelligence, query intent density audits, core web vitals speed gap scans, backlink profile analysis, and developer step-by-step code playbooks";
                  return (
                    <Tooltip key={d} content={tooltipContent} position="top">
                      <button
                        onClick={() => setAnalysisType(d)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium normal-case tracking-normal transition-all ${
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
            <label className="text-sm font-medium normal-case tracking-normal text-zinc-500">Audit Time period</label>
            <Tooltip content="Choose the time window of weekly performance data to compare against the prior identical interval" className="w-full">
              <div className="grid grid-cols-2 gap-2 w-full">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-mono font-medium focus:outline-none ${
                    isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-950 border-white/5 text-white'
                  }`}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-xl text-sm font-mono font-medium focus:outline-none ${
                    isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-950 border-white/5 text-white'
                  }`}
                />
              </div>
            </Tooltip>
            <p className="text-sm text-zinc-600 normal-case tracking-normal font-medium leading-tight">
              * Accounts for 3-day Google data sync latency
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database size={14} className="text-zinc-500" />
            <p className={`text-sm normal-case font-medium tracking-normal ${isWhite ? 'text-[#607a80]' : 'text-zinc-500'}`}>
              GSC Site URL: <span className="font-mono text-zinc-400">{selectedClient?.gsc_site_url || 'Unconfigured'}</span>
            </p>
          </div>
          <Tooltip content="Synthesize comprehensive metrics via neural audit, comparing traffic profiles and generating prioritised tasks">
            <button
              onClick={handleRunAudit}
              disabled={loading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-2xl font-medium text-sm normal-case tracking-normal transition-all active:scale-95 shadow-xl disabled:opacity-50 ${
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
            <h4 className={`text-base font-medium normal-case tracking-tight italic ${isWhite ? 'text-zinc-900' : 'text-white'}`}>
              AI AUDIT PREPARATION SYSTEM
            </h4>
            <p className="text-sm text-zinc-500 normal-case tracking-normal font-medium max-w-md mx-auto leading-relaxed">
              Synthesizing historical search console clusters and organic conversion sessions.
            </p>
          </div>
          <div className={`inline-block py-2 px-4 rounded-xl border font-mono text-sm font-medium tracking-normal ${
            isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-900 border-white/5 text-blue-400'
          }`}>
            CURRENT TASK: {loadingPhrases[loadingPhraseIndex]}
          </div>
        </div>
      )}

      {/* Error Message Toast */}
      {error && (
        <div className={`print:hidden fixed top-6 right-6 z-50 p-5 rounded-[20px] border flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 fade-in duration-300 max-w-sm ${
          isWhite ? 'bg-white/95 border-rose-200 text-rose-950' : 'bg-zinc-950/95 border-red-500/20 text-red-400'
        }`}>
          <AlertCircle className="shrink-0 mt-0.5 text-rose-500 animate-pulse" size={16} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium normal-case tracking-normal text-zinc-500">Audit Engine Interruption</h5>
              <button onClick={() => setError(null)} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium leading-none ml-2 transition-all">🞨</button>
            </div>
            <p className="text-sm font-medium normal-case tracking-wide mt-1 leading-normal break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Success Notification Toast */}
      {successMsg && (
        <div className={`print:hidden fixed top-6 right-6 z-50 p-5 rounded-[20px] border flex items-start gap-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-6 fade-in duration-300 max-w-sm ${
          isWhite ? 'bg-white/95 border-[#76c9be]/40 text-[#082a36]' : 'bg-zinc-950/95 border-emerald-500/20 text-emerald-400'
        }`}>
          <CheckCircle2 className="shrink-0 mt-0.5 text-emerald-500 animate-bounce" size={16} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium normal-case tracking-normal text-zinc-500">Audit System Alert</h5>
              <button onClick={() => setSuccessMsg(null)} className="text-zinc-400 hover:text-zinc-200 text-sm font-medium leading-none ml-2 transition-all">🞨</button>
            </div>
            <p className="text-sm font-medium normal-case tracking-wide mt-1 leading-normal break-words">{successMsg}</p>
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
                <h1 className="text-2xl font-medium normal-case tracking-tight text-slate-900 italic">SEO STRATEGIC AUDIT REPORT</h1>
                <p className="text-sm font-medium text-slate-500 normal-case tracking-normal mt-1">OPERATIONAL INTELLIGENCE PLATFORM</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-950 normal-case">{selectedClient?.name || 'Client Audit'}</p>
                <p className="text-sm font-medium text-slate-500 normal-case mt-0.5">
                  Period: {startDate} to {endDate}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-slate-100">
              <div>
                <span className="text-sm font-medium text-slate-400 normal-case tracking-normal block">Synthesis Engine</span>
                <span className="text-sm font-medium text-slate-800 normal-case">{selectedModel} LLM</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-400 normal-case tracking-normal block">Analysis Level</span>
                <span className="text-sm font-medium text-slate-800 normal-case">{analysisType} Audit</span>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-400 normal-case tracking-normal block">Generated Date</span>
                <span className="text-sm font-medium text-slate-800 normal-case">{new Date().toLocaleDateString()}</span>
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
                <h4 className={`text-sm font-medium normal-case tracking-normal ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                  Performance Gap Audit
                </h4>
              </div>

              {result.currentMetrics && result.previousMetrics && (
                <div className={`grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 border-b pb-6 ${
                  isWhite ? 'border-zinc-200' : 'border-white/5'
                }`}>
                  {[
                    {
                      label: 'GSC Clicks',
                      curr: result.currentMetrics.gsc?.clicks ?? 0,
                      prev: result.previousMetrics.gsc?.clicks ?? 0,
                      format: (v: number) => v.toLocaleString()
                    },
                    {
                      label: 'GSC Impressions',
                      curr: result.currentMetrics.gsc?.impressions ?? 0,
                      prev: result.previousMetrics.gsc?.impressions ?? 0,
                      format: (v: number) => v.toLocaleString()
                    },
                    {
                      label: 'Search CTR',
                      curr: result.currentMetrics.gsc?.ctr ?? 0,
                      prev: result.previousMetrics.gsc?.ctr ?? 0,
                      format: (v: number) => `${v.toFixed(2)}%`
                    },
                    {
                      label: 'GA4 Traffic',
                      curr: result.currentMetrics.ga4?.traffic ?? 0,
                      prev: result.previousMetrics.ga4?.traffic ?? 0,
                      format: (v: number) => v.toLocaleString()
                    }
                  ].map((m, idx) => {
                    const diff = m.curr - m.prev;
                    const percent = m.prev > 0 ? (diff / m.prev) * 100 : 0;
                    const isPositive = diff >= 0;
                    return (
                      <div key={idx} className={`p-4 rounded-2xl border ${
                        isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                      }`}>
                        <span className="text-sm font-medium normal-case tracking-normal text-zinc-500 block mb-1">
                          {m.label}
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-sm font-medium font-mono ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                            {m.format(m.curr)}
                          </span>
                          <span className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPositive ? '▲' : '▼'} {Math.abs(percent).toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-sm text-zinc-500 font-medium block mt-1">
                          Prev: {m.format(m.prev)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className={`text-sm font-medium leading-relaxed tracking-wide space-y-3.5 text-left ${
                isWhite ? 'text-zinc-600' : 'text-zinc-300'
              }`}>
                {result.trafficGapAnalysis ? (
                  result.trafficGapAnalysis.split('\n').filter(p => p.trim().length > 0).map((paragraph, pIdx) => {
                    const isBullet = paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ');
                    const isNumbered = /^\d+\.\s/.test(paragraph.trim());

                    if (isBullet) {
                      const cleanText = paragraph.trim().substring(2);
                      return (
                        <ul key={pIdx} className="list-disc pl-5 my-1 text-left">
                          <li className="leading-relaxed">
                            {highlightKeyTerms(cleanText)}
                          </li>
                        </ul>
                      );
                    }

                    if (isNumbered) {
                      const match = paragraph.trim().match(/^(\d+\.)\s(.*)/);
                      const marker = match ? match[1] : '';
                      const cleanText = match ? match[2] : paragraph.trim();
                      return (
                        <div key={pIdx} className="flex gap-2 my-1 pl-2 text-left">
                          <span className="font-medium text-blue-500 font-mono">{marker}</span>
                          <span className="leading-relaxed">{highlightKeyTerms(cleanText)}</span>
                        </div>
                      );
                    }

                    return (
                      <p key={pIdx} className="text-left font-medium leading-relaxed">
                        {highlightKeyTerms(paragraph)}
                      </p>
                    );
                  })
                ) : null}
              </div>
            </div>

            {/* Expected Impact Summary */}
            <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl flex flex-col justify-between ${
              isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <h4 className={`text-sm font-medium normal-case tracking-normal ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                    Projected SEO Yield
                  </h4>
                </div>
                <div className={`text-sm font-medium leading-relaxed tracking-wide space-y-2 text-left ${
                  isWhite ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  {result.expectedImpact ? (
                    result.expectedImpact.split('\n').filter(p => p.trim().length > 0).map((paragraph, pIdx) => (
                      <p key={pIdx} className="leading-relaxed">
                        {highlightKeyTerms(paragraph)}
                      </p>
                    ))
                  ) : null}
                </div>
              </div>

              {/* Log actions & Export PDF */}
              <div className="print:hidden pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row gap-3">
                <Tooltip content="Record these AI recommendations permanently to the active log history of the client node" className="w-full">
                  <button
                    onClick={handleCommitToLog}
                    className={`w-full py-2.5 rounded-xl font-medium text-sm normal-case tracking-normal transition-all hover:scale-[1.02] active:scale-95 shadow-lg border ${
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
                    className={`w-full py-2.5 rounded-xl font-medium text-sm normal-case tracking-normal transition-all hover:scale-[1.02] active:scale-95 shadow-lg border flex items-center justify-center gap-1.5 ${
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
            <h3 className={`text-sm font-medium normal-case tracking-normal mb-4 ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
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
                        <span className={`px-2 py-0.5 rounded-lg border text-sm font-medium normal-case tracking-normal ${prioColor}`}>
                          {directive.priority} priority
                        </span>
                        
                        <div className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-sm font-medium normal-case tracking-normal ${catColor}`}>
                          {React.createElement(catIcon, { size: 10 })}
                          {directive.category}
                        </div>
                      </div>

                      {/* Title */}
                      <h4 className={`text-sm font-medium tracking-tight leading-relaxed italic ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                        {directive.title}
                      </h4>

                      {/* Description */}
                      <p className={`text-sm font-medium tracking-wide leading-relaxed whitespace-pre-line ${isWhite ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {renderClickableDescription(directive.description)}
                      </p>
                    </div>

                    {/* Yield impact */}
                    <div className={`mt-6 p-4 rounded-xl border text-sm font-medium tracking-normal leading-normal print:bg-slate-50 print:border-slate-200 print:text-slate-700 ${
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

          {/* Row 2.5: Deep Technical Crawler Diagnostics */}
          {result.crawlDiagnostics && (
            <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl ${
              isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
            }`}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isWhite ? 'bg-[#082a36]/5 text-[#082a36]' : 'bg-blue-500/10 text-blue-400'}`}>
                    <ShieldAlert size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-medium normal-case tracking-normal ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                      On-Page Technical Crawler Diagnostics
                    </h4>
                    <p className="text-sm font-medium normal-case tracking-normal text-zinc-500 mt-0.5">
                      Sitemap Discovered • Real-time HTML Structure Verification
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowCrawlDetails(!showCrawlDetails)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium normal-case tracking-normal transition-all border ${
                      isWhite
                        ? 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                        : 'bg-zinc-950 border-white/5 text-zinc-400 hover:bg-zinc-900'
                    }`}
                  >
                    {showCrawlDetails ? 'Hide Scanned URL Registry' : 'Reveal Scanned URL Registry'}
                  </button>
                </div>
              </div>

              {/* Top Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Health Score */}
                <div className={`p-5 rounded-2xl border flex items-center justify-between ${
                  isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                }`}>
                  <div>
                    <span className="text-sm font-medium normal-case tracking-normal text-zinc-500 block mb-1">
                      Technical Health Score
                    </span>
                    <span className={`text-2xl font-medium font-mono tracking-tighter ${
                      result.crawlDiagnostics.healthScore >= 90
                        ? 'text-emerald-500'
                        : result.crawlDiagnostics.healthScore >= 70
                        ? 'text-amber-500'
                        : 'text-rose-500'
                    }`}>
                      {result.crawlDiagnostics.healthScore}/100
                    </span>
                    <p className="text-sm text-zinc-500 font-medium normal-case tracking-normal mt-1">
                      {result.crawlDiagnostics.healthScore >= 90
                        ? 'Excellent Code Quality'
                        : result.crawlDiagnostics.healthScore >= 70
                        ? 'Needs Tactical Remediation'
                        : 'Critical Structural Gaps'}
                    </p>
                  </div>
                  {/* Visual Radial indicator simulation */}
                  <div className="relative w-14 h-14 shrink-0">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-zinc-800 opacity-20"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={
                          result.crawlDiagnostics.healthScore >= 90
                            ? 'text-emerald-500'
                            : result.crawlDiagnostics.healthScore >= 70
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }
                        strokeDasharray={`${result.crawlDiagnostics.healthScore}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-mono font-medium text-sm text-zinc-400">
                      {result.crawlDiagnostics.healthScore}%
                    </div>
                  </div>
                </div>

                {/* Pages Scanned */}
                <div className={`p-5 rounded-2xl border ${
                  isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                }`}>
                  <span className="text-sm font-medium normal-case tracking-normal text-zinc-500 block mb-1">
                    Audited Pages Profile
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-medium font-mono tracking-tighter ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                      {result.crawlDiagnostics.totalPages}
                    </span>
                    <span className="text-sm text-zinc-400 font-medium normal-case tracking-normal">
                      URLs Scanned
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 font-medium normal-case tracking-normal mt-1 leading-normal">
                    Discovered automatically via site XML sitemap parser
                  </p>
                </div>

                {/* Total Issues Found */}
                <div className={`p-5 rounded-2xl border ${
                  isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                }`}>
                  <span className="text-sm font-medium normal-case tracking-normal text-zinc-500 block mb-1">
                    Discovered Vulnerabilities
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-medium font-mono tracking-tighter ${
                      result.crawlDiagnostics.totalIssues === 0 ? 'text-emerald-500' : 'text-rose-400'
                    }`}>
                      {result.crawlDiagnostics.totalIssues}
                    </span>
                    <span className="text-sm text-zinc-400 font-medium normal-case tracking-normal">
                      On-Page Errors
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 font-medium normal-case tracking-normal mt-1 leading-normal">
                    Missing tags, title limits, multiple H1s, missing image alts
                  </p>
                </div>
              </div>

              {/* Scanned URL Registry Accordion */}
              {showCrawlDetails && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="text-sm font-medium normal-case tracking-normal text-zinc-500 mb-2">
                    Select a page below to view crawl data & step-by-step developer code fixes:
                  </div>

                  <div className="space-y-3">
                    {result.crawlDiagnostics.scannedPages.map((page: any, index: number) => {
                      const hasIssues = page.issues && page.issues.length > 0;
                      const isError = !!page.error;
                      const isExpanded = !!expandedPages[page.url];

                      const togglePageExpand = (url: string) => {
                        setExpandedPages(prev => ({
                          ...prev,
                          [url]: !prev[url]
                        }));
                      };

                      return (
                        <div
                          key={index}
                          className={`rounded-2xl border transition-all overflow-hidden ${
                            isExpanded
                              ? (isWhite ? 'border-[#76c9be] bg-[#76c9be]/5' : 'border-blue-500/30 bg-blue-500/5')
                              : (isWhite ? 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100' : 'border-white/5 bg-zinc-950/20 hover:bg-zinc-900/30')
                          }`}
                        >
                          {/* Accordion Row Header */}
                          <div
                            onClick={() => togglePageExpand(page.url)}
                            className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                          >
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Globe size={12} className="text-zinc-500 shrink-0" />
                                <span className={`text-sm font-medium tracking-tight leading-relaxed block truncate normal-case italic ${
                                  isWhite ? 'text-[#082a36]' : 'text-white'
                                }`}>
                                  {page.title || 'Untitled Page'}
                                </span>
                              </div>
                              <a
                                href={page.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm font-mono text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 leading-none mt-1 break-all"
                              >
                                {page.url}
                                <ExternalLink size={8} className="shrink-0" />
                              </a>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                              {isError ? (
                                <span className="px-2 py-0.5 rounded-lg border bg-rose-500/10 text-rose-400 border-rose-500/20 text-sm font-medium normal-case tracking-normal">
                                  Broken Page Error
                                </span>
                              ) : hasIssues ? (
                                <span className="px-2 py-0.5 rounded-lg border bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm font-medium normal-case tracking-normal">
                                  {page.issues.length} Issues Found
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-sm font-medium normal-case tracking-normal">
                                  Healthy (0 Issues)
                                </span>
                              )}

                              <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown size={14} className="text-zinc-500" />
                              </div>
                            </div>
                          </div>

                          {/* Accordion Content Drawer */}
                          {isExpanded && (
                            <div className={`px-5 pb-5 pt-2 border-t space-y-4 ${
                              isWhite ? 'border-zinc-200' : 'border-white/5'
                            }`}>
                              {isError ? (
                                <div className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-300 text-sm font-medium">
                                  ⚠️ Audit Failure Details: {page.error}. 
                                  <span className="block mt-1 font-medium text-zinc-400">
                                    The crawler could not fetch this page structure. Ensure this URL is published, return code 200 HTTP status, and is not blocked by a login screen or firewall.
                                  </span>
                                </div>
                              ) : !hasIssues ? (
                                <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center gap-2">
                                  <CheckCircle2 size={12} />
                                  Outstanding structural optimisation! No critical title limit, heading hierarchy, or meta description issues discovered on this URL.
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {(() => {
                                    const activeTab = activeDrawerTabs[page.url] || (pageOptimizations[page.url]?.title ? 'targets' : 'issues');
                                    const setActiveTab = (tab: 'targets' | 'issues' | 'code') => {
                                      setActiveDrawerTabs(prev => ({ ...prev, [page.url]: tab }));
                                    };

                                    return (
                                      <div className="space-y-4 text-left">
                                        {/* Structured Pill Tabs */}
                                        <div className="flex flex-wrap gap-2 border-b pb-3 border-zinc-200 dark:border-white/5">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveTab('targets');
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium normal-case tracking-normal transition-all active:scale-95 flex items-center gap-1.5 ${
                                              activeTab === 'targets'
                                                ? isWhite
                                                  ? 'bg-[#082a36] text-white shadow-sm'
                                                  : 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                                                : isWhite
                                                  ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800'
                                                  : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                                            }`}
                                          >
                                            <Sparkles size={10} />
                                            🎯 AI SEO Targets
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveTab('issues');
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium normal-case tracking-normal transition-all active:scale-95 flex items-center gap-1.5 ${
                                              activeTab === 'issues'
                                                ? isWhite
                                                  ? 'bg-[#082a36] text-white shadow-sm'
                                                  : 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                                                : isWhite
                                                  ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800'
                                                  : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                                            }`}
                                          >
                                            <AlertCircle size={10} />
                                            ⚠️ Issues ({page.issues.length})
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveTab('code');
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-sm font-medium normal-case tracking-normal transition-all active:scale-95 flex items-center gap-1.5 ${
                                              activeTab === 'code'
                                                ? isWhite
                                                  ? 'bg-[#082a36] text-white shadow-sm'
                                                  : 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                                                : isWhite
                                                  ? 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-800'
                                                  : 'bg-zinc-900/50 text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
                                            }`}
                                          >
                                            <Code size={10} />
                                            💻 Code Patch
                                          </button>
                                        </div>

                                        {/* TAB CONTENT: AI TARGETS */}
                                        {activeTab === 'targets' && (
                                          <div className="space-y-4 animate-in fade-in duration-200">
                                            {(() => {
                                              const suggestions = pageOptimizations[page.url];
                                              const isLoaded = !!(suggestions && !suggestions.loading && (suggestions.title || suggestions.metaDescription));
                                              const isLoading = !!(suggestions && suggestions.loading);

                                              if (isLoading) {
                                                return (
                                                  <div className={`p-6 rounded-2xl border flex flex-col items-center justify-center space-y-3 border-dashed ${
                                                    isWhite ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-950/40 border-white/10'
                                                  }`}>
                                                    <Sparkles size={20} className="text-blue-500 animate-spin" />
                                                    <span className="text-sm font-medium normal-case tracking-normal text-[#76c9be] animate-pulse">
                                                      Synthesising Page-Specific SEO Targets...
                                                    </span>
                                                  </div>
                                                );
                                              }

                                              if (isLoaded) {
                                                return (
                                                  <div className={`p-6 rounded-2xl border space-y-4 ${
                                                    isWhite ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-white/5'
                                                  }`}>
                                                    <div className="text-sm font-medium normal-case tracking-normal text-[#76c9be] flex items-center gap-1.5">
                                                      <Sparkles size={11} className="animate-pulse" />
                                                      AI CUSTOM OPTIMISED FIX TARGETS (CREDIT SAVED: SINGLE URL ONLY)
                                                    </div>
                                                    
                                                    <div className="space-y-3.5">
                                                      {suggestions.title && (
                                                        <div className="flex items-center justify-between gap-4 border-b border-zinc-100 dark:border-white/5 pb-3">
                                                          <div className="min-w-0 flex-1">
                                                            <span className="text-sm font-medium text-zinc-500 normal-case tracking-normal block mb-0.5">Optimised Title Target</span>
                                                            <p className={`text-sm font-mono font-medium break-all leading-normal ${isWhite ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                                                              {suggestions.title}
                                                            </p>
                                                          </div>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleCopyToClipboard(suggestions.title, "Optimised Title", setSuccessMsg);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium normal-case tracking-normal shrink-0 transition-all active:scale-95 ${
                                                              isWhite ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90 border-[#082a36]' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                                                            }`}
                                                          >
                                                            Copy Title
                                                          </button>
                                                        </div>
                                                      )}

                                                      {suggestions.metaDescription && (
                                                        <div className="flex items-center justify-between gap-4">
                                                          <div className="min-w-0 flex-1">
                                                            <span className="text-sm font-medium text-zinc-500 normal-case tracking-normal block mb-0.5">Optimised Meta Description Target</span>
                                                            <p className={`text-sm font-mono font-medium break-all leading-normal ${isWhite ? 'text-[#082a36]' : 'text-zinc-300'}`}>
                                                              {suggestions.metaDescription}
                                                            </p>
                                                          </div>
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleCopyToClipboard(suggestions.metaDescription, "Meta Description", setSuccessMsg);
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium normal-case tracking-normal shrink-0 transition-all active:scale-95 ${
                                                              isWhite ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90 border-[#082a36]' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                                                            }`}
                                                          >
                                                            Copy Meta
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              }

                                              // Optimise Button
                                              return (
                                                <div className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                                                  isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-white/5'
                                                }`}>
                                                  <div className="flex items-center gap-2">
                                                    <Sparkles size={14} className="text-[#76c9be] animate-pulse" />
                                                    <div className="text-left">
                                                      <span className="text-sm font-medium normal-case tracking-normal text-[#76c9be] block">
                                                        AI Custom Optimised Fix Targets
                                                      </span>
                                                      <span className="text-sm font-medium text-zinc-500 normal-case tracking-wide block mt-0.5">
                                                        On-demand optimisation uses ~95% fewer tokens and generates context-aware tag snippets
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleOptimisePage(page.url, page.title, page.issues);
                                                    }}
                                                    className={`px-3.5 py-2 rounded-lg border text-sm font-medium normal-case tracking-normal transition-all hover:scale-[1.02] active:scale-95 shadow-md flex items-center gap-1.5 shrink-0 ${
                                                      isWhite
                                                        ? 'bg-[#76c9be] text-[#082a36] border-[#76c9be] hover:bg-[#76c9be]/90'
                                                        : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 shadow-blue-500/20'
                                                    }`}
                                                  >
                                                    <Sparkles size={9} />
                                                    Optimise this Page with AI
                                                  </button>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        )}

                                        {/* TAB CONTENT: ISSUES */}
                                        {activeTab === 'issues' && (
                                          <div className="space-y-3 animate-in fade-in duration-200">
                                            <div className="text-sm font-medium normal-case tracking-normal text-zinc-400 text-left mb-1">
                                              Detailed Vulnerability & Resolution Log:
                                            </div>
                                            {page.issues.map((issue: string, iIdx: number) => {
                                              let resolution = '';
                                              if (issue.includes('Missing Page Title')) {
                                                resolution = 'Add a highly relevant <title> tag within the <head> block, using standard keywords matching customer search queries.';
                                              } else if (issue.includes('Over-optimized Title Tag') || issue.includes('Over-optimised Title Tag')) {
                                                resolution = 'Shorten this title. Google search snippets will truncate title text beyond 60 characters, hurting CTR.';
                                              } else if (issue.includes('Under-optimized Title Tag') || issue.includes('Under-optimised Title Tag')) {
                                                resolution = 'Expand the page title. Ensure it contains at least 10 characters to fully convey the contextual relevance.';
                                              } else if (issue.includes('Missing Meta Description')) {
                                                resolution = 'Insert a <meta name="description"> tag. Summarise the page content concisely to encourage clicks from SERP.';
                                              } else if (issue.includes('Meta Description Exceeds')) {
                                                resolution = 'Shorten the description. Keep it below 160 characters to ensure it displays fully without trailing ellipses.';
                                              } else if (issue.includes('Meta Description Too Short')) {
                                                resolution = 'Lengthen the description. Expand the copy to at least 50 characters to provide sufficient context to search engines.';
                                              } else if (issue.includes('Missing Primary Heading')) {
                                                resolution = 'Include exactly one primary <h1> heading containing your primary page keyword at the top of the content.';
                                              } else if (issue.includes('Multiple Primary Headings')) {
                                                resolution = 'Demote extra <h1> headings. Modify the markup so only one primary topic heading is <h1>, and other subheadings are <h2> to <h6>.';
                                              } else if (issue.includes('Images Lacking ALT tags')) {
                                                resolution = 'Add descriptive alt="..." text attributes to the listed images to improve screen reader accessibility and image search rankings.';
                                              } else {
                                                resolution = 'Review this structural layout issue and adjust the HTML markup accordingly.';
                                              }

                                              return (
                                                <div
                                                  key={iIdx}
                                                  className={`p-4 rounded-2xl border flex gap-3 text-sm text-left transition-all ${
                                                    isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/5 hover:border-white/10'
                                                  }`}
                                                >
                                                  <div className="text-rose-400 font-medium shrink-0 mt-0.5">⚠️</div>
                                                  <div>
                                                    <div className="font-medium normal-case text-sm tracking-normal text-rose-500 dark:text-rose-400">
                                                      Issue: <span className="lowercase font-medium font-mono tracking-normal">{issue}</span>
                                                    </div>
                                                    <div className="mt-1.5 text-sm leading-relaxed">
                                                      <span className="font-medium normal-case tracking-normal text-sm text-zinc-400 dark:text-zinc-500">💡 Fix Guide:</span>{' '}
                                                      <span className="font-medium text-zinc-600 dark:text-zinc-300 normal-case">{resolution}</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* TAB CONTENT: CODE PATCH */}
                                        {activeTab === 'code' && (
                                          <div className="space-y-3 animate-in fade-in duration-200">
                                            <div className="text-sm font-medium normal-case tracking-normal text-zinc-400 flex items-center gap-1.5 mb-1">
                                              <Code size={10} />
                                              Actionable Developer Code Patch Suggestion:
                                            </div>
                                            <div className={`p-5 rounded-2xl font-mono text-sm border shadow-inner leading-relaxed overflow-x-auto text-left relative group/code ${
                                              isWhite ? 'bg-zinc-900 text-zinc-200 border-zinc-800' : 'bg-black text-blue-400 border-white/5'
                                            }`}>
                                              <div className="text-zinc-500 mb-3 border-b border-zinc-800 pb-2 normal-case tracking-normal font-medium text-sm flex justify-between items-center">
                                                <span>{`// Corrective HTML suggestion for ${page.title || 'Audited URL'}`}</span>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const patchElement = document.getElementById(`code-patch-${page.url.replace(/[^a-zA-Z0-9]/g, '-')}`);
                                                    const patchText = patchElement ? patchElement.textContent : '';
                                                    if (patchText) {
                                                      handleCopyToClipboard(patchText, "Code Patch", setSuccessMsg);
                                                    }
                                                  }}
                                                  className="opacity-75 hover:opacity-100 text-sm font-medium normal-case tracking-normal bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded transition-all active:scale-95"
                                                >
                                                  Copy Code
                                                </button>
                                              </div>
                                              <code id={`code-patch-${page.url.replace(/[^a-zA-Z0-9]/g, '-')}`} className="whitespace-pre">
                                                {pageOptimizations[page.url]?.codePatch ? (
                                                  pageOptimizations[page.url].codePatch
                                                ) : (
                                                  <>
                                                    {`<!-- Copy and paste/modify this snippet inside your HTML layout -->\n`}
                                                    {(() => {
                                                      const aiSuggestions = page.aiSuggestions || result.pageFixSuggestions?.[page.url];
                                                      return (
                                                        <>
                                                          {aiSuggestions?.title ? (
                                                            `\n<title>${aiSuggestions.title}</title>`
                                                          ) : page.issues.some((i: string) => i.includes('Title')) ? (
                                                            `\n<title>${page.title ? (page.title.length > 50 ? page.title.substring(0, 50) + '...' : page.title) : 'Optimised Keyword Title Here'}</title>`
                                                          ) : (
                                                            `\n<!-- Page title is already optimised: <title>${page.title}</title> -->`
                                                          )}
                                                          {aiSuggestions?.metaDescription ? (
                                                            `\n<meta name="description" content="${aiSuggestions.metaDescription}" />`
                                                          ) : page.issues.some((i: string) => i.includes('Meta Description')) ? (
                                                            `\n<meta name="description" content="Add a highly engaging, keyword-focused summary of this page containing 50-160 characters." />`
                                                          ) : null}
                                                        </>
                                                      );
                                                    })()}
                                                    {page.issues.some((i: string) => i.includes('Heading')) ? (
                                                      `\n\n<!-- Ensure exactly one primary <h1> heading exists on this page -->\n<h1>${page.title || 'Single Primary Page Heading'}</h1>`
                                                    ) : null}
                                                    {page.issues.some((i: string) => i.includes('Images Lacking')) ? (
                                                      `\n\n<!-- Make sure every image has an descriptive alt attribute -->\n<img src="/assets/hero.png" alt="Descriptive SEO keyword alt description goes here" />`
                                                    ) : null}
                                                  </>
                                                )}
                                              </code>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 3: Developer Implementation Guide */}
          <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl ${
            isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
          }`}>
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={16} className="text-blue-400" />
              <h4 className={`text-sm font-medium normal-case tracking-normal ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                Tactical Implementation playbook
              </h4>
            </div>

            <div className={`playbook-container p-6 rounded-2xl font-mono text-sm border shadow-inner leading-relaxed whitespace-pre-line ${
              isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-950 border-white/5 text-zinc-400'
            }`}>
              {result.implementationGuide}
            </div>
          </div>

          {/* Executive Summary Card at the bottom */}
          {result.executiveSummary && (
            <div className={`printable-card p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl ${
              isWhite ? 'bg-white border-[#163f4d]/10' : 'bg-zinc-900/50 border-white/5'
            }`}>
              <div className="flex items-center gap-2 mb-6">
                <Sparkles size={18} className="text-blue-500 animate-pulse" />
                <h4 className={`text-sm font-medium normal-case tracking-normal ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                  Executive Strategic Summary
                </h4>
              </div>

              <div className={`p-6 rounded-2xl border text-sm font-medium leading-relaxed tracking-normal space-y-6 ${
                isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950/40 border-white/5 text-zinc-300'
              }`}>
                
                {/* Section Header Statement */}
                <p className="font-medium normal-case text-sm tracking-normal text-blue-500 border-b border-white/5 pb-2">
                  🔍 AUDIT SCOPE STATEMENT
                </p>
                <p className="italic font-medium leading-relaxed">
                  "I have analysed the property URL <span className="font-mono text-blue-400 not-italic font-medium">{selectedClient?.gsc_site_url || 'https://example.com/'}</span> and all associated organic performance data datasets. Based on this in-depth analysis, I have mapped our core achievements, critical growth sectors, active corrective directives, and expected outcome projections below."
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  {/* Good Things */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium normal-case tracking-normal text-emerald-500 flex items-center gap-1.5">
                      <CheckCircle2 size={12} />
                      These are the good things:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm font-medium text-zinc-400 pl-1 leading-relaxed">
                      {result.executiveSummary.goodThings.map((item, idx) => (
                        <li key={idx} className="marker:text-emerald-500 normal-case">{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Things to Improve */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium normal-case tracking-normal text-rose-400 flex items-center gap-1.5">
                      <AlertCircle size={12} />
                      These are the things we have to improve:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm font-medium text-zinc-400 pl-1 leading-relaxed">
                      {result.executiveSummary.thingsToImprove.map((item, idx) => (
                        <li key={idx} className="marker:text-rose-400 normal-case">{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions to Do */}
                  <div className="space-y-3 pt-4 border-t border-white/5 md:col-span-2">
                    <p className="text-sm font-medium normal-case tracking-normal text-blue-400 flex items-center gap-1.5">
                      <Zap size={12} />
                      These are the actions we need to do:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm font-medium text-zinc-400 pl-1 leading-relaxed">
                      {result.executiveSummary.actionsToDo.map((item, idx) => (
                        <li key={idx} className="marker:text-blue-400 normal-case">{item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Expect Results */}
                  <div className="space-y-3 pt-4 border-t border-white/5 md:col-span-2">
                    <p className="text-sm font-medium normal-case tracking-normal text-indigo-400 flex items-center gap-1.5">
                      <TrendingUp size={12} />
                      These are the results we expect by doing that:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm font-medium text-zinc-400 pl-1 leading-relaxed">
                      {result.executiveSummary.expectedResults.map((item, idx) => (
                        <li key={idx} className="marker:text-indigo-400 normal-case">{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
