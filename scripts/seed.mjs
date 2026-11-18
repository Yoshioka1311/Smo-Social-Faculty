import {localEnvironment} from '../src/local-db.js';
import {hashPassword} from '../src/auth.js';
import {writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
const directory=resolve('.local');
const env=await localEnvironment(directory);
const credentials=[];
for(const [uid,email,kind,name] of [['local-student','student.test@student.mahidol.ac.th','student','นักศึกษาทดสอบ'],['local-student-2','another.test@student.mahidol.ac.th','student','นักศึกษาทดสอบคนที่สอง'],['local-admin','smo.local@mahidol.ac.th','admin','ผู้ดูแลสโมสร']]) {
  if(await env.DB.prepare('SELECT id FROM users WHERE id=?').bind(uid).first())continue;
  const password=`SH-${crypto.randomUUID().slice(0,8)}-${crypto.randomUUID().slice(0,8)}`;
  await env.DB.prepare('INSERT INTO users(id,email,kind,name,password,verified) VALUES(?,?,?,?,?,1)').bind(uid,email,kind,name,await hashPassword(password)).run();
  credentials.push({email,kind,password});
}
if(credentials.length){await writeFile(resolve('.local/accounts.json'),JSON.stringify(credentials,null,2));console.log('Local test accounts: .local/accounts.json');}
const seed=[
  ['sports-day','events',{title:'กีฬาสีสังคมศาสตร์ฯ',body:'ร่วมแข่งขันกีฬาและเป็นส่วนหนึ่งของทีมสโมสร เลือกสมัครชนิดกีฬาที่ถนัด หรือลงชื่อช่วยดูแลกิจกรรม\n\nกำหนดการ\n08.00 น. ลงทะเบียน\n09.00 น. เริ่มการแข่งขัน\n16.30 น. มอบรางวัล',image:'/assets/sports.svg',date:'2026-11-30',time:'08.00–17.30 น.',location:'สนามกีฬามหาวิทยาลัย',open:true,positions:[{name:'นักกีฬาฟุตบอล',capacity:18},{name:'นักกีฬาบาสเกตบอล',capacity:12},{name:'นักกีฬาแบดมินตัน',capacity:8},{name:'นักกีฬากรีฑา',capacity:12},{name:'ทีมเชียร์',capacity:30}]}],
  ['open-yard','events',{title:'SH Open Yard ตลาดนัดแบ่งปัน',body:'ชวนเพื่อนนำหนังสือและของใช้สภาพดีมาแลกเปลี่ยนกัน เปิดรับทีมงานช่วยดูแลพื้นที่และประสานงานร้านค้า',image:'/assets/yard.svg',date:'2026-11-12',time:'16.30–20.00 น.',location:'ลานอเนกประสงค์ อาคาร 3',open:true,positions:[{name:'ทีมลงทะเบียน',capacity:6},{name:'ทีมสถานที่',capacity:10},{name:'ทีมภาพถ่าย',capacity:4}]}],
  ['welfare-contact','welfare',{title:'ทุนการศึกษาและสวัสดิการ',body:'สอบถามข้อมูลการสมัครทุนและเอกสารประกอบได้ที่งานกิจการนักศึกษาของคณะ',image:'',date:''}],
];
for(const [uid,type,data] of seed)await env.DB.prepare('INSERT OR IGNORE INTO content(id,type,data) VALUES(?,?,?)').bind(uid,type,JSON.stringify(data)).run();
for(const [uid,name,category,total] of [['table','โต๊ะพับ','กิจกรรม & สถานที่',12],['basketball','ลูกบาสเกตบอล','กีฬา & นันทนาการ',6],['speaker','ลำโพงพกพา','เครื่องเสียง & อิเล็กทรอนิกส์',4]])await env.DB.prepare('INSERT OR IGNORE INTO inventory(id,name,category,total) VALUES(?,?,?,?)').bind(uid,name,category,total).run();
env.sqlite.close();console.log('Local database ready.');
