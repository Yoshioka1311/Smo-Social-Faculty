import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {localEnvironment} from '../src/local-db.js';
import {validateApplicationResponses} from '../src/application-responses.js';

test('camp questions match the event and non-allergic answers discard stale details',()=>{
  const event={campQuestions:['คำถามของค่ายนี้']};
  const body={name:'Student',studentId:'6612345',phone:'0812345678',pdpaConsent:true,voluntaryConsent:true,hasAllergies:'no',foodAllergies:'stale',campAnswers:[{question:'คำถามของค่ายนี้',answer:'คำตอบ'}],specialSkills:'ไม่มี'};
  assert.equal(validateApplicationResponses(body,event).foodAllergies,'');
  assert.throws(()=>validateApplicationResponses({...body,campAnswers:[{question:'คำถามเก่า',answer:'คำตอบ'}]},event),/เปิดฟอร์มใหม่/);
  assert.throws(()=>validateApplicationResponses({...body,campAnswers:[{question:'คำถามของค่ายนี้',answer:' '}]},event),/คำตอบ/);
});

test('existing databases migrate without losing applications and reopen safely',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'smo-migration-'));let env;
  try{
    const old=new DatabaseSync(join(directory,'club.sqlite'));
    old.exec(await readFile(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
    old.exec("INSERT INTO users(id,email,kind,name) VALUES('s','student@example.test','student','Student'); INSERT INTO applications(id,user_id,event_id,position,note) VALUES('legacy','s','event','member','original note')");old.close();
    env=await localEnvironment(directory);
    assert.equal((await env.DB.prepare("SELECT * FROM applications WHERE id='legacy'").first()).response_json,'{}');
    env.sqlite.close();env=null;env=await localEnvironment(directory);
    assert.equal((await env.DB.prepare("SELECT * FROM applications WHERE id='legacy'").first()).note,'original note');
  }finally{env?.sqlite.close();await rm(directory,{recursive:true,force:true});}
});
