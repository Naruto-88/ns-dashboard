import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare, 
  Send, 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  ExternalLink, 
  Target, 
  Phone, 
  MousePointerClick, 
  Calendar, 
  ShieldAlert, 
  Zap, 
  User, 
  Check, 
  Search,
  Sliders,
  Award,
  Clock
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';
import { format } from 'date-fns';

interface StrategicActionItem {
  id: string;
  action: string;
  why: string;
  who: string;
  priority: 'Must-Do' | 'Secondary' | 'Backlog';
  status: 'Pending' | 'In-Progress' | 'Completed';
}

interface TeamFeedbackEntry {
  id: string;
  userName: string;
  userRole: string;
  agreement: 'AGREE' | 'DISAGREE' | 'NEUTRAL';
  comment: string;
  createdAt: string;
}

interface ClientStrategicReview {
  id: string;
  clientId: string;
  clientName: string;
  shortCode: string;
  projectOwner: string;
  projectOwnerCode: string;
  siteUrl: string;
  periodStart: string;
  periodEnd: string;
  clicks: number;
  phones: number;
  leadsActual: number;
  leadsTarget: number;
  drActual: number;
  siteReality: string;
  conversionGaps: string;
  actionsFortnight: StrategicActionItem[];
  actionsNext: StrategicActionItem[];
  actionsLater: StrategicActionItem[];
  teamFeedback: TeamFeedbackEntry[];
  overallStatus: 'PENDING_REVIEW' | 'AGREED' | 'HAS_OBJECTIONS' | 'IN_PROGRESS';
  generatedByModel: string;
  lastGeneratedAt: string | null;
}

export default function StrategicReviewHub() {
  const { theme } = useTheme();
  const [reviews, setReviews] = useState<ClientStrategicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<'default' | 'claude' | 'gpt' | 'gemini'>('gemini');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOwner, setFilterOwner] = useState('all');
  const [selectedClient, setSelectedClient] = useState<ClientStrategicReview | null>(null);
  
  // Feedback comment form state
  const [commentText, setCommentText] = useState('');
  const [commenterName, setCommenterName] = useState('Melaka');
  const [agreementType, setAgreementType] = useState<'AGREE' | 'DISAGREE'>('AGREE');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/strategic-reviews/all');
      const data = await res.json();
      if (data.success) {
        setReviews(data.data || []);
        if (!selectedClient && data.data?.length > 0) {
          setSelectedClient(data.data[0]);
        } else if (selectedClient) {
          const updated = data.data.find((r: any) => r.clientId === selectedClient.clientId);
          if (updated) setSelectedClient(updated);
        }
      }
    } catch (err: any) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleGenerateReview = async (clientId: string) => {
    setGeneratingId(clientId);
    setToastMsg('Synthesizing metrics, site health & generating executive actions...');
    try {
      const res = await fetch(`/api/strategic-reviews/generate/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: activeModel })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReviews(prev => prev.map(r => r.clientId === clientId ? data.data : r));
        if (selectedClient?.clientId === clientId) {
          setSelectedClient(data.data);
        }
        setToastMsg(`Strategic Review generated successfully via ${data.data.generatedByModel}!`);
        setTimeout(() => setToastMsg(null), 4000);
      } else {
        alert('Synthesis failed: ' + (data.error || 'Unknown error'));
        setToastMsg(null);
      }
    } catch (e: any) {
      alert('Network error: ' + e.message);
      setToastMsg(null);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleSaveFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!commentText.trim()) {
      alert('Please enter your comment or objection reasoning.');
      return;
    }

    setSubmittingFeedback(true);
    try {
      const res = await fetch('/api/strategic-reviews/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.clientId,
          userName: commenterName,
          userRole: 'Reviewer',
          agreement: agreementType,
          comment: commentText.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updated = {
          ...selectedClient,
          teamFeedback: data.feedback,
          overallStatus: data.overallStatus
        };
        setSelectedClient(updated);
        setReviews(prev => prev.map(r => r.clientId === selectedClient.clientId ? updated : r));
        setCommentText('');
        setToastMsg('Your feedback & agreement status has been saved!');
        setTimeout(() => setToastMsg(null), 3000);
      } else {
        alert('Failed to save feedback: ' + (data.error || 'Server error'));
      }
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const owners = Array.from(new Set(reviews.map(r => r.projectOwner))).filter(Boolean);

  const filteredReviews = reviews.filter(r => {
    const matchesSearch = r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          r.shortCode.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filterOwner !== 'all' && r.projectOwner !== filterOwner) return false;
    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header bar */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 md:p-6 rounded-[32px] border relative z-20 ${
        theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5 backdrop-blur-2xl'
      }`}>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
            theme === 'white' ? 'bg-[#76c9be] shadow-[#76c9be]/20' : 'bg-purple-600 shadow-purple-600/20'
          }`}>
            <Compass className="text-white" size={20} />
          </div>
          <div>
            <h2 className={`text-2xl font-bold font-heading tracking-tight italic ${
              theme === 'white' ? 'text-[#082a36]' : 'text-white'
            }`}>
              Weekly Strategic Review & Action Hub
            </h2>
            <p className="text-zinc-500 text-xs font-medium mt-0.5">
              CEO & Team Alignment: Brutally Honest Site Reality, Conversion Gaps, Action-Why-Who & Sign-offs
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* AI Model Selector */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${
            theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-zinc-300'
          }`}>
            <Sparkles size={13} className="text-amber-500" />
            <span className="text-zinc-500">AI Engine:</span>
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value as any)}
              className="bg-transparent border-none outline-none font-bold cursor-pointer"
            >
              <option value="default" className="bg-zinc-900 text-white">Default (From Settings)</option>
              <option value="claude" className="bg-zinc-900 text-white">Anthropic Claude</option>
              <option value="gpt" className="bg-zinc-900 text-white">OpenAI ChatGPT</option>
              <option value="gemini" className="bg-zinc-900 text-white">Google Gemini</option>
            </select>
          </div>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/80 border-white/10'
          }`}>
            <Search size={14} className="text-zinc-400" />
            <input 
              type="text"
              placeholder="Search client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-36"
            />
          </div>

          <select
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border outline-none cursor-pointer ${
              theme === 'white' ? 'bg-white border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-zinc-300'
            }`}
          >
            <option value="all">All Owners</option>
            {owners.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <Sparkles size={16} className="animate-spin text-purple-400" />
          {toastMsg}
        </div>
      )}

      {/* Master 2-Column Strategic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Client Strategic Roster (4 cols) */}
        <div className={`lg:col-span-4 rounded-3xl border shadow-xl p-4 overflow-hidden flex flex-col ${
          theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="p-3 border-b border-white/5 flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Client Roster ({filteredReviews.length})</span>
            <span className="text-[11px] text-zinc-500">Pick client to review</span>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-1">
            {filteredReviews.map((r) => {
              const isSelected = selectedClient?.clientId === r.clientId;
              const hasObjections = r.overallStatus === 'HAS_OBJECTIONS';
              const isAgreed = r.overallStatus === 'AGREED';

              return (
                <div
                  key={r.clientId}
                  onClick={() => setSelectedClient(r)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? theme === 'white' 
                        ? 'bg-[#082a36] text-white border-[#082a36] shadow-lg' 
                        : 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/20'
                      : theme === 'white'
                        ? 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-900'
                        : 'bg-zinc-950/60 hover:bg-zinc-800/80 border-white/5 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected 
                        ? 'bg-white/20 text-white' 
                        : theme === 'white' ? 'bg-[#76c9be]/20 text-[#082a36]' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {r.shortCode}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs truncate">{r.clientName}</span>
                      </div>
                      <span className={`text-[10px] block ${isSelected ? 'text-white/70' : 'text-zinc-500'}`}>
                        Owner: {r.projectOwner} &bull; Target: {r.leadsTarget} leads
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {hasObjections ? (
                      <span className="w-2 h-2 rounded-full bg-rose-500" title="Has Objections" />
                    ) : isAgreed ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" title="Team Agreed" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Pending Review" />
                    )}
                    <ChevronRight size={14} className={isSelected ? 'text-white' : 'text-zinc-600'} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Client Strategic Brief & Team Alignment Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedClient ? (
            <>
              {/* Client Performance & Action Brief Card */}
              <div className={`rounded-3xl border shadow-xl p-6 md:p-8 backdrop-blur-xl relative overflow-hidden ${
                theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
              }`}>
                {/* Top Brief Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-2xl font-black font-heading tracking-tight ${
                        theme === 'white' ? 'text-[#082a36]' : 'text-white'
                      }`}>
                        {selectedClient.clientName} ({selectedClient.shortCode})
                      </h3>
                      {selectedClient.siteUrl && (
                        <a 
                          href={selectedClient.siteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      Project Lead: <strong>{selectedClient.projectOwner} ({selectedClient.projectOwnerCode})</strong> &bull; Review Engine: <strong>{selectedClient.generatedByModel}</strong>
                    </p>
                  </div>

                  {/* Generate / Re-generate Button */}
                  <button
                    onClick={() => handleGenerateReview(selectedClient.clientId)}
                    disabled={generatingId === selectedClient.clientId}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                      theme === 'white'
                        ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-110 shadow-purple-600/20'
                    }`}
                  >
                    <RefreshCw size={13} className={generatingId === selectedClient.clientId ? 'animate-spin' : ''} />
                    {generatingId === selectedClient.clientId ? 'Synthesizing...' : 'Generate Strategic Review'}
                  </button>
                </div>

                {/* Scoreboard Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-6 border-b border-white/5">
                  <div className={`p-4 rounded-2xl border ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/70 border-white/5'
                  }`}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                      <Target size={11} className="text-emerald-500" /> Legit Leads
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className={`text-xl font-bold ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {selectedClient.leadsActual}
                      </span>
                      <span className="text-xs text-zinc-500">/ {selectedClient.leadsTarget} target</span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/70 border-white/5'
                  }`}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                      <Phone size={11} className="text-blue-500" /> Phone Calls
                    </span>
                    <div className="mt-1">
                      <span className={`text-xl font-bold ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {selectedClient.phones}
                      </span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/70 border-white/5'
                  }`}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                      <MousePointerClick size={11} className="text-purple-500" /> Clicks
                    </span>
                    <div className="mt-1">
                      <span className={`text-xl font-bold ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {selectedClient.clicks}
                      </span>
                    </div>
                  </div>

                  <div className={`p-4 rounded-2xl border ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/70 border-white/5'
                  }`}>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                      <Award size={11} className="text-amber-500" /> Ahrefs DR
                    </span>
                    <div className="mt-1">
                      <span className={`text-xl font-bold ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                        {selectedClient.drActual}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Site Reality (The Technical Truth) */}
                <div className="pt-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                    <ShieldAlert size={14} /> 1. Site Reality (Verified Live Facts)
                  </h4>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-950/80 border-white/5 text-zinc-300'
                  }`}>
                    {selectedClient.siteReality}
                  </div>
                </div>

                {/* Section 2: Conversion Gaps */}
                <div className="pt-6 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <AlertCircle size={14} /> 2. Conversion Gaps & Blockers
                  </h4>
                  <div className={`p-4 rounded-2xl text-xs leading-relaxed border ${
                    theme === 'white' ? 'bg-rose-50/50 border-rose-100 text-rose-900' : 'bg-rose-500/5 border-rose-500/10 text-rose-200'
                  }`}>
                    {selectedClient.conversionGaps}
                  </div>
                </div>

                {/* Section 3: Action Horizon (Action — Why — Who) */}
                <div className="pt-8 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Zap size={14} /> 3. Executive Action Horizon (Action &bull; Why &bull; Who)
                  </h4>

                  {/* Fortnightly Must-dos */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-tight block">
                      ⚡ This Fortnight (Must-Do Execution)
                    </span>
                    {selectedClient.actionsFortnight && selectedClient.actionsFortnight.length > 0 ? (
                      selectedClient.actionsFortnight.map((act, idx) => (
                        <div 
                          key={act.id || idx}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            theme === 'white' ? 'bg-emerald-50/40 border-emerald-100' : 'bg-emerald-500/5 border-emerald-500/15'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <p className={`font-semibold ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>
                              {act.action}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              <span className="font-semibold text-zinc-400">Why:</span> {act.why}
                            </p>
                          </div>
                          <div className="shrink-0">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Assignee: {act.who}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No fortnightly actions recorded yet. Click Generate Review above.</p>
                    )}
                  </div>

                  {/* Next Horizon */}
                  {selectedClient.actionsNext && selectedClient.actionsNext.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-[11px] font-bold text-blue-400 uppercase tracking-tight block">
                        🗓️ Next Horizon (Follow-up Tasks)
                      </span>
                      {selectedClient.actionsNext.map((act, idx) => (
                        <div 
                          key={act.id || idx}
                          className={`p-3.5 rounded-xl border text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            theme === 'white' ? 'bg-blue-50/40 border-blue-100' : 'bg-blue-500/5 border-blue-500/15'
                          }`}
                        >
                          <div className="space-y-1 flex-1">
                            <p className={`font-semibold ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>{act.action}</p>
                            <p className="text-[11px] text-zinc-500"><span className="font-semibold text-zinc-400">Why:</span> {act.why}</p>
                          </div>
                          <div className="shrink-0">
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              Assignee: {act.who}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* CEO & Team Alignment Box (Agree / Disagree & Comments) */}
              <div className={`rounded-3xl border shadow-xl p-6 md:p-8 backdrop-blur-xl ${
                theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
              }`}>
                <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6">
                  <div>
                    <h4 className={`text-lg font-bold font-heading flex items-center gap-2 ${
                      theme === 'white' ? 'text-[#082a36]' : 'text-white'
                    }`}>
                      <MessageSquare size={18} className="text-blue-500" />
                      Team Alignment & Sign-Off Comments
                    </h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Review analysis & actions: Mark Agree or Disagree and write any pushbacks/objections below.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedClient.overallStatus === 'AGREED' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={12} /> Team Agreed
                      </span>
                    ) : selectedClient.overallStatus === 'HAS_OBJECTIONS' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <XCircle size={12} /> Objections Raised
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Clock size={12} /> Pending Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Comment Submission Form */}
                <form onSubmit={handleSaveFeedback} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-400">Reviewer:</span>
                      <select
                        value={commenterName}
                        onChange={(e) => setCommenterName(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none ${
                          theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-[#082a36]' : 'bg-zinc-950 border-white/10 text-white'
                        }`}
                      >
                        <option value="Dinesh (CEO)">Dinesh (CEO)</option>
                        <option value="Max (Strategy)">Max (Strategy)</option>
                        <option value="Melaka">Melaka</option>
                        <option value="Amit">Amit</option>
                        <option value="Sai">Sai</option>
                        <option value="Shihab (Dev)">Shihab (Dev)</option>
                      </select>
                    </div>

                    {/* Agreement Toggle Buttons */}
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => setAgreementType('AGREE')}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          agreementType === 'AGREE'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                            : 'bg-zinc-800/40 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        <ThumbsUp size={12} /> I Agree
                      </button>

                      <button
                        type="button"
                        onClick={() => setAgreementType('DISAGREE')}
                        className={`px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          agreementType === 'DISAGREE'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-zinc-800/40 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        <ThumbsDown size={12} /> I Disagree / Modify
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      rows={3}
                      placeholder={agreementType === 'AGREE' ? "Add any internal comments or sign-off notes..." : "Explain exactly what you disagree with and what the reality on the ground is..."}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className={`w-full p-4 rounded-2xl text-xs border outline-none focus:border-blue-500 transition-all ${
                        theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-white/10 text-white'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={submittingFeedback}
                      className={`absolute right-3 bottom-3 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 ${
                        theme === 'white' ? 'bg-[#082a36] text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                      }`}
                    >
                      <Send size={12} className={submittingFeedback ? 'animate-spin' : ''} />
                      {submittingFeedback ? 'Saving...' : 'Post Sign-off'}
                    </button>
                  </div>
                </form>

                {/* Feedback History Stream */}
                <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-tight block">
                    Feedback & Comment History ({selectedClient.teamFeedback?.length || 0})
                  </span>

                  {selectedClient.teamFeedback && selectedClient.teamFeedback.length > 0 ? (
                    <div className="space-y-2.5">
                      {selectedClient.teamFeedback.map((fb) => (
                        <div 
                          key={fb.id}
                          className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                            fb.agreement === 'DISAGREE' 
                              ? 'bg-rose-500/5 border-rose-500/15 text-rose-200'
                              : 'bg-zinc-950/40 border-white/5 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5">
                              {fb.userName} 
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                fb.agreement === 'DISAGREE' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                              }`}>
                                {fb.agreement === 'DISAGREE' ? 'Objected' : 'Agreed'}
                              </span>
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {(() => {
                                try {
                                  return fb.createdAt ? format(new Date(fb.createdAt), 'MMM dd, yyyy HH:mm') : 'Recently';
                                } catch (e) {
                                  return 'Recently';
                                }
                              })()}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-zinc-300 pl-1">{fb.comment}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No feedback entries recorded yet for this client.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-zinc-500 text-sm">
              Please select a client from the left roster to view their Strategic Review.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
