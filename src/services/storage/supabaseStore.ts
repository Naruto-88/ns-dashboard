import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readJsonStore, writeJsonStore } from './localStore';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://pzjfqrvmwlwfrtgojejl.supabase.co')
  .replace(/\/$/, '')
  .replace(/\/rest\/v1$/, '')
  .replace(/\/auth\/v1$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6amZxcnZtd2x3ZnJ0Z29qZWpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MDM0OSwiZXhwIjoyMDkzMDU2MzQ5fQ.a1ZhMrPLvhNRyJwsMGTupveV9rU0Gz_5qywuXipOuFI';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

// =========================================================================
// 1. SEO SNAPSHOTS (ROLLBACK AUDIT TRAIL)
// =========================================================================
const SNAPSHOTS_STORE_FILE = 'seo_snapshots.json';

export async function getSeoSnapshotsForClient(clientId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('seo_snapshots')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      // Table doesn't exist yet or permission error -> fallback to local disk JSON
      const localMap = readJsonStore<Record<string, any[]>>(SNAPSHOTS_STORE_FILE, {});
      return localMap[clientId] || [];
    }

    return (data || []).map(row => ({
      id: row.id,
      clientId: row.client_id,
      postId: row.post_id,
      targetUrl: row.target_url,
      ...row.snapshot_data,
      createdAt: row.created_at
    }));
  } catch {
    const localMap = readJsonStore<Record<string, any[]>>(SNAPSHOTS_STORE_FILE, {});
    return localMap[clientId] || [];
  }
}

export async function saveSeoSnapshotRecord(clientId: string, snapshot: any): Promise<void> {
  // Always update local cache as immediate backup
  const localMap = readJsonStore<Record<string, any[]>>(SNAPSHOTS_STORE_FILE, {});
  const existing = localMap[clientId] || [];
  localMap[clientId] = [snapshot, ...existing.filter((s: any) => s.postId !== snapshot.postId)];
  writeJsonStore(SNAPSHOTS_STORE_FILE, localMap);

  try {
    const { error } = await supabase
      .from('seo_snapshots')
      .insert({
        client_id: clientId,
        post_id: Number(snapshot.postId),
        target_url: snapshot.targetUrl || '',
        snapshot_data: snapshot
      });

    if (error) {
      console.warn('[supabaseStore] seo_snapshots insert warning (using local fallback):', error.message);
    }
  } catch (err: any) {
    console.warn('[supabaseStore] seo_snapshots error:', err.message);
  }
}

export async function deleteSeoSnapshotForPost(clientId: string, postId: number): Promise<void> {
  // Update local disk
  const localMap = readJsonStore<Record<string, any[]>>(SNAPSHOTS_STORE_FILE, {});
  if (localMap[clientId]) {
    localMap[clientId] = localMap[clientId].filter((s: any) => Number(s.postId) !== Number(postId));
    writeJsonStore(SNAPSHOTS_STORE_FILE, localMap);
  }

  try {
    await supabase
      .from('seo_snapshots')
      .delete()
      .eq('client_id', clientId)
      .eq('post_id', postId);
  } catch (err: any) {
    console.warn('[supabaseStore] seo_snapshots delete error:', err.message);
  }
}


// =========================================================================
// 2. BRAND PROFILES
// =========================================================================
const PROFILES_STORE = 'blog_brand_profiles.json';

export async function getBrandProfileRecord(clientId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('blog_brand_profiles')
      .select('profile')
      .eq('client_id', clientId)
      .maybeSingle();

    if (!error && data?.profile) {
      return data.profile;
    }
  } catch {}

  const localMap = readJsonStore<Record<string, any>>(PROFILES_STORE, {});
  return localMap[clientId] || null;
}

export async function saveBrandProfileRecord(clientId: string, profile: any): Promise<void> {
  const localMap = readJsonStore<Record<string, any>>(PROFILES_STORE, {});
  localMap[clientId] = { ...profile, clientId };
  writeJsonStore(PROFILES_STORE, localMap);

  try {
    await supabase
      .from('blog_brand_profiles')
      .upsert({
        client_id: clientId,
        profile: { ...profile, clientId },
        updated_at: new Date().toISOString()
      }, { onConflict: 'client_id' });
  } catch (err: any) {
    console.warn('[supabaseStore] blog_brand_profiles upsert warning:', err.message);
  }
}


// =========================================================================
// 3. LEARNED RULES (AI EDITORIAL KNOWLEDGE BASE)
// =========================================================================
const RULES_STORE = 'blog_learned_rules.json';

export async function getLearnedRulesRecord(clientId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('blog_learned_rules')
      .select('rules')
      .eq('client_id', clientId)
      .maybeSingle();

    if (!error && data?.rules && Array.isArray(data.rules) && data.rules.length > 0) {
      return data.rules;
    }
  } catch {}

  const localMap = readJsonStore<Record<string, string[]>>(RULES_STORE, {});
  return localMap[clientId] || [];
}

export async function saveLearnedRulesRecord(clientId: string, rules: string[]): Promise<void> {
  const localMap = readJsonStore<Record<string, string[]>>(RULES_STORE, {});
  localMap[clientId] = rules;
  writeJsonStore(RULES_STORE, localMap);

  try {
    await supabase
      .from('blog_learned_rules')
      .upsert({
        client_id: clientId,
        rules,
        updated_at: new Date().toISOString()
      }, { onConflict: 'client_id' });
  } catch (err: any) {
    console.warn('[supabaseStore] blog_learned_rules upsert warning:', err.message);
  }
}


// =========================================================================
// 4. BLOG DRAFTS
// =========================================================================
const DRAFTS_STORE = 'blog_drafts.json';

export async function getBlogDraftsForClient(clientId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('blog_drafts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(d => ({
        id: d.id,
        clientId: d.client_id,
        topic: d.topic,
        title: d.title,
        metaTitle: d.meta_title,
        metaDescription: d.meta_description,
        focusKeyword: d.focus_keyword,
        originalAiContent: d.original_ai_content,
        currentContent: d.current_content,
        reviewStatus: d.review_status,
        reviewedBy: d.reviewed_by,
        reviewedAt: d.reviewed_at,
        modelUsed: d.model_used,
        ...(d.draft_data || {}),
        generatedAt: d.created_at
      }));
    }
  } catch {}

  const localMap = readJsonStore<Record<string, any[]>>(DRAFTS_STORE, {});
  return localMap[clientId] || [];
}

export async function saveBlogDraftRecord(clientId: string, draft: any): Promise<void> {
  const localMap = readJsonStore<Record<string, any[]>>(DRAFTS_STORE, {});
  const existing = localMap[clientId] || [];
  localMap[clientId] = [draft, ...existing.filter((d: any) => d.id !== draft.id)];
  writeJsonStore(DRAFTS_STORE, localMap);

  try {
    await supabase
      .from('blog_drafts')
      .upsert({
        id: draft.id,
        client_id: clientId,
        topic: draft.topic || '',
        title: draft.title || '',
        meta_title: draft.metaTitle || '',
        meta_description: draft.metaDescription || '',
        focus_keyword: draft.focusKeyword || '',
        original_ai_content: draft.originalAiContent || '',
        current_content: draft.currentContent || '',
        review_status: draft.reviewStatus || 'PENDING_REVIEW',
        reviewed_by: draft.reviewedBy || null,
        reviewed_at: draft.reviewedAt || null,
        model_used: draft.modelUsed || '',
        draft_data: draft,
        created_at: draft.generatedAt || new Date().toISOString()
      }, { onConflict: 'id' });
  } catch (err: any) {
    console.warn('[supabaseStore] blog_drafts upsert warning:', err.message);
  }
}

export async function updateBlogDraftReviewRecord(
  clientId: string,
  draftId: string,
  status: string,
  writerEdits?: string,
  writerName?: string,
  writerTitle?: string
): Promise<void> {
  const localMap = readJsonStore<Record<string, any[]>>(DRAFTS_STORE, {});
  const drafts = localMap[clientId] || [];
  const idx = drafts.findIndex((d: any) => d.id === draftId);
  const now = new Date().toISOString();

  if (idx !== -1) {
    if (status) drafts[idx].reviewStatus = status;
    if (writerName) drafts[idx].reviewedBy = writerName;
    drafts[idx].reviewedAt = now;
    if (writerEdits !== undefined) drafts[idx].currentContent = writerEdits;
    if (writerTitle !== undefined) drafts[idx].title = writerTitle;
    localMap[clientId] = drafts;
    writeJsonStore(DRAFTS_STORE, localMap);
  }

  try {
    const updatePayload: any = {
      reviewed_at: now
    };
    if (status) updatePayload.review_status = status;
    if (writerName) updatePayload.reviewed_by = writerName;
    if (writerEdits !== undefined) updatePayload.current_content = writerEdits;
    if (writerTitle !== undefined) updatePayload.title = writerTitle;

    await supabase
      .from('blog_drafts')
      .update(updatePayload)
      .eq('id', draftId)
      .eq('client_id', clientId);
  } catch (err: any) {
    console.warn('[supabaseStore] blog_drafts update error:', err.message);
  }
}


// =========================================================================
// 5. BLOG CALENDAR
// =========================================================================
const CALENDAR_STORE = 'blog_calendar.json';

export async function getBlogCalendarForClient(clientId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('blog_calendar')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map(c => ({
        id: c.id,
        clientId: c.client_id,
        month: c.month,
        topic: c.topic,
        focusKeyword: c.focus_keyword,
        targetUrl: c.target_url,
        notes: c.notes,
        reviewStatus: c.review_status,
        generatedDraftId: c.generated_draft_id,
        ...(c.entry_data || {}),
        createdDate: c.created_at
      }));
    }
  } catch {}

  const localMap = readJsonStore<Record<string, any[]>>(CALENDAR_STORE, {});
  return localMap[clientId] || [];
}

export async function saveBlogCalendarRecords(clientId: string, entries: any[], overwrite: boolean): Promise<void> {
  const localMap = readJsonStore<Record<string, any[]>>(CALENDAR_STORE, {});
  const existing = localMap[clientId] || [];
  const updated = overwrite ? entries : [...existing, ...entries];
  localMap[clientId] = updated;
  writeJsonStore(CALENDAR_STORE, localMap);

  try {
    if (overwrite) {
      await supabase.from('blog_calendar').delete().eq('client_id', clientId);
    }

    const payload = entries.map(e => ({
      id: e.id,
      client_id: clientId,
      month: e.month || '',
      topic: e.topic || '',
      focus_keyword: e.focusKeyword || '',
      target_url: e.targetUrl || '',
      notes: e.notes || '',
      review_status: e.reviewStatus || 'PENDING_REVIEW',
      generated_draft_id: e.generatedDraftId || null,
      entry_data: e,
      created_at: e.createdDate || new Date().toISOString()
    }));

    if (payload.length > 0) {
      await supabase.from('blog_calendar').upsert(payload, { onConflict: 'id' });
    }
  } catch (err: any) {
    console.warn('[supabaseStore] blog_calendar save warning:', err.message);
  }
}

// =========================================================================
// 5. KEYWORD METRICS STORE (AHREFS / GOOGLE VOLUME & KD)
// =========================================================================
const KEYWORD_METRICS_STORE = 'keyword_metrics.json';

export interface KeywordAhrefsMetrics {
  volume: number;
  difficulty?: number;
  cpc?: number;
  syncedAt: string;
}

export async function getKeywordMetricsStore(clientId: string): Promise<Record<string, KeywordAhrefsMetrics>> {
  const localMap = readJsonStore<Record<string, Record<string, KeywordAhrefsMetrics>>>(KEYWORD_METRICS_STORE, {});
  return localMap[clientId] || {};
}

export async function saveKeywordMetricsStore(clientId: string, metricsMap: Record<string, KeywordAhrefsMetrics>): Promise<void> {
  const localMap = readJsonStore<Record<string, Record<string, KeywordAhrefsMetrics>>>(KEYWORD_METRICS_STORE, {});
  const existing = localMap[clientId] || {};
  localMap[clientId] = { ...existing, ...metricsMap };
  writeJsonStore(KEYWORD_METRICS_STORE, localMap);
}

