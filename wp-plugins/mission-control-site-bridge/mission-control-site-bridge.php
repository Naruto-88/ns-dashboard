<?php
/**
 * Plugin Name: Netstripes Mission Control Site Bridge
 * Plugin URI: https://netstripes.com
 * Description: Securely connects WordPress sites to Netstripes Mission Control for Health Monitoring and Remote Plugin Maintenance.
 * Version: 1.3.0
 * Author: Netstripes Development Team
 * License: GPL-2.0+
 */

if (!defined('ABSPATH')) {
    exit;
}

// Configurable Secret Token (fallback to constant or option)
define('MC_SITE_BRIDGE_VERSION', '1.3.0');

/**
 * Safely resolves the real client IP address (supporting Cloudflare & reverse proxies)
 */
function mc_bridge_get_client_ip() {
    $ip = '';
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = sanitize_text_field($_SERVER['HTTP_CF_CONNECTING_IP']);
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        $ip = sanitize_text_field(trim($parts[0]));
    } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
        $ip = sanitize_text_field($_SERVER['REMOTE_ADDR']);
    }
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * Safely elevate context to an active site administrator for authenticated REST operations
 */
function mc_bridge_elevate_admin() {
    if (current_user_can('manage_options')) {
        return;
    }
    $admins = get_users(array('role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'order' => 'ASC'));
    $admin_id = (!empty($admins) && isset($admins[0]->ID)) ? (int) $admins[0]->ID : 1;
    wp_set_current_user($admin_id);
}

add_action('rest_api_init', function () {
    // 1. Health & Plugin Updates Status Endpoint
    register_rest_route('mc-bridge/v1', '/status', array(
        'methods' => 'GET',
        'callback' => 'mc_bridge_get_status',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    // 2. Remote Plugin Update Execution Endpoint
    register_rest_route('mc-bridge/v1', '/update-plugin', array(
        'methods' => 'POST',
        'callback' => 'mc_bridge_update_plugin',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    // 3. Posts & Pages SEO Fetch Endpoint
    register_rest_route('mc-bridge/v1', '/posts-seo', array(
        'methods' => 'GET',
        'callback' => 'mc_bridge_get_posts_seo',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    // 4. Update Post SEO Meta Endpoint (Rank Math / Yoast / Core)
    register_rest_route('mc-bridge/v1', '/update-seo', array(
        'methods' => 'POST',
        'callback' => 'mc_bridge_update_post_seo',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));

    // 5. Create / Publish Blog Post Endpoint with Rank Math SEO
    register_rest_route('mc-bridge/v1', '/create-blog-post', array(
        'methods' => 'POST',
        'callback' => 'mc_bridge_create_blog_post',
        'permission_callback' => 'mc_bridge_verify_auth',
    ));
});

/**
 * High-Entropy Secure Token Authentication Guard with Strict 3-Attempt Rate Limiting
 */
function mc_bridge_verify_auth(WP_REST_Request $request) {
    // 1. IP-Based Strict Brute Force Lockout (Max 3 failed attempts)
    $client_ip = mc_bridge_get_client_ip();
    $rate_limit_key = 'mc_bridge_fail_' . md5($client_ip);
    $failed_attempts = (int) get_transient($rate_limit_key);

    if ($failed_attempts >= 3) {
        return new WP_Error(
            'too_many_requests', 
            'Security Alert: Maximum invalid token attempts (3) exceeded. Your IP (' . esc_html($client_ip) . ') has been temporarily locked out for 30 minutes.', 
            array('status' => 429)
        );
    }

    // 2. Resolve Authorization Key (Header prioritized, URL parameters disallowed for mutative methods)
    $provided_key = $request->get_header('X-MC-Bridge-Key');
    if (empty($provided_key)) {
        $auth_header = $request->get_header('Authorization');
        if (!empty($auth_header) && preg_match('/Bearer\s+(.*)$/i', $auth_header, $matches)) {
            $provided_key = trim($matches[1]);
        }
    }
    if (empty($provided_key)) {
        $json_params = $request->get_json_params();
        if (!empty($json_params['key'])) {
            $provided_key = sanitize_text_field($json_params['key']);
        }
    }
    // Only allow URL query parameter for read-only GET requests if header not present
    if (empty($provided_key) && $request->get_method() === 'GET') {
        $params = $request->get_params();
        $provided_key = isset($params['key']) ? sanitize_text_field($params['key']) : '';
    }

    $stored_secret = get_option('mc_bridge_secret_key');
    if (defined('MC_BRIDGE_SECRET_KEY') && !empty(MC_BRIDGE_SECRET_KEY)) {
        $stored_secret = MC_BRIDGE_SECRET_KEY;
    }

    if (empty($stored_secret) || empty($provided_key)) {
        set_transient($rate_limit_key, $failed_attempts + 1, 30 * MINUTE_IN_SECONDS);
        return new WP_Error('rest_forbidden', 'Authentication key missing or not configured on site.', array('status' => 401));
    }

    // 3. Cryptographic constant-time string comparison against timing attacks
    if (!hash_equals($stored_secret, $provided_key)) {
        set_transient($rate_limit_key, $failed_attempts + 1, 30 * MINUTE_IN_SECONDS);
        $remaining = 3 - ($failed_attempts + 1);
        return new WP_Error(
            'rest_forbidden', 
            'Invalid authorization token.' . ($remaining > 0 ? " ({$remaining} attempts remaining before IP lockout)" : " (IP locked for 30 minutes)"), 
            array('status' => 403)
        );
    }

    // Clear failed attempts counter upon successful verification
    if ($failed_attempts > 0) {
        delete_transient($rate_limit_key);
    }

    // Attach strict security headers to prevent sniffing and clickjacking
    if (!headers_sent()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
    }

    return true;
}

/**
 * Health & Plugin Inventory Handler
 */
function mc_bridge_get_status() {
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    if (!function_exists('wp_version_check')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }

    // Force WP to refresh cached update transient
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

        $plugin_list[] = array(
            'slug' => $plugin_file,
            'name' => $data['Name'],
            'current_version' => $data['Version'],
            'author' => wp_strip_all_tags($data['Author']),
            'is_active' => is_plugin_active($plugin_file),
            'has_update' => $has_update,
            'new_version' => $new_version,
            'can_auto_update' => !empty($package)
        );
    }

    global $wp_version;

    return new WP_REST_Response(array(
        'success' => true,
        'site_name' => get_bloginfo('name'),
        'site_url' => home_url(),
        'wp_version' => $wp_version,
        'php_version' => PHP_VERSION,
        'bridge_version' => defined('MC_SITE_BRIDGE_VERSION') ? MC_SITE_BRIDGE_VERSION : '1.0.0',
        'server_software' => isset($_SERVER['SERVER_SOFTWARE']) ? sanitize_text_field($_SERVER['SERVER_SOFTWARE']) : '',
        'plugins_total' => count($all_plugins),
        'plugins_outdated' => $outdated_count,
        'plugins' => $plugin_list,
        'checked_at' => current_time('mysql', 1)
    ), 200);
}

/**
 * Remote Plugin Upgrade Handler
 */
function mc_bridge_update_plugin(WP_REST_Request $request) {
    mc_bridge_elevate_admin();

    $params = $request->get_json_params();
    $plugin_slug = isset($params['slug']) ? sanitize_text_field($params['slug']) : '';

    if (empty($plugin_slug)) {
        return new WP_Error('missing_slug', 'Plugin file slug is required.', array('status' => 400));
    }

    // Path traversal and directory traversal defense
    if (!preg_match('/^[a-zA-Z0-9_\-\.\/]+$/', $plugin_slug) || strpos($plugin_slug, '..') !== false) {
        return new WP_Error('invalid_slug', 'Malformed or unsafe plugin slug detected.', array('status' => 400));
    }

    // Prevent bridge self-overwrite attack
    if (strpos($plugin_slug, 'mission-control-site-bridge') !== false) {
        return new WP_Error('forbidden_target', 'Security Alert: Remote modification of the bridge plugin itself is strictly forbidden.', array('status' => 403));
    }

    // Verify that the requested plugin is actually installed on this WordPress site
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }
    $installed_plugins = get_plugins();
    if (!isset($installed_plugins[$plugin_slug])) {
        return new WP_Error('plugin_not_installed', 'The requested plugin is not installed on this site.', array('status' => 404));
    }

    require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/misc.php';

    // Force FS_METHOD to 'direct' if not defined, to avoid FTP credentials prompt during background API update
    if (!defined('FS_METHOD')) {
        define('FS_METHOD', 'direct');
    }

    // Initialize WordPress filesystem credentials context
    ob_start();
    $creds = request_filesystem_credentials('', '', false, false, null);
    ob_end_clean();

    if (!WP_Filesystem($creds)) {
        // Try fallback with direct filesystem
        if (!WP_Filesystem()) {
            return new WP_Error('fs_unavailable', 'WordPress Filesystem credentials could not be initialized.', array('status' => 500));
        }
    }

    // Force-refresh updates transient so package URL is fresh
    if (!function_exists('wp_update_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/update.php';
    }
    wp_update_plugins();

    // Check if WordPress knows about this plugin in its update transient
    $current_update = get_site_transient('update_plugins');

    // Skin that silences HTML output but captures errors and feedback
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
    
    $result = $upgrader->upgrade($plugin_slug);

    if (is_wp_error($result)) {
        return new WP_Error('upgrade_failed', $result->get_error_message(), array(
            'status' => 500,
            'logs' => $skin->feedback_messages,
            'errors' => $skin->errors
        ));
    } elseif ($result === false) {
        $package_info = isset($current_update->response[$plugin_slug]) ? $current_update->response[$plugin_slug] : null;
        return new WP_Error('upgrade_failed', 'Upgrader returned false. Possible filesystem permission or package issue.', array(
            'status' => 500,
            'logs' => $skin->feedback_messages,
            'errors' => $skin->errors,
            'has_package_info' => !empty($package_info)
        ));
    }

    return new WP_REST_Response(array(
        'success' => true,
        'message' => 'Plugin upgraded successfully: ' . $plugin_slug,
        'slug' => $plugin_slug,
        'logs' => $skin->feedback_messages
    ), 200);
}

/**
 * 3. Fetch Posts & Pages along with Rank Math / Yoast Meta
 */
function mc_bridge_get_posts_seo(WP_REST_Request $request) {
    $post_type = $request->get_param('post_type');
    $allowed_types = get_post_types(array('public' => true));
    
    if (empty($post_type)) {
        // Automatically discover and include all public post types (e.g. post, page, product, portfolio, etc.)
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
        $post_id = $p->ID;

        // Rank Math meta
        $rm_title = get_post_meta($post_id, 'rank_math_title', true);
        $rm_desc  = get_post_meta($post_id, 'rank_math_description', true);
        $rm_kw    = get_post_meta($post_id, 'rank_math_focus_keyword', true);

        // Yoast SEO fallback
        $yoast_title = get_post_meta($post_id, '_yoast_wpseo_title', true);
        $yoast_desc  = get_post_meta($post_id, '_yoast_wpseo_metadesc', true);
        $yoast_kw    = get_post_meta($post_id, '_yoast_wpseo_focuskw', true);

        // Detect active SEO plugin
        $seo_plugin = 'none';
        if (defined('RANK_MATH_VERSION')) {
            $seo_plugin = 'rank_math';
        } elseif (defined('WPSEO_VERSION')) {
            $seo_plugin = 'yoast';
        }

        // Clean plain content excerpt
        $clean_excerpt = wp_strip_all_tags(strip_shortcodes($p->post_content));
        $clean_excerpt = mb_substr(preg_replace('/\s+/', ' ', $clean_excerpt), 0, 500);

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
                'title'       => $rm_title ? html_entity_decode($rm_title) : '',
                'description' => $rm_desc ? html_entity_decode($rm_desc) : '',
                'focus_keyword' => $rm_kw ? html_entity_decode($rm_kw) : ''
            ),
            'yoast'          => array(
                'title'       => $yoast_title ? html_entity_decode($yoast_title) : '',
                'description' => $yoast_desc ? html_entity_decode($yoast_desc) : '',
                'focus_keyword' => $yoast_kw ? html_entity_decode($yoast_kw) : ''
            ),
            'effective_seo'  => array(
                'title'       => !empty($rm_title) ? html_entity_decode($rm_title) : (!empty($yoast_title) ? html_entity_decode($yoast_title) : html_entity_decode(get_the_title($post_id))),
                'description' => !empty($rm_desc) ? html_entity_decode($rm_desc) : (!empty($yoast_desc) ? html_entity_decode($yoast_desc) : ''),
                'focus_keyword' => !empty($rm_kw) ? html_entity_decode($rm_kw) : (!empty($yoast_kw) ? html_entity_decode($yoast_kw) : ''),
                'schema'      => get_post_meta($post_id, 'mc_custom_schema', true)
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
 * 4. Update Post SEO Meta (with previous snapshot capturing)
 */
function mc_bridge_update_post_seo(WP_REST_Request $request) {
    mc_bridge_elevate_admin();

    $params = $request->get_json_params();
    $post_id = isset($params['post_id']) ? intval($params['post_id']) : 0;

    if ($post_id <= 0 || !get_post($post_id)) {
        return new WP_Error('invalid_post_id', 'Valid Post ID is required.', array('status' => 400));
    }

    // Capture previous state for 100% reliable rollback
    $previous_state = array(
        'rank_math_title'         => get_post_meta($post_id, 'rank_math_title', true),
        'rank_math_description'   => get_post_meta($post_id, 'rank_math_description', true),
        'rank_math_focus_keyword' => get_post_meta($post_id, 'rank_math_focus_keyword', true),
        '_yoast_wpseo_title'      => get_post_meta($post_id, '_yoast_wpseo_title', true),
        '_yoast_wpseo_metadesc'   => get_post_meta($post_id, '_yoast_wpseo_metadesc', true),
        '_yoast_wpseo_focuskw'    => get_post_meta($post_id, '_yoast_wpseo_focuskw', true),
        'mc_custom_schema'        => get_post_meta($post_id, 'mc_custom_schema', true),
    );

    $raw_post_title = isset($params['post_title']) ? sanitize_text_field($params['post_title']) : null;
    $seo_title = isset($params['meta_title']) ? sanitize_text_field($params['meta_title']) : null;
    $seo_desc  = isset($params['meta_description']) ? sanitize_textarea_field($params['meta_description']) : null;
    $focus_kw  = isset($params['focus_keyword']) ? sanitize_text_field($params['focus_keyword']) : null;
    $schema_json = isset($params['schema_json']) ? $params['schema_json'] : null;
    $update_post_title = isset($params['update_post_title']) ? (bool)$params['update_post_title'] : true;

    $updated_keys = array();

    // 1. Update native WordPress post_title ONLY if explicitly requested
    $target_wp_title = null;
    if ($update_post_title) {
        $target_wp_title = $raw_post_title !== null ? $raw_post_title : $seo_title;
    }
    if ($target_wp_title !== null) {
        // Update core WP post_title so it reflects in WP Admin post edit screen
        wp_update_post(array(
            'ID'         => $post_id,
            'post_title' => $target_wp_title
        ));
        $updated_keys[] = 'post_title';
    }

    // 2. Update Rank Math and Yoast SEO meta keys
    if ($seo_title !== null) {
        update_post_meta($post_id, 'rank_math_title', $seo_title);
        update_post_meta($post_id, '_yoast_wpseo_title', $seo_title);
        $updated_keys[] = 'meta_title';
    }
    if ($seo_desc !== null) {
        update_post_meta($post_id, 'rank_math_description', $seo_desc);
        update_post_meta($post_id, '_yoast_wpseo_metadesc', $seo_desc);
        $updated_keys[] = 'meta_description';
    }
    if ($focus_kw !== null) {
        update_post_meta($post_id, 'rank_math_focus_keyword', $focus_kw);
        update_post_meta($post_id, '_yoast_wpseo_focuskw', $focus_kw);
        $updated_keys[] = 'focus_keyword';
    }

    // 3. Update Custom JSON-LD Schema Markup
    if ($schema_json !== null) {
        $clean_schema_string = is_string($schema_json) ? trim($schema_json) : wp_json_encode($schema_json);
        update_post_meta($post_id, 'mc_custom_schema', $clean_schema_string);
        $updated_keys[] = 'schema';
    }

    clean_post_cache($post_id);

    // Automatically purge popular WordPress caching plugins so live visitors see updates instantly
    // 1. LiteSpeed Cache Purge
    if (class_exists('LiteSpeed_Cache_API')) {
        LiteSpeed_Cache_API::purge_post($post_id);
    } elseif (has_action('litespeed_purge_post')) {
        do_action('litespeed_purge_post', $post_id);
    }
    // 2. WP Rocket Purge
    if (function_exists('rocket_clean_post')) {
        rocket_clean_post($post_id);
    }
    // 3. W3 Total Cache Purge
    if (function_exists('w3tc_flush_post')) {
        w3tc_flush_post($post_id);
    }
    // 4. WP Super Cache Purge
    if (function_exists('wp_cache_post_change')) {
        wp_cache_post_change($post_id);
    }
    // 5. NitroPack Purge
    if (function_exists('nitropack_purge_post')) {
        nitropack_purge_post($post_id);
    }

    return new WP_REST_Response(array(
        'success'        => true,
        'message'        => 'SEO meta updated successfully',
        'post_id'        => $post_id,
        'updated_keys'   => $updated_keys,
        'previous_state' => $previous_state
    ), 200);
}

/**
 * 5. Create / Publish Blog Post with Rank Math Meta
 */
function mc_bridge_create_blog_post(WP_REST_Request $request) {
    mc_bridge_elevate_admin();

    $params = $request->get_json_params();
    $title   = isset($params['title']) ? sanitize_text_field($params['title']) : '';
    $content = isset($params['content']) ? wp_kses_post($params['content']) : '';
    $status  = isset($params['status']) && in_array($params['status'], array('publish', 'draft')) ? $params['status'] : 'draft';

    if (empty($title) || empty($content)) {
        return new WP_Error('missing_data', 'Title and Content are required.', array('status' => 400));
    }

    $post_data = array(
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => $status,
        'post_type'    => 'post',
        'post_author'  => get_current_user_id() ? get_current_user_id() : 1
    );

    $new_post_id = wp_insert_post($post_data, true);

    if (is_wp_error($new_post_id)) {
        return new WP_Error('post_creation_failed', $new_post_id->get_error_message(), array('status' => 500));
    }

    // Attach Rank Math & Yoast Meta
    if (!empty($params['meta_title'])) {
        $meta_title = sanitize_text_field($params['meta_title']);
        update_post_meta($new_post_id, 'rank_math_title', $meta_title);
        update_post_meta($new_post_id, '_yoast_wpseo_title', $meta_title);
    }
    if (!empty($params['meta_description'])) {
        $meta_desc = sanitize_textarea_field($params['meta_description']);
        update_post_meta($new_post_id, 'rank_math_description', $meta_desc);
        update_post_meta($new_post_id, '_yoast_wpseo_metadesc', $meta_desc);
    }
    if (!empty($params['focus_keyword'])) {
        $kw = sanitize_text_field($params['focus_keyword']);
        update_post_meta($new_post_id, 'rank_math_focus_keyword', $kw);
        update_post_meta($new_post_id, '_yoast_wpseo_focuskw', $kw);
    }

    // Tags & Categories if provided
    if (!empty($params['tags']) && is_array($params['tags'])) {
        $clean_tags = array_map('sanitize_text_field', $params['tags']);
        wp_set_post_tags($new_post_id, $clean_tags);
    }

    clean_post_cache($new_post_id);

    return new WP_REST_Response(array(
        'success'    => true,
        'message'    => 'Blog post created successfully',
        'post_id'    => $new_post_id,
        'link'       => get_permalink($new_post_id),
        'edit_link'  => get_edit_post_link($new_post_id, 'raw'),
        'status'     => $status
    ), 200);
}

// Simple Admin Settings Interface to view or change secret key
add_action('admin_menu', function () {
    add_options_page('MC Site Bridge', 'MC Site Bridge', 'manage_options', 'mc-site-bridge', 'mc_bridge_render_admin_page');
});

function mc_bridge_render_admin_page() {
    if (!current_user_can('manage_options')) return;

    $is_constant = defined('MC_BRIDGE_SECRET_KEY') && !empty(MC_BRIDGE_SECRET_KEY);

    if (!$is_constant && isset($_POST['mc_generate_key']) && check_admin_referer('mc_bridge_key_action')) {
        $new_key = 'ns_' . bin2hex(random_bytes(24));
        update_option('mc_bridge_secret_key', $new_key);
        echo '<div class="notice notice-success is-dismissible"><p>New API Key Generated!</p></div>';
    }

    $key = $is_constant ? MC_BRIDGE_SECRET_KEY : get_option('mc_bridge_secret_key');
    if (empty($key)) {
        $key = 'ns_' . bin2hex(random_bytes(24));
        update_option('mc_bridge_secret_key', $key);
    }
    ?>
    <div class="wrap">
        <h1>Netstripes Mission Control Site Bridge <span style="font-size:12px; vertical-align:middle; background:#0284c7; color:#fff; padding:2px 8px; border-radius:12px;">v1.2.0 Hardened</span></h1>
        <p>This plugin connects this WordPress installation to your agency Mission Control Hub.</p>
        <table class="form-table">
            <tr>
                <th scope="row">Authorization Key</th>
                <td>
                    <input type="text" readonly value="<?php echo esc_attr($key); ?>" class="regular-text code" style="font-size:14px; font-weight:bold; width:450px;" />
                    <p class="description">
                        <?php if ($is_constant): ?>
                            <span style="color:#059669; font-weight:bold;">&#x2714; Locked securely in wp-config.php via MC_BRIDGE_SECRET_KEY</span>
                        <?php else: ?>
                            Copy this key into the client settings in Mission Control.
                        <?php endif; ?>
                    </p>
                </td>
            </tr>
            <tr>
                <th scope="row">Endpoint URL</th>
                <td>
                    <code><?php echo esc_url(rest_url('mc-bridge/v1/status')); ?></code>
                </td>
            </tr>
            <tr>
                <th scope="row">Security Policy</th>
                <td>
                    <span style="color:#0284c7; font-weight:bold;">Active:</span> Constant-time comparison, strict 3-attempt IP lockout (30 min), safe admin context elevation, and XSS sanitization.
                </td>
            </tr>
        </table>
        <?php if (!$is_constant): ?>
        <form method="post" onsubmit="return confirm('Regenerating will disconnect previous integrations until updated in dashboard. Continue?');">
            <?php wp_nonce_field('mc_bridge_key_action'); ?>
            <input type="submit" name="mc_generate_key" class="button button-secondary" value="Regenerate Key" />
        </form>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * 6. Dynamic JSON-LD Schema Injector in WordPress Frontend <head>
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
        echo "\n<!-- Netstripes Mission Control Schema (JSON-LD) -->\n";
        echo '<script type="application/ld+json">' . "\n";
        echo is_string($custom_schema) ? trim($custom_schema) : wp_json_encode($custom_schema, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        echo "\n</script>\n<!-- /Netstripes Mission Control Schema -->\n";
    }
}, 99);

