importScripts('./xlsx-count-parser.min.js'+self.location.search,'./excel-count-core.js'+self.location.search);
self.onmessage=event=>{
  const {id,buffer,sheet,headerRow}=event.data;
  try {
    if(XLSX.version!=='0.20.3')throw new Error('파서 버전 확인 필요');
    const workbook=XLSX.read(buffer,{type:'array',raw:false,cellDates:false,cellStyles:true,codepage:949});
    const sheetName=sheet&&workbook.SheetNames.includes(sheet)?sheet:workbook.SheetNames[0];
    if(!sheetName)throw new Error('분석할 시트가 없습니다.');
    const source=workbook.Sheets[sheetName],range=XLSX.utils.decode_range(source['!ref']||'A1');
    if(range.e.r+1>100000||range.e.c>200||(range.e.r+1)*(range.e.c+1)>3000000)throw new Error('시트 범위가 너무 큽니다. 파일을 나누어 분석해주세요.');
    const rows=XLSX.utils.sheet_to_json(source,{header:1,defval:'',raw:false,blankrows:true,range:{s:{r:0,c:0},e:range.e}});
    const formulas=[];
    for(const key of Object.keys(source))if(!key.startsWith('!')&&source[key]?.f){const address=XLSX.utils.decode_cell(key);formulas.push((address.r+1)+':'+address.c);}
    const result=RebornCountCore.analyze(rows,{headerRow,formulas,hiddenRows:(source['!rows']||[]).filter(item=>item?.hidden).length,hasFilter:Boolean(source['!autofilter'])});
    if(source['!merges']?.length)result.warnings.push('병합셀 '+source['!merges'].length+'개: 빈 값을 자동으로 채우지 않습니다.');
    if(workbook.Workbook?.Sheets?.[workbook.SheetNames.indexOf(sheetName)]?.Hidden)result.warnings.push('숨김 시트를 분석했습니다.');
    self.postMessage({id,ok:true,result,sheet:sheetName,sheets:workbook.SheetNames});
  }catch{self.postMessage({id,ok:false,error:'파일 형식·손상·암호 또는 시트 범위를 확인해주세요.'});}
};
