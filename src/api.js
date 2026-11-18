import {allowedEmail,normalizeEmail,passwordError,hashPassword,verifyPassword,token,digest} from './auth.js';

export const json=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=500)=>String(v??'').trim().slice(0,max);
const id=()=>crypto.randomUUID();
const now=()=>Date.now();
const one=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).first();
const all=async(env,sql,...args)=>(await env.DB.prepare(sql).bind(...args).all()).results;
const run=(env,sql,...args)=>env.DB.prepare(sql).bind(...args).run();
const isGuest=user=>user?.id?.startsWith('guest-')===true;
const guestAccessEnabled=(request,env,kind='student')=>env.LOCAL_DEV==='true'&&env[kind==='admin'?'TEMP_ADMIN_ACCESS':'TEMP_STUDENT_ACCESS']==='true'&&['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname);
const previewAdminRequested=request=>request.headers.get('X-SH-View')==='admin'||new URL(request.url).searchParams.get('view')==='admin';
const safeUser=u=>u?{id:u.id,email:u.email,name:u.name,kind:u.kind,studentId:u.student_id,phone:u.phone,needsPassword:!u.password,guest:isGuest(u)}:null;
const cookie=(request,value,maxAge,name='sh_session')=>`${name}=${value}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol==='https:'?'; Secure':''}`;
const redirect=(url,headers={})=>new Response(null,{status:302,headers:{Location:url,...headers}});

async function sessionUser(request,env) {
  const adminCookie=previewAdminRequested(request)&&guestAccessEnabled(request,env,'admin')?request.headers.get('Cookie')?.match(/(?:^|;\s*)sh_preview_admin=([a-f0-9]{64})(?:;|$)/)?.[1]:null;
  const raw=adminCookie||request.headers.get('Cookie')?.match(/(?:^|;\s*)sh_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!raw)return null;
  const user=await one(env,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?',await digest(raw),now());
  return isGuest(user)&&!guestAccessEnabled(request,env,user.kind)?null:user;
}
async function startSession(request,env,user,cookieName='sh_session') {
  const raw=token();
  await run(env,'INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',await digest(raw),user.id,now()+8*3600000);
  return cookie(request,raw,8*3600,cookieName);
}
async function limit(env,key,max=10) {
  await run(env,'INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END',key,now()+900000,now(),now());
  const item=await one(env,'SELECT count FROM rate_limits WHERE key=?',key);
  if(item.count>max)fail('ลองใหม่อีกครั้งใน 15 นาที',429);
}
async function sendVerification(env,email,url) {
  if(env.LOCAL_DEV==='true' && env.DEV_MAIL) {await env.DEV_MAIL(email,url);return;}
  if(!env.RESEND_API_KEY||!env.MAIL_FROM)fail('ยังไม่ได้ตั้งค่าบริการส่งอีเมล กรุณาติดต่อผู้ดูแล',503);
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:env.MAIL_FROM,to:[email],subject:'ยืนยันอีเมล สโมสรนักศึกษา สังคมศาสตร์ฯ',text:`เปิดลิงก์เพื่อยืนยันอีเมลภายใน 30 นาที\n${url}`})});
  if(!response.ok)fail('ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่ภายหลัง',502);
}
export async function inventoryList(env) {
  return all(env,"SELECT i.*,i.total-COALESCE((SELECT SUM(l.qty) FROM loans l WHERE l.item_id=i.id AND l.status='approved'),0) AS available FROM inventory i WHERE i.active=1 ORDER BY i.name");
}
async function contentList(env,type) {
  return (await all(env,'SELECT id,data FROM content WHERE type=? ORDER BY updated DESC',type)).map(row=>({id:row.id,...JSON.parse(row.data)}));
}
const allowedTypes=new Set(['news','events','documents','committee','welfare']);
async function saveContent(env,type,data,contentId=id()) {
  await run(env,'INSERT INTO content(id,type,data,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,updated=excluded.updated',contentId,type,JSON.stringify(data),new Date().toISOString());
  return contentId;
}
function validateContent(type,input) {
  if(!allowedTypes.has(type))fail('ไม่พบหมวดหมู่');
  const data={title:text(input.title,160),body:text(input.body,10000),image:text(input.image,400),date:text(input.date,30)};
  if(!data.title)fail('กรุณาระบุชื่อรายการ');
  if(data.image&&!/^\/api\/files\/[a-f0-9-]+$|^\/assets\/[a-z0-9-]+\.svg$/.test(data.image))fail('กรุณาอัปโหลดรูปภาพผ่านระบบ');
  if(type==='events') {
    data.date=text(input.date,10);data.time=text(input.time,100);data.location=text(input.location,200);
    data.positions=(Array.isArray(input.positions)?input.positions:[]).map(p=>({name:text(p.name,80),capacity:Number(p.capacity)}));
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||Number.isNaN(Date.parse(data.date)))fail('กรุณาเลือกวันที่กิจกรรม');
    if(!data.positions.length||data.positions.some(p=>!p.name||!Number.isInteger(p.capacity)||p.capacity<1||p.capacity>9999))fail('ระบุตำแหน่งและจำนวนรับ 1–9999 คน');
    if(new Set(data.positions.map(p=>p.name)).size!==data.positions.length)fail('ชื่อตำแหน่งต้องไม่ซ้ำกัน');
    data.open=input.open!==false;
  }
  if(type==='documents')data.file=text(input.file,400);
  if(type==='news')data.media=(Array.isArray(input.media)?input.media:[]).map(m=>({url:text(m.url,400),type:text(m.type,80)})).filter(m=>/^\/api\/files\/[a-zA-Z0-9-]+$/.test(m.url));
  if(type==='committee'){data.position=text(input.position,100);data.level=Number(input.level)||1;data.order=Number(input.order)||0;}
  return data;
}

export async function handleApi(request,env) {
  try {
    const url=new URL(request.url), path=url.pathname, method=request.method;
    const base=env.APP_URL||url.origin;
    if(method!=='GET'&&method!=='HEAD'&&request.headers.get('Origin')!==new URL(base).origin)fail('ไม่อนุญาตคำขอจากเว็บไซต์นี้',403);
    if(Number(request.headers.get('Content-Length')||0)>6*1024*1024)fail('ข้อมูลมีขนาดใหญ่เกินไป',413);
    const clientIp=request.headers.get('CF-Connecting-IP')||'local';
    if(path==='/api/auth/config')return json({google:!!env.GOOGLE_CLIENT_ID,local:env.LOCAL_DEV==='true',guestAccess:guestAccessEnabled(request,env),adminPreview:guestAccessEnabled(request,env,'admin'),domains:['student.mahidol.ac.th','student.mahidol.edu']});
    if(path==='/api/auth/preview-admin'&&method==='POST') {
      if(!guestAccessEnabled(request,env,'admin'))fail('ไม่ได้เปิดการเข้าหลังบ้านชั่วคราว',403);
      const existing=await sessionUser(request,env);
      if(existing?.kind==='admin')return json({user:safeUser(existing)});
      await limit(env,`preview-admin:${clientIp}`,30);
      const uid=`guest-admin-${id()}`;
      await run(env,"INSERT INTO users(id,email,kind,name,password,verified) VALUES(?,?,'admin',?,?,1)",uid,`${uid}@preview.invalid`,'ผู้ดูแลทดสอบ',await hashPassword(token()));
      const admin=await one(env,'SELECT * FROM users WHERE id=?',uid);
      return json({user:safeUser(admin)},201,{'Set-Cookie':await startSession(request,env,admin,'sh_preview_admin')});
    }
    if(path==='/api/auth/guest'&&method==='POST') {
      if(!guestAccessEnabled(request,env))fail('ไม่ได้เปิดการเข้าชมชั่วคราว',403);
      const existing=await sessionUser(request,env);
      if(existing)return json({user:safeUser(existing)});
      await limit(env,`guest:${clientIp}`,30);
      const uid=`guest-${id()}`;
      // A separate visitor account preserves ownership; never impersonate a seeded student.
      await run(env,"INSERT INTO users(id,email,kind,name,password,verified) VALUES(?,?,'student',?,?,1)",uid,`${uid}@preview.invalid`,'ผู้เข้าชม',await hashPassword(token()));
      const guest=await one(env,'SELECT * FROM users WHERE id=?',uid);
      return json({user:safeUser(guest)},201,{'Set-Cookie':await startSession(request,env,guest)});
    }
    if(path==='/api/auth/google/start') {
      if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET)return redirect('/login?error=google-not-configured');
      const state=token();await run(env,'INSERT INTO oauth_states VALUES(?,?)',await digest(state),now()+600000);
      const target=new URL('https://accounts.google.com/o/oauth2/v2/auth');
      Object.entries({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:`${base}/api/auth/google/callback`,response_type:'code',scope:'openid email profile',state,prompt:'select_account'}).forEach(([k,v])=>target.searchParams.set(k,v));
      return redirect(target.href,{'Set-Cookie':`sh_oauth=${state}; HttpOnly; Path=/api/auth/google; SameSite=Lax; Max-Age=600${url.protocol==='https:'?'; Secure':''}`});
    }
    if(path==='/api/auth/google/callback') {
      const state=url.searchParams.get('state')||'',saved=request.headers.get('Cookie')?.match(/(?:^|;\s*)sh_oauth=([a-f0-9]{64})/)?.[1];
      if(!saved||saved!==state)fail('การยืนยัน Google หมดอายุ',403);
      const deleted=await run(env,'DELETE FROM oauth_states WHERE token=? AND expires>?',await digest(state),now());
      if(deleted.meta.changes!==1)fail('การยืนยัน Google หมดอายุ',403);
      const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({code:url.searchParams.get('code')||'',client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,redirect_uri:`${base}/api/auth/google/callback`,grant_type:'authorization_code'})});
      const data=await response.json();if(!response.ok||!data.access_token)fail('ยืนยัน Google ไม่สำเร็จ',401);
      const infoResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${data.access_token}`}});
      const info=await infoResponse.json(),email=normalizeEmail(info.email);
      if(!infoResponse.ok||info.email_verified!==true||!allowedEmail(email))return redirect('/login?error=university-email');
      let user=await one(env,"SELECT * FROM users WHERE email=? AND kind='student'",email);
      if(!user){const uid=id();await run(env,"INSERT INTO users(id,email,kind,name,verified) VALUES(?,?,'student',?,1)",uid,email,text(info.name,100));user=await one(env,'SELECT * FROM users WHERE id=?',uid);}
      else if(!user.verified){await run(env,'UPDATE users SET verified=1,password=NULL WHERE id=?',user.id);user.verified=1;user.password=null;}
      return redirect(user.password?'/':'/login?setup=1',{'Set-Cookie':await startSession(request,env,user)});
    }
    if(path==='/api/auth/register'&&method==='POST') {
      await limit(env,`register:${clientIp}`,8);
      if(env.LOCAL_DEV!=='true'&&!env.RESEND_API_KEY)fail('ยังไม่ได้เปิดบริการสมัครด้วยอีเมล กรุณาติดต่อผู้ดูแล',503);
      const b=await request.json(),email=normalizeEmail(b.email),error=passwordError(b.password,b.confirm);
      if(!allowedEmail(email))fail('กรุณาใช้อีเมลนักศึกษามหิดล');if(error)fail(error);if(!text(b.name,100))fail('กรุณาระบุชื่อ-นามสกุล');
      let user=await one(env,"SELECT * FROM users WHERE email=? AND kind='student'",email);
      if(user?.verified)return json({message:'หากอีเมลนี้สมัครได้ ระบบจะส่งลิงก์ยืนยันให้'});
      if(!user){const uid=id();await run(env,"INSERT INTO users(id,email,kind,name,password) VALUES(?,?,'student',?,?)",uid,email,text(b.name,100),await hashPassword(b.password));user={id:uid};}
      else {await run(env,'UPDATE users SET name=?,password=? WHERE id=?',text(b.name,100),await hashPassword(b.password),user.id);}
      await run(env,'DELETE FROM verification WHERE user_id=?',user.id);
      const raw=token();await run(env,'INSERT INTO verification VALUES(?,?,?)',await digest(raw),user.id,now()+1800000);
      await sendVerification(env,email,`${base}/api/auth/verify?token=${raw}`);
      return json({message:'ส่งลิงก์ยืนยันอีเมลแล้ว กรุณาตรวจกล่องจดหมาย'});
    }
    if(path==='/api/auth/verify') {
      const item=await one(env,'SELECT * FROM verification WHERE token=? AND expires>?',await digest(url.searchParams.get('token')||''),now());
      if(!item)return redirect('/login?error=expired');
      await run(env,'UPDATE users SET verified=1 WHERE id=?',item.user_id);await run(env,'DELETE FROM verification WHERE user_id=?',item.user_id);
      return redirect('/login?verified=1');
    }
    if(path==='/api/auth/login'&&method==='POST') {
      const b=await request.json(),email=normalizeEmail(b.email),kind=b.kind==='admin'?'admin':'student';
      await limit(env,`login:${clientIp}:${email}:${kind}`,10);
      const user=await one(env,'SELECT * FROM users WHERE email=? AND kind=?',email,kind);
      const valid=await verifyPassword(String(b.password||''),user?.password);
      if(!valid||!user?.verified)fail('อีเมลหรือรหัสผ่านไม่ถูกต้อง หรืออีเมลยังไม่ยืนยัน',401);
      return json({user:safeUser(user) },200,{'Set-Cookie':await startSession(request,env,user)});
    }
    const user=await sessionUser(request,env);
    if(path==='/api/auth/me')return json({user:safeUser(user)});
    if(path==='/api/auth/logout'&&method==='POST') {
      const cookieName=previewAdminRequested(request)&&request.headers.get('Cookie')?.includes('sh_preview_admin=')?'sh_preview_admin':'sh_session';
      const raw=request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`))?.[1];
      if(raw)await run(env,'DELETE FROM sessions WHERE token=?',await digest(raw));
      return json({ok:true},200,{'Set-Cookie':cookie(request,'',0,cookieName)});
    }
    if(path==='/api/auth/password'&&method==='POST') {
      if(!user||user.password)fail('ไม่สามารถตั้งรหัสผ่านได้',403);
      const b=await request.json(),error=passwordError(b.password,b.confirm);if(error)fail(error);
      await run(env,'UPDATE users SET password=? WHERE id=?',await hashPassword(b.password),user.id);return json({ok:true});
    }
    if(!user||!user.password)fail('กรุณาเข้าสู่ระบบ',401);
    if(path.startsWith('/api/admin/')&&user.kind!=='admin')fail('เฉพาะกรรมการสโมสรเท่านั้น',403);
    if(path==='/api/profile'&&method==='POST') {
      const b=await request.json();if(!text(b.name,100))fail('กรุณาระบุชื่อ');
      await run(env,'UPDATE users SET name=?,student_id=?,phone=? WHERE id=?',text(b.name,100),text(b.studentId,10),text(b.phone,20),user.id);return json({ok:true});
    }
    if(path==='/api/data') {
      const result={};for(const type of allowedTypes)result[type]=await contentList(env,type);
      result.inventory=await inventoryList(env);
      result.loans=await all(env,'SELECT l.*,i.name AS item_name FROM loans l JOIN inventory i ON i.id=l.item_id WHERE l.user_id=? ORDER BY l.created DESC',user.id);
      result.applications=await all(env,'SELECT * FROM applications WHERE user_id=? ORDER BY created DESC',user.id);
      return json(result);
    }
    if(path==='/api/files'&&method==='POST') {
      const form=await request.formData(),file=form.get('file'),scope=user.kind==='admin'&&form.get('scope')==='public'?'public':'private';
      if(!file||typeof file==='string'||!file.size||file.size>5*1024*1024)fail('เลือกไฟล์ขนาดไม่เกิน 5 MB');
      const bytes=new Uint8Array(await file.arrayBuffer());let mime='';
      if(bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)mime='image/png';
      if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)mime='image/jpeg';
      if(new TextDecoder().decode(bytes.slice(0,5))==='%PDF-')mime='application/pdf';
      if(!mime)fail('รองรับไฟล์ PDF, PNG และ JPG เท่านั้น');
      const fileId=id();await env.FILES.put(fileId,bytes,{httpMetadata:{contentType:mime}});
      await run(env,'INSERT INTO files VALUES(?,?,?,?,?)',fileId,user.id,text(file.name,150),mime,scope);
      return json({id:fileId,url:`/api/files/${fileId}`,name:text(file.name,150),mime});
    }
    if(path.startsWith('/api/files/')&&method==='GET') {
      const file=await one(env,'SELECT * FROM files WHERE id=?',path.split('/').pop());
      if(!file||(file.scope==='private'&&file.owner!==user.id&&user.kind!=='admin'))fail('ไม่พบไฟล์',404);
      const object=await env.FILES.get(file.id);if(!object)fail('ไม่พบไฟล์',404);
      return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':`${url.searchParams.has('download')?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"sandbox; default-src 'none'"}});
    }
    if(path==='/api/loans'&&method==='POST') {
      const b=await request.json(),qty=Number(b.qty),start=text(b.startDate,10),end=text(b.endDate,10);
      if(!Number.isInteger(qty)||qty<1||qty>100||!text(b.purpose,1000))fail('ระบุจำนวนและวัตถุประสงค์');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||end<start||start<new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'}))fail('กรุณาตรวจสอบวันที่ยืมและวันคืน');
      if(!user.name||!/^\d{7,10}$/.test(text(b.studentId))||!/^\d{9,10}$/.test(text(b.phone).replaceAll('-','')))fail('กรอกรหัสนักศึกษาและเบอร์โทรให้ครบ');
      const item=(await inventoryList(env)).find(i=>i.id===b.itemId);if(!item||qty>item.available)fail('จำนวนพัสดุคงเหลือไม่เพียงพอ');
      const attachment=await one(env,"SELECT id FROM files WHERE id=? AND owner=? AND scope='private'",b.attachment,user.id);if(!attachment)fail('กรุณาแนบหลักฐาน');
      if(b.borrowerType==='external'&&!text(b.affiliation,200))fail('กรุณาระบุสังกัด');
      await run(env,'UPDATE users SET student_id=?,phone=? WHERE id=?',text(b.studentId,10),text(b.phone,20),user.id);
      const loanId=id();await run(env,'INSERT INTO loans(id,user_id,item_id,qty,start_date,end_date,purpose,affiliation,attachment) VALUES(?,?,?,?,?,?,?,?,?)',loanId,user.id,item.id,qty,start,end,text(b.purpose,1000),b.borrowerType==='external'?text(b.affiliation,200):'คณะสังคมศาสตร์และมนุษยศาสตร์',attachment.id);
      return json({id:loanId},201);
    }
    if(path==='/api/applications'&&method==='POST') {
      const b=await request.json(),event=await one(env,"SELECT data FROM content WHERE id=? AND type='events'",b.eventId);if(!event)fail('ไม่พบกิจกรรม');
      const eventData=JSON.parse(event.data);if(!eventData.open||!eventData.positions.some(p=>p.name===b.position))fail('กิจกรรมไม่ได้เปิดรับตำแหน่งนี้');
      if(!/^\d{7,10}$/.test(text(b.studentId))||!/^\d{9,10}$/.test(text(b.phone)))fail('กรอกรหัสนักศึกษาและเบอร์โทรให้ครบ');
      if(await one(env,'SELECT id FROM applications WHERE user_id=? AND event_id=? AND position=?',user.id,b.eventId,b.position))fail('คุณสมัครตำแหน่งนี้แล้ว');
      const applicationId=id();await run(env,'INSERT INTO applications(id,user_id,event_id,position,note) VALUES(?,?,?,?,?)',applicationId,user.id,b.eventId,text(b.position,80),text(b.note,1000));
      await run(env,'UPDATE users SET student_id=?,phone=? WHERE id=?',text(b.studentId,10),text(b.phone,20),user.id);return json({id:applicationId},201);
    }
    if(path==='/api/admin/data') {
      return json({loans:await all(env,'SELECT l.*,u.name,u.email,u.phone,u.student_id,i.name AS item_name FROM loans l JOIN users u ON u.id=l.user_id JOIN inventory i ON i.id=l.item_id ORDER BY l.created DESC'),applications:await all(env,'SELECT a.*,u.name,u.email,u.phone,u.student_id FROM applications a JOIN users u ON u.id=a.user_id ORDER BY a.created DESC'),inventory:await all(env,'SELECT * FROM inventory ORDER BY name'),integration:{configured:!!(env.IG_ACCESS_TOKEN&&env.IG_USER_ID),...(await one(env,'SELECT * FROM integration_log WHERE id=1')||{})}});
    }
    if(path==='/api/admin/inventory'&&method==='POST') {
      const b=await request.json(),total=Number(b.total);if(!text(b.name,100)||!Number.isInteger(total)||total<0||total>99999)fail('กรอกชื่อและจำนวนพัสดุให้ถูกต้อง');
      const categories=['กิจกรรม & สถานที่','กีฬา & นันทนาการ','เครื่องเสียง & อิเล็กทรอนิกส์'];if(!categories.includes(b.category))fail('เลือกหมวดหมู่');
      const itemId=b.id||id(),reserved=await one(env,"SELECT COALESCE(SUM(qty),0) AS qty FROM loans WHERE item_id=? AND status='approved'",itemId);if(total<reserved.qty)fail('จำนวนรวมต้องไม่น้อยกว่าจำนวนที่อนุมัติยืมอยู่');
      await run(env,'INSERT INTO inventory(id,name,category,total) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,total=excluded.total',itemId,text(b.name,100),b.category,total);return json({ok:true});
    }
    if(path==='/api/admin/content'&&method==='POST') {
      const b=await request.json(),data=validateContent(b.type,b.data),contentId=b.id||id();
      if(b.type==='documents'&&!/^\/api\/files\/[a-zA-Z0-9-]+$/.test(data.file))fail('กรุณาอัปโหลดเอกสาร');
      const fileLinks=[data.file,data.image,...(data.media||[]).map(m=>m.url)].filter(v=>v?.startsWith('/api/files/'));
      for(const link of fileLinks){const stored=await one(env,"SELECT id FROM files WHERE id=? AND scope='public'",link.split('/').pop());if(!stored)fail('ไม่พบไฟล์สำหรับเผยแพร่');}
      const existing=await one(env,'SELECT type FROM content WHERE id=?',contentId);if(existing&&existing.type!==b.type)fail('หมวดหมู่ไม่ตรงกัน');
      await saveContent(env,b.type,data,contentId);return json({id:contentId});
    }
    if(path==='/api/admin/review'&&method==='POST') {
      const b=await request.json(),reason=text(b.reason,1000);if(!['approved','rejected','returned'].includes(b.status))fail('สถานะไม่ถูกต้อง');if(b.status==='rejected'&&!reason)fail('กรุณาระบุเหตุผลที่ไม่ผ่าน');
      if(b.type==='loan') {
        let result;
        if(b.status==='approved')result=await run(env,"UPDATE loans SET status='approved',reason='' WHERE id=? AND status='pending' AND qty<=(SELECT total FROM inventory WHERE id=loans.item_id)-(SELECT COALESCE(SUM(x.qty),0) FROM loans x WHERE x.item_id=loans.item_id AND x.status='approved')",b.id);
        else result=await run(env,'UPDATE loans SET status=?,reason=? WHERE id=? AND status=?',b.status,reason,b.id,b.status==='returned'?'approved':'pending');
        if(result.meta.changes!==1)fail('ไม่สามารถเปลี่ยนสถานะได้ พัสดุอาจไม่พอหรือรายการถูกตรวจแล้ว',409);
      } else {
        if(b.status==='returned')fail('สถานะไม่ถูกต้อง');
        const application=await one(env,'SELECT * FROM applications WHERE id=?',b.id);if(!application)fail('ไม่พบใบสมัคร',404);
        const event=await one(env,"SELECT data FROM content WHERE id=? AND type='events'",application.event_id),position=event&&JSON.parse(event.data).positions.find(p=>p.name===application.position);
        if(!position)fail('ไม่พบตำแหน่งในกิจกรรม');
        const result=await run(env,"UPDATE applications SET status=?,reason=? WHERE id=? AND status='pending' AND (?='rejected' OR (SELECT COUNT(*) FROM applications x WHERE x.event_id=applications.event_id AND x.position=applications.position AND x.status='approved')<?)",b.status,reason,b.id,b.status,position.capacity);
        if(result.meta.changes!==1)fail('ตำแหน่งเต็มหรือใบสมัครได้รับการตรวจแล้ว',409);
      }
      return json({ok:true});
    }
    if(path==='/api/admin/instagram/sync'&&method==='POST')return json(await syncInstagram(env,user.id));
    fail('ไม่พบข้อมูล',404);
  }catch(error){if(!error.status)console.error('API error:',error.message);return json({error:error.status?error.message:'ไม่สามารถทำรายการได้ กรุณาลองใหม่'},error.status||500);}
}

// Facebook Login route: professional Instagram account linked to a Facebook Page.
// Tokens are server secrets. Captions and carousel children come from the official Graph API.
export async function syncInstagram(env,ownerId) {
  if(!env.IG_ACCESS_TOKEN||!env.IG_USER_ID)fail('ยังไม่ได้เชื่อมบัญชี Instagram',503);
  const version=env.IG_GRAPH_VERSION||'v24.0';
  const endpoint=new URL(`https://graph.facebook.com/${version}/${env.IG_USER_ID}/media`);
  endpoint.searchParams.set('fields','id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children.limit(100){id,media_type,media_url,thumbnail_url}');endpoint.searchParams.set('limit','25');
  let next=endpoint.href,count=0,pages=0;
  try {
    while(next&&pages++<10) {
      if(new URL(next).hostname!=='graph.facebook.com')throw new Error('Unexpected API host');
      const response=await fetch(next,{headers:{Authorization:`Bearer ${env.IG_ACCESS_TOKEN}`}}),body=await response.json();if(!response.ok)throw new Error('Instagram API rejected credentials or permissions');
      for(const post of body.data||[]) {
        const media=[];
        let children=post.children?.data||[post];
        if(post.children?.paging?.next)throw new Error('Carousel exceeds import limit; manual review required');
        for(const child of children) {
          const mediaUrl=child.media_url||child.thumbnail_url;if(!mediaUrl)throw new Error('Media URL missing');
          const remote=new URL(mediaUrl);if(remote.protocol!=='https:'||!/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(remote.hostname))throw new Error('Unexpected media host');
          const fileResponse=await fetch(mediaUrl,{redirect:'error'});if(!fileResponse.ok)throw new Error('Cannot download Instagram media');
          const mime=fileResponse.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','video/mp4'].includes(mime))throw new Error('Unsupported media');
          const buffer=await fileResponse.arrayBuffer();if(buffer.byteLength>25*1024*1024)throw new Error('Instagram media exceeds 25 MB');
          const mediaId=`ig-${child.id}`;
          await env.FILES.put(mediaId,buffer,{httpMetadata:{contentType:mime}});
          await run(env,"INSERT INTO files(id,owner,name,mime,scope) VALUES(?,?,?,?,'public') ON CONFLICT(id) DO UPDATE SET mime=excluded.mime",mediaId,ownerId,`${mediaId}.${mime==='video/mp4'?'mp4':'jpg'}`,mime);
          media.push({url:`/api/files/${mediaId}`,type:mime});
        }
        await saveContent(env,'news',{title:(post.caption||'ข่าวสารจากสโมสร').split('\n')[0].slice(0,160),body:post.caption||'',media,image:media[0]?.url,date:post.timestamp,source:'instagram',permalink:post.permalink},`ig-${post.id}`);count++;
      }
      next=body.paging?.next||null;
    }
    if(next)throw new Error('More than 250 posts; run a separate historical import');
    await run(env,'INSERT INTO integration_log VALUES(1,?,NULL) ON CONFLICT(id) DO UPDATE SET last_sync=excluded.last_sync,error=NULL',new Date().toISOString());return {count};
  }catch(error){await run(env,'INSERT INTO integration_log VALUES(1,NULL,?) ON CONFLICT(id) DO UPDATE SET error=excluded.error',error.message);fail('ซิงก์ไม่สำเร็จ กรุณาตรวจบัญชีและสิทธิ์ Instagram ในการตั้งค่า',502);}
}

export default {fetch:handleApi,async scheduled(controller,env,ctx){const admin=await one(env,"SELECT id FROM users WHERE kind='admin' AND verified=1 LIMIT 1");if(admin&&env.IG_ACCESS_TOKEN)ctx.waitUntil(syncInstagram(env,admin.id).catch(e=>console.error(e.message)));}};
