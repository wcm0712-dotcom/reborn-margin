export const MAX_BYTES=10*1024*1024;
export const MAX_PIXELS=12000000;
export function inspectImage(bytes){
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_BYTES)throw new Error('IMAGE_SIZE');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let width=0,height=0,mime='';
 if(bytes.length>24&&bytes.slice(0,8).every((value,index)=>value===[137,80,78,71,13,10,26,10][index])){mime='image/png';width=view.getUint32(16);height=view.getUint32(20);let offset=8;while(offset+12<=bytes.length){const length=view.getUint32(offset);if(length>bytes.length-offset-12)throw new Error('PNG_STRUCTURE');const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));if(type==='acTL')throw new Error('ANIMATED_IMAGE');offset+=length+12;if(type==='IEND')break;}}
 else if(bytes[0]===255&&bytes[1]===216){mime='image/jpeg';let offset=2;while(offset+4<bytes.length){if(bytes[offset++]!==255)throw new Error('JPEG_STRUCTURE');while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)throw new Error('JPEG_STRUCTURE');if([192,193,194].includes(marker)){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;}}
 if(!mime||!width||!height||width*height>MAX_PIXELS)throw new Error('IMAGE_FORMAT_OR_DIMENSION');
 return {mime,width,height};
}
export function reduceImage(image,maxSide){
 const ratio=Math.min(1,maxSide/Math.max(image.width,image.height)),width=Math.max(1,Math.round(image.width*ratio)),height=Math.max(1,Math.round(image.height*ratio));
 const data=new Uint8Array(width*height*4);
 for(let row=0;row<height;row++)for(let column=0;column<width;column++){const source=(Math.min(image.height-1,Math.floor(row/ratio))*image.width+Math.min(image.width-1,Math.floor(column/ratio)))*4;const target=(row*width+column)*4;for(let channel=0;channel<3;channel++)data[target+channel]=Math.round(image.data[source+channel]*(image.data[source+3]/255)+255*(1-image.data[source+3]/255));data[target+3]=255;}
 return {width,height,data};
}
