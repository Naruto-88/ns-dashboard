import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  Search, 
  Server, 
  Lock, 
  FileCode, 
  Zap, 
  Clock, 
  Package, 
  ArrowUpRight,
  ChevronDown,
  Info,
  Download,
  ShieldAlert,
  Send,
  MessageSquare,
  FileText
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import Tooltip from '../components/Tooltip';
import { format } from 'date-fns';
import { checkPluginSafety } from '../config/pluginSafety';

interface SiteHealthItem {
  clientId: string;
  clientName: string;
  shortCode: string;
  siteUrl: string;
  isOnline: boolean;
  httpStatus: number | null;
  responseTimeMs: number;
  sslValid: boolean;
  sslDaysLeft: number;
  sslIssuer?: string;
  sitemapStatus: 'OK' | 'MISSING' | 'ERROR';
  sitemapUrl: string;
  sitemapCount: number;
  robotsStatus: 'OK' | 'MISSING' | 'BLOCKING';
  hasNoindex: boolean;
  wpConnected: boolean;
  wpVersion?: string;
  phpVersion?: string;
  bridgeVersion?: string;
  pluginsTotal: number;
  pluginsOutdated: number;
  pluginsData: Array<{
    slug: string;
    name: string;
    current_version: string;
    author: string;
    is_active: boolean;
    has_update: boolean;
    new_version?: string;
    can_auto_update: boolean;
  }>;
  issues: string[];
  scannedAt: string | null;
}

export default function SiteHealth() {
  const { theme } = useTheme();
  const [sites, setSites] = useState<SiteHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningAll, setScanningAll] = useState(false);
  const [scanningClient, setScanningClient] = useState<string | null>(null);
  const [updatingPlugin, setUpdatingPlugin] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIssue, setFilterIssue] = useState<string>('all');
  const [activePluginModal, setActivePluginModal] = useState<SiteHealthItem | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  // Plugin Modal Features: Sort, Bulk Select, Warning Confirm
  const [pluginSortFilter, setPluginSortFilter] = useState<'updates-first' | 'all' | 'active-only'>('updates-first');
  const [selectedPluginSlugs, setSelectedPluginSlugs] = useState<Set<string>>(new Set());
  const [pendingUpdateTarget, setPendingUpdateTarget] = useState<{ clientId: string; pluginSlug: string; pluginName: string; isBulk?: boolean } | null>(null);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [updateProgressStep, setUpdateProgressStep] = useState<string | null>(null);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/site-health/all');
      const data = await res.json();
      if (data.success) {
        setSites(data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to fetch site health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  const handleScanAll = async () => {
    setScanningAll(true);
    setBannerNotice('Scanning all active client websites in background...');
    try {
      const res = await fetch('/api/site-health/scan-all', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSites(data.data || []);
        setBannerNotice('Site health scan complete for all clients!');
        setTimeout(() => setBannerNotice(null), 4000);
      }
    } catch (e: any) {
      alert('Scan error: ' + e.message);
    } finally {
      setScanningAll(false);
    }
  };

  const handleScanSingle = async (clientId: string) => {
    setScanningClient(clientId);
    try {
      const res = await fetch(`/api/site-health/scan/${clientId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSites(prev => prev.map(s => s.clientId === clientId ? data.data : s));
      }
    } catch (e: any) {
      alert('Scan failed: ' + e.message);
    } finally {
      setScanningClient(null);
    }
  };

  const handleRemoteUpdatePlugin = async (clientId: string, pluginSlug: string) => {
    setUpdatingPlugin(pluginSlug);
    setUpdateProgressStep('Connecting to WordPress Bridge...');
    setBannerNotice(`Updating ${pluginSlug} remotely via WordPress Bridge...`);

    // Dynamic progress step timers to show the user real activity instead of static spinning
    const t1 = setTimeout(() => setUpdateProgressStep('Downloading official package from WordPress.org...'), 1500);
    const t2 = setTimeout(() => setUpdateProgressStep('Unpacking and replacing plugin files safely...'), 4000);
    const t3 = setTimeout(() => setUpdateProgressStep('Finalizing upgrade & clearing site cache...'), 7500);

    try {
      const res = await fetch('/api/site-health/update-plugin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, pluginSlug })
      });
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const data = await res.json();
      if (res.ok && data.success) {
        setUpdateProgressStep('Completed! Verifying status...');
        setBannerNotice(`✅ Successfully updated ${pluginSlug}!`);
        setTimeout(() => setBannerNotice(null), 5000);

        // Immediately update modal local state so "Update Now" changes to "Up to Date" instantly
        if (activePluginModal) {
          const updatedPlugins = (activePluginModal.pluginsData || []).map(p => {
            if (p.slug === pluginSlug) {
              return {
                ...p,
                current_version: p.new_version || p.current_version,
                has_update: false,
                new_version: undefined
              };
            }
            return p;
          });
          const newOutdatedCount = Math.max(0, activePluginModal.pluginsOutdated - 1);
          const updatedModal: SiteHealthItem = {
            ...activePluginModal,
            pluginsOutdated: newOutdatedCount,
            pluginsData: updatedPlugins
          };
          setActivePluginModal(updatedModal);
          setSites(prev => prev.map(s => s.clientId === clientId ? updatedModal : s));
        }

        // Also merge fresh audit if returned
        if (data.updatedAudit) {
          const freshAudit: SiteHealthItem = {
            clientId: data.updatedAudit.clientId || clientId,
            clientName: data.updatedAudit.clientName || activePluginModal?.clientName || '',
            shortCode: data.updatedAudit.shortCode || activePluginModal?.shortCode || '',
            siteUrl: data.updatedAudit.siteUrl || activePluginModal?.siteUrl || '',
            isOnline: Boolean(data.updatedAudit.isOnline),
            httpStatus: data.updatedAudit.httpStatus ?? 200,
            responseTimeMs: data.updatedAudit.responseTimeMs || 0,
            sslValid: Boolean(data.updatedAudit.sslValid),
            sslDaysLeft: data.updatedAudit.sslDaysLeft || 0,
            sslIssuer: data.updatedAudit.sslIssuer,
            sitemapStatus: data.updatedAudit.sitemapStatus || 'OK',
            sitemapUrl: data.updatedAudit.sitemapUrl || '',
            sitemapCount: data.updatedAudit.sitemapCount || 0,
            robotsStatus: data.updatedAudit.robotsStatus || 'OK',
            hasNoindex: Boolean(data.updatedAudit.hasNoindex),
            wpConnected: Boolean(data.updatedAudit.wpConnected),
            wpVersion: data.updatedAudit.wpVersion,
            phpVersion: data.updatedAudit.phpVersion,
            pluginsTotal: data.updatedAudit.pluginsTotal || 0,
            pluginsOutdated: data.updatedAudit.pluginsOutdated || 0,
            pluginsData: Array.isArray(data.updatedAudit.pluginsData) ? data.updatedAudit.pluginsData : [],
            issues: Array.isArray(data.updatedAudit.issues) ? data.updatedAudit.issues : [],
            scannedAt: data.updatedAudit.scannedAt || new Date().toISOString()
          };
          setSites(prev => prev.map(s => s.clientId === clientId ? freshAudit : s));
          if (activePluginModal?.clientId === clientId) {
            setActivePluginModal(freshAudit);
          }
        }
      } else {
        setBannerNotice(`❌ Update failed: ${data.error || 'Unknown error'}`);
        setTimeout(() => setBannerNotice(null), 6000);
      }
    } catch (e: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setBannerNotice(`❌ Network error: ${e.message}`);
      setTimeout(() => setBannerNotice(null), 6000);
    } finally {
      setUpdatingPlugin(null);
      setUpdateProgressStep(null);
    }
  };

  const [notifyingPlugin, setNotifyingPlugin] = useState<string | null>(null);

  const handleNotifyTechTeam = async (plugin: any) => {
    if (!activePluginModal) return;
    setNotifyingPlugin(plugin.slug);
    try {
      const safety = checkPluginSafety(plugin.slug, plugin.name);
      const res = await fetch('/api/site-health/notify-tech-team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activePluginModal.clientId,
          pluginSlug: plugin.slug,
          pluginName: plugin.name,
          currentVersion: plugin.current_version,
          newVersion: plugin.new_version,
          reason: safety.reason,
          riskLevel: safety.riskLevel || 'HIGH'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerNotice(`📢 Alert dispatched to Slack: Tech team notified for ${plugin.name}!`);
        setTimeout(() => setBannerNotice(null), 5000);
      } else {
        setBannerNotice(`⚠️ Notification note: ${data.message || data.error || 'Sent'}`);
        setTimeout(() => setBannerNotice(null), 5000);
      }
    } catch (e: any) {
      setBannerNotice(`❌ Slack notify failed: ${e.message}`);
      setTimeout(() => setBannerNotice(null), 5000);
    } finally {
      setNotifyingPlugin(null);
    }
  };

  const [sendingDigest, setSendingDigest] = useState(false);
  const handleSendSiteSlackDigest = async () => {
    if (!activePluginModal) return;
    setSendingDigest(true);
    try {
      const res = await fetch('/api/site-health/notify-site-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: activePluginModal.clientId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBannerNotice(`📢 ${data.message}`);
        setTimeout(() => setBannerNotice(null), 6000);
      } else {
        setBannerNotice(`⚠️ ${data.message || data.error || 'Failed to dispatch Slack digest'}`);
        setTimeout(() => setBannerNotice(null), 5000);
      }
    } catch (e: any) {
      setBannerNotice(`❌ Error sending Slack digest: ${e.message}`);
      setTimeout(() => setBannerNotice(null), 5000);
    } finally {
      setSendingDigest(false);
    }
  };

  // Bulk update all selected plugins sequentially
  const handleBulkUpdateSelected = async () => {
    if (!activePluginModal || selectedPluginSlugs.size === 0) return;
    setIsBulkUpdating(true);
    const slugs = Array.from(selectedPluginSlugs);
    let successCount = 0;

    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      setUpdateProgressStep(`Updating (${i + 1}/${slugs.length}): ${slug}...`);
      setBannerNotice(`Bulk updating (${i + 1}/${slugs.length}): ${slug}...`);
      try {
        const res = await fetch('/api/site-health/update-plugin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: activePluginModal.clientId, pluginSlug: slug })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          successCount++;
          // mark in modal state
          setActivePluginModal(prev => {
            if (!prev) return prev;
            const updated = prev.pluginsData.map(p => p.slug === slug ? { ...p, has_update: false, current_version: p.new_version || p.current_version } : p);
            return {
              ...prev,
              pluginsOutdated: Math.max(0, prev.pluginsOutdated - 1),
              pluginsData: updated
            };
          });
        }
      } catch (e) {
        console.error(`Failed updating ${slug}:`, e);
      }
    }

    setBannerNotice(`🎉 Bulk update completed! Successfully updated ${successCount} of ${slugs.length} plugins.`);
    setSelectedPluginSlugs(new Set());
    setIsBulkUpdating(false);
    setUpdateProgressStep(null);
    setTimeout(() => setBannerNotice(null), 6000);
  };

  // Aggregated Stats
  const totalSites = sites.length;
  const healthySites = sites.filter(s => s.isOnline && s.sslValid && s.sitemapStatus === 'OK' && !s.hasNoindex).length;
  const sitesWithIssues = sites.filter(s => (s.issues && s.issues.length > 0) || !s.isOnline || !s.sslValid).length;
  const outdatedPluginsTotal = sites.reduce((sum, s) => sum + (s.pluginsOutdated || 0), 0);
  const wpConnectedSites = sites.filter(s => s.wpConnected).length;

  const filteredSites = sites.filter(s => {
    const matchesSearch = s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.siteUrl.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (filterIssue === 'outdated-plugins') return s.pluginsOutdated > 0;
    if (filterIssue === 'ssl-issues') return !s.sslValid || s.sslDaysLeft < 30;
    if (filterIssue === 'sitemap-issues') return s.sitemapStatus !== 'OK';
    if (filterIssue === 'offline') return !s.isOnline;
    const getBridgeVer = (site: SiteHealthItem) => {
      const selfPlugin = (site.pluginsData || []).find((p: any) =>
        p.slug && p.slug.includes('mission-control-site-bridge')
      );
      return site.bridgeVersion || (selfPlugin ? selfPlugin.current_version : null) || '1.0.0';
    };

    if (filterIssue === 'bridge-needs-update') return s.wpConnected && getBridgeVer(s) !== '1.3.0';
    if (filterIssue === 'bridge-v130') return s.wpConnected && getBridgeVer(s) === '1.3.0';

    return true;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Bar */}
      <div className={`flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 md:p-6 rounded-[32px] border relative z-20 ${
        theme === 'white' ? 'bg-white border-[#163f4d]/10 shadow-sm' : 'bg-zinc-900/40 border-white/5 backdrop-blur-2xl'
      }`}>
        <div className="flex items-center gap-3 shrink-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
            theme === 'white' ? 'bg-[#76c9be] shadow-[#76c9be]/20' : 'bg-emerald-600 shadow-emerald-600/20'
          }`}>
            <ShieldCheck className="text-white" size={20} />
          </div>
          <div>
            <h2 className={`text-2xl font-bold font-heading tracking-tight italic ${
              theme === 'white' ? 'text-[#082a36]' : 'text-white'
            }`}>
              Site Health & Security Hub
            </h2>
            <p className="text-zinc-500 text-xs font-medium mt-0.5">
              Automated Technical SEO, Sitemap, SSL & Remote WordPress Plugin Maintenance
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
            theme === 'white' ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/80 border-white/10'
          }`}>
            <Search size={14} className="text-zinc-400" />
            <input 
              type="text"
              placeholder="Search site, code or domain..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-48"
            />
          </div>

          <select
            value={filterIssue}
            onChange={(e) => setFilterIssue(e.target.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border outline-none cursor-pointer ${
              theme === 'white' ? 'bg-white border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-zinc-300'
            }`}
          >
            <option value="all">All Sites ({totalSites})</option>
            <option value="bridge-needs-update">⚡ Bridge Plugin Update Pending ({sites.filter(s => s.wpConnected && s.bridgeVersion !== '1.3.0').length})</option>
            <option value="bridge-v130">🛡️ Bridge v1.3.0 Hardened ({sites.filter(s => s.wpConnected && s.bridgeVersion === '1.3.0').length})</option>
            <option value="outdated-plugins">Pending Plugin Updates ({sites.filter(s => s.pluginsOutdated > 0).length})</option>
            <option value="ssl-issues">SSL Warnings / Expiring</option>
            <option value="sitemap-issues">Sitemap Errors</option>
            <option value="wp-connected">WP Bridge Connected ({wpConnectedSites})</option>
          </select>

          <button
            onClick={() => window.open('/api/site-health/plugin-updates-report', '_blank')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer border ${
              theme === 'white'
                ? 'bg-white border-zinc-200 text-[#082a36] hover:bg-zinc-50'
                : 'bg-zinc-900 border-white/10 text-white hover:bg-zinc-800'
            }`}
            title="Open printable HTML audit report of all sites with pending updates in a new tab"
          >
            <FileText size={13} className="text-indigo-400" />
            <span>Updates Report (PDF)</span>
          </button>

          <button
            onClick={handleScanAll}
            disabled={scanningAll}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-50 ${
              theme === 'white'
                ? 'bg-[#082a36] text-white hover:bg-[#082a36]/90'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-600/20'
            }`}
          >
            <RefreshCw size={13} className={scanningAll ? 'animate-spin' : ''} />
            {scanningAll ? 'Scanning All Sites...' : 'Scan All Sites'}
          </button>
        </div>
      </div>

      {/* Banner Notice */}
      {bannerNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          {bannerNotice}
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-5 rounded-2xl border ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">MONITORED SITES</span>
            <Server size={18} className="text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-heading ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              {totalSites}
            </span>
            <span className="text-xs text-emerald-500 font-medium">{healthySites} Fully Healthy</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">PENDING PLUGIN UPDATES</span>
            <Package size={18} className="text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-heading ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              {outdatedPluginsTotal}
            </span>
            <span className="text-xs text-amber-500 font-medium">Across connected WP sites</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">SSL SECURITY STATUS</span>
            <Lock size={18} className="text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-heading ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              {sites.filter(s => s.sslValid).length} / {totalSites}
            </span>
            <span className="text-xs text-emerald-500 font-medium">HTTPS Valid</span>
          </div>
        </div>

        <div className={`p-5 rounded-2xl border ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500">SITEMAP & INDEX STATUS</span>
            <FileCode size={18} className="text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-heading ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
              {sites.filter(s => s.sitemapStatus === 'OK').length} / {totalSites}
            </span>
            <span className="text-xs text-purple-400 font-medium">Sitemaps Active</span>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className={`rounded-[20px] border backdrop-blur-xl shadow-2xl overflow-hidden ${
        theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/50 border-white/5'
      }`}>
        <div className="overflow-x-auto max-h-[calc(100vh-140px)] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className={`sticky top-0 z-20 border-b backdrop-blur-xl ${
              theme === 'white' ? 'bg-[#082a36] text-white border-[#163f4d]/20' : 'bg-zinc-950/95 text-[#607a80] border-white/10'
            }`}>
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Client</th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="Live HTTP Status Code: Direct TLS/TCP ping to the site. 200 = Online, 4xx/5xx = Downtime or Error.">
                    <span className="cursor-help inline-flex items-center gap-1">Status <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="Server Response Time (TTFB/Latency): Time taken in milliseconds (ms) for the client server to receive the request and return headers. <600ms = Good, 600-1500ms = Fair, >1500ms = Slow.">
                    <span className="cursor-help inline-flex items-center gap-1">Speed <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="SSL Certificate Security: Validates TLS handshake with root CA and calculates exact days remaining until expiry. <20 days = Alert to renew.">
                    <span className="cursor-help inline-flex items-center gap-1">SSL Cert <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="XML Sitemap Verification: Checks /sitemap.xml and /sitemap_index.xml, confirms HTTP 200, valid XML schema, and counts indexed URLs.">
                    <span className="cursor-help inline-flex items-center gap-1">XML Sitemap <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="Indexing Guard: Reads /robots.txt for Disallow rules and scans homepage HTML for accidental <meta name='robots' content='noindex'> tags.">
                    <span className="cursor-help inline-flex items-center gap-1">Robots / Index <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="WordPress Bridge Connection: Secure authenticated link via 'mission-control-site-bridge' plugin to read CMS and server environment (PHP/WP versions).">
                    <span className="cursor-help inline-flex items-center gap-1">WP Bridge <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-center">
                  <Tooltip content="WordPress Plugins Inventory: Direct read of installed plugins vs WordPress.org repository updates. Allows remote 1-click update.">
                    <span className="cursor-help inline-flex items-center gap-1">Plugins <Info size={11} className="text-zinc-500" /></span>
                  </Tooltip>
                </th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y text-xs ${
              theme === 'white' ? 'divide-zinc-100' : 'divide-white/5'
            }`}>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">
                    <RefreshCw className="animate-spin inline-block mr-2" size={16} />
                    Loading Site Health records...
                  </td>
                </tr>
              ) : filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-zinc-500">
                    No matching websites found.
                  </td>
                </tr>
              ) : (
                filteredSites.map((site) => {
                  const isScanningThis = scanningClient === site.clientId;

                  return (
                    <tr key={site.clientId} className={`hover:bg-zinc-500/5 transition-colors group`}>
                      {/* Client Code & Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            theme === 'white' ? 'bg-[#76c9be]/20 text-[#082a36]' : 'bg-blue-600/20 text-blue-400'
                          }`}>
                            {site.shortCode}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-semibold ${theme === 'white' ? 'text-[#082a36]' : 'text-white'}`}>
                                {site.clientName}
                              </span>
                              {site.siteUrl && (
                                <a 
                                  href={site.siteUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-zinc-400 hover:text-blue-400 transition-colors"
                                >
                                  <ExternalLink size={11} />
                                </a>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {site.siteUrl ? site.siteUrl.replace(/^https?:\/\//, '') : 'No URL'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* HTTP Status */}
                      <td className="px-4 py-4 text-center">
                        {site.scannedAt === null ? (
                          <span className="text-zinc-500 text-[11px]">Unscanned</span>
                        ) : site.isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} />
                            {site.httpStatus || 200} OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle size={11} />
                            {site.httpStatus ? `HTTP ${site.httpStatus}` : 'Offline'}
                          </span>
                        )}
                      </td>

                      {/* Response Time */}
                      <td className="px-4 py-4 text-center">
                        {site.responseTimeMs > 0 ? (
                          <Tooltip content={
                            site.responseTimeMs < 600 
                              ? `Fast Server Response (${site.responseTimeMs}ms): Excellent for Google Core Web Vitals (TTFB).`
                              : site.responseTimeMs < 1500 
                              ? `Moderate Latency (${site.responseTimeMs}ms): Noticeable server lag, cache optimization advised.`
                              : `Slow Response Time (${site.responseTimeMs}ms): Poor server latency, directly impairs Google crawl speed and user bounce rate.`
                          }>
                            <span className={`font-mono text-xs cursor-help underline decoration-dotted underline-offset-2 ${
                              site.responseTimeMs < 600 ? 'text-emerald-400' : site.responseTimeMs < 1500 ? 'text-amber-400' : 'text-rose-400'
                            }`}>
                              {site.responseTimeMs}ms
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>

                      {/* SSL Status */}
                      <td className="px-4 py-4 text-center">
                        {site.sslValid ? (
                          <Tooltip content={`Issuer: ${site.sslIssuer || 'Trusted CA'}`}>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              site.sslDaysLeft < 20 ? 'text-amber-400' : 'text-emerald-400'
                            }`}>
                              <Lock size={12} />
                              {site.sslDaysLeft} days
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium flex items-center justify-center gap-1">
                            <AlertTriangle size={12} />
                            Invalid
                          </span>
                        )}
                      </td>

                      {/* Sitemap */}
                      <td className="px-4 py-4 text-center">
                        {site.sitemapStatus === 'OK' ? (
                          <a 
                            href={site.sitemapUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
                          >
                            <CheckCircle2 size={11} />
                            {site.sitemapCount > 0 ? `${site.sitemapCount} URLs` : 'Valid XML'}
                          </a>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Missing XML</span>
                        )}
                      </td>

                      {/* Robots & Index */}
                      <td className="px-4 py-4 text-center">
                        {site.hasNoindex ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                            <AlertTriangle size={11} /> NOINDEX
                          </span>
                        ) : site.robotsStatus === 'BLOCKING' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                            <AlertTriangle size={11} /> Disallowed
                          </span>
                        ) : (
                          <span className="text-emerald-400 text-[11px] font-medium">Indexed</span>
                        )}
                      </td>

                      {/* WordPress Bridge Info */}
                      <td className="px-4 py-4 text-center">
                        {site.wpConnected ? (
                          (() => {
                            const selfPlugin = (site.pluginsData || []).find((p: any) =>
                              p.slug && p.slug.includes('mission-control-site-bridge')
                            );
                            const currentBridgeVersion = site.bridgeVersion || (selfPlugin ? selfPlugin.current_version : null) || '1.0.0';
                            const isLatest = currentBridgeVersion === '1.3.0';
                            return (
                              <Tooltip content={
                                isLatest 
                                  ? `WP Bridge is Up-to-Date (v1.3.0)! All security hardenings, WooCommerce products discovery, and anti-tamper guards are fully active.`
                                  : `WP Bridge update available! Installed: v${currentBridgeVersion} (Latest: v1.3.0). Please update plugin to enable latest security protections.`
                              }>
                                <div className="flex flex-col items-center gap-0.5 cursor-help">
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                    isLatest ? 'text-emerald-400' : 'text-amber-400'
                                  }`}>
                                    {isLatest ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                    Connected
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    WP {site.wpVersion || '6.x'} • PHP {site.phpVersion || '8.x'}
                                  </span>
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold font-mono tracking-tight mt-0.5 border ${
                                    isLatest 
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                      : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  }`}>
                                    Bridge v{currentBridgeVersion} {isLatest ? '✓' : '⚡ Update Avail'}
                                  </span>
                                </div>
                              </Tooltip>
                            );
                          })()
                        ) : (
                          <Tooltip content="Install 'mission-control-site-bridge' plugin to enable remote plugin checks & updates.">
                            <span className="text-[11px] text-zinc-500 cursor-help flex items-center justify-center gap-1">
                              <Info size={11} /> Not Linked
                            </span>
                          </Tooltip>
                        )}
                      </td>

                      {/* Plugins Count & Updates */}
                      <td className="px-4 py-4 text-center">
                        {site.wpConnected ? (
                          site.pluginsOutdated > 0 ? (
                            <button
                              onClick={() => setActivePluginModal(site)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <AlertTriangle size={12} />
                              {site.pluginsOutdated} Updates
                            </button>
                          ) : (
                            <button
                              onClick={() => setActivePluginModal(site)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                            >
                              All {site.pluginsTotal} Updated
                            </button>
                          )
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleScanSingle(site.clientId)}
                            disabled={isScanningThis}
                            title="Scan this site now"
                            className={`p-1.5 rounded-lg border transition-all ${
                              theme === 'white' 
                                ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-[#082a36]' 
                                : 'bg-zinc-800 hover:bg-zinc-700 border-white/5 text-zinc-300'
                            } disabled:opacity-50`}
                          >
                            <RefreshCw size={13} className={isScanningThis ? 'animate-spin' : ''} />
                          </button>

                          {site.wpConnected && (
                            <button
                              onClick={() => setActivePluginModal(site)}
                              title="Manage Plugins"
                              className={`p-1.5 rounded-lg border transition-all ${
                                theme === 'white' 
                                  ? 'bg-[#76c9be]/20 hover:bg-[#76c9be]/30 border-[#76c9be]/30 text-[#082a36]' 
                                  : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-400'
                              }`}
                            >
                              <Package size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plugin Inspector & Remote Update Modal */}
      {activePluginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
            theme === 'white' ? 'bg-white border-zinc-200 text-[#082a36]' : 'bg-zinc-900 border-white/10 text-white'
          }`}>
            {/* Modal Header */}
            <div className={`p-6 border-b flex items-center justify-between ${
              theme === 'white' ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-zinc-950'
            }`}>
              <div>
                <h3 className="text-lg font-bold font-heading flex items-center gap-2">
                  <Package className="text-blue-500" size={20} />
                  Plugin Manager &bull; {activePluginModal.clientName}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Remote maintenance via Netstripes Mission Control Bridge
                </p>
              </div>
              <button 
                onClick={() => {
                  if (updatingPlugin || isBulkUpdating) {
                    if (!confirm('A plugin update is currently running in the background. Are you sure you want to close this window?')) {
                      return;
                    }
                  }
                  setActivePluginModal(null);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  theme === 'white' ? 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200' : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {/* Live Upgrade Progress Bar */}
              {(updatingPlugin || isBulkUpdating) && updateProgressStep && (
                <div className={`p-4 rounded-2xl border space-y-2.5 animate-in slide-in-from-top-2 duration-300 ${
                  theme === 'white' 
                    ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-sm' 
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-2">
                      <Zap size={14} className="animate-spin text-amber-500" />
                      Live Remote Update in Progress...
                    </span>
                    <span className="font-mono text-[11px] opacity-80 animate-pulse">
                      Do not close window
                    </span>
                  </div>
                  {/* Visual Progress Bar Track */}
                  <div className="w-full h-2 rounded-full overflow-hidden bg-amber-200/50 dark:bg-amber-950/60">
                    <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse transition-all duration-500 w-3/4" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-medium text-amber-800 dark:text-amber-300/90">
                    <span>⚡ Current Action: <strong>{updateProgressStep}</strong></span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400">Mission Control Bridge API</span>
                  </div>
                </div>
              )}

              {bannerNotice && !updatingPlugin && !isBulkUpdating && (
                <div className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-in fade-in ${
                  theme === 'white' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  <Zap size={14} className={bannerNotice.includes('Updating') || bannerNotice.includes('Bulk') ? (theme === 'white' ? 'animate-spin text-amber-600' : 'animate-spin text-amber-400') : (theme === 'white' ? 'text-emerald-600' : 'text-emerald-400')} />
                  {bannerNotice}
                </div>
              )}

              {/* Toolbar: Sorting & Bulk Select Actions */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-colors ${
                theme === 'white' ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-950/60 border-white/5'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>Sort & View:</span>
                  <select
                    value={pluginSortFilter}
                    onChange={(e: any) => setPluginSortFilter(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                      theme === 'white' ? 'bg-white border-zinc-300 text-zinc-900 shadow-sm' : 'bg-zinc-900 border-white/10 text-white'
                    }`}
                  >
                    <option value="updates-first">⚡ Updates Pending First</option>
                    <option value="all">Alphabetical (All Plugins)</option>
                    <option value="active-only">Active Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {/* Select All Outdated Checkbox (Safe Plugins Only) */}
                  {activePluginModal.pluginsOutdated > 0 && (
                    <button
                      onClick={() => {
                        const safeOutdatedSlugs = (activePluginModal.pluginsData || [])
                          .filter(p => {
                            if (!p.has_update) return false;
                            const safety = checkPluginSafety(p.slug, p.name);
                            return !safety.isRestricted;
                          })
                          .map(p => p.slug);

                        if (selectedPluginSlugs.size === safeOutdatedSlugs.length && safeOutdatedSlugs.length > 0) {
                          setSelectedPluginSlugs(new Set());
                        } else {
                          setSelectedPluginSlugs(new Set(safeOutdatedSlugs));
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        theme === 'white' ? 'bg-white border border-zinc-300 hover:bg-zinc-200 text-zinc-800 shadow-sm' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {selectedPluginSlugs.size > 0 ? 'Deselect All' : `Select Safe Updates`}
                    </button>
                  )}

                  {/* Send Full Site Digest to Slack */}
                  {activePluginModal.pluginsOutdated > 0 && (
                    <Tooltip content="Send full categorized report of this site's pending updates to Slack (Safe vs High-Risk)">
                      <button
                        onClick={handleSendSiteSlackDigest}
                        disabled={sendingDigest}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                          theme === 'white'
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                      >
                        <MessageSquare size={13} className={sendingDigest ? 'animate-spin' : ''} />
                        {sendingDigest ? 'Sending...' : 'Slack Updates Digest'}
                      </button>
                    </Tooltip>
                  )}

                  {selectedPluginSlugs.size > 0 && (
                    <button
                      onClick={() => setPendingUpdateTarget({
                        clientId: activePluginModal.clientId,
                        pluginSlug: 'bulk',
                        pluginName: `${selectedPluginSlugs.size} Selected Plugins`,
                        isBulk: true
                      })}
                      disabled={isBulkUpdating}
                      className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all"
                    >
                      <Zap size={13} className={isBulkUpdating ? 'animate-spin' : ''} />
                      Update Selected ({selectedPluginSlugs.size})
                    </button>
                  )}
                </div>
              </div>

              <div className={`flex items-center justify-between text-xs px-1 ${
                theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                <span>Total Installed Plugins: <strong className={theme === 'white' ? 'text-zinc-900' : 'text-white'}>{activePluginModal.pluginsTotal}</strong></span>
                <span>Pending Updates: <strong className={theme === 'white' ? 'text-amber-600 font-black' : 'text-amber-400'}>{activePluginModal.pluginsOutdated}</strong></span>
              </div>

              {activePluginModal.pluginsData && activePluginModal.pluginsData.length > 0 ? (
                <div className={`divide-y border rounded-2xl overflow-hidden ${
                  theme === 'white' ? 'divide-zinc-200 border-zinc-200 bg-white' : 'divide-white/5 border-white/5 bg-zinc-900/40'
                }`}>
                  {(() => {
                    let sorted = [...activePluginModal.pluginsData];
                    if (pluginSortFilter === 'updates-first') {
                      sorted.sort((a, b) => (b.has_update ? 1 : 0) - (a.has_update ? 1 : 0));
                    } else if (pluginSortFilter === 'active-only') {
                      sorted = sorted.filter(p => p.is_active);
                    } else {
                      sorted.sort((a, b) => a.name.localeCompare(b.name));
                    }

                    return sorted.map((plugin) => {
                      const safety = checkPluginSafety(plugin.slug, plugin.name);
                      const isRestricted = safety.isRestricted;

                      return (
                        <div 
                          key={plugin.slug} 
                          className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                            plugin.has_update 
                              ? isRestricted
                                ? (theme === 'white' ? 'bg-rose-50/60 border-l-4 border-l-rose-500' : 'bg-rose-950/20 border-l-4 border-l-rose-500')
                                : (theme === 'white' ? 'bg-amber-500/10 border-l-4 border-l-amber-500' : 'bg-amber-500/10 border-l-4 border-l-amber-500')
                              : (theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-white/[0.02]')
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Checkbox for outdated plugin (Only if safe) */}
                            {plugin.has_update && (
                              isRestricted ? (
                                <Tooltip content={`Restricted: ${safety.reason}`}>
                                  <div className="p-1 rounded bg-rose-500/10 text-rose-500 cursor-not-allowed">
                                    <Lock size={14} />
                                  </div>
                                </Tooltip>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={selectedPluginSlugs.has(plugin.slug)}
                                  onChange={(e) => {
                                    const next = new Set(selectedPluginSlugs);
                                    if (e.target.checked) next.add(plugin.slug);
                                    else next.delete(plugin.slug);
                                    setSelectedPluginSlugs(next);
                                  }}
                                  className={`w-4 h-4 rounded text-amber-500 focus:ring-amber-400 shrink-0 cursor-pointer ${
                                    theme === 'white' ? 'border-zinc-300 bg-white' : 'border-zinc-700 bg-zinc-800'
                                  }`}
                                />
                              )
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-sm truncate ${
                                  theme === 'white' ? 'text-zinc-900 font-bold' : 'text-white'
                                }`}>{plugin.name}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
                                  plugin.is_active 
                                    ? (theme === 'white' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400')
                                    : (theme === 'white' ? 'bg-zinc-100 text-zinc-600 border border-zinc-200' : 'bg-zinc-800 text-zinc-500')
                                }`}>
                                  {plugin.is_active ? 'Active' : 'Inactive'}
                                </span>

                                {plugin.has_update && isRestricted && (
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                                    safety.riskLevel === 'CRITICAL'
                                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  }`}>
                                    <Lock size={10} />
                                    Tech Team Only
                                  </span>
                                )}
                              </div>
                              <div className={`flex items-center gap-3 text-xs mt-1 font-mono ${
                                theme === 'white' ? 'text-zinc-600' : 'text-zinc-500'
                              }`}>
                                <span>Version: <strong className={theme === 'white' ? 'text-zinc-800' : 'text-zinc-300'}>{plugin.current_version}</strong></span>
                                {plugin.has_update && (
                                  <span className={`font-bold flex items-center gap-1 ${
                                    isRestricted 
                                      ? (theme === 'white' ? 'text-rose-700' : 'text-rose-400')
                                      : (theme === 'white' ? 'text-amber-700' : 'text-amber-400')
                                  }`}>
                                    &rarr; New: {plugin.new_version}
                                  </span>
                                )}
                                <span className="truncate">By {plugin.author}</span>
                              </div>
                              {plugin.has_update && isRestricted && (
                                <p className={`text-[11px] mt-1 italic flex items-center gap-1 ${
                                  theme === 'white' ? 'text-rose-700' : 'text-rose-400/90'
                                }`}>
                                  <span>⚠️ {safety.reason}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Remote Action Button with Pre-update Warning */}
                          <div className="flex items-center gap-2">
                            {plugin.has_update ? (
                              isRestricted ? (
                                <div className="flex items-center gap-2">
                                  <Tooltip content={safety.reason || 'Restricted plugin'}>
                                    <button
                                      disabled={true}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-not-allowed flex items-center gap-1.5 border ${
                                        theme === 'white'
                                          ? 'bg-zinc-100 text-zinc-400 border-zinc-200'
                                          : 'bg-zinc-800/80 text-zinc-500 border-zinc-700/50'
                                      }`}
                                    >
                                      <Lock size={12} />
                                      Staging Required
                                    </button>
                                  </Tooltip>

                                  <Tooltip content="Send instant Slack alert to tech team with plugin details & staging request">
                                    <button
                                      onClick={() => handleNotifyTechTeam(plugin)}
                                      disabled={notifyingPlugin === plugin.slug}
                                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                                        theme === 'white'
                                          ? 'bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300'
                                          : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30'
                                      }`}
                                    >
                                      <Send size={12} className={notifyingPlugin === plugin.slug ? 'animate-spin' : ''} />
                                      {notifyingPlugin === plugin.slug ? 'Sending...' : 'Slack Tech'}
                                    </button>
                                  </Tooltip>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setPendingUpdateTarget({
                                    clientId: activePluginModal.clientId,
                                    pluginSlug: plugin.slug,
                                    pluginName: plugin.name,
                                    isBulk: false
                                  })}
                                  disabled={updatingPlugin === plugin.slug || isBulkUpdating}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                                >
                                  <Zap size={13} className={updatingPlugin === plugin.slug ? 'animate-spin' : ''} />
                                  {updatingPlugin === plugin.slug ? 'Updating...' : 'Update Now'}
                                </button>
                              )
                            ) : (
                              <span className={`text-xs font-bold flex items-center gap-1 ${
                                theme === 'white' ? 'text-emerald-700' : 'text-emerald-400'
                              }`}>
                                <CheckCircle2 size={13} /> Up to Date
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className={`py-12 text-center text-sm ${
                  theme === 'white' ? 'text-zinc-500' : 'text-zinc-500'
                }`}>
                  No plugin details reported by the bridge. Click "Scan this site now" to refresh.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`p-4 border-t flex justify-between items-center text-xs ${
              theme === 'white' ? 'border-zinc-200 bg-zinc-50 text-zinc-600' : 'border-white/5 bg-zinc-950 text-zinc-400'
            }`}>
              <span>Last scanned: {(() => {
                try {
                  return activePluginModal.scannedAt ? format(new Date(activePluginModal.scannedAt), 'MMM dd, yyyy HH:mm') : 'Recently';
                } catch {
                  return 'Recently';
                }
              })()}</span>
              <button
                onClick={() => {
                  if (updatingPlugin || isBulkUpdating) {
                    if (!confirm('A plugin update is currently running in the background. Are you sure you want to close this window?')) {
                      return;
                    }
                  }
                  setActivePluginModal(null);
                }}
                className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                  theme === 'white' ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-200/70' : 'border-zinc-700 text-zinc-300 hover:bg-white/5'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Update Warning Confirmation Modal */}
      {pendingUpdateTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className={`w-full max-w-md rounded-3xl border p-6 space-y-5 shadow-2xl ${
            theme === 'white' ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-white/10 text-white'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-2xl border ${
                theme === 'white' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className={`text-base font-bold ${
                  theme === 'white' ? 'text-zinc-900' : 'text-zinc-100'
                }`}>
                  {pendingUpdateTarget.isBulk ? 'Confirm Bulk Plugin Update' : 'Confirm Plugin Update'}
                </h3>
                <p className={`text-xs ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Target: <strong className={theme === 'white' ? 'text-amber-700' : 'text-amber-400'}>{pendingUpdateTarget.pluginName}</strong>
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed space-y-2 ${
              theme === 'white' ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
            }`}>
              <p>
                ⚠️ <strong>Pre-Update Safety Notice:</strong> Updating plugins remotely modifies files directly on the live client WordPress site.
              </p>
              <p className={`text-[11px] ${
                theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'
              }`}>
                Ensure the client site is currently stable and no active orders or live checkouts are in progress.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingUpdateTarget(null)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                  theme === 'white' ? 'border-zinc-300 text-zinc-700 hover:bg-zinc-100' : 'border-zinc-700 text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const target = pendingUpdateTarget;
                  setPendingUpdateTarget(null);
                  if (target.isBulk) {
                    handleBulkUpdateSelected();
                  } else {
                    handleRemoteUpdatePlugin(target.clientId, target.pluginSlug);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 text-black font-black text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
              >
                <Zap size={14} />
                Proceed with Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
