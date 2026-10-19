import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import jpeg from 'npm:jpeg-js@0.4.4';
import { PNG } from 'npm:pngjs@7.0.0';
import { Buffer } from 'node:buffer';
import {inspectImage,reduceImage,MAX_BYTES} from './image-guard.mjs';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Content-Type':'application/json'};
const json=(status:number,value:unknown)=>new Response(JSON.stringify(value),{status,headers:cors});
const digest=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
function fields(value:Record<string,unknown>){const date=String(value.business_date||''),partner=String(value.partner||'').trim(),kind=String(value.document_type||'기타'),note=String(value.note||'').trim(),review=String(value.review_status||'미검토');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||!partner||partner.length>100||kind.length>40||note.length>500||!['미검토','확인 필요','검토 완료'].includes(review))throw new Error('INVALID_FIELDS');return{business_date:date,partner,document_type:kind,note,review_status:review};}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});
 if(request.method!=='POST')return json(405,{error:'METHOD'});
 try{
  const token=request.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)return json(401,{error:'LOGIN_REQUIRED'});
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await client.auth.getUser(token);if(authError||!auth.user)return json(401,{error:'LOGIN_REQUIRED'});
  const {data:admin}=await client.from('reborn_evidence_admins').select('user_id').eq('user_id',auth.user.id).maybeSingle();if(!admin)return json(403,{error:'FORBIDDEN'});
  if(request.headers.get('content-type')?.includes('application/json')){
   const payload=await request.json();if(!/^[0-9a-f-]{36}$/i.test(payload.id)||!Number.isSafeInteger(payload.version))return json(400,{error:'INVALID_FIELDS'});
   const values=payload.action==='수정'?fields(payload.values||{}):{};
   const {data,error}=await client.rpc('reborn_evidence_change',{p_id:payload.id,p_version:payload.version,p_action:payload.action,p_values:values,p_actor:auth.user.id});
   if(error)return json(409,{error:'VERSION_CONFLICT'});return json(200,{item:data});
  }
  const length=Number(request.headers.get('content-length')||0);if(length>MAX_BYTES+65536)return json(413,{error:'IMAGE_SIZE'});
  const form=await request.formData(),original=form.get('original');if(!(original instanceof File)||original.size>MAX_BYTES)return json(400,{error:'IMAGE_SIZE'});
  if(form.get('public_confirmed')!=='true')return json(400,{error:'PUBLIC_CONFIRMATION_REQUIRED'});
  const id=String(form.get('id')||'');if(!/^[0-9a-f-]{36}$/i.test(id))return json(400,{error:'INVALID_ID'});
  const metadata=fields({business_date:form.get('business_date'),partner:form.get('partner'),document_type:form.get('document_type'),note:form.get('note')});
  const bytes=new Uint8Array(await original.arrayBuffer()),info=inspectImage(bytes);
  const decoded=info.mime==='image/jpeg'?jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:12,maxMemoryUsageInMB:128}):PNG.sync.read(Buffer.from(bytes),{checkCRC:true});
  if(decoded.width!==info.width||decoded.height!==info.height)throw new Error('IMAGE_CORRUPT');
  const preview=jpeg.encode(reduceImage(decoded,1800),82).data,thumbnail=jpeg.encode(reduceImage(decoded,360),78).data;
  const paths={original_path:id+'/original.'+(info.mime==='image/png'?'png':'jpg'),preview_path:id+'/preview.jpg',thumbnail_path:id+'/thumbnail.jpg'};
  async function ensure(path:string,body:Uint8Array,mime:string){const bucket=client.storage.from('reborn-accounting-evidence');const {error}=await bucket.upload(path,body,{contentType:mime,cacheControl:'0',upsert:false});if(!error)return;const existing=await bucket.download(path);if(!existing.data||await digest(new Uint8Array(await existing.data.arrayBuffer()))!==await digest(body))throw new Error('UPLOAD_FAILED');}
  await ensure(paths.original_path,bytes,info.mime);await ensure(paths.preview_path,preview,'image/jpeg');await ensure(paths.thumbnail_path,thumbnail,'image/jpeg');
  const {data,error}=await client.rpc('reborn_evidence_commit',{p_item:{id,...metadata,preview_path:paths.preview_path,thumbnail_path:paths.thumbnail_path},p_file:{...paths,original_name:original.name.slice(0,250),original_sha256:await digest(bytes),bytes:bytes.length,mime:info.mime},p_actor:auth.user.id});
  if(error)return json(409,{error:'SAVE_CONFLICT'});return json(200,{item:data});
 }catch{return json(400,{error:'IMAGE_OR_REQUEST_INVALID'});}
});
