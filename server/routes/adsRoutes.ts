import express from 'express';
import { google } from 'googleapis';
import { SupabaseClient } from '@supabase/supabase-js';
import { withGoogleRetry } from '../utils/googleRetry';

export interface AdsRoutesDeps {
  supabase: SupabaseClient;
  getAuthenticatedClient: (req?: express.Request, clientId?: string) => Promise<any>;
}

export function registerAdsRoutes(app: express.Express, deps: AdsRoutesDeps) {
  const { supabase, getAuthenticatedClient } = deps;

  // GET Ads & Growth data for client
  app.get('/api/clients/:clientId/ads-growth', async (req, res) => {
    const { clientId } = req.params;
    try {
      const { data, error } = await supabase
        .from('weekly_ads_growth')
        .select('*')
        .eq('client_id', clientId)
        .order('week_start_date', { ascending: false });

      if (error) throw error;
      res.json(data || []);
    } catch (error: any) {
      console.error('[ADS_GROWTH] Error fetching ads data:', error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // POST Ads & Growth data for client (Upsert)
  app.post('/api/clients/:clientId/ads-growth', async (req, res) => {
    const { clientId } = req.params;
    const payload = req.body;

    try {
      const { data, error } = await supabase
        .from('weekly_ads_growth')
        .upsert(
          {
            ...payload,
            client_id: clientId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'client_id,week_start_date' }
        )
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ADS_GROWTH] Error saving ads data:', error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // POST Sync Ads Data (Fetch from live GA4 / Google Ads / Meta API)
  app.post('/api/clients/:clientId/sync-ads-growth', async (req, res) => {
    const { clientId } = req.params;
    const { weekStart } = req.body;
    if (!weekStart) return res.status(400).json({ error: 'weekStart is required' });

    console.log(`[ADS_SYNC_API] Triggered sync request for clientId: "${clientId}", weekStart: "${weekStart}"`);

    try {
      const { data: client, error: clientErr } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientErr || !client) {
        console.error(`[ADS_SYNC_API] Client not found in database: "${clientId}"`);
        return res.status(404).json({ error: 'Client not found' });
      }

      const { data: weeklyData } = await supabase
        .from('weekly_data')
        .select('*')
        .eq('client_id', clientId)
        .eq('week_start_date', weekStart)
        .maybeSingle();

      let gSpend = 0;
      let gLeads = 0;
      let gCtr = 0;
      let gRoas = 0;
      let gScore = 0;
      let gCampaigns: any[] = [];

      let mSpend = 0;
      let mReach = 0;
      let mLeads = 0;
      let mCtr = 0;
      let mRoas = 0;
      let mFreq = 0;

      let webSessions = weeklyData?.ga4_traffic ? Number(weeklyData.ga4_traffic) : 0;
      let bounceRate = 0;
      let timeOnSite = '';
      let topPage = '';
      const abTests = 0;
      const lpLive = 0;

      if (client.ga4_property_id) {
        try {
          let currentAuth: any = null;
          const { data: creds } = await supabase
            .from('google_credentials')
            .select('tokens')
            .eq('client_id', clientId)
            .maybeSingle();

          if (creds && creds.tokens) {
            const oAuth2Client = new google.auth.OAuth2(
              process.env.GOOGLE_CLIENT_ID,
              process.env.GOOGLE_CLIENT_SECRET,
              process.env.GOOGLE_REDIRECT_URI
            );
            oAuth2Client.setCredentials(creds.tokens);
            currentAuth = oAuth2Client;
          } else {
            currentAuth = await getAuthenticatedClient(req).catch(() => null);
          }

          if (currentAuth) {
            const analytics = google.analyticsdata({ version: 'v1beta', auth: currentAuth });
            const startDate = weekStart;
            const start = new Date(weekStart);
            const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
            const endDate = end.toISOString().split('T')[0];

            try {
              const report = (await withGoogleRetry(
                () =>
                  analytics.properties.runReport({
                    property: `properties/${client.ga4_property_id}`,
                    requestBody: {
                      dateRanges: [{ startDate, endDate }],
                      metrics: [
                        { name: 'sessions' },
                        { name: 'bounceRate' },
                        { name: 'averageSessionDuration' },
                        { name: 'conversions' },
                      ],
                    },
                  }),
                { label: `GA4 Ads Traffic (${client.name})` }
              )) as any;

              const metricValues = report.data.rows?.[0]?.metricValues;
              if (metricValues) {
                webSessions = parseInt(metricValues[0]?.value || '0') || webSessions;
                bounceRate = parseFloat((parseFloat(metricValues[1]?.value || '0') * 100).toFixed(1)) || 0;
                const durationSec = parseFloat(metricValues[2]?.value || '0') || 0;
                if (durationSec > 0) {
                  const mins = Math.floor(durationSec / 60);
                  const secs = Math.floor(durationSec % 60);
                  timeOnSite = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                }
                gLeads = parseInt(metricValues[3]?.value || '0') || 0;
              }
            } catch (trafficErr: any) {
              console.error('[ADS_SYNC_API] Failed to fetch GA4 traffic report:', trafficErr.message);
            }

            try {
              const adsReport = (await withGoogleRetry(
                () =>
                  analytics.properties.runReport({
                    property: `properties/${client.ga4_property_id}`,
                    requestBody: {
                      dateRanges: [{ startDate, endDate }],
                      dimensions: [{ name: 'sessionCampaignName' }],
                      metrics: [
                        { name: 'advertiserAdCost' },
                        { name: 'advertiserAdClicks' },
                        { name: 'advertiserAdImpressions' },
                        { name: 'conversions' },
                      ],
                    },
                  }),
                { label: `GA4 Campaigns (${client.name})` }
              )) as any;

              if (adsReport.data.rows && adsReport.data.rows.length > 0) {
                let totalCost = 0;
                let totalClicks = 0;
                let totalImps = 0;
                let totalConversions = 0;
                const campaignsList = [];

                for (const row of adsReport.data.rows) {
                  const cName = row.dimensionValues?.[0]?.value || '';
                  if (cName === '(not set)' || cName === '(direct)' || cName === '(organic)' || cName === '(referral)') continue;

                  const cCost = parseFloat(row.metricValues?.[0]?.value || '0');
                  const cClicks = parseInt(row.metricValues?.[1]?.value || '0');
                  const cImps = parseInt(row.metricValues?.[2]?.value || '0');
                  const cConvs = parseInt(row.metricValues?.[3]?.value || '0');

                  if (cCost > 0 || cClicks > 0 || cImps > 0 || cConvs > 0) {
                    campaignsList.push({
                      campaignName: cName,
                      cost: cCost,
                      clicks: cClicks,
                      impressions: cImps,
                      conversions: cConvs,
                      ctr: cImps > 0 ? parseFloat(((cClicks / cImps) * 100).toFixed(2)) : 0,
                      cpc: cClicks > 0 ? parseFloat((cCost / cClicks).toFixed(2)) : 0,
                    });
                  }

                  totalCost += cCost;
                  totalClicks += cClicks;
                  totalImps += cImps;
                  totalConversions += cConvs;
                }

                gSpend = totalCost;
                gCtr = totalImps > 0 ? parseFloat(((totalClicks / totalImps) * 100).toFixed(2)) : 0;
                gLeads = totalConversions;
                gRoas = gSpend > 0 ? parseFloat((gLeads / gSpend).toFixed(2)) : 0;
                gScore = 8;
                gCampaigns = campaignsList;
              }
            } catch (adsError: any) {
              console.error('[ADS_SYNC_API] Failed to fetch separate Google Ads report:', adsError.message);
            }

            // Direct Google Ads API if customer_id & developer_token are present
            if (client.google_ads_customer_id && process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
              try {
                const cleanCustomerId = client.google_ads_customer_id.replace(/-/g, '').trim();
                const tokens = await currentAuth.getAccessToken();
                const accessToken = typeof tokens === 'string' ? tokens : tokens?.token;

                if (accessToken) {
                  const adsUrl = `https://googleads.googleapis.com/v17/customers/${cleanCustomerId}/googleAds:searchStream`;
                  const adsQuery = {
                    query: `SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions FROM campaign WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'`,
                  };

                  const adsRes = await fetch(adsUrl, {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${accessToken}`,
                      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(adsQuery),
                  });

                  if (adsRes.ok) {
                    const adsStreamData = await adsRes.json();
                    let directCost = 0;
                    let directClicks = 0;
                    let directImps = 0;
                    let directConvs = 0;
                    const directCampaigns = [];

                    if (Array.isArray(adsStreamData)) {
                      for (const batch of adsStreamData) {
                        for (const row of batch.results || []) {
                          const cName = row.campaign?.name || 'Campaign';
                          const cCost = parseInt(row.metrics?.costMicros || '0') / 1000000;
                          const cClicks = parseInt(row.metrics?.clicks || '0');
                          const cImps = parseInt(row.metrics?.impressions || '0');
                          const cConvs = parseInt(row.metrics?.conversions || '0');

                          if (cCost > 0 || cClicks > 0 || cImps > 0 || cConvs > 0) {
                            directCampaigns.push({
                              campaignName: cName,
                              cost: parseFloat(cCost.toFixed(2)),
                              clicks: cClicks,
                              impressions: cImps,
                              conversions: cConvs,
                              ctr: cImps > 0 ? parseFloat(((cClicks / cImps) * 100).toFixed(2)) : 0,
                              cpc: cClicks > 0 ? parseFloat((cCost / cClicks).toFixed(2)) : 0,
                            });
                          }

                          directCost += cCost;
                          directClicks += cClicks;
                          directImps += cImps;
                          directConvs += cConvs;
                        }
                      }
                    }

                    if (directCost > 0 || directClicks > 0 || directImps > 0 || directConvs > 0) {
                      gSpend = parseFloat(directCost.toFixed(2));
                      gCtr = directImps > 0 ? parseFloat(((directClicks / directImps) * 100).toFixed(2)) : 0;
                      gLeads = directConvs;
                      gRoas = gSpend > 0 ? parseFloat((gLeads / gSpend).toFixed(2)) : 0;
                      gScore = 9;
                      gCampaigns = directCampaigns;
                    }
                  } else {
                    const errTxt = await adsRes.text();
                    console.error(`[ADS_SYNC_API] Direct Google Ads API returned error status ${adsRes.status}:`, errTxt);
                  }
                }
              } catch (directAdsErr: any) {
                console.error('[ADS_SYNC_API] Failed to fetch Direct Google Ads API:', directAdsErr.message);
              }
            }

            // Meta Marketing API
            let metaAccessToken = process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN || '';
            if (!metaAccessToken) {
              const { data: mKeyRow } = await supabase
                .from('api_keys')
                .select('key_value')
                .eq('id', 'meta_access_token')
                .maybeSingle();
              if (mKeyRow?.key_value) metaAccessToken = mKeyRow.key_value;
            }
            if (client.meta_ad_account_id && metaAccessToken) {
              try {
                let cleanMetaAccountId = client.meta_ad_account_id.trim();
                if (!cleanMetaAccountId.startsWith('act_')) {
                  cleanMetaAccountId = `act_${cleanMetaAccountId}`;
                }

                const metaUrl =
                  `https://graph.facebook.com/v20.0/${cleanMetaAccountId}/insights?` +
                  new URLSearchParams({
                    access_token: metaAccessToken,
                    time_range: JSON.stringify({ since: startDate, until: endDate }),
                    fields: 'spend,impressions,reach,clicks,ctr,actions,cost_per_action_type,frequency',
                  }).toString();

                const metaRes = await fetch(metaUrl);
                if (metaRes.ok) {
                  const metaData: any = await metaRes.json();
                  const insights = metaData.data?.[0];
                  if (insights) {
                    mSpend = parseFloat(parseFloat(insights.spend || '0').toFixed(2));
                    mReach = parseInt(insights.reach || insights.impressions || '0');
                    mCtr = parseFloat(parseFloat(insights.ctr || '0').toFixed(2));
                    mFreq = parseFloat(parseFloat(insights.frequency || '0').toFixed(2));

                    let metaLeadsCount = 0;
                    if (Array.isArray(insights.actions)) {
                      const primaryLeadAction = insights.actions.find((act: any) => act.action_type === 'lead');
                      if (primaryLeadAction) {
                        metaLeadsCount = parseInt(primaryLeadAction.value || '0');
                      } else {
                        const fallbackAction = insights.actions.find(
                          (act: any) =>
                            act.action_type === 'offsite_conversion.fb_pixel_lead' ||
                            act.action_type === 'onsite_conversion.lead_grouped'
                        );
                        if (fallbackAction) {
                          metaLeadsCount = parseInt(fallbackAction.value || '0');
                        }
                      }
                    }
                    mLeads = metaLeadsCount;
                    mRoas = 0;
                  }
                } else {
                  const metaErrTxt = await metaRes.text();
                  console.error(`[ADS_SYNC_API] Meta Marketing API error status ${metaRes.status}:`, metaErrTxt);
                }
              } catch (metaErr: any) {
                console.error('[ADS_SYNC_API] Failed to fetch Meta Marketing API:', metaErr.message);
              }
            }

            try {
              const pagesReport = (await withGoogleRetry(
                () =>
                  analytics.properties.runReport({
                    property: `properties/${client.ga4_property_id}`,
                    requestBody: {
                      dateRanges: [{ startDate, endDate }],
                      dimensions: [{ name: 'pagePath' }],
                      metrics: [{ name: 'conversions' }],
                      orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
                      limit: '1',
                    },
                  }),
                { label: `GA4 Top Converting Page (${client.name})` }
              )) as any;
              const topRow = pagesReport.data.rows?.[0];
              if (topRow) {
                topPage = topRow.dimensionValues?.[0]?.value || '';
              }
            } catch (pagesErr: any) {
              console.error('[ADS_SYNC_API] Failed to fetch GA4 pages report:', pagesErr.message);
            }
          }
        } catch (e: any) {
          console.error('[ADS_GROWTH] General error fetching GA4 live stats:', e.message);
        }
      }

      const seoLeads = weeklyData?.leads_legit ? Number(weeklyData.leads_legit) : 0;

      const upsertRow = {
        client_id: clientId,
        week_start_date: weekStart,
        google_ads_spend: gSpend,
        google_ads_conversions: gLeads,
        google_ads_roas: gRoas,
        google_ads_ctr: gCtr,
        google_ads_quality_score: gScore,
        google_ads_campaigns: gCampaigns,
        meta_spend: mSpend,
        meta_reach: mReach,
        meta_leads: mLeads,
        meta_roas: mRoas,
        meta_ctr: mCtr,
        meta_frequency: mFreq,
        website_sessions: webSessions,
        bounce_rate: bounceRate,
        avg_time_on_site: timeOnSite,
        top_converting_page: topPage,
        active_ab_tests: abTests,
        landing_pages_live: lpLive,
        followers_total: 0,
        social_impressions: 0,
        engagement_rate: 0,
        social_posts_published: 0,
        organic_social_reach: 0,
        top_platform: '',
        blogs_written: 0,
        avg_blog_quality: 0,
        backlinks_created: 0,
        social_posts_content_total: 0,
        creatives_produced: 0,
        emails_automation: 0,
        seo_organic_leads: seoLeads,
      };

      const { data, error } = await supabase
        .from('weekly_ads_growth')
        .upsert(upsertRow, { onConflict: 'client_id,week_start_date' })
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[ADS_GROWTH] Sync error:', error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });
}
