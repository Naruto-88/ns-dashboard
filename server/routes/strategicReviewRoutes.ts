import express from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { auditSingleClient, extractCleanBaseUrl } from '../../src/services/siteHealth/healthScanner';
import { buildStrategicReviewPrompt } from '../../src/services/siteHealth/strategicReviewService';

export interface StrategicReviewDeps {
  supabase: SupabaseClient;
  strategicReviewMemoryCache: Map<string, any>;
  executeStrategicAiModel: (prompt: string, model?: string) => Promise<{ text: string; modelUsed: string }>;
  cleanJsonString: (raw: string) => string;
}

export function registerStrategicReviewRoutes(app: express.Express, deps: StrategicReviewDeps) {
  const { supabase, strategicReviewMemoryCache, executeStrategicAiModel, cleanJsonString } = deps;

  // 1. GET all Strategic Reviews for dashboard
  app.get('/api/strategic-reviews/all', async (req, res) => {
    try {
      const { data: clients, error: clientErr } = await supabase
        .from('clients')
        .select('id, name, short_code, project_owner_name, project_owner_code, lead_target_monthly, target_dr, gsc_site_url, wordpress_url, api_import_enabled')
        .order('name');

      if (clientErr) throw clientErr;

      const activeClients = (clients || []).filter((c) => c.api_import_enabled !== false);

      let dbReviews: any[] = [];
      try {
        const { data } = await supabase.from('strategic_reviews').select('*');
        if (data) dbReviews = data;
      } catch {
        // ignore
      }

      const reviews = activeClients.map((c) => {
        const dbRow = dbReviews.find((r) => r.client_id === c.id);
        const memRow = strategicReviewMemoryCache.get(c.id);
        const item = dbRow || memRow;

        if (item) {
          return {
            id: item.id || c.id,
            clientId: c.id,
            clientName: c.name,
            shortCode: c.short_code,
            projectOwner: c.project_owner_name || 'Melaka',
            projectOwnerCode: c.project_owner_code || 'MW',
            siteUrl: item.site_url || extractCleanBaseUrl(c.gsc_site_url, c.wordpress_url),
            periodStart: item.period_start || format(new Date(), 'yyyy-MM-01'),
            periodEnd: item.period_end || format(new Date(), 'yyyy-MM-dd'),
            clicks: item.clicks ?? 0,
            phones: item.phones ?? 0,
            leadsActual: item.leads_actual ?? 0,
            leadsTarget: item.leads_target ?? (c.lead_target_monthly ? Math.round(c.lead_target_monthly / 4) : 0),
            drActual: item.dr_actual ?? 0,
            siteReality: item.site_reality || 'Pending first review generation.',
            conversionGaps: item.conversion_gaps || 'Pending first review generation.',
            actionsFortnight: item.actions_fortnight || [],
            actionsNext: item.actions_next || [],
            actionsLater: item.actions_later || [],
            teamFeedback: item.team_feedback || [],
            overallStatus: item.overall_status || 'PENDING_REVIEW',
            generatedByModel: item.generated_by_model || 'System',
            lastGeneratedAt: item.last_generated_at || null,
          };
        }

        return {
          id: c.id,
          clientId: c.id,
          clientName: c.name,
          shortCode: c.short_code,
          projectOwner: c.project_owner_name || 'Melaka',
          projectOwnerCode: c.project_owner_code || 'MW',
          siteUrl: extractCleanBaseUrl(c.gsc_site_url, c.wordpress_url),
          periodStart: format(new Date(), 'yyyy-MM-01'),
          periodEnd: format(new Date(), 'yyyy-MM-dd'),
          clicks: 0,
          phones: 0,
          leadsActual: 0,
          leadsTarget: c.lead_target_monthly ? Math.round(c.lead_target_monthly / 4) : 0,
          drActual: 0,
          siteReality: 'Click "Generate Review" to analyze real site against dashboard data.',
          conversionGaps: 'Awaiting synthesis.',
          actionsFortnight: [],
          actionsNext: [],
          actionsLater: [],
          teamFeedback: [],
          overallStatus: 'PENDING_REVIEW',
          generatedByModel: 'None',
          lastGeneratedAt: null,
        };
      });

      res.json({ success: true, count: reviews.length, data: reviews });
    } catch (error: any) {
      console.error('Strategic Reviews Fetch Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. GENERATE Strategic Review for a single client (Synthesis of Metrics + Site Health + AI)
  app.post('/api/strategic-reviews/generate/:clientId', async (req, res) => {
    const { clientId } = req.params;
    const { model } = req.body || {};

    try {
      const { data: client, error: cErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (cErr || !client) return res.status(404).json({ error: 'Client not found' });

      const { data: weekly } = await supabase
        .from('weekly_data')
        .select('*')
        .eq('client_id', clientId)
        .order('week_start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const healthAudit = await auditSingleClient(client);
      const prompt = buildStrategicReviewPrompt(client, weekly || {}, healthAudit);
      const { text, modelUsed } = await executeStrategicAiModel(prompt, model);

      let parsedAi: any = {};
      try {
        const cleaned = cleanJsonString(text);
        parsedAi = JSON.parse(cleaned);
      } catch {
        parsedAi = {
          siteReality: text.slice(0, 500),
          conversionGaps: 'Parsed from summary stream.',
          actionsFortnight: [
            {
              id: 'act-1',
              action: 'Inspect and fix technical lead flows',
              why: 'Conversion barrier',
              who: client.project_owner_name,
              priority: 'Must-Do',
              status: 'Pending',
            },
          ],
        };
      }

      const reviewRecord = {
        client_id: client.id,
        period_start: format(new Date(), 'yyyy-MM-01'),
        period_end: format(new Date(), 'yyyy-MM-dd'),
        clicks: weekly?.gsc_clicks ?? 0,
        phones: weekly?.phone_calls ?? 0,
        leads_actual: weekly?.leads_legit ?? 0,
        leads_target: client.lead_target_monthly ? Math.round(client.lead_target_monthly / 4) : 0,
        dr_actual: weekly?.ahrefs_dr ?? 0,
        site_reality: parsedAi.siteReality || 'Analyzed live site.',
        conversion_gaps: parsedAi.conversionGaps || 'Identified conversion barriers.',
        actions_fortnight: parsedAi.actionsFortnight || [],
        actions_next: parsedAi.actionsNext || [],
        actions_later: parsedAi.actionsLater || [],
        team_feedback: strategicReviewMemoryCache.get(client.id)?.team_feedback || [],
        overall_status: 'PENDING_REVIEW',
        generated_by_model: modelUsed,
        last_generated_at: new Date().toISOString(),
      };

      strategicReviewMemoryCache.set(client.id, reviewRecord);

      try {
        await supabase.from('strategic_reviews').upsert(reviewRecord, { onConflict: 'client_id,period_start,period_end' });
      } catch {
        // fallback to memory
      }

      res.json({
        success: true,
        message: `Strategic review generated using ${modelUsed}`,
        data: {
          ...reviewRecord,
          clientId: client.id,
          clientName: client.name,
          shortCode: client.short_code,
          projectOwner: client.project_owner_name,
          siteUrl: healthAudit.siteUrl,
        },
      });
    } catch (err: any) {
      console.error(`Strategic generation error for ${clientId}:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // 3. POST Team Comment & Agreement (CEO / PMs / Devs sign-off)
  app.post('/api/strategic-reviews/feedback', async (req, res) => {
    const { clientId, userName, userRole, agreement, comment } = req.body;
    if (!clientId || !userName) {
      return res.status(400).json({ error: 'clientId and userName are required' });
    }

    try {
      const existing = strategicReviewMemoryCache.get(clientId) || {};
      const feedbackList = existing.team_feedback || [];

      const newFeedbackEntry = {
        id: `fb-${Date.now()}`,
        userName,
        userRole: userRole || 'Team Member',
        agreement: agreement || 'AGREE',
        comment: comment || '',
        createdAt: new Date().toISOString(),
      };

      const updatedFeedback = [newFeedbackEntry, ...feedbackList];
      const newStatus = agreement === 'DISAGREE' ? 'HAS_OBJECTIONS' : 'AGREED';

      existing.team_feedback = updatedFeedback;
      existing.overall_status = newStatus;
      strategicReviewMemoryCache.set(clientId, existing);

      try {
        await supabase
          .from('strategic_reviews')
          .update({
            team_feedback: updatedFeedback,
            overall_status: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('client_id', clientId);
      } catch {
        // ignore
      }

      res.json({
        success: true,
        message: 'Feedback recorded successfully',
        feedback: updatedFeedback,
        overallStatus: newStatus,
      });
    } catch (err: any) {
      console.error('Feedback save error:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
