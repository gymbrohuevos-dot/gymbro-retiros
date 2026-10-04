import { createHmac } from 'node:crypto';

export const config = { path: '/api/retiros' };
const clearSession = name => `${name}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
const sessionCookie = (token,name) => `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=21600`;
const response = (body, status = 200, cookie) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    ...(cookie ? { 'Set-Cookie': cookie } : {}) }
});
const text = (s, max) => typeof s === 'string' && s.length <= max;
function valid(action, a) {
  if (!Array.isArray(a)) return false;
  switch (action) {
    case 'branches': return a.length===0;
    case 'commerceHistory': return a.length===2 && text(a[0],64) && a[1] && ['delivered','stock'].includes(a[1].kind) && Number.isInteger(a[1].offset) && a[1].offset>=0 && a[1].offset<=10000;
    case 'commerceReceive': return a.length===3 && text(a[0],64) && a[1] && text(a[1].id,200) && text(a[1].version,200) && Number.isInteger(a[1].received) && a[1].received>=0 && a[1].received<=10000 && text(a[1].notes,500) && text(a[2],40) && /^req-[a-f0-9-]{32,36}$/.test(a[2]);
    case 'userLogin': return a.length===2 && text(a[0],40) && text(a[1],100) && a[1].length>0;
    case 'userChangePassword': return a.length===3 && text(a[0],64) && text(a[1],100) && text(a[2],100);
    case 'adminAccounts': return a.length===1 && text(a[0],64);
    case 'adminSaveAccount': return a.length===2 && text(a[0],64) && a[1] && typeof a[1]==='object' && !Array.isArray(a[1]) && text(a[1].username,40) && text(a[1].branch,80) && text(a[1].password,100);
    case 'adminAccountState': return a.length===3 && text(a[0],64) && text(a[1],40) && typeof a[2]==='boolean';
    case 'adminAddBranch': return a.length===3 && text(a[0],64) && a[1] && typeof a[1]==='object' && text(a[1].name,60) && text(a[1].password,100) && text(a[2],40) && /^req-[a-f0-9-]{32,36}$/.test(a[2]);
    case 'adminSetAccess': return a.length===2 && text(a[0],64) && a[1] && typeof a[1]==='object' && !Array.isArray(a[1]) && text(a[1].current,100) && text(a[1].password,100) && text(a[1].target,80);
    case 'adminLogin': return a.length===1 && text(a[0],100) && a[0].length>0;
    case 'adminDashboard': return a.length===2 && text(a[0],64) && a[1] && typeof a[1]==='object' && !Array.isArray(a[1]);
    case 'adminCreate':
    case 'adminStock': return a.length===3 && text(a[0],64) && a[1] && typeof a[1]==='object' && !Array.isArray(a[1]) && text(a[2],40) && /^req-[a-f0-9-]{32,36}$/.test(a[2]);
    case 'adminCancel': return a.length===3 && text(a[0],64) && text(a[1],200) && text(a[2],200);
    case 'adminLogout': return a.length===1 && text(a[0],64);
    case 'ingresar': return a.length === 2 && text(a[0],80) && /^[A-Z][A-Z0-9_]*$/.test(a[0]) && text(a[1], 100) && a[1].length > 0;
    case 'buscar': return a.length === 3 && text(a[0], 64) && text(a[1], 80) && typeof a[2] === 'boolean';
    case 'entregar': return a.length === 4 && text(a[0], 64) && text(a[1], 200) && a[1].length > 0 && text(a[2], 200) && a[2].length > 0 && typeof a[3] === 'boolean';
    case 'salir': return a.length === 1 && text(a[0], 64);
    default: return false;
  }
}

export default async function handler(request) {
  if (request.method !== 'POST') return response({ok:false,error:'Método no permitido.'}, 405);
  // Rechazar formularios y llamadas de otros sitios antes de usar credenciales.
  if (request.headers.get('origin') !== new URL(request.url).origin) return response({ok:false,error:'Origen no permitido.'}, 403);
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return response({ok:false,error:'Formato inválido.'}, 415);
  if (Number(request.headers.get('content-length') || 0) > 8192) return response({ok:false,error:'Solicitud demasiado grande.'}, 413);
  let action, args;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return response({ok:false,error:'Solicitud demasiado grande.'}, 413);
    ({action, args} = JSON.parse(raw));
    if (!valid(action, args)) return response({ok:false,error:'Solicitud inválida.'}, 400);
  } catch { return response({ok:false,error:'Solicitud inválida.'}, 400); }

  const admin=action.startsWith('admin'), login=action==='ingresar'||action==='userLogin'||action==='adminLogin', logout=action==='salir'||action==='adminLogout';
  const COOKIE=admin?'__Host-gymbro-admin':'__Host-gymbro', clearCookie=clearSession(COOKIE);
  const cookie = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(COOKIE + '='));
  const token = cookie ? cookie.slice(COOKIE.length + 1) : '';
  if (!login && action!=='branches') {
    if (!/^[a-f0-9]{64}$/.test(token)) return response({ok:false,error:'Sesión vencida. Volvé a ingresar.'}, 401, clearCookie);
    args[0] = token; // Nunca confiar en el token enviado en el cuerpo por el navegador.
  }
  const endpoint = process.env.GB_APPS_SCRIPT_URL || '';
  const secret = process.env.GB_BRIDGE_SECRET || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) || !/^[a-f0-9]{64}$/.test(secret)) {
    return response({ok:false,error:'Falta configurar la conexión del comercio. Contactá a GymBro.'}, 503);
  }
  try {
    const payload = JSON.stringify({action, args, timestamp: Date.now()});
    const signature = createHmac('sha256', secret).update(payload).digest('base64url');
    // ContentService responde mediante una redirección a googleusercontent.com.
    // fetch sigue la redirección, sin cookies ni sesión Google del cliente.
    const upstream = await fetch(endpoint, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({payload, signature}), redirect:'follow', signal:AbortSignal.timeout(25000)
    });
    if (!upstream.ok) throw Error('upstream');
    const result = await upstream.json();
    if (!result || typeof result.ok !== 'boolean') throw Error('envelope');
    if (!result.ok) {
      const message = typeof result.error === 'string' ? result.error : 'No se pudo completar la operación.';
      if (/Conexión no autorizada|Solicitud vencida/.test(message)) return response({ok:false,error:'La conexión con Google necesita revisión. Contactá a GymBro.'}, 502);
      const expired = /Sesión vencida/.test(message);
      return response({ok:false,error:message.slice(0, 1200),uncertain:result.uncertain===true}, expired ? 401 : result.uncertain===true ? 502 : 400, expired || logout ? clearCookie : undefined);
    }
    if (login) {
      if (!/^[a-f0-9]{64}$/.test(result.data?.token || '') || (admin ? result.data?.role!=='ADMIN' : !/^[A-Z][A-Z0-9_]{0,79}$/.test(result.data?.branch||''))) throw Error('login');
      if (action==='userLogin' && !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(result.data?.username||'')) throw Error('login');
      // La clave y el token real no se guardan en localStorage ni se devuelven al JS.
      return response({ok:true,data:admin?{token:'sesion',role:'ADMIN'}:{token:'sesion',branch:result.data.branch,
        ...(action==='userLogin'?{username:result.data.username}:{})}}, 200, sessionCookie(result.data.token,COOKIE));
    }
    return response({ok:true,data:result.data}, 200, logout || ((action==='adminSetAccess'||action==='userChangePassword')&&result.data?.logout===true) ? clearCookie : undefined);
  } catch {
    // No reintentar entregas automáticamente: Google pudo confirmar antes de un corte.
    return response({ok:false,error:action === 'adminSetAccess'
      ? 'No pudimos confirmar el cambio de clave. Probá ingresar con la nueva; si no funciona, usá la anterior. No se modifican pedidos ni stock.'
      : action === 'adminCreate'||action === 'adminStock'||action === 'adminAddBranch'
      ? 'No pudimos confirmar la respuesta. Usá Reintentar guardado para consultar o completar la misma solicitud sin duplicarla.'
      : action === 'commerceReceive'
      ? 'No pudimos confirmar la recepción. Reintentá la misma validación: no se duplicará ni se sumará stock otra vez.'
      : action === 'entregar'
      ? 'No pudimos confirmar la respuesta. Volvé a buscar el pedido para verificar si quedó entregado antes de reintentar.'
      : 'No se pudo conectar con Google. Reintentá en unos segundos; si persiste, avisá a GymBro.',uncertain:action==='commerceReceive'}, 502, logout ? clearCookie : undefined);
  }
}
