const enc = new TextEncoder();
export const studentDomains = new Set(['student.mahidol.ac.th','student.mahidol.edu']);
export function normalizeEmail(email) { return String(email || '').trim().toLowerCase(); }
export function allowedEmail(email) { return /^[^\s@]+@[^\s@]+$/.test(email) && studentDomains.has(email.split('@')[1]); }
export const token = () => [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');
export const digest = async (value) => [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function hashPassword(password, salt=token().slice(0,32)) {
  const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);
  const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);
  return `pbkdf2$100000$${salt}$${[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyPassword(password, stored) {
  if (!stored || stored.split('$').length!==4) return false;
  const computed=await hashPassword(password,stored.split('$')[2]);
  let difference=computed.length ^ stored.length;
  for(let i=0;i<computed.length;i++)difference|=computed.charCodeAt(i)^stored.charCodeAt(i);
  return difference===0;
}
export function passwordError(password,confirm) {
  if(typeof password!=='string'||password.length<12||password.length>128)return 'ใช้รหัสผ่าน 12–128 ตัวอักษร';
  if(password!==confirm)return 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  return '';
}
