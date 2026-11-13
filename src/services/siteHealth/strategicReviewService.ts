import { createClient } from '@supabase/supabase-js';

// Structured Strategic Review Item
export interface StrategicActionItem {
  id: string;
  action: string;
  why: string;
  who: string;
  priority: 'Must-Do' | 'Secondary' | 'Backlog';
  status: 'Pending' | 'In-Progress' | 'Completed';
}

export interface TeamFeedbackEntry {
  id: string;
  userName: string;
  userRole: string;
  agreement: 'AGREE' | 'DISAGREE' | 'NEUTRAL';
  comment: string;
  createdAt: string;
}

export interface ClientStrategicReview {
  id?: string;
  clientId: string;
  clientName: string;
  shortCode: string;
  siteUrl: string;
  projectOwner: string;
  periodStart: string;
  periodEnd: string;
  
  // Performance numbers
  clicks: number;
  phones: number;
  leadsActual: number;
  leadsTarget: number;
  drActual: number;
  
  // Real site technical audit vs claims
  siteReality: string;
  conversionGaps: string;
  
  // Horizons
  actionsFortnight: StrategicActionItem[];
  actionsNext: StrategicActionItem[];
  actionsLater: StrategicActionItem[];
  
  // Review & Sign-off comments from Team / CEO
  teamFeedback: TeamFeedbackEntry[];
  overallStatus: 'PENDING_REVIEW' | 'AGREED' | 'HAS_OBJECTIONS' | 'IN_PROGRESS';
  generatedByModel: string;
  lastGeneratedAt: string;
}

/**
 * Generates an executive-level strategic review synthesizing metrics + technical site signals
 */
export function buildStrategicReviewPrompt(client: any, metrics: any, health: any): string {
  return `
You are the Chief SEO Strategist & Executive Auditor for an elite digital growth agency.
Your task is to generate a brutally honest, rigorous, and operational "Weekly Strategic Review" for client: ${client.name} (${client.short_code}).

CLIENT & SITE CONTEXT:
- Client Name: ${client.name}
- Domain / GSC URL: ${client.gsc_site_url || 'N/A'}
- Live Website URL: ${health?.siteUrl || 'N/A'}
- Project Owner (PM): ${client.project_owner_name} (${client.project_owner_code})
- Lead Monthly Target: ${client.lead_target_monthly || 0}
- Target Domain Rating (DR): ${client.target_dr || 0}

RECENT METRICS (Past Period):
- Genuine Leads (Legit): ${metrics?.leads_legit ?? 0} (Target: ${client.lead_target_monthly ? Math.round(client.lead_target_monthly / 4) : 'N/A'} per week)
- Phone Calls Tracked: ${metrics?.phone_calls ?? 0}
- GSC Organic Clicks: ${metrics?.gsc_clicks ?? 0}
- Impressions: ${metrics?.gsc_impressions ?? 0}
- Average Position: ${metrics?.tracked_keywords_avg_position || metrics?.gsc_position || 'N/A'}
- Ahrefs DR: ${metrics?.ahrefs_dr ?? 0}

LIVE SITE TECHNICAL HEALTH AUDIT (Today):
- HTTP Status: ${health?.httpStatus || 200} (Online: ${health?.isOnline ? 'YES' : 'NO'})
- Response Time: ${health?.responseTimeMs || 0}ms
- SSL Certificate: ${health?.sslValid ? `Valid (${health?.sslDaysLeft} days left)` : 'INVALID/EXPIRED'}
- XML Sitemap: ${health?.sitemapStatus || 'OK'} (${health?.sitemapCount || 0} URLs detected at ${health?.sitemapUrl || 'sitemap.xml'})
- Indexability / Robots: ${health?.hasNoindex ? 'ALERT: NOINDEX TAG FOUND ON HOMEPAGE' : 'Indexable'} | Robots: ${health?.robotsStatus || 'OK'}
- WordPress Plugins: ${health?.wpConnected ? `${health?.pluginsOutdated} updates pending out of ${health?.pluginsTotal} total` : 'Not linked via bridge'}
- Specific Detected Issues: ${JSON.stringify(health?.issues || [])}

RULES:
1. "Site Reality": Do not accept fluffy claims. Describe exactly what happens on the live money pages (forms, quote buttons, redirects, 403 crawl blocks, popups vs native fields).
2. "Conversion Gaps": Pinpoint why traffic fails to convert to calls/leads or where crawlers fail to index.
3. "Action — Why — Who": Every action MUST state:
   - Action: Exactly what to build, fix or prune.
   - Why: Business and lead-flow reason.
   - Who: Assign strictly to realistic roles: ${client.project_owner_name} (PM), Shihab (Web Developer), Nia (Copy/Content), or Gia (Local SEO/Maps).

OUTPUT FORMAT:
Return strictly valid JSON with no markdown wrapping and no backticks:
{
  "siteReality": "Detailed technical truth of the site, forms and crawl state",
  "conversionGaps": "Core conversion barriers, missing forms, or trust cracks",
  "actionsFortnight": [
    { "id": "act-1", "action": "Exact task description", "why": "Why it matters", "who": "${client.project_owner_name} / Shihab", "priority": "Must-Do", "status": "Pending" }
  ],
  "actionsNext": [
    { "id": "act-2", "action": "Secondary task", "why": "Why it matters", "who": "Nia / ${client.project_owner_name}", "priority": "Secondary", "status": "Pending" }
  ],
  "actionsLater": [
    { "id": "act-3", "action": "Backlog task", "why": "Why it matters", "who": "${client.project_owner_name}", "priority": "Backlog", "status": "Pending" }
  ]
}
`;
}
