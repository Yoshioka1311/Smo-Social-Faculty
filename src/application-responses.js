const reject=message=>{throw Object.assign(new Error(message),{status:400});};
function required(value,label,max){if(typeof value!=='string'||!value.trim()||value.trim().length>max)reject(`กรุณาระบุ${label} (ไม่เกิน ${max} ตัวอักษร)`);return value.trim();}
export function validateApplicationResponses(body,event){
  if(body.pdpaConsent!==true||body.voluntaryConsent!==true)reject('กรุณายินยอมให้ใช้ข้อมูลและยืนยันการเข้าร่วมโดยสมัครใจ');
  const name=required(body.name,'ชื่อ–นามสกุล',100);
  if(!['yes','no'].includes(body.hasAllergies))reject('กรุณาระบุว่าแพ้อาหารหรือไม่');
  const foodAllergies=body.hasAllergies==='yes'?required(body.foodAllergies,'อาหารที่แพ้',500):'';
  const questions=event.campQuestions?.length?event.campQuestions:['เหตุผลที่อยากเข้าร่วมค่าย'];
  if(!Array.isArray(body.campAnswers)||body.campAnswers.length!==questions.length)reject('กรุณาตอบคำถามเกี่ยวกับค่ายให้ครบ');
  const campAnswers=questions.map((question,i)=>{const item=body.campAnswers[i];if(item?.question!==question)reject('คำถามมีการเปลี่ยนแปลง กรุณาเปิดฟอร์มใหม่');return {question,answer:required(item.answer,'คำตอบเกี่ยวกับค่าย',2000)};});
  return {version:1,name,studentId:String(body.studentId).trim(),phone:String(body.phone).trim(),pdpaConsent:true,voluntaryConsent:true,consentVersion:'2026-11-18',consentedAt:new Date().toISOString(),hasAllergies:body.hasAllergies,foodAllergies,campAnswers,specialSkills:required(body.specialSkills,'ความสามารถพิเศษ หรือระบุ ไม่มี',2000)};
}
