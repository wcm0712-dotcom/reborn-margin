import {inspectImage,MAX_BYTES,MAX_PIXELS} from './backend/image-guard.mjs?v=reborn-ui-sizing-order-margin-01';

export const MAX_SOURCE_PIXELS=24000000;
const MAX_DECODE_BYTES=112*1024*1024;
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');

function jpegSize(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=2;
  while(offset+4<=bytes.length) {
    if(bytes[offset++]!==255)throw new Error('JPEG_STRUCTURE');
    while(bytes[offset]===255)offset++;
    const marker=bytes[offset++];
    if(marker===217||marker===218)break;
    if(offset+2>bytes.length)throw new Error('JPEG_STRUCTURE');
    const length=view.getUint16(offset);
    if(length<2||offset+length>bytes.length)throw new Error('JPEG_STRUCTURE');
    if([192,193,194].includes(marker)) {
      if(length<8)throw new Error('JPEG_STRUCTURE');
      const width=view.getUint16(offset+5),height=view.getUint16(offset+3);
      if(!width||!height||width*height>MAX_SOURCE_PIXELS||(width*height>MAX_PIXELS&&Math.max(width,height)>8192))throw new Error('JPG_SOURCE_DIMENSION');
      const count=bytes[offset+7],components=[];
      if(count<1||count>4||length<8+3*count)throw new Error('JPEG_STRUCTURE');
      for(let index=0;index<count;index++) {
        const sampling=bytes[offset+9+index*3],horizontal=sampling>>4,vertical=sampling&15;
        if(!horizontal||!vertical||horizontal>4||vertical>4)throw new Error('JPEG_STRUCTURE');
        components.push({horizontal,vertical});
      }
      const maxH=Math.max(...components.map(item=>item.horizontal)),maxV=Math.max(...components.map(item=>item.vertical));
      let decodeBytes=width*height*(count+4);
      for(const item of components) {
        decodeBytes+=Math.ceil(width/8/maxH)*item.horizontal*Math.ceil(height/8/maxV)*item.vertical*256;
        decodeBytes+=Math.ceil(Math.ceil(width/8)*item.horizontal/maxH)*Math.ceil(Math.ceil(height/8)*item.vertical/maxV)*64;
      }
      return {mime:'image/jpeg',width,height,decodeBytes};
    }
    offset+=length;
  }
  throw new Error('JPEG_STRUCTURE');
}

function jpegEnd(bytes) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let offset=2,scan=false,scanned=false;
  while(offset<bytes.length) {
    if(scan)while(offset<bytes.length&&bytes[offset]!==255)offset++;
    if(offset>=bytes.length)break;
    if(bytes[offset++]!==255)throw new Error('JPEG_STRUCTURE');
    while(bytes[offset]===255)offset++;
    if(offset>=bytes.length)break;
    const marker=bytes[offset++];
    if(scan&&(marker===0||(marker>=208&&marker<=215)))continue;
    if(marker===217) {
      if(!scanned)throw new Error('JPEG_STRUCTURE');
      return offset;
    }
    if(marker===1)continue;
    if(marker===0||marker===216||(marker>=208&&marker<=215))throw new Error('JPEG_STRUCTURE');
    if(offset+2>bytes.length)break;
    const length=view.getUint16(offset);
    if(length<2)throw new Error('JPEG_STRUCTURE');
    if(offset+length>bytes.length)break;
    offset+=length;scan=marker===218;scanned ||= scan;
  }
  throw new Error('JPEG_INCOMPLETE');
}

export async function preparePhoto(file,active=()=>{}) {
  if(!/\.(jpe?g|png)$/i.test(file.name))throw new Error('JPG·JPEG·정지 PNG 파일을 선택해주세요.');
  if(!file.size||file.size>MAX_BYTES)throw new Error('파일 크기는 0바이트 초과·10MB 이하여야 합니다.');
  active();
  const bytes=new Uint8Array(await file.arrayBuffer());active();
  const jpeg=bytes[0]===255&&bytes[1]===216;
  const source=jpeg?jpegSize(bytes):inspectImage(bytes);
  if(jpeg)jpegEnd(bytes);
  const sourceHash=await digest(bytes);active();
  const normalized=new File([file],file.name,{type:source.mime,lastModified:file.lastModified});
  let bitmap,canvas;
  try {
    if(typeof createImageBitmap!=='function')throw new Error('이 브라우저는 사진 검증을 지원하지 않습니다. 최신 Chrome·Edge에서 다시 선택해주세요.');
    bitmap=await createImageBitmap(normalized,{imageOrientation:'from-image'});active();
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height!==source.width*source.height)throw new Error('IMAGE_DIMENSION_MISMATCH');
    if(source.width*source.height<=MAX_PIXELS&&(!jpeg||source.decodeBytes<=MAX_DECODE_BYTES)) {
      inspectImage(bytes);
      return {file:normalized,source,output:source,sourceHash,hash:sourceHash,resized:false};
    }
    canvas=document.createElement('canvas');
    for(const target of [8000000,5000000]) {
      active();const scale=Math.min(1,Math.sqrt(target/(bitmap.width*bitmap.height)));
      canvas.width=Math.max(1,Math.floor(bitmap.width*scale));canvas.height=Math.max(1,Math.floor(bitmap.height*scale));
      const context=canvas.getContext('2d');
      if(!context)throw new Error('이미지 처리 기능을 사용할 수 없습니다. 최신 브라우저로 다시 선택해주세요.');
      context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);active();
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('업로드용 사본 생성 실패')),'image/jpeg',0.94));active();
      const outputBytes=new Uint8Array(await blob.arrayBuffer());active();
      if(outputBytes.length>MAX_BYTES)continue;
      const output=inspectImage(outputBytes);
      if(output.mime!=='image/jpeg'||output.width!==canvas.width||output.height!==canvas.height)throw new Error('IMAGE_DIMENSION_MISMATCH');
      if(jpegSize(outputBytes).decodeBytes>MAX_DECODE_BYTES)continue;
      const hash=await digest(outputBytes);active();
      return {file:new File([blob],file.name.replace(/\.[^.]+$/,'').slice(0,200)+'_upload-copy.jpg',{type:'image/jpeg',lastModified:file.lastModified}),source,output,sourceHash,hash,resized:true};
    }
    throw new Error('서버 처리 한도에 맞는 사본을 만들지 못했습니다. 원본을 보관하고 더 작은 사본을 선택해주세요.');
  } finally {
    bitmap?.close();if(canvas){canvas.width=1;canvas.height=1;}
  }
}
