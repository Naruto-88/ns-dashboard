import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  Minimize2, 
  Maximize2,
  Terminal,
  Zap,
  Globe,
  Sliders,
  Trash2,
  Paperclip,
  FileText,
  CheckCheck,
  Upload,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useModalDialog } from '../contexts/ModalDialogContext';

interface MessageAction {
  type: string;
  label: string;
  url: string;
}

export interface BulkProposalItem {
  postId: number;
  postTitle?: string;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  reason?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  modelUsed?: string;
  timestamp: string;
  action?: MessageAction;
  execution?: any;
  bulkProposals?: BulkProposalItem[];
  bulkApplied?: boolean;
}

const DEFAULT_WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `G'day! I am your Mission Control MCP Commander. I can interact directly with client WordPress sites, audit On-Page SEO, check Rank Math tags, and schedule blog articles.\n\nType a command like:\n• "Audit On-Page SEO for this site"\n• "Check missing Rank Math descriptions"\n• "Draft a blog about Sydney timber deck maintenance"`,
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export default function AiCommanderChat({ 
  clientId, 
  clientName 
}: { 
  clientId?: string; 
  clientName?: string;
}) {
  const { theme } = useTheme();
  const modalDialog = useModalDialog();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isBridgeConnected, setIsBridgeConnected] = useState<boolean | null>(null);

  // Storage key per client (or global if no client specified)
  const storageKey = clientId ? `mc_commander_history_${clientId}` : 'mc_commander_history_global';

  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize proposals in cached messages so previously received proposals display cleanly
          return parsed.map((m: any) => {
            if (Array.isArray(m.bulkProposals) && m.bulkProposals.length > 0) {
              const normalized = m.bulkProposals.map((p: any) => {
                const changes = p.changes || {};
                const rawId = p.postId ?? p.post_id ?? p.id ?? changes.postId ?? changes.post_id ?? changes.id;
                const postId = typeof rawId === 'string' ? parseInt(rawId.replace(/[^0-9]/g, ''), 10) : Number(rawId);
                return {
                  postId: postId || 0,
                  postTitle: p.postTitle || p.post_title || p.h1 || changes.postTitle || changes.post_title || changes.h1 || undefined,
                  metaTitle: p.metaTitle || p.meta_title || p.seo_title || p.proposed_seo_title || p.title || changes.metaTitle || changes.meta_title || changes.seo_title || undefined,
                  metaDescription: p.metaDescription || p.meta_description || p.seo_desc || p.description || changes.metaDescription || changes.meta_description || changes.seo_desc || undefined,
                  focusKeyword: p.focusKeyword || p.focus_keyword || p.keyword || changes.focusKeyword || changes.focus_keyword || undefined,
                  reason: p.reason || p.summary || undefined
                };
              }).filter((p: BulkProposalItem) => p.postId > 0);
              return { ...m, bulkProposals: normalized };
            }
            return m;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load chat history from localStorage', e);
    }
    return [DEFAULT_WELCOME_MSG];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [applyingBulk, setApplyingBulk] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  // When clientId changes, load that client's chat history
  useEffect(() => {
    try {
      const key = clientId ? `mc_commander_history_${clientId}` : 'mc_commander_history_global';
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setMessages([DEFAULT_WELCOME_MSG]);
  }, [clientId]);

  // Persist messages whenever they change
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Failed to save chat history to localStorage', e);
    }
  }, [messages, storageKey]);

  const handleClearHistory = async () => {
    const ok = await modalDialog.confirm({
      title: 'Clear Chat History',
      message: 'Are you sure you want to clear this chat history? This cannot be undone.',
      confirmLabel: 'Clear Chat',
      destructive: true,
      type: 'warning'
    });
    if (ok) {
      const reset = [{
        ...DEFAULT_WELCOME_MSG,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }];
      setMessages(reset);
      try {
        localStorage.setItem(storageKey, JSON.stringify(reset));
      } catch {
        // ignore
      }
    }
  };

  // Handle Document File Upload (Text, CSV, Markdown, JSON, etc.)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const uploadPrompt = `I have uploaded an SEO Instructions / Audit document (${file.name}):\n\n"""\n${text.slice(0, 8000)}\n"""\n\nPlease read and parse all SEO updates specified in this document for client: ${clientName || 'current client'}. Detect all post IDs, URLs, proposed Titles, Meta Descriptions, and Focus Keywords. Provide a clear preview list and guide me on applying them safely.`;

      await sendMessageText(uploadPrompt);
    };
    reader.readAsText(file);

    // Reset input value so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle 1-Click Safe Bulk Apply of Document Proposals
  const handleBulkApply = async (messageId: string, proposals: BulkProposalItem[]) => {
    if (!clientId) {
      await modalDialog.alert('Please select an active client first to apply WordPress updates.', {
        title: 'Client Required',
        type: 'warning'
      });
      return;
    }
    const confirmed = await modalDialog.confirm({
      title: 'Push Live to WordPress',
      message: `Are you sure you want to push ${proposals.length} SEO update(s) live to WordPress?\n\nA safety snapshot will be automatically recorded for 100% rollback.`,
      confirmLabel: 'Push Live',
      type: 'confirm'
    });
    if (!confirmed) {
      return;
    }

    setApplyingBulk(true);
    try {
      const res = await fetch('/api/commander/bulk-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          updates: proposals
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Bulk apply failed');
      }

      // Mark message as applied
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, bulkApplied: true };
        }
        return m;
      }));

      // Dispatch custom event so OnPageSeoAutopilot view refreshes its post table immediately
      window.dispatchEvent(new CustomEvent('mc_seo_updated', { detail: { clientId } }));

      // Add confirmation bot message
      setMessages(prev => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Successfully pushed ${data.updatedCount} of ${data.total} updates live to WordPress!**\n\nAll changes are now active on your website and protected with snapshot restore points in **SEO Autopilot**.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: { type: 'NAVIGATE', label: 'View in SEO Autopilot', url: '/on-page-seo' }
        }
      ]);
    } catch (err: any) {
      await modalDialog.alert('Bulk apply error: ' + err.message, {
        title: 'Execution Failed',
        type: 'error'
      });
    } finally {
      setApplyingBulk(false);
    }
  };

  // Check if current selected client actually has the WordPress bridge active
  useEffect(() => {
    if (!clientId) {
      setIsBridgeConnected(false);
      return;
    }
    fetch(`/api/seo-autopilot/posts?clientId=${clientId}&perPage=1`)
      .then(res => res.json())
      .then(data => {
        setIsBridgeConnected(data.success === true);
      })
      .catch(() => {
        setIsBridgeConnected(false);
      });
  }, [clientId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const sendMessageText = async (userText: string) => {
    if (!userText.trim() || loading) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentHistory = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    }));

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/commander/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: userText,
          conversationHistory: currentHistory.slice(-8)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commander communication failed');

      // Detect if the reply contains structured bulk proposals for 1-click execution (only if not already live executed)
      let detectedProposals: BulkProposalItem[] | undefined = undefined;
      if (data.reply && (!data.execution || !data.execution.success)) {
        const jsonMatch = data.reply.match(/```json([\s\S]*?)```/) || data.reply.match(/\{[\s\S]*"proposals"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const raw = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(raw.trim());
            if (Array.isArray(parsed.proposals) && parsed.proposals.length > 0) {
              detectedProposals = parsed.proposals.map((p: any) => {
                const changes = p.changes || {};
                const rawId = p.postId ?? p.post_id ?? p.id ?? changes.postId ?? changes.post_id ?? changes.id;
                const postId = typeof rawId === 'string' ? parseInt(rawId.replace(/[^0-9]/g, ''), 10) : Number(rawId);
                return {
                  postId: postId || 0,
                  postTitle: p.postTitle || p.post_title || p.h1 || changes.postTitle || changes.post_title || changes.h1 || undefined,
                  metaTitle: p.metaTitle || p.meta_title || p.seo_title || p.proposed_seo_title || p.title || changes.metaTitle || changes.meta_title || changes.seo_title || undefined,
                  metaDescription: p.metaDescription || p.meta_description || p.seo_desc || p.description || changes.metaDescription || changes.meta_description || changes.seo_desc || undefined,
                  focusKeyword: p.focusKeyword || p.focus_keyword || p.keyword || changes.focusKeyword || changes.focus_keyword || undefined,
                  reason: p.reason || p.summary || undefined
                };
              }).filter((p: BulkProposalItem) => p.postId > 0);
            }
          } catch {
            // ignore
          }
        }
      }

      if (data.execution && data.execution.success) {
        window.dispatchEvent(new CustomEvent('mc_seo_updated', { detail: { clientId: data.execution.clientId || clientId } }));
      }

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        modelUsed: data.modelUsed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action: data.action || undefined,
        execution: data.execution || undefined,
        bulkProposals: detectedProposals
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Commander Error: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    await sendMessageText(text);
  };

  // Helper to render markdown text nicely without external heavy dependencies
  const renderFormattedMarkdown = (content: string) => {
    let cleanText = (content || '').trim();

    // If text is JSON, nicely convert it to formatted text
    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
      try {
        const obj = JSON.parse(cleanText);
        const parts: string[] = [];
        if (obj.message) parts.push(obj.message);
        if (obj.status && obj.status !== 'success') parts.push(`**Status:** ${obj.status}`);
        if (Array.isArray(obj.details)) {
          parts.push(obj.details.map((d: any) => `• ${d}`).join('\n'));
        }
        if (Array.isArray(obj.capabilities)) {
          parts.push('### 🚀 What I Can Do:');
          parts.push(obj.capabilities.map((c: any) => `• ${c}`).join('\n'));
        }
        const topics = obj.suggested_topics || obj.suggested_blog_topics;
        if (Array.isArray(topics) && topics.length > 0) {
          parts.push('### ✍️ Suggested Blog Topics:');
          topics.forEach((t: any, idx: number) => {
            if (typeof t === 'string') {
              parts.push(`${idx + 1}. **${t}**`);
            } else {
              parts.push(`${idx + 1}. **${t.title || t.topic}**\n${t.description || ''}${t.keywords || t.focus_keyword ? `\n*Keywords:* ${Array.isArray(t.keywords) ? t.keywords.join(', ') : (t.keywords || t.focus_keyword)}` : ''}`);
            }
          });
        }
        if (obj.audit_findings || obj.findings) {
          const findings = obj.audit_findings || obj.findings;
          parts.push('### 🔍 Audit Findings:');
          if (Array.isArray(findings)) {
            parts.push(findings.map((f: any) => `• ${typeof f === 'string' ? f : JSON.stringify(f)}`).join('\n'));
          } else {
            parts.push(String(findings));
          }
        }
        if (obj.recommendation || obj.action_recommendation || obj.recommended_action) {
          parts.push(`**Recommendation:** ${obj.recommendation || obj.action_recommendation || obj.recommended_action}`);
        }
        if (obj.action_needed) parts.push(`**Next Step:** ${obj.action_needed}`);
        if (parts.length > 0) {
          cleanText = parts.join('\n\n');
        }
      } catch {
        // keep as is
      }
    }

    const lines = cleanText.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      // Headers (### or ##)
      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-bold text-sm text-blue-400 mt-2 mb-1">
            {trimmed.replace(/^###\s+/, '')}
          </h4>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h3 key={idx} className="font-extrabold text-sm text-indigo-400 mt-2 mb-1">
            {trimmed.replace(/^##\s+/, '')}
          </h3>
        );
      }

      // Bullet points
      if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const itemText = trimmed.replace(/^(\•|\-|\*)\s+/, '');
        return (
          <div key={idx} className="flex items-start gap-2 my-1 pl-1">
            <span className="text-emerald-400 text-xs mt-0.5">•</span>
            <span className="flex-1">{formatInlineStyles(itemText)}</span>
          </div>
        );
      }

      // Numbered items
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1 pl-1">
            <span className="font-bold text-blue-400 text-xs">{numMatch[1]}.</span>
            <span className="flex-1">{formatInlineStyles(numMatch[2])}</span>
          </div>
        );
      }

      // Regular paragraph
      return (
        <p key={idx} className="my-1 leading-relaxed">
          {formatInlineStyles(line)}
        </p>
      );
    });
  };

  // Format bold (**text**), inline code (`code`), etc.
  const formatInlineStyles = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong 
            key={i} 
            className={`font-semibold ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code 
            key={i} 
            className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${
              theme === 'white' 
                ? 'bg-zinc-200 text-amber-800 border border-zinc-300' 
                : 'bg-zinc-800 text-amber-300'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const isLight = theme === 'white';

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 text-white font-bold text-xs shadow-2xl hover:brightness-110 flex items-center gap-2.5 transition-all active:scale-95 border border-white/20"
        >
          <div className="p-1 rounded-lg bg-white/20">
            <Bot size={18} />
          </div>
          <span>MCP Commander</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      {/* Slide-Up / Floating Window */}
      {isOpen && (
        <div className={`fixed bottom-24 right-6 z-50 w-full transition-all duration-300 rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 ${
          isExpanded ? 'max-w-2xl h-[700px]' : 'max-w-md h-[560px]'
        } ${
          isLight 
            ? 'bg-white border-zinc-200 text-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)]' 
            : 'bg-zinc-950 border-white/10 text-zinc-100 shadow-[0_0_50px_rgba(37,99,235,0.15)]'
        }`}>
          {/* Header */}
          <div className={`p-4 border-b flex items-center justify-between backdrop-blur-md transition-colors ${
            isLight 
              ? 'bg-zinc-50 border-zinc-200' 
              : 'bg-zinc-900/80 border-zinc-800'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 text-white shadow-md">
                <Terminal size={16} />
              </div>
              <div>
                <h3 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  isLight ? 'text-zinc-900' : 'text-white'
                }`}>
                  Mission Control Commander
                  {isBridgeConnected === null ? (
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                      isLight ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      Checking...
                    </span>
                  ) : isBridgeConnected ? (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      WP Bridge Online
                    </span>
                  ) : (
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 border border-amber-500/30" title="Install Netstripes Bridge Plugin on client site to enable live WordPress actions">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Bridge Offline
                    </span>
                  )}
                </h3>
                <p className={`text-[10px] truncate max-w-[200px] ${
                  isLight ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  Target: {clientName || 'General Context'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className={`p-1.5 rounded-lg transition-colors ${
                  isLight 
                    ? 'text-zinc-400 hover:text-rose-600 hover:bg-zinc-200' 
                    : 'text-zinc-400 hover:text-rose-400 hover:bg-zinc-800'
                }`}
                title="Clear Chat History"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isLight 
                    ? 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
                title={isExpanded ? 'Collapse size' : 'Expand size'}
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className={`p-1.5 rounded-lg transition-colors text-sm ${
                  isLight 
                    ? 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className={`flex-1 p-4 overflow-y-auto space-y-4 text-xs ${
            isLight ? 'bg-slate-50/50' : 'bg-transparent'
          }`}>
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-600/20'
                      : isLight
                      ? 'bg-white text-zinc-800 rounded-bl-none border border-zinc-200 shadow-sm'
                      : 'bg-zinc-900 border border-white/10 text-zinc-200 rounded-bl-none shadow-sm'
                  }`}
                >
                  {m.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  ) : (
                    <div>{renderFormattedMarkdown(m.content)}</div>
                  )}

                  {m.execution && m.execution.success && (
                    <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                      <div className="flex items-center gap-1.5 font-bold text-[11px] mb-1">
                        <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                        <span>Live WordPress Update Verified</span>
                      </div>
                      <div className="text-[10px] space-y-0.5 opacity-90 font-mono">
                        {m.execution.postId && <div>Post ID: #{m.execution.postId}</div>}
                        {m.execution.applied?.metaTitle && <div className="truncate"><span className="font-semibold text-emerald-500">SEO Meta Title:</span> {m.execution.applied.metaTitle}</div>}
                        {m.execution.applied?.postTitle && <div className="truncate"><span className="font-semibold text-emerald-500">Post Title (H1):</span> {m.execution.applied.postTitle}</div>}
                        {!m.execution.applied?.metaTitle && !m.execution.applied?.postTitle && m.execution.applied?.title && (
                          <div className="truncate"><span className="font-semibold text-emerald-500">Title:</span> {m.execution.applied.title}</div>
                        )}
                        {m.execution.applied?.description && <div className="truncate"><span className="font-semibold text-emerald-500">Meta Desc:</span> {m.execution.applied.description}</div>}
                        {m.execution.applied?.keyword && <div className="truncate"><span className="font-semibold text-emerald-500">Focus KW:</span> {m.execution.applied.keyword}</div>}
                      </div>
                    </div>
                  )}

                  {/* Bulk Document Proposals Preview & 1-Click Execution */}
                  {m.bulkProposals && m.bulkProposals.length > 0 && (
                    <div className={`mt-3 p-3 rounded-2xl border ${
                      isLight 
                        ? 'bg-amber-50/70 border-amber-200/80 text-zinc-800' 
                        : 'bg-zinc-950/80 border-amber-500/30 text-zinc-200'
                    }`}>
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-500/20">
                        <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-500">
                          <FileText size={14} />
                          <span>Document Action Plan ({m.bulkProposals.length} Updates Detected)</span>
                        </div>
                        {m.bulkApplied ? (
                          <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                            <CheckCircle size={12} /> Applied Live
                          </span>
                        ) : (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/20">
                            Dry Run / Preview
                          </span>
                        )}
                      </div>

                      {/* Proposals Preview List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar pr-1 my-2">
                        {m.bulkProposals.map((prop, idx) => (
                          <div key={idx} className={`p-2 rounded-xl border text-[10px] font-mono ${
                            isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-white/5'
                          }`}>
                            <div className="font-bold flex items-center justify-between text-blue-400">
                              <span>Post #{prop.postId}</span>
                            </div>
                            {prop.postTitle && (
                              <div className="mt-1">
                                <span className="text-zinc-500 font-sans font-bold">Post Title (H1): </span>
                                <span className={isLight ? 'text-zinc-900 font-semibold' : 'text-zinc-100 font-semibold'}>{prop.postTitle}</span>
                              </div>
                            )}
                            {prop.metaTitle && (
                              <div className="mt-0.5">
                                <span className="text-zinc-500 font-sans font-bold">SEO Meta Title: </span>
                                <span className={isLight ? 'text-blue-700 font-semibold' : 'text-blue-300 font-semibold'}>{prop.metaTitle}</span>
                              </div>
                            )}
                            {prop.metaDescription && (
                              <div className="mt-0.5 truncate text-zinc-400">
                                <span>Desc: {prop.metaDescription}</span>
                              </div>
                            )}
                            {prop.focusKeyword && (
                              <div className="mt-0.5 text-emerald-400">
                                <span>Keyword: {prop.focusKeyword}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 1-Click Bulk Apply Button */}
                      {!m.bulkApplied && (
                        <div className="pt-2 mt-2 border-t border-amber-500/20 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-zinc-500">100% safe with automatic snapshot rollback</span>
                          <button
                            onClick={() => handleBulkApply(m.id, m.bulkProposals!)}
                            disabled={applyingBulk}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-[11px] shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            {applyingBulk ? <RefreshCw size={12} className="animate-spin" /> : <CheckCheck size={13} />}
                            <span>{applyingBulk ? 'Pushing Live...' : 'Confirm & Apply All'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {m.action && (
                    <div className={`mt-3 pt-2.5 border-t flex items-center gap-2 ${
                      isLight ? 'border-zinc-200' : 'border-white/10'
                    }`}>
                      <button
                        onClick={() => {
                          if (m.action?.url) navigate(m.action.url);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-[11px] shadow-sm flex items-center gap-1.5 transition-all"
                      >
                        <Zap size={12} />
                        {m.action.label}
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 px-1 text-[9px] text-zinc-400">
                  {m.modelUsed && <span className="text-emerald-500 font-semibold">{m.modelUsed}</span>}
                  <span>{m.timestamp}</span>
                </div>
              </div>
            ))}
            {loading && (
              <div className={`flex items-center gap-2.5 text-xs p-3 rounded-2xl border animate-pulse ${
                isLight 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-zinc-900/60 text-zinc-300 border-white/10'
              }`}>
                <RefreshCw size={14} className="animate-spin text-blue-500" />
                <span>Thinking & analyzing via MCP...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Suggestions */}
          <div className={`px-3 py-2 border-t flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
            isLight 
              ? 'bg-zinc-50 border-zinc-200' 
              : 'bg-zinc-950/80 border-zinc-800/80'
          }`}>
            <button
              onClick={() => sendMessageText("Audit On-Page SEO for this site and give me top fixes")}
              disabled={loading}
              className={`text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full border transition-all ${
                isLight 
                  ? 'bg-white hover:bg-blue-600 hover:text-white hover:border-blue-600 text-zinc-700 border-zinc-200 shadow-xs' 
                  : 'bg-zinc-800/80 hover:bg-blue-600 hover:text-white text-zinc-300 border-white/5'
              }`}
            >
              🔍 Audit On-Page SEO
            </button>
            <button
              onClick={() => sendMessageText("Suggest 3 high-converting blog topics for this client")}
              disabled={loading}
              className={`text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full border transition-all ${
                isLight 
                  ? 'bg-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600 text-zinc-700 border-zinc-200 shadow-xs' 
                  : 'bg-zinc-800/80 hover:bg-emerald-600 hover:text-white text-zinc-300 border-white/5'
              }`}
            >
              ✍️ 3 Blog Topics
            </button>
            <button
              onClick={() => sendMessageText("Check missing meta descriptions and Rank Math tags")}
              disabled={loading}
              className={`text-[10px] whitespace-nowrap px-2.5 py-1 rounded-full border transition-all ${
                isLight 
                  ? 'bg-white hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-zinc-700 border-zinc-200 shadow-xs' 
                  : 'bg-zinc-800/80 hover:bg-indigo-600 hover:text-white text-zinc-300 border-white/5'
              }`}
            >
              🏷️ Rank Math Tags
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSend} className={`p-3 border-t flex items-center gap-2 ${
            isLight 
              ? 'bg-white border-zinc-200' 
              : 'bg-zinc-900/70 border-zinc-800'
          }`}>
            {/* Hidden File Input for Documents */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.csv,.md,.json,.doc,.docx"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload SEO Instructions / Audit document (.txt, .csv, .md, .json)"
              className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center shrink-0 ${
                isLight
                  ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border-zinc-300'
                  : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-white/10'
              }`}
            >
              <Paperclip size={14} />
            </button>
            <textarea
              rows={1}
              placeholder="Ask Commander or upload SEO document... (Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (input.trim() && !loading) {
                    const text = input.trim();
                    setInput('');
                    sendMessageText(text);
                  }
                }
              }}
              className={`flex-1 rounded-xl px-3 py-2 text-xs outline-none transition-colors border resize-none max-h-32 min-h-[38px] leading-relaxed ${
                isLight 
                  ? 'bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:bg-white focus:border-blue-500' 
                  : 'bg-zinc-800/60 border-white/10 text-white placeholder-zinc-500 focus:border-blue-500'
              }`}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md disabled:opacity-40 transition-all flex items-center justify-center shrink-0 self-end"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
