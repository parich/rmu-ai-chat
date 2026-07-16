<?php
/**
 * ลบค่าตั้งค่าของปลั๊กอินตอนถอนการติดตั้ง (ไม่ทำงานตอนแค่ deactivate)
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'rmu_ai_chat_options' );
