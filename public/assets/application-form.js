export const defaultCampQuestions = ['เหตุผลที่อยากเข้าร่วมค่าย'];

export function showApplicationForm({dialog, content, event, user, escape, submit, onSuccess}) {
  const e=escape, questions=event.campQuestions?.length?event.campQuestions:defaultCampQuestions;
  const titles=['ความยินยอม','ข้อมูลทั่วไป','คำถามเกี่ยวกับค่าย','ความสามารถพิเศษ'];
  const input=(name,label,value='',attributes='')=>`<label class="field"><span>${label} *</span><input name="${name}" value="${e(value)}" ${attributes} required></label>`;
  content.innerHTML=`<div class="dialog-head"><h2>${e(event.title)}</h2><button type="button" class="icon-button" data-action="close" aria-label="ปิด">×</button></div>
    <form class="application-form" novalidate>
      <div class="application-progress"><span id="applicationStep" aria-live="polite"></span><progress max="4" value="1" aria-label="ความคืบหน้า"></progress></div>
      <section class="application-section"><h3>ความยินยอม</h3>
        <label class="consent-card"><input type="checkbox" name="pdpaConsent" required><span>ยินยอมให้เก็บและใช้ข้อมูลสมัคร รวมถึงข้อมูลแพ้อาหาร เพื่อจัดกิจกรรมนี้ *</span></label>
        <label class="consent-card"><input type="checkbox" name="voluntaryConsent" required><span>ยืนยันว่าเข้าร่วมกิจกรรมโดยสมัครใจ *</span></label>
      </section>
      <section class="application-section" hidden><h3>ข้อมูลทั่วไป</h3>
        ${input('name','ชื่อ–นามสกุล',user.name,'autocomplete="name" maxlength="100"')}
        ${input('studentId','รหัสนักศึกษา',user.studentId,'inputmode="numeric" pattern="[0-9]{7,10}" maxlength="10"')}
        ${input('phone','เบอร์โทรศัพท์',user.phone,'type="tel" autocomplete="tel" pattern="[0-9]{9,10}" maxlength="10"')}
        <label class="field"><span>ตำแหน่ง *</span><select name="position" required>${event.positions.map(p=>`<option value="${e(p.name)}">${e(p.name)}</option>`).join('')}</select></label>
        <fieldset class="allergy-options"><legend>แพ้อาหารหรือไม่ *</legend><label><input type="radio" name="hasAllergies" value="no" required> ไม่แพ้</label><label><input type="radio" name="hasAllergies" value="yes" required> แพ้</label></fieldset>
        <label class="field" id="allergyDetails" hidden><span>อาหารที่แพ้ *</span><input name="foodAllergies" maxlength="500"></label>
      </section>
      <section class="application-section" hidden><h3>คำถามเกี่ยวกับค่าย</h3>${questions.map((q,i)=>`<label class="field"><span>${e(q)} *</span><textarea name="campAnswer${i}" rows="4" maxlength="2000" required></textarea></label>`).join('')}</section>
      <section class="application-section" hidden><h3>ความสามารถพิเศษ</h3><label class="field"><span>มีความสามารถพิเศษอะไรบ้าง *</span><textarea name="specialSkills" rows="5" maxlength="2000" placeholder="หากไม่มี ระบุ ไม่มี" required></textarea></label></section>
      <p class="form-error" role="alert"></p><div class="application-actions"><button type="button" class="button" id="applicationBack" hidden>ย้อนกลับ</button><button type="submit" class="button primary" id="applicationNext">ถัดไป</button></div>
    </form>`;
  const form=content.querySelector('form'),sections=[...form.querySelectorAll('.application-section')],back=form.querySelector('#applicationBack'),next=form.querySelector('#applicationNext'),error=form.querySelector('.form-error');
  let step=0,sending=false;
  function renderStep(){sections.forEach((section,i)=>section.hidden=i!==step);back.hidden=step===0;next.textContent=step===3?'ส่งใบสมัคร':'ถัดไป';form.querySelector('#applicationStep').textContent=`${step+1} / 4 · ${titles[step]}`;form.querySelector('progress').value=step+1;error.textContent='';dialog.scrollTop=0;}
  function validSection(index){for(const control of sections[index].querySelectorAll('input,select,textarea')){if(!control.checkValidity()){step=index;renderStep();control.reportValidity();return false;}if(control.required&&['text','textarea'].includes(control.type)&&!control.value.trim()){step=index;renderStep();control.focus();error.textContent='กรุณากรอกข้อมูลให้ครบ';return false;}}return true;}
  form.addEventListener('change',()=>{const yes=form.elements.hasAllergies.value==='yes';form.querySelector('#allergyDetails').hidden=!yes;form.elements.foodAllergies.required=yes;if(!yes)form.elements.foodAllergies.value='';});
  back.addEventListener('click',()=>{if(!sending){step--;renderStep();}});
  form.addEventListener('submit',async ev=>{ev.preventDefault();if(sending||!validSection(step))return;if(step<3){step++;renderStep();return;}for(let i=0;i<4;i++)if(!validSection(i))return;
    const values=Object.fromEntries(new FormData(form));sending=true;next.disabled=true;back.disabled=true;error.textContent='';
    try{await submit({...values,eventId:event.id,pdpaConsent:form.elements.pdpaConsent.checked,voluntaryConsent:form.elements.voluntaryConsent.checked,campAnswers:questions.map((question,i)=>({question,answer:values[`campAnswer${i}`]}))});dialog.close();await onSuccess();}catch(err){error.textContent=err.message;}finally{sending=false;next.disabled=false;back.disabled=false;}
  });
  renderStep();if(!dialog.open)dialog.showModal();
}
