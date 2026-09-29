import React, { useState, useEffect, useRef } from 'react';
import { 
  PenTool, 
  Sparkles, 
  Send, 
  BookOpen, 
  CheckCircle, 
  RefreshCw, 
  Sliders, 
  BrainCircuit, 
  ExternalLink, 
  Lightbulb, 
  FileText, 
  Upload,
  Calendar,
  Layers,
  Award,
  Check,
  AlertCircle,
  Eye,
  Clock,
  Link2,
  Save
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import AiCommanderChat from '../components/AiCommanderChat';
import { computeWordDiff } from '../utils/diffUtils';

interface CalendarTopic {
  id: string;
  month: string;
  topic: string;
  focusKeyword: string;
  targetUrl: string;
  notes: string;
  reviewStatus: 'PENDING_REVIEW' | 'REVIEWED' | 'PUBLISHED';
  generatedDraftId?: string | null;
}

interface DraftItem {
  id: string;
  clientId: string;
  topic: string;
  title: string;
  generatedAt: string;
  originalAiContent: string;
  currentContent: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  modelUsed: string;
  reviewStatus?: 'PENDING_REVIEW' | 'REVIEWED' | 'PUBLISHED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export default function AiBlogStudio() {
  const { theme } = useTheme();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  
  // Navigation Tabs: 'studio' | 'calendar' | 'pending' | 'reviewed'
  const [activeTab, setActiveTab] = useState<'studio' | 'calendar' | 'pending' | 'reviewed'>('studio');

  // Brand Voice State
  const [brandProfile, setBrandProfile] = useState<any>({
    brandName: '',
    industry: '',
    targetLocation: '',
    toneOfVoice: '',
    targetAudience: '',
    forbiddenWords: '',
    keySellingPoints: ''
  });
  const [learnedRules, setLearnedRules] = useState<string[]>([]);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Calendar State & CSV Upload
  const [calendarTopics, setCalendarTopics] = useState<CalendarTopic[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Drafts Management State
  const [draftsList, setDraftsList] = useState<DraftItem[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Active Draft in Studio Editor
  const [activeDraft, setActiveDraft] = useState<DraftItem | null>(null);
  const activeDraftIdRef = useRef<string | null>(null);
  const [topic, setTopic] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [blogLength, setBlogLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [customNotes, setCustomNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  // Diff Highlighter & Human Feedback
  const [showDiffView, setShowDiffView] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState<'visual' | 'code'>('visual');
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const [writerFeedbackNotes, setWriterFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'publish'>('draft');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Auto-Save State
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize visualEditorRef innerHTML ONLY when a different draft is loaded
  useEffect(() => {
    if (activeDraft && visualEditorRef.current) {
      if (activeDraftIdRef.current !== activeDraft.id) {
        visualEditorRef.current.innerHTML = activeDraft.currentContent || '';
        activeDraftIdRef.current = activeDraft.id;
      } else if (!visualEditorRef.current.innerHTML && activeDraft.currentContent) {
        visualEditorRef.current.innerHTML = activeDraft.currentContent;
      }
    }
  }, [activeDraft?.id, editorViewMode]);

  // Debounced Auto-Save for Draft Title & Body
  useEffect(() => {
    if (!activeDraft || !selectedClientId) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaving(true);
        const res = await fetch('/api/blog-studio/drafts/update-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClientId,
            draftId: activeDraft.id,
            title: activeDraft.title,
            writerEdits: activeDraft.currentContent,
            writerName: 'Content Writer'
          })
        });
        if (res.ok) {
          const now = new Date();
          setLastSavedTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (err) {
        console.warn('Auto-save failed:', err);
      } finally {
        setAutoSaving(false);
      }
    }, 1200);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [activeDraft?.title, activeDraft?.currentContent, selectedClientId]);

  // 1. Fetch Clients
  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, short_code, api_import_enabled')
      .order('name')
      .then(({ data }) => {
        const active = (data || []).filter(c => c.api_import_enabled !== false);
        setClients(active);
        if (active.length > 0) setSelectedClientId(active[0].id);
      });
  }, []);

  // 2. Fetch Client Brand Profile, Calendar, and Drafts
  const loadClientData = async (cId: string) => {
    if (!cId) return;
    try {
      // Profile & Rules
      const resProf = await fetch(`/api/blog-studio/profile?clientId=${cId}`);
      const dataProf = await resProf.json();
      if (dataProf.profile) setBrandProfile(dataProf.profile);
      if (dataProf.learnedRules) setLearnedRules(dataProf.learnedRules);

      // Calendar
      setLoadingCalendar(true);
      const resCal = await fetch(`/api/blog-studio/calendar?clientId=${cId}`);
      const dataCal = await resCal.json();
      setCalendarTopics(dataCal.calendar || []);
      setLoadingCalendar(false);

      // Drafts
      setLoadingDrafts(true);
      const resDrafts = await fetch(`/api/blog-studio/drafts?clientId=${cId}`);
      const dataDrafts = await resDrafts.json();
      const loadedDrafts = dataDrafts.drafts || [];
      setDraftsList(loadedDrafts);
      if (loadedDrafts.length > 0) {
        setActiveDraft(prev => prev && prev.clientId === cId ? prev : loadedDrafts[0]);
      }
      setLoadingDrafts(false);
    } catch (e) {
      console.error('Failed to load client blog studio data:', e);
      setLoadingCalendar(false);
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      loadClientData(selectedClientId);
      setActiveDraft(null);
    }
  }, [selectedClientId]);

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const calendarFileInputRef = useRef<HTMLInputElement>(null);

  // Handle CSV/Excel Text File Selection
  const handleCalendarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
      }
    };
    reader.readAsText(file);
  };

  // Handle CSV Upload
  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setUploadingCsv(true);
    try {
      const res = await fetch('/api/blog-studio/calendar/upload-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          csvContent: csvText,
          overwrite: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload CSV');

      setCalendarTopics(data.calendar || []);
      setNotification({ type: 'success', message: data.message });
      setShowCsvModal(false);
      setCsvText('');
      setCsvFile(null);
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setUploadingCsv(false);
    }
  };

  // Generate Blog from form or calendar topic
  const handleGenerateBlog = async (targetTopic: string, targetKw: string, targetNotes: string = '') => {
    setGenerating(true);
    setNotification(null);
    setActiveTab('studio');

    try {
      const res = await fetch('/api/blog-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          topic: targetTopic,
          focusKeyword: targetKw || targetTopic,
          length: blogLength,
          customInstructions: targetNotes || customNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate blog');

      const d = data.draft;
      const newDraftItem: DraftItem = {
        id: d.id,
        clientId: selectedClientId,
        topic: d.topic,
        title: d.title,
        generatedAt: d.generatedAt,
        originalAiContent: d.originalAiContent,
        currentContent: d.currentContent,
        metaTitle: d.metaTitle,
        metaDescription: d.metaDescription,
        focusKeyword: d.focusKeyword,
        modelUsed: d.modelUsed,
        reviewStatus: 'PENDING_REVIEW'
      };

      setActiveDraft(newDraftItem);
      setDraftsList(prev => [newDraftItem, ...prev]);

      setNotification({
        type: 'success',
        message: `Blog drafted using ${data.learnedRulesCount} learned rules! Review in Editor below.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // Human Feedback & Mark as Reviewed
  const handleDistillFeedbackAndApprove = async () => {
    if (!activeDraft) return;
    setSubmittingFeedback(true);
    try {
      // 1. Submit feedback to extract rules
      const res = await fetch('/api/blog-studio/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          draftId: activeDraft.id,
          originalContent: activeDraft.originalAiContent,
          editedContent: activeDraft.currentContent,
          writerNotes: writerFeedbackNotes
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Feedback distillation failed');

      if (data.allRules) {
        setLearnedRules(data.allRules);
      }

      // 2. Mark draft as REVIEWED
      await fetch('/api/blog-studio/drafts/update-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          draftId: activeDraft.id,
          status: 'REVIEWED',
          writerEdits: activeDraft.currentContent,
          writerName: 'Content Writer'
        })
      });

      // Update local state
      setActiveDraft({ ...activeDraft, reviewStatus: 'REVIEWED' });
      setDraftsList(prev => prev.map(d => d.id === activeDraft.id ? { ...d, reviewStatus: 'REVIEWED' } : d));

      setNotification({
        type: 'success',
        message: `Marked as REVIEWED! AI learned ${data.newRules?.length || 1} new rules permanently.`
      });
      setWriterFeedbackNotes('');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // Push to WordPress
  const handlePublishToWordPress = async () => {
    if (!activeDraft) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/blog-studio/publish-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          title: activeDraft.title,
          content: activeDraft.currentContent,
          status: publishStatus,
          metaTitle: activeDraft.metaTitle,
          metaDescription: activeDraft.metaDescription,
          focusKeyword: activeDraft.focusKeyword,
          tags: [activeDraft.focusKeyword]
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish to WordPress');

      setNotification({
        type: 'success',
        message: `Dispatched to WordPress as "${publishStatus.toUpperCase()}"! Post ID: ${data.wpPostId}`
      });
    } catch (e: any) {
      setNotification({ type: 'error', message: e.message });
    } finally {
      setPublishing(false);
    }
  };

  const pendingDrafts = draftsList.filter(d => !d.reviewStatus || d.reviewStatus === 'PENDING_REVIEW');
  const reviewedDrafts = draftsList.filter(d => d.reviewStatus === 'REVIEWED' || d.reviewStatus === 'PUBLISHED');
  const currentClient = clients.find(c => c.id === selectedClientId);

  return (
    <div className={`p-8 space-y-8 ${theme === 'white' ? 'bg-[#f8fafc] text-slate-800' : 'text-zinc-100'}`}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 rounded-2xl text-white shadow-lg shadow-blue-500/20">
              <PenTool size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                AI Blog Studio & Editorial Calendar
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold uppercase tracking-widest flex items-center gap-1">
                  <BrainCircuit size={12} /> Writer Portal Ready
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Month-by-month calendar scheduling, CSV topic uploads, smart internal link generation & color-coded writer review diffs.
              </p>
            </div>
          </div>
        </div>

        {/* Client Selector & Brand Voice Settings Button */}
        <div className="flex items-center gap-3">
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs outline-none border transition-all ${
              theme === 'white' 
                ? 'bg-white border-zinc-200 text-zinc-800 shadow-sm' 
                : 'bg-zinc-900 border-white/10 text-white'
            }`}
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.short_code})</option>
            ))}
          </select>

          <button
            onClick={() => setShowProfileDrawer(true)}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all ${
              theme === 'white' ? 'bg-white hover:bg-zinc-50 border-zinc-200 shadow-sm' : 'bg-zinc-900 hover:bg-zinc-800 border-white/10'
            }`}
          >
            <Sliders size={14} className="text-blue-400" />
            Brand Voice ({learnedRules.length} Rules)
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'studio'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Sparkles size={14} />
            Blog Studio Editor
          </button>

          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Calendar size={14} />
            Editorial Calendar ({calendarTopics.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Clock size={14} />
            Pending Review ({pendingDrafts.length})
          </button>

          <button
            onClick={() => setActiveTab('reviewed')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'reviewed'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <CheckCircle size={14} />
            Reviewed & Approved ({reviewedDrafts.length})
          </button>
        </div>

        {activeTab === 'calendar' && (
          <button
            onClick={() => setShowCsvModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
          >
            <Upload size={13} />
            Upload CSV Calendar
          </button>
        )}
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between border animate-in fade-in duration-300 ${
          notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
      )}

      {/* TAB 1: STUDIO EDITOR VIEW */}
      {activeTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form: Topic Generator */}
          <div className="lg:col-span-4 space-y-6">
            <div className={`p-6 rounded-3xl border space-y-5 ${
              theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
            }`}>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Sparkles size={16} className="text-blue-400" />
                Draft Article with Interlinks
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">Topic / Working Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Timber Decking Maintenance in Sydney Winter"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs outline-none font-medium ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">Target Focus Keyword</label>
                  <input
                    type="text"
                    placeholder="e.g. deck maintenance sydney"
                    value={focusKeyword}
                    onChange={(e) => setFocusKeyword(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs outline-none font-mono ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/10 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">Article Word Count</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['short', 'medium', 'long'] as const).map((len) => (
                      <button
                        key={len}
                        type="button"
                        onClick={() => setBlogLength(len)}
                        className={`py-2 rounded-xl text-xs font-bold capitalize transition-all border ${
                          blogLength === len
                            ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                            : theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-600' : 'bg-zinc-950 border-white/5 text-zinc-400'
                        }`}
                      >
                        {len} ({len === 'short' ? '700w' : len === 'medium' ? '1000w' : '1500w'})
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">Custom Directives / Target Suburbs</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Highlight Northern Beaches moisture, link to repairs page"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs outline-none font-medium ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-white/10 text-white'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateBlog(topic, focusKeyword, customNotes)}
                  disabled={generating || !topic.trim()}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-xs hover:brightness-110 shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 tracking-wider uppercase"
                >
                  {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {generating ? 'Drafting Article with AI...' : 'Generate Blog Post'}
                </button>
              </div>
            </div>

            {/* Recent Drafts List */}
            {draftsList.length > 0 && (
              <div className={`p-6 rounded-3xl border space-y-3 ${
                theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <FileText size={14} className="text-blue-400" />
                    Recent Drafts ({draftsList.length})
                  </h3>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {draftsList.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setActiveDraft(d);
                        setShowDiffView(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex flex-col gap-0.5 ${
                        activeDraft?.id === d.id
                          ? 'bg-blue-600/10 border-blue-500 text-blue-400'
                          : 'bg-zinc-950/40 border-white/5 text-zinc-300 hover:bg-zinc-800/40'
                      }`}
                    >
                      <span className="font-bold truncate">{d.title || d.topic}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {d.reviewStatus || 'PENDING_REVIEW'} • {new Date(d.generatedAt).toLocaleDateString()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Learned Memory */}
            <div className={`p-6 rounded-3xl border space-y-3 ${
              theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <BrainCircuit size={14} className="text-emerald-400" />
                  Learned Writing Memory ({learnedRules.length})
                </h3>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {learnedRules.map((rule, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-zinc-950/40 border border-white/5 text-[11px] text-zinc-300 flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Editor & Diff View */}
          <div className="lg:col-span-8 space-y-6">
            {activeDraft ? (
              <div className={`p-6 rounded-3xl border space-y-6 ${
                theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
              }`}>
                {/* Header Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                      activeDraft.reviewStatus === 'REVIEWED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {activeDraft.reviewStatus || 'PENDING_REVIEW'}
                    </span>
                    <button
                      onClick={() => {
                        let latestHtml = activeDraft.currentContent;
                        if (!showDiffView && editorViewMode === 'visual' && visualEditorRef.current) {
                          latestHtml = visualEditorRef.current.innerHTML;
                          setActiveDraft(prev => prev ? { ...prev, currentContent: latestHtml } : null);
                        }
                        setShowDiffView(!showDiffView);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                        showDiffView
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-zinc-800 text-zinc-300 border-white/10 hover:bg-zinc-700'
                      }`}
                    >
                      {showDiffView ? 'Show Full Editor' : '🎨 Compare Edits (Color Diff)'}
                    </button>

                    {/* Auto-Save Indicator */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 border border-white/5 text-[11px] font-medium text-zinc-400">
                      {autoSaving ? (
                        <>
                          <RefreshCw size={11} className="animate-spin text-amber-400" />
                          <span className="text-amber-400 font-semibold">Auto-saving...</span>
                        </>
                      ) : lastSavedTime ? (
                        <>
                          <Save size={11} className="text-emerald-400" />
                          <span className="text-zinc-300">Saved <span className="text-[10px] text-zinc-500 font-mono">{lastSavedTime}</span></span>
                        </>
                      ) : (
                        <>
                          <Save size={11} className="text-zinc-500" />
                          <span className="text-zinc-500">Auto-save on</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={publishStatus}
                      onChange={(e: any) => setPublishStatus(e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-bold text-white border border-white/10 outline-none"
                    >
                      <option value="draft">WP Draft</option>
                      <option value="publish">WP Publish</option>
                    </select>
                    <button
                      onClick={handlePublishToWordPress}
                      disabled={publishing}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {publishing ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                      {publishing ? 'Pushing...' : 'Push to Site'}
                    </button>
                  </div>
                </div>

                {/* Article Post Title (H1) Header Input */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950/80 border-white/10'
                }`}>
                  <label className="text-[11px] font-black uppercase tracking-wider text-blue-400 block mb-1.5 flex items-center gap-1.5">
                    <PenTool size={13} />
                    <span>Article Title (H1 Heading)</span>
                  </label>
                  <input
                    type="text"
                    value={activeDraft.title || ''}
                    onChange={(e) => setActiveDraft({ ...activeDraft, title: e.target.value })}
                    placeholder="e.g. 10 Essential Veterinary Accounting Tips in Australia"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold outline-none transition-all ${
                      theme === 'white'
                        ? 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500'
                        : 'bg-zinc-900 border-white/10 text-white focus:border-blue-500'
                    }`}
                  />
                </div>

                {/* Rank Math SEO Bar */}
                <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/5 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                    <Award size={13} /> Rank Math SEO Metadata
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-zinc-500 block">SEO Title:</span>
                      <p className="text-zinc-300 font-semibold truncate">{activeDraft.metaTitle}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Meta Description:</span>
                      <p className="text-zinc-300 line-clamp-1">{activeDraft.metaDescription}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-500 block">Focus Keyword:</span>
                      <p className="text-emerald-400 font-mono">{activeDraft.focusKeyword}</p>
                    </div>
                  </div>
                </div>

                {/* Diff View OR Normal Editor */}
                {showDiffView ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-zinc-400 flex items-center gap-3">
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 font-semibold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                          Removed by Writer
                        </span>
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                          Added / Edited by Writer
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-medium">✨ Word-by-Word Visual Inspection</span>
                    </div>

                    {/* Word-by-Word Tracked Changes Box */}
                    <div className={`p-5 rounded-2xl border text-sm leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap font-sans transition-colors ${
                      theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-950/80 border-white/10 text-zinc-200'
                    }`}>
                      {(() => {
                        const origTitle = (activeDraft as any).originalTitle || activeDraft.title || '';
                        const origWithTitle = (origTitle ? '<h1>' + origTitle + '</h1>' : '') + (activeDraft.originalAiContent || '');
                        const currBody = activeDraft.currentContent || '';
                        const currWithTitle = (activeDraft.title ? '<h1>' + activeDraft.title + '</h1>' : '') + currBody;
                        const diffParts = computeWordDiff(origWithTitle, currWithTitle);
                        const hasDifferences = diffParts.some(p => p.type === 'added' || p.type === 'removed');

                        if (!hasDifferences) {
                          return (
                            <div className="py-12 text-center space-y-2">
                              <span className="text-2xl">✨</span>
                              <p className="text-xs font-bold text-zinc-400">No edits detected compared to original AI draft yet.</p>
                              <p className="text-[11px] text-zinc-500">Switch back to "Show Full Editor" and type or delete words to see tracked changes highlighted here.</p>
                            </div>
                          );
                        }

                        return diffParts.map((part, idx) => {
                          const isHeading1 = /(^|\n)#\s+[^\n#]/.test(part.value);
                          const isHeading2 = /(^|\n)##\s+/.test(part.value);
                          const isHeading3 = /(^|\n)###\s+/.test(part.value);
                          const cleanHeadingText = (str: string) => str.replace(/^[\s\n]*#+\s*/, '').trim();
                          
                          if (part.type === 'removed') {
                            return (
                              <del 
                                key={idx} 
                                className={`bg-rose-500/20 text-rose-600 dark:text-rose-300 line-through rounded px-1 py-0.5 mx-0.5 font-medium border border-rose-500/30 ${
                                  isHeading1 ? 'text-xl font-black block mt-6 mb-3' : isHeading2 ? 'text-base font-black block mt-4 mb-2' : isHeading3 ? 'text-sm font-bold block mt-3 mb-1' : ''
                                }`}
                              >
                                {isHeading1 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/30 mr-1.5 no-underline inline-block">H1</span>}
                                {isHeading2 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/30 mr-1.5 no-underline inline-block">H2</span>}
                                {isHeading3 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-rose-500/30 mr-1.5 no-underline inline-block">H3</span>}
                                {cleanHeadingText(part.value)}
                              </del>
                            );
                          } else if (part.type === 'added') {
                            return (
                              <ins 
                                key={idx} 
                                className={`bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 no-underline font-bold rounded px-1 py-0.5 mx-0.5 border border-emerald-500/30 ${
                                  isHeading1 ? 'text-xl font-black block mt-6 mb-3' : isHeading2 ? 'text-base font-black block mt-4 mb-2' : isHeading3 ? 'text-sm font-bold block mt-3 mb-1' : ''
                                }`}
                              >
                                {isHeading1 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/30 mr-1.5 inline-block">H1</span>}
                                {isHeading2 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/30 mr-1.5 inline-block">H2</span>}
                                {isHeading3 && <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/30 mr-1.5 inline-block">H3</span>}
                                {cleanHeadingText(part.value)}
                              </ins>
                            );
                          }
                          
                          if (isHeading2) {
                            return (
                              <div key={idx} className={`text-base font-black mt-5 mb-2 flex items-center gap-1.5 border-b pb-1 ${
                                theme === 'white' ? 'text-zinc-900 border-zinc-200' : 'text-white border-white/5'
                              }`}>
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 font-bold">H2</span>
                                <span>{cleanHeadingText(part.value)}</span>
                              </div>
                            );
                          }
                          if (isHeading3) {
                            return (
                              <div key={idx} className={`text-sm font-bold mt-3 mb-1 flex items-center gap-1.5 ${
                                theme === 'white' ? 'text-emerald-700' : 'text-emerald-400'
                              }`}>
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold">H3</span>
                                <span>{cleanHeadingText(part.value)}</span>
                              </div>
                            );
                          }
                          if (isHeading1) {
                            return (
                              <div key={idx} className={`text-xl font-black mt-6 mb-3 flex items-center gap-2 border-b-2 pb-2 ${
                                theme === 'white' ? 'text-zinc-900 border-zinc-300' : 'text-white border-white/10'
                              }`}>
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500 font-bold">H1</span>
                                <span>{cleanHeadingText(part.value)}</span>
                              </div>
                            );
                          }
                          return <span key={idx}>{part.value}</span>;
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="font-bold flex items-center gap-1.5 text-zinc-200">
                          <BookOpen size={14} className="text-blue-400" />
                          Article Content
                        </span>
                        {/* Toggle between Rich Visual Editor and Raw HTML Code */}
                        <div className="flex items-center rounded-xl bg-zinc-900 border border-white/10 p-0.5 ml-2">
                          <button
                            type="button"
                            onClick={() => setEditorViewMode('visual')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              editorViewMode === 'visual'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            ✨ Visual Editor (Formatted)
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditorViewMode('code')}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              editorViewMode === 'code'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            &lt;/&gt; HTML Code
                          </button>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        ~{activeDraft.currentContent.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>

                    {editorViewMode === 'visual' ? (
                      /* Rich Formatted Interactive Editor */
                      <div
                        ref={visualEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                          const html = e.currentTarget.innerHTML;
                          setActiveDraft(prev => prev ? { ...prev, currentContent: html } : null);
                        }}
                        onBlur={(e) => {
                          const html = e.currentTarget.innerHTML;
                          setActiveDraft(prev => prev ? { ...prev, currentContent: html } : null);
                        }}
                        className={`w-full min-h-[420px] max-h-[600px] overflow-y-auto p-6 rounded-2xl border text-sm leading-relaxed outline-none transition-all shadow-inner font-sans ${
                          theme === 'white' 
                            ? 'bg-white border-zinc-200 text-zinc-900 focus:border-blue-500 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-zinc-900 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-zinc-900 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:mb-4 [&_p]:text-zinc-700 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_li]:mb-1 [&_strong]:font-bold' 
                            : 'bg-zinc-950 border-white/10 text-zinc-100 focus:border-blue-500 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-white [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-white [&_h2]:mt-6 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-emerald-400 [&_h3]:mt-4 [&_h3]:mb-1 [&_p]:mb-4 [&_p]:text-zinc-300 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_li]:mb-1 [&_strong]:text-white'
                        }`}
                      />
                    ) : (
                      /* Raw HTML Code Editor */
                      <textarea
                        rows={16}
                        value={activeDraft.currentContent}
                        onChange={(e) => setActiveDraft({ ...activeDraft, currentContent: e.target.value })}
                        className={`w-full p-4 rounded-2xl border text-xs outline-none font-mono leading-relaxed transition-all ${
                          theme === 'white' ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-950 border-white/10 text-zinc-200 focus:border-blue-500'
                        }`}
                      />
                    )}
                  </div>
                )}

                {/* Human Feedback & Mark as Reviewed */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/20 via-indigo-950/20 to-emerald-950/20 border border-blue-500/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Lightbulb size={15} /> Writer Approval & Adaptive Learning
                    </h4>
                    <span className="text-[10px] text-zinc-400 font-mono">Diff-Driven Feedback</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Finished editing? Clicking <strong>"Approve & Teach AI"</strong> will analyze your changes, update the AI's permanent style rules for this client, and mark this article as <strong>REVIEWED</strong>.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Optional notes: (e.g. Cut long intro, used active voice)"
                      value={writerFeedbackNotes}
                      onChange={(e) => setWriterFeedbackNotes(e.target.value)}
                      className="flex-1 p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-xs text-white outline-none focus:border-blue-400"
                    />
                    <button
                      onClick={handleDistillFeedbackAndApprove}
                      disabled={submittingFeedback}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 transition-all"
                    >
                      {submittingFeedback ? <RefreshCw size={13} className="animate-spin" /> : <BrainCircuit size={14} />}
                      {submittingFeedback ? 'Teaching AI...' : 'Approve & Teach AI'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`p-16 rounded-3xl border text-center space-y-4 ${
                theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/30 border-white/5'
              }`}>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20">
                  <PenTool size={26} />
                </div>
                <h3 className="font-bold text-sm text-zinc-300">Ready to Draft or Review Articles</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Generate a new blog on the left or select a topic from the <strong>Editorial Calendar</strong> or <strong>Pending Review</strong> tabs.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: EDITORIAL CALENDAR & CSV VIEW */}
      {activeTab === 'calendar' && (
        <div className={`p-6 rounded-3xl border space-y-5 ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-200">
                Month-by-Month Blog Editorial Calendar
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Client topics, target keywords & scheduled publishing periods. Click "Generate Draft" to trigger AI writing with interlinks.
              </p>
            </div>
            <button
              onClick={() => setShowCsvModal(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Upload size={14} /> Upload CSV Schedule
            </button>
          </div>

          {calendarTopics.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs space-y-3">
              <Calendar size={28} className="mx-auto text-zinc-600" />
              <p>No calendar topics scheduled for {currentClient?.name || 'this client'}.</p>
              <button
                onClick={() => setShowCsvModal(true)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
              >
                Upload CSV Calendar Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Period</th>
                    <th className="p-3">Topic & Focus</th>
                    <th className="p-3">Target Keyword</th>
                    <th className="p-3">Target URL</th>
                    <th className="p-3">Review Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {calendarTopics.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/20">
                      <td className="p-3 font-bold text-blue-400 whitespace-nowrap">{item.month}</td>
                      <td className="p-3 font-medium text-zinc-200">{item.topic}</td>
                      <td className="p-3 font-mono text-zinc-400">{item.focusKeyword || '-'}</td>
                      <td className="p-3 text-zinc-500 truncate max-w-xs">{item.targetUrl || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.reviewStatus === 'REVIEWED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {item.reviewStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setTopic(item.topic);
                            setFocusKeyword(item.focusKeyword);
                            setCustomNotes(`Internal Link target: ${item.targetUrl || ''}`);
                            handleGenerateBlog(item.topic, item.focusKeyword, `Target URL to link: ${item.targetUrl}`);
                          }}
                          disabled={generating}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1 shadow-md ml-auto"
                        >
                          <Sparkles size={12} />
                          Generate Draft
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING REVIEW (WRITER INBOX) */}
      {activeTab === 'pending' && (
        <div className={`p-6 rounded-3xl border space-y-4 ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <Clock size={16} /> Articles Awaiting Human Writer Review ({pendingDrafts.length})
            </h2>
          </div>

          {pendingDrafts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">
              🎉 No pending reviews! All articles are reviewed and approved.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {pendingDrafts.map((draft) => (
                <div key={draft.id} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-xs text-zinc-200">{draft.title || draft.topic}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 font-mono">
                      <span>KW: {draft.focusKeyword}</span>
                      <span>Generated: {new Date(draft.generatedAt).toLocaleDateString()}</span>
                      <span className="text-amber-400">Needs Review</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDraft(draft);
                      setActiveTab('studio');
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Eye size={13} /> Review & Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REVIEWED & APPROVED */}
      {activeTab === 'reviewed' && (
        <div className={`p-6 rounded-3xl border space-y-4 ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/60 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <CheckCircle size={16} /> Reviewed & Approved Articles ({reviewedDrafts.length})
            </h2>
          </div>

          {reviewedDrafts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">
              No reviewed articles yet.
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {reviewedDrafts.map((draft) => (
                <div key={draft.id} className="py-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-xs text-zinc-200">{draft.title || draft.topic}</h3>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1 font-mono">
                      <span>KW: {draft.focusKeyword}</span>
                      <span className="text-emerald-400 font-semibold">Reviewed & AI Style Updated</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveDraft(draft);
                      setActiveTab('studio');
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Eye size={13} /> View in Studio
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSV Calendar Upload Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-3xl border p-6 space-y-5 shadow-2xl ${
            theme === 'white' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Upload size={16} className="text-emerald-400" />
                Upload CSV Blog Content Calendar
              </h3>
              <button onClick={() => setShowCsvModal(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste CSV text or upload a <code className="text-emerald-400 font-mono text-[11px]">.csv</code> file:
              </p>
              <input
                type="file"
                ref={calendarFileInputRef}
                onChange={handleCalendarFileSelect}
                accept=".csv,.txt"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => calendarFileInputRef.current?.click()}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  theme === 'white'
                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/10'
                }`}
              >
                <Upload size={12} />
                <span>{csvFile ? `File: ${csvFile.name}` : 'Choose File (.csv)'}</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={`Month, Topic, Focus Keyword, Target URL, Notes\nMonth 1, 5 Signs Your Deck Needs Repair, timber deck repair sydney, https://site.com/services/decking, Link to services page\nMonth 1, How to Oil Merbau Decking, merbau deck oiling sydney, https://site.com/maintenance, Mention weather conditions\nMonth 2, Best Decking Materials for Coastal Homes, coastal decking materials, https://site.com/materials, Salt spray tips`}
              className={`w-full p-3.5 rounded-2xl border text-xs font-mono outline-none leading-relaxed ${
                theme === 'white'
                  ? 'bg-zinc-50 border-zinc-200 text-zinc-800 placeholder-zinc-400'
                  : 'bg-zinc-900 border-white/10 text-zinc-200 placeholder-zinc-600'
              }`}
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowCsvModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCsvUpload}
                disabled={uploadingCsv || !csvText.trim()}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {uploadingCsv ? 'Processing CSV...' : 'Import Calendar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand Voice Drawer */}
      {showProfileDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-xl rounded-3xl border p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh] ${
            theme === 'white' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Sliders size={16} className="text-blue-400" />
                Client Brand Voice & Guidelines
              </h3>
              <button onClick={() => setShowProfileDrawer(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-zinc-400 block mb-1">Brand Name</label>
                <input
                  type="text"
                  value={brandProfile.brandName || ''}
                  onChange={(e) => setBrandProfile({ ...brandProfile, brandName: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-400 block mb-1">Target Location / Suburbs</label>
                <input
                  type="text"
                  value={brandProfile.targetLocation || ''}
                  onChange={(e) => setBrandProfile({ ...brandProfile, targetLocation: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-400 block mb-1">Tone of Voice Persona</label>
                <textarea
                  rows={2}
                  value={brandProfile.toneOfVoice || ''}
                  onChange={(e) => setBrandProfile({ ...brandProfile, toneOfVoice: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-zinc-400 block mb-1">Forbidden Clichés & Robotic AI Words</label>
                <input
                  type="text"
                  value={brandProfile.forbiddenWords || ''}
                  onChange={(e) => setBrandProfile({ ...brandProfile, forbiddenWords: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white outline-none font-mono"
                  placeholder="delve, tapestry, in a nutshell, paramount"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowProfileDrawer(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Interactive MCP Commander Chat */}
      <AiCommanderChat 
        clientId={selectedClientId} 
        clientName={currentClient?.name} 
      />
    </div>
  );
}
