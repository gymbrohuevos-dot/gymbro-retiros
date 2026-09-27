
'use strict';
let token='',branch='',username='',chosen=null,busy=false,lastFocus=null;
const branchLabels={COLON:'Colón',ESTRADA:'Estrada',MARCONI:'Marconi'};
const el=id=>document.getElementById(id),labelBranch=b=>branchLabels[b]||b;
function icon(kind){const paths={check:'<path d="m5 12 4 4L19 6"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',box:'<path d="m3 7 9-4 9 4v11l-9 4-9-4Z M3 7l9 4 9-4 M12 11v11 M7.5 5l9 4"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};const t=document.createElement('template');t.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[kind]+'</svg>';return t.content.firstChild;}
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function msg(s,error=false){el('message').replaceChildren();el('message').textContent=s;el('message').className='message'+(error?' error':'');}
function success(s){msg('');const a=node('div','','success-mark');a.append(icon('check'));el('message').append(a,node('strong','Entrega confirmada','message-title'),node('p',s));el('message').className='message success';el('message').focus();}
function loading(v){busy=v;el('progress').hidden=!v;document.querySelectorAll('button').forEach(b=>b.disabled=v);el('app').setAttribute('aria-busy',String(v));}
async function call(name,args){
  let response;
  try {
    response=await fetch('/api/retiros',{
      method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
      body:JSON.stringify({action:name,args}),signal:AbortSignal.timeout(35000)
    });
  } catch {
    throw Error(name==='entregar'
      ? 'Se cortó la conexión. Volvé a buscar el pedido para verificar si quedó entregado antes de reintentar.'
      : 'No pudimos conectar. Revisá tu conexión a internet y reintentá.');
  }
  let result;
  try {result=await response.json();} catch {throw Error('No se pudo leer la respuesta del servidor. Contactá a GymBro.');}
  if(!response.ok||!result.ok)throw Error(result.error||'No se pudo completar la operación.');
  return result.data;
}
function reset(){token='';branch='';username='';chosen=null;el('app').hidden=true;el('login').hidden=false;el('changePassword').hidden=true;el('topLabel').textContent='Mar del Plata';el('password').value='';el('password').type='password';el('reveal').textContent='Mostrar';el('reveal').setAttribute('aria-pressed','false');el('query').value='';el('results').replaceChildren();el('resultsHeading').hidden=true;}
async function task(fn){if(busy)return;loading(true);try{await fn();}catch(e){if(/Sesión vencida/.test(e.message||''))reset();msg(e.message||'No se pudo completar la operación. Volvé a buscar el pedido antes de reintentar.',true);}finally{loading(false);}}
function empty(title,description){const box=node('div','','empty');box.append(icon('box'),node('strong',title),node('p',description));el('results').replaceChildren(box);}
function detail(text,kind){const p=node('p','','detail');p.append(icon(kind),node('span',text));return p;}
function render(data,pending=false){el('results').replaceChildren();el('resultsHeading').hidden=false;el('resultsTitle').textContent=pending?'Pendientes en '+labelBranch(branch):'Resultado de la búsqueda';el('resultCount').textContent=data.orders.length+' pedido'+(data.orders.length===1?'':'s');if(!data.orders.length){empty(pending?'Todo al día':'No encontramos ese pedido',pending?'No hay pedidos pendientes en esta sucursal.':'Revisá el dato o consultá con GymBro.');return;}data.orders.forEach(o=>{const a=node('article','','order'),head=node('div','','order-head');const state={PENDIENTE:'Pendiente',ENTREGADO:'Entregado',CANCELADO:'Cancelado'}[o.state]||o.state;head.append(node('span','Pedido '+o.id,'order-id'),node('span',state,'badge'+(o.state==='ENTREGADO'?' delivered':o.state==='CANCELADO'?' cancelled':'')));const body=node('div','','order-body'),info=node('div','');info.append(node('p','Retira','customer-label'),node('h2',o.name),detail('Retiro en '+labelBranch(o.branch),'pin'));if(o.created)info.append(detail('Cargado: '+o.created,'clock'));if(o.delivered)info.append(detail('Entregado: '+o.delivered,'check'));if(o.extras)info.append(node('p',o.extras,'extras'));const qty=node('div','','quantity');qty.append(node('b',String(o.quantity)),node('span',o.quantity===1?'maple':'maples'));body.append(info,qty);a.append(head,body);if(o.state==='PENDIENTE'){const foot=node('div','','order-foot');if(o.foreign){const notice=node('div','','notice');notice.append(node('strong','Asignado a '+labelBranch(o.branch)),node('p','Podés entregarlo en '+labelBranch(branch)+' si hay stock libre. La reserva se ajustará automáticamente.'));foot.append(notice);}const b=node('button',o.foreign?'Reasignar y entregar acá':'Confirmar entrega','primary');b.prepend(icon('check'));b.onclick=()=>{chosen=o;lastFocus=b;el('confirmTitle').textContent=o.foreign?'Reasignar y entregar':'¿Confirmamos la entrega?';el('confirmText').textContent=(o.foreign?'El pedido pasará de '+labelBranch(o.branch)+' a '+labelBranch(branch)+'.\n\n':'')+o.name+'\n'+o.quantity+' maples'+(o.extras?' + '+o.extras:'')+'\n\nConfirmá cuando vayas a entregar el pedido completo.';el('confirm').showModal();el('no').focus();};foot.append(b);a.append(foot);}el('results').append(a);});if(data.more)el('results').append(node('p','Hay más pedidos. Buscá al cliente por su dato completo.','muted'));}
el('dialogIcon').append(icon('box'));
el('loginForm').querySelector('.legacy-login').ontoggle=e=>{el('username').required=!e.currentTarget.open;};
el('reveal').onclick=()=>{const show=el('password').type==='password';el('password').type=show?'text':'password';el('reveal').textContent=show?'Ocultar':'Mostrar';el('reveal').setAttribute('aria-label',show?'Ocultar clave':'Mostrar clave');el('reveal').setAttribute('aria-pressed',String(show));};
el('loginForm').onsubmit=e=>{e.preventDefault();task(async()=>{const legacy=el('loginForm').querySelector('.legacy-login').open;const s=await call(legacy?'ingresar':'userLogin',legacy?[el('branch').value,el('password').value]:[el('username').value,el('password').value]);token=s.token;branch=s.branch;username=s.username||'';el('changePassword').hidden=!username;el('password').value='';el('where').textContent='SUCURSAL '+labelBranch(branch).toUpperCase();el('topLabel').textContent=labelBranch(branch);el('login').hidden=true;el('app').hidden=false;el('resultsHeading').hidden=true;empty('Encontrá el pedido del cliente','Ingresá su código de 4 dígitos. También podés usar celular, DNI o un código anterior.');msg('');el('query').focus();});};
el('changePassword').onclick=()=>{el('changeDialog').showModal();el('currentPassword').focus();};
el('cancelChange').onclick=()=>el('changeDialog').close();
el('changeForm').onsubmit=e=>{e.preventDefault();task(async()=>{try{const r=await call('userChangePassword',[token,el('currentPassword').value,el('nextPassword').value]);el('changeDialog').close();reset();msg(r.message);}finally{el('changeForm').reset();}});};
el('searchForm').onsubmit=e=>{e.preventDefault();task(async()=>{el('results').replaceChildren();el('resultsHeading').hidden=true;msg('Buscando pedido…');render(await call('buscar',[token,el('query').value,false]));msg('');});};
el('pending').onclick=()=>task(async()=>{el('results').replaceChildren();el('resultsHeading').hidden=true;msg('Cargando pendientes…');render(await call('buscar',[token,'',true]),true);msg('');});
el('no').onclick=()=>el('confirm').close();el('confirm').addEventListener('close',()=>{if(lastFocus&&lastFocus.isConnected)lastFocus.focus();});
el('yes').onclick=()=>task(async()=>{const o=chosen;if(!o)return;el('confirm').close();el('results').replaceChildren();el('resultsHeading').hidden=true;try{const r=await call('entregar',[token,o.id,o.version,o.foreign]);if(/^Entrega registrada:/.test(r.message))success(r.message);else msg(r.message);empty('Listo para el próximo retiro','Buscá otro pedido para continuar.');el('query').value='';}catch(e){if(/Sesión vencida/.test(e.message||''))reset();msg((e.message||'No se pudo confirmar.')+'\nVolvé a buscar el pedido para verificar su estado antes de reintentar.',true);}chosen=null;});
el('logout').onclick=()=>task(async()=>{try{await call('salir',[token]);}finally{reset();msg('Sesión cerrada.');}});

task(async()=>{
 const data=await call('branches',[]);
 const select=el('branch');select.replaceChildren();
 for(const b of data.branches){branchLabels[b.id]=b.name;select.append(new Option(b.name,b.id));}
});
