import { supabase } from '../lib/supabase';
import { DateRange, ComparisonResult, calculateMetricComparison, calculatePositionComparison } from '../lib/seoUtils';

export interface Client {
  id: string;
  name: string;
  short_code: string;
  ga4_property_id: string;
  gsc_site_url: string;
  lead_event_names: string;
  keyword_tracking_enabled: boolean;
  api_import_enabled: boolean;
  notes: string;
  timezone: string;
  lead_target_monthly: number;
  avg_position_target: number;
  technical_score_target: number;
  project_owner_name: string;
  project_owner_code: string;
  top_10_target: number;
  target_monthly_clicks?: number;
  target_monthly_sessions?: number;
  target_monthly_blogs?: number;
  lead_api_url?: string;
  target_dr?: number;
}

export interface WeeklyData {
  id?: string;
  client_id: string;
  week_start_date: string;
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_ctr: number;
  gsc_position: number;
  ga4_traffic: number;
  ga4_new_users: number;
  ga4_returning_users: number;
  ga4_organic_traffic: number;
  leads_total: number;
  leads_legit: number;
  target_leads: number;
  phone_calls: number;
  ahrefs_dr: number;
  ahrefs_backlinks: number;
  ahrefs_ref_domains: number;
  top_3_count: number;
  top_10_count: number;
  tracked_keywords_avg_position: number;
  technical_score: number;
  primary_issue_type?: string;
  primary_insight?: string;
  next_seo_action?: string;
  weekly_activity_summary?: string;
  pages_optimized: number;
  blogs_published: number;
  backlinks_built: number;
  tech_fixes: number;
  schema_updates: number;
  internal_links: number;
  notes?: string;
  imported_at?: string;
}

export interface CitationData {
  id?: string;
  client_id: string;
  week_start_date: string;
  referrer_url: string;
  domain_rating: number;
  anchor_text: string;
  target_url: string;
  created_at?: string;
}

export const getCitations = async (clientId: string, date: string): Promise<CitationData[]> => {
  try {
    const { data, error } = await supabase
      .from('ahrefs_citations')
      .select('*')
      .eq('client_id', clientId)
      .eq('week_start_date', date);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching citation data:', error);
    return [];
  }
};

export interface AiCitationData {
  id?: string;
  client_id: string;
  week_start_date: string;
  platform: string;
  responses: number;
  pages: number;
  created_at?: string;
}

export const getAiCitations = async (clientId: string, date: string): Promise<AiCitationData[]> => {
  try {
    const { data, error } = await supabase
      .from('ahrefs_ai_citations')
      .select('*')
      .eq('client_id', clientId)
      .eq('week_start_date', date);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching AI citation data:', error);
    return [];
  }
};

export const getClients = async (): Promise<Client[]> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
};

export const getWeeklyData = async (clientId: string, range: DateRange): Promise<WeeklyData[]> => {
  try {
    const { data, error } = await supabase
      .from('weekly_data')
      .select('*')
      .eq('client_id', clientId)
      .gte('week_start_date', range.startDate)
      .lte('week_start_date', range.endDate)
      .order('week_start_date', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching weekly data:', error);
    return [];
  }
};

export interface MonthlyCache {
  id: string;
  client_id: string;
  month_start_date: string;
  gsc_clicks: number;
  gsc_impressions: number;
  gsc_ctr: number;
  gsc_position: number;
  gsc_top3: number;
  gsc_top10: number;
  ga4_traffic: number;
  ga4_new_users: number;
  ga4_returning_users: number;
  ga4_organic_traffic: number;
  phone_calls: number;
  leads_total: number;
  leads_legit: number;
  blogs_published: number;
  ahrefs_dr: number;
  last_updated: string;
}

export const getMonthlyCache = async (monthStartDate: string): Promise<MonthlyCache[]> => {
  try {
    const { data, error } = await supabase
      .from('monthly_data_cache')
      .select('*')
      .eq('month_start_date', monthStartDate);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching monthly data cache:', error);
    return [];
  }
};

export const triggerMonthlySync = async (month?: string): Promise<boolean> => {
  try {
    const url = month ? `/api/cron/sync-monthly-cache?month=${month}` : '/api/cron/sync-monthly-cache';
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    console.error('Error triggering monthly sync:', error);
    return false;
  }
};

export const getAllWeeklyData = async (range: DateRange): Promise<Record<string, WeeklyData[]>> => {
  try {
    const { data, error } = await supabase
      .from('weekly_data')
      .select('*')
      .gte('week_start_date', range.startDate)
      .lte('week_start_date', range.endDate)
      .order('week_start_date', { ascending: false });
    
    if (error) throw error;
    
    const grouped: Record<string, WeeklyData[]> = {};
    (data || []).forEach(row => {
      if (!grouped[row.client_id]) grouped[row.client_id] = [];
      grouped[row.client_id].push(row);
    });
    
    return grouped;
  } catch (error) {
    console.error('Error fetching all weekly data:', error);
    return {};
  }
};

export const getLiveMetrics = async (clientId: string, range: DateRange) => {
  try {
    const response = await fetch(`/api/clients/${clientId}/live-metrics?startDate=${range.startDate}&endDate=${range.endDate}`, {
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch live metrics');
    return data;
  } catch (error: any) {
    console.error('Error in getLiveMetrics:', error);
    throw error;
  }
};

export const getInsights = async (clientId: string, range: DateRange) => {
  try {
    const response = await fetch(`/api/clients/${clientId}/insights?startDate=${range.startDate}&endDate=${range.endDate}`, {
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch insights');
    return data;
  } catch (error: any) {
    console.error('Error in getInsights:', error);
    throw error;
  }
};

export const getKeywordRankingDetails = async (clientId: string, range: DateRange) => {
  try {
    const response = await fetch(`/api/clients/${clientId}/keyword-ranking-details?startDate=${range.startDate}&endDate=${range.endDate}`, {
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch keyword details');
    return data;
  } catch (error: any) {
    console.error('Error in getKeywordRankingDetails:', error);
    throw error;
  }
};

export const getPerformanceTrend = async (clientId: string, range: DateRange) => {
  try {
    const response = await fetch(`/api/clients/${clientId}/performance-trend?startDate=${range.startDate}&endDate=${range.endDate}`, {
      cache: 'no-store'
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch trend');
    return data;
  } catch (error: any) {
    console.error('Error in getPerformanceTrend:', error);
    throw error;
  }
};

export interface DashboardMetrics {
  clicks: ComparisonResult;
  impressions: ComparisonResult;
  ctr: ComparisonResult;
  position: ComparisonResult;
  traffic: ComparisonResult;
  leads: ComparisonResult;
  activityTotal: ComparisonResult;
  top3: number;
  top10: number;
  lastSyncedAt?: string;
}

export const aggregateMetrics = async (clientId: string, current: DateRange, previous: DateRange): Promise<DashboardMetrics> => {
  const [currentLive, previousLive, currentWeekly, previousWeekly] = await Promise.all([
    getLiveMetrics(clientId, current),
    getLiveMetrics(clientId, previous),
    getWeeklyData(clientId, current),
    getWeeklyData(clientId, previous)
  ]);

  const sumWeekly = (data: WeeklyData[], key: keyof WeeklyData) => {
    return data.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
  };

  const currSum = {
    clicks: currentLive?.gsc_clicks ?? sumWeekly(currentWeekly, 'gsc_clicks') ?? 0,
    impressions: currentLive?.gsc_impressions ?? sumWeekly(currentWeekly, 'gsc_impressions') ?? 0,
    ctr: currentLive?.gsc_ctr ?? (currentWeekly.length ? (sumWeekly(currentWeekly, 'gsc_ctr') / currentWeekly.length) : 0) ?? 0,
    position: currentLive?.gsc_position ?? (currentWeekly.length ? (sumWeekly(currentWeekly, 'gsc_position') / currentWeekly.length) : 0) ?? 0,
    traffic: currentLive?.ga4_traffic ?? sumWeekly(currentWeekly, 'ga4_traffic') ?? 0,
    leads: sumWeekly(currentWeekly, 'leads_total'),
    activity: sumWeekly(currentWeekly, 'pages_optimized') + sumWeekly(currentWeekly, 'blogs_published') + sumWeekly(currentWeekly, 'backlinks_built')
  };

  const prevSum = {
    clicks: previousLive?.gsc_clicks ?? sumWeekly(previousWeekly, 'gsc_clicks') ?? 0,
    impressions: previousLive?.gsc_impressions ?? sumWeekly(previousWeekly, 'gsc_impressions') ?? 0,
    ctr: previousLive?.gsc_ctr ?? (previousWeekly.length ? (sumWeekly(previousWeekly, 'gsc_ctr') / previousWeekly.length) : 0) ?? 0,
    position: previousLive?.gsc_position ?? (previousWeekly.length ? (sumWeekly(previousWeekly, 'gsc_position') / previousWeekly.length) : 0) ?? 0,
    traffic: previousLive?.ga4_traffic ?? sumWeekly(previousWeekly, 'ga4_traffic') ?? 0,
    leads: sumWeekly(previousWeekly, 'leads_total'),
    activity: sumWeekly(previousWeekly, 'pages_optimized') + sumWeekly(previousWeekly, 'blogs_published') + sumWeekly(previousWeekly, 'backlinks_built')
  };

  const hasPrev = !!previousLive || previousWeekly.length > 0;

  return {
    clicks: calculateMetricComparison(currSum.clicks, hasPrev ? prevSum.clicks : null),
    impressions: calculateMetricComparison(currSum.impressions, hasPrev ? prevSum.impressions : null),
    ctr: calculateMetricComparison(currSum.ctr, hasPrev ? prevSum.ctr : null),
    position: calculatePositionComparison(currSum.position, hasPrev ? prevSum.position : null),
    traffic: calculateMetricComparison(currSum.traffic, hasPrev ? prevSum.traffic : null),
    leads: calculateMetricComparison(currSum.leads, hasPrev ? prevSum.leads : null),
    activityTotal: calculateMetricComparison(currSum.activity, hasPrev ? prevSum.activity : null),
    top3: currentLive?.gsc_top3 || sumWeekly(currentWeekly, 'top_3_count') || 0,
    top10: currentLive?.gsc_top10 || sumWeekly(currentWeekly, 'top_10_count') || 0,
    lastSyncedAt: currentWeekly[0]?.imported_at || previousWeekly[0]?.imported_at
  };
};

export const updateLegitLeads = async (clientId: string, weekStartDate: string, legitLeads: number): Promise<void> => {
  try {
    const { error } = await supabase
      .from('weekly_data')
      .upsert({ 
        client_id: clientId, 
        week_start_date: weekStartDate, 
        leads_legit: legitLeads 
      }, { onConflict: 'client_id, week_start_date' });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating legit leads:', error);
    throw error;
  }
};

export interface Keyword {
  id: string;
  query: string;
  landing_page_url?: string;
  target_url?: string;
  priority?: string;
  search_intent?: string;
}

export interface KeywordHistory {
  id: string;
  keyword_id: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  date_start: string;
}

export const getKeywords = async (clientId: string): Promise<Keyword[]> => {
  try {
    const { data, error } = await supabase
      .from('keywords')
      .select('*')
      .eq('client_id', clientId);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return [];
  }
};

export const getKeywordHistory = async (clientId: string, range: DateRange): Promise<KeywordHistory[]> => {
  try {
    const { data, error } = await supabase
      .from('keyword_history')
      .select('*, keywords!inner(client_id)')
      .eq('keywords.client_id', clientId)
      .gte('date_start', range.startDate)
      .lte('date_start', range.endDate);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching keyword history:', error);
    return [];
  }
};

export const addClient = async (client: Omit<Client, 'id'>): Promise<string> => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();
    
    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding client:', error);
    throw error;
  }
};

export const updateClient = async (id: string, data: Partial<Client>): Promise<void> => {
  try {
    const cleanData = { ...data };
    
    const integerFields: (keyof Client)[] = [
      'lead_target_monthly',
      'technical_score_target',
      'top_10_target',
      'target_monthly_clicks',
      'target_monthly_sessions',
      'target_monthly_blogs',
      'target_dr'
    ];

    integerFields.forEach(field => {
      if (cleanData[field] !== undefined && cleanData[field] !== null) {
        (cleanData as any)[field] = Math.round(Number(cleanData[field]) || 0);
      }
    });

    const { error } = await supabase
      .from('clients')
      .update(cleanData)
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
};

export const deleteClient = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};

export const addKeyword = async (clientId: string, keyword: any): Promise<void> => {
  try {
    const { error } = await supabase
      .from('keywords')
      .insert({ ...keyword, client_id: clientId });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error adding keyword:', error);
    throw error;
  }
};

export const syncWeeklyData = async (clientId: string, data: Partial<WeeklyData>): Promise<void> => {
  try {
    const { id, ...saveData } = data;
    
    const integerFields: (keyof WeeklyData)[] = [
      'backlinks_built',
      'target_leads',
      'leads_total',
      'leads_legit',
      'pages_optimized',
      'blogs_published',
      'tech_fixes',
      'schema_updates',
      'internal_links',
      'ga4_new_users',
      'ga4_returning_users',
      'ga4_organic_traffic',
      'technical_score',
      'top_3_count',
      'top_10_count',
      'ga4_traffic',
      'gsc_clicks',
      'gsc_impressions',
      'ahrefs_dr',
      'ahrefs_backlinks',
      'ahrefs_ref_domains',
      'phone_calls'
    ];

    integerFields.forEach(field => {
      if (saveData[field] !== undefined && saveData[field] !== null) {
        (saveData as any)[field] = Math.round(Number(saveData[field]) || 0);
      }
    });

    const performSave = async (payload: any) => {
      return await supabase
        .from('weekly_data')
        .upsert({ ...payload, client_id: clientId }, { onConflict: 'client_id, week_start_date' });
    };

    let result = await performSave(saveData);

    // Retry loop for missing columns
    while (result.error && (result.error.message.includes('column') || result.error.message.includes('Could not find'))) {
      // Try to extract the missing column name from the error message. 
      // Typical PostgREST error: "Could not find the 'column_name' column"
      const match = result.error.message.match(/'([^']+)'/);
      const missingCol = match ? match[1] : null;
      
      if (missingCol && Object.keys(saveData).includes(missingCol)) {
        console.warn(`[DB WARNING] ${missingCol} column missing. Retrying save without it...`, result.error.message);
        delete (saveData as any)[missingCol];
        result = await performSave(saveData);
      } else if (result.error.message.includes('phone_calls') && saveData.phone_calls !== undefined) {
        console.warn('[DB WARNING] phone_calls missing. Retrying...');
        delete saveData.phone_calls;
        result = await performSave(saveData);
      } else if (result.error.message.includes('ga4_organic_traffic') && saveData.ga4_organic_traffic !== undefined) {
        console.warn('[DB WARNING] ga4_organic_traffic missing. Retrying...');
        delete saveData.ga4_organic_traffic;
        result = await performSave(saveData);
      } else if (result.error.message.includes('ga4_new_users') && saveData.ga4_new_users !== undefined) {
        delete saveData.ga4_new_users;
        result = await performSave(saveData);
      } else if (result.error.message.includes('ga4_returning_users') && saveData.ga4_returning_users !== undefined) {
        delete saveData.ga4_returning_users;
        result = await performSave(saveData);
      } else if (result.error.message.includes('top_3_count') && saveData.top_3_count !== undefined) {
        delete saveData.top_3_count;
        result = await performSave(saveData);
      } else if (result.error.message.includes('top_10_count') && saveData.top_10_count !== undefined) {
        delete saveData.top_10_count;
        result = await performSave(saveData);
      } else {
        // Unrecoverable or couldn't parse
        break;
      }
    }

    if (result.error) {
      if (typeof window !== 'undefined') {
        alert('Supabase Save Error: ' + result.error.message);
      }
      throw result.error;
    }
  } catch (error: any) {
    console.error('Error saving weekly data:', error);
    if (typeof window !== 'undefined') {
      alert('Catch Error saving weekly data: ' + error.message);
    }
    throw error;
  }
};

export const deleteKeyword = async (clientId: string, id: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('keywords')
      .delete()
      .eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error deleting keyword:', error);
    throw error;
  }
};

export const updateKeyword = async (clientId: string, id: string, updates: Partial<Keyword>): Promise<void> => {
  try {
    const { error } = await supabase
      .from('keywords')
      .update(updates)
      .eq('id', id)
      .eq('client_id', clientId);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating keyword:', error);
    throw error;
  }
};

export const getApiKeys = async (): Promise<any[]> => {
  try {
    const response = await fetch('/api/admin/keys');
    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText}`);
    }
    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON response from server');
    }
    return data.keys || [];
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return [];
  }
};

export const saveApiKey = async (id: string, keyValue: string): Promise<void> => {
  try {
    const response = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, key_value: keyValue })
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server returned status ${response.status}: ${response.statusText || 'Unknown Error'}`);
    }
    if (!response.ok) throw new Error(data.error || 'Failed to save API key');
  } catch (error) {
    console.error('Error saving API key:', error);
    throw error;
  }
};

export const mapApiError = (status: number, rawError: string): Error => {
  const lowerErr = rawError.toLowerCase();
  
  if (
    lowerErr.includes('missing') ||
    lowerErr.includes('not configured') ||
    lowerErr.includes('api key') ||
    status === 401 ||
    (status === 400 && lowerErr.includes('key'))
  ) {
    return new Error('AI model not configured, contact admin');
  } else if (
    lowerErr.includes('truncation') ||
    lowerErr.includes('max_tokens') ||
    lowerErr.includes('cut off') ||
    lowerErr.includes('incomplete json')
  ) {
    return new Error('Report was too large, please retry');
  } else if (
    status === 429 ||
    lowerErr.includes('rate limit') ||
    lowerErr.includes('too many requests') ||
    lowerErr.includes('quota')
  ) {
    return new Error('AI service busy, try again shortly');
  } else if (
    status === 504 ||
    status === 502 ||
    status === 408 ||
    lowerErr.includes('timeout') ||
    lowerErr.includes('took too long')
  ) {
    return new Error('Audit took too long, please retry');
  } else {
    return new Error(rawError);
  }
};

export const runAiAnalysis = async (params: {
  clientId: string;
  model: string;
  analysisType: string;
  startDate: string;
  endDate: string;
  simulate?: boolean;
  runTechnicalCrawl?: boolean;
  generateAiFixes?: boolean;
}): Promise<any> => {
  try {
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const status = response.status;
      let rawError = 'AI Analysis failed';
      try {
        const data = await response.json();
        rawError = data.error || rawError;
      } catch (e) {
        // response might not be JSON (e.g. timeout HTML or raw text)
      }

      console.warn(`[AI SERVICE ERROR] status=${status} message="${rawError}"`);
      throw mapApiError(status, rawError);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error in runAiAnalysis:', error);
    throw error;
  }
};

export const runAiSinglePageOptimise = async (params: {
  clientId: string;
  url: string;
  pageTitle: string;
  issues: string[];
  model: string;
  simulate?: boolean;
}): Promise<any> => {
  try {
    const response = await fetch('/api/ai/optimise-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const status = response.status;
      let rawError = 'Optimization failed';
      try {
        const data = await response.json();
        rawError = data.error || rawError;
      } catch (e) {
        try {
          rawError = await response.text() || rawError;
        } catch (_) {}
      }

      console.warn(`[AI OPTIMISE SERVICE ERROR] status=${status} message="${rawError}"`);
      throw mapApiError(status, rawError);
    }

    return await response.json();
  } catch (error: any) {
    console.error('Error in runAiSinglePageOptimise:', error);
    throw error;
  }
};


export const getDashboardCache = async (viewMode: string) => {
  try {
    let tableName = 'dashboard_cache';
    let query = supabase.from(tableName).select('*');
    
    if (viewMode === 'rolling') {
      tableName = 'dashboard_cache';
      query = supabase.from(tableName).select('*').eq('view_mode', 'rolling');
    } else if (viewMode === '28days') {
      tableName = 'dashboard_cache_weekly';
      query = supabase.from(tableName).select('*');
    } else if (viewMode === 'monthly') {
      tableName = 'dashboard_cache_monthly';
      query = supabase.from(tableName).select('*');
    } else if (viewMode === '3months') {
      tableName = 'dashboard_cache_3m';
      query = supabase.from(tableName).select('*');
    }
    
    const { data, error } = await query;
      
    if (error) {
       console.error('Error fetching dashboard cache:', error);
       return {};
    }
    
    // Convert array to object keyed by client_id
    const cacheMap = {};
    for (const row of data || []) {
       cacheMap[row.client_id] = row;
    }
    return cacheMap;
  } catch (error) {
    console.error('Error fetching dashboard cache:', error);
    return {};
  }
};
