import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {localEnvironment} from '../src/local-db.js';
import {handleApi,syncInstagram} from '../src/api.js';
import {allowedEmail,passwordError,hashPassword,verifyPassword} from '../src/auth.js';
import {mkdir} from 'node:fs/promises';

test('student domains reject lookalike domains and non-student accounts',()=>{
  assert.equal(allowedEmail('name@student.mahidol.ac.th'),true);
  assert.equal(allowedEmail('name@student.mahidol.edu'),true);
  assert.equal(allowedEmail('name@student.mahidol.ac.th.attacker.com'),false);
  assert.equal(allowedEmail('name@mahidol.ac.th'),false);
  assert.equal(allowedEmail('name@gmail.com'),false);
});
test('password hash verifies only the correct password and requires matching confirmation',async()=>{
  const hashed=await hashPassword('some-long-secret');assert.notEqual(hashed,'some-long-secret');
  assert.equal(await verifyPassword('some-long-secret',hashed),true);assert.equal(await verifyPassword('different-secret',hashed),false);
  assert.ok(passwordError('some-long-secret','not-the-same'));assert.ok(passwordError('short','short'));
});
test('temporary access creates isolated student visitors, preserves admin protection and stops when disabled',async t=>{
  await mkdir(resolve('work'),{recursive:true});const folder=await mkdtemp(join(resolve('work'),'guest-test-'));
  const env=await localEnvironment(folder,{APP_URL:'http://localhost:4321',TEMP_STUDENT_ACCESS:'true'});
  t.after(async()=>{env.sqlite.close();await rm(folder,{recursive:true,force:true});});
  async function call(path,{cookie,method='GET',host='http://localhost:4321'}={}){
    return handleApi(new Request(`${host}/api${path}`,{method,headers:{Origin:host,...(cookie?{Cookie:cookie}:{})}}),env);
  }
  const visitor1=await call('/auth/guest',{method:'POST'}),visitor2=await call('/auth/guest',{method:'POST'});
  assert.equal(visitor1.status,201);assert.equal(visitor2.status,201);
  const first=(await visitor1.json()).user,second=(await visitor2.json()).user;
  assert.notEqual(first.id,second.id);assert.equal(first.kind,'student');assert.equal(first.guest,true);assert.equal(first.needsPassword,false);
  const cookie=visitor1.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await call('/data',{cookie})).status,200);
  assert.equal((await call('/admin/data',{cookie})).status,403);
  const reused=await call('/auth/guest',{cookie,method:'POST'});assert.equal((await reused.json()).user.id,first.id);
  env.TEMP_STUDENT_ACCESS='false';
  assert.equal((await call('/auth/guest',{method:'POST'})).status,403);
  assert.equal((await call('/data',{cookie})).status,401);
  env.TEMP_STUDENT_ACCESS='true';env.LOCAL_DEV='false';
  assert.equal((await call('/auth/guest',{method:'POST'})).status,403);
  env.LOCAL_DEV='true';env.APP_URL='https://example.test';
  assert.equal((await call('/auth/guest',{method:'POST',host:'https://example.test'})).status,403);
});
test('temporary admin access uses its own session, supports local management and is disabled outside local preview',async t=>{
  await mkdir(resolve('work'),{recursive:true});const folder=await mkdtemp(join(resolve('work'),'admin-preview-test-'));
  const env=await localEnvironment(folder,{APP_URL:'http://localhost:4321',TEMP_STUDENT_ACCESS:'true',TEMP_ADMIN_ACCESS:'true'});
  t.after(async()=>{env.sqlite.close();await rm(folder,{recursive:true,force:true});});
  async function call(path,{cookie,admin=false,body,host='http://localhost:4321'}={}){
    return handleApi(new Request(`${host}/api${path}`,{method:body?'POST':'GET',headers:{Origin:host,...(cookie?{Cookie:cookie}:{}),...(admin?{'X-SH-View':'admin'}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);
  }
  const studentResponse=await call('/auth/guest',{body:{}}),studentCookie=studentResponse.headers.get('Set-Cookie').split(';')[0];
  const preview=await call('/auth/preview-admin',{cookie:studentCookie,admin:true,body:{}});
  assert.equal(preview.status,201);const user=(await preview.json()).user;assert.equal(user.kind,'admin');assert.equal(user.guest,true);
  const adminCookie=preview.headers.get('Set-Cookie').split(';')[0];assert.ok(adminCookie.startsWith('sh_preview_admin='));
  const bothCookies=`${studentCookie}; ${adminCookie}`;
  assert.equal((await (await call('/auth/me',{cookie:bothCookies})).json()).user.kind,'student');
  assert.equal((await (await call('/auth/me',{cookie:bothCookies,admin:true})).json()).user.kind,'admin');
  assert.equal((await call('/admin/data',{cookie:studentCookie,admin:true})).status,403);
  assert.equal((await call('/admin/data',{cookie:bothCookies,admin:true})).status,200);
  assert.equal((await call('/admin/inventory',{cookie:bothCookies,admin:true,body:{name:'อุปกรณ์ทดสอบ',category:'กิจกรรม & สถานที่',total:2}})).status,200);
  assert.equal((await (await call('/data',{cookie:studentCookie})).json()).inventory[0].total,2);
  const reused=(await (await call('/auth/preview-admin',{cookie:bothCookies,admin:true,body:{}})).json()).user;assert.equal(reused.id,user.id);
  env.TEMP_ADMIN_ACCESS='false';
  assert.equal((await call('/auth/preview-admin',{admin:true,body:{}})).status,403);
  assert.equal((await call('/admin/data',{cookie:bothCookies,admin:true})).status,403);
  assert.equal((await call('/admin/data',{cookie:adminCookie,admin:true})).status,401);
  // A disabled preview cookie must not block a later genuine admin login.
  await env.DB.prepare("INSERT INTO users(id,email,kind,name,password,verified) VALUES('real-admin','admin@example.test','admin','Admin',?,1)").bind(await hashPassword('Admin-test-password')).run();
  const logged=await call('/auth/login',{body:{email:'admin@example.test',kind:'admin',password:'Admin-test-password'}});
  const realCookie=logged.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await call('/admin/data',{cookie:`${realCookie}; ${adminCookie}`,admin:true})).status,200);
  env.TEMP_ADMIN_ACCESS='true';env.LOCAL_DEV='false';
  assert.equal((await call('/auth/preview-admin',{body:{},admin:true})).status,403);
  env.LOCAL_DEV='true';env.APP_URL='https://example.test';
  assert.equal((await call('/auth/preview-admin',{host:'https://example.test',body:{},admin:true})).status,403);
});
test('database-backed user ownership, admin decisions, stock, capacity and content',async t=>{
  await mkdir(resolve('work'),{recursive:true});const folder=await mkdtemp(join(resolve('work'),'api-test-'));
  const env=await localEnvironment(folder,{APP_URL:'http://localhost:4321'});
  t.after(async()=>{env.sqlite.close();await rm(folder,{recursive:true,force:true});});
  for(const [id,kind,email] of [['s1','student','one@student.mahidol.ac.th'],['s2','student','two@student.mahidol.edu'],['a','admin','smo@mahidol.ac.th']])await env.DB.prepare('INSERT INTO users(id,kind,email,name,password,verified) VALUES(?,?,?,?,?,1)').bind(id,kind,email,id,await hashPassword('Test-password-123')).run();
  async function call(path,{body,cookie,method}={}){
    const headers={'Origin':'http://localhost:4321'};if(cookie)headers.Cookie=cookie;if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
    const response=await handleApi(new Request(`http://localhost:4321/api${path}`,{method:method||(body?'POST':'GET'),headers,body:body?(body instanceof FormData?body:JSON.stringify(body)):undefined}),env);const result=response.headers.get('Content-Type')?.includes('application/json')?await response.json():null;return {response,result};
  }
  const login=async(email,kind='student')=>{const r=await call('/auth/login',{body:{email,kind,password:'Test-password-123'}});assert.equal(r.response.status,200);return r.response.headers.get('Set-Cookie').split(';')[0];};
  const c1=await login('one@student.mahidol.ac.th'),c2=await login('two@student.mahidol.edu'),ca=await login('smo@mahidol.ac.th','admin');
  assert.equal((await call('/admin/data',{cookie:c1})).response.status,403);
  assert.equal((await call('/data')).response.status,401);
  assert.equal((await call('/auth/login',{body:{email:'smo@mahidol.ac.th',kind:'student',password:'Test-password-123'}})).response.status,401);
  const csrf=await handleApi(new Request('http://localhost:4321/api/profile',{method:'POST',headers:{Origin:'https://attacker.example',Cookie:c1,'Content-Type':'application/json'},body:'{}'}),env);assert.equal(csrf.status,403);
  await call('/admin/inventory',{cookie:ca,body:{id:'ball',name:'บอล',category:'กีฬา & นันทนาการ',total:1}});
  const upload=new FormData();upload.set('file',new File(['%PDF-1.4\nTest document'], 'letter.pdf',{type:'application/pdf'}));upload.set('scope','public');
  const attachment=(await call('/files',{cookie:c1,body:upload})).result;
  assert.equal((await call(`/files/${attachment.id}`,{cookie:c2})).response.status,404);
  assert.equal((await call(`/files/${attachment.id}`,{cookie:ca})).response.status,200);
  const badUpload=new FormData();badUpload.set('file',new File(['not a pdf'],'evil.pdf',{type:'application/pdf'}));assert.equal((await call('/files',{cookie:c1,body:badUpload})).response.status,400);
  const loan={itemId:'ball',qty:1,startDate:'2099-01-01',endDate:'2099-01-02',purpose:'ทดสอบยืมพัสดุ',attachment:attachment.id,studentId:'6612345',phone:'0812345678'};
  const first=(await call('/loans',{cookie:c1,body:loan}));assert.equal(first.response.status,201);
  const second=(await call('/loans',{cookie:c1,body:loan}));assert.equal(second.response.status,201);
  assert.equal((await call('/data',{cookie:c2})).result.loans.length,0);
  assert.equal((await call('/data',{cookie:c1})).result.loans.length,2);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'loan',id:first.result.id,status:'approved'}})).response.status,200);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'loan',id:second.result.id,status:'approved'}})).response.status,409);
  assert.equal((await call('/data',{cookie:c1})).result.inventory[0].available,0);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'loan',id:first.result.id,status:'returned'}})).response.status,200);
  assert.equal((await call('/data',{cookie:c1})).result.inventory[0].available,1);
  await call('/admin/content',{cookie:ca,body:{id:'ev',type:'events',data:{title:'กีฬาสี',date:'2099-01-01',positions:[{name:'นักกีฬา',capacity:1}],open:true}}});
  const application={eventId:'ev',position:'นักกีฬา',name:'นักศึกษาทดสอบ',studentId:'6612345',phone:'0812345678',pdpaConsent:true,voluntaryConsent:true,hasAllergies:'yes',foodAllergies:'ถั่ว',campAnswers:[{question:'เหตุผลที่อยากเข้าร่วมค่าย',answer:'อยากเรียนรู้และทำงานร่วมกับเพื่อน'}],specialSkills:'เล่นดนตรี'};
  assert.equal((await call('/applications',{cookie:c1,body:{...application,pdpaConsent:false}})).response.status,400);
  assert.equal((await call('/applications',{cookie:c1,body:{...application,voluntaryConsent:'true'}})).response.status,400);
  assert.equal((await call('/applications',{cookie:c1,body:{...application,foodAllergies:''}})).response.status,400);
  assert.equal((await call('/applications',{cookie:c1,body:{...application,campAnswers:[]}})).response.status,400);
  assert.equal((await call('/applications',{cookie:c1,body:{...application,specialSkills:''}})).response.status,400);
  assert.equal((await call('/applications',{cookie:ca,body:application})).response.status,403);
  const a1=(await call('/applications',{cookie:c1,body:application})).result,a2=(await call('/applications',{cookie:c2,body:application})).result;
  assert.equal((await call('/applications',{cookie:c1,body:application})).response.status,400);
  assert.equal((await call('/data',{cookie:c1})).result.applications.length,1);
  const saved=JSON.parse((await call('/admin/data',{cookie:ca})).result.applications.find(a=>a.id===a1.id).response_json);
  assert.equal(saved.name,application.name);assert.equal(saved.foodAllergies,'ถั่ว');assert.equal(saved.specialSkills,'เล่นดนตรี');assert.equal(saved.pdpaConsent,true);assert.ok(saved.consentedAt);assert.deepEqual(saved.campAnswers,application.campAnswers);
  assert.equal((await call('/data',{cookie:c2})).result.applications.some(a=>a.id===a1.id),false);
  await call('/profile',{cookie:c1,body:{name:'ชื่อใหม่',studentId:'6677777',phone:'0899999999'}});
  const snapshot=JSON.parse((await call('/admin/data',{cookie:ca})).result.applications.find(a=>a.id===a1.id).response_json);
  assert.equal(snapshot.studentId,'6612345');assert.equal(snapshot.name,application.name);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'application',id:a1.id,status:'approved'}})).response.status,200);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'application',id:a2.id,status:'approved'}})).response.status,409);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'application',id:a2.id,status:'rejected'}})).response.status,400);
  assert.equal((await call('/admin/review',{cookie:ca,body:{type:'application',id:a2.id,status:'rejected',reason:'ตำแหน่งเต็ม'}})).response.status,200);
  assert.equal((await call('/data',{cookie:c2})).result.applications[0].reason,'ตำแหน่งเต็ม');
  await call('/admin/content',{cookie:ca,body:{type:'news',data:{title:'ข่าวใหม่',body:'ประกาศจากสโมสร'}}});assert.equal((await call('/data',{cookie:c1})).result.news[0].title,'ข่าวใหม่');
  const logout=await call('/auth/logout',{cookie:c1,body:{}});assert.equal(logout.response.status,200);assert.equal((await call('/data',{cookie:c1})).response.status,401);
  let verificationUrl='';env.DEV_MAIL=async(email,url)=>{verificationUrl=url;};
  const registration=await call('/auth/register',{body:{email:'verify@student.mahidol.edu',name:'ผู้สมัครใหม่',password:'Test-password-123',confirm:'Test-password-123'}});
  assert.equal(registration.response.status,200);assert.ok(verificationUrl.includes('/api/auth/verify?token='));
  assert.equal((await call('/auth/login',{body:{email:'verify@student.mahidol.edu',password:'Test-password-123'}})).response.status,401);
  const verify=await handleApi(new Request(verificationUrl),env);assert.equal(verify.headers.get('Location'),'/login?verified=1');
  assert.equal((await call('/auth/login',{body:{email:'verify@student.mahidol.edu',password:'Test-password-123'}})).response.status,200);
  assert.equal((await handleApi(new Request(verificationUrl),env)).headers.get('Location'),'/login?error=expired');
});

test('Instagram adapter retains complete caption and carousel and upserts without duplicates',async t=>{
  await mkdir(resolve('work'),{recursive:true});const folder=await mkdtemp(join(resolve('work'),'ig-test-'));
  const env=await localEnvironment(folder,{IG_ACCESS_TOKEN:'fixture-token',IG_USER_ID:'account-id'});
  t.after(async()=>{env.sqlite.close();await rm(folder,{recursive:true,force:true});});
  await env.DB.prepare("INSERT INTO users(id,email,kind,name,verified) VALUES('admin','test@example.test','admin','Fixture',1)").run();
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    const target=new URL(url);
    if(target.hostname==='graph.facebook.com'){
      assert.equal(options.headers.Authorization,'Bearer fixture-token');
      return new Response(JSON.stringify({data:[{id:'post-one',caption:'หัวข้อข่าว\nรายละเอียดทั้งหมดของข่าว',timestamp:'2026-11-05T00:00:00Z',permalink:'https://www.instagram.com/p/fixture/',children:{data:[{id:'child-one',media_type:'IMAGE',media_url:'https://images.cdninstagram.com/one'},{id:'child-two',media_type:'IMAGE',media_url:'https://images.cdninstagram.com/two'}]}}]}),{headers:{'Content-Type':'application/json'}});
    }
    assert.equal(target.hostname,'images.cdninstagram.com');
    return new Response(new Uint8Array([137,80,78,71]),{headers:{'Content-Type':'image/png'}});
  });
  await syncInstagram(env,'admin');await syncInstagram(env,'admin');
  const rows=await env.DB.prepare("SELECT * FROM content WHERE type='news'").all();assert.equal(rows.results.length,1);
  const news=JSON.parse(rows.results[0].data);assert.equal(news.body,'หัวข้อข่าว\nรายละเอียดทั้งหมดของข่าว');assert.equal(news.media.length,2);
  assert.equal(news.media[0].url,'/api/files/ig-child-one');assert.equal(news.media[1].url,'/api/files/ig-child-two');
  assert.ok(await env.FILES.get('ig-child-one'));assert.ok(await env.FILES.get('ig-child-two'));
});
