<?php
/**
 * ตรวจสอบเวอร์ชันใหม่จาก GitHub Releases แล้วเสียบเข้า WordPress plugin-update screen ปกติ
 * รูปแบบเดียวกับที่ใช้ใน rmu-workflow-wp — ไม่พึ่ง WordPress.org repo, ใช้ GitHub release ล่าสุดแทน
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class RMU_AI_Chat_GitHub_Updater {

	private $slug            = 'rmu-ai-chat';
	private $plugin_file;
	private $plugin_basename;
	private $github_owner    = 'parich';
	private $github_repo     = 'rmu-ai-chat';
	private $current_version;
	private $github_response;
	private $cache_key       = 'rmu_ai_chat_github_update';
	private $cache_expiry    = 21600; // 6 ชั่วโมง

	public function __construct( $plugin_file ) {
		$this->plugin_file     = $plugin_file;
		$this->plugin_basename = plugin_basename( $plugin_file );

		$plugin_data           = get_file_data( $plugin_file, array( 'Version' => 'Version' ) );
		$this->current_version = $plugin_data['Version'];

		add_filter( 'pre_set_site_transient_update_plugins', array( $this, 'check_update' ) );
		add_filter( 'plugins_api', array( $this, 'plugin_info' ), 20, 3 );
	}

	private function get_github_release() {
		if ( null !== $this->github_response ) {
			return $this->github_response;
		}

		$cached = get_transient( $this->cache_key );
		if ( false !== $cached ) {
			$this->github_response = $cached;
			return $cached;
		}

		$url      = "https://api.github.com/repos/{$this->github_owner}/{$this->github_repo}/releases/latest";
		$response = wp_remote_get(
			$url,
			array(
				'headers' => array(
					'Accept'     => 'application/vnd.github.v3+json',
					'User-Agent' => 'WordPress/' . get_bloginfo( 'version' ),
				),
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			$this->github_response = false;
			return false;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ) );
		if ( empty( $body ) || ! isset( $body->tag_name ) ) {
			$this->github_response = false;
			return false;
		}

		$this->github_response = $body;
		set_transient( $this->cache_key, $body, $this->cache_expiry );

		return $body;
	}

	private function find_download_url( $release ) {
		$download_url = $release->zipball_url;

		if ( ! empty( $release->assets ) ) {
			foreach ( $release->assets as $asset ) {
				if ( '.zip' === substr( $asset->name, -4 ) ) {
					$download_url = $asset->browser_download_url;
					break;
				}
			}
		}

		return $download_url;
	}

	public function check_update( $transient ) {
		if ( empty( $transient->checked ) ) {
			return $transient;
		}

		$release = $this->get_github_release();
		if ( ! $release ) {
			return $transient;
		}

		$remote_version = ltrim( $release->tag_name, 'v' );

		if ( version_compare( $remote_version, $this->current_version, '>' ) ) {
			$transient->response[ $this->plugin_basename ] = (object) array(
				'slug'        => $this->slug,
				'plugin'      => $this->plugin_basename,
				'new_version' => $remote_version,
				'url'         => $release->html_url,
				'package'     => $this->find_download_url( $release ),
			);
		}

		return $transient;
	}

	public function plugin_info( $result, $action, $args ) {
		if ( 'plugin_information' !== $action || $this->slug !== $args->slug ) {
			return $result;
		}

		$release = $this->get_github_release();
		if ( ! $release ) {
			return $result;
		}

		return (object) array(
			'name'          => 'RMU AI Chat',
			'slug'          => $this->slug,
			'version'       => ltrim( $release->tag_name, 'v' ),
			'author'        => '<a href="https://github.com/' . esc_attr( $this->github_owner ) . '">' . esc_html( $this->github_owner ) . '</a>',
			'homepage'      => "https://github.com/{$this->github_owner}/{$this->github_repo}",
			'requires'      => '5.8',
			'requires_php'  => '7.4',
			'sections'      => array(
				'description' => 'แชทบอทผู้ช่วย AI (เชื่อมต่อ Dify) พร้อมไอคอนแชทลอยหน้าเว็บ',
				'changelog'   => nl2br( esc_html( $release->body ?? '' ) ),
			),
			'download_link' => $this->find_download_url( $release ),
		);
	}
}
