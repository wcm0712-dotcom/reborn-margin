(function (root) {
  'use strict';
  const categories = typeof module !== 'undefined' && module.exports ? require('./evidence-categories-core.js') : root.RebornEvidenceCategories;
  function dateInfo(value, today = '') {
    const text = typeof value === 'string' ? value : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return {value:null,label:text?'날짜 확인 필요':'날짜 미상',future:false};
    const parsed = new Date(text + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== text) return {value:null,label:'날짜 확인 필요',future:false};
    return {value:text,label:text,future:Boolean(today && text > today)};
  }
  function timestamp(value) {
    const parts = typeof value === 'string' && value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/i);
    if (!parts || !dateInfo(parts[1]).value || Number(parts[2])>23 || Number(parts[3])>59 || Number(parts[4] || 0)>59) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  function descending(left, right) {
    if (left === right) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return left > right ? -1 : 1;
  }
  function compare(left, right, mode = 'business') {
    const created = descending(timestamp(left.created_at),timestamp(right.created_at));
    const business = descending(dateInfo(left.business_date).value,dateInfo(right.business_date).value);
    return (mode === 'created' ? created : business || created) || String(left.id).localeCompare(String(right.id),'en');
  }
  function select(rows, selection = {}) {
    const search = String(selection.search || '').trim().normalize('NFKC').toLocaleLowerCase('ko');
    if (selection.from && selection.to && selection.from > selection.to) throw new Error('조회 시작일과 종료일을 확인해주세요.');
    return rows.filter(item => {
      const date = dateInfo(item.business_date).value;
      return (selection.partner == null || item.partner === selection.partner)
        && (!search || String(item.partner || '').normalize('NFKC').toLocaleLowerCase('ko').includes(search))
        && (!selection.from || date !== null && date >= selection.from)
        && (!selection.to || date !== null && date <= selection.to)
        && (!selection.type || item.document_type === selection.type)
        && (!selection.review || item.review_status === selection.review);
    }).sort((left,right)=>compare(left,right,selection.sort));
  }
  function signature(rows) {
    return JSON.stringify(rows.map(item=>[item.id,item.version ?? null,item.updated_at ?? null]).sort((left,right)=>String(left[0]).localeCompare(String(right[0]),'en')));
  }
  async function readSnapshot(fetchPage, options = {}) {
    try {
      const rows = await categories.readAll((offset,limit)=>fetchPage(offset,limit,false),options);
      const stamps = await categories.readAll((offset,limit)=>fetchPage(offset,limit,true),options);
      if (signature(rows) !== signature(stamps)) throw new Error('조회 중 자료가 변경되었습니다. 이전 목록을 유지합니다. 새로고침해주세요.');
      return rows;
    } catch (error) {
      if (error.message.includes('한 번에 조회 가능한 자료 수')) throw new Error('전체 목록 조회 한도를 초과했습니다. 일부만 표시하지 않았습니다. 별도 서버 페이지 조회가 필요합니다.');
      throw error;
    }
  }
  const api=Object.freeze({dateInfo,timestamp,compare,select,signature,readSnapshot});
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.RebornEvidenceLatest=api;
})(typeof window !== 'undefined'?window:globalThis);
