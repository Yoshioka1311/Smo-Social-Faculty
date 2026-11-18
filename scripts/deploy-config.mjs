import {readFile,writeFile} from 'node:fs/promises';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
for(const key of ['CLOUDFLARE_DATABASE_ID','APP_URL'])if(!process.env[key])throw new Error(`Missing GitHub repository variable: ${key}`);
const url=new URL(process.env.APP_URL);
if(url.protocol!=='https:')throw new Error('APP_URL must use HTTPS');
config.d1_databases[0].database_id=process.env.CLOUDFLARE_DATABASE_ID;
config.vars.APP_URL=url.origin;
config.vars.LOCAL_DEV='false';config.vars.TEMP_ADMIN_ACCESS='false';config.vars.TEMP_STUDENT_ACCESS='false';
await writeFile('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
