# สโมสรนักศึกษา สังคมศาสตร์และมนุษยศาสตร์ มหิดล

หน้าบ้านนักศึกษาและหลังบ้านสโม เชื่อมฐานข้อมูลในเครื่อง ข้อมูลไม่หายเมื่อรีเฟรช เตรียม adapter สำหรับ Cloudflare Workers, D1 และ R2

## เปิดใช้งาน

ใช้ Node.js 24 ขึ้นไป

```powershell
cd 'D:\Works\Web\SH SMO Student'
npm ci
npm run setup
npm run preview
```

- นักศึกษา: [http://127.0.0.1:4173/login](http://127.0.0.1:4173/login)
- สโมสร: [http://127.0.0.1:4173/admin/login](http://127.0.0.1:4173/admin/login)
- บัญชีทดสอบพร้อมรหัสสุ่มอยู่ `.local/accounts.json` เปิดไฟล์ในเครื่องเพื่อดู ห้ามนำไปใช้บนระบบจริง
- SQLite: `.local/club.sqlite` ไฟล์แนบ: `.local/files` ทุกไฟล์ใน .local อยู่ใน .gitignore

setup ไม่เขียนทับบัญชีหรือรหัสเดิม ข้อมูลตั้งต้นมีสองกิจกรรมและพัสดุสามรายการสำหรับทดลอง ข่าว เอกสาร และกรรมการเริ่มว่าง รูปกิจกรรมเป็นภาพวาดประกอบที่ทำในโปรเจกต์ ไม่มีการอ้างว่าเป็นภาพกิจกรรมจริง อาจมีรายการทดสอบจากการตรวจ UI เพิ่มอยู่ในฐาน local

## ฟังก์ชัน

ตอนนี้เปิดเข้าชมนักศึกษาและหลังบ้านสโมสรในเครื่องได้โดยไม่ login ตั้งค่าใน `.env` เป็น `TEMP_STUDENT_ACCESS=true` และ `TEMP_ADMIN_ACCESS=true` ผู้เข้าชมแต่ละเบราว์เซอร์ได้รับบัญชีทดลองแยกกัน หลังบ้านเข้าได้ที่ `/admin` และแก้ไขข้อมูลในฐาน local ได้จริง

เปิด login กลับโดยเปลี่ยน `TEMP_STUDENT_ACCESS=false` และ `TEMP_ADMIN_ACCESS=false` แล้ว restart server บัญชีชั่วคราวเดิมจะใช้ไม่ได้เมื่อปิดค่าของบทบาทนั้น ตัวเลือกนี้ใช้ได้เฉพาะ local loopback และปิดไว้ใน Cloudflare config คุกกี้หน้าบ้านและหลังบ้านแยกกันเพื่อเปิดทดสอบพร้อมกันได้

- สมัครด้วยอีเมลนักศึกษามหิดล รหัสผ่านสองช่อง และยืนยันอีเมลก่อน login
- Google OAuth พร้อม callback และหน้าตั้งรหัสผ่านหลังยืนยันตัวตน ต้องตั้งค่าบริการก่อนใช้จริง
- นักศึกษากับสโมสรเข้าคนละเส้นทางและใช้บัญชี/รหัสแยกกัน ไม่มี role switcher
- นักศึกษาดูเฉพาะประวัติยืมและใบสมัครของตน สโมตรวจหลักฐาน อนุมัติ ปฏิเสธพร้อมเหตุผล และรับคืนได้
- จัดการคลังพัสดุและจำนวนคงเหลือ ปฏิทินเต็มพื้นที่ รายละเอียดกิจกรรมพร้อมแบนเนอร์และตำแหน่งที่เปิดรับ
- จำนวนผู้สมัครดูได้เฉพาะสโม นักศึกษาเห็นจำนวนรับและผลสมัครของตน
- จัดการข่าวหลายภาพ เอกสาร preview/download กรรมการพร้อมภาพและลำดับ และสวัสดิการ
- เตรียม Instagram import พร้อม caption, carousel ทุกภาพ, video, Cron ทุก 15 นาที และสถานะข้อผิดพลาด
- Responsive และ Light/Dark mode

## ภาษาและเครื่องมือ

HTML5, CSS3 และ JavaScript ES modules หน้าบ้านเป็น Vanilla JavaScript ไม่มี React/Vue หรือ UI framework หลังบ้านใช้ JavaScript กับ Node.js HTTP server และ node:sqlite ส่วน cloud ใช้ Workers API, D1, R2 โดยมี Wrangler CLI เป็น development dependency

```powershell
npm test
npm run cloudflare:check
```

ดู [ARCHITECTURE.md](ARCHITECTURE.md) และ [SETUP-CLOUDFLARE.md](SETUP-CLOUDFLARE.md) สำหรับรายละเอียด auth, การสร้างบัญชีสโม และการตั้งค่าบริการ

## สถานะการเชื่อมต่อ

ยังไม่ได้เชื่อม Google, บริการส่งเมล หรือ Instagram กับบัญชีจริง และยังไม่ได้ deploy Cloudflare คัดลอก `.env.example` เป็น `.env` เพื่อใส่ค่าของสโมสรในเครื่อง บน cloud ใช้ secrets ห้าม commit .env หรือ .local

ในเครื่อง signup เขียนลิงก์ยืนยันไว้ `.local/last-verification.json` แทนการส่งเมลจริง ผู้พัฒนาเปิดไฟล์และลิงก์เพื่อทดสอบได้ ไม่มี endpoint public ที่อ่านไฟล์นี้

ข้อความเกี่ยวกับการพัฒนาและ mock labels ย้ายมาอยู่ในคู่มือ ข้อมูลหลักสูตรย่อมาจาก [Mahidol Open House](https://openhouse.mahidol.ac.th/faculties/sh/) ส่วนต้นแบบเดิมสำรองไว้ `work/legacy` ซึ่งไม่ถูกเสิร์ฟขึ้นเว็บและไม่รวมใน Git
