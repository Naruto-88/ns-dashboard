import https from 'https';
import http from 'http';
import tls from 'tls';
import { URL } from 'url';

export interface SiteHealthResult {
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
  pluginsData: any[];
  issues: string[];
  scannedAt: string;
}

const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes client URL from GSC URL or custom wordpress_url to a clean base URL.
 * Prefers HTTPS whenever possible.
 */
export function extractCleanBaseUrl(gscUrl?: string, wpUrl?: string): string {
  let url = (wpUrl && wpUrl.trim().length > 0) ? wpUrl.trim() : (gscUrl && gscUrl.trim().length > 0) ? gscUrl.trim() : '';
  if (!url) return '';

  if (url.startsWith('sc-domain:')) {
    url = 'https://' + url.replace('sc-domain:', '');
  }

  // If missing scheme, default to https://
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // If http:// was entered but the site might support https, prefer https:// for root audits
  return url;
}

/**
 * Checks SSL certificate expiry and validity safely using direct TLS handshake with SNI.
 * If targetUrl was given as http, tests host on port 443 with TLS anyway.
 */
export function checkSslCertificate(targetUrl: string): Promise<{ valid: boolean; daysLeft: number; issuer?: string }> {
  return new Promise((resolve) => {
    try {
      let host = '';
      try {
        const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        host = parsed.hostname;
      } catch {
        return resolve({ valid: false, daysLeft: 0, issuer: 'Invalid URL' });
      }

      if (!host) {
        return resolve({ valid: false, daysLeft: 0, issuer: 'Invalid Host' });
      }

      const socket = tls.connect({
        host,
        port: 443,
        servername: host, // Mandatory SNI for modern shared/cloud hosting (Cloudflare, cPanel, etc.)
        rejectUnauthorized: false, // Allow inspection of expired or self-signed certs
        timeout: 9000,
      }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();

        if (!cert || Object.keys(cert).length === 0) {
          return resolve({ valid: false, daysLeft: 0, issuer: 'Unknown' });
        }

        const validTo = new Date(cert.valid_to);
        const validFrom = new Date(cert.valid_from);
        const now = new Date();
        const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const rawIssuer = cert.issuer?.O || cert.issuer?.CN || 'Recognized CA';
        const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] : String(rawIssuer);
        const isNotYetValid = now.getTime() < validFrom.getTime();

        resolve({
          valid: daysLeft > 0 && !isNotYetValid,
          daysLeft: Math.max(0, daysLeft),
          issuer,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ valid: false, daysLeft: 0, issuer: 'Timeout' });
      });

      socket.on('error', (err: any) => {
        socket.destroy();
        resolve({ valid: false, daysLeft: 0, issuer: err.message || 'Handshake Error' });
      });
    } catch {
      resolve({ valid: false, daysLeft: 0, issuer: 'Invalid URL' });
    }
  });
}

/**
 * Performs fast head/get request to check HTTP response, follows redirects, and checks noindex tag
 */
export async function checkHttpStatusAndNoindex(targetUrl: string): Promise<{
  status: number | null;
  responseTime: number;
  hasNoindex: boolean;
}> {
  const start = Date.now();
  const testUrl = targetUrl.startsWith('http://') ? targetUrl.replace('http://', 'https://') : targetUrl;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-AU,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseTime = Date.now() - start;
    let textSnippet = '';
    try {
      textSnippet = (await response.text()).slice(0, 5000).toLowerCase();
    } catch {
      // Body reading is secondary
    }

    const hasNoindex = textSnippet.includes('content="noindex') || 
                       textSnippet.includes("content='noindex") ||
                       response.headers.get('x-robots-tag')?.toLowerCase().includes('noindex') || false;

    return {
      status: response.status,
      responseTime,
      hasNoindex,
    };
  } catch (err: any) {
    // If https failed, fallback to original targetUrl (e.g. http://)
    if (testUrl !== targetUrl) {
      try {
        const fallbackCtrl = new AbortController();
        const fallbackTid = setTimeout(() => fallbackCtrl.abort(), 6000);
        const fbRes = await fetch(targetUrl, {
          method: 'GET',
          headers: { 'User-Agent': BROWSER_USER_AGENT },
          redirect: 'follow',
          signal: fallbackCtrl.signal,
        });
        clearTimeout(fallbackTid);
        return {
          status: fbRes.status,
          responseTime: Date.now() - start,
          hasNoindex: false,
        };
      } catch {
        // Fallback failed too
      }
    }

    return {
      status: null,
      responseTime: Date.now() - start,
      hasNoindex: false,
    };
  }
}

/**
 * Checks if sitemap exists and counts URLs
 */
export async function checkSitemap(baseUrl: string): Promise<{
  status: 'OK' | 'MISSING' | 'ERROR';
  url: string;
  count: number;
}> {
  const cleanBase = baseUrl.startsWith('http://') ? baseUrl.replace('http://', 'https://') : baseUrl;
  const possiblePaths = [
    '/sitemap_index.xml',
    '/sitemap.xml',
    '/wp-sitemap.xml',
  ];

  for (const path of possiblePaths) {
    const testUrl = `${cleanBase}${path}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(testUrl, {
        method: 'GET',
        headers: { 
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'application/xml,text/xml,*/*;q=0.9'
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        if (text.includes('<urlset') || text.includes('<sitemapindex')) {
          const locMatches = text.match(/<loc>/gi) || [];
          return {
            status: 'OK',
            url: testUrl,
            count: locMatches.length,
          };
        }
      }
    } catch {
      // try next path
    }
  }

  return {
    status: 'MISSING',
    url: `${cleanBase}/sitemap_index.xml`,
    count: 0,
  };
}

/**
 * Checks robots.txt
 */
export async function checkRobotsTxt(baseUrl: string): Promise<'OK' | 'MISSING' | 'BLOCKING'> {
  const cleanBase = baseUrl.startsWith('http://') ? baseUrl.replace('http://', 'https://') : baseUrl;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${cleanBase}/robots.txt`, {
      method: 'GET',
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const body = await res.text();
      if (body.includes('Disallow: /') && !body.includes('Disallow: /wp-admin/')) {
        const lines = body.split('\n').map(l => l.trim());
        if (lines.some(l => l === 'Disallow: /')) {
          return 'BLOCKING';
        }
      }
      return 'OK';
    }
    return 'MISSING';
  } catch {
    return 'MISSING';
  }
}

/**
 * Authenticated ping to the WordPress Bridge plugin if configured.
 * Follows redirects and supports query parameter fallback if header gets stripped by proxies.
 */
export async function pingWpBridge(baseUrl: string, secretKey?: string): Promise<{
  connected: boolean;
  wpVersion?: string;
  phpVersion?: string;
  bridgeVersion?: string;
  pluginsTotal: number;
  pluginsOutdated: number;
  pluginsData: any[];
}> {
  if (!secretKey || secretKey.trim().length === 0) {
    return {
      connected: false,
      pluginsTotal: 0,
      pluginsOutdated: 0,
      pluginsData: [],
    };
  }

  const cleanBase = baseUrl.startsWith('http://') ? baseUrl.replace('http://', 'https://') : baseUrl;

  // 1. Primary REST API Endpoint
  const endpoints = [
    `${cleanBase}/wp-json/mc-bridge/v1/status`,
    `${cleanBase}/index.php?rest_route=/mc-bridge/v1/status`,
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-MC-Bridge-Key': secretKey,
          'Authorization': `Bearer ${secretKey}`,
          'User-Agent': BROWSER_USER_AGENT,
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (data.success || data.wp_version)) {
          // Resolve installed bridge version:
          // 1. From root data.bridge_version
          // 2. Fallback: locate 'mission-control-site-bridge' in the plugins array
          const selfPlugin = (data.plugins || []).find((p: any) => 
            p.slug && p.slug.includes('mission-control-site-bridge')
          );
          const resolvedBridgeVersion = data.bridge_version || (selfPlugin ? selfPlugin.current_version : null) || '1.0.0';

          return {
            connected: true,
            wpVersion: data.wp_version,
            phpVersion: data.php_version,
            bridgeVersion: resolvedBridgeVersion,
            pluginsTotal: data.plugins_total || 0,
            pluginsOutdated: data.plugins_outdated || 0,
            pluginsData: data.plugins || [],
          };
        }
      }
    } catch {
      // try fallback endpoint
    }
  }

  return {
    connected: false,
    pluginsTotal: 0,
    pluginsOutdated: 0,
    pluginsData: [],
  };
}

/**
 * Orchestrates a complete health audit for a given client
 */
export async function auditSingleClient(client: {
  id: string;
  name: string;
  short_code: string;
  gsc_site_url?: string;
  wordpress_url?: string;
  seo_webhook_secret?: string;
}): Promise<SiteHealthResult> {
  const baseUrl = extractCleanBaseUrl(client.gsc_site_url, client.wordpress_url);
  const issues: string[] = [];

  if (!baseUrl) {
    return {
      clientId: client.id,
      clientName: client.name,
      shortCode: client.short_code,
      siteUrl: '',
      isOnline: false,
      httpStatus: null,
      responseTimeMs: 0,
      sslValid: false,
      sslDaysLeft: 0,
      sitemapStatus: 'MISSING',
      sitemapUrl: '',
      sitemapCount: 0,
      robotsStatus: 'MISSING',
      hasNoindex: false,
      wpConnected: false,
      pluginsTotal: 0,
      pluginsOutdated: 0,
      pluginsData: [],
      issues: ['No valid URL configured'],
      scannedAt: new Date().toISOString(),
    };
  }

  // Run all passive checks concurrently for ultra-fast scanning
  const [ssl, httpRes, sitemap, robots, wpBridge] = await Promise.all([
    checkSslCertificate(baseUrl),
    checkHttpStatusAndNoindex(baseUrl),
    checkSitemap(baseUrl),
    checkRobotsTxt(baseUrl),
    pingWpBridge(baseUrl, client.seo_webhook_secret),
  ]);

  // A site is considered Online if:
  // 1. Returns standard 2xx/3xx HTTP code
  // 2. Returns 403 or 401 (e.g. Cloudflare / Wordfence challenge or protected area)
  // 3. Or WordPress bridge successfully responded
  const isOnline = (httpRes.status !== null && (httpRes.status >= 200 && httpRes.status < 500)) || wpBridge.connected;

  if (!isOnline) {
    issues.push(`Website offline or unreachable (${httpRes.status ? `HTTP ${httpRes.status}` : 'Connection Timeout'})`);
  }
  if (!ssl.valid) {
    issues.push('SSL Certificate Invalid or Expired');
  } else if (ssl.daysLeft < 20) {
    issues.push(`SSL Expiring Soon (${ssl.daysLeft} days remaining)`);
  }
  if (sitemap.status !== 'OK') {
    issues.push('No valid XML sitemap detected');
  }
  if (robots === 'BLOCKING') {
    issues.push('robots.txt is blocking all search crawlers (Disallow: /)');
  }
  if (httpRes.hasNoindex) {
    issues.push('noindex tag detected on homepage!');
  }
  if (wpBridge.connected && wpBridge.pluginsOutdated > 0) {
    issues.push(`${wpBridge.pluginsOutdated} WordPress plugin updates pending`);
  }

  return {
    clientId: client.id,
    clientName: client.name,
    shortCode: client.short_code,
    siteUrl: baseUrl,
    isOnline,
    httpStatus: httpRes.status || (isOnline ? 200 : null),
    responseTimeMs: httpRes.responseTime,
    sslValid: ssl.valid,
    sslDaysLeft: ssl.daysLeft,
    sslIssuer: ssl.issuer,
    sitemapStatus: sitemap.status,
    sitemapUrl: sitemap.url,
    sitemapCount: sitemap.count,
    robotsStatus: robots,
    hasNoindex: httpRes.hasNoindex,
    wpConnected: wpBridge.connected,
    wpVersion: wpBridge.wpVersion,
    phpVersion: wpBridge.phpVersion,
    bridgeVersion: wpBridge.bridgeVersion,
    pluginsTotal: wpBridge.pluginsTotal,
    pluginsOutdated: wpBridge.pluginsOutdated,
    pluginsData: wpBridge.pluginsData,
    issues,
    scannedAt: new Date().toISOString(),
  };
}
