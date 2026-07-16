<?php
/**
 * เรียก Dify Chat API (blocking mode) ด้วย wp_remote_post — ทำงานฝั่ง server เท่านั้น
 * ไฟล์นี้ไม่รู้จัก WP_REST_Request / option ใดๆ โดยตรง รับค่ามาทาง parameter ทั้งหมด
 * เพื่อให้ทดสอบ/เรียกใช้แยกจากส่วน REST ได้
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_Dify_Client {

	const CHAT_TIMEOUT_SEC = 60;
	const READ_TIMEOUT_SEC = 15;

	/** @var string */
	private $base_url;

	/** @var string */
	private $api_key;

	public function __construct( $base_url, $api_key ) {
		$this->base_url = untrailingslashit( $base_url );
		$this->api_key  = $api_key;
	}

	/**
	 * ส่งข้อความไป Dify /chat-messages แบบ blocking
	 *
	 * @param string $query           ข้อความจากผู้ใช้
	 * @param string $user            identity ที่ส่งให้ Dify เช่น "wp-user-12" หรือ "wp-guest-{uuid}"
	 * @param string $conversation_id ต่อบทสนทนาเดิม ("" = เริ่มใหม่)
	 * @return array{ok:bool,answer?:string,conversation_id?:string,message_id?:string,error?:string,conversation_not_found?:bool}
	 */
	public function send_chat_message( $query, $user, $conversation_id = '' ) {
		if ( empty( $this->base_url ) || empty( $this->api_key ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'ยังไม่ได้ตั้งค่า Dify API — กรุณาตั้งค่าที่หน้า Admin ก่อนใช้งาน', 'rmu-ai-chat' ),
			);
		}

		$response = wp_remote_post(
			$this->base_url . '/chat-messages',
			array(
				'timeout' => self::CHAT_TIMEOUT_SEC,
				'headers' => array(
					'Authorization' => 'Bearer ' . $this->api_key,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode(
					array(
						'inputs'          => new stdClass(),
						'query'           => $query,
						'response_mode'   => 'blocking',
						'conversation_id' => $conversation_id ? $conversation_id : '',
						'user'            => $user,
					)
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			// สาเหตุที่พบบ่อย: WP_HTTP_BLOCK_EXTERNAL เปิดอยู่แต่ไม่ได้เพิ่ม host ของ Dify ใน
			// WP_ACCESSIBLE_HOSTS, firewall ของ server/เครือข่ายบล็อก outbound, หรือ SSL cert ของ Dify มีปัญหา
			error_log(
				sprintf(
					'[rmu-ai-chat] wp_remote_post ล้มเหลว (%s): %s',
					$response->get_error_code(),
					$response->get_error_message()
				)
			);
			return array(
				'ok'    => false,
				'error' => __( 'เชื่อมต่อระบบผู้ช่วย AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง', 'rmu-ai-chat' ),
			);
		}

		$status = wp_remote_retrieve_response_code( $response );
		$raw    = wp_remote_retrieve_body( $response );

		if ( 200 !== (int) $status ) {
			if ( 404 === (int) $status ) {
				return array(
					'ok'                     => false,
					'conversation_not_found' => true,
					'error'                  => __( 'บทสนทนาเดิมหมดอายุ กรุณาเริ่มบทสนทนาใหม่', 'rmu-ai-chat' ),
				);
			}
			error_log( sprintf( '[rmu-ai-chat] Dify HTTP %d: %s', $status, mb_substr( $raw, 0, 300 ) ) );
			return array(
				'ok'    => false,
				'error' => __( 'ระบบผู้ช่วย AI ขัดข้อง กรุณาลองใหม่อีกครั้ง', 'rmu-ai-chat' ),
			);
		}

		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) || ! isset( $data['answer'], $data['conversation_id'] ) ) {
			return array(
				'ok'    => false,
				'error' => __( 'รูปแบบข้อมูลจากระบบผู้ช่วย AI ไม่ถูกต้อง', 'rmu-ai-chat' ),
			);
		}

		return array(
			'ok'              => true,
			'answer'          => (string) $data['answer'],
			'conversation_id' => (string) $data['conversation_id'],
			'message_id'      => isset( $data['message_id'] ) ? (string) $data['message_id'] : '',
		);
	}
}
