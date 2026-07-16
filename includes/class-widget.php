<?php
/**
 * ฝั่ง frontend — โหลด CSS/JS + วาง container ของ chat bubble ใน footer
 * ทุกหน้าตามค่า settings (เว้นหน้าที่ถูก exclude ไว้)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_Widget {

	/** @var RMU_AI_Chat_Widget|null */
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_action( 'wp_footer', array( $this, 'render_container' ) );
	}

	private function should_display() {
		$options = RMU_AI_Chat_Settings::get_options();

		if ( empty( $options['enabled'] ) ) {
			return false;
		}

		if ( is_admin() ) {
			return false;
		}

		if ( ! is_user_logged_in() && empty( $options['guest_enabled'] ) ) {
			return false;
		}

		if ( is_singular() && ! empty( $options['excluded_pages'] ) ) {
			if ( in_array( get_the_ID(), $options['excluded_pages'], true ) ) {
				return false;
			}
		}

		return true;
	}

	public function enqueue_assets() {
		if ( ! $this->should_display() ) {
			return;
		}

		$options = RMU_AI_Chat_Settings::get_options();

		wp_enqueue_style(
			'rmu-ai-chat-frontend',
			RMU_AI_CHAT_URL . 'assets/css/chat.css',
			array(),
			RMU_AI_CHAT_VERSION
		);

		wp_enqueue_script(
			'rmu-ai-chat-frontend',
			RMU_AI_CHAT_URL . 'assets/js/chat.js',
			array(),
			RMU_AI_CHAT_VERSION,
			true
		);

		wp_localize_script(
			'rmu-ai-chat-frontend',
			'rmuAiChatConfig',
			array(
				'restUrl'        => esc_url_raw( rest_url( 'rmu-ai-chat/v1/message' ) ),
				'nonce'          => wp_create_nonce( 'wp_rest' ),
				'isLoggedIn'     => is_user_logged_in(),
				'chatTitle'      => $options['chat_title'],
				'greeting'       => $options['greeting_message'],
				'inputMaxLength' => (int) $options['input_max_length'],
				'i18n'           => array(
					'placeholder'    => __( 'พิมพ์ข้อความ…', 'rmu-ai-chat' ),
					'send'           => __( 'ส่ง', 'rmu-ai-chat' ),
					'thinking'       => __( 'กำลังพิมพ์…', 'rmu-ai-chat' ),
					'genericError'   => __( 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'rmu-ai-chat' ),
					'newConversation' => __( 'เริ่มบทสนทนาใหม่', 'rmu-ai-chat' ),
					'close'          => __( 'ปิด', 'rmu-ai-chat' ),
					'open'           => __( 'เปิดแชท', 'rmu-ai-chat' ),
				),
			)
		);
	}

	public function render_container() {
		if ( ! $this->should_display() ) {
			return;
		}

		$options = RMU_AI_Chat_Settings::get_options();
		$side    = 'bottom-left' === $options['icon_position'] ? 'left' : 'right';
		?>
		<style>
			:root {
				--rmu-aic-color: <?php echo esc_html( $options['theme_color'] ); ?>;
				--rmu-aic-offset-x: <?php echo (int) $options['icon_offset_x']; ?>px;
				--rmu-aic-offset-y: <?php echo (int) $options['icon_offset_y']; ?>px;
			}
		</style>
		<div id="rmu-ai-chat-root" class="rmu-aic-<?php echo esc_attr( $side ); ?>" aria-live="polite"></div>
		<?php
	}
}
