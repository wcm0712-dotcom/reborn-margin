(function (root) {
  'use strict';
  function group(rows) {
    const partners = new Map();
    for (const row of rows) {
      const name = typeof row.partner === 'string' ? row.partner : '';
      if (!name.trim()) throw new Error('업체명 없는 자료가 있어 분류를 확인해야 합니다.');
      let value = partners.get(name);
      if (!value) {value = {name,count:0,first:row.business_date,last:row.business_date}; partners.set(name,value);}
      value.count++;
      if (row.business_date < value.first) value.first = row.business_date;
      if (row.business_date > value.last) value.last = row.business_date;
    }
    return [...partners.values()].sort((left,right)=>left.name.localeCompare(right.name,'ko'));
  }
  function assertActive(signal) {if (signal?.aborted) throw new DOMException('작업이 중단되었습니다.','AbortError');}
  async function readAll(fetchPage, {signal,maxRows=50000,onProgress=()=>{}} = {}) {
    const rows = [], ids = new Set(); let expected = null;
    while (expected === null || rows.length < expected) {
      assertActive(signal);
      const result = await fetchPage(rows.length,500); assertActive(signal);
      if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0) throw new Error('자료 목록을 끝까지 확인하지 못했습니다.');
      if (expected === null) expected = result.count;
      if (expected !== result.count) throw new Error('조회 중 자료 수가 변경되었습니다. 새로고침 후 다시 시도해주세요.');
      if (expected > maxRows) throw new Error('한 번에 조회 가능한 자료 수를 초과했습니다. 기간을 나누어주세요.');
      if (!result.data.length && rows.length < expected) throw new Error('자료 목록 일부가 누락되어 작업을 중단했습니다.');
      for (const row of result.data) {
        if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('자료 목록 중복 또는 변경을 확인해야 합니다.');
        ids.add(row.id); rows.push(row);
      }
      if (rows.length > expected) throw new Error('자료 수가 일치하지 않습니다. 새로고침 후 다시 시도해주세요.');
      onProgress(rows.length,expected);
    }
    return rows;
  }
  function safeSegment(value) {
    let text = [...String(value ?? '')].slice(0,64).join('').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').trim();
    if (!text) text = '업체';
    if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(text)) text = '_'+text;
    return text;
  }
  function zipWriter({library=root.fflate,writable=null,signal,fallbackLimit=200*1024*1024,totalLimit=2*1024*1024*1024} = {}) {
    if (!library?.Zip || !library?.ZipPassThrough) throw new Error('ZIP 라이브러리를 읽지 못했습니다. 새로고침해주세요.');
    let chunks = [], pending = Promise.resolve(), failure = null, finalSeen = false, closed = false, bytes = 0;
    function guard() {assertActive(signal); if (failure) throw failure; if (closed) throw new Error('종료된 ZIP 작업입니다.');}
    const zip = new library.Zip((error,data,final) => {
      if (error) {failure = error; return;}
      bytes += data.length;
      if (bytes > totalLimit || (!writable && bytes > fallbackLimit)) {failure = new Error(writable?'ZIP 2GB 한도를 초과합니다. 기간을 나누어주세요.':'이 브라우저의 ZIP 메모리 한도는 200MB입니다. PC Chrome/Edge에서 직접 저장하거나 기간을 나누어주세요.'); return;}
      const copy = new Uint8Array(data);
      if (writable) pending = pending.then(()=>{guard(); return writable.write(copy);}).catch(error=>{failure=error;});
      else chunks.push(copy);
      if (final) finalSeen = true;
    });
    async function add(name,blob) {
      guard(); const entry = new library.ZipPassThrough(name); zip.add(entry);
      if (!blob.size) {entry.push(new Uint8Array(),true); await pending; guard(); return;}
      for (let offset=0; offset<blob.size; offset+=65536) {
        guard(); const chunk = new Uint8Array(await blob.slice(offset,offset+65536).arrayBuffer()); guard();
        entry.push(chunk,offset+chunk.length>=blob.size); await pending; guard();
        if (offset%1048576===0) await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    async function finish() {
      guard(); zip.end(); await pending; guard();
      if (!finalSeen) throw new Error('ZIP 마감 확인에 실패했습니다.');
      if (writable) {await writable.close(); closed = true; return null;}
      const result = new Blob(chunks,{type:'application/zip'}); chunks = []; closed = true; return result;
    }
    async function abort() {if (closed) return; closed = true; chunks = []; await pending; if (writable) {try {await writable.abort();} catch {}}}
    return {add,finish,abort};
  }
  const api = Object.freeze({group,readAll,safeSegment,zipWriter,assertActive});
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RebornEvidenceCategories = api;
})(typeof window !== 'undefined'?window:globalThis);
