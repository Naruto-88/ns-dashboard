import { useState, useEffect } from 'react';
import React from 'react';
import StrategicReportViewer from '../components/StrategicReportViewer';
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
import { getClients, runAiAnalysis, runAiSinglePageOptimise, updateClient, Client, getSeoMetadataHistory, applySeoMetadata, revertSeoMetadata } from '../services/dataService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';

export interface ActionableDirective {
  title: string;
  category: 'Technical' | 'Content' | 'Backlinks';
  priority: 'High' | 'Medium' | 'Low';
  description: string;
  expectedImpact: string;
}

export interface ExecutiveSummary {
  goodThings: string[];
  thingsToImprove: string[];
  actionsToDo: string[];
  expectedResults: string[];
}

export interface AnalysisResult {
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
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude' | 'gpt'>('claude');
  const [selectedClaudeModel, setSelectedClaudeModel] = useState<string>('claude-sonnet-4-6');
  const [selectedGptModel, setSelectedGptModel] = useState<string>('gpt-4o-mini');
  const [analysisType, setAnalysisType] = useState<'light' | 'deep'>('light');
  const [simulate, setSimulate] = useState(true); // Default to simulation mode to prevent initial API cost blockers
  const [runTechnicalCrawl, setRunTechnicalCrawl] = useState(false);
  const [showCrawlDetails, setShowCrawlDetails] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});
  const [generateAiFixes, setGenerateAiFixes] = useState(false);
  const [pageOptimizations, setPageOptimizations] = useState<Record<string, { title: string; metaDescription: string; codePatch: string; loading?: boolean }>>({});
  const [activeDrawerTabs, setActiveDrawerTabs] = useState<Record<string, 'targets' | 'issues' | 'code'>>({});

  // Default dates: GSC has a ~2 day data-lag. Set end date to 2 days ago, start date to 8 days ago.
  const today = new Date();
  const past2Days = new Date(today);
  past2Days.setDate(today.getDate() - 2);
  const past8Days = new Date(today);
  past8Days.setDate(today.getDate() - 8);

  const [startDate, setStartDate] = useState(past8Days.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(past2Days.toISOString().split('T')[0]);

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
        model: selectedModel === 'claude' ? selectedClaudeModel : selectedModel === 'gpt' ? selectedGptModel : selectedModel,
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
      
      fetchHistory(selectedClientId);
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
      const data = await runAiSinglePageOptimise({
        clientId: selectedClientId,
        url: pageUrl,
        pageTitle,
        issues,
        model: selectedModel === 'claude' ? selectedClaudeModel : selectedModel === 'gpt' ? selectedGptModel : selectedModel,
        simulate
      });

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

  const [metadataHistories, setMetadataHistories] = useState<Record<string, any[]>>({});
  const [loadingMetadataHistory, setLoadingMetadataHistory] = useState<Record<string, boolean>>({});
  const [applyingMetadata, setApplyingMetadata] = useState<Record<string, boolean>>({});

  const handleUpdateOptimizationField = (pageUrl: string, field: 'title' | 'metaDescription', value: string) => {
    setPageOptimizations(prev => {
      const existing = prev[pageUrl];
      if (!existing) return prev;
      return {
        ...prev,
        [pageUrl]: {
          ...existing,
          [field]: value
        }
      };
    });
  };

  const handleFetchMetadataHistory = async (pageUrl: string) => {
    setLoadingMetadataHistory(prev => ({ ...prev, [pageUrl]: true }));
    try {
      const data = await getSeoMetadataHistory(selectedClientId, pageUrl);
      setMetadataHistories(prev => ({ ...prev, [pageUrl]: data }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMetadataHistory(prev => ({ ...prev, [pageUrl]: false }));
    }
  };

  const handleApplyMetadata = async (pageUrl: string, title: string, description: string) => {
    setApplyingMetadata(prev => ({ ...prev, [pageUrl]: true }));
    try {
      const res = await applySeoMetadata({
        clientId: selectedClientId,
        url: pageUrl,
        title,
        description,
        appliedBy: 'Admin'
      });
      if (res.success) {
        setSuccessMsg(`Successfully applied metadata to live website for page: ${pageUrl}`);
        handleFetchMetadataHistory(pageUrl);
      } else {
        setError(`Failed to apply metadata: ${res.error}`);
      }
    } catch (e: any) {
      setError(`Apply failed: ${e.message}`);
    } finally {
      setApplyingMetadata(prev => ({ ...prev, [pageUrl]: false }));
    }
  };

  const handleRevertMetadata = async (pageUrl: string, historyId: string) => {
    try {
      const res = await revertSeoMetadata(selectedClientId, historyId);
      if (res.success) {
        setSuccessMsg('Successfully rolled back metadata to selected version.');
        // Refresh history by inspecting the URL we rolled back
        const histItem = historiesForClient.find(h => h.id === historyId);
        if (histItem) {
          handleFetchMetadataHistory(histItem.page_url);
        }
      } else {
        setError(`Revert failed: ${res.error}`);
      }
    } catch (e: any) {
      setError(`Revert failed: ${e.message}`);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const historiesForClient = metadataHistories[selectedClient?.id || ''] || [];

  return (
    <div className="space-y-8 pb-16">
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
                { id: 'claude', label: 'Claude (Default)', tooltip: 'Claude Sonnet 4-6: Supreme depth, 10/10 keyword accuracy, custom code & schemas. Premium client deliverables. (~100s)' },
                { id: 'gemini', label: 'Gemini (Fast)', tooltip: 'Gemini 2.5 Flash: Lightning-fast, 9/10 keyword accuracy. Great for quick internal scans or high-volume days. (~30s)' },
                { id: 'gpt', label: 'GPT-4o', tooltip: 'GPT-4o: Standard scan. Available but deprioritised due to minor keyword variant-merging issues. (~20s)' }
              ].map(m => (
                <Tooltip key={m.id} content={m.tooltip} className="w-full">
                  <button
                    onClick={() => setSelectedModel(m.id as any)}
                    className={`w-full py-2 px-1.5 border rounded-xl text-xs font-semibold normal-case tracking-tight transition-all truncate ${
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

            {/* Specific Model selection and pricing breakdown */}
            {(selectedModel === 'claude' || selectedModel === 'gpt') && (
              <div className={`mt-3 p-4 rounded-xl border space-y-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
                isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/60 border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tracking-normal text-zinc-400">
                    {selectedModel === 'claude' ? 'Select Claude Model' : 'Select ChatGPT Model'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-sm font-semibold uppercase ${
                    isWhite ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {(selectedModel === 'claude' ? selectedClaudeModel === 'claude-haiku-4-5-20251001' : selectedGptModel === 'gpt-4o-mini') ? 'Cheapest Default' : 'Custom Active'}
                  </span>
                </div>

                <div className="space-y-2">
                  <select
                    value={selectedModel === 'claude' ? selectedClaudeModel : selectedGptModel}
                    onChange={(e) => {
                      if (selectedModel === 'claude') {
                        setSelectedClaudeModel(e.target.value);
                      } else {
                        setSelectedGptModel(e.target.value);
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-xl text-sm font-medium focus:outline-none transition-all normal-case tracking-normal ${
                      isWhite ? 'bg-white border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/5 text-white focus:border-blue-500'
                    }`}
                  >
                    {selectedModel === 'claude' ? (
                      <>
                        <option value="claude-haiku-4-5-20251001">Claude 4.5 Haiku (Cheapest - Recommended)</option>
                        <option value="claude-sonnet-4-6">Claude 4.6 Sonnet (Best Value)</option>
                        <option value="claude-opus-4-8">Claude 4.8 Opus (Premium)</option>
                      </>
                    ) : (
                      <>
                        <option value="gpt-4o-mini">GPT-4o Mini (Cheapest - Recommended)</option>
                        <option value="gpt-4o">GPT-4o Full (Standard Quality)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Pricing Table / Metric */}
                {(() => {
                  const currentModelId = selectedModel === 'claude' ? selectedClaudeModel : selectedGptModel;
                  let inputPrice = '';
                  let outputPrice = '';
                  let details = '';

                  if (currentModelId === 'claude-haiku-4-5-20251001') {
                    inputPrice = '$1.00';
                    outputPrice = '$5.00';
                    details = 'Claude Haiku 4.5 is the fastest and most cost-effective Claude model.';
                  } else if (currentModelId === 'claude-sonnet-4-6') {
                    inputPrice = '$3.00';
                    outputPrice = '$15.00';
                    details = 'Claude Sonnet 4.6 balance of supreme intellect and highly detailed strategy.';
                  } else if (currentModelId === 'claude-opus-4-8') {
                    inputPrice = '$15.00';
                    outputPrice = '$75.00';
                    details = 'Claude Opus 4.8 is the most powerful model for deep enterprise intelligence.';
                  } else if (currentModelId === 'gpt-4o-mini') {
                    inputPrice = '$0.15';
                    outputPrice = '$0.60';
                    details = 'GPT-4o Mini is an ultra-cheap, lightning fast model for bulk operations.';
                  } else if (currentModelId === 'gpt-4o') {
                    inputPrice = '$2.50';
                    outputPrice = '$10.00';
                    details = 'GPT-4o Full offers maximum developer-grade code patches and structural fixes.';
                  }

                  return (
                    <div className={`p-3 rounded-xl space-y-2 border text-sm font-medium ${
                      isWhite ? 'bg-white border-zinc-100' : 'bg-zinc-900/40 border-white/5'
                    }`}>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="border-r border-zinc-200 dark:border-white/5">
                          <span className="text-zinc-500 block mb-0.5 text-sm">Input Pricing</span>
                          <span className={`text-sm font-semibold font-mono ${isWhite ? 'text-[#082a36]' : 'text-emerald-400'}`}>
                            {inputPrice} / 1M tokens
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block mb-0.5 text-sm">Output Pricing</span>
                          <span className={`text-sm font-semibold font-mono ${isWhite ? 'text-[#082a36]' : 'text-emerald-400'}`}>
                            {outputPrice} / 1M tokens
                          </span>
                        </div>
                      </div>
                      <div className="text-sm text-zinc-500 italic mt-1 text-center leading-normal">
                        {details}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

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
              {selectedModel === 'claude' 
                ? 'Claude Sonnet 4-6 is conducting a comprehensive, highly accurate deep audit (~100s). Please do not close this window.' 
                : 'Synthesizing historical search console clusters and organic conversion sessions.'}
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
        <div className="animate-in fade-in duration-300 mt-8">
           <StrategicReportViewer 
              result={result} 
              clientName={selectedClient?.name} 
              propertyUrl={selectedClient?.gsc_site_url} 
              period={`${startDate} to ${endDate}`} 
           />
        </div>
      )}
          {/* Row 2.5: Deep Technical Crawler Diagnostics */}
          {result?.crawlDiagnostics && (
            <div className={`p-6 sm:p-8 rounded-[24px] border shadow-2xl backdrop-blur-xl mt-8 ${
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
                      Interactive AI Fix Hub
                    </h4>
                    <p className="text-sm font-medium normal-case tracking-normal text-zinc-500 mt-0.5">
                      Real-time HTML Structure Verification & Code Generation
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

              {/* Scanned URL Registry Accordion */}
              {showCrawlDetails && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="text-sm font-medium normal-case tracking-normal text-zinc-500 mb-2">
                    Select a page below to view crawl data & step-by-step developer code fixes:
                  </div>

                  <div className="space-y-3">
                    {(result?.crawlDiagnostics?.pages || result?.crawlDiagnostics?.scannedPages || [])?.map((page: any, index: number) => {
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
                                                const history = (metadataHistories[page.url] || []);
                                                const hasWpConfig = !!(selectedClient?.wordpress_url && selectedClient?.seo_webhook_secret);

                                                return (
                                                  <div className={`p-6 rounded-2xl border space-y-5 text-left ${
                                                    isWhite ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-white/5'
                                                  }`}>
                                                    <div className="text-sm font-medium normal-case tracking-normal text-[#76c9be] flex items-center gap-1.5 justify-between">
                                                      <span className="flex items-center gap-1.5">
                                                        <Sparkles size={11} className="animate-pulse" />
                                                        AI CUSTOM OPTIMISED FIX TARGETS
                                                      </span>
                                                      {hasWpConfig && (
                                                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-mono">
                                                          WordPress Connected
                                                        </span>
                                                      )}
                                                    </div>
                                                    
                                                    <div className="space-y-4">
                                                      {/* Editable Title Target */}
                                                      <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-zinc-500">
                                                          <span>Optimised Title Target</span>
                                                          <span className={suggestions.title.length > 60 ? 'text-red-400 font-bold' : 'text-emerald-400 font-medium'}>
                                                            {suggestions.title.length} / 60 chars
                                                          </span>
                                                        </div>
                                                        <input
                                                          type="text"
                                                          value={suggestions.title}
                                                          onChange={(e) => handleUpdateOptimizationField(page.url, 'title', e.target.value)}
                                                          className={`w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none ${
                                                            isWhite 
                                                              ? 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-300' 
                                                              : 'bg-zinc-900 border-zinc-850 text-white focus:border-zinc-800'
                                                          }`}
                                                        />
                                                      </div>

                                                      {/* Editable Description Target */}
                                                      <div className="space-y-1">
                                                        <div className="flex justify-between text-xs text-zinc-500">
                                                          <span>Optimised Meta Description Target</span>
                                                          <span className={suggestions.metaDescription.length > 160 ? 'text-red-400 font-bold' : 'text-emerald-400 font-medium'}>
                                                            {suggestions.metaDescription.length} / 160 chars
                                                          </span>
                                                        </div>
                                                        <textarea
                                                          rows={3}
                                                          value={suggestions.metaDescription}
                                                          onChange={(e) => handleUpdateOptimizationField(page.url, 'metaDescription', e.target.value)}
                                                          className={`w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none ${
                                                            isWhite 
                                                              ? 'bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-300' 
                                                              : 'bg-zinc-900 border-zinc-850 text-white focus:border-zinc-800'
                                                          }`}
                                                        />
                                                      </div>

                                                      {/* Google Search Snippet Preview */}
                                                      <div className={`p-4 rounded-xl border space-y-1 ${
                                                        isWhite ? 'bg-zinc-50 border-zinc-150' : 'bg-zinc-900/30 border-white/5'
                                                      }`}>
                                                        <div className="text-[10px] opacity-40 uppercase tracking-wider font-semibold">SERP Snippet Preview</div>
                                                        <div className="text-[#1a0dab] dark:text-[#8ab4f8] text-[17px] leading-tight hover:underline cursor-pointer truncate font-normal">
                                                          {suggestions.title || 'Untitled Page'}
                                                        </div>
                                                        <div className="text-[#006621] dark:text-[#34a853] text-xs truncate">
                                                          {selectedClient?.wordpress_url || 'https://example.com'}/{page.url.replace(/^\//, '')}
                                                        </div>
                                                        <div className="text-[#545454] dark:text-[#bdc1c6] text-xs line-clamp-2 leading-relaxed">
                                                          {suggestions.metaDescription || 'No description provided.'}
                                                        </div>
                                                      </div>

                                                      {/* Apply Actions */}
                                                      <div className="flex flex-wrap gap-3 pt-2">
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyToClipboard(suggestions.title, "Optimised Title", setSuccessMsg);
                                                          }}
                                                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                                                            isWhite ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'bg-zinc-900 border-zinc-850 text-zinc-300 hover:bg-zinc-800'
                                                          }`}
                                                        >
                                                          Copy Title
                                                        </button>
                                                        <button
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCopyToClipboard(suggestions.metaDescription, "Meta Description", setSuccessMsg);
                                                          }}
                                                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition active:scale-95 ${
                                                            isWhite ? 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50' : 'bg-zinc-900 border-zinc-850 text-zinc-300 hover:bg-zinc-800'
                                                          }`}
                                                        >
                                                          Copy Meta
                                                        </button>

                                                        {hasWpConfig && (
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleApplyMetadata(page.url, suggestions.title, suggestions.metaDescription);
                                                            }}
                                                            disabled={applyingMetadata[page.url]}
                                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 shadow flex items-center gap-1.5 ml-auto ${
                                                              isWhite ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90' : 'bg-emerald-600 hover:bg-emerald-500 text-slate-900 shadow-emerald-600/10'
                                                            }`}
                                                          >
                                                            {applyingMetadata[page.url] ? 'Applying...' : 'Apply to Live Site'}
                                                          </button>
                                                        )}
                                                      </div>

                                                      {/* Version history panel */}
                                                      {hasWpConfig && (
                                                        <div className="border-t border-zinc-150 dark:border-white/5 pt-3">
                                                          <button
                                                            onClick={(e) => {
                                                              e.stopPropagation();
                                                              handleFetchMetadataHistory(page.url);
                                                            }}
                                                            className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
                                                          >
                                                            📋 View Edit History ({history.length})
                                                          </button>

                                                          {history.length > 0 && (
                                                            <div className="mt-2 space-y-2 max-h-[160px] overflow-y-auto pr-1">
                                                              {history.map((hist: any, hIdx: number) => (
                                                                <div key={hIdx} className="p-2.5 rounded bg-zinc-900/10 border border-zinc-850/40 text-[11px] flex justify-between items-center gap-4">
                                                                  <div className="min-w-0 flex-1 space-y-0.5">
                                                                    <div className="font-semibold text-zinc-400">
                                                                      Applied by {hist.applied_by} on {new Date(hist.created_at).toLocaleDateString()}
                                                                    </div>
                                                                    <div className="truncate text-zinc-500">Title: {hist.applied_title}</div>
                                                                    <div className="truncate text-zinc-500">Desc: {hist.applied_description}</div>
                                                                  </div>
                                                                  <button
                                                                    onClick={(e) => {
                                                                      e.stopPropagation();
                                                                      handleRevertMetadata(page.url, hist.id);
                                                                    }}
                                                                    className="px-2 py-1 rounded bg-[#e87a43]/10 text-[#e87a43] border border-[#e87a43]/20 hover:bg-[#e87a43]/20 font-bold tracking-tight text-[10px] shrink-0"
                                                                  >
                                                                    Rollback
                                                                  </button>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          )}
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
                                            {page.issues.map((issue: string, iIdx: number) => (
                                              <div key={iIdx} className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                                                isWhite ? 'bg-rose-50/50 border-rose-100 text-rose-700' : 'bg-rose-950/20 border-rose-500/10 text-rose-300'
                                              }`}>
                                                <div className="shrink-0 mt-0.5">
                                                  <div className={`w-1.5 h-1.5 rounded-full ${isWhite ? 'bg-rose-400' : 'bg-rose-500'}`} />
                                                </div>
                                                <span className="text-sm font-medium leading-relaxed">{issue}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {/* TAB CONTENT: CODE */}
                                        {activeTab === 'code' && (
                                          <div className="animate-in fade-in duration-200">
                                            {(() => {
                                              const patch = pageOptimizations[page.url]?.codePatch;
                                              if (!patch) {
                                                return (
                                                  <div className={`p-6 rounded-2xl border text-center ${
                                                    isWhite ? 'bg-zinc-50 border-zinc-200 text-zinc-500' : 'bg-zinc-950/40 border-white/5 text-zinc-400'
                                                  }`}>
                                                    <span className="text-sm font-medium normal-case tracking-normal block mb-2">
                                                      No code patch generated yet.
                                                    </span>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveTab('targets');
                                                      }}
                                                      className={`text-sm font-medium underline underline-offset-4 ${
                                                        isWhite ? 'text-[#082a36] hover:text-blue-600' : 'text-white hover:text-blue-400'
                                                      }`}
                                                    >
                                                      Go to AI Targets to Generate
                                                    </button>
                                                  </div>
                                                );
                                              }

                                              return (
                                                <div className={`rounded-xl border overflow-hidden ${
                                                  isWhite ? 'border-zinc-200 bg-zinc-50' : 'border-white/10 bg-[#0a0a0a]'
                                                }`}>
                                                  <div className={`px-4 py-2 flex items-center justify-between border-b ${
                                                    isWhite ? 'bg-zinc-100 border-zinc-200' : 'bg-white/5 border-white/10'
                                                  }`}>
                                                    <span className="text-[10px] font-mono font-medium tracking-widest uppercase text-zinc-500">
                                                      HTML Header Patch
                                                    </span>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopyToClipboard(patch, "Code Patch", setSuccessMsg);
                                                      }}
                                                      className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors"
                                                    >
                                                      Copy Patch
                                                    </button>
                                                  </div>
                                                  <pre className={`p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${
                                                    isWhite ? 'text-[#082a36]' : 'text-emerald-400'
                                                  }`}>
                                                    {patch}
                                                  </pre>
                                                </div>
                                              );
                                            })()}
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

    </div>
  );
}
