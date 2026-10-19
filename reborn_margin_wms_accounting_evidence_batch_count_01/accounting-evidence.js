(function () {
  'use strict';
  const bucketName = 'reborn-accounting-evidence';
  const types = ['거래명세서', '영수증', '세금계산서', '입금확인', '기타'];
  const reviews = ['미검토', '확인 필요', '검토 완료'];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul'}).format(new Date());
  const safe = value => window.RebornCountCore.safeText(value);
  function init(callbacks) {
    const root = document.getElementById('evidenceCard');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = '1';
    let admin = false, lastRole = null, initialized = false, page = 0, rows = [], total = null, requestId = 0, accessId = 0;
    let selected = null, uploading = false, stopRequested = false, activeController = null, detailUrl = null, rotation = 0, zoom = 1;
    const queue = [], urls = new Set();
    root.innerHTML = `<div class="evidence-toolbar"><p>날짜·업체별 자료</p><div><button type="button" id="evidenceReload">새로고침</button><button type="button" id="evidenceExport">조건별 내려받기</button><button type="button" id="evidenceBackup" data-evidence-admin hidden>원본 백업</button><button type="button" id="evidenceNew" class="primary-btn" data-evidence-admin hidden>사진 등록</button></div></div>
      <p class="evidence-public-note">공개 자료실 · 로그인 없이 사진과 분류 정보를 조회할 수 있습니다. 사진 보관은 회계처리 완료를 뜻하지 않습니다.</p>
      <form id="evidenceFilters" class="evidence-filters"><label>시작일<input name="from" type="date"></label><label>종료일<input name="to" type="date"></label><label>업체<input name="partner" type="search" maxlength="100" placeholder="업체명"></label><label>유형<select name="type"><option value="">전체</option>${types.map(type => '<option>'+type+'</option>').join('')}</select></label><label>검토<select name="review"><option value="">전체</option>${reviews.map(value => '<option>'+value+'</option>').join('')}</select></label><label data-evidence-admin hidden>보관<select name="trash"><option value="active">일반 목록</option><option value="trash">휴지통</option></select></label><button type="submit">조회</button></form>
      <p id="evidenceStatus" role="status" aria-live="polite"></p><div id="evidenceGrid" class="evidence-grid"></div><div class="evidence-pagination"><button type="button" id="evidencePrevious">이전</button><span id="evidencePage"></span><button type="button" id="evidenceNext">다음</button></div>`;
    const byId = id => document.getElementById(id), filters = byId('evidenceFilters');
    const uploadDialog = document.createElement('dialog');
    uploadDialog.id = 'evidenceUploadDialog'; uploadDialog.className = 'evidence-dialog';
    uploadDialog.setAttribute('aria-labelledby', 'evidenceUploadTitle');
    uploadDialog.innerHTML = `<div class="evidence-dialog-heading"><h2 id="evidenceUploadTitle">회계자료 등록</h2><button type="button" data-close aria-label="등록창 닫기">닫기</button></div><form id="evidenceUploadForm"><div class="evidence-fields"><label>증빙일<input name="business_date" type="date" required></label><label>업체<input name="partner" required maxlength="100" autocomplete="off"></label><label>유형<select name="document_type">${types.map(type => '<option>'+type+'</option>').join('')}</select></label><label class="evidence-note-field">공개 메모<textarea name="note" maxlength="500" rows="2"></textarea></label></div><label class="evidence-public-confirm"><input name="public_confirmed" type="checkbox" required> 사진·업체·날짜·메모가 인터넷에 공개됨을 확인했습니다. 개인정보가 없는 자료만 등록합니다.</label><label class="evidence-file-input">사진 선택<input id="evidencePhotoInput" type="file" accept="image/jpeg,image/png" multiple></label><p>JPEG·정지 PNG · 장당 10MB/1,200만 화소 이하 · 한 번에 30장/100MB. 원본은 관리자만 내려받을 수 있습니다.</p><div id="evidenceQueue"></div><div class="evidence-actions"><button type="submit" class="primary-btn" id="evidenceUploadStart">등록 시작</button><button type="button" id="evidenceUploadStop">중단 요청</button></div><p id="evidenceUploadStatus" role="status"></p></form>`;
    const detailDialog = document.createElement('dialog');
    detailDialog.id = 'evidenceDetailDialog'; detailDialog.className = 'evidence-dialog evidence-detail-dialog';
    detailDialog.setAttribute('aria-labelledby', 'evidenceDetailTitle');
    detailDialog.innerHTML = `<div class="evidence-dialog-heading"><h2 id="evidenceDetailTitle">자료 상세</h2><button type="button" data-close aria-label="상세 닫기">닫기</button></div><div class="evidence-image-tools"><button type="button" id="evidenceZoomOut" aria-label="축소">−</button><button type="button" id="evidenceZoomIn" aria-label="확대">+</button><button type="button" id="evidenceRotate" aria-label="시계 방향 90도 회전">↻</button><button type="button" id="evidenceDownload">공개 이미지 저장</button><button type="button" id="evidenceOriginal" data-evidence-admin hidden>원본 저장</button></div><div class="evidence-image-stage"><img id="evidenceDetailImage" alt="선택한 회계자료"></div><form id="evidenceEditForm"><div id="evidenceDetailFields" class="evidence-fields"></div><div class="evidence-actions" data-evidence-admin hidden><button type="submit" class="primary-btn">분류 저장</button><button type="button" id="evidenceTrash">휴지통으로 이동</button><button type="button" id="evidenceRestore">복원</button></div></form><p id="evidenceDetailStatus" role="status"></p><div id="evidenceEvents" data-evidence-admin hidden></div>`;
    document.body.append(uploadDialog, detailDialog);
    function client() { const value = callbacks.getClient(); if (!value) throw new Error('사진 연결을 초기화하지 못했습니다. 네트워크와 라이브러리를 확인해주세요.'); return value; }
    function status(text, error = false) {byId('evidenceStatus').textContent = text; byId('evidenceStatus').classList.toggle('evidence-error', error);}
    function showAdmin() {for (const target of [root,uploadDialog,detailDialog]) target.querySelectorAll('[data-evidence-admin]').forEach(element => element.hidden = !admin);}
    function releaseUrl(url) {if (url) {URL.revokeObjectURL(url); urls.delete(url);}}
    function objectUrl(blob) {const url = URL.createObjectURL(blob); urls.add(url); return url;}
    function clearUrls() {for (const url of urls) URL.revokeObjectURL(url); urls.clear(); detailUrl = null;}
    function resetQueue() {queue.splice(0); renderQueue(); byId('evidencePhotoInput').value = '';}
    async function refreshAccess() {
      const role = Boolean(callbacks.isAdmin());
      if (role === lastRole) return;
      lastRole = role; const token = ++accessId; admin = false; showAdmin();
      if (!role) {
        stopRequested = true; activeController?.abort();
        if (uploadDialog.open) uploadDialog.close(); if (detailDialog.open) detailDialog.close();
        resetQueue(); clearUrls(); page = 0;
      } else {
        try {const result = await client().rpc('reborn_evidence_can_manage'); if (token === accessId && !result.error && result.data === true) admin = true;} catch {}
      }
      if (token !== accessId) return; showAdmin(); if (initialized) load();
    }
    function query(limit = 24, offset = page * 24) {
      const values = new FormData(filters), from = values.get('from'), to = values.get('to');
      if (from && to && from > to) throw new Error('조회 시작일과 종료일을 확인해주세요.');
      let result = client().from('reborn_evidence_items').select('id,business_date,partner,document_type,review_status,note,preview_path,thumbnail_path,created_at,updated_at,version,deleted_at', {count:'exact'}).eq('ready',true);
      result = admin && values.get('trash') === 'trash' ? result.not('deleted_at','is',null) : result.is('deleted_at',null);
      if (from) result = result.gte('business_date',from); if (to) result = result.lte('business_date',to);
      const partner = String(values.get('partner') || '').trim();
      if (partner) result = result.ilike('partner','%'+partner.replace(/[\\%_]/g,'\\$&')+'%');
      if (values.get('type')) result = result.eq('document_type',values.get('type'));
      if (values.get('review')) result = result.eq('review_status',values.get('review'));
      return result.order('business_date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:true}).range(offset,offset+limit-1);
    }
    async function image(path) {const response = await client().storage.from(bucketName).download(path); if (response.error || !response.data) throw new Error('사진을 불러오지 못했습니다.'); return response.data;}
    async function load() {
      const token = ++requestId; status('자료를 불러오는 중입니다.');
      try {
        const result = await query(); if (token !== requestId) return;
        if (result.error) throw new Error('자료 조회에 실패했습니다. 연결과 사진 저장소 설정을 확인해주세요.');
        if (detailDialog.open) detailDialog.close(); clearUrls(); rows = result.data || []; total = result.count;
        byId('evidenceGrid').innerHTML = rows.map(item => `<button type="button" class="evidence-item" data-evidence-id="${item.id}"><div class="evidence-thumb"><img alt="${escape(item.partner)} ${escape(item.business_date)} 자료" loading="lazy"><span>사진 읽는 중</span></div><div><time>${escape(item.business_date)}</time><strong>${escape(item.partner)}</strong><span>${escape(item.document_type)} · ${escape(item.review_status)}</span></div></button>`).join('');
        status(total === 0 ? '조건에 맞는 자료가 없습니다.' : `${Number(total).toLocaleString('ko-KR')}개 자료 · 공개 미리보기`);
        byId('evidencePage').textContent = `${page+1} / ${Math.max(1,Math.ceil(total/24))}`;
        byId('evidencePrevious').disabled = page === 0; byId('evidenceNext').disabled = (page+1)*24 >= total;
        for (let index = 0; index < rows.length; index += 4) {
          await Promise.all(rows.slice(index,index+4).map(async item => {
            const element = root.querySelector('[data-evidence-id="'+item.id+'"] .evidence-thumb');
            try {const blob = await image(item.thumbnail_path); if (token !== requestId || !element?.isConnected) return; element.querySelector('img').src = objectUrl(blob); element.querySelector('span').hidden = true;} catch {if (element?.isConnected) element.querySelector('span').textContent = '사진 조회 실패';}
          }));
          if (token !== requestId) return;
        }
      } catch (error) {if (token === requestId) {rows = []; total = null; clearUrls(); byId('evidenceGrid').replaceChildren(); byId('evidencePage').textContent = '조회 미완료'; byId('evidencePrevious').disabled = true; byId('evidenceNext').disabled = true; status(error.message,true);}}
    }
    function save(blob,name) {const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),60000);}
    async function original(item) {if (!admin || !callbacks.isAdmin()) throw new Error('관리자만 원본을 조회할 수 있습니다.'); const result = await client().from('reborn_evidence_files').select('original_path,original_name,original_sha256,bytes,mime').eq('id',item.id).single(); if (result.error || !result.data) throw new Error('원본 정보 조회 실패'); return result.data;}
    function transform() {const photo = byId('evidenceDetailImage'); photo.style.transform = `scale(${zoom}) rotate(${rotation}deg)`;}
    async function openDetail(id) {
      const item = rows.find(value => value.id === id); if (!item) return; selected = item; rotation = 0; zoom = 1;
      releaseUrl(detailUrl); detailUrl = null; const photo = byId('evidenceDetailImage'); photo.removeAttribute('src'); transform();
      byId('evidenceDetailTitle').textContent = item.partner+' · '+item.business_date;
      byId('evidenceDetailStatus').textContent = '사진을 불러오는 중입니다.'; byId('evidenceEvents').replaceChildren();
      const disabled = admin ? '' : 'disabled';
      byId('evidenceDetailFields').innerHTML = `<label>증빙일<input name="business_date" type="date" required value="${escape(item.business_date)}" ${disabled}></label><label>업체<input name="partner" required maxlength="100" value="${escape(item.partner)}" ${disabled}></label><label>유형<select name="document_type" ${disabled}>${[...new Set([...types,item.document_type])].map(value => '<option '+(value===item.document_type?'selected':'')+'>'+escape(value)+'</option>').join('')}</select></label><label>검토<select name="review_status" ${disabled}>${reviews.map(value => '<option '+(value===item.review_status?'selected':'')+'>'+value+'</option>').join('')}</select></label><label class="evidence-note-field">공개 메모<textarea name="note" maxlength="500" rows="2" ${disabled}>${escape(item.note)}</textarea></label>`;
      showAdmin(); byId('evidenceTrash').hidden = Boolean(item.deleted_at); byId('evidenceRestore').hidden = !item.deleted_at;
      detailDialog.showModal();
      try {const blob = await image(item.preview_path); if (!detailDialog.open || selected !== item) return; detailUrl = objectUrl(blob); photo.src = detailUrl; byId('evidenceDetailStatus').textContent = '회전·확대는 화면에만 적용됩니다. 공개 이미지의 EXIF는 제거되어 있습니다.';} catch (error) {byId('evidenceDetailStatus').textContent = error.message;}
      if (admin) {
        const result = await client().from('reborn_evidence_events').select('action,at,details').eq('item_id',item.id).order('at',{ascending:false}).limit(30);
        if (detailDialog.open && selected === item) byId('evidenceEvents').innerHTML = result.error ? '<p>변경 이력 조회 실패</p>' : '<h3>최근 변경 이력</h3>'+result.data.map(value => '<div><p>'+escape(new Date(value.at).toLocaleString('ko-KR'))+' · '+escape(value.action)+'</p>'+(value.details?.before?'<details><summary>변경 내용</summary>'+[['business_date','증빙일'],['partner','업체'],['document_type','유형'],['review_status','검토'],['note','메모'],['deleted_at','휴지통 시각']].filter(([key])=>value.details.before[key]!==value.details.after?.[key]).map(([key,label])=>'<p>'+label+': '+escape(value.details.before[key]||'없음')+' → '+escape(value.details.after?.[key]||'없음')+'</p>').join('')+'</details>':'')+'</div>').join('');
      }
    }
    async function invoke(body, signal) {const result = await client().functions.invoke('reborn-evidence-api',{body,signal}); if (result.error || !result.data?.item) throw new Error('저장 확인에 실패했습니다. 권한·연결·다른 사용자의 변경을 확인하고 새로고침해주세요.'); return result.data.item;}
    async function change(action) {
      if (!admin || !callbacks.isAdmin() || !selected) return;
      const item = selected, form = byId('evidenceEditForm'); if (action === '수정' && !form.reportValidity()) return;
      if (!confirm(action==='수정'?'분류를 저장할까요? 업체·메모는 공개됩니다.':action==='휴지통'?'공개 목록에서 숨기고 휴지통으로 이동할까요? 원본은 보존됩니다.':'공개 목록으로 복원할까요?')) return;
      const buttons = [...form.querySelectorAll('button')]; buttons.forEach(button => button.disabled = true);
      try {await invoke({id:item.id,version:item.version,action,values:Object.fromEntries(new FormData(form))}); detailDialog.close(); await load();} catch (error) {byId('evidenceDetailStatus').textContent = error.message;} finally {buttons.forEach(button => button.disabled = false);}
    }
    function renderQueue() {byId('evidenceQueue').innerHTML = queue.map(item => `<div class="evidence-queue-item"><div><strong>${escape(item.file.name)}</strong><span>${escape(item.status)}${item.duplicate?' · 동일 이미지 후보':''}</span><progress max="100" value="${item.progress || 0}" aria-label="${escape(item.file.name)} 단계 진행률"></progress></div><div>${!uploading?'<button type="button" data-queue-remove="'+item.id+'" title="대기 목록에서만 제거합니다. 이미 저장한 사진은 남습니다.">목록에서 제거</button>':''}</div></div>`).join('');}
    async function addPhotos(files) {
      if (!admin || uploading) return;
      if (queue.length+files.length > 30 || [...queue.map(item => item.file),...files].reduce((sum,file) => sum+file.size,0) > 100*1024*1024) {byId('evidenceUploadStatus').textContent = '한 번에 30장·100MB 이하로 선택해주세요.'; return;}
      for (const file of files) {
        const item = {id:crypto.randomUUID(),file,status:'대기',progress:0,hash:'',snapshot:null}; queue.push(item); renderQueue();
        try {
          if (!/\.(jpe?g|png)$/i.test(file.name) || file.size > 10*1024*1024) throw new Error('JPEG·PNG/10MB 한도 확인 필요');
          const bytes = new Uint8Array(await file.arrayBuffer());
          const guard = await import('./backend/image-guard.mjs?v='+encodeURIComponent(window.__REBORN_APP_VERSION__));
          guard.inspectImage(bytes);
          const jpeg = bytes[0]===255 && bytes[1]===216, png = bytes.length>24 && bytes.slice(0,8).every((value,index) => value===[137,80,78,71,13,10,26,10][index]);
          if (!jpeg && !png) throw new Error('실제 이미지 형식 확인 필요');
          const bitmap = await createImageBitmap(file); const pixels = bitmap.width*bitmap.height; bitmap.close(); if (pixels > 12000000) throw new Error('1,200만 화소 초과');
          item.hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value => value.toString(16).padStart(2,'0')).join('');
          if (!admin) return;
          item.duplicate = queue.some(value => value!==item && value.hash===item.hash);
          const result = await client().from('reborn_evidence_files').select('id').eq('original_sha256',item.hash).limit(1);
          if (result.error) throw new Error('저장소 중복 조회 실패: 연결 확인 후 다시 선택');
          item.duplicate ||= result.data.length > 0;
          item.status = '등록 대기';
        } catch (error) {item.status = /^(?:IMAGE_|JPEG_|PNG_|ANIMATED_)/.test(error.message) ? '이미지 형식·해상도·손상 확인 필요 (정지 JPEG/PNG만 가능)' : error.message; item.invalid = true;}
        renderQueue();
      }
    }
    async function upload(event) {
      event.preventDefault(); if (!admin || !callbacks.isAdmin() || uploading) return;
      const form = byId('evidenceUploadForm'); if (!form.reportValidity()) return;
      const pending = queue.filter(item => !item.invalid && !item.done); if (!pending.length) {byId('evidenceUploadStatus').textContent = '등록할 정상 사진을 선택해주세요.'; return;}
      if (pending.some(item => item.duplicate) && !confirm('같은 이미지 후보가 있습니다. 다른 업무 기록으로 등록할 필요가 있는지 확인했습니까?')) return;
      uploading = true; stopRequested = false; byId('evidenceUploadStart').disabled = true; byId('evidencePhotoInput').disabled = true;
      for (const control of form.querySelectorAll('.evidence-fields input,.evidence-fields select,.evidence-fields textarea,.evidence-public-confirm input')) control.disabled = true;
      const values = {business_date:form.elements.business_date.value,partner:form.elements.partner.value.trim(),document_type:form.elements.document_type.value,note:form.elements.note.value.trim()};
      try {
        for (const item of pending) {
          if (stopRequested || !admin || !callbacks.isAdmin()) break;
          item.snapshot ||= {...values}; const body = new FormData(); for (const [key,value] of Object.entries(item.snapshot)) body.set(key,value); body.set('id',item.id); body.set('public_confirmed','true'); body.set('original',item.file);
          activeController = new AbortController(); item.status = '전송·서버 검증 중'; item.progress = 25; renderQueue();
          try {await invoke(body,activeController.signal); item.done = true; item.status = '등록 완료 · 미검토'; item.progress = 100;}
          catch (error) {item.status = stopRequested ? '중단 요청됨 · 저장 여부 확인/동일 작업 재시도 필요' : '실패/저장 미확인 · 동일 작업으로 재시도 가능'; item.progress = 0;}
          renderQueue();
        }
      } finally {
        uploading = false; activeController = null; byId('evidenceUploadStart').disabled = false; byId('evidencePhotoInput').disabled = false;
        for (const control of form.querySelectorAll('.evidence-fields input,.evidence-fields select,.evidence-fields textarea,.evidence-public-confirm input')) control.disabled = false;
        byId('evidenceUploadStatus').textContent = `완료 ${queue.filter(item => item.done).length}장 / ${queue.length}장 · 실패·중단은 저장 완료가 아닙니다. 재시도는 최초 분류와 같은 작업 ID로 진행됩니다.`;
        renderQueue(); await load();
      }
    }
    async function exportBundle(originals) {
      if (originals && !admin) return;
      const button = byId(originals?'evidenceBackup':'evidenceExport'); button.disabled = true;
      try {
        const response = await query(101,0); if (response.error) throw new Error('내려받기 목록 조회 실패'); if (response.count > 100) throw new Error('한 번에 100개 이하로 날짜·업체 조건을 좁혀주세요.');
        if (!response.data.length) throw new Error('내려받을 자료가 없습니다.');
        const archive = XLSX.CFB.utils.cfb_new(), metadata = [], manifest = []; let bytes = 0;
        for (const item of response.data) {
          status(`내려받기 준비 ${metadata.length+1}/${response.data.length}`);
          let path = item.preview_path, fileMeta = null;
          if (originals) {fileMeta = await original(item); path = fileMeta.original_path;}
          const blob = await image(path); bytes += blob.size; if (bytes > 200*1024*1024) throw new Error('200MB를 초과합니다. 조건을 더 좁혀주세요.');
          XLSX.CFB.utils.cfb_add(archive,'images/'+item.id+(path.endsWith('.png')?'.png':'.jpg'),new Uint8Array(await blob.arrayBuffer()));
          metadata.push([item.id,item.business_date,item.partner,item.document_type,item.review_status,item.note,item.deleted_at?'휴지통':'일반']);
          if (originals) {const events = await client().from('reborn_evidence_events').select('actor,action,at,details').eq('item_id',item.id).order('at',{ascending:true}); if (events.error) throw new Error('백업 이력 조회 실패'); manifest.push({item,file:fileMeta,events:events.data});}
        }
        const csv = [['자료ID','증빙일','업체','유형','검토','공개 메모','상태'],...metadata].map(row => row.map(value => '"'+safe(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
        XLSX.CFB.utils.cfb_add(archive,'metadata.csv',new TextEncoder().encode('\ufeff'+csv));
        if (originals) XLSX.CFB.utils.cfb_add(archive,'backup-manifest.json',new TextEncoder().encode(JSON.stringify({format:'reborn-evidence-export-1',exportedAt:new Date().toISOString(),items:manifest},null,2)));
        XLSX.CFB.utils.cfb_add(archive,'README.txt',new TextEncoder().encode(originals?'선택 조건의 원본·메타데이터·이력 내보내기입니다. 전체 시스템 백업이 아니며 자동 복구 기능은 없습니다. 비공개로 보관하세요.':'공개 미리보기와 공개 분류 정보입니다. 원본 파일이나 개인정보 제거를 보장하는 자료가 아닙니다.'));
        save(new Blob([XLSX.CFB.write(archive,{type:'array',fileType:'zip'})],{type:'application/zip'}),'reborn-evidence-'+(originals?'originals-':'previews-')+today()+'.zip');
        status('내려받기 파일을 만들었습니다. 저장 완료 여부는 브라우저 다운로드 목록에서 확인해주세요.');
      } catch (error) {status(error.message,true);} finally {button.disabled = false;}
    }
    filters.addEventListener('submit', event => {event.preventDefault(); page = 0; load();});
    byId('evidenceReload').addEventListener('click', () => {lastRole = null; refreshAccess();});
    byId('evidencePrevious').addEventListener('click', () => {if (page > 0) {page--; load();}});
    byId('evidenceNext').addEventListener('click', () => {if (total !== null && (page+1)*24 < total) {page++; load();}});
    byId('evidenceGrid').addEventListener('click', event => {const button = event.target.closest('[data-evidence-id]'); if (button) openDetail(button.dataset.evidenceId).catch(() => status('자료 상세 조회 실패',true));});
    byId('evidenceNew').addEventListener('click', () => {if (!admin) return; byId('evidenceUploadForm').elements.public_confirmed.checked = false; uploadDialog.showModal();});
    for (const dialog of [uploadDialog,detailDialog]) {
      dialog.querySelector('[data-close]').addEventListener('click', () => {if (dialog === uploadDialog && uploading) {if (!confirm('등록 중입니다. 중단을 요청하고 닫을까요? 저장 여부는 다시 확인해야 합니다.')) return; stopRequested = true; activeController?.abort();} dialog.close();});
      dialog.addEventListener('cancel', event => {if (dialog === uploadDialog && uploading) {event.preventDefault(); byId('evidenceUploadStatus').textContent = '등록 중에는 중단 요청 후 닫아주세요.';}});
      dialog.addEventListener('close', () => {if (dialog === detailDialog) {releaseUrl(detailUrl); detailUrl = null; selected = null; byId('evidenceDetailImage').removeAttribute('src');}});
    }
    byId('evidencePhotoInput').addEventListener('change', event => {const files = [...event.target.files]; event.target.value = ''; addPhotos(files).catch(() => {byId('evidenceUploadStatus').textContent = '사진 검증 실패';});});
    byId('evidenceQueue').addEventListener('click', event => {const button = event.target.closest('[data-queue-remove]'); if (!uploading && button) {const index = queue.findIndex(item => item.id === button.dataset.queueRemove); if (index >= 0) queue.splice(index,1); renderQueue();}});
    byId('evidenceUploadForm').addEventListener('submit', upload);
    byId('evidenceUploadStop').addEventListener('click', () => {stopRequested = true; activeController?.abort(); byId('evidenceUploadStatus').textContent = '중단 요청했습니다. 서버에서 이미 저장되었을 수 있으므로 새로고침으로 확인하세요.';});
    byId('evidenceEditForm').addEventListener('submit', event => {event.preventDefault(); change('수정');});
    byId('evidenceTrash').addEventListener('click', () => change('휴지통')); byId('evidenceRestore').addEventListener('click', () => change('복원'));
    byId('evidenceRotate').addEventListener('click', () => {rotation = (rotation+90)%360; transform();});
    byId('evidenceZoomIn').addEventListener('click', () => {zoom = Math.min(3,zoom+0.25); transform();}); byId('evidenceZoomOut').addEventListener('click', () => {zoom = Math.max(0.5,zoom-0.25); transform();});
    byId('evidenceDownload').addEventListener('click', async () => {try {if (selected) save(await image(selected.preview_path),'evidence-'+selected.id+'.jpg');} catch (error) {byId('evidenceDetailStatus').textContent = error.message;}});
    byId('evidenceOriginal').addEventListener('click', async () => {try {if (!selected) return; const item = await original(selected); save(await image(item.original_path),'evidence-'+selected.id+(item.mime==='image/png'?'.png':'.jpg'));} catch (error) {byId('evidenceDetailStatus').textContent = error.message;}});
    byId('evidenceExport').addEventListener('click', () => exportBundle(false)); byId('evidenceBackup').addEventListener('click', () => exportBundle(true));
    document.addEventListener('reborn-workspace-view', event => {if (event.detail.view === 'evidence') {if (!initialized) {initialized = true; refreshAccess(); load();}}});
    new MutationObserver(refreshAccess).observe(document.body,{attributes:true,attributeFilter:['class']});
    showAdmin(); refreshAccess();
  }
  window.RebornEvidenceUI = Object.freeze({init});
})();
