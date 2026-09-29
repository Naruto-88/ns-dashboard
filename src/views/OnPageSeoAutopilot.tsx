import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  RotateCcw, 
  CheckCircle, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  ShieldAlert, 
  Clock, 
  Sliders, 
  ChevronRight,
  ArrowRight,
  Check,
  AlertCircle,
  Code2,
  ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { useModalDialog } from '../contexts/ModalDialogContext';
import AiCommanderChat from '../components/AiCommanderChat';

interface PostSeoItem {
  id: number;
  title: string;
  slug: string;
  post_type: string;
  status: string;
  link: string;
  date: string;
  excerpt: string;
  seo_plugin: string;
  rank_math: {
    title: string;
    description: string;
    focus_keyword: string;
  };
  effective_seo: {
    title: string;
    description: string;
    focus_keyword: string;
    schema?: any;
  };
}

export default function OnPageSeoAutopilot() {
  const { theme } = useTheme();
  const modalDialog = useModalDialog();
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [posts, setPosts] = useState<PostSeoItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPostType, setSelectedPostType] = useState<string>('all');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Active Post for AI Optimization
  const [activePost, setActivePost] = useState<PostSeoItem | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [aiProposal, setAiProposal] = useState<{
    meta_title: string;
    meta_description: string;
    focus_keyword: string;
    reasoning: string;
    schema_json?: any;
  } | null>(null);
  const [customPostTitle, setCustomPostTitle] = useState('');
  const [updateWpPostTitle, setUpdateWpPostTitle] = useState(true);
  const [customSchemaJson, setCustomSchemaJson] = useState('');
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const [customKeyword, setCustomKeyword] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedPostIds, setAppliedPostIds] = useState<Set<number>>(new Set());
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);

  // Load clients
  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name, short_code, wordpress_url, gsc_site_url, api_import_enabled')
      .order('name')
      .then(({ data }) => {
        const active = (data || []).filter(c => c.api_import_enabled !== false);
        setClients(active);
        if (active.length > 0) {
          setSelectedClientId(active[0].id);
        }
      });
  }, []);

  // Fetch Posts for selected client (fetches all items once)
  const fetchPosts = async (clientId: string) => {
    if (!clientId) return;
    setLoadingPosts(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/seo-autopilot/posts?clientId=${clientId}&perPage=100`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch posts from WordPress site.');
      }
      setPosts(data.posts || []);
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message });
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (selectedClientId) {
      fetchPosts(selectedClientId);
      setActivePost(null);
      setAiProposal(null);
      // Fetch persisted snapshot IDs so rollback button is available even after refresh
      fetch(`/api/seo-autopilot/snapshots?clientId=${selectedClientId}`)
        .then(r => r.json())
        .then(d => {
          if (d.postIds && Array.isArray(d.postIds)) {
            setAppliedPostIds(new Set(d.postIds));
          }
        })
        .catch(() => {});
    }

    const handleSeoUpdated = (e: any) => {
      if (!e.detail?.clientId || e.detail.clientId === selectedClientId) {
        if (selectedClientId) {
          fetchPosts(selectedClientId);
        }
      }
    };

    window.addEventListener('mc_seo_updated', handleSeoUpdated);
    return () => {
      window.removeEventListener('mc_seo_updated', handleSeoUpdated);
    };
  }, [selectedClientId]);

  // Trigger AI Optimization for a specific post
  const handleStartOptimize = async (post: PostSeoItem, overrideKeyword?: string) => {
    setActivePost(post);
    setAiProposal(null);
    setCustomPostTitle(post.title);
    setUpdateWpPostTitle(true);
    const targetKw = overrideKeyword !== undefined ? overrideKeyword : (post.effective_seo.focus_keyword || '');
    setCustomKeyword(targetKw);
    setOptimizing(true);

    try {
      const res = await fetch('/api/seo-autopilot/generate-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          postTitle: post.title,
          postExcerpt: post.excerpt,
          currentMeta: post.effective_seo,
          focusKeyword: targetKw
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI generation failed');
      setAiProposal(data.data);
      if (data.data?.meta_title) {
        setCustomPostTitle(data.data.meta_title);
      }
      if (data.data?.schema_json) {
        setCustomSchemaJson(typeof data.data.schema_json === 'string' ? data.data.schema_json : JSON.stringify(data.data.schema_json, null, 2));
      } else if (post.effective_seo?.schema) {
        setCustomSchemaJson(typeof post.effective_seo.schema === 'string' ? post.effective_seo.schema : JSON.stringify(post.effective_seo.schema, null, 2));
      } else {
        setCustomSchemaJson('');
      }
    } catch (e: any) {
      setNotice({ type: 'error', message: `AI Generation Error: ${e.message}` });
    } finally {
      setOptimizing(false);
    }
  };

  // Apply Proposed Meta to WordPress Site
  const handleApplyToSite = async () => {
    if (!activePost || !aiProposal) return;
    setApplying(true);
    try {
      const finalWpTitle = updateWpPostTitle ? customPostTitle.trim() : undefined;
      let parsedSchema: any = null;
      if (customSchemaJson.trim()) {
        try {
          parsedSchema = JSON.parse(customSchemaJson.trim());
        } catch {
          parsedSchema = customSchemaJson.trim();
        }
      }

      const res = await fetch('/api/seo-autopilot/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          postId: activePost.id,
          postTitle: finalWpTitle,
          updatePostTitle: updateWpPostTitle,
          metaTitle: aiProposal.meta_title,
          metaDescription: aiProposal.meta_description,
          focusKeyword: aiProposal.focus_keyword,
          schemaJson: parsedSchema,
          currentSnapshot: activePost.rank_math
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update WordPress SEO meta');

      // Update in local state
      setPosts(prev => prev.map(p => {
        if (p.id === activePost.id) {
          return {
            ...p,
            title: finalWpTitle || p.title,
            effective_seo: {
              title: aiProposal.meta_title,
              description: aiProposal.meta_description,
              focus_keyword: aiProposal.focus_keyword,
              schema: parsedSchema || p.effective_seo.schema
            },
            rank_math: {
              title: aiProposal.meta_title,
              description: aiProposal.meta_description,
              focus_keyword: aiProposal.focus_keyword
            }
          };
        }
        return p;
      }));

      setAppliedPostIds(prev => new Set(prev).add(activePost.id));
      setNotice({ type: 'success', message: `Successfully updated ${updateWpPostTitle ? 'Post Title & ' : ''}SEO meta on "${finalWpTitle || activePost.title}". Pre-update snapshot safely saved.` });
      setActivePost(null);
      setAiProposal(null);
    } catch (e: any) {
      setNotice({ type: 'error', message: `Update Failed: ${e.message}` });
    } finally {
      setApplying(false);
    }
  };

  // Rollback to original snapshot
  const handleRollback = async (post: PostSeoItem) => {
    const confirmed = await modalDialog.confirm({
      title: 'Rollback SEO Metadata',
      message: `Are you sure you want to rollback SEO metadata for "${post.title}" to its original version?`,
      confirmLabel: 'Rollback Now',
      type: 'warning',
      destructive: true
    });
    if (!confirmed) {
      return;
    }
    setRollingBackId(post.id);
    try {
      const res = await fetch('/api/seo-autopilot/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClientId,
          postId: post.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rollback failed.');

      // Update local state
      setPosts(prev => prev.map(p => {
        if (p.id === post.id) {
          return {
            ...p,
            effective_seo: {
              title: data.restoredValues.metaTitle,
              description: data.restoredValues.metaDescription,
              focus_keyword: data.restoredValues.focusKeyword
            }
          };
        }
        return p;
      }));

      setAppliedPostIds(prev => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });

      setNotice({ type: 'success', message: `100% Rollback completed for "${post.title}"! Original metadata restored.` });
    } catch (e: any) {
      setNotice({ type: 'error', message: `Rollback error: ${e.message}` });
    } finally {
      setRollingBackId(null);
    }
  };

  const filteredPosts = posts.filter(p => {
    const matchesSearch = 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.slug.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedPostType !== 'all') {
      return p.post_type === selectedPostType;
    }
    return true;
  });

  return (
    <div className={`p-8 space-y-8 ${theme === 'white' ? 'bg-[#f8fafc] text-slate-800' : 'text-zinc-100'}`}>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
              <Sparkles size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                AI On-Page SEO Autopilot
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-widest">
                  Rank Math Ready
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Audit, optimize, and live-update WordPress meta titles, descriptions & focus keywords with 100% safe snapshots & one-click rollback.
              </p>
            </div>
          </div>
        </div>

        {/* Client Selector & Refresh */}
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
            onClick={() => fetchPosts(selectedClientId)}
            disabled={loadingPosts}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
              theme === 'white' ? 'bg-white hover:bg-zinc-50 border-zinc-200' : 'bg-zinc-900 hover:bg-zinc-800 border-white/10'
            }`}
            title="Refresh Posts"
          >
            <RefreshCw size={16} className={loadingPosts ? 'animate-spin text-emerald-400' : 'text-zinc-400'} />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className={`p-4 rounded-2xl text-xs font-medium flex items-center justify-between animate-in fade-in duration-300 border ${
          notice.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          notice.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
          'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            <span>{notice.message}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
      )}

      {/* Main Grid: Posts Table & Optimization Modal / Drawer */}
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border w-full sm:w-72 ${
              theme === 'white' ? 'bg-white border-zinc-200' : 'bg-zinc-900/80 border-white/5'
            }`}>
              <Search size={16} className="text-zinc-500 shrink-0" />
              <input 
                type="text"
                placeholder="Filter by title, slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-transparent text-xs outline-none w-full font-medium ${
                  theme === 'white' ? 'text-zinc-900 placeholder-zinc-400' : 'text-zinc-100 placeholder-zinc-500'
                }`}
              />
            </div>

            {/* Post Type Selector Pills */}
            <div className={`flex items-center gap-1 p-1 rounded-xl border ${
              theme === 'white' ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-white/10'
            }`}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'page', label: 'Pages' },
                { id: 'post', label: 'Posts' },
                { id: 'product', label: 'Products' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedPostType(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    selectedPostType === tab.id
                      ? (theme === 'white' ? 'bg-white text-zinc-900 shadow-sm' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')
                      : (theme === 'white' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200')
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-zinc-500 font-bold">
            Showing {filteredPosts.length} of {posts.length} items
          </div>
        </div>

        {/* Posts Table */}
        <div className={`rounded-2xl border overflow-hidden ${
          theme === 'white' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-900/50 border-white/5'
        }`}>
          {loadingPosts ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-emerald-400 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">Connecting to WordPress REST API and fetching Rank Math tags...</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs">
              No published posts or pages discovered. Ensure the Bridge plugin is active on the client site.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className={`border-b font-black uppercase tracking-wider text-[11px] ${
                    theme === 'white' 
                      ? 'bg-zinc-100/80 border-zinc-200 text-zinc-700' 
                      : 'bg-zinc-950/60 border-white/5 text-zinc-400'
                  }`}>
                    <th className="p-4">Type</th>
                    <th className="p-4">Title & URL</th>
                    <th className="p-4">Current SEO Title</th>
                    <th className="p-4">Meta Description</th>
                    <th className="p-4">Focus Keyword</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  theme === 'white' ? 'divide-zinc-200' : 'divide-zinc-800/40'
                }`}>
                  {filteredPosts.map((post) => {
                    const titleLen = post.effective_seo.title?.length || 0;
                    const descLen = post.effective_seo.description?.length || 0;
                    const isOptimalTitle = titleLen >= 45 && titleLen <= 60;
                    const isOptimalDesc = descLen >= 130 && descLen <= 160;

                    return (
                      <tr key={post.id} className={`transition-colors ${
                        theme === 'white' ? 'hover:bg-zinc-50' : 'hover:bg-zinc-800/20'
                      }`}>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            post.post_type === 'product'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : post.post_type === 'page'
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}>
                            {post.post_type}
                          </span>
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className={`font-bold truncate ${
                            theme === 'white' ? 'text-zinc-900' : 'text-zinc-200'
                          }`}>
                            {post.title}
                          </div>
                          <a 
                            href={post.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`text-[11px] flex items-center gap-1 mt-0.5 truncate transition-colors ${
                              theme === 'white' 
                                ? 'text-zinc-500 hover:text-emerald-600' 
                                : 'text-zinc-400 hover:text-emerald-400'
                            }`}
                          >
                            /{post.slug}
                            <ExternalLink size={10} />
                          </a>
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className={`truncate font-medium ${
                            theme === 'white' ? 'text-zinc-800' : 'text-zinc-300'
                          }`}>
                            {post.effective_seo.title || <span className="text-zinc-400 italic">Default WP Title</span>}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                            <span className={`font-mono font-bold ${
                              isOptimalTitle 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              {titleLen} chars
                            </span>
                            {!isOptimalTitle && (
                              <span className="text-zinc-400 text-[9px]">(ideal: 50-60)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 max-w-sm">
                          <div className={`line-clamp-2 text-[11px] leading-relaxed ${
                            theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'
                          }`}>
                            {post.effective_seo.description || (
                              <span className="text-amber-600 dark:text-amber-500/70 font-semibold italic">Missing Meta Description</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                            <span className={`font-mono font-bold ${
                              isOptimalDesc 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : descLen === 0 
                                ? 'text-rose-600 dark:text-rose-400' 
                                : 'text-amber-600 dark:text-amber-400'
                            }`}>
                              {descLen} chars
                            </span>
                            {!isOptimalDesc && (
                              <span className="text-zinc-400 text-[9px]">(ideal: 140-155)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {post.effective_seo.focus_keyword ? (
                            <span className={`inline-block px-2.5 py-1 rounded-lg font-mono text-[11px] border ${
                              theme === 'white'
                                ? 'bg-zinc-100 border-zinc-200 text-zinc-800'
                                : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                            }`}>
                              {post.effective_seo.focus_keyword}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">None</span>
                          )}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStartOptimize(post)}
                              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
                            >
                              <Sparkles size={13} />
                              AI Optimize
                            </button>

                            {appliedPostIds.has(post.id) && (
                              <button
                                onClick={() => handleRollback(post)}
                                disabled={rollingBackId === post.id}
                                className={`p-1.5 rounded-xl border transition-all ${
                                  theme === 'white'
                                    ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/5'
                                }`}
                                title="100% Rollback to original snapshot"
                              >
                                <RotateCcw size={13} className={rollingBackId === post.id ? 'animate-spin text-amber-400' : ''} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI Optimization Drawer / Modal */}
      {activePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-2xl rounded-3xl border p-6 space-y-6 shadow-2xl overflow-y-auto max-h-[90vh] ${
            theme === 'white' ? 'bg-white border-zinc-200 text-slate-800' : 'bg-zinc-950 border-white/10 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${theme === 'white' ? 'border-zinc-200' : 'border-zinc-800'}`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className={`font-bold text-base ${theme === 'white' ? 'text-zinc-900' : 'text-white'}`}>Optimize SEO Metadata</h3>
                  <p className={`text-xs ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-400'}`}>Target: <span className="font-medium">{activePost.title}</span></p>
                </div>
              </div>
              <button 
                onClick={() => setActivePost(null)}
                className={`p-2 rounded-lg text-lg transition-colors ${theme === 'white' ? 'text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}
              >
                ✕
              </button>
            </div>

            {optimizing ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-emerald-500 mx-auto" />
                <p className={`text-xs font-bold ${theme === 'white' ? 'text-zinc-800' : 'text-zinc-200'}`}>Gemini AI is analyzing page intent & crafting high-CTR metadata...</p>
                <p className={`text-[11px] ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-400'}`}>Checking Google Search character guidelines and local intent.</p>
              </div>
            ) : aiProposal ? (
              <div className="space-y-5">
                {/* Comparison Card */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Current Live State */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${
                    theme === 'white' 
                      ? 'bg-zinc-50 border-zinc-200 text-zinc-800' 
                      : 'bg-zinc-900/60 border-white/5 text-zinc-300'
                  }`}>
                    <span className={`text-[10px] font-black uppercase tracking-wider ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-400'}`}>Current On Site</span>
                    <div>
                      <div className={`text-[11px] font-semibold ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>SEO Title:</div>
                      <p className={`text-xs font-medium mt-1 leading-snug ${theme === 'white' ? 'text-zinc-900' : 'text-zinc-200'}`}>{activePost.effective_seo.title || 'Default Title'}</p>
                      <span className={`text-[10px] ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-500'}`}>({activePost.effective_seo.title?.length || 0} chars)</span>
                    </div>
                    <div>
                      <div className={`text-[11px] font-semibold ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>Meta Description:</div>
                      <p className={`text-xs mt-1 leading-relaxed ${theme === 'white' ? 'text-zinc-700' : 'text-zinc-400'}`}>{activePost.effective_seo.description || 'None'}</p>
                      <span className={`text-[10px] ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-500'}`}>({activePost.effective_seo.description?.length || 0} chars)</span>
                    </div>
                    <div>
                      <div className={`text-[11px] font-semibold ${theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}`}>Current Focus Keyword:</div>
                      <span className={`inline-block mt-1 px-2.5 py-1 rounded-lg text-xs font-mono font-medium ${
                        theme === 'white' ? 'bg-zinc-200/70 text-zinc-800' : 'bg-zinc-800 text-zinc-300'
                      }`}>
                        {activePost.effective_seo.focus_keyword || 'Not set in WordPress'}
                      </span>
                    </div>
                  </div>

                  {/* AI Proposed Optimization */}
                  <div className={`p-4 rounded-2xl border space-y-3.5 ${
                    theme === 'white' 
                      ? 'bg-emerald-50/60 border-emerald-200' 
                      : 'bg-emerald-950/20 border-emerald-500/30'
                  }`}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" /> AI Proposed (Google Optimal)
                    </span>
                    {/* WordPress Core Post Title Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className={`text-[11px] font-semibold block ${theme === 'white' ? 'text-zinc-800' : 'text-zinc-200'}`}>
                          WordPress Post Title (Admin & H1):
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={updateWpPostTitle}
                            onChange={(e) => setUpdateWpPostTitle(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-0"
                          />
                          <span className={theme === 'white' ? 'text-zinc-600' : 'text-zinc-400'}>Update WordPress Post Title</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        disabled={!updateWpPostTitle}
                        value={customPostTitle}
                        onChange={(e) => setCustomPostTitle(e.target.value)}
                        className={`w-full p-2.5 rounded-xl text-xs outline-none font-medium border transition-colors ${
                          !updateWpPostTitle
                            ? (theme === 'white' ? 'bg-zinc-100 text-zinc-400 border-zinc-200' : 'bg-zinc-800/40 text-zinc-500 border-white/5')
                            : (theme === 'white' 
                              ? 'bg-white border-zinc-300 text-zinc-900 focus:border-blue-500 shadow-sm' 
                              : 'bg-zinc-900 border-white/10 text-white focus:border-blue-400')
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`text-[11px] font-semibold block mb-1 ${theme === 'white' ? 'text-emerald-900' : 'text-emerald-300'}`}>Proposed SEO Title (Rank Math / Yoast):</label>
                      <input
                        type="text"
                        value={aiProposal.meta_title}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAiProposal({ ...aiProposal, meta_title: val });
                          if (updateWpPostTitle && !customPostTitle) {
                            setCustomPostTitle(val);
                          }
                        }}
                        className={`w-full p-2.5 rounded-xl text-xs outline-none font-medium border transition-colors ${
                          theme === 'white' 
                            ? 'bg-white border-emerald-300 text-zinc-900 focus:border-emerald-600 shadow-sm' 
                            : 'bg-zinc-900 border-emerald-500/30 text-white focus:border-emerald-400'
                        }`}
                      />
                      <span className={`text-[10px] font-mono mt-1 block font-semibold ${
                        aiProposal.meta_title.length <= 60 
                          ? (theme === 'white' ? 'text-emerald-700' : 'text-emerald-400') 
                          : (theme === 'white' ? 'text-amber-700' : 'text-amber-400')
                      }`}>
                        {aiProposal.meta_title.length} chars (Target: &lt;60)
                      </span>
                    </div>

                    <div>
                      <label className={`text-[11px] font-semibold block mb-1 ${theme === 'white' ? 'text-emerald-900' : 'text-emerald-300'}`}>Proposed Meta Description:</label>
                      <textarea
                        rows={3}
                        value={aiProposal.meta_description}
                        onChange={(e) => setAiProposal({ ...aiProposal, meta_description: e.target.value })}
                        className={`w-full p-2.5 rounded-xl text-xs outline-none font-medium leading-relaxed border transition-colors ${
                          theme === 'white' 
                            ? 'bg-white border-emerald-300 text-zinc-900 focus:border-emerald-600 shadow-sm' 
                            : 'bg-zinc-900 border-emerald-500/30 text-white focus:border-emerald-400'
                        }`}
                      />
                      <span className={`text-[10px] font-mono mt-1 block font-semibold ${
                        aiProposal.meta_description.length >= 140 && aiProposal.meta_description.length <= 155 
                          ? (theme === 'white' ? 'text-emerald-700' : 'text-emerald-400') 
                          : (theme === 'white' ? 'text-amber-700' : 'text-amber-400')
                      }`}>
                        {aiProposal.meta_description.length} chars (Target: 140-155)
                      </span>
                    </div>

                    <div>
                      <label className={`text-[11px] font-semibold block mb-1 ${theme === 'white' ? 'text-emerald-900' : 'text-emerald-300'}`}>Focus Keyword:</label>
                      <input
                        type="text"
                        value={aiProposal.focus_keyword}
                        onChange={(e) => setAiProposal({ ...aiProposal, focus_keyword: e.target.value })}
                        className={`w-full p-2.5 rounded-xl text-xs outline-none font-medium border transition-colors ${
                          theme === 'white' 
                            ? 'bg-white border-emerald-300 text-zinc-900 focus:border-emerald-600 shadow-sm' 
                            : 'bg-zinc-900 border-emerald-500/30 text-white focus:border-emerald-400'
                        }`}
                      />
                    </div>

                    {/* Google Schema Markup (JSON-LD) Section */}
                    <div className="pt-2 border-t border-emerald-200/50 dark:border-emerald-500/20">
                      <button
                        type="button"
                        onClick={() => setShowSchemaEditor(!showSchemaEditor)}
                        className={`w-full flex items-center justify-between text-[11px] font-bold py-1 transition-colors ${
                          theme === 'white' ? 'text-emerald-800 hover:text-emerald-950' : 'text-emerald-300 hover:text-emerald-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Code2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                          Schema Markup (JSON-LD for Google)
                          {customSchemaJson && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${showSchemaEditor ? 'rotate-180' : ''}`} />
                      </button>

                      {showSchemaEditor && (
                        <div className="mt-2 space-y-1.5">
                          <textarea
                            rows={6}
                            value={customSchemaJson}
                            onChange={(e) => setCustomSchemaJson(e.target.value)}
                            placeholder='{ "@context": "https://schema.org", "@type": "Article", ... }'
                            className={`w-full p-2.5 rounded-xl font-mono text-[11px] outline-none leading-relaxed border transition-colors ${
                              theme === 'white' 
                                ? 'bg-white border-emerald-300 text-zinc-800 focus:border-emerald-600 shadow-sm' 
                                : 'bg-zinc-950 border-emerald-500/30 text-emerald-300 focus:border-emerald-400'
                            }`}
                          />
                          <p className={`text-[10px] ${theme === 'white' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                            Injected automatically as &lt;script type="application/ld+json"&gt; in &lt;head&gt; without altering theme files.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Reasoning Note */}
                <div className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  theme === 'white' 
                    ? 'bg-zinc-50 border-zinc-200 text-zinc-700' 
                    : 'bg-zinc-900 border-white/5 text-zinc-300'
                }`}>
                  <span className={`font-bold ${theme === 'white' ? 'text-emerald-700' : 'text-emerald-400'}`}>Why this works:</span>
                  <span className={`${theme === 'white' ? 'text-zinc-800' : 'text-zinc-300'} leading-relaxed`}>{aiProposal.reasoning}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => handleStartOptimize(activePost, aiProposal.focus_keyword)}
                    className={`text-xs flex items-center gap-1.5 font-bold transition-colors ${
                      theme === 'white' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <RefreshCw size={13} />
                    Regenerate with Focus Keyword
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActivePost(null)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                        theme === 'white' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyToSite}
                      disabled={applying}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs hover:brightness-110 shadow-lg shadow-emerald-500/30 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {applying ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                      {applying ? 'Pushing to WordPress...' : 'Apply & Save Snapshot'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Floating Interactive MCP Commander Chat */}
      <AiCommanderChat 
        clientId={selectedClientId} 
        clientName={clients.find(c => c.id === selectedClientId)?.name} 
      />
    </div>
  );
}
