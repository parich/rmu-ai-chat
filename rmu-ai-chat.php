<?php
/**
 * Plugin Name:       RMU AI Chat
 * Plugin URI:        https://github.com/parich/rmu-ai-chat
 * Description:       แชทบอทผู้ช่วย AI (เชื่อมต่อ Dify) พร้อมไอคอนแชทลอยหน้าเว็บ ตั้งค่าได้ผ่านหน้า Admin
 * Version:           1.1.2
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            RMU
 * Author URI:        https://github.com/parich
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       rmu-ai-chat
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // ป้องกันการเรียกไฟล์ตรงจากภายนอก
}

define( 'RMU_AI_CHAT_VERSION', '1.1.2' );
define( 'RMU_AI_CHAT_FILE', __FILE__ );
define( 'RMU_AI_CHAT_DIR', plugin_dir_path( __FILE__ ) );
define( 'RMU_AI_CHAT_URL', plugin_dir_url( __FILE__ ) );
define( 'RMU_AI_CHAT_OPTION', 'rmu_ai_chat_options' );

require_once RMU_AI_CHAT_DIR . 'includes/class-dify-client.php';
require_once RMU_AI_CHAT_DIR . 'includes/class-rate-limit.php';
require_once RMU_AI_CHAT_DIR . 'includes/class-settings.php';
require_once RMU_AI_CHAT_DIR . 'includes/class-rest-api.php';
require_once RMU_AI_CHAT_DIR . 'includes/class-widget.php';
require_once RMU_AI_CHAT_DIR . 'includes/class-github-updater.php';

/**
 * จุดเริ่มต้นปลั๊กอิน — ผูก hook ของแต่ละคลาสย่อย
 */
final class RMU_AI_Chat {

	/** @var RMU_AI_Chat|null */
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		RMU_AI_Chat_Settings::instance();
		RMU_AI_Chat_REST_API::instance();
		RMU_AI_Chat_Widget::instance();
	}
}

/**
 * ค่าตั้งต้นเมื่อเปิดใช้งานปลั๊กอินครั้งแรก — ไม่ทับค่าที่มีอยู่แล้วตอนอัปเดตเวอร์ชัน
 */
function rmu_ai_chat_activate() {
	if ( false === get_option( RMU_AI_CHAT_OPTION ) ) {
		add_option( RMU_AI_CHAT_OPTION, RMU_AI_Chat_Settings::default_options() );
	}
}
register_activation_hook( __FILE__, 'rmu_ai_chat_activate' );

add_action( 'plugins_loaded', array( 'RMU_AI_Chat', 'instance' ) );

new RMU_AI_Chat_GitHub_Updater( __FILE__ );
