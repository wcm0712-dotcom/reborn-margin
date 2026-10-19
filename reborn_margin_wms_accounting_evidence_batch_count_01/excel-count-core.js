(function (scope) {
  'use strict';
  const special = new Set(['lkh5209','live_rock','lkh52009']);
  const clean = value => value == null ? '' : String(value).replace(/\u00a0/g,' ').trim();
  const label = value => clean(value).toLowerCase().replace(/[\s_]/g,'');
  function seller(site, account) {
    if (special.has(clean(account).toLowerCase())) return 'lkh5209 통합판매자';
    return clean(site).match(/\(([^)]+)\)/)?.[1]?.trim() || clean(site) || clean(account);
  }
  function fee(value) {
    const text = clean(value).replace(/[,원₩\s]/g,'');
    if (!text) return {status:'empty',amount:0};
    if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) return {status:'review',amount:null};
    return {status:Number(text)>0?'positive':'zero',amount:Number(text)};
  }
  function analyze(rows, options = {}) {
    const headerIndex = (options.headerRow || 1)-1, header = rows[headerIndex] || [];
    const required = [[2,['사이트','판매자','판매자명','판매처']],[7,['주문선택사항','옵션','옵션명','상품옵션']]];
    const headerErrors = required.filter(([index,names])=>!names.some(name=>label(header[index])===label(name))).map(([index])=>index===2?'C열 사이트/판매자 헤더 확인 필요':'H열 주문선택사항 헤더 확인 필요');
    const hasAA = Boolean(clean(header[26])), hasX = ['배송비','추가배송비','배송료'].includes(label(header[23]));
    if (hasAA && !['판매자','판매자명','판매아이디','판매자아이디','판매자id','판매id','아이디'].includes(label(header[26]))) headerErrors.push('AA열 판매자/판매아이디 헤더 확인 필요');
    const identifiers = ['낙찰번호','주문번호','주문id','orderid'].includes(label(header[10]));
    const formula = new Set(options.formulas || []), records = [], warnings = [];
    const statusColumns = header.map((value,index) => ['주문상태','처리상태','배송상태'].includes(label(value)) ? index : -1).filter(index => index >= 0);
    if (headerErrors.length) return {blocked:true,headerErrors,records:[],warnings,hasAA,hasX};
    if (!hasAA) warnings.push('AA열 없음: C열로 판정 가능한 행만 집계');
    if (!hasX) warnings.push('X열 배송비 헤더 미확인: 배송비 전체 합계 미확정');
    let dataRows=0;
    for (let index=headerIndex+1;index<rows.length;index++) {
      const values=rows[index] || [];
      if (!values.some(value=>clean(value))) continue;
      dataRows++;
      const rowNumber=index+1, site=clean(values[2]), account=hasAA?clean(values[26]):'', option=clean(values[7]);
      const reasons=[];
      if ([site,option].some(value => /^(?:합계|총합계|총계|소계)$/.test(value))) reasons.push('합계/소계 가능 행 확인 필요');
      if (statusColumns.some(column => /취소|반품|환불/.test(clean(values[column])))) reasons.push('취소/반품/환불 상태 확인 필요');
      if (!option) reasons.push('H열 주문선택사항 비어 있음');
      const resolved=seller(site,account);
      if (!resolved) reasons.push('판매자 확인 불가');
      if ([2,7,26].some(column=>formula.has(rowNumber+':'+column))) reasons.push('필수 셀 수식: 저장된 값 확인 필요');
      const parsed=hasX?fee(values[23]):{status:'missing',amount:null};
      if (formula.has(rowNumber+':23')) {parsed.status='review';parsed.amount=null;}
      const identity=identifiers&&clean(values[10])&&!formula.has(rowNumber+':10')?JSON.stringify([site,clean(values[10])]):'';
      records.push({rowNumber,seller:resolved,option,site:clean(site).match(/\(([^)]+)\)/)?.[1]?.trim()||site||'확인 필요',valid:!reasons.length,reasons,feeStatus:parsed.status,feeAmount:parsed.amount,identity});
    }
    return {blocked:false,headerErrors:[],records,warnings,hasAA,hasX,dataRows,hiddenRows:options.hiddenRows||0,hasFilter:Boolean(options.hasFilter),identityAvailable:identifiers};
  }
  function aggregate(results) {
    const sellers=new Map(), options=new Map(), fees=new Map(), sites=new Map(), review=[], feeReview=[];
    let valid=0,dataRows=0,shippingTotal=0,charged=0,zero=0,empty=0,shippingComplete=true;
    const add=(left,right)=>{const result=left+right;if(!Number.isSafeInteger(result))throw new Error('합산 안전 정수 범위 초과');return result;};
    for(const item of results) {
      const result=item.result;if(!result || result.blocked)continue;
      if (!result.hasX) shippingComplete=false;
      dataRows=add(dataRows,result.dataRows);
      for(const record of result.records) {
        if(record.valid) {
          valid=add(valid,1);
          if(!sellers.has(record.seller))sellers.set(record.seller,{seller:record.seller,total:0,options:new Map()});
          const group=sellers.get(record.seller);group.total=add(group.total,1);group.options.set(record.option,add(group.options.get(record.option)||0,1));options.set(record.option,add(options.get(record.option)||0,1));
        } else review.push({file:item.name,sheet:item.sheet,row:record.rowNumber,reason:record.reasons.join(' / ')});
        if(record.feeStatus==='positive') {
          shippingTotal=add(shippingTotal,record.feeAmount);charged=add(charged,1);fees.set(record.feeAmount,add(fees.get(record.feeAmount)||0,1));
          const site=sites.get(record.site)||{site:record.site,count:0,total:0};site.count=add(site.count,1);site.total=add(site.total,record.feeAmount);sites.set(record.site,site);
        } else if(record.feeStatus==='zero')zero++;
        else if(record.feeStatus==='empty')empty++;
        else {shippingComplete=false;feeReview.push({file:item.name,sheet:item.sheet,row:record.rowNumber,reason:record.feeStatus==='missing'?'X열 미확인':'배송비 숫자/수식 확인 필요'});}
      }
    }
    const order=(left,right)=>right.count-left.count||left.option.localeCompare(right.option,'ko');
    const groups=Array.from(sellers.values()).map(group=>({seller:group.seller,total:group.total,options:Array.from(group.options,([option,count])=>({option,count})).sort(order)})).sort((left,right)=>right.total-left.total||left.seller.localeCompare(right.seller,'ko'));
    return {valid,dataRows,review,feeReview,groups,options:Array.from(options,([option,count])=>({option,count})).sort(order),shippingTotal,shippingComplete,charged,zero,empty,fees:Array.from(fees,([amount,count])=>({amount,count,total:amount*count})).sort((left,right)=>left.amount-right.amount),sites:Array.from(sites.values()).sort((left,right)=>right.total-left.total),reconciles:groups.reduce((sum,group)=>sum+group.total,0)===valid&&Array.from(options.values()).reduce((sum,count)=>sum+count,0)===valid};
  }
  function safeText(value) {const text=clean(value);return /^[\s\u0000-\u001f]*[=+@-]/.test(text)?"'"+text:text;}
  scope.RebornCountCore=Object.freeze({clean,seller,fee,analyze,aggregate,safeText});
  if(typeof module!=='undefined'&&module.exports)module.exports=scope.RebornCountCore;
})(typeof self!=='undefined'?self:globalThis);
