/**
 * Configuration and classification for WordPress plugin update safety.
 * Protects production client sites from breaking due to layout or fatal incompatibility updates.
 */

export interface PluginSafetyRule {
  slugPattern: RegExp;
  namePattern?: RegExp;
  category: 'PAGE_BUILDER' | 'DYNAMIC_DATA' | 'ECOMMERCE' | 'MULTILINGUAL' | 'CORE_FRAMEWORK' | 'THEME_ENGINE' | 'CACHE_OPTIMIZER' | 'SECURITY' | 'FORMS';
  riskLevel: 'HIGH' | 'CRITICAL';
  reason: string;
}

/**
 * List of high-risk / restricted plugins that must NOT be updated via one-click dashboard.
 * Requires staging environment testing or technical team manual approval.
 */
export const RESTRICTED_PLUGINS: PluginSafetyRule[] = [
  // Page Builders
  {
    slugPattern: /elementor/i,
    namePattern: /elementor/i,
    category: 'PAGE_BUILDER',
    riskLevel: 'HIGH',
    reason: 'Page builder updates can break layouts, custom widgets, or trigger fatal PHP errors.'
  },
  {
    slugPattern: /(divi|et_bloom|et_monarch)/i,
    namePattern: /divi/i,
    category: 'PAGE_BUILDER',
    riskLevel: 'HIGH',
    reason: 'Divi builder updates frequently modify shortcode rendering and section layouts.'
  },
  {
    slugPattern: /(js_composer|visual_composer|wpbakery)/i,
    namePattern: /(wpbakery|visual composer)/i,
    category: 'PAGE_BUILDER',
    riskLevel: 'HIGH',
    reason: 'WPBakery updates can break legacy grid shortcodes and nested columns.'
  },
  {
    slugPattern: /beaver-builder/i,
    namePattern: /beaver builder/i,
    category: 'PAGE_BUILDER',
    riskLevel: 'HIGH',
    reason: 'Beaver Builder updates alter core module markup and styling.'
  },

  // Dynamic Data & Custom Fields
  {
    slugPattern: /(advanced-custom-fields|acf)/i,
    namePattern: /advanced custom fields/i,
    category: 'DYNAMIC_DATA',
    riskLevel: 'HIGH',
    reason: 'ACF updates can alter field key formats, REST API endpoints, or break theme templates.'
  },
  {
    slugPattern: /pods/i,
    namePattern: /pods/i,
    category: 'DYNAMIC_DATA',
    riskLevel: 'HIGH',
    reason: 'Pods database changes can alter custom post type definitions and custom fields.'
  },

  // E-Commerce & Payment Gateways
  {
    slugPattern: /woocommerce/i,
    namePattern: /woocommerce/i,
    category: 'ECOMMERCE',
    riskLevel: 'CRITICAL',
    reason: 'WooCommerce updates may require database migrations and can break checkout/payment gateways.'
  },
  {
    slugPattern: /(woocommerce-gateway-stripe|stripe)/i,
    namePattern: /stripe/i,
    category: 'ECOMMERCE',
    riskLevel: 'CRITICAL',
    reason: 'Payment gateway updates must be tested on staging to prevent loss of live customer orders.'
  },

  // Multilingual & Translation Engines
  {
    slugPattern: /(sitepress-multilingual-cms|wpml)/i,
    namePattern: /wpml/i,
    category: 'MULTILINGUAL',
    riskLevel: 'HIGH',
    reason: 'WPML updates run heavy SQL migrations and can desynchronize translated pages.'
  },
  {
    slugPattern: /polylang/i,
    namePattern: /polylang/i,
    category: 'MULTILINGUAL',
    riskLevel: 'HIGH',
    reason: 'Polylang updates alter taxonomy relationships and multilingual post linkages.'
  },

  // Cache & Deep Minification / Performance Engines (High Risk for Broken CSS/JS)
  {
    slugPattern: /seraphinite-accelerator/i,
    namePattern: /seraphinite accelerator/i,
    category: 'CACHE_OPTIMIZER',
    riskLevel: 'HIGH',
    reason: 'Seraphinite Accelerator modifies server-level page caching, HTML minification, and JS deferrals. Updating can break site layout, scripts, or create 500 server errors.'
  },
  {
    slugPattern: /(wp-rocket|litespeed-cache|w3-total-cache|nitropack|wp-super-cache|object-cache-pro)/i,
    namePattern: /(wp rocket|litespeed cache|w3 total cache|nitropack|wp super cache|object cache pro)/i,
    category: 'CACHE_OPTIMIZER',
    riskLevel: 'HIGH',
    reason: 'Deep caching and CDN engines alter server rewrite rules, object cache connections, and minification pipelines.'
  },

  // Theme Framework Builders (Avada / Fusion / Astra Pro)
  {
    slugPattern: /(fusion-builder|fusion-core|fusion-white-label)/i,
    namePattern: /(avada builder|avada core|fusion builder|fusion core)/i,
    category: 'THEME_ENGINE',
    riskLevel: 'HIGH',
    reason: 'Avada / Fusion Builder is tied directly to the theme architecture. Version mismatches crash headers, footers, and page layouts.'
  },
  {
    slugPattern: /astra-addon/i,
    namePattern: /astra pro/i,
    category: 'THEME_ENGINE',
    riskLevel: 'HIGH',
    reason: 'Astra Pro theme addon controls site headers, navbars, and hooks. Major updates can alter CSS grid layouts.'
  },

  // Security Firewalls (WAF & Login Lockdown)
  {
    slugPattern: /(wordfence|sucuri-scanner|better-wp-security|all-in-one-wp-security)/i,
    namePattern: /(wordfence|sucuri|ithemes security|all-in-one security|aios)/i,
    category: 'SECURITY',
    riskLevel: 'HIGH',
    reason: 'Firewall and security plugins rewrite .htaccess or user.ini. Updates can accidentally lock out users, API calls, or WordPress bridge pings.'
  },

  // Complex Dynamic Form & Booking Engines
  {
    slugPattern: /(formidable-pro|fluentformpro|booking-package|wpdev-booking)/i,
    namePattern: /(formidable forms pro|fluent forms pro|booking calendar|booking package)/i,
    category: 'FORMS',
    riskLevel: 'HIGH',
    reason: 'Advanced form and booking engines store complex customer lead structures and payment calculations in custom SQL tables.'
  }
];

export interface PluginSafetyCheckResult {
  isRestricted: boolean;
  category?: string;
  riskLevel?: 'HIGH' | 'CRITICAL';
  reason?: string;
}

/**
 * Checks whether a given plugin slug or name is restricted from automated dashboard updates.
 */
export function checkPluginSafety(slug: string, name?: string): PluginSafetyCheckResult {
  const cleanSlug = (slug || '').toLowerCase();
  const cleanName = (name || '').toLowerCase();

  for (const rule of RESTRICTED_PLUGINS) {
    if (rule.slugPattern.test(cleanSlug) || (rule.namePattern && rule.namePattern.test(cleanName))) {
      return {
        isRestricted: true,
        category: rule.category,
        riskLevel: rule.riskLevel,
        reason: rule.reason
      };
    }
  }

  return { isRestricted: false };
}
