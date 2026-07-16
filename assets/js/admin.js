jQuery( function ( $ ) {
	'use strict';

	$( '.rmu-aic-color-field' ).wpColorPicker();

	var config = window.rmuAiChatAdmin;
	var $button = $( '#rmu-aic-test-connection' );
	var $result = $( '#rmu-aic-test-result' );

	if ( ! config || ! $button.length ) {
		return;
	}

	$button.on( 'click', function () {
		$button.prop( 'disabled', true );
		$result.css( 'color', '' ).text( config.i18n.testing );

		$.post( config.ajaxUrl, {
			action: 'rmu_ai_chat_test_connection',
			nonce: config.nonce,
		} )
			.done( function ( response ) {
				var ok = response && response.success;
				var message = response && response.data ? response.data.message : '';
				$result.css( 'color', ok ? '#008a20' : '#d63638' ).text( message );
			} )
			.fail( function () {
				$result.css( 'color', '#d63638' ).text( 'ไม่สามารถเรียก admin-ajax.php ได้' );
			} )
			.always( function () {
				$button.prop( 'disabled', false );
			} );
	} );
} );
