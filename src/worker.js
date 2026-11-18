import api from './api.js';
export default {
  async fetch(request,env,ctx) {
    const response=new URL(request.url).pathname.startsWith('/api/')?await api.fetch(request,env,ctx):await env.ASSETS.fetch(request);
    const result=new Response(response.body,response);
    result.headers.set('X-Content-Type-Options','nosniff');result.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    result.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; frame-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    return result;
  },
  scheduled:api.scheduled
};
