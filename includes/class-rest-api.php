<?php
/**
 * REST endpoint ที่ frontend เรียกเข้ามา — เป็นตัวกลางเดียวที่คุยกับ Dify จริง
 * ทำให้ API Key ไม่หลุดไปฝั่ง browser และบังคับ limit ต่างๆ ได้จากฝั่ง server เท่านั้น
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_REST_API {

	const NAMESPACE_ = 'rmu-ai-chat/v1';

	// guest ต่อ IP อนุญาตมากกว่าต่อ guest เดี่ยวๆ ไม่งั้นผู้ใช้หลายคนหลัง NAT/wifi เดียวกัน (เช่นในมหาวิทยาลัย) จะโดนบล็อกไปด้วย
	const IP_LIMIT_MULTIPLIER = 5;

	/** @var RMU_AI_Chat_REST_API|null */
	private static $instance = null;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	public function register_routes() {
		register_rest_route(
			self::NAMESPACE_,
			'/message',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'handle_message' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'message'         => array(
						'type'     => 'string',
						'required' => true,
					),
					'conversation_id' => array(
						'type'     => 'string',
						'required' => false,
					),
					'guest_id'        => array(
						'type'     => 'string',
						'required' => false,
					),
				),
			)
		);
	}

	public function handle_message( WP_REST_Request $request ) {
		$options = RMU_AI_Chat_Settings::get_options();

		if ( empty( $options['enabled'] ) ) {
			return new WP_Error( 'rmu_aic_disabled', __( 'ระบบแชทปิดใช้งานอยู่', 'rmu-ai-chat' ), array( 'status' => 403 ) );
		}

		$message = trim( sanitize_textarea_field( (string) $request->get_param( 'message' ) ) );
		if ( '' === $message ) {
			return new WP_Error( 'rmu_aic_empty_message', __( 'กรุณาพิมพ์ข้อความ', 'rmu-ai-chat' ), array( 'status' => 400 ) );
		}

		$max_length = (int) $options['input_max_length'];
		if ( mb_strlen( $message ) > $max_length ) {
			return new WP_Error(
				'rmu_aic_message_too_long',
				sprintf(
					/* translators: %d: จำนวนตัวอักษรสูงสุด */
					__( 'ข้อความยาวเกิน %d ตัวอักษร กรุณาแบ่งคำถามเป็นข้อความสั้นลง', 'rmu-ai-chat' ),
					$max_length
				),
				array( 'status' => 400 )
			);
		}

		$conversation_id = sanitize_text_field( (string) $request->get_param( 'conversation_id' ) );
		if ( mb_strlen( $conversation_id ) > 64 ) {
			$conversation_id = '';
		}

		$window_seconds = (int) $options['session_window_minutes'] * MINUTE_IN_SECONDS;
		$limit          = (int) $options['session_message_limit'];
		$guest_id       = '';

		if ( is_user_logged_in() ) {
			$dify_user = 'wp-user-' . get_current_user_id();
			if ( ! RMU_AI_Chat_Rate_Limit::check( 'user-' . get_current_user_id(), $limit, $window_seconds ) ) {
				return $this->rate_limited_error( $options );
			}
		} else {
			if ( empty( $options['guest_enabled'] ) ) {
				return new WP_Error( 'rmu_aic_guest_disabled', __( 'กรุณาเข้าสู่ระบบก่อนใช้งานแชท', 'rmu-ai-chat' ), array( 'status' => 401 ) );
			}

			$guest_id = sanitize_text_field( (string) $request->get_param( 'guest_id' ) );
			if ( ! preg_match( '/^[a-zA-Z0-9-]{8,64}$/', $guest_id ) ) {
				$guest_id = wp_generate_uuid4();
			}

			$dify_user = 'wp-guest-' . $guest_id;
			$ip        = RMU_AI_Chat_Rate_Limit::get_client_ip();

			$guest_ok = RMU_AI_Chat_Rate_Limit::check( 'guest-' . $guest_id, $limit, $window_seconds );
			$ip_ok    = RMU_AI_Chat_Rate_Limit::check( 'ip-' . $ip, $limit * self::IP_LIMIT_MULTIPLIER, $window_seconds );

			if ( ! $guest_ok || ! $ip_ok ) {
				return $this->rate_limited_error( $options );
			}
		}

		$client = new RMU_AI_Chat_Dify_Client( $options['dify_api_url'], $options['dify_api_key'] );
		$result = $client->send_chat_message( $message, $dify_user, $conversation_id );

		if ( empty( $result['ok'] ) ) {
			$response = array(
				'error'             => $result['error'],
				'reset_conversation' => ! empty( $result['conversation_not_found'] ),
			);
			if ( $guest_id ) {
				$response['guest_id'] = $guest_id;
			}
			return new WP_REST_Response( $response, 502 );
		}

		$response = array(
			'answer'          => $result['answer'],
			'conversation_id' => $result['conversation_id'],
			'message_id'      => $result['message_id'],
		);
		if ( $guest_id ) {
			$response['guest_id'] = $guest_id;
		}

		return new WP_REST_Response( $response, 200 );
	}

	private function rate_limited_error( $options ) {
		return new WP_Error(
			'rmu_aic_rate_limited',
			sprintf(
				/* translators: %d: จำนวนนาทีของหน้าต่างเวลา */
				__( 'คุณส่งข้อความบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ภายใน %d นาที', 'rmu-ai-chat' ),
				(int) $options['session_window_minutes']
			),
			array( 'status' => 429 )
		);
	}
}
