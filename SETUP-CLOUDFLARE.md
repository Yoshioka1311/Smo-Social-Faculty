# เตรียมใช้งานกับบัญชีสโมสร

ยังไม่ได้สร้างทรัพยากรหรือ deploy ภายนอก

## Cloudflare

1. `npm ci` แล้ว login Cloudflare ด้วยบัญชีสโมสร
2. สร้าง D1 และ R2 ใส่ database_id, database_name, bucket_name และ APP_URL จริงใน wrangler.jsonc
3. `npx wrangler d1 migrations apply sh-student-club --remote`
4. สร้าง SQL บัญชี admin ด้วย scripts/create-account.mjs --sql แล้วใช้ wrangler d1 execute --remote --file นำไฟล์เข้า D1
5. ตั้ง secrets ผ่าน `npx wrangler secret put NAME` ห้าม commit หรือใส่ใน public/
6. `npm run cloudflare:check` จากนั้น deploy เมื่อได้รับอนุญาต

บัญชีและข้อมูลตัวอย่างจาก npm run setup อยู่ local เท่านั้น ไม่ย้ายไป D1 อัตโนมัติ เพิ่มข้อมูลจริงผ่านหน้าแอดมิน

## สร้างบัญชีสโม

กำหนด environment variables ใน PowerShell ด้วยค่าของตนเอง

```powershell
$env:ACCOUNT_EMAIL = 'อีเมลผู้ดูแล'
$env:ACCOUNT_NAME = 'ชื่อผู้ดูแล'
$env:ACCOUNT_KIND = 'admin'
$env:ACCOUNT_PASSWORD = 'รหัสใหม่อย่างน้อย 12 ตัวอักษร'
node scripts/create-account.mjs --sql
```

ไฟล์ .local/provision-account.sql มี password hash ต้องเก็บเหมือน credential ห้าม commit ตัด --sql ออกเพื่อสร้างบัญชีใน local โดยตรง ไม่มีรหัสสโมกลางที่ให้ใครกรอกแล้วเปิดสิทธิ์

## Google และอีเมล

ตั้ง Google OAuth client แบบ Web application พร้อม redirect URI `https://โดเมนจริง/api/auth/google/callback` สำหรับ local ใช้ `http://127.0.0.1:4173/api/auth/google/callback`

Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ต้องทดสอบ consent และข้อจำกัดองค์กรจริง ระบบตรวจ email_verified และโดเมนจาก server-side userinfo

Google ของนักศึกษาใช้ @student.mahidol.edu ส่วน @student.mahidol.ac.th เป็น Microsoft และอาจใช้ Google ไม่ได้ จึงมี email verification แยกไว้

บริการยืนยันเมลเตรียมใช้ Resend ตั้ง RESEND_API_KEY และ MAIL_FROM จากโดเมนผู้ส่งที่ยืนยันแล้ว ใน local เท่านั้นจะเขียนลิงก์ไป .local/last-verification.json แทนส่งจริง Workers ตั้ง LOCAL_DEV=false และไม่มี DEV_MAIL binding

## Instagram

ใช้ Instagram API with Facebook Login กับบัญชี Professional ที่เชื่อม Facebook Page ตามเงื่อนไข Meta ตั้ง IG_ACCESS_TOKEN, IG_USER_ID เป็น secrets และ IG_GRAPH_VERSION ตาม version ที่แอปรองรับ ค่าเริ่มต้น v24.0 ต้องตรวจอายุ version ก่อนเผยแพร่

แอปต้องมีสิทธิ์อ่าน media ตาม flow เช่น instagram_basic, pages_show_list และ pages_read_engagement เจ้าของบัญชีต้องตรวจใน Meta Dashboard

ปุ่มซิงก์หลังบ้านและ Cron ทุก 15 นาทีอ่าน caption, media, children ของ carousel เก็บรูป/วิดีโอลง R2 และ upsert ด้วย media ID จึงไม่เกิดข่าวซ้ำ Node local มี timer 15 นาทีเมื่อใส่ค่า IG แล้ว

ข้อจำกัด import: 250 โพสต์ต่อรอบ, carousel ไม่เกิน 100 รายการ, file ไม่เกิน 25 MB หากเกินจะบันทึก error ให้ตรวจ ไม่ตัดทิ้งเงียบๆ การซิงก์มีความหน่วงได้ 15 นาที ไม่ได้ใช้ webhook และไม่ลบข่าวตามเมื่อ IG ลบโพสต์ ผู้ดูแลต้องจัดการ token renewal/rotation ตาม Meta flow

ยังไม่เรียก API กับบัญชีจริง ต้องตรวจ permissions, token, ภาพหลายภาพ, video และการซิงก์กับโพสต์จริงก่อนเปิดใช้ ไม่มี scraping หรือการเก็บรหัสผ่าน IG

## แหล่งข้อมูล

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Google OAuth Web Server](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Meta Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [อีเมลนักศึกษามหิดล](https://www.rama.mahidol.ac.th/ceb/sites/default/files/public/pdf/Mahidol%20G-Suite.pdf)
- [ข้อมูลหลักสูตร](https://openhouse.mahidol.ac.th/faculties/sh/)
