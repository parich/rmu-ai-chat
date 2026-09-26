<?php
/**
 * หน้า Admin Settings ของปลั๊กอิน — เก็บทุกค่าไว้ใน option เดียว (RMU_AI_CHAT_OPTION)
 * ใช้ WordPress Settings API ปกติ (register_setting + settings sections/fields)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_Settings {

	const ICON_POSITIONS = array( 'bottom-right', 'bottom-left' );

	/** @var RMU_AI_Chat_Settings|null */
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'add_menu_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'wp_ajax_rmu_ai_chat_test_connection', array( $this, 'ajax_test_connection' ) );
	}

	/**
	 * ค่าตั้งต้นของปลั๊กอิน — เรียกใช้ทั้งตอน activate และเป็น fallback ตอนอ่าน option
	 */
	public static function default_options() {
		return array(
			'enabled'                => 1,
			'dify_api_url'           => '',
			'dify_api_key'           => '',
			'session_message_limit'  => 20,
			'session_window_minutes' => 30,
			'input_max_length'       => 500,
			'icon_position'          => 'bottom-right',
			'icon_offset_x'          => 20,
			'icon_offset_y'          => 20,
			'theme_color'            => '#0d6efd',
			'chat_title'             => 'ผู้ช่วย AI',
			'greeting_message'       => 'สวัสดีค่ะ มีอะไรให้ช่วยเหลือไหมคะ?',
			'guest_enabled'          => 1,
			'excluded_pages'         => array(),
			'privacy_notice_enabled' => 1,
			'privacy_notice_title'   => 'ประกาศความเป็นส่วนตัว',
			'privacy_notice_text'    => self::default_privacy_notice(),
			'privacy_consent_label'  => 'ข้าพเจ้าได้อ่านและยินยอมรับทราบประกาศความเป็นส่วนตัวข้างต้นแล้ว',
			'privacy_start_button'   => 'เริ่มการสนทนา',
			'teaser_enabled'         => 1,
			'teaser_delay'           => 3,
			// ไม่ใส่ emoji ในค่าตั้งต้น — ฐานข้อมูลเก่าที่เป็น utf8 (ไม่ใช่ utf8mb4) เก็บตัวอักษร 4 byte ไม่ได้
			// แล้ว $wpdb จะปฏิเสธการบันทึก option ทั้งก้อน กด "บันทึกการตั้งค่า" ช่องไหนก็ไม่ผ่าน
			'teaser_messages'        => "[welcome] สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?\n[searching] สงสัยเรื่องอีเมล VPN หรือการเข้าสู่ระบบของมหาวิทยาลัย ถามได้เลยค่ะ\n[listening] กดที่นี่เพื่อเริ่มแชทได้เลยค่ะ",
		);
	}

	/**
	 * ข้อความประกาศความเป็นส่วนตัวตั้งต้น — แก้ไขได้จากหน้า Settings โดยไม่ต้องแตะโค้ด
	 * ร่างตามข้อมูลจริงที่ระบบส่ง/เก็บ (ดู class-rest-api.php): ข้อความแชท, user id (login)
	 * หรือ guest id แบบสุ่ม (ไม่ login), IP ใช้แค่จำกัดอัตราการส่ง — ไม่ส่งชื่อ/อีเมลไปที่ Dify
	 */
	private static function default_privacy_notice() {
		return "แชทบอทผู้ช่วย AI นี้ให้บริการตอบคำถามเบื้องต้นเกี่ยวกับอีเมล, VPN และการยืนยันตัวตนของมหาวิทยาลัย โดยใช้ระบบประมวลผลภาษาที่มหาวิทยาลัยดูแลเอง (self-hosted) ไม่ส่งข้อมูลของท่านให้บุคคลภายนอก\n\nข้อมูลที่ระบบเก็บเมื่อท่านใช้งาน ได้แก่ ข้อความที่ท่านพิมพ์ในแชท, รหัสอ้างอิงการสนทนา (สร้างแบบสุ่มสำหรับผู้เยี่ยมชม หรือรหัสผู้ใช้งานกรณีเข้าสู่ระบบ) และหมายเลข IP ซึ่งใช้เพื่อจำกัดจำนวนข้อความในการป้องกันการใช้งานผิดปกติเท่านั้น\n\nข้อมูลเหล่านี้จะถูกใช้เพื่อตอบคำถามและปรับปรุงคุณภาพของระบบผู้ช่วย AI เท่านั้น\n\nกรุณาหลีกเลี่ยงการพิมพ์ข้อมูลส่วนบุคคลที่อ่อนไหว เช่น รหัสผ่าน, เลขบัตรประจำตัวประชาชน หรือข้อมูลทางการเงิน ผ่านช่องแชทนี้\n\nหากท่านมีข้อสงสัยเกี่ยวกับการคุ้มครองข้อมูลส่วนบุคคล สามารถติดต่อผู้ดูแลระบบของมหาวิทยาลัยได้";
	}

	/**
	 * อ่าน option พร้อม merge กับค่าตั้งต้น (กันกรณีอัปเดตปลั๊กอินแล้วมีฟิลด์ใหม่)
	 */
	public static function get_options() {
		$stored = get_option( RMU_AI_CHAT_OPTION, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		return array_merge( self::default_options(), $stored );
	}

	public function add_menu_page() {
		add_menu_page(
			__( 'RMU AI Chat', 'rmu-ai-chat' ),
			__( 'RMU AI Chat', 'rmu-ai-chat' ),
			'manage_options',
			'rmu-ai-chat',
			array( $this, 'render_settings_page' ),
			'dashicons-format-chat',
			80
		);
	}

	public function enqueue_admin_assets( $hook ) {
		if ( 'toplevel_page_rmu-ai-chat' !== $hook ) {
			return;
		}
		wp_enqueue_style( 'wp-color-picker' );
		wp_enqueue_script( 'wp-color-picker' );
		wp_enqueue_style(
			'rmu-ai-chat-admin',
			RMU_AI_CHAT_URL . 'assets/css/admin.css',
			array(),
			RMU_AI_CHAT_VERSION
		);
		wp_enqueue_script(
			'rmu-ai-chat-admin',
			RMU_AI_CHAT_URL . 'assets/js/admin.js',
			array( 'wp-color-picker', 'jquery' ),
			RMU_AI_CHAT_VERSION,
			true
		);
		wp_localize_script(
			'rmu-ai-chat-admin',
			'rmuAiChatAdmin',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'rmu_ai_chat_test_connection' ),
				'i18n'    => array(
					'testing' => __( 'กำลังทดสอบ…', 'rmu-ai-chat' ),
				),
			)
		);
	}

	/**
	 * ทดสอบการเชื่อมต่อ Dify ด้วยค่าที่บันทึกไว้ล่าสุด (กด "บันทึกการตั้งค่า" ก่อนถึงจะทดสอบค่าใหม่ได้)
	 * เรียก GET /parameters แทน /chat-messages เพื่อไม่ให้เสียโควตา/ค่าใช้จ่ายของ LLM แค่เช็คว่าเชื่อมต่อได้ไหม
	 */
	public function ajax_test_connection() {
		check_ajax_referer( 'rmu_ai_chat_test_connection', 'nonce' );

		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'ไม่มีสิทธิ์เข้าถึง', 'rmu-ai-chat' ) ), 403 );
		}

		$options = self::get_options();
		if ( empty( $options['dify_api_url'] ) || empty( $options['dify_api_key'] ) ) {
			wp_send_json_error( array( 'message' => __( 'กรุณากรอกและบันทึก Dify API URL/Key ก่อนทดสอบ', 'rmu-ai-chat' ) ) );
		}

		$response = wp_remote_get(
			untrailingslashit( $options['dify_api_url'] ) . '/parameters?user=rmu-ai-chat-test-connection',
			array(
				'timeout' => 15,
				'headers' => array( 'Authorization' => 'Bearer ' . $options['dify_api_key'] ),
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error(
				array(
					/* translators: 1: error code, 2: error message จาก WordPress HTTP API */
					'message' => sprintf(
						__( 'เชื่อมต่อไม่สำเร็จ: [%1$s] %2$s', 'rmu-ai-chat' ),
						$response->get_error_code(),
						$response->get_error_message()
					),
				)
			);
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 !== $status ) {
			wp_send_json_error(
				array(
					/* translators: 1: HTTP status code, 2: response body ที่ตัดให้สั้นลง */
					'message' => sprintf(
						__( 'Dify ตอบกลับ HTTP %1$d: %2$s', 'rmu-ai-chat' ),
						$status,
						mb_substr( wp_strip_all_tags( wp_remote_retrieve_body( $response ) ), 0, 200 )
					),
				)
			);
		}

		wp_send_json_success( array( 'message' => __( 'เชื่อมต่อ Dify สำเร็จ', 'rmu-ai-chat' ) ) );
	}

	public function register_settings() {
		register_setting(
			'rmu_ai_chat_group',
			RMU_AI_CHAT_OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_options' ),
				'default'           => self::default_options(),
			)
		);

		add_settings_section( 'rmu_aic_section_connection', __( 'การเชื่อมต่อ Dify', 'rmu-ai-chat' ), '__return_false', 'rmu-ai-chat' );
		add_settings_section( 'rmu_aic_section_limits', __( 'ขีดจำกัดการใช้งาน', 'rmu-ai-chat' ), '__return_false', 'rmu-ai-chat' );
		add_settings_section( 'rmu_aic_section_display', __( 'การแสดงผล', 'rmu-ai-chat' ), '__return_false', 'rmu-ai-chat' );
		add_settings_section( 'rmu_aic_section_mascot', __( 'Mascot และบอลลูนคำพูด', 'rmu-ai-chat' ), '__return_false', 'rmu-ai-chat' );
		add_settings_section( 'rmu_aic_section_privacy', __( 'ประกาศความเป็นส่วนตัวก่อนเริ่มแชท', 'rmu-ai-chat' ), '__return_false', 'rmu-ai-chat' );

		add_settings_field( 'enabled', __( 'เปิดใช้งานแชท', 'rmu-ai-chat' ), array( $this, 'field_enabled' ), 'rmu-ai-chat', 'rmu_aic_section_connection' );
		add_settings_field( 'dify_api_url', __( 'Dify API URL', 'rmu-ai-chat' ), array( $this, 'field_dify_api_url' ), 'rmu-ai-chat', 'rmu_aic_section_connection' );
		add_settings_field( 'dify_api_key', __( 'Dify API Key', 'rmu-ai-chat' ), array( $this, 'field_dify_api_key' ), 'rmu-ai-chat', 'rmu_aic_section_connection' );
		add_settings_field( 'guest_enabled', __( 'อนุญาตผู้เยี่ยมชมที่ไม่ได้ login', 'rmu-ai-chat' ), array( $this, 'field_guest_enabled' ), 'rmu-ai-chat', 'rmu_aic_section_connection' );

		add_settings_field( 'session_message_limit', __( 'จำนวนข้อความสูงสุดต่อ session', 'rmu-ai-chat' ), array( $this, 'field_session_message_limit' ), 'rmu-ai-chat', 'rmu_aic_section_limits' );
		add_settings_field( 'session_window_minutes', __( 'ช่วงเวลานับ session (นาที)', 'rmu-ai-chat' ), array( $this, 'field_session_window_minutes' ), 'rmu-ai-chat', 'rmu_aic_section_limits' );
		add_settings_field( 'input_max_length', __( 'ความยาวข้อความสูงสุด (ตัวอักษร)', 'rmu-ai-chat' ), array( $this, 'field_input_max_length' ), 'rmu-ai-chat', 'rmu_aic_section_limits' );

		add_settings_field( 'chat_title', __( 'ชื่อหัวข้อหน้าต่างแชท', 'rmu-ai-chat' ), array( $this, 'field_chat_title' ), 'rmu-ai-chat', 'rmu_aic_section_display' );
		add_settings_field( 'greeting_message', __( 'ข้อความทักทาย', 'rmu-ai-chat' ), array( $this, 'field_greeting_message' ), 'rmu-ai-chat', 'rmu_aic_section_display' );
		add_settings_field( 'theme_color', __( 'สีธีม', 'rmu-ai-chat' ), array( $this, 'field_theme_color' ), 'rmu-ai-chat', 'rmu_aic_section_display' );
		add_settings_field( 'icon_position', __( 'ตำแหน่งไอคอนแชท', 'rmu-ai-chat' ), array( $this, 'field_icon_position' ), 'rmu-ai-chat', 'rmu_aic_section_display' );
		add_settings_field( 'icon_offset', __( 'ระยะห่างจากขอบจอ (px)', 'rmu-ai-chat' ), array( $this, 'field_icon_offset' ), 'rmu-ai-chat', 'rmu_aic_section_display' );
		add_settings_field( 'excluded_pages', __( 'ไม่แสดงผลในหน้า (Page) เหล่านี้', 'rmu-ai-chat' ), array( $this, 'field_excluded_pages' ), 'rmu-ai-chat', 'rmu_aic_section_display' );

		add_settings_field( 'teaser_enabled', __( 'บอลลูนคำพูดชวนคุย', 'rmu-ai-chat' ), array( $this, 'field_teaser_enabled' ), 'rmu-ai-chat', 'rmu_aic_section_mascot' );
		add_settings_field( 'teaser_delay', __( 'เวลารอก่อนบอลลูนขึ้น', 'rmu-ai-chat' ), array( $this, 'field_teaser_delay' ), 'rmu-ai-chat', 'rmu_aic_section_mascot' );
		add_settings_field( 'teaser_messages', __( 'ข้อความในบอลลูน', 'rmu-ai-chat' ), array( $this, 'field_teaser_messages' ), 'rmu-ai-chat', 'rmu_aic_section_mascot' );

		add_settings_field( 'privacy_notice_enabled', __( 'บังคับยอมรับก่อนเริ่มแชท', 'rmu-ai-chat' ), array( $this, 'field_privacy_notice_enabled' ), 'rmu-ai-chat', 'rmu_aic_section_privacy' );
		add_settings_field( 'privacy_notice_title', __( 'หัวข้อประกาศ', 'rmu-ai-chat' ), array( $this, 'field_privacy_notice_title' ), 'rmu-ai-chat', 'rmu_aic_section_privacy' );
		add_settings_field( 'privacy_notice_text', __( 'เนื้อหาประกาศความเป็นส่วนตัว', 'rmu-ai-chat' ), array( $this, 'field_privacy_notice_text' ), 'rmu-ai-chat', 'rmu_aic_section_privacy' );
		add_settings_field( 'privacy_consent_label', __( 'ข้อความข้าง checkbox ยินยอม', 'rmu-ai-chat' ), array( $this, 'field_privacy_consent_label' ), 'rmu-ai-chat', 'rmu_aic_section_privacy' );
		add_settings_field( 'privacy_start_button', __( 'ข้อความปุ่มเริ่มสนทนา', 'rmu-ai-chat' ), array( $this, 'field_privacy_start_button' ), 'rmu-ai-chat', 'rmu_aic_section_privacy' );
	}

	/* ---------------------------------------------------------------------
	 * Sanitize
	 * ------------------------------------------------------------------ */

	public function sanitize_options( $input ) {
		$existing = self::get_options();
		$output   = array();

		$output['enabled']       = ! empty( $input['enabled'] ) ? 1 : 0;
		$output['guest_enabled'] = ! empty( $input['guest_enabled'] ) ? 1 : 0;

		$output['dify_api_url'] = isset( $input['dify_api_url'] ) ? esc_url_raw( trim( $input['dify_api_url'] ) ) : '';

		// ช่อง API key: เว้นว่างไว้ = คงค่าเดิม (กันเผลอส่งค่าว่างทับของจริงตอนกดบันทึกซ้ำ)
		$submitted_key          = isset( $input['dify_api_key'] ) ? trim( $input['dify_api_key'] ) : '';
		$output['dify_api_key'] = '' !== $submitted_key ? sanitize_text_field( $submitted_key ) : $existing['dify_api_key'];

		$output['session_message_limit']  = max( 0, absint( $input['session_message_limit'] ?? 0 ) );
		$output['session_window_minutes'] = max( 1, absint( $input['session_window_minutes'] ?? 30 ) );
		$output['input_max_length']       = min( 4000, max( 1, absint( $input['input_max_length'] ?? 500 ) ) );

		$output['chat_title']       = sanitize_text_field( $input['chat_title'] ?? '' );
		$output['greeting_message'] = sanitize_textarea_field( $input['greeting_message'] ?? '' );

		$color                   = isset( $input['theme_color'] ) ? sanitize_hex_color( $input['theme_color'] ) : '';
		$output['theme_color']   = $color ? $color : $existing['theme_color'];

		$position                 = isset( $input['icon_position'] ) ? sanitize_key( $input['icon_position'] ) : '';
		$output['icon_position']  = in_array( $position, self::ICON_POSITIONS, true ) ? $position : 'bottom-right';

		$output['icon_offset_x'] = min( 500, max( 0, absint( $input['icon_offset_x'] ?? 20 ) ) );
		$output['icon_offset_y'] = min( 500, max( 0, absint( $input['icon_offset_y'] ?? 20 ) ) );

		$excluded                 = isset( $input['excluded_pages'] ) && is_array( $input['excluded_pages'] ) ? $input['excluded_pages'] : array();
		$output['excluded_pages'] = array_values( array_unique( array_map( 'absint', $excluded ) ) );

		$output['privacy_notice_enabled'] = ! empty( $input['privacy_notice_enabled'] ) ? 1 : 0;
		$output['privacy_notice_title']   = sanitize_text_field( $input['privacy_notice_title'] ?? '' );
		$output['privacy_notice_text']    = sanitize_textarea_field( $input['privacy_notice_text'] ?? '' );
		$output['privacy_consent_label']  = sanitize_text_field( $input['privacy_consent_label'] ?? '' );
		$output['privacy_start_button']   = sanitize_text_field( $input['privacy_start_button'] ?? '' );

		$output['teaser_enabled']  = ! empty( $input['teaser_enabled'] ) ? 1 : 0;
		$output['teaser_delay']    = min( 60, max( 0, absint( $input['teaser_delay'] ?? 3 ) ) );
		$output['teaser_messages'] = sanitize_textarea_field( $input['teaser_messages'] ?? '' );

		return $output;
	}

	/* ---------------------------------------------------------------------
	 * Field renderers
	 * ------------------------------------------------------------------ */

	private function name( $key ) {
		return RMU_AI_CHAT_OPTION . '[' . $key . ']';
	}

	public function field_enabled() {
		$options = self::get_options();
		printf(
			'<label><input type="checkbox" name="%s" value="1" %s /> %s</label>',
			esc_attr( $this->name( 'enabled' ) ),
			checked( 1, $options['enabled'], false ),
			esc_html__( 'แสดงไอคอนแชทและเปิดใช้งาน endpoint', 'rmu-ai-chat' )
		);
	}

	public function field_guest_enabled() {
		$options = self::get_options();
		printf(
			'<label><input type="checkbox" name="%s" value="1" %s /> %s</label>',
			esc_attr( $this->name( 'guest_enabled' ) ),
			checked( 1, $options['guest_enabled'], false ),
			esc_html__( 'อนุญาตให้ผู้ที่ยังไม่ได้ login เข้าใช้แชทได้', 'rmu-ai-chat' )
		);
	}

	public function field_dify_api_url() {
		$options = self::get_options();
		printf(
			'<input type="url" class="regular-text" name="%s" value="%s" placeholder="https://dify.example.com/v1" /><p class="description">%s</p>',
			esc_attr( $this->name( 'dify_api_url' ) ),
			esc_attr( $options['dify_api_url'] ),
			esc_html__( 'URL ฐานของ Dify API (ไม่ต้องมี / ปิดท้าย)', 'rmu-ai-chat' )
		);
	}

	public function field_dify_api_key() {
		$options   = self::get_options();
		$has_key   = ! empty( $options['dify_api_key'] );
		$masked    = $has_key ? str_repeat( '•', 12 ) : '';
		printf(
			'<input type="password" class="regular-text" name="%s" value="" placeholder="%s" autocomplete="new-password" /><p class="description">%s</p>',
			esc_attr( $this->name( 'dify_api_key' ) ),
			esc_attr( $masked ? $masked . ' (เว้นว่างไว้เพื่อคงค่าเดิม)' : 'app-xxxxxxxxxxxxxxxx' ),
			esc_html__( 'API Key ของ Dify App (ขึ้นต้นด้วย app-) เก็บเฉพาะฝั่ง server เท่านั้น', 'rmu-ai-chat' )
		);
	}

	public function field_session_message_limit() {
		$options = self::get_options();
		printf(
			'<input type="number" min="0" step="1" name="%s" value="%s" class="small-text" /><p class="description">%s</p>',
			esc_attr( $this->name( 'session_message_limit' ) ),
			esc_attr( $options['session_message_limit'] ),
			esc_html__( 'จำนวนข้อความสูงสุดที่ส่งได้ในช่วงเวลาที่กำหนด (0 = ไม่จำกัด)', 'rmu-ai-chat' )
		);
	}

	public function field_session_window_minutes() {
		$options = self::get_options();
		printf(
			'<input type="number" min="1" step="1" name="%s" value="%s" class="small-text" /><p class="description">%s</p>',
			esc_attr( $this->name( 'session_window_minutes' ) ),
			esc_attr( $options['session_window_minutes'] ),
			esc_html__( 'เมื่อครบเวลานี้ตัวนับข้อความจะรีเซ็ตใหม่', 'rmu-ai-chat' )
		);
	}

	public function field_input_max_length() {
		$options = self::get_options();
		printf(
			'<input type="number" min="1" max="4000" step="1" name="%s" value="%s" class="small-text" />',
			esc_attr( $this->name( 'input_max_length' ) ),
			esc_attr( $options['input_max_length'] )
		);
	}

	public function field_chat_title() {
		$options = self::get_options();
		printf(
			'<input type="text" class="regular-text" name="%s" value="%s" />',
			esc_attr( $this->name( 'chat_title' ) ),
			esc_attr( $options['chat_title'] )
		);
	}

	public function field_greeting_message() {
		$options = self::get_options();
		printf(
			'<textarea class="large-text" rows="3" name="%s">%s</textarea>',
			esc_attr( $this->name( 'greeting_message' ) ),
			esc_textarea( $options['greeting_message'] )
		);
	}

	public function field_theme_color() {
		$options = self::get_options();
		printf(
			'<input type="text" class="rmu-aic-color-field" name="%s" value="%s" data-default-color="#0d6efd" />',
			esc_attr( $this->name( 'theme_color' ) ),
			esc_attr( $options['theme_color'] )
		);
	}

	public function field_icon_position() {
		$options = self::get_options();
		$labels  = array(
			'bottom-right' => __( 'มุมล่างขวา', 'rmu-ai-chat' ),
			'bottom-left'  => __( 'มุมล่างซ้าย', 'rmu-ai-chat' ),
		);
		echo '<select name="' . esc_attr( $this->name( 'icon_position' ) ) . '">';
		foreach ( $labels as $value => $label ) {
			printf(
				'<option value="%s" %s>%s</option>',
				esc_attr( $value ),
				selected( $options['icon_position'], $value, false ),
				esc_html( $label )
			);
		}
		echo '</select>';
	}

	public function field_icon_offset() {
		$options = self::get_options();
		printf(
			'<label>%s <input type="number" min="0" max="500" name="%s" value="%s" class="small-text" /></label> &nbsp; ',
			esc_html__( 'แนวนอน', 'rmu-ai-chat' ),
			esc_attr( $this->name( 'icon_offset_x' ) ),
			esc_attr( $options['icon_offset_x'] )
		);
		printf(
			'<label>%s <input type="number" min="0" max="500" name="%s" value="%s" class="small-text" /></label>',
			esc_html__( 'แนวตั้ง', 'rmu-ai-chat' ),
			esc_attr( $this->name( 'icon_offset_y' ) ),
			esc_attr( $options['icon_offset_y'] )
		);
	}

	public function field_excluded_pages() {
		$options = self::get_options();
		$pages   = get_pages( array( 'sort_column' => 'post_title', 'number' => 300 ) );

		if ( empty( $pages ) ) {
			echo '<p class="description">' . esc_html__( 'ยังไม่มีหน้าในเว็บไซต์', 'rmu-ai-chat' ) . '</p>';
			return;
		}

		echo '<select multiple size="8" style="min-width:320px" name="' . esc_attr( $this->name( 'excluded_pages' ) ) . '[]">';
		foreach ( $pages as $page ) {
			printf(
				'<option value="%d" %s>%s</option>',
				(int) $page->ID,
				selected( in_array( (int) $page->ID, $options['excluded_pages'], true ), true, false ),
				esc_html( $page->post_title )
			);
		}
		echo '</select><p class="description">' . esc_html__( 'กด Ctrl (หรือ Cmd บน Mac) ค้างไว้เพื่อเลือกหลายหน้า', 'rmu-ai-chat' ) . '</p>';
	}

	public function field_teaser_enabled() {
		$options = self::get_options();
		printf(
			'<label><input type="checkbox" name="%s" value="1" %s /> %s</label><p class="description">%s</p>',
			esc_attr( $this->name( 'teaser_enabled' ) ),
			checked( 1, $options['teaser_enabled'], false ),
			esc_html__( 'ให้ mascot ทักผู้ใช้ด้วยบอลลูนคำพูดเหนือไอคอนแชท', 'rmu-ai-chat' ),
			esc_html__( 'แสดงทีละข้อความจนครบแล้วหายไปเอง — ขึ้นครั้งเดียวต่อแท็บเบราว์เซอร์ ผู้ใช้กดปิดได้', 'rmu-ai-chat' )
		);
	}

	public function field_teaser_delay() {
		$options = self::get_options();
		printf(
			'<input type="number" min="0" max="60" step="1" name="%s" value="%s" class="small-text" /> %s<p class="description">%s</p>',
			esc_attr( $this->name( 'teaser_delay' ) ),
			esc_attr( $options['teaser_delay'] ),
			esc_html__( 'วินาที', 'rmu-ai-chat' ),
			esc_html__( 'นับจากตอนโหลดหน้าเว็บ (0 = ขึ้นทันที, สูงสุด 60) — ถ้าผู้ใช้เปิดหน้าต่างแชทก่อนครบเวลา บอลลูนจะไม่ขึ้น', 'rmu-ai-chat' )
		);
	}

	public function field_teaser_messages() {
		$options = self::get_options();
		printf(
			'<textarea class="large-text" rows="4" name="%s">%s</textarea><p class="description">%s<br />%s</p>',
			esc_attr( $this->name( 'teaser_messages' ) ),
			esc_textarea( $options['teaser_messages'] ),
			esc_html__( 'หนึ่งข้อความต่อบรรทัด ใส่ชื่อท่าของ mascot ในวงเล็บเหลี่ยมนำหน้าเพื่อเลือกท่าได้ (ไม่ระบุ = [welcome], ถ้าสะกดชื่อท่าผิดจะแสดงวงเล็บนั้นเป็นข้อความตามที่พิมพ์)', 'rmu-ai-chat' ),
			esc_html__( 'ท่าที่มี: [welcome] ทักทาย, [searching] ถือแว่นขยาย, [listening] ฟัง, [thinking] คิด, [idle] ยืนปกติ', 'rmu-ai-chat' )
		);
	}

	public function field_privacy_notice_enabled() {
		$options = self::get_options();
		printf(
			'<label><input type="checkbox" name="%s" value="1" %s /> %s</label><p class="description">%s</p>',
			esc_attr( $this->name( 'privacy_notice_enabled' ) ),
			checked( 1, $options['privacy_notice_enabled'], false ),
			esc_html__( 'แสดงประกาศให้ผู้ใช้ติ๊กยินยอมก่อนเริ่มแชทครั้งแรก', 'rmu-ai-chat' ),
			esc_html__( 'ระบบจำการยินยอมไว้ที่เบราว์เซอร์ของผู้ใช้ (localStorage) ครั้งเดียวพอ ไม่ถามซ้ำทุกครั้งที่เปิดแชท', 'rmu-ai-chat' )
		);
	}

	public function field_privacy_notice_title() {
		$options = self::get_options();
		printf(
			'<input type="text" class="regular-text" name="%s" value="%s" />',
			esc_attr( $this->name( 'privacy_notice_title' ) ),
			esc_attr( $options['privacy_notice_title'] )
		);
	}

	public function field_privacy_notice_text() {
		$options = self::get_options();
		printf(
			'<textarea class="large-text" rows="12" name="%s">%s</textarea><p class="description">%s</p>',
			esc_attr( $this->name( 'privacy_notice_text' ) ),
			esc_textarea( $options['privacy_notice_text'] ),
			esc_html__( 'ข้อความล้วน (ไม่รองรับ HTML) เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่', 'rmu-ai-chat' )
		);
	}

	public function field_privacy_consent_label() {
		$options = self::get_options();
		printf(
			'<input type="text" class="large-text" name="%s" value="%s" />',
			esc_attr( $this->name( 'privacy_consent_label' ) ),
			esc_attr( $options['privacy_consent_label'] )
		);
	}

	public function field_privacy_start_button() {
		$options = self::get_options();
		printf(
			'<input type="text" class="regular-text" name="%s" value="%s" />',
			esc_attr( $this->name( 'privacy_start_button' ) ),
			esc_attr( $options['privacy_start_button'] )
		);
	}

	/* ---------------------------------------------------------------------
	 * Page
	 * ------------------------------------------------------------------ */

	public function render_settings_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'ตั้งค่า RMU AI Chat', 'rmu-ai-chat' ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( 'rmu_ai_chat_group' );
				do_settings_sections( 'rmu-ai-chat' );
				submit_button( __( 'บันทึกการตั้งค่า', 'rmu-ai-chat' ) );
				?>
			</form>
			<hr />
			<h2><?php esc_html_e( 'ทดสอบการเชื่อมต่อ Dify', 'rmu-ai-chat' ); ?></h2>
			<p class="description"><?php esc_html_e( 'ทดสอบด้วยค่า Dify API URL/Key ที่บันทึกไว้ล่าสุด — ถ้าเพิ่งแก้ไข กรุณากด "บันทึกการตั้งค่า" ก่อน', 'rmu-ai-chat' ); ?></p>
			<button type="button" class="button" id="rmu-aic-test-connection"><?php esc_html_e( 'ทดสอบการเชื่อมต่อ', 'rmu-ai-chat' ); ?></button>
			<span id="rmu-aic-test-result" style="margin-left:10px;"></span>
		</div>
		<?php
	}
}
