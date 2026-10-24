(function (root) {
  'use strict';
  const library=typeof module!=='undefined'&&module.exports?require('./vendor/fflate-0.8.2.min.js'):root.fflate;
  const prefix='RBLS1:', maximumNodes=500000, maximumText=128*1024*1024;
  const snapshotKeys=new Set(['reborn.wms.backups.v3','reborn.wms.undo.v1']);
  const ownedKeys=new Set(['reborn.wms.state.v4.safe','reborn.wms.backups.v3','reborn.wms.undo.v1','reborn.wms.lastOrderAnalysis.v3']);
  const sources=new WeakMap(),graphs=new Map();
  const crcTable=Uint32Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
  function checksum(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return((value^0xffffffff)>>>0).toString(16);}
  function base64(bytes){let text='';for(let offset=0;offset<bytes.length;offset+=8192)text+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return btoa(text);}
  function open(raw){
    if(graphs.has(raw))return graphs.get(raw);
    if(!library?.gzipSync)throw new Error('로컬 저장 압축 기능을 불러오지 못했습니다.');
    const parts=raw.slice(prefix.length).split(':');
    if(parts.length!==3||!/^\d+$/.test(parts[0])||!/^\w{1,8}$/.test(parts[1])||parts[2].length>16*1024*1024)throw new Error('로컬 저장 형식을 확인해야 합니다.');
    const expected=Number(parts[0]);if(expected>32*1024*1024)throw new Error('로컬 저장 크기 한도를 초과했습니다.');
    const compressed=Uint8Array.from(atob(parts[2]),char=>char.charCodeAt(0));
    const bytes=library.gunzipSync(compressed,{out:new Uint8Array(expected)});
    if(bytes.length!==expected||checksum(bytes)!==parts[1])throw new Error('로컬 저장 무결성 검사에 실패했습니다.');
    const graph=JSON.parse(library.strFromU8(bytes));
    if(!graph||!Array.isArray(graph.nodes)||graph.nodes.length>maximumNodes||!Number.isInteger(graph.root)||graph.root<0||graph.root>=graph.nodes.length)throw new Error('로컬 저장 구조가 올바르지 않습니다.');
    function validRef(reference,index){if(!Number.isInteger(reference)||reference<0||reference>=index)throw new Error('로컬 저장 참조가 올바르지 않습니다.');}
    const depths=[];
    graph.nodes.forEach((node,index)=>{
      if(!Array.isArray(node)||node.length!==2)throw new Error('로컬 저장 항목이 올바르지 않습니다.');
      if(node[0]==='v'){if(node[1]!==null&&!['string','number','boolean'].includes(typeof node[1]))throw new Error('로컬 저장 값이 올바르지 않습니다.');}
      else if(node[0]==='a'&&Array.isArray(node[1]))node[1].forEach(reference=>validRef(reference,index));
      else if(node[0]==='o'&&Array.isArray(node[1])){const keys=new Set();for(const pair of node[1]){if(!Array.isArray(pair)||pair.length!==2||typeof pair[0]!=='string'||keys.has(pair[0]))throw new Error('로컬 저장 속성이 올바르지 않습니다.');keys.add(pair[0]);validRef(pair[1],index);}}
      else throw new Error('로컬 저장 노드가 올바르지 않습니다.');
      const references=node[0]==='a'?node[1]:node[0]==='o'?node[1].map(pair=>pair[1]):[];
      depths[index]=references.reduce((depth,reference)=>Math.max(depth,depths[reference]+1),0);if(depths[index]>120)throw new Error('로컬 저장 구조가 너무 깊습니다.');
    });
    const texts=new Map();
    graph.text=reference=>{
      if(texts.has(reference))return texts.get(reference);
      const node=graph.nodes[reference];let text;
      if(node[0]==='v')text=JSON.stringify(node[1]);
      else{const parts=node[0]==='a'?node[1].map(graph.text):node[1].map(([key,child])=>JSON.stringify(key)+':'+graph.text(child));if(parts.reduce((sum,part)=>sum+part.length+1,2)>maximumText)throw new Error('로컬 저장 복원 한도를 초과했습니다.');text=(node[0]==='a'?'[':'{')+parts.join(',')+(node[0]==='a'?']':'}');}
      texts.set(reference,text);return text;
    };
    graphs.set(raw,graph);if(graphs.size>4)graphs.delete(graphs.keys().next().value);return graph;
  }
  function parse(raw,{snapshots=false}={}){
    if(!raw?.startsWith(prefix))return JSON.parse(raw);
    const graph=open(raw),rootNode=graph.nodes[graph.root];
    if(!snapshots)return JSON.parse(graph.text(graph.root));
    if(rootNode[0]!=='a')throw new Error('복구 백업 목록 형식이 올바르지 않습니다.');
    return rootNode[1].map(reference=>{
      const node=graph.nodes[reference];if(node[0]!=='o')throw new Error('복구 백업 형식이 올바르지 않습니다.');
      const record={},source={graph,loaded:false,stateRef:null};
      for(const[key,child]of node[1]){
        if(key==='state'){source.stateRef=child;let state;Object.defineProperty(record,key,{enumerable:true,configurable:true,get(){if(!source.loaded){state=JSON.parse(graph.text(child));source.loaded=true;}return state;},set(value){source.loaded=true;state=value;}});}
        else Object.defineProperty(record,key,{value:JSON.parse(graph.text(child)),enumerable:true,writable:true,configurable:true});
      }
      if(source.stateRef!==null)sources.set(record,source);return record;
    });
  }
  function encode(value){
    if(!library?.gzipSync)throw new Error('로컬 저장 압축 기능을 불러오지 못했습니다.');
    const nodes=[],known=new Map(),active=new WeakSet(),imported=new WeakMap(),visited=new WeakMap();
    function intern(node){const signature=JSON.stringify(node);if(known.has(signature))return known.get(signature);if(nodes.length>=maximumNodes)throw new Error('로컬 저장 항목 한도를 초과했습니다.');const reference=nodes.length;nodes.push(node);known.set(signature,reference);return reference;}
    function importNode(graph,reference){let cache=imported.get(graph);if(!cache){cache=new Map();imported.set(graph,cache);}if(cache.has(reference))return cache.get(reference);const node=graph.nodes[reference],copy=node[0]==='a'?['a',node[1].map(child=>importNode(graph,child))]:node[0]==='o'?['o',node[1].map(([key,child])=>[key,importNode(graph,child)])]:node;const result=intern(copy);cache.set(reference,result);return result;}
    function visit(current,depth=0){
      if(depth>120)throw new Error('로컬 저장 구조가 너무 깊습니다.');
      if(current===null||typeof current!=='object')return intern(['v',current===undefined||typeof current==='function'||typeof current==='symbol'||typeof current==='number'&&!Number.isFinite(current)?null:current]);
      if(visited.has(current))return visited.get(current);
      if(typeof current.toJSON==='function')return visit(current.toJSON(),depth+1);
      if(active.has(current))throw new Error('순환 참조는 저장할 수 없습니다.');active.add(current);
      let node;
      if(Array.isArray(current))node=['a',Array.from(current,child=>visit(child,depth+1))];
      else{const source=sources.get(current),pairs=[];for(const key of Object.keys(current)){
        if(key==='state'&&source&&!source.loaded){pairs.push([key,importNode(source.graph,source.stateRef)]);continue;}
        const child=current[key];if(['undefined','function','symbol'].includes(typeof child))continue;pairs.push([key,visit(child,depth+1)]);
      }node=['o',pairs];}
      active.delete(current);const result=intern(node);visited.set(current,result);return result;
    }
    const reference=visit(value),text=JSON.stringify({nodes,root:reference}),bytes=library.strToU8(text);
    if(bytes.length>32*1024*1024)throw new Error('로컬 저장 크기 한도를 초과했습니다.');
    return prefix+bytes.length+':'+checksum(bytes)+':'+base64(library.gzipSync(bytes,{level:6}));
  }
  function compact(storage,except){
    for(const key of ownedKeys){
      if(key===except)continue;
      try{const raw=storage.getItem(key);if(!raw||raw.startsWith(prefix))continue;const encoded=encode(parse(raw));if(encoded.length<raw.length){storage.setItem(key,encoded);if(storage.getItem(key)!==encoded)throw new Error('저장 확인 실패');}}catch{}
    }
  }
  function write(storage,key,value){
    if(!ownedKeys.has(key))throw new Error('앱 전용 저장 키가 아닙니다.');
    const encoded=encode(value);
    try{storage.setItem(key,encoded);}catch(error){if(error.name!=='QuotaExceededError'&&error.code!==22&&error.code!==1014)throw error;compact(storage,key);storage.setItem(key,encoded);}
    if(storage.getItem(key)!==encoded)throw new Error('브라우저 저장 확인에 실패했습니다.');return true;
  }
  const api=Object.freeze({parse,encode,write,owns:key=>ownedKeys.has(key),isSnapshots:key=>snapshotKeys.has(key),isPacked:raw=>typeof raw==='string'&&raw.startsWith(prefix)});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RebornLocalStore=api;
})(typeof window!=='undefined'?window:globalThis);
