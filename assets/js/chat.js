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

	// --- Action buttons (copy / like / dislike) ใต้คำตอบ bot ---

	var ICONS = {
		copy:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
		check:
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
		thumbsUp:
			'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
		thumbsDown:
			'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>',
	};

	function copyText( text, done ) {
		function legacyCopy() {
			var ta = document.createElement( 'textarea' );
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild( ta );
			ta.select();
			var ok = false;
			try {
				ok = document.execCommand( 'copy' );
			} catch ( e ) {
				ok = false;
			}
			ta.remove();
			done( ok );
		}
		// เว็บที่เสิร์ฟผ่าน http (ไม่ใช่ secure context) จะไม่มี navigator.clipboard — fallback ไป execCommand
		if ( navigator.clipboard && window.isSecureContext ) {
			navigator.clipboard.writeText( text ).then(
				function () {
					done( true );
				},
				legacyCopy
			);
		} else {
			legacyCopy();
		}
	}

	function sendFeedback( messageId, rating, content ) {
		var headers = { 'Content-Type': 'application/json' };
		if ( config.nonce ) {
			headers['X-WP-Nonce'] = config.nonce;
		}
		return fetch( config.restFeedbackUrl, {
			method: 'POST',
			headers: headers,
			credentials: 'same-origin',
			body: JSON.stringify( {
				message_id: messageId,
				rating: rating || '',
				content: content || '',
				guest_id: getGuestId(),
			} ),
		} ).then( function ( res ) {
			return res.json().then( function ( data ) {
				return { ok: res.ok && ! data.error, data: data };
			} );
		} );
	}

	function iconButton( icon, label ) {
		var btn = document.createElement( 'button' );
		btn.type = 'button';
		btn.className = 'rmu-aic-action';
		btn.setAttribute( 'aria-label', label );
		btn.title = label;
		btn.innerHTML = icon;
		return btn;
	}

	function attachActions( text, messageId ) {
		var row = document.createElement( 'div' );
		row.className = 'rmu-aic-actions';

		var copyBtn = iconButton( ICONS.copy, config.i18n.copy );
		copyBtn.addEventListener( 'click', function () {
			copyText( text, function ( ok ) {
				copyBtn.innerHTML = ok ? ICONS.check : ICONS.copy;
				copyBtn.title = ok ? config.i18n.copied : config.i18n.copyFail;
				setTimeout( function () {
					copyBtn.innerHTML = ICONS.copy;
					copyBtn.title = config.i18n.copy;
				}, 1500 );
			} );
		} );
		row.appendChild( copyBtn );

		if ( messageId ) {
			var likeBtn = iconButton( ICONS.thumbsUp, config.i18n.like );
			var dislikeBtn = iconButton( ICONS.thumbsDown, config.i18n.dislike );
			var rating = null;
			var pending = false;

			function paint() {
				likeBtn.classList.toggle( 'is-active-like', 'like' === rating );
				dislikeBtn.classList.toggle( 'is-active-dislike', 'dislike' === rating );
			}

			function handleRating( clicked ) {
				if ( pending ) {
					return;
				}
				// กดซ้ำ rating เดิม = ยกเลิก — อัปเดต UI ก่อน แล้ว revert ถ้า server ตอบ error
				var prev = rating;
				rating = rating === clicked ? null : clicked;
				paint();
				pending = true;
				sendFeedback( messageId, rating )
					.then( function ( result ) {
						if ( ! result.ok ) {
							rating = prev;
							paint();
							return;
						}
						// ถามรายละเอียดเพิ่มเฉพาะตอนกด dislike (ไม่บังคับ) — ส่งซ้ำพร้อม content ให้ Dify อัปเดต feedback เดิม
						if ( 'dislike' === rating ) {
							var comment = window.prompt( config.i18n.dislikePrompt, '' );
							if ( comment && comment.trim() ) {
								sendFeedback( messageId, 'dislike', comment.trim().slice( 0, 500 ) );
							}
						}
					} )
					.catch( function () {
						rating = prev;
						paint();
					} )
					.finally( function () {
						pending = false;
					} );
			}

			likeBtn.addEventListener( 'click', function () {
				handleRating( 'like' );
			} );
			dislikeBtn.addEventListener( 'click', function () {
				handleRating( 'dislike' );
			} );
			row.appendChild( likeBtn );
			row.appendChild( dislikeBtn );
		}

		messages.appendChild( row );
		messages.scrollTop = messages.scrollHeight;
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
				attachActions( data.answer || '', data.message_id || '' );
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
