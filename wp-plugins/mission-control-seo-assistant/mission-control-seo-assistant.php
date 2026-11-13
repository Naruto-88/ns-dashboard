<?php
/**
 * Plugin Name: Mission Control SEO Assistant
 * Description: Securely syncs AI SEO Metadata edits from Mission Control Dashboard.
 * Version: 1.0.2
 * Author: NetStripes
 */

if (!defined('ABSPATH')) exit; // Exit if accessed directly

// Register Settings Menu in WordPress Admin Panel
add_action('admin_menu', function () {
    add_options_page(
        'Mission Control SEO',
        'Mission Control SEO',
        'manage_options',
        'mission-control-seo',
        'mc_seo_settings_page'
    );
});

// Render the Settings Page HTML
function mc_seo_settings_page() {
    if (!current_user_can('manage_options')) return;

    // Save settings if submitted
    if (isset($_POST['mc_seo_save_settings'])) {
        check_admin_referer('mc_seo_settings_verify');
        $secret = sanitize_text_field($_POST['mc_seo_webhook_secret']);
        update_option('mc_seo_webhook_secret', $secret);
        echo '<div class="updated"><p>Settings saved successfully!</p></div>';
    }

    $current_secret = get_option('mc_seo_webhook_secret', '');
    ?>
    <div class="wrap">
        <h1>Mission Control SEO Settings</h1>
        <form method="post" action="">
            <?php wp_nonce_field('mc_seo_settings_verify'); ?>
            <table class="form-table">
                <tr valign="top">
                    <th scope="row">SEO Webhook Secret Key</th>
                    <td>
                        <input type="text" name="mc_seo_webhook_secret" value="<?php echo esc_attr($current_secret); ?>" class="regular-text" placeholder="Enter matching secret key here" />
                        <p class="description">Copy and paste this exact key into the Client Management panel inside the Mission Control Dashboard.</p>
                    </td>
                </tr>
            </table>
            <p class="submit">
                <input type="submit" name="mc_seo_save_settings" class="button button-primary" value="Save Settings" />
            </p>
        </form>
    </div>
    <?php
}

// REST API Webhook Endpoint
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

    // Verify secret token against saved option in WordPress settings database
    $defined_secret = get_option('mc_seo_webhook_secret', '');
    if (empty($defined_secret) || empty($secret) || $secret !== $defined_secret) {
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
