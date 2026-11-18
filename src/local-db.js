import {DatabaseSync} from 'node:sqlite';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
export async function localEnvironment(directory,options={}) {
  await mkdir(directory,{recursive:true});await mkdir(join(directory,'files'),{recursive:true});
  const sqlite=new DatabaseSync(join(directory,'club.sqlite'));
  sqlite.exec(await readFile(new URL('../migrations/0001.sql',import.meta.url),'utf8'));
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)');
  const migrationRoot=new URL('../migrations/',import.meta.url);
  for(const name of (await readdir(migrationRoot)).filter(name=>name.endsWith('.sql')&&name!=='0001.sql').sort()) {
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name=?').get(name))continue;
    sqlite.exec('BEGIN');
    try{sqlite.exec(await readFile(new URL(name,migrationRoot),'utf8'));sqlite.prepare('INSERT INTO local_migrations(name) VALUES(?)').run(name);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');throw error;}
  }
  const DB={prepare(sql){const statement=sqlite.prepare(sql);const build=(args=[])=>({bind(...values){return build(values);},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};}});return build();}};
  const FILES={async put(key,body){if(!/^[a-zA-Z0-9-]+$/.test(key))throw Error('Invalid file key');await writeFile(join(directory,'files',key),new Uint8Array(body));},async get(key){if(!/^[a-zA-Z0-9-]+$/.test(key))return null;try{return {body:new Uint8Array(await readFile(join(directory,'files',key)))};}catch{return null;}}};
  return {DB,FILES,sqlite,LOCAL_DEV:'true',...options,async DEV_MAIL(email,url){await writeFile(join(directory,'last-verification.json'),JSON.stringify({email,url},null,2));console.log(`Local verification mail written to .local/last-verification.json`);}};
}
