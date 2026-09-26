( function () {
	'use strict';

	var config = window.rmuAiChatConfig;
	if ( ! config ) {
		return;
	}

	var STORAGE_CONVERSATION = 'rmu_ai_chat_conversation_id';
	var STORAGE_GUEST = 'rmu_ai_chat_guest_id';
	var STORAGE_CONSENT = 'rmu_ai_chat_privacy_consent';
	// sessionStorage (ไม่ใช่ localStorage) — บอลลูนชวนคุยขึ้นครั้งเดียวต่อแท็บ ไม่ใช่ครั้งเดียวตลอดไป
	var STORAGE_TEASER = 'rmu_ai_chat_teaser_seen';

	// รอหลังโหลดหน้าก่อนบอลลูนแรกขึ้น ตั้งได้จากหน้า Settings — wp_localize_script แปลงค่าชั้นบนสุดเป็น string เสมอ จึงต้อง parseInt
	var TEASER_DELAY_MS = parseInt( config.teaserDelay, 10 ) || 0;
	var TEASER_SHOW_MS = 6000; // เวลาที่แต่ละข้อความค้างอยู่ (หลังจุดพิมพ์หายไป)
	var TEASER_GAP_MS = 600; // ช่วงว่างระหว่างข้อความ ให้ mascot กลับท่า idle ก่อนเปลี่ยนท่าใหม่
	var BUBBLE_TYPING_MS = 900; // จุดพิมพ์ ... ก่อนข้อความขึ้น
	var WAIT_THINKING_MS = 2500; // รอคำตอบนานเกินนี้ เปลี่ยนจากท่าค้นหาเป็นท่าคิด
	var FLASH_MS = 1600; // ท่า welcome ชั่วคราวตอนเปิดแชทครั้งแรก/ตอนได้คำตอบ

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

	function sessionGet( key ) {
		try {
			return window.sessionStorage.getItem( key );
		} catch ( e ) {
			return null;
		}
	}

	function sessionSet( key, value ) {
		try {
			window.sessionStorage.setItem( key, value );
		} catch ( e ) {
			/* จำไม่ได้ = บอลลูนชวนคุยอาจขึ้นซ้ำเมื่อเปลี่ยนหน้า ไม่กระทบการใช้งาน */
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

	// mascot 5 ท่า (idle/welcome/listening/thinking/searching) — ถ้า asset ไม่ครบ ตัว PHP (class-widget.php)
	// จะเติมท่าที่ขาดด้วย idle ให้แล้ว ถ้าไม่มี mascot เลยจะได้ object ว่างมา แล้ว fallback เป็นไอคอน SVG เดิม
	var mascotPoses = config.mascotPoses || {};
	var hasMascot = !! mascotPoses.idle;
	var teaser = config.teaser || [];

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
		if ( ! url || imgEl.getAttribute( 'src' ) === url ) {
			return;
		}
		imgEl.src = url;
		// เด้งเบาๆ ทุกครั้งที่เปลี่ยนท่า — ต้องถอด class แล้วบังคับ reflow ก่อนใส่คืน ไม่งั้น animation ไม่เล่นซ้ำ
		imgEl.classList.remove( 'is-pop' );
		void imgEl.offsetWidth;
		imgEl.classList.add( 'is-pop' );
	}

	// โหลดรูปทุกท่ารอไว้หลังหน้าเว็บโหลดเสร็จ สลับท่าครั้งแรกจะได้ไม่ต้องรอดาวน์โหลด (ไฟล์ละ ~10 KB)
	function preloadMascotPoses() {
		Object.keys( mascotPoses ).forEach( function ( pose ) {
			new Image().src = mascotPoses[ pose ];
		} );
	}

	if ( hasMascot ) {
		if ( 'complete' === document.readyState ) {
			preloadMascotPoses();
		} else {
			window.addEventListener( 'load', preloadMascotPoses );
		}
	}

	var toggleBtn = document.createElement( 'button' );
	toggleBtn.type = 'button';
	toggleBtn.className = 'rmu-aic-toggle' + ( hasMascot ? ' rmu-aic-has-mascot' : '' );
	toggleBtn.setAttribute( 'aria-label', config.i18n.open );
	var toggleMascotNode = buildMascotNode( 'idle' );
	toggleBtn.appendChild( toggleMascotNode );

	// --- บอลลูนคำพูดของ mascot เหนือปุ่มลอย (ข้อความชวนคุย / แจ้งว่าคำตอบมาแล้วตอนปิดหน้าต่างแชทอยู่) ---

	var bubble = document.createElement( 'div' );
	bubble.className = 'rmu-aic-bubble';

	// ทั้งบอลลูนกดได้ = เปิดแชท จึงใช้ <button> ให้กด Tab/Enter ได้ด้วย ไม่ใช่แค่คลิกเมาส์
	var bubbleText = document.createElement( 'button' );
	bubbleText.type = 'button';
	bubbleText.className = 'rmu-aic-bubble-text';

	var bubbleClose = document.createElement( 'button' );
	bubbleClose.type = 'button';
	bubbleClose.className = 'rmu-aic-bubble-close';
	bubbleClose.setAttribute( 'aria-label', config.i18n.dismiss );
	bubbleClose.innerHTML = '&times;';

	bubble.appendChild( bubbleText );
	bubble.appendChild( bubbleClose );

	var TYPING_DOTS = '<span class="rmu-aic-bubble-dots" aria-hidden="true"><span></span><span></span><span></span></span>';

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

	// รูปประจำตัวใน header สลับท่าไปตามสถานะการสนทนา (ดู chatPose() ด้านล่าง)
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
	root.appendChild( bubble );
	root.appendChild( consentPanel );
	root.appendChild( panel );

	updateCounter();

	// --- ท่าของ mascot ---
	// ไม่สั่งเปลี่ยนท่าตรงๆ จาก event แต่ละตัว — ทุก event แค่อัปเดตสถานะแล้วเรียก syncMascots()
	// ให้ chatPose()/launcherPose() คำนวณท่าจากสถานะรวม ณ ตอนนั้น กันท่าค้างผิดเมื่อหลาย event ซ้อนกัน

	var waitPose = 'searching'; // ท่าระหว่างรอคำตอบ: ค้นหาก่อน รอนานค่อยเปลี่ยนเป็นคิด
	var waitTimer = null;
	var chatFlashPose = null; // ท่าชั่วคราวใน header (welcome ตอนเปิดแชทครั้งแรก/ตอนได้คำตอบ)
	var chatFlashTimer = null;
	var bubblePose = null; // ท่าของบอลลูนที่กำลังแสดงอยู่ (null = ไม่มีบอลลูน)
	var toggleInviting = false; // เมาส์ชี้/focus อยู่ที่ปุ่มลอย

	function isOpen() {
		return root.classList.contains( 'is-open' );
	}

	function chatPose() {
		if ( sending ) {
			return waitPose;
		}
		if ( chatFlashPose ) {
			return chatFlashPose;
		}
		return document.activeElement === textarea ? 'listening' : 'idle';
	}

	function launcherPose() {
		if ( toggleInviting ) {
			return 'welcome';
		}
		if ( bubblePose ) {
			return bubblePose;
		}
		// ปิดหน้าต่างแชทระหว่างรอคำตอบ — ให้ปุ่มลอยค้นหา/คิดแทน header ที่มองไม่เห็นแล้ว
		if ( sending && ! isOpen() ) {
			return waitPose;
		}
		return 'idle';
	}

	function syncMascots() {
		setImgPose( headerMascotNode, chatPose() );
		setImgPose( toggleMascotNode, launcherPose() );
	}

	function flashChatMascot( pose ) {
		chatFlashPose = pose;
		clearTimeout( chatFlashTimer );
		chatFlashTimer = setTimeout( function () {
			chatFlashPose = null;
			syncMascots();
		}, FLASH_MS );
		syncMascots();
	}

	// --- บอลลูนคำพูด ---

	var bubbleTimers = [];

	function bubbleLater( fn, ms ) {
		bubbleTimers.push( setTimeout( fn, ms ) );
	}

	function clearBubbleTimers() {
		bubbleTimers.forEach( clearTimeout );
		bubbleTimers = [];
	}

	// แทนที่บอลลูน/ลำดับข้อความชวนคุยที่ค้างอยู่ทั้งหมด (timer เก่าต้องไม่มาเขียนข้อความทับทีหลัง)
	// แสดงจุดพิมพ์ ... สั้นๆ ก่อนแล้วค่อยขึ้นข้อความ ให้ความรู้สึกว่า mascot กำลังพิมพ์ตอบจริงๆ
	function showBubble( text, pose ) {
		clearBubbleTimers();
		bubblePose = pose;
		bubbleText.innerHTML = TYPING_DOTS;
		root.classList.add( 'has-bubble' );
		syncMascots();
		bubbleLater( function () {
			bubbleText.textContent = text;
		}, BUBBLE_TYPING_MS );
	}

	// ซ่อนบอลลูนโดยไม่ยกเลิกลำดับข้อความที่ตั้งเวลาไว้ (ใช้ระหว่างข้อความชวนคุยแต่ละข้อความ)
	function fadeBubble() {
		bubblePose = null;
		root.classList.remove( 'has-bubble' );
		syncMascots();
	}

	function hideBubble() {
		clearBubbleTimers();
		fadeBubble();
	}

	// ผู้ใช้ตอบสนองกับบอลลูนแล้ว (เปิดแชท/กดปิด) — ไม่ต้องชวนคุยซ้ำอีกใน session นี้
	function dismissBubble() {
		sessionSet( STORAGE_TEASER, '1' );
		hideBubble();
	}

	function runTeaser( index ) {
		if ( index >= teaser.length ) {
			hideBubble();
			return;
		}
		// showBubble() ล้าง timer ทั้งหมดก่อน — ต้องเรียกก่อนตั้งเวลาข้อความถัดไปเสมอ
		showBubble( teaser[ index ].text, teaser[ index ].pose );
		bubbleLater( function () {
			fadeBubble();
			bubbleLater( function () {
				runTeaser( index + 1 );
			}, TEASER_GAP_MS );
		}, BUBBLE_TYPING_MS + TEASER_SHOW_MS );
	}

	if ( teaser.length && ! sessionGet( STORAGE_TEASER ) ) {
		bubbleLater( function () {
			if ( isOpen() ) {
				return;
			}
			// จำไว้ตั้งแต่ข้อความแรกขึ้น — เปลี่ยนหน้ากลางคันก็ไม่เริ่มลำดับใหม่ให้รำคาญ
			sessionSet( STORAGE_TEASER, '1' );
			runTeaser( 0 );
		}, TEASER_DELAY_MS );
	}

	// --- Events ---

	function openChat() {
		root.classList.add( 'is-open' );
		root.classList.remove( 'is-consent' );
		if ( ! greeted && config.greeting ) {
			appendMessage( 'bot', config.greeting );
			greeted = true;
			flashChatMascot( 'welcome' );
		}
		textarea.focus();
		syncMascots();
	}

	function openConsent() {
		root.classList.add( 'is-open', 'is-consent' );
		// ย้าย focus เข้า dialog ทันที ไม่งั้นคีย์บอร์ดยังค้างอยู่ที่ปุ่มลอย กด Tab ต่อแล้วอาจหลุดออกนอกวิดเจ็ต
		consentCheckbox.focus();
	}

	function openWidget() {
		dismissBubble();
		if ( consentGiven ) {
			openChat();
		} else {
			openConsent();
		}
	}

	function closeWidget() {
		root.classList.remove( 'is-open', 'is-consent' );
		syncMascots();
	}

	toggleBtn.addEventListener( 'click', function () {
		if ( isOpen() ) {
			closeWidget();
			return;
		}
		openWidget();
	} );

	bubbleText.addEventListener( 'click', openWidget );

	bubbleClose.addEventListener( 'click', function ( e ) {
		dismissBubble();
		// ปิดด้วยคีย์บอร์ด (detail = 0) ต้องคืน focus ให้ปุ่มลอย ไม่งั้น focus หายไปกับบอลลูนที่ซ่อนแล้ว
		if ( 0 === e.detail ) {
			toggleBtn.focus();
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

	// ปุ่มลอย: ชวนคลิกด้วยท่า welcome ตอน hover/focus แล้วกลับท่าเดิมตอนออก (no-op ถ้าไม่มี mascot)
	function setToggleInviting( value ) {
		toggleInviting = value;
		syncMascots();
	}
	toggleBtn.addEventListener( 'mouseenter', function () {
		setToggleInviting( true );
	} );
	toggleBtn.addEventListener( 'mouseleave', function () {
		setToggleInviting( false );
	} );
	toggleBtn.addEventListener( 'focus', function () {
		setToggleInviting( true );
	} );
	toggleBtn.addEventListener( 'blur', function () {
		setToggleInviting( false );
	} );

	// กำลังพิมพ์อยู่ = ท่า listening, ออกจากช่องพิมพ์ = กลับ idle (chatPose() เช็ค activeElement ให้เอง)
	textarea.addEventListener( 'focus', syncMascots );
	textarea.addEventListener( 'blur', syncMascots );

	document.addEventListener( 'keydown', function ( e ) {
		if ( 'Escape' !== e.key ) {
			return;
		}
		if ( isOpen() ) {
			closeWidget();
		} else if ( root.classList.contains( 'has-bubble' ) ) {
			// กด Esc ขณะ focus อยู่ในบอลลูน — ต้องคืน focus ให้ปุ่มลอยเหมือนปุ่ม × ไม่งั้น focus หลุดไปที่ body
			var focusInBubble = bubble.contains( document.activeElement );
			dismissBubble();
			if ( focusInBubble ) {
				toggleBtn.focus();
			}
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
		var answered = false;
		waitPose = 'searching';
		clearTimeout( waitTimer );
		waitTimer = setTimeout( function () {
			waitPose = 'thinking';
			syncMascots();
		}, WAIT_THINKING_MS );
		syncMascots();

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
				answered = true;
			} )
			.catch( function () {
				typing.remove();
				appendMessage( 'error', config.i18n.genericError );
			} )
			.finally( function () {
				sending = false;
				sendBtn.disabled = false;
				clearTimeout( waitTimer );
				if ( ! answered ) {
					syncMascots();
					return;
				}
				flashChatMascot( 'welcome' );
				if ( ! isOpen() ) {
					// ผู้ใช้ปิดหน้าต่างแชทไประหว่างรอ — ให้ mascot เรียกกลับมาอ่านคำตอบ (ค้างไว้จนกว่าจะเปิด/กดปิด)
					showBubble( config.i18n.answerReady, 'welcome' );
				}
			} );
	}
} )();
