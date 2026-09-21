'use strict';
const $=id=>document.getElementById(id), names={COLON:'Colón',ESTRADA:'Estrada',MARCONI:'Marconi'};
let busy=false,offset=0,stock=null,chosen=null,pendingOrder=null,pendingStock=null;
function node(tag,text,cls){const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;}
function message(text,error=false){$('message').textContent=text;$('message').className='message'+(error?' error':'');}
function panel(id){document.querySelectorAll('.admin-panel').forEach(n=>n.hidden=n.id!==id);document.querySelectorAll('[data-panel]').forEach(b=>{const active=b.dataset.panel===id;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});}
function pendingUI(){for(const [kind,value] of [['order',pendingOrder],['stock',pendingStock]]){$(kind+'Fields').disabled=!!value;$(kind+'Pending').hidden=!value;$(kind==='order'?'saveOrder':'saveStock').textContent=value?'Reintentar guardado':kind==='order'?'Guardar pedido y reservar stock':'Registrar ingreso de stock';}}
async function api(action,args){
  let r;
  try{r=await fetch('/api/retiros',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,args}),signal:AbortSignal.timeout(35000)});}
  catch{const e=Error('Se cortó la conexión. Si estabas guardando, usá Reintentar guardado para completar la misma solicitud.');e.uncertain=true;throw e;}
  let result;try{result=await r.json();}catch{const e=Error('Respuesta no válida. Si estabas guardando, reintentá la misma solicitud.');e.uncertain=true;throw e;}
  if(!r.ok||!result.ok){const e=Error(result.error||'No se pudo completar la operación.');e.uncertain=r.status>=500;if(r.status===401){$('workspace').hidden=true;$('login').hidden=false;$('password').value='';}throw e;}
  return result.data;
}
async function task(fn){if(busy)return;busy=true;const buttons=[...document.querySelectorAll('button')].map(b=>[b,b.disabled]);buttons.forEach(([b])=>b.disabled=true);document.body.setAttribute('aria-busy','true');try{await fn();}catch(e){message(e.message,true);$('message').focus();}finally{busy=false;buttons.forEach(([b,disabled])=>{if(b.isConnected)b.disabled=disabled;});document.body.setAttribute('aria-busy','false');pendingUI();updatePagination();}}
let hasMore=false;
function updatePagination(){$('previous').disabled=busy||offset===0;$('next').disabled=busy||!hasMore;}
function showAvailable(){$('available').textContent=stock?stock[$('branch').value].free+' maples libres ahora. Se vuelven a verificar al guardar.':'Stock sin verificar. Actualizá el panel.';}
function renderStock(data){stock=data.stock;$('stockError').hidden=!data.stockError;$('stockError').textContent=data.stockError?data.stockError+' Podés consultar los pedidos, pero corregí el stock antes de crear o entregar.':'';$('stockCards').replaceChildren();for(const b of ['COLON','ESTRADA','MARCONI']){const card=node('section','','stock-card'),quantity=node('div','','stock-number');quantity.append(node('span',stock?String(stock[b].free):'—'),node('small','maples libres'));card.append(node('h2',names[b]),quantity,node('p',stock?stock[b].physical+' en el local · '+stock[b].reserved+' reservados':'Revisión de stock pendiente','stock-detail'));$('stockCards').append(card);}showAvailable();}
async function copy(text){try{await navigator.clipboard.writeText(text);message('Código copiado.');}catch{message('Copiá este código: '+text);}}
function renderOrders(data){$('orders').replaceChildren();$('listCount').textContent=data.total?`${data.offset+1}–${Math.min(data.offset+50,data.total)} de ${data.total} pedidos · ${data.pending} pendientes en total`:'No hay pedidos con estos filtros.';hasMore=data.more;
  for(const o of data.orders){const card=node('article','','admin-order'),top=node('div','','admin-order-top'),who=node('div','');who.append(node('h3',o.name),node('small',o.created+' · '+o.channel));top.append(who,node('span',o.state,'badge'+(o.state==='ENTREGADO'?' delivered':o.state==='CANCELADO'?' cancelled':'')));const details=node('div','','admin-order-details');details.append(node('strong',o.quantity+' maples · '+names[o.branch]),node('span',o.phone?'Cel. '+o.phone:'DNI '+o.dni),node('span',o.code,'admin-order-code'));card.append(top,details);if(o.extras)card.append(node('p','Otros productos: '+o.extras,'help'));if(o.notes)card.append(node('p','Observaciones: '+o.notes,'help'));if(o.delivered)card.append(node('p','Entregado: '+o.delivered,'help'));const actions=node('div','','admin-order-actions');const cp=node('button','Copiar código','secondary');cp.onclick=()=>copy(o.code);actions.append(cp);if(o.state==='PENDIENTE'){const cancel=node('button','Cancelar pedido','secondary');cancel.onclick=()=>{chosen=o;$('cancelText').textContent=o.name+' · '+o.quantity+' maples en '+names[o.branch]+'.';$('cancelDialog').showModal();$('backCancel').focus();};actions.append(cancel);}card.append(actions);$('orders').append(card);}
}
async function refresh(){const data=await api('adminDashboard',['sesion',{query:$('filterQuery').value,branch:$('filterBranch').value,state:$('filterState').value,offset}]);renderStock(data);renderOrders(data);return data;}
function savePending(kind,value){const name='gymbro-admin-pending-'+kind;if(value)sessionStorage.setItem(name,JSON.stringify(value));else sessionStorage.removeItem(name);if(kind==='order')pendingOrder=value;else pendingStock=value;pendingUI();}
function recover(){for(const kind of ['order','stock']){let raw;try{raw=JSON.parse(sessionStorage.getItem('gymbro-admin-pending-'+kind)||'null');}catch{raw=null;}if(!raw||typeof raw.key!=='string'||!raw.input)continue;if(kind==='order'){pendingOrder=raw;for(const k of ['name','phone','dni','quantity','branch','extras','notes'])$(k).value=raw.input[k]??'';$('paid').checked=raw.input.paid===true;}else{pendingStock=raw;for(const [id,k] of [['stockBranch','branch'],['stockQuantity','quantity'],['stockType','type'],['stockNotes','notes']])$(id).value=raw.input[k]??'';}}pendingUI();}
function orderInput(){return {name:$('name').value,phone:$('phone').value,dni:$('dni').value,quantity:Number($('quantity').value),branch:$('branch').value,extras:$('extras').value,notes:$('notes').value,paid:$('paid').checked};}
function requestKey(){return 'req-'+crypto.randomUUID();}
async function afterWrite(){try{await refresh();}catch(e){message('El guardado se confirmó, pero no pudimos actualizar la lista. Tocá Actualizar. '+e.message,true);}}
$('loginForm').onsubmit=e=>{e.preventDefault();task(async()=>{await api('adminLogin',[$('password').value]);$('password').value='';$('login').hidden=true;$('workspace').hidden=false;message('');recover();await refresh();});};
document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{panel(b.dataset.panel);});
$('branch').onchange=showAvailable;
$('filterForm').onsubmit=e=>{e.preventDefault();task(async()=>{offset=0;await refresh();message('');});};
$('refresh').onclick=()=>task(async()=>{await refresh();message('Datos actualizados.');});
$('previous').onclick=()=>task(async()=>{offset=Math.max(0,offset-50);await refresh();});
$('next').onclick=()=>task(async()=>{offset+=50;await refresh();});
$('orderForm').onsubmit=e=>{e.preventDefault();task(async()=>{
  if(!pendingOrder){savePending('order',{key:requestKey(),input:orderInput()});}
  let r;try{r=await api('adminCreate',['sesion',pendingOrder.input,pendingOrder.key]);}catch(e){if(!e.uncertain&&!/Sesión vencida/.test(e.message))savePending('order',null);throw e;}
  savePending('order',null);$('orderForm').reset();$('created').hidden=false;$('created').replaceChildren(node('strong',r.reused?'Este pedido ya estaba guardado':'Pedido registrado'),node('p',r.order.name+' · '+r.order.quantity+' maples · '+names[r.order.branch]),node('p','Código de retiro: '+r.order.code,'admin-order-code'));const cp=node('button','Copiar código de retiro','secondary');cp.onclick=()=>copy(r.order.code);$('created').append(cp);message('Pedido confirmado. La reserva quedó registrada una sola vez.');await afterWrite();
});};
$('stockForm').onsubmit=e=>{e.preventDefault();task(async()=>{
  if(!pendingStock)savePending('stock',{key:requestKey(),input:{branch:$('stockBranch').value,quantity:Number($('stockQuantity').value),type:$('stockType').value,notes:$('stockNotes').value}});
  let r;try{r=await api('adminStock',['sesion',pendingStock.input,pendingStock.key]);}catch(e){if(!e.uncertain&&!/Sesión vencida/.test(e.message))savePending('stock',null);throw e;}
  savePending('stock',null);$('stockForm').reset();message(r.message);await afterWrite();
});};
$('backCancel').onclick=()=>$('cancelDialog').close();
$('confirmCancel').onclick=()=>task(async()=>{const o=chosen;if(!o)return;$('cancelDialog').close();const r=await api('adminCancel',['sesion',o.id,o.version]);message(r.message);await afterWrite();});
$('logout').onclick=()=>task(async()=>{try{await api('adminLogout',['sesion']);}finally{$('workspace').hidden=true;$('login').hidden=false;$('password').value='';$('orders').replaceChildren();$('stockCards').replaceChildren();$('created').hidden=true;stock=null;message('Sesión cerrada.');}});
$('accessTarget').onchange=()=>{$('accessNote').textContent=$('accessTarget').value==='ADMIN'?'Al cambiar tu clave se cerrarán tus sesiones de administrador.':'Al cambiar la clave se cerrarán las sesiones de todos los comercios. Solo cambia la clave del local elegido; los demás vuelven a entrar con su clave vigente.';};
$('accessForm').onsubmit=e=>{e.preventDefault();task(async()=>{
  if($('newPassword').value!==$('confirmPassword').value)throw Error('Las dos claves nuevas no coinciden.');
  const input={target:$('accessTarget').value,current:$('currentPassword').value,password:$('newPassword').value};
  try{const r=await api('adminSetAccess',['sesion',input]);message(r.message);if(r.logout){$('workspace').hidden=true;$('login').hidden=false;$('password').value='';$('orders').replaceChildren();$('created').hidden=true;stock=null;}}
  finally{$('currentPassword').value='';$('newPassword').value='';$('confirmPassword').value='';}
});};
// Recuperar sesión sin pedir la clave de nuevo mientras siga vigente.
task(async()=>{try{await refresh();$('login').hidden=true;$('workspace').hidden=false;recover();}catch(e){if(!/Sesión vencida/.test(e.message))message(e.message,true);}});
