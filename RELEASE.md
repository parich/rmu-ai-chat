# ขั้นตอนการออก Version ใหม่

ปลั๊กอินนี้ไม่มีขั้นตอน build (PHP/CSS/JS ธรรมดา ไม่ผ่าน webpack) ดังนั้นไม่ต้องมี `npm run build`
เว็บไซต์ปลายทางที่ติดตั้งปลั๊กอินนี้ไว้จะเห็น update ผ่านหน้า wp-admin ปกติ โดยตรวจสอบจาก
GitHub Releases ล่าสุดของ repo นี้ (ดู `includes/class-github-updater.php`)

## 1. แก้ไข Code

ทำการแก้ไข/เพิ่ม feature ที่ต้องการใน `includes/`, `assets/` หรือ `rmu-ai-chat.php`

---

## 2. อัปเดต Version Number

แก้ 2 จุดให้ตรงกัน ใน `rmu-ai-chat.php`:

```php
 * Version:           1.1.0
```
```php
define( 'RMU_AI_CHAT_VERSION', '1.1.0' );
```

> **หลักการตั้ง version (Semantic Versioning):** `MAJOR.MINOR.PATCH`
> - **PATCH** (`1.0.x`) — แก้ bug เล็กน้อย ไม่กระทบการใช้งาน
> - **MINOR** (`1.x.0`) — เพิ่ม feature ใหม่ ยังใช้งานร่วมกันได้
> - **MAJOR** (`x.0.0`) — เปลี่ยนแปลงใหญ่ อาจ breaking change

---

## 3. สร้าง ZIP สำหรับแจกจ่าย

ใช้ `git archive` แทน `wp-scripts plugin-zip` (ไม่มี node dependency) — ไฟล์ dev-only
(`README.md`, `RELEASE.md`, `.gitignore`, `.gitattributes`) ถูกตัดออกอัตโนมัติผ่าน
`export-ignore` ใน `.gitattributes`:

```bash
git archive --format=zip --prefix=rmu-ai-chat/ --output=rmu-ai-chat.zip HEAD
```

> ตรวจว่า commit ล่าสุดถูก push แล้วก่อนสร้าง zip เพราะ `git archive HEAD` ดึงจาก commit ที่ checkout อยู่

---

## 4. Commit และ Push

```bash
git add rmu-ai-chat.php includes/ assets/ readme.txt
git commit -m "release: v1.1.0"
git push origin master
```

---

## 5. สร้าง GitHub Release

```bash
gh release create v1.1.0 rmu-ai-chat.zip \
  --title "v1.1.0" \
  --notes "## สิ่งที่เปลี่ยนแปลง
- แก้ไข ...
- เพิ่ม ..."
```

> **สำคัญ:** Tag บน GitHub (`v1.1.0`) ต้องตรงกับ Version ใน `rmu-ai-chat.php` (`1.1.0`)
> ไม่งั้น `version_compare()` ใน `class-github-updater.php` จะเทียบเวอร์ชันผิด

---

## 6. ตรวจสอบ

หลัง Release เสร็จ WordPress ของเว็บปลายทางที่ติดตั้งปลั๊กอินนี้ไว้จะตรวจพบ update อัตโนมัติภายใน
**6 ชั่วโมง** (cache ของ `class-github-updater.php`)

หากต้องการให้ตรวจสอบทันที ไปที่:

```
/wp-admin/update-core.php?force-check=1
```

---

## สรุปคำสั่งทั้งหมด (Copy & Paste)

แทนที่ `1.1.0` ด้วย version จริงที่ต้องการ

```bash
git archive --format=zip --prefix=rmu-ai-chat/ --output=rmu-ai-chat.zip HEAD
git add rmu-ai-chat.php includes/ assets/ readme.txt
git commit -m "release: v1.1.0"
git push origin master
gh release create v1.1.0 rmu-ai-chat.zip --title "v1.1.0" --notes "## Changelog\n- "
```
