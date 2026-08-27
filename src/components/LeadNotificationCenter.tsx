import React, { useState, useEffect, useRef } from 'react';
import { Bell, Sparkles, X, CheckCircle, Mail, Phone, Clock, ShieldCheck, User, Trash2 } from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { useTheme } from '../contexts/ThemeContext';

export interface ILeadNotification {
  id: string;
  clientId: string;
  clientName: string;
  customerName: string;
  email: string;
  phone: string;
  message: string;
  status: string;
  channel?: string;
  createdAt: string;
}

// Play pleasant web audio chime on new lead
const playChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    // Two-tone cheerful chime (E5 -> A5)
    osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
    osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
    
    gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.55);
  } catch (e) {
    // Audio might be blocked by browser autoplay policies
  }
};

// Format date in Australian format (dd MMM yyyy) with relative fallback
const formatLeadTime = (rawTime?: string) => {
  if (!rawTime) return { dateStr: '', timeAgo: 'Recently' };
  try {
    const d = new Date(rawTime);
    if (!isNaN(d.getTime())) {
      const dateStr = format(d, 'dd MMM yyyy');
      const timeAgo = formatDistanceToNow(d, { addSuffix: true });
      return { dateStr, timeAgo };
    }
  } catch (e) {}
  return { dateStr: '', timeAgo: 'Recently' };
};

export const LeadNotificationCenter: React.FC = () => {
  const { theme } = useTheme();
  const [leads, setLeads] = useState<ILeadNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeToast, setActiveToast] = useState<ILeadNotification | null>(null);
  const [toastProgress, setToastProgress] = useState<number>(100);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // Fetch recent real leads
  const fetchRecentLeads = async () => {
    try {
      const res = await fetch('/api/leads/recent');
      const data = await res.json();
      if (data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
      }
    } catch (e) {
      console.error('Failed to fetch recent leads:', e);
    }
  };

  // Connect to SSE Live Stream
  useEffect(() => {
    fetchRecentLeads();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/leads/stream');
      
      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.startsWith(':')) return;
          const newLead: ILeadNotification = JSON.parse(event.data);
          
          // Add to leads list
          setLeads(prev => [newLead, ...prev.filter(l => l.id !== newLead.id)].slice(0, 30));
          setUnreadCount(prev => prev + 1);
          
          // Trigger live toast
          showToast(newLead);
          playChime();
        } catch (err) {
          console.error('Error parsing SSE lead event:', err);
        }
      };

      eventSource.onerror = () => {
        // SSE auto-reconnects
      };
    } catch (e) {
      console.error('EventSource initialization error:', e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Show 5-second animated toast
  const showToast = (lead: ILeadNotification) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    setActiveToast(lead);
    setToastProgress(100);

    const startTime = Date.now();
    const duration = 5000;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setToastProgress(remaining);
      if (remaining <= 0) {
        clearInterval(progressIntervalRef.current);
      }
    }, 50);

    timerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, duration);
  };

  // Dismiss toast manually
  const handleDismissToast = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setActiveToast(null);
  };

  // Toggle Bell dropdown & clear unread count
  const handleToggleDropdown = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setUnreadCount(0);
      localStorage.setItem('lead_notifications_last_read', new Date().toISOString());
    }
  };

  // Clear all leads from view
  const handleClearAll = () => {
    setLeads([]);
    setUnreadCount(0);
    localStorage.setItem('lead_notifications_last_read', new Date().toISOString());
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* 1. FLOATING REAL-TIME TOAST NOTIFICATION (5 SECONDS AUTO-DISMISS) */}
      {activeToast && (
        <div className="fixed top-6 right-6 z-[99999] max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`p-5 rounded-3xl border shadow-2xl backdrop-blur-2xl relative overflow-hidden transition-all ${
            theme === 'white' 
              ? 'bg-white/95 border-emerald-500/30 text-slate-900 shadow-emerald-900/10' 
              : 'bg-zinc-950/95 border-emerald-500/40 text-white shadow-emerald-500/10'
          }`}>
            {/* Top Badge & Close */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <Sparkles size={13} className="text-emerald-400 animate-spin" />
                  New Genuine Lead
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${
                  theme === 'white' ? 'bg-[#082a36] text-white' : 'bg-zinc-800 text-blue-400 border border-white/10'
                }`}>
                  {activeToast.clientName}
                </span>
                <button
                  onClick={handleDismissToast}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Customer Details */}
            <div className="space-y-1.5 pl-1">
              <p className="text-base font-bold flex items-center gap-2">
                <User size={15} className="text-emerald-500" />
                {activeToast.customerName || 'Inbound Lead'}
              </p>
              
              {(activeToast.email || activeToast.phone) && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                  {activeToast.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} className="text-zinc-400" />
                      {activeToast.email}
                    </span>
                  )}
                  {activeToast.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-zinc-400" />
                      {activeToast.phone}
                    </span>
                  )}
                </div>
              )}

              {activeToast.message && (
                <div className="text-xs text-zinc-600 dark:text-zinc-300 italic bg-zinc-100/90 dark:bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-200 dark:border-white/5 mt-2 max-h-28 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap">
                  "{activeToast.message}"
                </div>
              )}
            </div>

            {/* 5-Second Progress Countdown Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75"
                style={{ width: `${toastProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. NOTIFICATION BELL BUTTON WITH UNREAD BADGE */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleToggleDropdown}
          aria-label="Lead Notifications"
          className={`relative p-2.5 rounded-2xl border transition-all flex items-center justify-center ${
            isOpen
              ? theme === 'white' ? 'bg-[#082a36] text-white border-[#082a36] shadow-lg' : 'bg-blue-600 text-white border-blue-600 shadow-lg'
              : theme === 'white'
                ? 'bg-white border-[#163f4d]/10 text-[#607a80] hover:text-[#082a36] hover:bg-[#76c9be]/10'
                : 'bg-zinc-800 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          <Bell size={18} className={unreadCount > 0 ? 'animate-bounce text-emerald-500' : ''} />
          
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center px-1.5 rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-lg shadow-emerald-500/50 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 3. NOTIFICATION DROPDOWN DRAWER */}
        {isOpen && (
          <div className={`absolute right-0 mt-3 w-96 max-w-[90vw] rounded-3xl border shadow-2xl backdrop-blur-2xl z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${
            theme === 'white'
              ? 'bg-white/95 border-zinc-200 text-slate-900 shadow-xl'
              : 'bg-zinc-900/95 border-white/10 text-white shadow-2xl'
          }`}>
            {/* Header */}
            <div className="p-4 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-500" />
                <h4 className="text-sm font-bold tracking-tight">Recent Inbound Leads</h4>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                  {leads.length}
                </span>
              </div>
              {leads.length > 0 && (
                <button
                  onClick={handleClearAll}
                  title="Clear all leads from list"
                  className="text-xs px-2 py-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>

            {/* Real Leads List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
              {leads.length === 0 ? (
                <div className="p-8 text-center text-zinc-400 space-y-2">
                  <CheckCircle size={32} className="mx-auto text-zinc-500 opacity-50" />
                  <p className="text-sm font-medium">No new leads</p>
                  <p className="text-xs text-zinc-500">Live webhook leads will appear here automatically.</p>
                </div>
              ) : (
                leads.map((lead, idx) => {
                  const { dateStr, timeAgo } = formatLeadTime(lead.createdAt);

                  return (
                    <div 
                      key={lead.id || idx}
                      className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          theme === 'white' ? 'bg-[#082a36] text-white' : 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {lead.clientName}
                        </span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
                          <Clock size={11} className="shrink-0 text-zinc-400" />
                          <span>{dateStr ? `${dateStr} (${timeAgo})` : timeAgo}</span>
                        </span>
                      </div>

                      <div className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center justify-between">
                        <span>{lead.customerName || 'Inquiry'}</span>
                        <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          {lead.status}
                        </span>
                      </div>

                      {(lead.email || lead.phone) && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono flex flex-wrap gap-x-3 gap-y-0.5">
                          {lead.email && <span>{lead.email}</span>}
                          {lead.phone && <span>{lead.phone}</span>}
                        </div>
                      )}

                      {lead.message && (
                        <div className="text-xs text-zinc-600 dark:text-zinc-300 italic bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-200/60 dark:border-white/5 max-h-32 overflow-y-auto custom-scrollbar leading-relaxed whitespace-pre-wrap">
                          "{lead.message}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-800/30 text-center">
              <span className="text-[11px] text-zinc-400">
                Listening to live webhook on <code className="text-emerald-500 font-mono">/api/webhooks/lead-shield</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default LeadNotificationCenter;
