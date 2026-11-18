import base from './pages-base.js';
import {validateApplicationResponses} from './application-responses.js';
const key='sh-pages-demo-v1';
const student={id:'demo-student',name:'นักศึกษาตัวอย่าง',email:'demo@example.test',studentId:'6612345',phone:'0812345678',kind:'student',guest:true};
const admin={...student,id:'demo-admin',name:'สโมสร (ตัวอย่าง)',kind:'admin'};
const initial=()=>({events:[{id:'camp-demo',title:'ค่ายสานสัมพันธ์ SH',body:'ร่วมกิจกรรมและทำความรู้จักเพื่อนใหม่',date:'2026-11-30',time:'08.30–16.30 น.',location:'คณะสังคมศาสตร์และมนุษยศาสตร์',image:`${base}assets/yard.svg`,open:true,positions:[{name:'ผู้เข้าร่วมค่าย',capacity:50}],campQuestions:['เหตุผลที่อยากเข้าร่วมค่าย','สิ่งที่คาดหวังจากค่ายนี้']}],inventory:[{id:'ball',name:'ลูกบาสเกตบอล',category:'กีฬา & นันทนาการ',total:6,available:6}],applications:[],loans:[],news:[],documents:[],committee:[],welfare:[]});
function read(){try{return JSON.parse(sessionStorage.getItem(key))||initial();}catch{return initial();}}
function save(state){sessionStorage.setItem(key,JSON.stringify(state));}
export async function pagesApi(path,body){
  if(path.startsWith(base))path='/'+path.slice(base.length);
  const state=read(),isAdmin=location.pathname.startsWith(`${base}admin`),user=isAdmin?admin:student;
  if(path==='/auth/config')return {demo:true,local:false,google:false,guestAccess:true,adminPreview:true,domains:[]};
  if(['/auth/me','/auth/guest','/auth/preview-admin'].includes(path))return {user};
  if(path==='/data')return state;
  if(path==='/admin/data')return {...state,integration:{configured:false}};
  if(path==='/profile'){Object.assign(student,body);return {ok:true};}
  if(path==='/applications'){
    const event=state.events.find(e=>e.id===body.eventId);if(!event?.open||!event.positions.some(p=>p.name===body.position))throw Error('กิจกรรมนี้ไม่เปิดรับสมัคร');
    const existing=state.applications.find(a=>a.event_id===event.id&&a.position===body.position);
    const response=validateApplicationResponses(body,event),id=existing?.id||crypto.randomUUID();
    const application={id,user_id:student.id,event_id:event.id,position:body.position,name:body.name,email:student.email,student_id:body.studentId,phone:body.phone,status:'pending',reason:'',created:new Date().toISOString().replace('T',' ').slice(0,19),response_json:JSON.stringify(response)};
    if(existing)Object.assign(existing,application);else state.applications.unshift(application);save(state);return {id};
  }
  if(path==='/admin/review'){
    const a=state.applications.find(a=>a.id===body.id);if(!a)throw Error('ไม่พบใบสมัคร');
    if(a.status!=='pending')throw Error('ใบสมัครนี้พิจารณาแล้ว');
    if(!['approved','rejected'].includes(body.status))throw Error('สถานะไม่ถูกต้อง');
    if(body.status==='rejected'&&!body.reason?.trim())throw Error('กรุณาระบุเหตุผล');
    a.status=body.status;a.reason=body.reason||'';save(state);return {ok:true};
  }
  if(path==='/admin/content'){
    const rows=state[body.type];if(!Array.isArray(rows))throw Error('ประเภทข้อมูลไม่ถูกต้อง');
    const id=body.id||crypto.randomUUID(),index=rows.findIndex(e=>e.id===id),item={...body.data,id};if(index<0)rows.unshift(item);else rows[index]=item;save(state);return {id};
  }
  if(path==='/admin/inventory'){const index=state.inventory.findIndex(e=>e.id===body.id),item={...body,id:body.id||crypto.randomUUID(),total:Number(body.total),available:Number(body.total)};if(index<0)state.inventory.push(item);else state.inventory[index]=item;save(state);return {ok:true};}
  throw Error('ฟังก์ชันนี้ต้องใช้เซิร์ฟเวอร์จริง');
}
