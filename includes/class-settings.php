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
		);
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
		</div>
		<?php
	}
}
