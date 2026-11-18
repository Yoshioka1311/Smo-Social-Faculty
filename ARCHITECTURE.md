# โครงสร้างระบบ

```text
public/index.html + public/assets/main.js + public/assets/app.css
    fetch /api/* + HttpOnly session cookie
        src/api.js
            DB: SQLite ในเครื่อง / D1 บน Cloudflare
            FILES: .local/files / R2

server.mjs              Node.js HTTP adapter
src/worker.js           Cloudflare adapter + scheduled handler
src/auth.js             การตรวจอีเมลและ password hashing
migrations/0001.sql     โครงฐานข้อมูล SQLite/D1
scripts/seed.mjs        บัญชีและข้อมูลทดสอบ local
scripts/create-account.mjs  สร้างบัญชีสโมหรือ SQL สำหรับ D1
```

บัญชี student กับ admin แยก record และรหัสผ่าน แม้อีเมลเดียวกันได้ แอดมินไม่มี self-registration หน้า /login ใช้ kind student ส่วน /admin/login ใช้ kind admin API ตรวจ kind จาก session ทุก endpoint ใต้ /api/admin/

Session token สุ่ม 256 บิต เก็บ SHA-256 digest ในฐานข้อมูล อายุ 8 ชั่วโมง cookie เป็น HttpOnly, SameSite=Lax และ Secure เมื่อใช้ HTTPS รหัสผ่านใช้ PBKDF2 SHA-256 100,000 รอบพร้อม salt สุ่ม

API ค้นคำขอยืมและใบสมัครด้วย user_id จาก session ไม่รับ owner จากฟอร์ม หลักฐานแนบ private เปิดได้เฉพาะเจ้าของกับแอดมิน ตรวจ signature ของ PDF/PNG/JPG และขนาด 5 MB ก่อนบันทึก API ที่เปลี่ยนข้อมูลตรวจ Origin เทียบ APP_URL มี rate limit ใน signup/login

การอนุมัติใช้ SQL UPDATE ที่ตรวจ stock หรือ capacity ใน statement เดียว จำนวนยืมหักจนกดรับคืน ยังไม่ได้จัดสรร stock ตามช่วงวันแบบ booking

## สมัครและ Google

สมัครด้วยอีเมล → รหัสผ่านสองช่อง → ลิงก์ยืนยัน 30 นาที → เข้าสู่ระบบ

Google authorization code → ตรวจ state cookie และ record ใช้ครั้งเดียว → userinfo จาก Google → ตรวจ email_verified และโดเมน → ตั้งรหัสผ่านเว็บสองครั้ง → ใช้งาน

บัญชีที่ยังไม่ยืนยันและกลับมาเข้าด้วย Google จะถูกล้างรหัสผ่านเก่าก่อนยืนยัน ป้องกันผู้อื่น preregister อีเมลเหยื่อ ระบบไม่ขอรหัสผ่านมหาวิทยาลัย

รับ student.mahidol.ac.th และ student.mahidol.edu แบบตรงตัว การมีเมลมหาวิทยาลัยไม่ได้ยืนยันว่ากำลังเรียนหรือสังกัดคณะ หากต้องบังคับสองข้อนี้ต้องเชื่อมทะเบียนหรือเพิ่มการอนุมัติ

## ขอบเขตการตรวจ

มี tests ของโดเมน รหัสผ่าน การแยกข้อมูลสองนักศึกษา การป้องกัน admin endpoint, CSRF, private file, จำนวนพัสดุ, capacity และเหตุผลปฏิเสธ พร้อมตรวจ UI ใน local ยังไม่ใช่ security audit หรือการรับรอง production

ก่อนเผยแพร่ต้องตรวจบริการจริง HTTPS/cookie, provider permissions, โหลด, backup, การกู้บัญชี/เปลี่ยนรหัสผ่าน/ปิดบัญชี, malware scanning และนโยบายเก็บข้อมูลของสโมสร ปัจจุบัน account recovery และการจัดการบัญชีใช้ผู้ดูแลและเครื่องมือภายนอก UI
