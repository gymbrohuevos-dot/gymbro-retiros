import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createHmac} from 'node:crypto';
import handler from '../netlify/functions/retiros.mjs';

test('branch session supplies scope and lookups preserve legacy orders',async()=>{
 const secret='b'.repeat(64),token='a'.repeat(64);
 const previousFetch=globalThis.fetch;
 const oldEndpoint=process.env.GB_APPS_SCRIPT_URL,oldSecret=process.env.GB_BRIDGE_SECRET;
 process.env.GB_APPS_SCRIPT_URL='https://script.google.com/macros/s/fixture/exec';process.env.GB_BRIDGE_SECRET=secret;
 const actions=[];let available=true;
 globalThis.fetch=async(url,options)=>{
  const envelope=JSON.parse(options.body),p=JSON.parse(envelope.payload);
  actions.push(p.action);
  if(String(url).startsWith('https://script.google.com')){
   assert.equal(p.args[0],token);
   return Response.json({ok:true,data:p.action==='commerceHistory'?{branch:'COLON'}:{orders:[{id:'legacy'}]}});
  }
  assert.equal(p.branch,'COLON');assert.equal(p.code,'654321');
  assert.equal(envelope.signature,createHmac('sha256',secret).update('gymbro-store-branch-v1\n'+envelope.payload).digest('base64url'));
  return Response.json({ok:true,data:p.action==='lookup'?{orders:available?[{id:'store'}]:[]}:{message:'Entrega registrada: Store'}});
 };
 const call=(action,args)=>handler(new Request('https://branch.test/api/retiros',{method:'POST',headers:{origin:'https://branch.test','content-type':'application/json',cookie:'__Host-gymbro='+token},body:JSON.stringify({action,args})})).then(r=>r.json());
 try{
  assert.equal((await call('buscar',['sesion','654321',false])).data.orders[0].id,'store');
  assert.equal((await call('entregarStore',['sesion','f'.repeat(36),'version','654321'])).ok,true);
  available=false;assert.equal((await call('buscar',['sesion','654321',false])).data.orders[0].id,'legacy');
  assert.equal((await call('buscar',['sesion','1234',false])).data.orders[0].id,'legacy');
  assert.deepEqual(actions,['commerceHistory','lookup','commerceHistory','deliver','commerceHistory','lookup','buscar','buscar']);
 }finally{
  globalThis.fetch=previousFetch;
  if(oldEndpoint===undefined)delete process.env.GB_APPS_SCRIPT_URL;else process.env.GB_APPS_SCRIPT_URL=oldEndpoint;
  if(oldSecret===undefined)delete process.env.GB_BRIDGE_SECRET;else process.env.GB_BRIDGE_SECRET=oldSecret;
 }
});
