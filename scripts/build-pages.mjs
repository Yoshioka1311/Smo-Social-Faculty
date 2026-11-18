import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const repository=process.env.GITHUB_REPOSITORY?.split('/')[1]||'Smo-Social-Faculty';
const base=`/${repository}/`,out=resolve('_site');
await mkdir(`${out}/assets`,{recursive:true});
await cp('public/assets',`${out}/assets`,{recursive:true});
await cp('src/application-responses.js',`${out}/assets/application-responses.js`);
await cp('scripts/pages-demo-api.js',`${out}/assets/pages-demo-api.js`);
let main=await readFile('public/assets/main.js','utf8');
main="import {pagesApi} from './pages-demo-api.js';\n"+main;
main=main.replace('async function api(path,body,method) {','async function api(path,body,method) { return pagesApi(path,body,method);');
main=main.replace(/(["'`])\/(?!\/)/g,`$1${base}`);
// No browser request reaches a login API in this static preview.
await writeFile(`${out}/assets/main.js`,main);
let html=await readFile('public/index.html','utf8');
html=html.replaceAll('"/assets/',`"${base}assets/`);
html=html.replace('<body>',`<body><div class="pages-notice">เว็บตัวอย่าง · ข้อมูลอยู่เฉพาะแท็บนี้ · ใช้ข้อมูลสมมติ <a href="${base}">นักศึกษา</a><a href="${base}admin/">แอดมินตัวอย่าง</a></div>`);
for(const directory of ['', 'admin', 'login', 'admin/login']){await mkdir(`${out}/${directory}`,{recursive:true});await writeFile(`${out}/${directory}/index.html`,html);}
await writeFile(`${out}/404.html`,html);
await writeFile(`${out}/.nojekyll`,'');
await writeFile(`${out}/assets/pages-base.js`,`export default ${JSON.stringify(base)};\n`);
await writeFile(`${out}/assets/pages.css`,'.pages-notice{position:sticky;top:0;z-index:50;background:#43213a;color:white;padding:9px 18px;font-size:12px;text-align:center}.pages-notice a{color:white;text-decoration:underline;margin-left:16px}.sidebar{top:38px}.topbar{top:38px}');
for(const directory of ['', 'admin', 'login', 'admin/login']){const file=`${out}/${directory}/index.html`;await writeFile(file,(await readFile(file,'utf8')).replace('</head>',`<link rel="stylesheet" href="${base}assets/pages.css"></head>`));}
console.log(`GitHub Pages preview built in _site at ${base}`);
