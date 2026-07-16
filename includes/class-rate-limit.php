<?php
/**
 * จำกัดจำนวนข้อความต่อช่วงเวลา (session) ด้วย WP transient — ไม่พึ่ง service ภายนอก
 * ใช้ fixed window: เก็บ {count, expires} เอง แทนการพึ่ง TTL ของ set_transient() ตรงๆ
 * เพราะ set_transient() รีเซ็ต TTL ใหม่ทุกครั้งที่เรียก ถ้าไม่คุม expires เองหน้าต่างเวลาจะเลื่อนหนีไปเรื่อยๆ
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_Rate_Limit {

	/**
	 * ตรวจและนับข้อความในหน้าต่างเวลาปัจจุบัน
	 *
	 * @param string $key            คีย์ระบุตัวตน (unique ต่อ user/guest/ip)
	 * @param int    $limit          จำนวนข้อความสูงสุด ในหน้าต่างเวลา ($limit <= 0 = ไม่จำกัด)
	 * @param int    $window_seconds ความยาวหน้าต่างเวลา (วินาที)
	 * @return bool true = ยังส่งได้, false = เกินโควตาแล้ว
	 */
	public static function check( $key, $limit, $window_seconds ) {
		if ( $limit <= 0 ) {
			return true;
		}

		$transient_key = 'rmu_aic_rl_' . md5( $key );
		$now           = time();
		$data          = get_transient( $transient_key );

		if ( ! is_array( $data ) || empty( $data['expires'] ) || $data['expires'] <= $now ) {
			$data = array(
				'count'   => 0,
				'expires' => $now + max( 1, $window_seconds ),
			);
		}

		if ( $data['count'] >= $limit ) {
			return false;
		}

		++$data['count'];
		$ttl = max( 1, $data['expires'] - $now );
		set_transient( $transient_key, $data, $ttl );

		return true;
	}

	/**
	 * IP ของผู้ใช้ — ใช้ตัวสุดท้ายของ X-Forwarded-For (ต่อท้ายโดย proxy/CDN เอง แก้ปลอมยากกว่าตัวแรก)
	 */
	public static function get_client_ip() {
		if ( ! empty( $_SERVER['HTTP_X_FORWARDED_FOR'] ) ) {
			$forwarded = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_FOR'] ) );
			$parts     = array_map( 'trim', explode( ',', $forwarded ) );
			$ip        = end( $parts );
			if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
				return $ip;
			}
		}

		return isset( $_SERVER['REMOTE_ADDR'] )
			? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) )
			: 'unknown';
	}
}
