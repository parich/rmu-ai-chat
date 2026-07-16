( function () {
	'use strict';

	var config = window.rmuAiChatConfig;
	if ( ! config ) {
		return;
	}

	var STORAGE_CONVERSATION = 'rmu_ai_chat_conversation_id';
	var STORAGE_GUEST = 'rmu_ai_chat_guest_id';

	var root = document.getElementById( 'rmu-ai-chat-root' );
	if ( ! root ) {
		return;
	}

	var conversationId = safeGet( STORAGE_CONVERSATION ) || '';
	var greeted = false;
	var sending = false;

	function safeGet( key ) {
		try {
			return window.localStorage.getItem( key );
		} catch ( e ) {
			return null;
		}
	}

	function safeSet( key, value ) {
		try {
			window.localStorage.setItem( key, value );
		} catch ( e ) {
			/* localStorage อาจถูกปิดใน private mode — ไม่เป็นไร แค่ไม่จำ conversation ข้ามหน้า */
		}
	}

	function getGuestId() {
		if ( config.isLoggedIn ) {
			return '';
		}
		var id = safeGet( STORAGE_GUEST );
		if ( ! id ) {
			id = generateUuid();
			safeSet( STORAGE_GUEST, id );
		}
		return id;
	}

	function generateUuid() {
		if ( window.crypto && window.crypto.randomUUID ) {
			return window.crypto.randomUUID();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g, function ( c ) {
			var r = ( Math.random() * 16 ) | 0;
			var v = c === 'x' ? r : ( r & 0x3 ) | 0x8;
			return v.toString( 16 );
		} );
	}

	// --- DOM ---

	var toggleBtn = document.createElement( 'button' );
	toggleBtn.type = 'button';
	toggleBtn.className = 'rmu-aic-toggle';
	toggleBtn.setAttribute( 'aria-label', config.i18n.open );
	toggleBtn.innerHTML =
		'<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
		'<path d="M4 4h16v12H7l-3 3V4z" fill="currentColor"/></svg>';

	var panel = document.createElement( 'div' );
	panel.className = 'rmu-aic-panel';

	var header = document.createElement( 'div' );
	header.className = 'rmu-aic-header';

	var title = document.createElement( 'h3' );
	title.textContent = config.chatTitle || '';

	var closeBtn = document.createElement( 'button' );
	closeBtn.type = 'button';
	closeBtn.className = 'rmu-aic-close';
	closeBtn.setAttribute( 'aria-label', config.i18n.close );
	closeBtn.innerHTML = '&times;';

	header.appendChild( title );
	header.appendChild( closeBtn );

	var messages = document.createElement( 'div' );
	messages.className = 'rmu-aic-messages';

	var counter = document.createElement( 'div' );
	counter.className = 'rmu-aic-counter';

	var inputRow = document.createElement( 'div' );
	inputRow.className = 'rmu-aic-input-row';

	var textarea = document.createElement( 'textarea' );
	textarea.rows = 1;
	textarea.placeholder = config.i18n.placeholder;
	textarea.maxLength = config.inputMaxLength;

	var sendBtn = document.createElement( 'button' );
	sendBtn.type = 'button';
	sendBtn.className = 'rmu-aic-send';
	sendBtn.textContent = config.i18n.send;

	inputRow.appendChild( textarea );
	inputRow.appendChild( sendBtn );

	panel.appendChild( header );
	panel.appendChild( messages );
	panel.appendChild( counter );
	panel.appendChild( inputRow );

	root.appendChild( panel );
	root.appendChild( toggleBtn );

	updateCounter();

	// --- Events ---

	toggleBtn.addEventListener( 'click', function () {
		var isOpen = root.classList.toggle( 'is-open' );
		if ( isOpen ) {
			if ( ! greeted && config.greeting ) {
				appendMessage( 'bot', config.greeting );
				greeted = true;
			}
			textarea.focus();
		}
	} );

	closeBtn.addEventListener( 'click', function () {
		root.classList.remove( 'is-open' );
	} );

	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' === e.key && root.classList.contains( 'is-open' ) ) {
			root.classList.remove( 'is-open' );
		}
	} );

	sendBtn.addEventListener( 'click', handleSend );
	textarea.addEventListener( 'keydown', function ( e ) {
		if ( 'Enter' === e.key && ! e.shiftKey ) {
			e.preventDefault();
			handleSend();
		}
	} );
	textarea.addEventListener( 'input', updateCounter );

	function updateCounter() {
		var len = textarea.value.length;
		counter.textContent = len + ' / ' + config.inputMaxLength;
	}

	function appendMessage( role, text ) {
		var bubble = document.createElement( 'div' );
		bubble.className = 'rmu-aic-msg ' + role;
		bubble.textContent = text;
		messages.appendChild( bubble );
		messages.scrollTop = messages.scrollHeight;
		return bubble;
	}

	function handleSend() {
		if ( sending ) {
			return;
		}
		var text = textarea.value.trim();
		if ( ! text ) {
			return;
		}
		if ( text.length > config.inputMaxLength ) {
			return;
		}

		appendMessage( 'user', text );
		textarea.value = '';
		updateCounter();

		var typing = document.createElement( 'div' );
		typing.className = 'rmu-aic-typing';
		typing.textContent = config.i18n.thinking;
		messages.appendChild( typing );
		messages.scrollTop = messages.scrollHeight;

		sending = true;
		sendBtn.disabled = true;

		var headers = { 'Content-Type': 'application/json' };
		if ( config.nonce ) {
			headers['X-WP-Nonce'] = config.nonce;
		}

		fetch( config.restUrl, {
			method: 'POST',
			headers: headers,
			credentials: 'same-origin',
			body: JSON.stringify( {
				message: text,
				conversation_id: conversationId,
				guest_id: getGuestId(),
			} ),
		} )
			.then( function ( res ) {
				return res.json().then( function ( data ) {
					return { ok: res.ok, data: data };
				} );
			} )
			.then( function ( result ) {
				typing.remove();
				var data = result.data || {};

				if ( data.guest_id ) {
					safeSet( STORAGE_GUEST, data.guest_id );
				}

				if ( ! result.ok || data.error ) {
					appendMessage( 'error', data.message || data.error || config.i18n.genericError );
					if ( data.reset_conversation ) {
						conversationId = '';
						safeSet( STORAGE_CONVERSATION, '' );
					}
					return;
				}

				conversationId = data.conversation_id || conversationId;
				safeSet( STORAGE_CONVERSATION, conversationId );
				appendMessage( 'bot', data.answer || '' );
			} )
			.catch( function () {
				typing.remove();
				appendMessage( 'error', config.i18n.genericError );
			} )
			.finally( function () {
				sending = false;
				sendBtn.disabled = false;
			} );
	}
} )();
