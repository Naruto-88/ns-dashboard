<?php
/**
 * Plugin Name: Mission Control SEO Helper
 * Description: Securely syncs AI SEO Metadata edits from Mission Control Dashboard.
 * Version: 1.0.0
 * Author: NetStripes
 */

if (!defined('ABSPATH')) exit; // Exit if accessed directly

add_action('rest_api_init', function () {
    register_rest_route('mission-control/v1', '/update-metadata', array(
        'methods' => 'POST',
        'callback' => 'mc_handle_seo_metadata_update',
        'permission_callback' => '__return_true',
    ));
});

function mc_handle_seo_metadata_update(WP_REST_Request $request) {
    $params = $request->get_json_params();
    $secret = isset($params['secret']) ? sanitize_text_field($params['secret']) : '';
    $url_path = isset($params['url']) ? sanitize_text_field($params['url']) : '';
    $title = isset($params['title']) ? sanitize_text_field($params['title']) : '';
    $description = isset($params['description']) ? sanitize_textarea_field($params['description']) : '';

    // Define the client-specific secure token
    $defined_secret = "YOUR_CLIENT_SEO_WEBHOOK_SECRET"; 
    if (empty($secret) || $secret !== $defined_secret) {
        return new WP_Error('unauthorized', 'Invalid token', array('status' => 401));
    }

    $post_id = url_to_postid(home_url($url_path));
    if (!$post_id) {
        return new WP_Error('not_found', 'Page not found', array('status' => 404));
    }

    if (defined('WPSEO_VERSION')) {
        update_post_meta($post_id, '_yoast_wpseo_title', $title);
        update_post_meta($post_id, '_yoast_wpseo_metadesc', $description);
    } elseif (class_exists('RankMath')) {
        update_post_meta($post_id, 'rank_math_title', $title);
        update_post_meta($post_id, 'rank_math_description', $description);
    } else {
        update_post_meta($post_id, 'meta_title', $title);
        update_post_meta($post_id, 'meta_description', $description);
    }

    return new WP_REST_Response(array('success' => true), 200);
}
