( function () {
	'use strict';

	var config = window.rmuAiChatConfig;
	if ( ! config ) {
		return;
	}

	var STORAGE_CONVERSATION = 'rmu_ai_chat_conversation_id';
	var STORAGE_GUEST = 'rmu_ai_chat_guest_id';
	var STORAGE_CONSENT = 'rmu_ai_chat_privacy_consent';

	var root = document.getElementById( 'rmu-ai-chat-root' );
	if ( ! root ) {
		return;
	}

	var conversationId = safeGet( STORAGE_CONVERSATION ) || '';
	var greeted = false;
	var sending = false;
	var consentGiven = ! config.privacyEnabled || !! safeGet( STORAGE_CONSENT );

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

	// mascot 4 ท่า (idle/welcome/listening/thinking) — ถ้า asset ไม่ครบ ตัว PHP (class-widget.php)
	// จะเติมท่าที่ขาดด้วย idle ให้แล้ว ถ้าไม่มี mascot เลยจะได้ object ว่างมา แล้ว fallback เป็นไอคอน SVG เดิม
	var mascotPoses = config.mascotPoses || {};
	var hasMascot = !! mascotPoses.idle;

	// คืน <img> ที่สลับท่าได้ (เก็บ reference ไว้ setPose ทีหลัง) หรือ <svg> ไอคอนเดิมถ้าไม่มี mascot
	function buildMascotNode( pose ) {
		if ( hasMascot ) {
			var img = document.createElement( 'img' );
			img.className = 'rmu-aic-mascot';
			img.alt = '';
			img.src = mascotPoses[ pose ] || mascotPoses.idle;
			return img;
		}
		var wrap = document.createElement( 'span' );
		wrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
			'<path d="M4 4h16v12H7l-3 3V4z" fill="currentColor"/></svg>';
		return wrap.firstChild;
	}

	// สลับท่าของ <img> ที่ได้จาก buildMascotNode — no-op ถ้าเป็น <svg> fallback (ไม่มี mascot)
	function setImgPose( imgEl, pose ) {
		if ( ! imgEl || 'IMG' !== imgEl.tagName ) {
			return;
		}
		var url = mascotPoses[ pose ] || mascotPoses.idle;
		if ( url && imgEl.src !== url ) {
			imgEl.src = url;
		}
	}

	var toggleBtn = document.createElement( 'button' );
	toggleBtn.type = 'button';
	toggleBtn.className = 'rmu-aic-toggle' + ( hasMascot ? ' rmu-aic-has-mascot' : '' );
	toggleBtn.setAttribute( 'aria-label', config.i18n.open );
	var toggleMascotNode = buildMascotNode( 'idle' );
	toggleBtn.appendChild( toggleMascotNode );

	// --- หน้าประกาศความเป็นส่วนตัว (แสดงครั้งแรกก่อนเข้าแชท ถ้าเปิดใช้งานไว้) ---

	var consentPanel = document.createElement( 'div' );
	consentPanel.className = 'rmu-aic-consent';

	var consentCloseBtn = document.createElement( 'button' );
	consentCloseBtn.type = 'button';
	consentCloseBtn.className = 'rmu-aic-consent-close';
	consentCloseBtn.setAttribute( 'aria-label', config.i18n.close );
	consentCloseBtn.innerHTML = '&times;';

	var consentBody = document.createElement( 'div' );
	consentBody.className = 'rmu-aic-consent-body';

	var consentAvatar = document.createElement( 'div' );
	consentAvatar.className = 'rmu-aic-consent-avatar' + ( hasMascot ? ' rmu-aic-has-mascot' : '' );
	consentAvatar.appendChild( buildMascotNode( 'welcome' ) );

	var consentName = document.createElement( 'h3' );
	consentName.textContent = config.chatTitle || '';

	var consentTitle = document.createElement( 'h4' );
	consentTitle.textContent = config.privacyTitle || '';

	var consentText = document.createElement( 'div' );
	consentText.className = 'rmu-aic-consent-text';
	consentText.innerHTML = config.privacyText || '';

	consentBody.appendChild( consentAvatar );
	consentBody.appendChild( consentName );
	consentBody.appendChild( consentTitle );
	consentBody.appendChild( consentText );

	var consentFooter = document.createElement( 'div' );
	consentFooter.className = 'rmu-aic-consent-footer';

	var consentAgree = document.createElement( 'label' );
	consentAgree.className = 'rmu-aic-consent-agree';

	var consentCheckbox = document.createElement( 'input' );
	consentCheckbox.type = 'checkbox';

	var consentLabelText = document.createElement( 'span' );
	consentLabelText.textContent = config.i18n.consentLabel || '';

	consentAgree.appendChild( consentCheckbox );
	consentAgree.appendChild( consentLabelText );

	var consentStartBtn = document.createElement( 'button' );
	consentStartBtn.type = 'button';
	consentStartBtn.className = 'rmu-aic-consent-start';
	consentStartBtn.textContent = config.i18n.startChat || '';
	consentStartBtn.disabled = true;

	consentFooter.appendChild( consentAgree );
	consentFooter.appendChild( consentStartBtn );

	consentPanel.appendChild( consentCloseBtn );
	consentPanel.appendChild( consentBody );
	consentPanel.appendChild( consentFooter );

	var panel = document.createElement( 'div' );
	panel.className = 'rmu-aic-panel';

	var header = document.createElement( 'div' );
	header.className = 'rmu-aic-header';

	// รูปประจำตัวใน header สลับท่าไปตามสถานะการสนทนา (ดู setChatMascot ด้านล่าง)
	var headerAvatar = document.createElement( 'div' );
	headerAvatar.className = 'rmu-aic-header-avatar' + ( hasMascot ? ' rmu-aic-has-mascot' : '' );
	var headerMascotNode = buildMascotNode( 'idle' );
	headerAvatar.appendChild( headerMascotNode );

	var title = document.createElement( 'h3' );
	title.textContent = config.chatTitle || '';

	var headerLeft = document.createElement( 'div' );
	headerLeft.className = 'rmu-aic-header-left';
	headerLeft.appendChild( headerAvatar );
	headerLeft.appendChild( title );

	var closeBtn = document.createElement( 'button' );
	closeBtn.type = 'button';
	closeBtn.className = 'rmu-aic-close';
	closeBtn.setAttribute( 'aria-label', config.i18n.close );
	closeBtn.innerHTML = '&times;';

	header.appendChild( headerLeft );
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

	// toggleBtn มาก่อนในลำดับ DOM ตั้งใจ — กด Tab ต่อจากปุ่มลอยแล้วต้องเข้าไปสู่ปุ่ม/ช่องใน panel
	// ที่เปิดอยู่ทันที (consent หรือแชท) ไม่ใช่หลุดออกไปนอกวิดเจ็ต
	root.appendChild( toggleBtn );
	root.appendChild( consentPanel );
	root.appendChild( panel );

	updateCounter();

	// --- Events ---

	// ตัวจัดการท่าของ mascot ใน header ให้ตรงกับสถานะการสนทนาจริง
	function setChatMascot( pose ) {
		setImgPose( headerMascotNode, pose );
	}

	// true ระหว่างช่วงโชว์ท่า welcome ตอนเปิดแชทครั้งแรก — กัน textarea.focus() ยิง event
	// 'focus' ทับท่าเป็น listening ทันทีก่อนผู้ใช้ทันเห็น welcome เลย
	var welcomeTimer = null;

	function openChat() {
		root.classList.add( 'is-open' );
		root.classList.remove( 'is-consent' );
		if ( ! greeted && config.greeting ) {
			appendMessage( 'bot', config.greeting );
			greeted = true;
			setChatMascot( 'welcome' );
			clearTimeout( welcomeTimer );
			welcomeTimer = setTimeout( function () {
				welcomeTimer = null;
				// เช็คสถานะจริง ณ ตอนนั้นแทนที่จะยัด idle ดื้อๆ เผื่อผู้ใช้พิมพ์/ส่งข้อความไปแล้วระหว่างรอ
				if ( sending ) {
					setChatMascot( 'thinking' );
				} else if ( document.activeElement === textarea ) {
					setChatMascot( 'listening' );
				} else {
					setChatMascot( 'idle' );
				}
			}, 1600 );
		} else {
			setChatMascot( 'idle' );
		}
		textarea.focus();
	}

	function openConsent() {
		root.classList.add( 'is-open', 'is-consent' );
		// ย้าย focus เข้า dialog ทันที ไม่งั้นคีย์บอร์ดยังค้างอยู่ที่ปุ่มลอย กด Tab ต่อแล้วอาจหลุดออกนอกวิดเจ็ต
		consentCheckbox.focus();
	}

	function closeWidget() {
		root.classList.remove( 'is-open', 'is-consent' );
	}

	toggleBtn.addEventListener( 'click', function () {
		if ( root.classList.contains( 'is-open' ) ) {
			closeWidget();
			return;
		}
		if ( consentGiven ) {
			openChat();
		} else {
			openConsent();
		}
	} );

	consentCheckbox.addEventListener( 'change', function () {
		consentStartBtn.disabled = ! consentCheckbox.checked;
	} );

	consentStartBtn.addEventListener( 'click', function () {
		if ( ! consentCheckbox.checked ) {
			return;
		}
		safeSet( STORAGE_CONSENT, '1' );
		consentGiven = true;
		openChat();
	} );

	consentCloseBtn.addEventListener( 'click', closeWidget );

	closeBtn.addEventListener( 'click', closeWidget );

	// ปุ่มลอย: ชวนคลิกด้วยท่า welcome ตอน hover/focus แล้วกลับ idle ตอนออก (no-op ถ้าไม่มี mascot)
	toggleBtn.addEventListener( 'mouseenter', function () {
		setImgPose( toggleMascotNode, 'welcome' );
	} );
	toggleBtn.addEventListener( 'mouseleave', function () {
		setImgPose( toggleMascotNode, 'idle' );
	} );
	toggleBtn.addEventListener( 'focus', function () {
		setImgPose( toggleMascotNode, 'welcome' );
	} );
	toggleBtn.addEventListener( 'blur', function () {
		setImgPose( toggleMascotNode, 'idle' );
	} );

	// กำลังพิมพ์อยู่ = ท่า listening, ออกจากช่องพิมพ์ = กลับ idle
	// เว้นแต่กำลังรอคำตอบอยู่ (ปล่อยให้ thinking คุมแทน) หรือยังอยู่ในช่วงโชว์ท่า welcome ตอนเปิดแชทครั้งแรก
	textarea.addEventListener( 'focus', function () {
		if ( ! sending && ! welcomeTimer ) {
			setChatMascot( 'listening' );
		}
	} );
	textarea.addEventListener( 'blur', function () {
		if ( ! sending && ! welcomeTimer ) {
			setChatMascot( 'idle' );
		}
	} );

	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' === e.key && root.classList.contains( 'is-open' ) ) {
			closeWidget();
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

	// whitelist ตัวอักษรที่ URL ใช้จริง (RFC 3986 unreserved + reserved) แทนการ exclude แค่ช่องว่าง/เครื่องหมายคำพูด —
	// กันข้อความไทยที่เขียนติดกับ URL แบบไม่เว้นวรรค (เช่น "...setupนะคะ") หลุดเข้ามาเป็นส่วนหนึ่งของลิงก์
	// ไม่รวม * ไว้ (ต่างจาก sub-delims เต็มของ RFC 3986) เพราะ Dify ชอบห่อ URL ด้วย **ตัวหนา** —
	// ถ้าใส่ * ไว้ URL เปล่าที่แปลงก่อน bold จะกลืนเครื่องหมายปิดตัวหนาเข้าไปในตัว href เอง
	var URL_RE = /\bhttps?:\/\/[A-Za-z0-9\-._~:/?#[\]@!$&'()+,;=%]+/g;

	// ตัดวรรคตอนท้ายประโยคที่ติดมากับ URL ออก (., ; : ! ?) ส่วน ) ต้องเช็คสมดุลกับ ( ในตัว URL เอง
	// ก่อน ไม่งั้น URL ที่มีวงเล็บของตัวเองอยู่แล้ว (เช่นลิงก์ wikipedia ...บทความ_(ตัวอย่าง)) จะโดนตัด ) ทิ้งผิด
	function stripTrailingPunct( url ) {
		var trailing = '';
		var m = url.match( /[.,;:!?]+$/ );
		if ( m ) {
			trailing = m[ 0 ];
			url = url.slice( 0, -trailing.length );
		}
		var openCount = ( url.match( /\(/g ) || [] ).length;
		var closeCount = ( url.match( /\)/g ) || [] ).length;
		while ( closeCount > openCount && ')' === url.slice( -1 ) ) {
			url = url.slice( 0, -1 );
			trailing = ')' + trailing;
			closeCount--;
		}
		return { url: url, trailing: trailing };
	}

	function escapeHtml( str ) {
		return String( str )
			.replace( /&/g, '&amp;' )
			.replace( /</g, '&lt;' )
			.replace( />/g, '&gt;' )
			.replace( /"/g, '&quot;' )
			.replace( /'/g, '&#39;' );
	}

	// จัดรูปแบบระดับ "ในบรรทัด" — ลิงก์ (ทั้งแบบ markdown [ข้อความ](url) และ URL เปล่าๆ), ตัวหนา, ตัวเอียง
	// รับ text ที่ escapeHtml แล้วเท่านั้น (เรียกจาก renderMarkdown ด้านล่าง ไม่ escape ซ้ำ)
	function inlineMarkdown( text ) {
		var links = [];

		function stash( html ) {
			links.push( html );
			return '\u0000' + ( links.length - 1 ) + '\u0000';
		}

		// 1) ลิงก์ทั้งสองแบบ (markdown [ข้อความ](url) และ URL เปล่า) ก่อนอย่างอื่นเสมอ — พัก <a> ที่สร้าง
		// เสร็จไว้เป็น placeholder ทันที ไม่ปล่อยให้ HTML จริง (มี target="_blank" ของเราเองซึ่งมี
		// underscore อยู่ในนั้น) ไปตกค้างในสตริงตอน bold/ตัวเอียงยังไม่รันผ่าน — กันจับ underscore ใน
		// href/attribute ของเราเองผิดเป็นตัวเอียง (เดิมพักแค่ลิงก์ markdown อย่างเดียว ทำให้ URL เปล่าที่
		// ถูกแปลงเป็น <a> ไปแล้วยังโดนตัวเอียงแทรกเข้าไปในแอตทริบิวต์ตัวเองได้)
		var out = text.replace( /\[([^\[\]]+)\]\((https?:\/\/[^\s)]+)\)/g, function ( m, label, url ) {
			return stash( '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + label + '</a>' );
		} );
		out = out.replace( URL_RE, function ( rawUrl ) {
			var stripped = stripTrailingPunct( rawUrl );
			return stash( '<a href="' + stripped.url + '" target="_blank" rel="noopener noreferrer">' + stripped.url + '</a>' ) + stripped.trailing;
		} );

		// 2) ตัวหนา **text**/__text__ ก่อนตัวเอียงเสมอ กันจับดาวคู่ผิดเป็นดาวเดี่ยว
		// ตัวแปร __text__ และตัวเอียง _text_ ใช้ (?<!\w)/(?!\w) คุมขอบเขต กัน underscore กลางคำ
		// เช่น snake_case (guest_id) หรือ URL ที่เพิ่งแปลงเป็น <a href="..._blank...> ไปหมาดๆ ด้านบน
		// โดนจับผิดเป็นตัวเอียง (underscore เป็น \w จึงไม่มี \b คั่นกลางคำแบบนั้นอยู่แล้ว)
		out = out.replace( /\*\*([^*]+)\*\*/g, function ( m, a ) {
			return '<strong>' + a + '</strong>';
		} );
		out = out.replace( /(?<!\w)__([^_\s][^_]*?)__(?!\w)/g, function ( m, a ) {
			return '<strong>' + a + '</strong>';
		} );
		out = out.replace( /\*([^*\s][^*]*?)\*/g, function ( m, a ) {
			return '<em>' + a + '</em>';
		} );
		out = out.replace( /(?<!\w)_([^_\s][^_]*?)_(?!\w)/g, function ( m, a ) {
			return '<em>' + a + '</em>';
		} );

		// 3) คืนลิงก์ที่พักไว้ทั้งหมดกลับเข้าไป (ปลอดภัยแล้ว เพราะ bold/ตัวเอียงรันผ่านไปหมดแล้ว)
		return out.replace( /\u0000(\d+)\u0000/g, function ( m, i ) {
			return links[ i ];
		} );
	}

	// เรนเดอร์ markdown ระดับ "บล็อก" อย่างง่าย — หัวข้อ, list, ย่อหน้า — เท่าที่คำตอบจาก Dify ใช้จริง
	// (ไม่ใช่ markdown parser เต็มรูปแบบ ไม่รองรับ nested list/code block/table)
	function renderMarkdown( text ) {
		var lines = escapeHtml( text ).replace( /\r\n/g, '\n' ).split( '\n' );
		var isUlLine = function ( l ) {
			return /^\s*[-*]\s+/.test( l );
		};
		var isOlLine = function ( l ) {
			return /^\s*\d+\.\s+/.test( l );
		};
		var isHeadingLine = function ( l ) {
			return /^#{1,6}\s+/.test( l );
		};

		var html = '';
		var i = 0;

		while ( i < lines.length ) {
			if ( '' === lines[ i ].trim() ) {
				i++;
				continue;
			}

			var heading = lines[ i ].match( /^(#{1,6})\s+(.*)$/ );
			if ( heading ) {
				// h1/h2 ใหญ่เกินไปในบับเบิลแชท เริ่มที่ h3 แทน
				var level = Math.min( heading[ 1 ].length + 2, 6 );
				html += '<h' + level + '>' + inlineMarkdown( heading[ 2 ] ) + '</h' + level + '>';
				i++;
				continue;
			}

			if ( isUlLine( lines[ i ] ) || isOlLine( lines[ i ] ) ) {
				var ordered = isOlLine( lines[ i ] );
				var itemRe = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
				var items = [];
				while ( i < lines.length && itemRe.test( lines[ i ] ) ) {
					items.push( '<li>' + inlineMarkdown( lines[ i ].replace( itemRe, '' ) ) + '</li>' );
					i++;
				}
				var tag = ordered ? 'ol' : 'ul';
				html += '<' + tag + '>' + items.join( '' ) + '</' + tag + '>';
				continue;
			}

			// ย่อหน้า: รวมบรรทัดติดกันจนกว่าจะเจอบรรทัดว่าง/หัวข้อ/list
			var paraLines = [];
			while ( i < lines.length && '' !== lines[ i ].trim() && ! isUlLine( lines[ i ] ) && ! isOlLine( lines[ i ] ) && ! isHeadingLine( lines[ i ] ) ) {
				paraLines.push( inlineMarkdown( lines[ i ] ) );
				i++;
			}
			html += '<p>' + paraLines.join( '<br>' ) + '</p>';
		}

		return html;
	}

	function appendMessage( role, text ) {
		var bubble = document.createElement( 'div' );
		bubble.className = 'rmu-aic-msg ' + role;
		if ( 'bot' === role ) {
			bubble.innerHTML = renderMarkdown( text );
		} else {
			bubble.textContent = text;
		}
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
		setChatMascot( 'thinking' );

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
				consent: consentGiven ? 1 : 0,
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
				setChatMascot( document.activeElement === textarea ? 'listening' : 'idle' );
			} );
	}
} )();
