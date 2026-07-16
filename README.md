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

## Troubleshooting

เริ่มจากปุ่ม **"ทดสอบการเชื่อมต่อ"** ในหน้า wp-admin > RMU AI Chat ก่อนเสมอ — จะแสดง error จริง
จาก WordPress HTTP API แทนข้อความทั่วไปที่ผู้ใช้เห็น

> ตัวอย่างด้านล่างใช้ `dify.example.com` แทนโดเมน Dify จริง และ `<DIFY_IP>` แทน IP
> ของเซิร์ฟเวอร์ที่รัน Dify — แทนที่ด้วยค่าจริงของระบบคุณเอง

### `cURL error 6: Could not resolve host`

เซิร์ฟเวอร์ WordPress resolve DNS ของโดเมน Dify ไม่ได้ — วินิจฉัยโดยเทียบ resolver
ของเครื่องกับ DNS สาธารณะ:

```bash
dig dify.example.com             # ผ่าน resolver ปกติของเครื่อง
dig @8.8.8.8 dify.example.com    # ผ่าน DNS สาธารณะ
```

**กรณีที่เจอจริงบนเซิร์ฟเวอร์ CyberPanel:** คำสั่งแรกได้ `NXDOMAIN` (พร้อม flag `aa` และ
`recursion not available`) แต่คำสั่งที่สองได้ IP ถูกต้อง — สาเหตุคือเครื่อง WordPress มี
DNS server ของตัวเอง (PowerDNS ที่มากับ CyberPanel) ถือ zone ของโดเมนแม่ค้างอยู่
จึงตอบ NXDOMAIN แบบ authoritative เองโดยไม่ forward ไปถาม DNS จริงเลย

วิธีแก้ (เลือกตามสถานการณ์):

1. **เพิ่ม A record ใน DNS panel ของเครื่องนั้น** — CyberPanel > DNS > Add/Delete Records >
   เลือก zone โดเมนแม่ > เพิ่ม A record ชื่อ subdomain ของ Dify ชี้ไป `<DIFY_IP>`
   (ทำผ่านหน้าเว็บได้ ไม่ต้องใช้ terminal แต่แก้ได้เฉพาะโดเมนนี้)
2. **แก้ resolver ของเครื่องให้ชี้ DNS จริง** — ถ้า `/etc/resolv.conf` ชี้ `127.0.0.53`
   ทั้งที่ systemd-resolved ถูกปิด (CyberPanel ปิดเพื่อคืน port 53 ให้ PowerDNS)
   query ทั้งหมดจะตกไปที่ PowerDNS ซึ่งไม่ทำ recursion — โดเมนภายนอก*ทุกโดเมน*
   จะ resolve ไม่ได้ รวมถึง api.wordpress.org และ api.github.com
   (ทำให้ update WordPress และ auto-update ของปลั๊กอินนี้พังไปด้วย):
   ```bash
   printf "nameserver 1.1.1.1\nnameserver 8.8.8.8\n" > /etc/resolv.conf
   ```
   ระวังไฟล์ถูกเขียนทับตอน reboot — ตั้งถาวรผ่าน netplan หรือ `chattr +i /etc/resolv.conf`
3. **pin IP ใน `/etc/hosts`** (ทางเลือกชั่วคราว):
   ```bash
   echo "<DIFY_IP> dify.example.com" >> /etc/hosts
   ```
   ถ้าเซิร์ฟเวอร์ Dify ย้าย/เปลี่ยน IP ต้องตามแก้ทุกเครื่องที่เพิ่มไว้

หลังแก้แล้ว restart web server ให้โปรเซส PHP เห็นค่าใหม่ (OpenLiteSpeed:
`systemctl restart lsws`) แล้วกดปุ่ม "ทดสอบการเชื่อมต่อ" ใหม่ — ทดสอบจาก CLI ก่อนก็ได้:

```bash
curl -I https://dify.example.com/v1/parameters   # ได้ HTTP status ใดๆ = DNS/TLS ผ่านแล้ว
```

### `User has blocked requests through HTTP` / requests ออกภายนอกถูกบล็อก

`wp-config.php` ของเว็บนั้นเปิด `WP_HTTP_BLOCK_EXTERNAL` ไว้ — เพิ่ม host ของ Dify ใน allowlist:

```php
define( 'WP_ACCESSIBLE_HOSTS', 'api.wordpress.org,api.github.com,dify.example.com' );
```

### เช็คฝั่งเซิร์ฟเวอร์เพิ่มเติม

error จริงถูกบันทึกผ่าน `error_log()` (prefix `[rmu-ai-chat]`) — ดูได้จาก PHP error log ของเว็บนั้น

## Known limitations (v1)

- ไม่มีการโหลดประวัติแชทเก่ากลับมาแสดงตอน reload หน้า (มีแค่ conversation_id ต่อบทสนทนา)
- Exclude list ในหน้า settings ครอบคลุมเฉพาะ post type "page" (ผ่าน `get_pages()`) ไม่รวม custom post type
- Rate limit ใช้ WP transient (เก็บใน `wp_options` หรือ object cache ถ้ามี) — ถ้าเว็บมีหลาย PHP worker ที่ไม่ share
  persistent object cache เดียวกัน ตัวเลขอาจคลาดเคลื่อนเล็กน้อยภายใต้ concurrency สูง
- ไม่รองรับ streaming response (ใช้ Dify `response_mode: blocking` เท่านั้น)

## License

GPLv2 or later
