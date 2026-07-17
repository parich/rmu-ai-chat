=== RMU AI Chat ===
Contributors: rmu
Tags: chat, ai, dify, chatbot
Requires at least: 5.8
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.1.1
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

ไอคอนแชท AI ลอยหน้าเว็บ เชื่อมต่อ Dify Chat API ตั้งค่าได้ผ่านหน้า Admin

== Description ==

ปลั๊กอินนี้เพิ่มไอคอนแชทลอยบนหน้าเว็บ ที่คุยกับผู้ช่วย AI ผ่าน Dify (https://dify.ai)
API Key ของ Dify ถูกเก็บและเรียกใช้เฉพาะฝั่ง server เท่านั้น ไม่หลุดไปฝั่ง browser

ตั้งค่าได้จากเมนู "RMU AI Chat" ในหน้า wp-admin:

* Dify API URL / API Key
* เปิด/ปิดการใช้งานของผู้เยี่ยมชมที่ไม่ได้ login
* จำนวนข้อความสูงสุดต่อช่วงเวลา (กัน spam/ค่าใช้จ่ายบาน)
* ความยาวข้อความสูงสุดต่อครั้ง
* ตำแหน่งไอคอน (มุมล่างซ้าย/ขวา) และระยะห่างจากขอบจอ
* สีธีม, ชื่อหัวข้อหน้าต่างแชท, ข้อความทักทาย
* ไม่แสดงผลในหน้า (Page) ที่เลือกไว้

== Installation ==

1. อัปโหลดโฟลเดอร์ปลั๊กอินไปที่ /wp-content/plugins/
2. เปิดใช้งานปลั๊กอินผ่านเมนู "ปลั๊กอิน" ใน wp-admin
3. ไปที่เมนู "RMU AI Chat" กรอก Dify API URL และ API Key แล้วบันทึก

== Changelog ==

= 1.1.1 =
* แก้ guest ถูกบล็อกด้วยข้อความ "You are not authorized to perform this action." เมื่อเว็บเปิดฟีเจอร์
  Disallow Unauthorized REST Requests ของ All-In-One WP Security — whitelist namespace ของปลั๊กอินอัตโนมัติ

= 1.1.0 =
* เพิ่มปุ่ม Like / Dislike / คัดลอกคำตอบ ใต้ข้อความตอบกลับของ bot (feedback ส่งเข้า Dify)
* ตอนกด Dislike ถามความเห็นเพิ่มเติมแบบไม่บังคับ
* endpoint ใหม่: POST /wp-json/rmu-ai-chat/v1/feedback (มี rate limit แยกจากข้อความแชท)

= 1.0.1 =
* เพิ่มปุ่ม "ทดสอบการเชื่อมต่อ Dify" ในหน้า settings เพื่อดู error จริงตอนเชื่อมต่อ Dify ไม่สำเร็จ
* บันทึก error log เมื่อเชื่อมต่อ Dify ล้มเหลว (เดิมเห็นแค่ข้อความทั่วไป)

= 1.0.0 =
* เวอร์ชันแรก
