# RMU AI Chat

ปลั๊กอิน WordPress สำหรับแสดงไอคอนแชท AI ลอยหน้าเว็บ เชื่อมต่อกับ [Dify](https://dify.ai) Chat API
API Key ของ Dify ถูกเรียกใช้เฉพาะฝั่ง server (PHP) เท่านั้น — frontend คุยกับ REST endpoint ของปลั๊กอินเองแทนที่จะยิงหา Dify ตรงๆ

## Requirements

- WordPress 5.8+
- PHP 7.4+
- Dify App (Chat) พร้อม API URL และ API Key (`app-xxxxxxxx`)

## Installation (dev)

1. โฟลเดอร์นี้อยู่ใน `wp-content/plugins/rmu-ai-chat` อยู่แล้ว — เปิดใช้งานผ่าน wp-admin > ปลั๊กอิน
2. ไปที่เมนู **RMU AI Chat** ใน wp-admin แล้วกรอก Dify API URL / API Key
3. เปิดหน้าเว็บฝั่ง frontend เพื่อทดสอบไอคอนแชท

## Installation (เว็บไซต์อื่น / production)

1. ดาวน์โหลด `rmu-ai-chat.zip` จาก [GitHub Releases ล่าสุด](https://github.com/parich/rmu-ai-chat/releases/latest)
2. wp-admin > ปลั๊กอิน > เพิ่มปลั๊กอินใหม่ > อัปโหลดปลั๊กอิน > เลือกไฟล์ zip ที่ดาวน์โหลดมา > ติดตั้ง > เปิดใช้งาน
3. ตั้งค่า Dify API URL / API Key ที่เมนู **RMU AI Chat**

### อัปเดตเวอร์ชันใหม่

ปลั๊กอินมี GitHub-based update checker ในตัว (`includes/class-github-updater.php`) — เมื่อมี
[Release](https://github.com/parich/rmu-ai-chat/releases) ใหม่บน GitHub เว็บไซต์ที่ติดตั้งปลั๊กอินนี้ไว้จะ
เห็นแจ้งเตือนอัปเดตในหน้า wp-admin > ปลั๊กอิน ตามปกติ (เหมือนปลั๊กอินจาก WordPress.org) โดยไม่ต้องเชื่อม
WordPress.org repo ตรวจสอบทุก 6 ชั่วโมง หรือบังคับเช็คทันทีที่ `/wp-admin/update-core.php?force-check=1`

ดูขั้นตอนการออก release เวอร์ชันใหม่ที่ [RELEASE.md](RELEASE.md)

## Architecture

```
rmu-ai-chat.php              bootstrap: define constants, load includes, wire hooks
includes/
  class-dify-client.php      เรียก Dify /chat-messages (blocking) ผ่าน wp_remote_post
  class-rate-limit.php       จำกัดจำนวนข้อความ/ช่วงเวลา ด้วย WP transient (fixed window)
  class-rest-api.php         REST route: POST /wp-json/rmu-ai-chat/v1/message
  class-settings.php         หน้า wp-admin "RMU AI Chat" (Settings API, option เดียว)
  class-widget.php           enqueue asset + render container ใน wp_footer
  class-github-updater.php   เช็คเวอร์ชันใหม่จาก GitHub Releases (ดูหัวข้อ "อัปเดตเวอร์ชันใหม่" ด้านล่าง)
assets/
  css/chat.css, js/chat.js   ไอคอนลอย + หน้าต่างแชท (vanilla JS, ไม่พึ่ง library)
  css/admin.css, js/admin.js สไตล์/สคริปต์เฉพาะหน้า settings (init wp-color-picker)
uninstall.php                ลบ option ตอนถอนการติดตั้งปลั๊กอิน
```

ทุก config เก็บใน option เดียว: `rmu_ai_chat_options` (ดู `RMU_AI_Chat_Settings::default_options()`)

### Identity / rate limit

- ผู้ใช้ที่ login: identity = `wp-user-{ID}`, จำกัดโควตาต่อ user ID
- guest: identity = `wp-guest-{uuid}` โดย uuid สร้างฝั่ง client (`crypto.randomUUID()`) เก็บใน `localStorage`
  ส่งมาเป็น parameter `guest_id` ทุกครั้ง — จำกัดโควตาซ้อน 2 ชั้น (ต่อ guest_id และต่อ IP ซึ่งอนุญาตมากกว่า
  guest_id เดี่ยวๆ `IP_LIMIT_MULTIPLIER` เท่า เผื่อผู้ใช้หลายคนอยู่หลัง NAT/wifi เดียวกัน)
- `conversation_id` ที่ Dify ส่งกลับมาเก็บใน `localStorage` ฝั่ง client เพื่อคุยต่อเนื่องข้ามการเปิดหน้าเว็บใหม่
  (ไม่ persist ประวัติข้อความข้าม reload ในเวอร์ชันนี้ — เก็บแค่ conversation_id ไว้คุยต่อ)

## Known limitations (v1)

- ไม่มีการโหลดประวัติแชทเก่ากลับมาแสดงตอน reload หน้า (มีแค่ conversation_id ต่อบทสนทนา)
- Exclude list ในหน้า settings ครอบคลุมเฉพาะ post type "page" (ผ่าน `get_pages()`) ไม่รวม custom post type
- Rate limit ใช้ WP transient (เก็บใน `wp_options` หรือ object cache ถ้ามี) — ถ้าเว็บมีหลาย PHP worker ที่ไม่ share
  persistent object cache เดียวกัน ตัวเลขอาจคลาดเคลื่อนเล็กน้อยภายใต้ concurrency สูง
- ไม่รองรับ streaming response (ใช้ Dify `response_mode: blocking` เท่านั้น)

## License

GPLv2 or later
