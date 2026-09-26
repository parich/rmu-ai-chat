<?php
/**
 * ฝั่ง frontend — โหลด CSS/JS + วาง container ของ chat bubble ใน footer
 * ทุกหน้าตามค่า settings (เว้นหน้าที่ถูก exclude ไว้)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_Widget {

	/** ท่าของ mascot => ชื่อไฟล์ใน assets/img/ (ไม่รวมนามสกุล) */
	const MASCOT_FILES = array(
		'idle'      => '01_idle',
		'welcome'   => '02_welcome',
		'listening' => '03_listening',
		'thinking'  => '04_thinking',
		'searching' => '05_searching',
	);

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

		$options      = RMU_AI_Chat_Settings::get_options();
		$mascot_poses = $this->get_mascot_poses();

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
				'restUrl'         => esc_url_raw( rest_url( 'rmu-ai-chat/v1/message' ) ),
				'restFeedbackUrl' => esc_url_raw( rest_url( 'rmu-ai-chat/v1/feedback' ) ),
				'mascotPoses'     => array_map( 'esc_url_raw', $mascot_poses ),
				'teaser'          => ! empty( $options['teaser_enabled'] ) ? self::parse_teaser_messages( $options['teaser_messages'] ) : array(),
				'teaserDelay'     => (int) $options['teaser_delay'] * 1000,
				'nonce'           => wp_create_nonce( 'wp_rest' ),
				'isLoggedIn'      => is_user_logged_in(),
				'chatTitle'       => $options['chat_title'],
				'greeting'        => $options['greeting_message'],
				'inputMaxLength'  => (int) $options['input_max_length'],
				'privacyEnabled'  => ! empty( $options['privacy_notice_enabled'] ),
				'privacyTitle'    => $options['privacy_notice_title'],
				// เนื้อหาเป็นข้อความล้วนใน DB — esc_html กัน HTML แปลกปลอมก่อน แล้ว wpautop ค่อยขึ้นย่อหน้า/บรรทัดใหม่ตอนแสดงผล
				'privacyText'     => wpautop( esc_html( $options['privacy_notice_text'] ) ),
				'i18n'            => array(
					'placeholder'    => __( 'พิมพ์ข้อความ…', 'rmu-ai-chat' ),
					'send'           => __( 'ส่ง', 'rmu-ai-chat' ),
					'thinking'       => __( 'กำลังพิมพ์…', 'rmu-ai-chat' ),
					'genericError'   => __( 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง', 'rmu-ai-chat' ),
					'newConversation' => __( 'เริ่มบทสนทนาใหม่', 'rmu-ai-chat' ),
					'close'          => __( 'ปิด', 'rmu-ai-chat' ),
					'open'           => __( 'เปิดแชท', 'rmu-ai-chat' ),
					'copy'           => __( 'คัดลอกคำตอบ', 'rmu-ai-chat' ),
					'copied'         => __( 'คัดลอกแล้ว', 'rmu-ai-chat' ),
					'copyFail'       => __( 'คัดลอกไม่สำเร็จ', 'rmu-ai-chat' ),
					'like'           => __( 'คำตอบมีประโยชน์', 'rmu-ai-chat' ),
					'dislike'        => __( 'คำตอบไม่ถูกต้อง/ไม่มีประโยชน์', 'rmu-ai-chat' ),
					'dislikePrompt'  => __( 'อยากบอกเพิ่มเติมไหมว่าคำตอบมีปัญหาอย่างไร (เว้นว่างได้)', 'rmu-ai-chat' ),
					'consentLabel'   => $options['privacy_consent_label'],
					'startChat'      => $options['privacy_start_button'],
					'answerReady'    => __( 'ได้คำตอบแล้วค่ะ กดเพื่ออ่านได้เลย', 'rmu-ai-chat' ),
					'dismiss'        => __( 'ปิดข้อความ', 'rmu-ai-chat' ),
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

	/**
	 * รูป mascot 5 ท่า (idle/welcome/listening/thinking/searching) — คืน array เฉพาะท่าที่มีไฟล์จริงเท่านั้น
	 * ท่าไหนไม่มีไฟล์จะเติมด้วย idle (หรือท่าแรกที่เจอ) แทน กัน JS พังถ้า asset ไม่ครบชุด
	 * ไม่มีไฟล์เลยสักท่า = คืน array ว่าง แล้ว JS จะ fallback ไปไอคอนกรอบแชท SVG เดิม
	 *
	 * ใช้ .webp ที่ครอปแล้ว (สร้างจาก assets/img/src/ ด้วย tools/build-mascot.py) ก่อน ไม่มีค่อยใช้ .png
	 * ที่วางไว้ตรงๆ — ต่อท้าย ?v=เวลาแก้ไฟล์ ให้เบราว์เซอร์โหลดรูปใหม่ทันทีที่สร้างไฟล์ใหม่ทับชื่อเดิม
	 */
	private function get_mascot_poses() {
		$poses = array();
		foreach ( self::MASCOT_FILES as $pose => $basename ) {
			foreach ( array( '.webp', '.png' ) as $ext ) {
				$path = RMU_AI_CHAT_DIR . 'assets/img/' . $basename . $ext;
				if ( file_exists( $path ) ) {
					$poses[ $pose ] = RMU_AI_CHAT_URL . 'assets/img/' . $basename . $ext . '?v=' . filemtime( $path );
					break;
				}
			}
		}

		if ( empty( $poses ) ) {
			return array();
		}

		$fallback = isset( $poses['idle'] ) ? $poses['idle'] : reset( $poses );
		foreach ( array_keys( self::MASCOT_FILES ) as $pose ) {
			if ( empty( $poses[ $pose ] ) ) {
				$poses[ $pose ] = $fallback;
			}
		}

		return $poses;
	}

	/**
	 * แปลงข้อความบอลลูนคำพูดจากหน้า Settings (หนึ่งข้อความต่อบรรทัด) เป็น [ { pose, text }, ... ]
	 * นำหน้าบรรทัดด้วย [ชื่อท่า] เพื่อเลือกท่าของ mascot ได้ เช่น "[searching] ถามเรื่อง VPN ได้นะคะ" (ไม่ระบุ = ท่า welcome)
	 * ตัดวงเล็บออกเฉพาะชื่อท่าที่มีจริงเท่านั้น — "[NEW] ระบบใหม่" หรือชื่อท่าที่สะกดผิดจะแสดงตามที่พิมพ์
	 * ไม่ถูกตัดทิ้งเงียบๆ ผู้ดูแลจะได้เห็นว่าพิมพ์ผิดตรงไหน
	 */
	public static function parse_teaser_messages( $raw ) {
		$messages = array();
		foreach ( preg_split( '/\R/u', (string) $raw ) as $line ) {
			$line = trim( $line );
			$pose = 'welcome';
			if ( preg_match( '/^\[([a-z]+)\]\s*(.*)$/iu', $line, $m ) && isset( self::MASCOT_FILES[ strtolower( $m[1] ) ] ) ) {
				$pose = strtolower( $m[1] );
				$line = trim( $m[2] );
			}
			if ( '' !== $line ) {
				$messages[] = array(
					'pose' => $pose,
					'text' => $line,
				);
			}
		}
		return $messages;
	}
}
