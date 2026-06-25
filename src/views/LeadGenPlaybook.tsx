import { useState, useEffect } from 'react';
import React from 'react';
import { 
  BrainCircuit, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  TrendingUp, 
  ArrowRight, 
  CornerDownRight,
  ExternalLink,
  Code,
  FileText,
  Link,
  ShieldAlert,
  Zap,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Layers,
  Activity,
  CheckSquare,
  Download
} from 'lucide-react';
import { getClients, Client } from '../services/dataService';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';
import ClientSelector from '../components/ClientSelector';

export interface CroDirective {
  title: string;
  priority: 'High' | 'Medium' | 'Low';
  targetUrl: string;
  actionDescription: string;
  expectedOutcome: string;
}

export interface KeywordOpportunity {
  keyword: string;
  currentPosition: number;
  currentCtr: number;
  tier: string;
  recommendation: string;
}

export interface ContentGapOpportunity {
  keyword: string;
  monthlyImpressions: number;
  issue: string;
  recommendation: string;
}

export interface TrustSignalsPlaybook {
  reviews: string;
  accreditations: string;
  socialProof: string;
}

export interface RoadmapItem {
  week: number;
  focus: string;
  tasks: string[];
}

export interface PlaybookResult {
  quickWinSummary: string;
  leadQualityFlag: {
    flagged: boolean;
    formFillToLeadRatio: number;
    recommendation: string;
  };
  leadFunnelAnalysis: string;
  expectedLeadIncrease: string;
  croDirectives: CroDirective[];
  commercialKeywordOpportunities: KeywordOpportunity[];
  contentGapOpportunities: ContentGapOpportunity[];
  trustSignalsPlaybook: TrustSignalsPlaybook;
  implementationRoadmap: RoadmapItem[];
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
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.6);
  } catch (e) {
    console.warn("Audio context blocked:", e);
  }
};

export default function LeadGenPlaybook() {
  const { theme } = useTheme();
  const isWhite = theme === 'white';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'claude' | 'gpt'>('gemini');
  const [simulate, setSimulate] = useState(true);
  const [runTechnicalCrawl, setRunTechnicalCrawl] = useState(true);

  // GSC defaults
  const today = new Date();
  const past2Days = new Date(today);
  past2Days.setDate(today.getDate() - 2);
  const past8Days = new Date(today);
  past8Days.setDate(today.getDate() - 8);

  const [startDate, setStartDate] = useState(past8Days.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(past2Days.toISOString().split('T')[0]);

  // Loading & Outputs
  const [loading, setLoading] = useState(false);
  const [loadingPhraseIndex, setLoadingPhraseIndex] = useState(0);
  const [playbook, setPlaybook] = useState<PlaybookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // History Sidebar
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadingPhrases = [
    'Checking database credentials...',
    'Loading conversion configurations...',
    'Analyzing Google Analytics lead quality (total fills vs verified)...',
    'Auditing sitemap crawl diagnostics for trust triggers...',
    'Prioritizing high-intent page one keyword quick-wins...',
    'Mapping friction points and above-the-fold blockers...',
    'Generating 4-week structured implementation roadmap...',
    'Synthesising Australian/British CRO copywriting guides...'
  ];

  const fetchHistory = async (clientId: string) => {
    if (!clientId) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('ai_lead_playbooks')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setHistoryList(data);
      } else {
        setHistoryList([]);
      }
    } catch (err) {
      console.warn('History table fetch issue:', err);
      setHistoryList([]);
    } finally {
      setLoadingHistory(false);
    }
  };

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
      setPlaybook(null);
      setError(null);
    }
  }, [selectedClientId]);

  // Loading Phrase Interval Loop
  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingPhraseIndex((prev) => (prev + 1) % loadingPhrases.length);
      }, 3500);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setError(null);
    setPlaybook(null);
    setLoadingPhraseIndex(0);

    try {
      const response = await fetch('/api/ai/lead-playbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          model: selectedModel,
          startDate,
          endDate,
          simulate,
          runTechnicalCrawl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }

      const data = await response.json();
      setPlaybook(data);
      playSuccessChime();
      setSuccessMsg('Lead Generation Playbook generated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      fetchHistory(selectedClientId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during generation.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistory = (historyItem: any) => {
    try {
      const resultData = typeof historyItem.playbook_data === 'string'
        ? JSON.parse(historyItem.playbook_data)
        : historyItem.playbook_data;
      
      setPlaybook(resultData);
      setStartDate(historyItem.start_date);
      setEndDate(historyItem.end_date);
      setSelectedModel(historyItem.model);
      setError(null);
    } catch (e) {
      console.error('Failed to parse historical results:', e);
      setError('Failed to load historical record data.');
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this historical playbook entry?')) return;
    try {
      const { error: delErr } = await supabase
        .from('ai_lead_playbooks')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      
      setSuccessMsg('Record deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchHistory(selectedClientId);
      
      if (playbook) {
        setPlaybook(null);
      }
    } catch (err: any) {
      alert('Failed to delete history record: ' + err.message);
    }
  };

  const exportToHtml = () => {
    if (!playbook) return;

    const clientName = clients.find(c => c.id === selectedClientId)?.name || 'Client';

    const leadQualityHtml = playbook.leadQualityFlag ? `
    <div class="alert-card ${playbook.leadQualityFlag.flagged ? 'alert-warning' : 'alert-success'}">
      <strong>${playbook.leadQualityFlag.flagged ? 'Lead Quality Warning Flagged' : 'Lead Quality Verified'}</strong> (Form-to-Lead Ratio: ${((playbook.leadQualityFlag.formFillToLeadRatio || 0) * 100).toFixed(1)}%)
      <p style="margin: 8px 0 0 0;">${playbook.leadQualityFlag.recommendation || ''}</p>
    </div>
    ` : '';

    const croDirectivesHtml = (playbook.croDirectives || []).map(d => `
      <div class="directive-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span class="priority-badge priority-${d.priority}">${d.priority} Priority</span>
          <span style="font-size: 0.8rem; color: #64748b;">Target URL: ${d.targetUrl}</span>
        </div>
        <h4 style="margin: 0 0 10px 0; font-size: 1.1rem;">${d.title}</h4>
        <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #475569;">${d.actionDescription}</p>
        <div class="outcome">Outcome: ${d.expectedOutcome}</div>
      </div>
    `).join('');

    const keywordsHtml = (playbook.commercialKeywordOpportunities || []).map(k => `
      <tr>
        <td><strong>${k.keyword}</strong></td>
        <td>#${k.currentPosition ? k.currentPosition.toFixed(1) : '0.0'}</td>
        <td>${k.currentCtr ? k.currentCtr.toFixed(2) : '0.00'}%</td>
        <td>${k.tier}</td>
        <td style="color: #475569;">${k.recommendation}</td>
      </tr>
    `).join('');

    const contentGapsHtml = (playbook.contentGapOpportunities || []).map(g => `
      <tr>
        <td><strong>${g.keyword}</strong></td>
        <td>${g.monthlyImpressions}</td>
        <td>${g.issue}</td>
        <td style="color: #475569;">${g.recommendation}</td>
      </tr>
    `).join('');

    const trustHtml = playbook.trustSignalsPlaybook ? `
    <div class="section">
      <h2>Trust Signals Playbook</h2>
      <div class="grid grid-3">
        <div class="card">
          <h3 style="color: #10b981;">Reviews & Ratings</h3>
          <p style="font-size: 0.9rem; color: #475569;">${playbook.trustSignalsPlaybook.reviews || ''}</p>
        </div>
        <div class="card">
          <h3 style="color: #10b981;">Credentials & Badges</h3>
          <p style="font-size: 0.9rem; color: #475569;">${playbook.trustSignalsPlaybook.accreditations || ''}</p>
        </div>
        <div class="card">
          <h3 style="color: #10b981;">Social Proof Placement</h3>
          <p style="font-size: 0.9rem; color: #475569;">${playbook.trustSignalsPlaybook.socialProof || ''}</p>
        </div>
      </div>
    </div>
    ` : '';

    const roadmapHtml = (playbook.implementationRoadmap || []).map(r => `
      <div class="roadmap-card">
        <div class="week">W${r.week}</div>
        <h4 style="margin: 0 0 10px 0; font-size: 0.9rem; text-transform: uppercase; color: #0f172a;">${r.focus}</h4>
        <ul>
          ${(r.tasks || []).map(t => `<li>${t}</li>`).join('')}
        </ul>
      </div>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lead Generation & Conversion Playbook - ${clientName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f8fafc;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }
    h1 {
      font-size: 2.25rem;
      color: #0f172a;
      margin-top: 0;
      margin-bottom: 5px;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 15px;
    }
    .subtitle {
      font-size: 1rem;
      color: #64748b;
      margin-bottom: 30px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .section {
      margin-bottom: 35px;
    }
    h2 {
      font-size: 1.5rem;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .summary-card {
      background: #0f172a;
      color: #f1f5f9;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    .summary-card h3 {
      margin-top: 0;
      color: #34d399;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }
    .alert-card {
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 30px;
      border: 1px solid;
    }
    .alert-warning {
      background: #fffbeb;
      border-color: #fde68a;
      color: #78350f;
    }
    .alert-success {
      background: #f0fdf4;
      border-color: #bbf7d0;
      color: #166534;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
      margin-bottom: 30px;
    }
    @media (min-width: 768px) {
      .grid {
        grid-template-columns: 1fr 1fr;
      }
      .grid-3 {
        grid-template-columns: 1fr 1fr 1fr;
      }
      .grid-4 {
        grid-template-columns: 1fr 1fr 1fr 1fr;
      }
    }
    .card {
      background: #f8fafc;
      padding: 20px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .card h3 {
      margin-top: 0;
      font-size: 0.85rem;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
    }
    .directive-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 15px;
    }
    .priority-badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: bold;
      padding: 3px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    .priority-High { background: #fee2e2; color: #991b1b; }
    .priority-Medium { background: #fef3c7; color: #92400e; }
    .priority-Low { background: #dbeafe; color: #1e40af; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background-color: #f1f5f9;
      color: #475569;
      font-size: 0.8rem;
      text-transform: uppercase;
    }
    .roadmap-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
    }
    .roadmap-card .week {
      font-size: 1.5rem;
      font-weight: bold;
      color: #10b981;
      margin-bottom: 10px;
    }
    .roadmap-card ul {
      padding-left: 20px;
      margin: 0;
    }
    .roadmap-card li {
      margin-bottom: 8px;
      font-size: 0.875rem;
    }
    .outcome {
      margin-top: 10px;
      font-weight: bold;
      color: #10b981;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Lead Generation & Conversion Playbook</h1>
    <div class="subtitle">Client: ${clientName} | Date Range: ${startDate} to ${endDate}</div>
    
    <div class="summary-card">
      <h3>Executive Quick Win Summary</h3>
      <p>${playbook.quickWinSummary || ''}</p>
    </div>

    ${leadQualityHtml}

    <div class="grid">
      <div class="card">
        <h3>Lead Funnel Bottlenecks</h3>
        <p style="font-size: 0.9rem; white-space: pre-line;">${playbook.leadFunnelAnalysis || ''}</p>
      </div>
      <div class="card">
        <h3>Expected Impact Projections</h3>
        <p style="font-size: 0.9rem;">${playbook.expectedLeadIncrease || ''}</p>
      </div>
    </div>

    ${croDirectivesHtml ? `
    <div class="section">
      <h2>CRO Conversion Directives</h2>
      <div>
        ${croDirectivesHtml}
      </div>
    </div>
    ` : ''}

    ${keywordsHtml ? `
    <div class="section">
      <h2>Commercial Keyword Opportunities</h2>
      <table>
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Position</th>
            <th>CTR</th>
            <th>Tier</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${keywordsHtml}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${contentGapsHtml ? `
    <div class="section">
      <h2>Content Gap Opportunities</h2>
      <table>
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Impressions</th>
            <th>Issue</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${contentGapsHtml}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${trustHtml}

    ${roadmapHtml ? `
    <div class="section">
      <h2>4-Week Implementation Roadmap</h2>
      <div class="grid grid-4">
        ${roadmapHtml}
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lead-playbook-${clientName.toLowerCase().replace(/\s+/g, '-')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isWhite ? 'bg-[#76c9be]/10 text-[#76c9be]' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <BrainCircuit size={24} />
            </div>
            <h1 className={`text-3xl font-black uppercase italic tracking-tighter ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
              Lead Playbook
            </h1>
          </div>
          <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest pl-10 font-medium">
            AI conversion optimization & quality audit
          </p>
        </div>
      </div>

      {/* Main Grid Config/Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Controls Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className={`p-6 rounded-[28px] border shadow-md flex flex-col gap-5 ${
            isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
          }`}>
            <h3 className={`text-base font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
              Audit Configurations
            </h3>

            {/* Client Select */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Target Client</label>
              <ClientSelector
                clients={clients}
                selectedId={selectedClientId}
                onSelect={setSelectedClientId}
              />
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Start Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-semibold outline-none focus:border-emerald-500 transition-all ${
                      isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">End Date</label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-semibold outline-none focus:border-emerald-500 transition-all ${
                      isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Simulated Toggle */}
            <div className="flex items-center justify-between py-2 border-y border-white/5">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-400">Simulation Mode</span>
                <span className="text-[10px] text-zinc-500">Enable to test with sandbox data</span>
              </div>
              <button
                onClick={() => setSimulate(!simulate)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  simulate ? 'bg-emerald-500' : 'bg-zinc-800'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  simulate ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Run Crawler Check */}
            <div className="flex items-center justify-between py-2 border-b border-white/5">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-400">Scan Sitemap</span>
                <span className="text-[10px] text-zinc-500">Run technical CRO crawl checks</span>
              </div>
              <button
                onClick={() => setRunTechnicalCrawl(!runTechnicalCrawl)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  runTechnicalCrawl ? 'bg-emerald-500' : 'bg-zinc-800'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  runTechnicalCrawl ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Model select */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">LLM Model Engine</label>
              <select
                value={selectedModel}
                onChange={(e: any) => setSelectedModel(e.target.value)}
                className={`w-full p-4 rounded-xl border text-sm font-semibold focus:border-emerald-500 outline-none transition-all ${
                  isWhite ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-white'
                }`}
              >
                <option value="gemini">Gemini 2.5 Flash (Recommended)</option>
                <option value="claude">Claude 3.5 Sonnet</option>
                <option value="gpt">GPT-4o Mini</option>
              </select>
            </div>

            {/* Action button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !selectedClientId}
              className={`w-full py-4 mt-2 ${
                isWhite ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
              } text-white rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50`}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Generating Playbook...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  Analyze Lead Potential
                </>
              )}
            </button>
          </div>

          {/* Past History panel */}
          <div className={`p-6 rounded-[28px] border shadow-md flex flex-col gap-4 max-h-[400px] overflow-hidden ${
            isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
          }`}>
            <h4 className={`text-sm font-black uppercase tracking-wider flex items-center gap-2 ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
              <Clock size={16} /> Saved Playbooks ({historyList.length})
            </h4>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {loadingHistory ? (
                <div className="text-zinc-500 text-xs py-6 text-center">Loading cache history...</div>
              ) : historyList.length === 0 ? (
                <div className="text-zinc-500 text-xs py-6 text-center">No previous playbooks cached for this client.</div>
              ) : (
                historyList.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => handleLoadHistory(h)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between group ${
                      isWhite 
                        ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-[#082a36]' 
                        : 'bg-zinc-900/40 hover:bg-zinc-900 border-white/5 text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-xs uppercase tracking-wider truncate">
                        {h.start_date} to {h.end_date}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        Generated via {h.model} • {new Date(h.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteHistory(h.id, e)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Display Playbook Column */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Success or Error alerts */}
          {error && (
            <div className="p-5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold rounded-2xl flex items-start gap-3 uppercase tracking-tighter">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold rounded-xl flex items-center gap-3">
              <CheckCircle2 size={18} className="shrink-0" />
              <div>{successMsg}</div>
            </div>
          )}

          {/* Loading Animation Card */}
          {loading && (
            <div className={`p-16 rounded-[40px] border shadow-2xl flex flex-col items-center justify-center text-center gap-6 min-h-[450px] ${
              isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
            }`}>
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin" />
                <Sparkles className="absolute text-emerald-400 animate-pulse" size={24} />
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className={`text-lg font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                  Generating Strategic Playbook
                </h3>
                <p className="text-zinc-500 text-sm font-medium animate-pulse">
                  {loadingPhrases[loadingPhraseIndex]}
                </p>
              </div>
            </div>
          )}

          {/* Empty Prompt State */}
          {!loading && !playbook && !error && (
            <div className={`p-16 rounded-[40px] border border-dashed flex flex-col items-center justify-center text-center gap-4 min-h-[450px] ${
              isWhite ? 'bg-zinc-50 border-zinc-300' : 'bg-zinc-950/20 border-white/10'
            }`}>
              <BrainCircuit className="text-zinc-600 animate-pulse" size={48} />
              <div className="space-y-1">
                <h3 className="text-zinc-400 font-bold uppercase tracking-wider">No Playbook Selected</h3>
                <p className="text-zinc-500 text-sm max-w-sm">
                  Choose a target client and click "Analyze Lead Potential" or load a saved report from the history list.
                </p>
              </div>
            </div>
          )}

          {/* Playbook Report View */}
          {!loading && playbook && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
              
              {/* Executive Summary Card */}
              <div className={`p-8 rounded-[40px] border shadow-lg flex flex-col gap-4 relative overflow-hidden ${
                isWhite 
                  ? 'bg-zinc-900 border-zinc-900 text-white' 
                  : 'bg-zinc-950 border-white/5 shadow-[0_0_100px_rgba(16,185,129,0.03)]'
              }`}>
                <div className="absolute right-0 top-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-emerald-400" size={18} />
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                      Executive Quick Win Summary
                    </h3>
                  </div>
                  <button
                    onClick={exportToHtml}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Download size={14} /> Export HTML
                  </button>
                </div>
                <p className="text-base font-medium leading-relaxed text-zinc-100">
                  {playbook?.quickWinSummary}
                </p>
              </div>

              {/* Lead Quality & Ratio Alert Card */}
              {playbook?.leadQualityFlag && (
                <div className={`p-6 rounded-[28px] border ${
                  playbook.leadQualityFlag.flagged
                    ? (isWhite ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-amber-950/20 border-amber-500/30 text-amber-300')
                    : (isWhite ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300')
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      playbook.leadQualityFlag.flagged ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {playbook.leadQualityFlag.flagged ? <ShieldAlert size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <span className="font-black text-sm uppercase tracking-wider">
                          {playbook.leadQualityFlag.flagged ? "Lead Quality Warning flagged" : "Lead Quality Verified"}
                        </span>
                        <span className="text-xs font-black uppercase tracking-widest px-3 py-1 bg-black/10 rounded-full">
                          Form-to-Lead Ratio: {((playbook.leadQualityFlag.formFillToLeadRatio || 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-normal">
                        {playbook.leadQualityFlag.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lead Funnel and Projections Card Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Funnel Audit */}
                <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col gap-3 ${
                  isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                }`}>
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                    <Layers size={14} /> Lead Funnel Bottlenecks
                  </span>
                  <p className="text-sm leading-relaxed text-zinc-400 font-medium whitespace-pre-line">
                    {playbook?.leadFunnelAnalysis}
                  </p>
                </div>

                {/* Growth Projections */}
                <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col gap-3 relative overflow-hidden ${
                  isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                }`}>
                  <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl" />
                  <span className="text-xs font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                    <Activity size={14} /> Expected Impact Projections
                  </span>
                  <p className="text-sm leading-relaxed text-zinc-400 font-medium">
                    {playbook?.expectedLeadIncrease}
                  </p>
                </div>
              </div>

              {/* CRO Conversion Directives Accordion */}
              {playbook?.croDirectives && playbook.croDirectives.length > 0 && (
                <div className="space-y-4">
                  <h3 className={`text-lg font-black uppercase tracking-wider flex items-center gap-2 ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                    <CheckSquare size={18} /> CRO Conversion Directives ({playbook.croDirectives.length})
                  </h3>
                  <div className="space-y-3">
                    {playbook.croDirectives.map((d, index) => (
                      <div
                        key={index}
                        className={`p-6 rounded-[28px] border flex flex-col gap-3 transition-all ${
                          isWhite ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-white/5'
                        }`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider ${
                              d.priority === 'High' 
                                ? 'bg-red-500/10 text-red-500' 
                                : d.priority === 'Medium' 
                                  ? 'bg-amber-500/10 text-amber-500' 
                                  : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {d.priority} Priority
                            </span>
                            <span className="text-xs font-semibold text-zinc-500 underline truncate max-w-xs md:max-w-sm">
                              {d.targetUrl}
                            </span>
                          </div>
                        </div>

                        <h4 className={`text-base font-bold tracking-tight ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                          {d.title}
                        </h4>

                        <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                          {d.actionDescription}
                        </p>

                        <div className="mt-2 pt-3 border-t border-white/5 flex items-center gap-2 text-xs font-bold text-emerald-400">
                          <Zap size={12} className="shrink-0 animate-pulse" />
                          <span>Outcome: {d.expectedOutcome}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commercial Keyword Table */}
              {playbook?.commercialKeywordOpportunities && playbook.commercialKeywordOpportunities.length > 0 && (
                <div className={`rounded-[32px] border shadow-sm overflow-hidden ${
                  isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                }`}>
                  <div className="p-6 border-b border-white/5 flex items-center gap-2">
                    <TrendingUp className="text-emerald-400" size={16} />
                    <h3 className={`text-sm font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                      Commercial Keyword Opportunities
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className={`border-b ${isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-white/5'}`}>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500">Keyword</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500 text-center">Pos</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500 text-center">CTR</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500 text-center font-black">Tier</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500">On-Page Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {playbook.commercialKeywordOpportunities.map((k, idx) => (
                          <tr key={idx} className={`group transition-colors ${isWhite ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                            <td className={`px-6 py-4 font-bold ${isWhite ? 'text-zinc-900' : 'text-white'}`}>{k.keyword}</td>
                            <td className="px-6 py-4 text-center font-semibold text-zinc-400">#{k.currentPosition ? k.currentPosition.toFixed(1) : '0.0'}</td>
                            <td className="px-6 py-4 text-center font-semibold text-zinc-400">{k.currentCtr ? k.currentCtr.toFixed(2) : '0.00'}%</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                k.tier && k.tier.includes('Quick-win') 
                                  ? 'bg-emerald-500/10 text-emerald-400' 
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {k.tier}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-zinc-400 leading-relaxed font-medium">{k.recommendation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Content Gap Opportunities Table */}
              {playbook?.contentGapOpportunities && playbook.contentGapOpportunities.length > 0 && (
                <div className={`rounded-[32px] border shadow-sm overflow-hidden ${
                  isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                }`}>
                  <div className="p-6 border-b border-white/5 flex items-center gap-2">
                    <Layers className="text-emerald-400" size={16} />
                    <h3 className={`text-sm font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                      Content Gap Opportunities
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className={`border-b ${isWhite ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/40 border-white/5'}`}>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500">Keyword</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500 text-center">Monthly Impressions</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500">Issue</th>
                          <th className="px-6 py-4 font-black uppercase tracking-wider text-xs text-zinc-500">Page Type Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {playbook.contentGapOpportunities.map((g, idx) => (
                          <tr key={idx} className={`group transition-colors ${isWhite ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                            <td className={`px-6 py-4 font-bold ${isWhite ? 'text-zinc-900' : 'text-white'}`}>{g.keyword}</td>
                            <td className="px-6 py-4 text-center font-semibold text-zinc-400">{g.monthlyImpressions}</td>
                            <td className="px-6 py-4 text-zinc-400 font-medium">{g.issue}</td>
                            <td className="px-6 py-4 text-zinc-400 leading-relaxed font-medium">{g.recommendation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Trust Signals Playbook Card Grid */}
              {playbook?.trustSignalsPlaybook && (
                <div className="space-y-4">
                  <h3 className={`text-lg font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                    Trust Signals Playbook
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Reviews Card */}
                    <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col gap-2 ${
                      isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                    }`}>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Reviews & Ratings</span>
                      <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        {playbook.trustSignalsPlaybook.reviews}
                      </p>
                    </div>

                    {/* Accreditations */}
                    <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col gap-2 ${
                      isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                    }`}>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Credentials & Badges</span>
                      <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        {playbook.trustSignalsPlaybook.accreditations}
                      </p>
                    </div>

                    {/* Social Proof */}
                    <div className={`p-6 rounded-[28px] border shadow-sm flex flex-col gap-2 ${
                      isWhite ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-white/5'
                    }`}>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Social Proof Placement</span>
                      <p className="text-sm text-zinc-400 leading-relaxed font-medium">
                        {playbook.trustSignalsPlaybook.socialProof}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Implementation Roadmap Phased Task List */}
              {playbook?.implementationRoadmap && playbook.implementationRoadmap.length > 0 && (
                <div className="space-y-4">
                  <h3 className={`text-lg font-black uppercase tracking-wider ${isWhite ? 'text-[#082a36]' : 'text-white'}`}>
                    4-Week Implementation Roadmap
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {playbook.implementationRoadmap.map((r) => (
                      <div
                        key={r.week}
                        className={`p-6 rounded-[28px] border flex flex-col gap-3 ${
                          isWhite ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-black italic text-emerald-500">W{r.week}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-white/5 px-2.5 py-0.5 rounded-full">
                            Week {r.week}
                          </span>
                        </div>
                        
                        <h4 className={`text-sm font-black uppercase tracking-wider ${isWhite ? 'text-zinc-900' : 'text-white'}`}>
                          {r.focus}
                        </h4>

                        <ul className="space-y-2 mt-2 flex-1">
                          {r.tasks && r.tasks.map((t, idx) => (
                            <li key={idx} className="flex gap-2 text-xs text-zinc-400 leading-relaxed font-medium items-start">
                              <CornerDownRight size={12} className="shrink-0 mt-0.5 text-emerald-500" />
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
