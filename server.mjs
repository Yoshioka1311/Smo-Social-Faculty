import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import worker from './src/api.js';
import {localEnvironment} from './src/local-db.js';
import {existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
const port=Number(process.env.PORT||4173);
const vars=existsSync('.env')?parseEnv(await readFile('.env','utf8')):{};
const env=await localEnvironment(resolve('.local'),{...vars,APP_URL:vars.APP_URL||`http://127.0.0.1:${port}`});
const publicRoot=resolve('public');
const server=createServer(async(req,res)=>{
  try {
    const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
    const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
    let response;
    if(new URL(request.url).pathname.startsWith('/api/'))response=await worker.fetch(request,env);
    else {
      const pathname=decodeURIComponent(new URL(request.url).pathname);
      const file=pathname.startsWith('/assets/')?resolve(publicRoot,`.${pathname}`):resolve(publicRoot,'index.html');
      if(!file.startsWith(publicRoot+sep))throw new Error('Invalid path');
      const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
      response=new Response(await readFile(file),{headers:{'Content-Type':types[extname(file)]||'application/octet-stream'}});
    }
    res.statusCode=response.status;for(const [k,v] of response.headers)res.setHeader(k,v);
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; frame-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('ไม่พบหน้าเว็บ');}
});
server.listen(port,'127.0.0.1',()=>console.log(`SH Student Club: http://127.0.0.1:${port}\nAdmin: http://127.0.0.1:${port}/admin`));
server.on('error',e=>{console.error(e.message);env.sqlite.close();process.exitCode=1;});
const syncTimer=setInterval(()=>{
  if(env.IG_ACCESS_TOKEN&&env.IG_USER_ID)worker.scheduled({},env,{waitUntil:promise=>promise.catch(error=>console.error(error.message))});
},15*60*1000);
syncTimer.unref();
process.on('SIGINT',()=>server.close(()=>{env.sqlite.close();process.exit(0);}));
