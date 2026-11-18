import {hashPassword,normalizeEmail,allowedEmail,passwordError} from '../src/auth.js';
import {localEnvironment} from '../src/local-db.js';
import {resolve} from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
const email=normalizeEmail(process.env.ACCOUNT_EMAIL),password=process.env.ACCOUNT_PASSWORD,kind=process.env.ACCOUNT_KIND||'admin',name=process.env.ACCOUNT_NAME||'กรรมการสโมสร';
if(!['admin','student'].includes(kind)||!email.includes('@')||(kind==='student'&&!allowedEmail(email)))throw Error('Set ACCOUNT_EMAIL, ACCOUNT_KIND, ACCOUNT_NAME and ACCOUNT_PASSWORD');
if(passwordError(password,password))throw Error(passwordError(password,password));
const uid=crypto.randomUUID(),hash=await hashPassword(password);
if(process.argv.includes('--sql')){
  const quote=s=>`'${String(s).replaceAll("'","''")}'`;
  const sql=`INSERT INTO users(id,email,kind,name,password,verified) VALUES(${[uid,email,kind,name,hash].map(quote).join(',')},1);\n`;
  await mkdir(resolve('.local'),{recursive:true});await writeFile(resolve('.local/provision-account.sql'),sql);console.log('Generated .local/provision-account.sql. Handle as a credential artifact.');
}else{const env=await localEnvironment(resolve('.local'));await env.DB.prepare('INSERT INTO users(id,email,kind,name,password,verified) VALUES(?,?,?,?,?,1)').bind(uid,email,kind,name,hash).run();env.sqlite.close();console.log('Account created.');}
