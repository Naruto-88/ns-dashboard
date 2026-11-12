<?php
/**
 * Plugin Name: Netstripes Mission Control Site Bridge
 * Plugin URI: https://netstripes.com
 * Description: Securely connects WordPress sites to Netstripes Mission Control for Health Monitoring, SEO Management, and Remote Plugin Maintenance.
 * Version: 1.6.0
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * Author: Netstripes Development Team
 * License: GPL-2.0+
 */

if (!defined('ABSPATH')) {
    exit;
}

define('MC_SITE_BRIDGE_VERSION', '1.6.0');

/**
 * Resolves the client IP address for rate-limiting.
 * Uses validated REMOTE_ADDR to prevent forwarded header spoofing.
 */
function mc_bridge_get_client_ip() {
    $remote = !empty($_SERVER['REMOTE_ADDR']) ? sanitize_text_field($_SERVER['REMOTE_ADDR']) : '0.0.0.0';
    return filter_var($remote, FILTER_VALIDATE_IP) ? $remote : '0.0.0.0';
}

/**
 * Structured, bounded audit logger (stores last 100 operations with zero secrets)
 */
// Dedicated numeric rate counters and append-only audit rows. Upgrade runs on updates too.
function mc_bridge_install_storage() {
    global $wpdb;
    if (get_site_option('mc_bridge_storage_version') === '1.6.0') return;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $charset = $wpdb->get_charset_collate();
    $rate = $wpdb->base_prefix . 'mc_bridge_rate';
    $audit = $wpdb->base_prefix . 'mc_bridge_audit';
    dbDelta("CREATE TABLE {$rate} (
        ip_hash char(64) NOT NULL,
        attempts bigint unsigned NOT NULL DEFAULT 0,
        expires_at bigint unsigned NOT NULL,
        PRIMARY KEY  (ip_hash),
        KEY expires_at (expires_at)
    ) {$charset};");
    dbDelta("CREATE TABLE {$audit} (
        id bigint unsigned NOT NULL AUTO_INCREMENT,
        blog_id bigint unsigned NOT NULL,
        event_json longtext NOT NULL,
        PRIMARY KEY  (id),
        KEY blog_id (blog_id)
    ) {$charset};");
    // Verify both tables before marking this migration complete.
    if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($rate))) === $rate &&
        $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($audit))) === $audit) {
        update_site_option('mc_bridge_storage_version', '1.6.0');
    }
}
add_action('plugins_loaded', 'mc_bridge_install_storage');
register_activation_hook(__FILE__, 'mc_bridge_install_storage');

function mc_bridge_log_audit($action, $target, $status, $details = array()) {
    global $wpdb;
    // Caller-supplied actor is a label, never a verified human identity.
    $label = isset($_SERVER['HTTP_X_MC_ACTOR']) ? sanitize_text_field($_SERVER['HTTP_X_MC_ACTOR']) : '';
    $entry = array(
        'timestamp' => current_time('mysql', 1),
        'ip' => mc_bridge_get_client_ip(),
        'actor' => 'bridge-service-user:' . get_current_user_id(),
        'actor_label' => wp_check_invalid_utf8(substr($label, 0, 100), true),
        'action' => sanitize_key($action),
        'target' => wp_check_invalid_utf8(substr((string)$target, 0, 200), true),
        'status' => sanitize_key($status),
        // Do not persist arbitrary errors/payloads, which may contain secrets.
        'operation_id' => isset($GLOBALS['mc_bridge_operation_id']) ? $GLOBALS['mc_bridge_operation_id'] : ''
    );
    return $wpdb->insert($wpdb->base_prefix . 'mc_bridge_audit', array(
        'blog_id' => get_current_blog_id(), 'event_json' => wp_json_encode($entry)
    )) === 1;
}

function mc_bridge_recent_audit() {
    global $wpdb;
    $rows = $wpdb->get_col($wpdb->prepare('SELECT event_json FROM ' . $wpdb->base_prefix .
        'mc_bridge_audit WHERE blog_id = %d ORDER BY id DESC LIMIT 100', get_current_blog_id()));
    return array_values(array_filter(array_map(function($row) { return json_decode($row, true); }, (array)$rows), 'is_array'));
}

function mc_bridge_record_failed_attempt($ip, $window = 1800) {
    global $wpdb;
    $table = $wpdb->base_prefix . 'mc_bridge_rate';
    $now = time();
    $key = hash('sha256', $ip);
    // Assignment order matters: calculate attempts before replacing expiry.
    $ok = $wpdb->query($wpdb->prepare(
        "INSERT INTO {$table} (ip_hash, attempts, expires_at) VALUES (%s, 1, %d)
         ON DUPLICATE KEY UPDATE attempts = IF(expires_at <= %d, 1, LEAST(attempts + 1, 1000000)),
         expires_at = IF(expires_at <= %d, VALUES(expires_at), expires_at)",
        $key, $now + $window, $now, $now));
    if ($ok === false) return new WP_Error('rate_storage_failed', 'Authentication temporarily unavailable.', array('status' => 503));
    // Bounded, expiry-only cleanup. Never remove live lockouts.
    $wpdb->query($wpdb->prepare("DELETE FROM {$table} WHERE expires_at <= %d LIMIT 100", $now));
    $row = $wpdb->get_row($wpdb->prepare("SELECT attempts, expires_at FROM {$table} WHERE ip_hash = %s", $key));
    if (!$row) return new WP_Error('rate_storage_failed', 'Authentication temporarily unavailable.', array('status' => 503));
    return array('allowed' => (int)$row->attempts < 3, 'retry_after' => max(1, (int)$row->expires_at - $now));
}

/**
 * Header-Only Authentication Guard (Fix F01: Valid credentials verified before IP lockout check)
 */
function mc_bridge_verify_auth(WP_REST_Request $request) {
    // 1. Resolve Authorization Key: HEADERS ONLY (URL parameters and body keys disallowed)
    $provided_key = $request->get_header('X-MC-Bridge-Key');
    if (empty($provided_key)) {
        $auth_header = $request->get_header('Authorization');
        if (!empty($auth_header) && preg_match('/^Bearer\s+([^\s]+)$/i', $auth_header, $matches)) {
            $provided_key = trim($matches[1]);
        }
    }

    $stored_secret = get_option('mc_bridge_secret_key');
    if (defined('MC_BRIDGE_SECRET_KEY') && !empty(MC_BRIDGE_SECRET_KEY)) {
        $stored_secret = MC_BRIDGE_SECRET_KEY;
    }

    $client_ip = mc_bridge_get_client_ip();
    $is_valid = !empty($stored_secret) && !empty($provided_key) && 
                 strlen($provided_key) >= 16 && strlen($provided_key) <= 256 &&
                 preg_match('/^[a-zA-Z0-9_\-]+$/', $provided_key) &&
                 hash_equals((string)$stored_secret, (string)$provided_key);

    // 2. Fix F01: Only enforce IP-based rate limiting on INVALID credentials!
    if (!$is_valid) {
        $rate_check = mc_bridge_record_failed_attempt($client_ip);
        if (is_wp_error($rate_check)) return $rate_check;
        if (!$rate_check['allowed']) {
            if (!headers_sent()) {
                header('Retry-After: ' . $rate_check['retry_after']);
            }
            return new WP_Error(
                'too_many_requests',
                'Security Alert: Maximum invalid token attempts exceeded. Your IP has been temporarily locked out for ' . ceil($rate_check['retry_after'] / 60) . ' minutes.',
                array('status' => 429)
            );
        }

        return new WP_Error('rest_forbidden', 'Invalid authorization token or missing header.', array('status' => 403));
    }

    if (!is_ssl()) {
        return new WP_Error('https_required', 'Bridge requests require HTTPS. Configure trusted TLS termination in WordPress.', array('status' => 403));
    }
    $scope_map = array('update-plugin' => 'plugins', 'activate-plugin' => 'plugins', 'update-seo' => 'seo', 'create-blog-post' => 'publish');
    $route_name = basename($request->get_route());
    if (isset($scope_map[$route_name]) && !get_option('mc_bridge_scope_' . $scope_map[$route_name], 0)) {
        return new WP_Error('scope_disabled', 'This remote operation scope is disabled.', array('status' => 403));
    }
    // 3. Check Write Operations Kill Switch for mutating requests
    $method = $request->get_method();
    if ($method !== 'GET') {
        $writes_enabled = (bool) get_option('mc_bridge_write_enabled', 0) && get_option('mc_bridge_reviewed_version') === '1.6.0';
        if (defined('MC_BRIDGE_READ_ONLY') && MC_BRIDGE_READ_ONLY) {
            $writes_enabled = false;
        }
        if (!$writes_enabled) {
            return new WP_Error('writes_disabled', 'Remote maintenance and write operations are disabled by site administrator kill switch.', array('status' => 403));
        }
    }

    // 4. Strict security and non-cacheable headers for authenticated REST responses
    if (!headers_sent()) {
        header('Cache-Control: no-store, no-cache, must-revalidate, private');
        header('Pragma: no-cache');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
    }

    return true;
}

/**
 * Safely elevate context to a designated or verified site administrator.
 * Fix F05: If configured service user is set but invalid/ineligible, FAIL CLOSED instead of falling back.
 */
function mc_bridge_elevate_admin() {
    $id = (int)get_option('mc_bridge_service_user_id', 0);
    $user = $id > 0 ? get_userdata($id) : false;
    if (!$user || !is_user_member_of_blog($id, get_current_blog_id()) || !user_can($user, 'manage_options')) return false;
    wp_set_current_user($id);
    return true;
}

/**
 * Atomic Installation-Wide Upgrade & Maintenance Lock Manager
 * Fix F02: Renewal and release use atomic CAS/WHERE matching the exact owner token.
 */
function mc_bridge_acquire_lock($operation, $slug, $ttl = 300) {
    global $wpdb;
    $table = $wpdb->base_prefix . 'options';
    $option_name = '_mc_bridge_upgrade_lock';
    $now = time();
    $token = wp_generate_password(32, false);

    $lock_data = array(
        'token'      => $token,
        'operation'  => sanitize_key($operation),
        'slug'       => sanitize_text_field($slug),
        'acquired'   => $now,
        'expires_at' => $now + $ttl,
    );
    $encoded = json_encode($lock_data);

    // Atomic INSERT
    $wpdb->query($wpdb->prepare(
        "INSERT INTO {$table} (option_name, option_value, autoload) VALUES (%s, %s, 'no') ON DUPLICATE KEY UPDATE option_name = option_name",
        $option_name, $encoded
    ));

    $row = $wpdb->get_row($wpdb->prepare("SELECT option_value FROM {$table} WHERE option_name = %s", $option_name));
    if ($row) {
        $existing = json_decode($row->option_value, true);
        if (is_array($existing) && isset($existing['token'], $existing['expires_at'])) {
            if ($existing['token'] === $token) {
                $GLOBALS['mc_bridge_owned_lock'] = $token;
                return array('success' => true, 'token' => $token);
            }
            if ($existing['expires_at'] > $now) {
                return array('success' => false, 'error' => 'Another maintenance operation is currently running on this WordPress installation.');
            }
            return array('success' => false, 'error' => 'Previous maintenance lock needs operator review; elapsed time does not prove the worker stopped.');
        }
    }

    return array('success' => false, 'error' => 'Could not acquire installation maintenance lock.');
}

/**
 * Fix F02: Atomic renewal verifying token and CAS on current value
 */
function mc_bridge_renew_lock($token, $extend_seconds = 180) {
    global $wpdb;
    if (empty($token)) return false;
    $table = $wpdb->base_prefix . 'options';
    $option_name = '_mc_bridge_upgrade_lock';
    
    $row = $wpdb->get_row($wpdb->prepare("SELECT option_value FROM {$table} WHERE option_name = %s", $option_name));
    if ($row) {
        $data = json_decode($row->option_value, true);
        if (is_array($data) && isset($data['token']) && hash_equals((string)$data['token'], (string)$token)) {
            $data['expires_at'] = max($data['expires_at'], time() + $extend_seconds);
            $new_val = json_encode($data);
            if ($new_val === $row->option_value) return true;
            $updated = $wpdb->query($wpdb->prepare(
                "UPDATE {$table} SET option_value = %s WHERE option_name = %s AND BINARY option_value = BINARY %s",
                $new_val, $option_name, $row->option_value
            ));
            return $updated > 0;
        }
    }
    return false;
}

/**
 * Fix F02: Atomic release verifying token and CAS on current value
 */
function mc_bridge_release_lock($token) {
    global $wpdb;
    if (empty($token)) return false;
    $table = $wpdb->base_prefix . 'options';
    $option_name = '_mc_bridge_upgrade_lock';
    
    $row = $wpdb->get_row($wpdb->prepare("SELECT option_value FROM {$table} WHERE option_name = %s", $option_name));
    if ($row) {
        $data = json_decode($row->option_value, true);
        if (is_array($data) && isset($data['token']) && hash_equals((string)$data['token'], (string)$token)) {
            $deleted = $wpdb->query($wpdb->prepare(
                "DELETE FROM {$table} WHERE option_name = %s AND BINARY option_value = BINARY %s",
                $option_name, $row->option_value
            ));
            return $deleted > 0;
        }
    }
    return false;
}

/**
 * Register REST API Routes
 */
add_action('rest_api_init', function () {
    register_rest_route('mc-bridge/v1', '/status', array(
        'methods'             => 'GET',
        'callback'            => 'mc_bridge_get_status',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    register_rest_route('mc-bridge/v1', '/update-plugin', array(
        'methods'             => 'POST',
        'callback'            => 'mc_bridge_update_plugin',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    register_rest_route('mc-bridge/v1', '/activate-plugin', array(
        'methods'             => 'POST',
        'callback'            => 'mc_bridge_activate_plugin',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    register_rest_route('mc-bridge/v1', '/posts-seo', array(
        'methods'             => 'GET',
        'callback'            => 'mc_bridge_get_posts_seo',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    register_rest_route('mc-bridge/v1', '/update-seo', array(
        'methods'             => 'POST',
        'callback'            => 'mc_bridge_update_post_seo',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    register_rest_route('mc-bridge/v1', '/create-blog-post', array(
        'methods'             => 'POST',
        'callback'            => 'mc_bridge_create_blog_post',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));
});

/**
 * 1. Health & Plugin Inventory Handler
 */
function mc_bridge_get_status() {
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    if (!function_exists('wp_version_check')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }

    wp_update_plugins();

    $all_plugins = get_plugins();
    $update_plugins_transient = get_site_transient('update_plugins');

    $plugin_list = array();
    $outdated_count = 0;

    foreach ($all_plugins as $plugin_file => $data) {
        $has_update = isset($update_plugins_transient->response[$plugin_file]);
        $new_version = $has_update ? $update_plugins_transient->response[$plugin_file]->new_version : null;
        $package = $has_update ? (isset($update_plugins_transient->response[$plugin_file]->package) ? $update_plugins_transient->response[$plugin_file]->package : '') : '';

        if ($has_update) {
            $outdated_count++;
        }

        $is_site_active = in_array($plugin_file, (array) get_option('active_plugins', array()), true);
        $is_net_active = is_multisite() && function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($plugin_file);

        $plugin_list[] = array(
            'slug'              => $plugin_file,
            'name'              => $data['Name'],
            'current_version'   => $data['Version'],
            'author'            => wp_strip_all_tags($data['Author']),
            'is_active'         => $is_site_active || $is_net_active,
            'is_network_active' => $is_net_active,
            'has_update'        => $has_update,
            'new_version'       => $new_version,
            'can_auto_update'   => !empty($package)
        );
    }

    global $wp_version;

    return new WP_REST_Response(array(
        'success'          => true,
        'site_name'        => get_bloginfo('name'),
        'site_url'         => home_url(),
        'wp_version'       => $wp_version,
        'php_version'      => PHP_VERSION,
        'bridge_version'   => MC_SITE_BRIDGE_VERSION,
        'server_software'  => isset($_SERVER['SERVER_SOFTWARE']) ? sanitize_text_field($_SERVER['SERVER_SOFTWARE']) : '',
        'plugins_total'    => count($all_plugins),
        'plugins_outdated' => $outdated_count,
        'plugins'          => $plugin_list,
        'writes_enabled'   => (bool)get_option('mc_bridge_write_enabled', 0) && get_option('mc_bridge_reviewed_version') === '1.6.0' && !(defined('MC_BRIDGE_READ_ONLY') && MC_BRIDGE_READ_ONLY),
        'checked_at'       => current_time('mysql', 1)
    ), 200);
}

/**
 * 2. Remote Plugin Upgrade Handler (Fix F07: supported version_compare operator and expected version check)
 */
function mc_bridge_update_plugin_impl(WP_REST_Request $request) {
    if (!mc_bridge_elevate_admin()) {
        return new WP_Error('unauthorized', 'Could not establish administrator execution context on this WordPress site.', array('status' => 403));
    }

    if (!current_user_can('update_plugins')) {
        return new WP_Error('forbidden', 'Current user lacks update_plugins permission.', array('status' => 403));
    }

    if (is_multisite() && !current_user_can('manage_network_plugins')) {
        return new WP_Error('forbidden', 'Multisite shared plugin updates require network admin authorization.', array('status' => 403));
    }

    $params = mc_bridge_validate_body($request);
    if (is_wp_error($params)) return $params;
    $plugin_slug = isset($params['slug']) ? sanitize_text_field($params['slug']) : '';

    if (empty($plugin_slug)) {
        return new WP_Error('missing_slug', 'Plugin file slug is required.', array('status' => 400));
    }

    if (!preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $plugin_slug) || strpos($plugin_slug, '..') !== false) {
        return new WP_Error('invalid_slug', 'Malformed or unsafe plugin slug detected.', array('status' => 400));
    }

    if (strpos($plugin_slug, 'mission-control-site-bridge') !== false) {
        return new WP_Error('forbidden_target', 'Security Alert: Direct modification of the bridge plugin via this endpoint is prohibited.', array('status' => 403));
    }

    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    $installed_plugins = get_plugins();
    if (!isset($installed_plugins[$plugin_slug])) {
        return new WP_Error('plugin_not_installed', 'The requested plugin is not installed on this site.', array('status' => 404));
    }

    // Acquire atomic installation maintenance lock
    $lock = mc_bridge_acquire_lock('update', $plugin_slug, 300);
    if (!$lock['success']) {
        return new WP_Error('upgrade_in_progress', $lock['error'], array('status' => 409));
    }
    $lock_token = $lock['token'];



    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';

    ob_start();
    $creds = request_filesystem_credentials('', '', false, false, null);
    ob_end_clean();

    if (!WP_Filesystem($creds)) {
        if (!WP_Filesystem()) {
            return new WP_Error('fs_unavailable', 'WordPress Filesystem credentials could not be initialized.', array('status' => 500));
        }
    }

    $old_version = isset($installed_plugins[$plugin_slug]['Version']) ? (string)$installed_plugins[$plugin_slug]['Version'] : '';
    
    $active_plugins_before = (array) get_option('active_plugins', array());
    $was_site_active = in_array($plugin_slug, $active_plugins_before, true);
    $was_network_active = is_multisite() && function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($plugin_slug);

    if (!function_exists('wp_update_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    wp_update_plugins();
    $current_update = get_site_transient('update_plugins');
    $has_available_update = isset($current_update->response[$plugin_slug]);
    $expected_new_version = $has_available_update && !empty($current_update->response[$plugin_slug]->new_version) ? (string)$current_update->response[$plugin_slug]->new_version : '';

    if (!$has_available_update) {
        if (!isset($current_update->no_update[$plugin_slug])) return new WP_Error('update_check_incomplete', 'No authoritative update result is available for this plugin.', array('status' => 503));
        return new WP_REST_Response(array('success' => true, 'status' => 'already_up_to_date', 'slug' => $plugin_slug,
            'old_version' => $old_version, 'new_version' => $old_version, 'is_active' => is_plugin_active($plugin_slug),
            'is_network_active' => is_multisite() && is_plugin_active_for_network($plugin_slug), 'health_verified' => false), 200);
    }

    if (!class_exists('MC_Silent_Upgrader_Skin')) {
        class MC_Silent_Upgrader_Skin extends WP_Upgrader_Skin {
            public $feedback_messages = array();
            public $errors = array();

            public function feedback($string, ...$args) {
                if (!empty($args)) {
                    $string = vsprintf($string, $args);
                }
                $this->feedback_messages[] = $string;
            }
            public function error($errors) {
                $this->errors[] = $errors;
            }
            public function header() {}
            public function footer() {}
        }
    }

    $skin = new MC_Silent_Upgrader_Skin();
    $upgrader = new Plugin_Upgrader($skin);

    // Auto-renew lock during upgrader steps
    $renew_callback = function($res) use ($lock_token) {
        if (!mc_bridge_renew_lock($lock_token, 180)) return new WP_Error('lock_lost', 'Maintenance lock ownership lost.');
        return $res;
    };
    add_filter('upgrader_pre_install', $renew_callback, 5);
    add_filter('upgrader_source_selection', $renew_callback, 5);

    try {
        $bulk_results = $upgrader->bulk_upgrade(array($plugin_slug));
    } finally {
        remove_filter('upgrader_pre_install', $renew_callback, 5);
        remove_filter('upgrader_source_selection', $renew_callback, 5);
    }

    $result = (is_array($bulk_results) && array_key_exists($plugin_slug, $bulk_results)) ? $bulk_results[$plugin_slug] : false;

    if (is_wp_error($result)) {
        mc_bridge_log_audit('plugin_update', $plugin_slug, 'failed', array('error' => $result->get_error_message()));
        return new WP_Error('upgrade_failed', $result->get_error_message(), array(
            'status' => 500,
            'logs'   => $skin->feedback_messages,
            'errors' => $skin->errors
        ));
    } elseif ($result === false || $result === null) {
        mc_bridge_log_audit('plugin_update', $plugin_slug, 'failed', array('error' => 'Upgrader returned false'));
        return new WP_Error('upgrade_failed', 'Upgrader returned false. Possible filesystem permission or package issue.', array(
            'status' => 500,
            'logs'   => $skin->feedback_messages,
            'errors' => $skin->errors
        ));
    }

    if (function_exists('wp_clean_plugins_cache')) {
        wp_clean_plugins_cache(true);
    }
    wp_cache_delete('alloptions', 'options');
    wp_cache_delete('active_plugins', 'options');

    $fresh_plugins = get_plugins();
    if (!isset($fresh_plugins[$plugin_slug]) || empty($fresh_plugins[$plugin_slug]['Version'])) {
        mc_bridge_log_audit('plugin_update', $plugin_slug, 'verification_failed', array('error' => 'Plugin entry missing after update'));
        return new WP_Error('verification_failed', 'Plugin files could not be verified after upgrade.', array('status' => 500));
    }
    $new_version = (string)$fresh_plugins[$plugin_slug]['Version'];

    // Never overwrite another administrator's activation decision.
    $restored_active = false;
    $site_active_now = in_array($plugin_slug, (array)get_option('active_plugins', array()), true);
    $network_active_now = is_multisite() && is_plugin_active_for_network($plugin_slug);
    $activation_changed = $site_active_now !== $was_site_active || $network_active_now !== $was_network_active;

    // Truthful Verification Status (Fix F07: documented '==' operator and expected version check)
    $is_genuinely_updated = version_compare($new_version, $old_version, '>');
    $verification_status = 'updated';
    if (!$is_genuinely_updated) {
        if (!$has_available_update && version_compare($new_version, $old_version, '==')) {
            $verification_status = 'already_up_to_date';
        } else {
            $verification_status = 'verification_pending';
        }
    } elseif (!$has_available_update || empty($expected_new_version) || !version_compare($new_version, $expected_new_version, '==')) {
        $verification_status = 'verification_pending';
    }


    if ($activation_changed) $verification_status = 'verification_pending';
    mc_bridge_log_audit('plugin_update', $plugin_slug, $verification_status, array(
        'old_version' => $old_version,
        'new_version' => $new_version
    ));

    return new WP_REST_Response(array(
        'success'             => true,
        'status'              => $verification_status,
        'message'             => "Plugin {$plugin_slug} processed: {$old_version} -> {$new_version}",
        'slug'                => $plugin_slug,
        'old_version'         => $old_version,
        'new_version'         => $new_version,
        'is_active'           => $site_active_now || $network_active_now,
        'is_network_active'   => $network_active_now,
        'activation_changed' => $activation_changed,
        'health_verified' => false,
        'restored_active'     => $restored_active,
        'logs'                => $skin->feedback_messages
    ), 200);
}

/**
 * 3. Remote Plugin Activation Handler (Fix F06: effective network check & non-silent hooks)
 */
function mc_bridge_activate_plugin_impl(WP_REST_Request $request) {
    if (!mc_bridge_elevate_admin()) {
        return new WP_Error('unauthorized', 'Could not establish administrator execution context.', array('status' => 403));
    }

    if (!current_user_can('activate_plugins')) {
        return new WP_Error('forbidden', 'Current user lacks activate_plugins permission.', array('status' => 403));
    }

    $params = mc_bridge_validate_body($request);
    if (is_wp_error($params)) return $params;
    $plugin_slug = isset($params['slug']) ? sanitize_text_field($params['slug']) : '';
    
    // Strict JSON boolean check on network_wide (Fix F06)
    $network_wide = false;
    if (array_key_exists('network_wide', $params)) {
        if (!is_bool($params['network_wide'])) {
            return new WP_Error('invalid_boolean', 'Field network_wide must be a strict JSON boolean.', array('status' => 400));
        }
        $network_wide = $params['network_wide'];
    }

    if (empty($plugin_slug) || !preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $plugin_slug) || strpos($plugin_slug, '..') !== false) {
        return new WP_Error('invalid_slug', 'Malformed or unsafe plugin slug detected.', array('status' => 400));
    }

    if (!function_exists('get_plugins') || !function_exists('activate_plugin')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $installed = get_plugins();
    if (!isset($installed[$plugin_slug])) {
        return new WP_Error('plugin_not_installed', 'The requested plugin is not installed on this site.', array('status' => 404));
    }

    // Fix F06: Calculate effective network scope based on plugin file header (Network: true)
    $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin_slug, false, false);
    $is_network_only = !empty($plugin_data['Network']);
    $effective_network_wide = $is_network_only || ($network_wide && is_multisite());

    if ($effective_network_wide && is_multisite() && !current_user_can('manage_network_plugins')) {
        return new WP_Error('forbidden', 'Network-wide activation requires manage_network_plugins capability.', array('status' => 403));
    }

    $lock = mc_bridge_acquire_lock('activate', $plugin_slug, 60);
    if (!$lock['success']) {
        return new WP_Error('operation_in_progress', $lock['error'], array('status' => 409));
    }

    // Fix F06: Normal activation with silent=false so standard activation hooks run
    $act_result = activate_plugin($plugin_slug, '', $effective_network_wide, false);

    if (is_wp_error($act_result)) {
        mc_bridge_log_audit('plugin_activate', $plugin_slug, 'failed', array('error' => $act_result->get_error_message()));
        return new WP_Error('activation_failed', $act_result->get_error_message(), array('status' => 500));
    }

    wp_cache_delete('alloptions', 'options');
    wp_cache_delete('active_plugins', 'options');

    mc_bridge_log_audit('plugin_activate', $plugin_slug, 'success', array('effective_network_wide' => $effective_network_wide));

    return new WP_REST_Response(array(
        'success'           => true,
        'message'           => 'Plugin activated successfully: ' . $plugin_slug,
        'slug'              => $plugin_slug,
        'is_active'         => is_plugin_active($plugin_slug),
        'is_network_active' => is_multisite() && function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($plugin_slug)
    ), 200);
}

/**
 * 4. Fetch Posts & Pages along with Rank Math / Yoast Meta
 */
function mc_bridge_get_posts_seo_impl(WP_REST_Request $request) {
    $post_type = $request->get_param('post_type');
    $allowed_types = get_post_types(array('public' => true));
    
    if (empty($post_type)) {
        $default_types = array_values(array_filter($allowed_types, function($t) {
            return $t !== 'attachment' && $t !== 'revision' && $t !== 'nav_menu_item';
        }));
        $post_type = !empty($default_types) ? $default_types : array('post', 'page');
    } elseif (is_string($post_type)) {
        if ($post_type === 'any' || $post_type === 'all') {
            $default_types = array_values(array_filter($allowed_types, function($t) {
                return $t !== 'attachment' && $t !== 'revision' && $t !== 'nav_menu_item';
            }));
            $post_type = !empty($default_types) ? $default_types : array('post', 'page');
        } else {
            $post_type = in_array($post_type, $allowed_types, true) ? array($post_type) : array('post');
        }
    } elseif (is_array($post_type)) {
        $post_type = array_values(array_intersect($post_type, $allowed_types));
        if (empty($post_type)) $post_type = array('post', 'page');
    }

    $per_page = intval($request->get_param('per_page'));
    if ($per_page <= 0 || $per_page > 100) $per_page = 50;

    $paged = intval($request->get_param('page'));
    if ($paged <= 0) $paged = 1;

    $search = sanitize_text_field($request->get_param('search'));
    $specific_post_id = intval($request->get_param('post_id'));

    $args = array(
        'post_type'      => $post_type,
        'post_status'    => array('publish', 'draft'),
        'posts_per_page' => $per_page,
        'paged'          => $paged,
        'orderby'        => 'date',
        'order'          => 'DESC'
    );

    if ($specific_post_id > 0) {
        $args['p'] = $specific_post_id;
    } elseif (!empty($search)) {
        if (is_numeric($search)) {
            $args['p'] = intval($search);
        } else {
            $args['s'] = $search;
        }
    }

    $query = new WP_Query($args);
    $posts_data = array();

    foreach ($query->posts as $p) {
        if (!current_user_can('edit_post', $p->ID)) continue;
        $post_id = $p->ID;

        $rm_title = get_post_meta($post_id, 'rank_math_title', true);
        $rm_desc  = get_post_meta($post_id, 'rank_math_description', true);
        $rm_kw    = get_post_meta($post_id, 'rank_math_focus_keyword', true);

        $yoast_title = get_post_meta($post_id, '_yoast_wpseo_title', true);
        $yoast_desc  = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
        $yoast_kw    = get_post_meta($post_id, '_yoast_wpseo_focuskw', true);

        $seo_plugin = 'none';
        if (defined('RANK_MATH_VERSION')) {
            $seo_plugin = 'rank_math';
        } elseif (defined('WPSEO_VERSION')) {
            $seo_plugin = 'yoast';
        }

        $clean_excerpt = wp_strip_all_tags(strip_shortcodes($p->post_content));
        if (function_exists('mb_substr')) {
            $clean_excerpt = mb_substr(preg_replace('/\s+/', ' ', $clean_excerpt), 0, 500);
        } else {
            $clean_excerpt = substr(preg_replace('/\s+/', ' ', $clean_excerpt), 0, 500);
        }

        $posts_data[] = array(
            'id'             => $post_id,
            'title'          => html_entity_decode(get_the_title($post_id)),
            'slug'           => $p->post_name,
            'post_type'      => $p->post_type,
            'status'         => $p->post_status,
            'link'           => get_permalink($post_id),
            'date'           => $p->post_date,
            'modified'       => $p->post_modified,
            'excerpt'        => $clean_excerpt,
            'seo_plugin'     => $seo_plugin,
            'rank_math'      => array(
                'title'         => $rm_title ? html_entity_decode($rm_title) : '',
                'description'   => $rm_desc ? html_entity_decode($rm_desc) : '',
                'focus_keyword' => $rm_kw ? html_entity_decode($rm_kw) : ''
            ),
            'yoast'          => array(
                'title'         => $yoast_title ? html_entity_decode($yoast_title) : '',
                'description'   => $yoast_desc ? html_entity_decode($yoast_desc) : '',
                'focus_keyword' => $yoast_kw ? html_entity_decode($yoast_kw) : ''
            ),
            'effective_seo'  => array(
                'title'         => !empty($rm_title) ? html_entity_decode($rm_title) : (!empty($yoast_title) ? html_entity_decode($yoast_title) : html_entity_decode(get_the_title($post_id))),
                'description'   => !empty($rm_desc) ? html_entity_decode($rm_desc) : (!empty($yoast_desc) ? html_entity_decode($yoast_desc) : ''),
                'focus_keyword' => !empty($rm_kw) ? html_entity_decode($rm_kw) : (!empty($yoast_kw) ? html_entity_decode($yoast_kw) : ''),
                'schema'        => get_post_meta($post_id, 'mc_custom_schema', true)
            )
        );
    }

    return new WP_REST_Response(array(
        'success'      => true,
        'total'        => $query->found_posts,
        'pages'        => $query->max_num_pages,
        'current_page' => $paged,
        'posts'        => $posts_data
    ), 200);
}

/**
 * 5. Update Post SEO Meta (Fix F08 & F09: input validation, snapshot verification, and schema equality readback)
 */
function mc_bridge_update_post_seo_impl(WP_REST_Request $request) {
    if (!mc_bridge_elevate_admin()) {
        return new WP_Error('unauthorized', 'Could not establish administrator execution context.', array('status' => 403));
    }

    $params = mc_bridge_validate_body($request);
    if (is_wp_error($params)) return $params;
    if (!is_array($params)) {
        return new WP_Error('invalid_payload', 'JSON object body is required.', array('status' => 400));
    }

    if (!isset($params['post_id']) || !is_int($params['post_id'])) {
        return new WP_Error('invalid_post_id', 'Positive integer post_id is required.', array('status' => 400));
    }
    $post_id = intval($params['post_id']);
    $post = get_post($post_id);

    if ($post_id <= 0 || !$post) {
        return new WP_Error('invalid_post_id', 'Valid Post ID is required.', array('status' => 400));
    }

    if (!current_user_can('edit_post', $post_id)) {
        return new WP_Error('forbidden', 'Current user lacks edit_post permission for this content.', array('status' => 403));
    }

    $update_post_title = false;
    if (array_key_exists('update_post_title', $params)) {
        if (!is_bool($params['update_post_title'])) {
            return new WP_Error('invalid_boolean_format', 'Field update_post_title must be a strict JSON boolean.', array('status' => 400));
        }
        $update_post_title = $params['update_post_title'];
    }

    // Pre-validate Schema payload BEFORE any mutation (Fix F09)
    $clean_schema_string = null;
    $schema_action = 'keep';

    if (array_key_exists('schema_json', $params)) {
        $raw_schema = $params['schema_json'];
        if ($raw_schema === null || $raw_schema === '') {
            $schema_action = 'clear';
        } elseif (is_bool($raw_schema) || is_int($raw_schema) || is_float($raw_schema)) {
            return new WP_Error('invalid_schema_type', 'Unsupported scalar type for schema_json. Must be JSON string, object or array.', array('status' => 400));
        } elseif (is_string($raw_schema)) {
            $trimmed = trim($raw_schema);
            if (strlen($raw_schema) > 200000) {
                return new WP_Error('schema_too_large', 'Schema payload exceeds maximum allowed size (200KB).', array('status' => 400));
            }
            if ($trimmed === '') {
                $schema_action = 'clear';
            } else {
                $decoded = json_decode($trimmed, false, 32);
                if (json_last_error() !== JSON_ERROR_NONE || (!is_object($decoded) && !is_array($decoded))) {
                    return new WP_Error('invalid_schema_json', 'Malformed JSON-LD schema provided: ' . json_last_error_msg(), array('status' => 400));
                }
                // Verify root structure is an object or array of objects
                if (is_array($decoded)) {
                    foreach ($decoded as $item) {
                        if (!is_object($item)) {
                            return new WP_Error('invalid_schema_json', 'Schema array root must contain JSON objects.', array('status' => 400));
                        }
                    }
                }
                $clean_schema_string = wp_json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                if ($clean_schema_string === false || strlen($clean_schema_string) > 200000) {
                    return new WP_Error('schema_encoding_error', 'Schema could not be encoded within size limits.', array('status' => 400));
                }
                $schema_action = 'update';
            }
        } elseif (is_object($raw_schema) || is_array($raw_schema)) {
            $re_encoded = wp_json_encode($raw_schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($re_encoded === false || strlen($re_encoded) > 200000) {
                return new WP_Error('schema_too_large', 'Schema object exceeds maximum allowed size (200KB).', array('status' => 400));
            }
            $decoded = json_decode($re_encoded, false, 32);
            if (json_last_error() !== JSON_ERROR_NONE || (!is_object($decoded) && !is_array($decoded))) {
                return new WP_Error('invalid_schema_json', 'Malformed JSON-LD object provided: ' . json_last_error_msg(), array('status' => 400));
            }
            if (is_array($decoded)) {
                foreach ($decoded as $item) {
                    if (!is_object($item)) {
                        return new WP_Error('invalid_schema_json', 'Schema array root must contain JSON objects.', array('status' => 400));
                    }
                }
            }
            $clean_schema_string = $re_encoded;
            $schema_action = 'update';
        }
    }

    // Capture durable pre-write snapshot with wp_slash protection (Fix F08)
    $meta_keys = array(
        'rank_math_title', 'rank_math_description', 'rank_math_focus_keyword',
        '_yoast_wpseo_title', '_yoast_wpseo_metadesc', '_yoast_wpseo_focuskw',
        'mc_custom_schema'
    );
    $snapshot_meta = array();
    foreach ($meta_keys as $mk) {
        $snapshot_meta[$mk] = array(
            'exists' => metadata_exists('post', $post_id, $mk),
            'value'  => get_post_meta($post_id, $mk, true)
        );
    }
    $durable_snapshot = array(
        'timestamp'         => current_time('mysql', 1),
        'post_modified_gmt' => $post->post_modified_gmt,
        'post_title'        => $post->post_title,
        'meta'              => $snapshot_meta
    );
    $snapshot_key = '_mc_seo_snapshot_' . $GLOBALS['mc_bridge_operation_id'];
    if (!add_post_meta($post_id, $snapshot_key, wp_slash($durable_snapshot), true) || get_post_meta($post_id, $snapshot_key, true) !== $durable_snapshot) {
        return new WP_Error('snapshot_failed', 'No content written: durable snapshot could not be verified.', array('status' => 503));
    }

    $raw_post_title = isset($params['post_title']) ? sanitize_text_field($params['post_title']) : null;
    $seo_title      = isset($params['meta_title']) ? sanitize_text_field($params['meta_title']) : null;
    $seo_desc       = isset($params['meta_description']) ? sanitize_textarea_field($params['meta_description']) : null;
    $focus_kw       = isset($params['focus_keyword']) ? sanitize_text_field($params['focus_keyword']) : null;

    $updated_keys = array();

    // 1. Update native post_title ONLY if explicitly requested
    if ($update_post_title) {
        $target_wp_title = $raw_post_title !== null ? $raw_post_title : $seo_title;
        if ($target_wp_title !== null && $target_wp_title !== $post->post_title) {
            $update_res = wp_update_post(array(
                'ID'         => $post_id,
                'post_title' => wp_slash($target_wp_title)
            ), true);
            if (is_wp_error($update_res)) {
                return new WP_Error('post_title_update_failed', $update_res->get_error_message(), array('status' => 500));
            }
            if (get_post($post_id)->post_title !== $target_wp_title) throw new RuntimeException('Native title verification failed.');
            $updated_keys[] = 'post_title';
        }
    }

    // 2. Update SEO plugin meta keys
    if ($seo_title !== null) {
        mc_bridge_write_meta($post_id, 'rank_math_title', $seo_title);
        mc_bridge_write_meta($post_id, '_yoast_wpseo_title', $seo_title);
        $updated_keys[] = 'meta_title';
    }
    if ($seo_desc !== null) {
        mc_bridge_write_meta($post_id, 'rank_math_description', $seo_desc);
        mc_bridge_write_meta($post_id, '_yoast_wpseo_metadesc', $seo_desc);
        $updated_keys[] = 'meta_description';
    }
    if ($focus_kw !== null) {
        mc_bridge_write_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
        mc_bridge_write_meta($post_id, '_yoast_wpseo_focuskw', $focus_kw);
        $updated_keys[] = 'focus_keyword';
    }

    // 3. Update Custom Schema with wp_slash and equality readback (Fix F09)
    if ($schema_action === 'update' && $clean_schema_string !== null) {
        update_post_meta($post_id, 'mc_custom_schema', wp_slash($clean_schema_string));
        $stored_readback = get_post_meta($post_id, 'mc_custom_schema', true);
        if ($stored_readback !== $clean_schema_string) {
            return new WP_Error('schema_verification_failed', 'Stored schema does not match submitted payload.', array('status' => 500));
        }
        $updated_keys[] = 'schema';
    } elseif ($schema_action === 'clear') {
        delete_post_meta($post_id, 'mc_custom_schema');
        if (metadata_exists('post', $post_id, 'mc_custom_schema')) {
            return new WP_Error('schema_clear_failed', 'Failed to remove schema metadata from database.', array('status' => 500));
        }
        $updated_keys[] = 'schema';
    }

    clean_post_cache($post_id);

    if (class_exists('LiteSpeed_Cache_API')) {
        LiteSpeed_Cache_API::purge_post($post_id);
    } elseif (has_action('litespeed_purge_post')) {
        do_action('litespeed_purge_post', $post_id);
    }
    if (function_exists('rocket_clean_post')) {
        rocket_clean_post($post_id);
    }
    if (function_exists('w3tc_flush_post')) {
        w3tc_flush_post($post_id);
    }
    if (function_exists('wp_cache_post_change')) {
        wp_cache_post_change($post_id);
    }
    if (function_exists('nitropack_purge_post')) {
        nitropack_purge_post($post_id);
    }

    mc_bridge_log_audit('seo_update', "Post #{$post_id}", 'success', array('keys' => $updated_keys));

    return new WP_REST_Response(array(
        'success'        => true,
        'message'        => 'SEO meta updated successfully',
        'post_id'        => $post_id,
        'updated_keys'   => $updated_keys,
        'snapshot_key' => $snapshot_key,
        'previous_state' => $durable_snapshot
    ), 200);
}

/**
 * 6. Create / Publish Blog Post (Fix F04: Atomic Reservation Idempotency)
 */
function mc_bridge_create_blog_post_impl(WP_REST_Request $request) {
    if (!mc_bridge_elevate_admin()) {
        return new WP_Error('unauthorized', 'Could not establish administrator execution context.', array('status' => 403));
    }

    $params = mc_bridge_validate_body($request);
    if (is_wp_error($params)) return $params;
    $title   = isset($params['title']) ? sanitize_text_field($params['title']) : '';
    $content = isset($params['content']) ? wp_kses_post($params['content']) : '';
    $status  = isset($params['status']) && in_array($params['status'], array('publish', 'draft'), true) ? $params['status'] : 'draft';

    if ($status === 'publish' && !current_user_can('publish_posts')) {
        return new WP_Error('forbidden', 'Current user lacks publish_posts permission.', array('status' => 403));
    } elseif (!current_user_can('edit_posts')) {
        return new WP_Error('forbidden', 'Current user lacks edit_posts permission.', array('status' => 403));
    }

    if (empty($title) || empty($content)) {
        return new WP_Error('missing_data', 'Title and Content are required.', array('status' => 400));
    }

    $job = mc_bridge_reserve_blog($request, $params);
    if (is_wp_error($job) || $job instanceof WP_REST_Response) return $job;

    $post_data = array(
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_type'    => 'post',
        'post_author'  => get_current_user_id() ? get_current_user_id() : null
    );

    $new_post_id = wp_insert_post(wp_slash($post_data), true);
    if (is_wp_error($new_post_id)) {
        // Keep ambiguous reservations for reconciliation; never silently retry publication.
        mc_bridge_log_audit('create_blog', $title, 'failed', array('error' => $new_post_id->get_error_message()));
        return new WP_Error('post_creation_failed', $new_post_id->get_error_message(), array('status' => 500));
    }

    mc_bridge_write_meta($new_post_id, '_mc_idempotency_hash', $job['key']);

    // Rank Math & Yoast Meta
    if (!empty($params['meta_title'])) {
        $meta_title = sanitize_text_field($params['meta_title']);
        mc_bridge_write_meta($new_post_id, 'rank_math_title', $meta_title);
        mc_bridge_write_meta($new_post_id, '_yoast_wpseo_title', $meta_title);
    }
    if (!empty($params['meta_description'])) {
        $meta_desc = sanitize_textarea_field($params['meta_description']);
        mc_bridge_write_meta($new_post_id, 'rank_math_description', $meta_desc);
        mc_bridge_write_meta($new_post_id, '_yoast_wpseo_metadesc', $meta_desc);
    }
    if (!empty($params['focus_keyword'])) {
        $kw = sanitize_text_field($params['focus_keyword']);
        mc_bridge_write_meta($new_post_id, 'rank_math_focus_keyword', $kw);
        mc_bridge_write_meta($new_post_id, '_yoast_wpseo_focuskw', $kw);
    }

    if (!empty($params['tags']) && is_array($params['tags'])) {
        $clean_tags = array_map('sanitize_text_field', $params['tags']);
        $tag_result = wp_set_post_tags($new_post_id, $clean_tags);
        if (is_wp_error($tag_result)) throw new RuntimeException('Tags could not be saved; reconcile this operation.');
    }

    global $wpdb;
    $done = wp_json_encode(array('status' => 'completed', 'request_hash' => $job['request_hash'], 'post_id' => $new_post_id));
    $saved = $wpdb->query($wpdb->prepare('UPDATE ' . $wpdb->base_prefix . 'options SET option_value = %s WHERE option_name = %s AND BINARY option_value = BINARY %s', $done, $job['key'], $job['reservation']));
    if ($saved !== 1) throw new RuntimeException('Post exists but completion could not be recorded; reconcile this operation.');
    clean_post_cache($new_post_id);
    mc_bridge_log_audit('create_blog', "Post #{$new_post_id}", 'success', array('status' => $status));

    return new WP_REST_Response(array(
        'success'      => true,
        'deduplicated' => false,
        'message'      => 'Blog post created successfully',
        'post_id'      => $new_post_id,
        'link'         => get_permalink($new_post_id),
        'edit_link'    => get_edit_post_link($new_post_id, 'raw'),
        'status'       => $status
    ), 200);
}

/**
 * 7. Dynamic JSON-LD Schema Injector in WordPress Frontend <head>
 * Re-encodes validated JSON with HEX flags to neutralize script breakout.
 */
add_action('wp_head', function () {
    if (!is_singular()) {
        return;
    }

    $post_id = get_queried_object_id();
    if (!$post_id) {
        return;
    }

    $custom_schema = get_post_meta($post_id, 'mc_custom_schema', true);
    if (!empty($custom_schema)) {
        $decoded = is_string($custom_schema) ? json_decode($custom_schema, false, 32) : $custom_schema;
        if (!empty($decoded) && (is_object($decoded) || is_array($decoded))) {
            $safe_json = wp_json_encode($decoded, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
            if ($safe_json !== false) {
                echo "\n<!-- Netstripes Mission Control Schema (JSON-LD) -->\n";
                echo '<script type="application/ld+json">' . "\n";
                echo $safe_json;
                echo "\n</script>\n<!-- /Netstripes Mission Control Schema -->\n";
            }
        }
    }
}, 99);

/**
 * 8. WP Admin Settings Interface (Settings -> MC Site Bridge)
 */
add_action('admin_menu', function () {
    add_options_page('MC Site Bridge', 'MC Site Bridge', 'manage_options', 'mc-site-bridge', 'mc_bridge_render_admin_page');
});

function mc_bridge_render_admin_page() {
    if (!current_user_can('manage_options')) return;

    $is_constant = defined('MC_BRIDGE_SECRET_KEY') && !empty(MC_BRIDGE_SECRET_KEY);

    if (isset($_POST['mc_save_settings']) && check_admin_referer('mc_bridge_settings_action')) {
        $writes_enabled = isset($_POST['mc_write_enabled']) ? 1 : 0;
        update_option('mc_bridge_write_enabled', $writes_enabled);
        update_option('mc_bridge_reviewed_version', '1.6.0');
        foreach (array('plugins', 'seo', 'publish') as $scope) {
            update_option('mc_bridge_scope_' . $scope, isset($_POST['mc_scope_' . $scope]) ? 1 : 0);
        }

        if (isset($_POST['mc_service_user_id'])) {
            update_option('mc_bridge_service_user_id', intval($_POST['mc_service_user_id']));
        }
        echo '<div class="notice notice-success is-dismissible"><p>Bridge settings saved.</p></div>';
    }

    if (!$is_constant && isset($_POST['mc_generate_key']) && check_admin_referer('mc_bridge_key_action')) {
        $new_key = 'ns_' . bin2hex(random_bytes(24));
        update_option('mc_bridge_secret_key', $new_key);
        echo '<div class="notice notice-success is-dismissible"><p>New API Key Generated successfully.</p></div>';
    }

    $key = $is_constant ? MC_BRIDGE_SECRET_KEY : get_option('mc_bridge_secret_key');
    if (empty($key)) {
        $key = 'ns_' . bin2hex(random_bytes(24));
        update_option('mc_bridge_secret_key', $key);
    }

    $writes_enabled = (bool)get_option('mc_bridge_write_enabled', 0) && get_option('mc_bridge_reviewed_version') === '1.6.0';
    $service_user_id = (int) get_option('mc_bridge_service_user_id', 0);
    $audit_logs = mc_bridge_recent_audit();
    $admins = get_users(array('role' => 'administrator'));
    ?>
    <div class="wrap">
        <h1>Netstripes Mission Control Site Bridge <span style="font-size:12px; vertical-align:middle; background:#0284c7; color:#fff; padding:3px 10px; border-radius:12px;">v1.6.0</span></h1>
        <p>Connects this WordPress installation to your agency Mission Control Hub for health monitoring and safe remote updates.</p>

        <form method="post" style="margin-bottom: 24px;">
            <?php wp_nonce_field('mc_bridge_settings_action'); ?>
            <table class="form-table">
                <tr>
                    <th scope="row">Authorization Key</th>
                    <td>
                        <?php if ($is_constant): ?>
                            <input type="text" readonly value="<?php echo esc_attr('••••••••'); ?>" class="regular-text code" style="font-size:14px; font-weight:bold; width:450px;" />
                            <p class="description"><span style="color:#059669; font-weight:bold;">&#x2714; Configured securely in wp-config.php via MC_BRIDGE_SECRET_KEY</span></p>
                        <?php else: ?>
                            <input type="text" readonly value="<?php echo esc_attr($key); ?>" class="regular-text code" style="font-size:14px; font-weight:bold; width:450px;" />
                            <p class="description">Copy this key into the client settings in Mission Control.</p>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Remote Write Kill Switch</th>
                    <td>
                        <label>
                            <input type="checkbox" name="mc_write_enabled" value="1" <?php checked($writes_enabled, true); ?> />
                            <strong>Enable remote maintenance and write operations</strong>
                        </label>
                        <p class="description">If unchecked, Mission Control can only read health status and SEO; all remote updates and publishing are blocked.</p>
                    </td>
                </tr>
                <tr><th>Allowed remote operations</th><td>
                    <?php foreach (array('plugins' => 'Plugin updates and activation', 'seo' => 'SEO edits', 'publish' => 'Blog creation and publishing') as $scope => $label): ?>
                    <label><input type="checkbox" name="mc_scope_<?php echo esc_attr($scope); ?>" value="1" <?php checked((bool)get_option('mc_bridge_scope_' . $scope, 0)); ?> /> <?php echo esc_html($label); ?></label><br />
                    <?php endforeach; ?>
                    <p>Scopes apply to this site's shared bridge credential. This is not per-human identity.</p>
                </td></tr>
                <tr>
                    <th scope="row">Designated Service Admin</th>
                    <td>
                        <select name="mc_service_user_id">
                            <option value="0">Select an administrator (required)</option>
                            <?php foreach ($admins as $admin_user): ?>
                                <option value="<?php echo esc_attr($admin_user->ID); ?>" <?php selected($service_user_id, $admin_user->ID); ?>>
                                    <?php echo esc_html($admin_user->display_name . ' (' . $admin_user->user_email . ')'); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <p class="description">The specific administrator account context used for authenticated remote operations.</p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">REST Status Endpoint</th>
                    <td>
                        <code><?php echo esc_url(rest_url('mc-bridge/v1/status')); ?></code>
                    </td>
                </tr>
            </table>
            <p class="submit">
                <input type="submit" name="mc_save_settings" class="button button-primary" value="Save Settings" />
            </p>
        </form>

        <?php if (!$is_constant): ?>
        <form method="post" onsubmit="return confirm('Regenerating will disconnect previous integrations until updated in dashboard. Continue?');" style="margin-bottom: 30px;">
            <?php wp_nonce_field('mc_bridge_key_action'); ?>
            <input type="submit" name="mc_generate_key" class="button button-secondary" value="Regenerate API Key" />
        </form>
        <?php endif; ?>

        <h2>Recent Operation Audit Log (Last 10 Events)</h2>
        <table class="widefat fixed striped">
            <thead>
                <tr>
                    <th style="width: 160px;">Timestamp (UTC)</th>
                    <th style="width: 140px;">Action</th>
                    <th>Target</th>
                    <th style="width: 120px;">Actor / IP</th>
                    <th style="width: 100px;">Status</th>
                </tr>
            </thead>
            <tbody>
                <?php if (empty($audit_logs)): ?>
                    <tr><td colspan="5">No remote operations logged yet.</td></tr>
                <?php else: ?>
                    <?php foreach (array_slice($audit_logs, 0, 10) as $log): ?>
                        <tr>
                            <td><?php echo esc_html($log['timestamp']); ?></td>
                            <td><code><?php echo esc_html($log['action']); ?></code></td>
                            <td><?php echo esc_html($log['target']); ?></td>
                            <td><?php echo esc_html($log['actor'] . ' (' . $log['ip'] . ')'); ?></td>
                            <td>
                                <span style="font-weight:bold; color: <?php echo $log['status'] === 'success' || $log['status'] === 'updated' ? '#059669' : ($log['status'] === 'failed' ? '#dc2626' : '#d97706'); ?>;">
                                    <?php echo esc_html(strtoupper($log['status'])); ?>
                                </span>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                <?php endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}

function mc_bridge_update_plugin(WP_REST_Request $request) { return mc_bridge_dispatch($request, "mc_bridge_update_plugin_impl"); }

function mc_bridge_activate_plugin(WP_REST_Request $request) { return mc_bridge_dispatch($request, "mc_bridge_activate_plugin_impl"); }

function mc_bridge_update_post_seo(WP_REST_Request $request) { return mc_bridge_dispatch($request, "mc_bridge_update_post_seo_impl"); }

function mc_bridge_create_blog_post(WP_REST_Request $request) { return mc_bridge_dispatch($request, "mc_bridge_create_blog_post_impl"); }

/** Strict body validation is shared by the callback and write dispatcher. */
function mc_bridge_validate_body(WP_REST_Request $request) {
    $body = $request->get_body();
    if (!is_string($body) || strlen($body) > 1048576) return new WP_Error('payload_too_large', 'JSON body exceeds 1 MiB.', array('status' => 413));
    $object = json_decode($body, false, 40);
    if (json_last_error() !== JSON_ERROR_NONE || !is_object($object)) return new WP_Error('invalid_payload', 'A valid JSON object is required (maximum depth 40).', array('status' => 400));
    $params = get_object_vars($object);
    $route = basename($request->get_route());
    $allowed = array(
        'update-plugin' => array('slug'),
        'activate-plugin' => array('slug', 'network_wide'),
        'update-seo' => array('post_id', 'post_title', 'meta_title', 'meta_description', 'focus_keyword', 'update_post_title', 'schema_json'),
        'create-blog-post' => array('title', 'content', 'status', 'meta_title', 'meta_description', 'focus_keyword', 'tags', 'idempotency_key')
    );
    if (!isset($allowed[$route]) || array_diff(array_keys($params), $allowed[$route])) return new WP_Error('unknown_fields', 'Unsupported request fields.', array('status' => 400));
    $limits = array('slug' => 255, 'post_title' => 1000, 'title' => 1000, 'meta_title' => 1000,
        'meta_description' => 10000, 'focus_keyword' => 2000, 'content' => 800000, 'status' => 10, 'idempotency_key' => 128);
    foreach ($limits as $field => $limit) {
        if (array_key_exists($field, $params) && (!is_string($params[$field]) || strlen($params[$field]) > $limit)) return new WP_Error('invalid_field', $field . ' must be a bounded string.', array('status' => 400));
    }
    foreach (array('network_wide', 'update_post_title') as $field) {
        if (array_key_exists($field, $params) && !is_bool($params[$field])) return new WP_Error('invalid_boolean', $field . ' must be true or false.', array('status' => 400));
    }
    if (isset($params['status']) && !in_array($params['status'], array('draft', 'publish'), true)) return new WP_Error('invalid_status', 'Status must be draft or publish.', array('status' => 400));
    if (array_key_exists('tags', $params)) {
        if (!is_array($params['tags']) || count($params['tags']) > 50) return new WP_Error('invalid_tags', 'At most 50 tag strings allowed.', array('status' => 400));
        foreach ($params['tags'] as $tag) if (!is_string($tag) || strlen($tag) > 200) return new WP_Error('invalid_tags', 'Each tag must be a string of at most 200 bytes.', array('status' => 400));
    }
    return $params;
}

function mc_bridge_write_meta($post_id, $key, $value) {
    update_post_meta($post_id, $key, wp_slash($value));
    if (!metadata_exists('post', $post_id, $key) || get_post_meta($post_id, $key, true) !== $value) {
        throw new RuntimeException('Metadata verification failed; inspect the operation snapshot.');
    }
}

function mc_bridge_reserve_blog(WP_REST_Request $request, $params) {
    global $wpdb;
    $header = $request->get_header('X-MC-Idempotency-Key');
    $key = isset($params['idempotency_key']) ? $params['idempotency_key'] : $header;
    if (!is_string($key) || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $key) || ($header && $header !== $key)) {
        return new WP_Error('invalid_idempotency_key', 'Supply one consistent idempotency key: 16–128 ASCII letters, digits, underscore or hyphen.', array('status' => 400));
    }
    $table = $wpdb->base_prefix . 'options';
    // Old cross-site reservations cannot safely be attributed to a specific blog.
    $legacy = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$table} WHERE option_name = %s", '_mc_idem_' . md5($key)));
    if ($legacy !== null || $wpdb->last_error) return new WP_Error('legacy_or_storage_conflict', 'Reconcile the previous operation before retrying.', array('status' => 409));
    unset($params['idempotency_key']);
    ksort($params);
    $hash = hash('sha256', wp_json_encode($params));
    $name = '_mc_job_' . hash('sha256', get_current_blog_id() . ':create-blog:' . $key);
    $reservation = wp_json_encode(array('status' => 'in_progress', 'request_hash' => $hash, 'owner' => bin2hex(random_bytes(32)), 'created' => time()));
    $res = $wpdb->query($wpdb->prepare("INSERT INTO {$table} (option_name, option_value, autoload) VALUES (%s, %s, 'no') ON DUPLICATE KEY UPDATE option_name = option_name", $name, $reservation));
    if ($res === false) return new WP_Error('job_storage_failed', 'Cannot reserve operation.', array('status' => 503));
    $stored = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$table} WHERE option_name = %s", $name));
    if ($stored === $reservation) return array('key' => $name, 'reservation' => $reservation, 'request_hash' => $hash);
    $data = is_string($stored) ? json_decode($stored, true) : null;
    if (!is_array($data) || !isset($data['request_hash'], $data['status'])) return new WP_Error('job_storage_failed', 'Operation state unavailable; reconcile before retry.', array('status' => 503));
    if (!hash_equals($data['request_hash'], $hash)) return new WP_Error('idempotency_conflict', 'Key already belongs to a different payload.', array('status' => 409));
    if ($data['status'] !== 'completed') return new WP_Error('operation_in_progress', 'Operation pending or interrupted; reconcile it before retrying. Do not use a new key to retry an ambiguous operation.', array('status' => 409));
    $post = isset($data['post_id']) ? get_post((int)$data['post_id']) : null;
    if (!$post || $post->post_type !== 'post' || !current_user_can('edit_post', $post->ID)) return new WP_Error('completed_post_unavailable', 'Previously created post is unavailable.', array('status' => 409));
    return new WP_REST_Response(array('success' => true, 'deduplicated' => true, 'post_id' => $post->ID, 'link' => get_permalink($post->ID), 'status' => $post->post_status), 200);
}

function mc_bridge_dispatch(WP_REST_Request $request, $callback) {
    $auth = mc_bridge_verify_auth($request);
    if (is_wp_error($auth)) return $auth;
    $params = mc_bridge_validate_body($request);
    if (is_wp_error($params)) return $params;
    if (get_site_option('mc_bridge_storage_version') !== '1.6.0') return new WP_Error('storage_unavailable', 'Bridge storage migration must complete.', array('status' => 503));
    $previous_user = get_current_user_id();
    $GLOBALS['mc_bridge_operation_id'] = bin2hex(random_bytes(16));
    $GLOBALS['mc_bridge_owned_lock'] = null;
    try {
        if (!mc_bridge_elevate_admin()) return new WP_Error('service_user_required', 'Select an eligible service administrator in Bridge settings.', array('status' => 403));
        if (!mc_bridge_log_audit(basename($request->get_route()), '', 'started')) return new WP_Error('audit_unavailable', 'No mutation performed: audit storage unavailable.', array('status' => 503));
        // SEO and publishing serialize with maintenance too; native WP writers are independent.
        if (in_array(basename($request->get_route()), array('update-seo', 'create-blog-post'), true)) {
            $lock = mc_bridge_acquire_lock('content', basename($request->get_route()));
            if (!$lock['success']) return new WP_Error('operation_in_progress', $lock['error'], array('status' => 409));
        }
        $result = call_user_func($callback, $request);
        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            $data = is_array($data) ? $data : array('status' => 500);
            $data['operation_id'] = $GLOBALS['mc_bridge_operation_id'];
            $result->add_data($data);
        } elseif ($result instanceof WP_REST_Response) {
            $data = $result->get_data();
            $data['operation_id'] = $GLOBALS['mc_bridge_operation_id'];
            $result->set_data($data);
        }
        mc_bridge_log_audit(basename($request->get_route()), '', is_wp_error($result) ? 'failed' : 'completed');
        return $result;
    } catch (Throwable $error) {
        mc_bridge_log_audit(basename($request->get_route()), '', 'interrupted');
        return new WP_Error('operation_interrupted', 'Operation interrupted; it may have partially completed. Reconcile before retrying.', array('status' => 500, 'operation_id' => $GLOBALS['mc_bridge_operation_id']));
    } finally {
        if (!empty($GLOBALS['mc_bridge_owned_lock'])) mc_bridge_release_lock($GLOBALS['mc_bridge_owned_lock']);
        $GLOBALS['mc_bridge_owned_lock'] = null;
        wp_set_current_user($previous_user);
    }
}

function mc_bridge_get_posts_seo(WP_REST_Request $request) {
    $user = get_current_user_id();
    try {
        if (!mc_bridge_elevate_admin() || !current_user_can('edit_posts')) return new WP_Error('forbidden', 'Configured service user lacks read authorization.', array('status' => 403));
        return mc_bridge_get_posts_seo_impl($request);
    } finally { wp_set_current_user($user); }
}
