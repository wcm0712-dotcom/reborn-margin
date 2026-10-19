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
    let selected = null, uploading = false, preparing = false, preparationId = 0, stopRequested = false, activeController = null, detailUrl = null, preparedUrl = null, rotation = 0, zoom = 1;
    let currentPartner = null, partners = [], categoriesReady = false, categoryRequest = 0, exportController = null, partnerLimit = 100;
    const categoryCore = window.RebornEvidenceCategories;
    const queue = [], urls = new Set();
    root.innerHTML = `<div class="evidence-toolbar"><p>업체별 회계자료</p><div><button type="button" id="evidenceReload">새로고침</button><button type="button" id="evidenceExport">전체 업체 이미지 ZIP</button><button type="button" id="evidenceBackup" data-evidence-admin hidden>전체 업체 등록 파일 백업</button><button type="button" id="evidenceNew" class="primary-btn" data-evidence-admin hidden>사진 등록</button></div></div>
      <p class="evidence-public-note">공개 자료실 · 로그인 없이 사진과 분류 정보를 조회할 수 있습니다. 사진 보관은 회계처리 완료를 뜻하지 않습니다.</p>
      <div class="evidence-category-tools"><label>업체 검색<input id="evidencePartnerSearch" type="search" maxlength="100"></label><label>정렬<select id="evidencePartnerSort"><option value="name">업체명순</option><option value="recent">최근 자료순</option><option value="count">자료 많은 순</option></select></label><label data-evidence-admin hidden>보관<select id="evidenceCategoryTrash"><option value="active">일반 목록</option><option value="trash">휴지통</option></select></label></div>
      <div id="evidenceCategories"><p id="evidenceCategoryStatus" role="status"></p><div id="evidencePartnerList" class="evidence-partner-list"></div><button type="button" id="evidencePartnersMore" hidden>업체 더 보기</button></div>
      <section id="evidenceCategoryContent" hidden><div class="evidence-category-heading"><button type="button" id="evidenceCategoryBack" title="업체 목록으로" aria-label="업체 목록으로"></button><div><h2 id="evidenceCategoryTitle"></h2><p id="evidenceCategoryScope"></p></div><div class="evidence-category-download-tools"><label>이미지 종류<select id="evidenceCategoryKind"><option value="preview">공개 이미지</option><option value="original" data-evidence-admin hidden>등록 파일 (관리자)</option></select></label><button type="button" id="evidenceCategoryDownload">업체 전체 이미지 ZIP</button></div></div>
      <form id="evidenceFilters" class="evidence-filters evidence-category-filters"><label>시작일<input name="from" type="date"></label><label>종료일<input name="to" type="date"></label><label>유형<select name="type"><option value="">전체</option>${types.map(type => '<option>'+type+'</option>').join('')}</select></label><label>검토<select name="review"><option value="">전체</option>${reviews.map(value => '<option>'+value+'</option>').join('')}</select></label><input type="hidden" name="trash" value="active"><button type="submit">조회</button></form>
      <p id="evidenceStatus" role="status" aria-live="polite"></p><div id="evidenceGrid" class="evidence-grid"></div><div class="evidence-pagination"><button type="button" id="evidencePrevious">이전</button><span id="evidencePage"></span><button type="button" id="evidenceNext">다음</button></div></section>
      <div class="evidence-export-progress"><p id="evidenceDownloadStatus" role="status" aria-live="polite"></p><progress id="evidenceDownloadProgress" max="1" value="0" hidden aria-label="이미지 ZIP 준비 진행률"></progress><button type="button" id="evidenceDownloadCancel" hidden>다운로드 중단</button></div>`;
    const byId = id => document.getElementById(id), filters = byId('evidenceFilters');
    const uploadDialog = document.createElement('dialog');
    uploadDialog.id = 'evidenceUploadDialog'; uploadDialog.className = 'evidence-dialog';
    uploadDialog.setAttribute('aria-labelledby', 'evidenceUploadTitle');
    uploadDialog.innerHTML = `<div class="evidence-dialog-heading"><h2 id="evidenceUploadTitle">회계자료 등록</h2><button type="button" data-close aria-label="등록창 닫기">닫기</button></div><form id="evidenceUploadForm"><div class="evidence-fields"><label>업체 카테고리<select id="evidenceUploadPartner" required></select></label><label id="evidenceNewPartnerField" hidden>새 업체명<input name="partner" required maxlength="100" autocomplete="off" disabled></label><label>증빙일<input name="business_date" type="date" required></label><label>유형<select name="document_type">${types.map(type => '<option>'+type+'</option>').join('')}</select></label><label class="evidence-note-field">공개 메모<textarea name="note" maxlength="500" rows="2"></textarea></label></div><label class="evidence-public-confirm"><input name="public_confirmed" type="checkbox" required> 사진 속 연락처·계좌·이름과 업체·날짜·메모가 로그인 없이 공개됨을 확인하며 이 자료를 공개할 권한이 있습니다.</label><label class="evidence-file-input">사진 선택<input id="evidencePhotoInput" type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple></label><p>JPG·JPEG·정지 PNG · 장당 10MB 이하 · 한 번에 30장/100MB · 동일 업체·증빙일로 등록됩니다. JPG는 2,400만 화소·한 변 8,192px까지 선택 가능하며, 해상도·서버 처리 한도 초과 시 800만 화소 이하 등록 사본을 준비합니다. PNG는 1,200만 화소 이하입니다.</p><div id="evidenceQueue"></div><label id="evidenceResizeConfirm" class="evidence-public-confirm" hidden><input id="evidenceResizeAccepted" type="checkbox"> 업로드용 조정 사본의 글자와 방향을 확인했습니다. 이 사본은 JPEG 재압축되며 EXIF 등 부가정보는 제외됩니다. PC의 촬영 원본은 변경되지 않으며, 앱의 등록 파일·백업에는 사본이 보관됩니다.</label><div class="evidence-actions"><button type="submit" class="primary-btn" id="evidenceUploadStart">등록 시작</button><button type="button" id="evidenceUploadStop">중단 요청</button></div><p id="evidenceUploadStatus" role="status" aria-live="polite"></p></form>`;
    const preparedDialog = document.createElement('dialog');
    preparedDialog.id = 'evidencePreparedDialog'; preparedDialog.className = 'evidence-dialog'; preparedDialog.setAttribute('aria-labelledby','evidencePreparedTitle');
    preparedDialog.innerHTML = `<div class="evidence-dialog-heading"><h2 id="evidencePreparedTitle">업로드용 사본 확인</h2><button type="button" data-close aria-label="사본 확인 닫기">닫기</button></div><p id="evidencePreparedInfo"></p><div class="evidence-image-stage"><img id="evidencePreparedImage" alt="업로드용 조정 사본"></div><a id="evidencePreparedSave">사본 내려받아 확대 확인</a>`;
    const detailDialog = document.createElement('dialog');
    detailDialog.id = 'evidenceDetailDialog'; detailDialog.className = 'evidence-dialog evidence-detail-dialog';
    detailDialog.setAttribute('aria-labelledby', 'evidenceDetailTitle');
    detailDialog.innerHTML = `<div class="evidence-dialog-heading"><h2 id="evidenceDetailTitle">자료 상세</h2><button type="button" data-close aria-label="상세 닫기">닫기</button></div><div class="evidence-image-tools"><button type="button" id="evidenceZoomOut" aria-label="축소">−</button><button type="button" id="evidenceZoomIn" aria-label="확대">+</button><button type="button" id="evidenceRotate" aria-label="시계 방향 90도 회전">↻</button><button type="button" id="evidenceDownload">공개 이미지 저장</button><button type="button" id="evidenceOriginal" data-evidence-admin hidden>등록 파일 저장</button></div><div class="evidence-image-stage"><img id="evidenceDetailImage" alt="선택한 회계자료"></div><form id="evidenceEditForm"><div id="evidenceDetailFields" class="evidence-fields"></div><div class="evidence-actions" data-evidence-admin hidden><button type="submit" class="primary-btn">분류 저장</button><button type="button" id="evidenceTrash">휴지통으로 이동</button><button type="button" id="evidenceRestore">복원</button></div></form><p id="evidenceDetailStatus" role="status"></p><div id="evidenceEvents" data-evidence-admin hidden></div>`;
    document.body.append(uploadDialog, detailDialog, preparedDialog);
    function client() { const value = callbacks.getClient(); if (!value) throw new Error('사진 연결을 초기화하지 못했습니다. 네트워크와 라이브러리를 확인해주세요.'); return value; }
    function status(text, error = false) {byId('evidenceStatus').textContent = text; byId('evidenceStatus').classList.toggle('evidence-error', error);}
    function showAdmin() {for (const target of [root,uploadDialog,detailDialog]) target.querySelectorAll('[data-evidence-admin]').forEach(element => element.hidden = !admin);}
    function releaseUrl(url) {if (url) {URL.revokeObjectURL(url); urls.delete(url);}}
    function objectUrl(blob) {const url = URL.createObjectURL(blob); urls.add(url); return url;}
    function clearUrls() {for (const url of urls) URL.revokeObjectURL(url); urls.clear(); detailUrl = null;}
    function resetQueue() {preparationId++; queue.splice(0); byId('evidenceResizeAccepted').checked = false; renderQueue(); byId('evidencePhotoInput').value = ''; if (preparedDialog.open) preparedDialog.close();}
    function icon(name) {
      const paths = window.RebornWorkspaceIcons?.[name] || [];
      return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths.map(([tag,attributes])=>'<'+tag+' '+Object.entries(attributes).map(([key,value])=>key+'="'+escape(value)+'"').join(' ')+'></'+tag+'>').join('')+'</svg>';
    }
    byId('evidenceCategoryBack').innerHTML = icon('ChevronLeft');
    function uploadPartner() {
      const value = byId('evidenceUploadPartner').value;
      return value === 'new' ? byId('evidenceUploadForm').elements.partner.value.trim() : value.startsWith('p:') ? partners[Number(value.slice(2))]?.name || '' : '';
    }
    function syncPartnerInput() {
      const create = byId('evidenceUploadPartner').value === 'new';
      byId('evidenceNewPartnerField').hidden = !create; byId('evidenceUploadForm').elements.partner.disabled = !create || uploading;
    }
    function partnerOptions(preferred = currentPartner) {
      const select = byId('evidenceUploadPartner');
      select.innerHTML = '<option value="">업체 선택</option>'+partners.map((partner,index)=>'<option value="p:'+index+'">'+escape(partner.name)+'</option>').join('')+'<option value="new">+ 새 업체</option>';
      const index = partners.findIndex(partner=>partner.name===preferred);
      select.value = index >= 0 ? 'p:'+index : preferred ? 'new' : '';
      if (preferred && index < 0) byId('evidenceUploadForm').elements.partner.value = preferred;
      syncPartnerInput();
    }
    async function refreshAccess() {
      const role = Boolean(callbacks.isAdmin());
      if (role === lastRole) return;
      lastRole = role; const token = ++accessId; admin = false; showAdmin();
      exportController?.abort(); categoryRequest++; requestId++;
      if (!role) {
        stopRequested = true; activeController?.abort();
        if (uploadDialog.open) uploadDialog.close(); if (detailDialog.open) detailDialog.close();
        resetQueue(); clearUrls(); page = 0; filters.elements.trash.value = 'active'; byId('evidenceCategoryTrash').value = 'active'; byId('evidenceCategoryKind').value = 'preview';
      } else {
        try {const result = await client().rpc('reborn_evidence_can_manage'); if (token === accessId && !result.error && result.data === true) admin = true;} catch {}
      }
      if (token !== accessId) return;
      if (!admin) {
        stopRequested = true; activeController?.abort();
        if (uploadDialog.open) uploadDialog.close(); if (detailDialog.open) detailDialog.close();
        resetQueue(); clearUrls(); filters.elements.trash.value = 'active'; byId('evidenceCategoryTrash').value = 'active'; byId('evidenceCategoryKind').value = 'preview';
      }
      showAdmin(); if (initialized) reloadEvidence();
    }
    function scope(allDates = false, partner = currentPartner) {
      const values = new FormData(filters);
      return {partner,from:allDates?'':values.get('from'),to:allDates?'':values.get('to'),type:allDates?'':values.get('type'),review:allDates?'':values.get('review'),trash:admin && values.get('trash') === 'trash'};
    }
    function query(limit = 24, offset = page * 24, selection = scope(), columns = 'id,business_date,partner,document_type,review_status,note,preview_path,thumbnail_path,created_at,updated_at,version,deleted_at', signal) {
      const {from,to,partner,type,review,trash} = selection;
      if (from && to && from > to) throw new Error('조회 시작일과 종료일을 확인해주세요.');
      let result = client().from('reborn_evidence_items').select(columns, {count:'exact'}).eq('ready',true);
      result = trash ? result.not('deleted_at','is',null) : result.is('deleted_at',null);
      if (from) result = result.gte('business_date',from); if (to) result = result.lte('business_date',to);
      if (partner !== null) result = result.eq('partner',partner);
      if (type) result = result.eq('document_type',type); if (review) result = result.eq('review_status',review);
      result = columns === 'id,partner,business_date' ? result.order('id',{ascending:true}) : result.order('business_date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:true});
      if (signal) result = result.abortSignal(signal);
      return result.range(offset,offset+limit-1);
    }
    function renderPartners() {
      const search = byId('evidencePartnerSearch').value.trim().toLocaleLowerCase('ko'), sort = byId('evidencePartnerSort').value;
      const visible = partners.filter(partner=>partner.name.toLocaleLowerCase('ko').includes(search));
      visible.sort((left,right)=> (sort==='count'?right.count-left.count:sort==='recent'?right.last.localeCompare(left.last):0) || left.name.localeCompare(right.name,'ko'));
      byId('evidenceCategoryStatus').textContent = `${partners.length}개 업체 · ${partners.reduce((sum,partner)=>sum+partner.count,0)}개 자료 · ${filters.elements.trash.value==='trash'?'휴지통':'일반 목록'}${search?' · 검색 '+visible.length+'개 업체':''}${visible.length>partnerLimit?' · 표시 '+partnerLimit+'개 업체':''}`;
      byId('evidencePartnerList').innerHTML = visible.slice(0,partnerLimit).map(partner=>`<div class="evidence-partner-row"><button type="button" class="evidence-partner-open" data-partner-open="${partners.indexOf(partner)}"><span><strong>${escape(partner.name)}</strong><small>${escape(partner.first===partner.last?partner.first:partner.first+' ~ '+partner.last)}</small></span><span class="evidence-partner-count">${partner.count.toLocaleString('ko-KR')}장 ${icon('ChevronRight')}</span></button><button type="button" class="evidence-partner-download" data-partner-download="${partners.indexOf(partner)}" title="${escape(partner.name)} 전체 이미지 ZIP" aria-label="${escape(partner.name)} 전체 이미지 ZIP">${icon('Download')}</button></div>`).join('');
      byId('evidencePartnersMore').hidden = visible.length <= partnerLimit;
      if (!visible.length) byId('evidencePartnerList').textContent = search?'검색 결과가 없습니다.':'등록된 자료가 없습니다.';
    }
    function showCategory(partner) {
      currentPartner = partner; page = 0; requestId++; clearUrls();
      if (detailDialog.open) detailDialog.close();
      byId('evidenceCategories').hidden = partner !== null; byId('evidenceCategoryContent').hidden = partner === null;
      byId('evidencePartnerSearch').closest('label').hidden = partner !== null; byId('evidencePartnerSort').closest('label').hidden = partner !== null;
      byId('evidenceExport').textContent = partner === null?'전체 업체 이미지 ZIP':'조건별 이미지 ZIP'; byId('evidenceBackup').textContent = partner === null?'전체 업체 원본 백업':'조건별 원본 백업';
      if (partner !== null) {
        byId('evidenceCategoryTitle').textContent = partner;
        const item = partners.find(value=>value.name===partner);
        byId('evidenceCategoryScope').textContent = `업체 전체 ${item?.count ?? '확인 중'}장 · 전체 기간 · ${filters.elements.trash.value==='trash'?'휴지통':'일반 목록'}`;
        load();
      } else byId('evidencePartnerList').querySelector('button')?.focus({preventScroll:true});
    }
    async function loadCategories() {
      const token = ++categoryRequest, access = accessId, selection = scope(true,null), preferred = uploadDialog.open ? uploadPartner() : currentPartner;
      categoriesReady = false; byId('evidenceCategoryStatus').textContent = '업체 목록 집계 중'; byId('evidencePartnerList').replaceChildren();
      try {
        const data = await categoryCore.readAll((offset,limit)=>query(limit,offset,selection,'id,partner,business_date'));
        if (token !== categoryRequest || access !== accessId) return false;
        partners = categoryCore.group(data); categoriesReady = true; renderPartners(); partnerOptions(preferred);
        if (currentPartner !== null) {const item = partners.find(value=>value.name===currentPartner); byId('evidenceCategoryScope').textContent = `업체 전체 ${item?.count || 0}장 · 전체 기간 · ${filters.elements.trash.value==='trash'?'휴지통':'일반 목록'}`;}
        return true;
      } catch {if (token === categoryRequest && access === accessId) {partners = []; byId('evidenceCategoryStatus').textContent = '업체 목록 조회 실패 · 전체 집계 미완료. 새로고침해주세요.';} return false;}
    }
    async function reloadEvidence() {await loadCategories(); if (currentPartner !== null) await load();}
    async function image(path) {const response = await client().storage.from(bucketName).download(path); if (response.error || !response.data) throw new Error('사진을 불러오지 못했습니다.'); return response.data;}
    async function load() {
      if (currentPartner === null) return;
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
      try {await invoke({id:item.id,version:item.version,action,values:Object.fromEntries(new FormData(form))}); detailDialog.close(); await reloadEvidence();} catch (error) {byId('evidenceDetailStatus').textContent = error.message;} finally {buttons.forEach(button => button.disabled = false);}
    }
    function renderQueue() {
      byId('evidenceQueue').innerHTML = queue.map(item => `<div class="evidence-queue-item"><div><strong>${escape(item.file.name)}</strong><span>${escape(item.status)}${item.duplicate?' · 동일 이미지 후보':''}</span>${item.resized?'<span>촬영 파일 '+item.source.width+'×'+item.source.height+' → 등록 사본 '+item.output.width+'×'+item.output.height+' · '+(item.uploadFile.size/1024/1024).toFixed(2)+'MB</span>':''}<progress max="100" value="${item.progress || 0}" aria-label="${escape(item.file.name)} 단계 진행률"></progress></div><div class="evidence-queue-actions">${item.resized&&!item.invalid?'<button type="button" data-queue-preview="'+item.id+'">사본 확인</button>':''}${!uploading&&!preparing?'<button type="button" data-queue-remove="'+item.id+'" title="대기 목록에서만 제거합니다. 이미 저장한 사진은 남습니다.">목록에서 제거</button>':''}</div></div>`).join('');
      const copies = queue.some(item=>item.resized&&!item.invalid&&!item.done);
      byId('evidenceResizeConfirm').hidden = !copies; byId('evidenceResizeAccepted').required = copies;
      byId('evidenceResizeAccepted').disabled = uploading || preparing;
      byId('evidenceUploadStart').disabled = uploading || preparing;
      byId('evidencePhotoInput').disabled = uploading || preparing;
    }
    async function addPhotos(files) {
      if (!admin || !callbacks.isAdmin() || uploading || preparing) return;
      if (queue.length+files.length > 30 || [...queue.map(item => item.file),...files].reduce((sum,file) => sum+file.size,0) > 100*1024*1024) {byId('evidenceUploadStatus').textContent = '한 번에 30장·100MB 이하로 선택해주세요.'; return;}
      const token = ++preparationId, access = accessId;
      const pending = files.map(file=>({id:crypto.randomUUID(),file,status:'검증 대기',progress:0,hash:'',snapshot:null,invalid:true}));
      queue.push(...pending); preparing = true; byId('evidenceResizeAccepted').checked = false; renderQueue();
      function active(item) {if (token!==preparationId || access!==accessId || !admin || !callbacks.isAdmin() || !queue.includes(item)) throw new DOMException('사진 검증 중단','AbortError');}
      try {
        const helper = await import('./evidence-image-upload.mjs?v='+encodeURIComponent(window.__REBORN_APP_VERSION__));
        for (const item of pending) {
          try {
            active(item); item.status = '사진 검증·사본 준비 중'; renderQueue();
            const prepared = await helper.preparePhoto(item.file,()=>active(item)); active(item);
            Object.assign(item,{uploadFile:prepared.file,source:prepared.source,output:prepared.output,hash:prepared.hash,sourceHash:prepared.sourceHash,resized:prepared.resized});
            const hashes = [...new Set([item.sourceHash,item.hash])];
            item.duplicate = queue.some(value=>value!==item&&hashes.some(hash=>value.hash===hash||value.sourceHash===hash));
            for (const hash of hashes) {
              const result = await client().from('reborn_evidence_files').select('id').eq('original_sha256',hash).limit(1); active(item);
              if (result.error) throw new Error('저장소 중복 조회 실패: 연결 확인 후 다시 선택');
              item.duplicate ||= result.data.length > 0;
            }
            item.status = prepared.resized ? '등록 대기 · 업로드용 조정 사본 확인 필요' : '등록 대기'; item.invalid = false;
          } catch (error) {
            if (error.name === 'AbortError') break;
            item.status = error.message === 'JPEG_INCOMPLETE' ? 'JPEG 사진 데이터의 끝부분이 누락됐습니다. 원본을 다시 받아 선택해주세요.' : error.message === 'JPEG_STRUCTURE' ? 'JPEG 내부 구조를 읽지 못했습니다. 원본 파일을 다시 받아 선택해주세요.' : error.message === 'JPG_SOURCE_DIMENSION' ? 'JPG는 2,400만 화소·한 변 8,192px까지 가능합니다. 원본을 보관하고 더 작은 사본을 선택해주세요.' : /^(?:IMAGE_|PNG_|ANIMATED_)/.test(error.message) || error.name === 'InvalidStateError' ? '이미지 형식·해상도·손상 확인 필요 (정지 JPG/JPEG/PNG)' : error.message;
          }
          renderQueue();
        }
      } catch {for (const item of pending) item.status = '사진 검증 기능을 불러오지 못했습니다. 다시 선택해주세요.';}
      finally {
        for (const item of pending) if (item.invalid && /검증 대기|준비 중/.test(item.status)) item.status = '검증 중단 · 다시 선택 필요';
        preparing = false; renderQueue();
      }
    }
    async function upload(event) {
      event.preventDefault(); if (!admin || !callbacks.isAdmin() || uploading || preparing) return;
      const form = byId('evidenceUploadForm'); if (!form.reportValidity()) return;
      const pending = queue.filter(item => !item.invalid && !item.done); if (!pending.length) {byId('evidenceUploadStatus').textContent = '등록할 정상 사진을 선택해주세요.'; return;}
      if (pending.some(item => item.duplicate) && !confirm('같은 이미지 후보가 있습니다. 다른 업무 기록으로 등록할 필요가 있는지 확인했습니까?')) return;
      uploading = true; stopRequested = false; byId('evidenceUploadStart').disabled = true; byId('evidencePhotoInput').disabled = true;
      for (const control of form.querySelectorAll('.evidence-fields input,.evidence-fields select,.evidence-fields textarea,.evidence-public-confirm input')) control.disabled = true;
      const values = {business_date:form.elements.business_date.value,partner:uploadPartner(),document_type:form.elements.document_type.value,note:form.elements.note.value.trim()};
      if (!values.partner) {uploading = false; byId('evidenceUploadStart').disabled = false; byId('evidencePhotoInput').disabled = false; for (const control of form.querySelectorAll('.evidence-fields input,.evidence-fields select,.evidence-fields textarea,.evidence-public-confirm input')) control.disabled = false; syncPartnerInput(); byId('evidenceUploadStatus').textContent = '업체 카테고리를 확인해주세요.'; return;}
      try {
        for (const item of pending) {
          if (stopRequested || !admin || !callbacks.isAdmin()) break;
          item.snapshot ||= {...values}; const body = new FormData(); for (const [key,value] of Object.entries(item.snapshot)) body.set(key,value); body.set('id',item.id); body.set('public_confirmed','true'); body.set('original',item.uploadFile);
          activeController = new AbortController(); item.status = '전송·서버 검증 중'; item.progress = 25; renderQueue();
          try {await invoke(body,activeController.signal); item.done = true; item.status = '등록 완료 · 미검토'; item.progress = 100;}
          catch (error) {item.status = stopRequested ? '중단 요청됨 · 저장 여부 확인/동일 작업 재시도 필요' : '실패/저장 미확인 · 동일 작업으로 재시도 가능'; item.progress = 0;}
          renderQueue();
        }
      } finally {
        uploading = false; activeController = null; byId('evidenceUploadStart').disabled = false; byId('evidencePhotoInput').disabled = false;
        for (const control of form.querySelectorAll('.evidence-fields input,.evidence-fields select,.evidence-fields textarea,.evidence-public-confirm input')) control.disabled = false;
        byId('evidenceUploadStatus').textContent = `완료 ${queue.filter(item => item.done).length}장 / ${queue.length}장 · 실패·중단은 저장 완료가 아닙니다. 재시도는 최초 분류와 같은 작업 ID로 진행됩니다.`;
        syncPartnerInput(); renderQueue(); await reloadEvidence();
      }
    }
    async function exportBundle(originals, options = {}) {
      if (exportController || (originals && (!admin || !callbacks.isAdmin()))) return;
      const selection = scope(options.allDates || currentPartner === null,options.partner === undefined ? currentPartner : options.partner), access = accessId;
      const controller = new AbortController(); exportController = controller;
      const progress = byId('evidenceDownloadProgress'), message = byId('evidenceDownloadStatus'), cancel = byId('evidenceDownloadCancel');
      const label = selection.partner === null ? '전체 업체' : selection.partner;
      let writer = null, writable = null, completed = 0, expected = null;
      const filename = 'reborn-'+categoryCore.safeSegment(label)+'-'+(originals?'originals-':'images-')+today()+'.zip';
      function active() {categoryCore.assertActive(controller.signal); if (access !== accessId || (originals && (!admin || !callbacks.isAdmin()))) throw new DOMException('권한이 변경되었습니다.','AbortError');}
      for (const button of [byId('evidenceExport'),byId('evidenceBackup'),byId('evidenceCategoryDownload')]) button.disabled = true;
      cancel.hidden = false; progress.hidden = false; progress.value = 0; progress.max = 1;
      message.textContent = label+' · ZIP 준비 중';
      try {
        if (typeof window.showSaveFilePicker === 'function') {
          const handle = await window.showSaveFilePicker({suggestedName:filename,types:[{description:'ZIP archive',accept:{'application/zip':['.zip']}}]}); active(); writable = await handle.createWritable(); active();
        }
        const list = await categoryCore.readAll((offset,limit)=>query(limit,offset,selection,undefined,controller.signal),{signal:controller.signal,onProgress:(count,total)=>{message.textContent=`${label} · 목록 확인 ${count}/${total}`;}}); active();
        expected = list.length; if (!expected) throw new Error('내려받을 자료가 없습니다.');
        writer = categoryCore.zipWriter({writable,signal:controller.signal}); progress.max = expected;
        const metadata = [], manifest = [], directories = new Map();
        for (const item of list) {
          active(); message.textContent = `${label} · 이미지 준비 ${completed+1}/${expected}`;
          let path = item.preview_path, fileMeta = null;
          if (originals) {fileMeta = await original(item); active(); path = fileMeta.original_path;}
          const blob = await image(path); active(); if (!blob.size) throw new Error('빈 이미지가 있어 전체 다운로드를 중단했습니다.');
          if (!directories.has(item.partner)) directories.set(item.partner,String(directories.size+1).padStart(4,'0')+'_'+categoryCore.safeSegment(item.partner));
          const date = /^\d{4}-\d{2}-\d{2}$/.test(item.business_date) ? item.business_date : '날짜미상';
          const archivePath = 'images/'+directories.get(item.partner)+'/'+date+'/'+String(completed+1).padStart(6,'0')+'_'+categoryCore.safeSegment(item.id)+(path.endsWith('.png')?'.png':'.jpg');
          await writer.add(archivePath,blob); active();
          metadata.push([item.id,item.business_date,item.partner,item.document_type,item.review_status,item.note,item.deleted_at?'휴지통':'일반',archivePath]);
          if (originals) {const events = await client().from('reborn_evidence_events').select('actor,action,at,details').eq('item_id',item.id).order('at',{ascending:true}).abortSignal(controller.signal); active(); if (events.error) throw new Error('백업 이력 조회 실패'); manifest.push({item,file:fileMeta,events:events.data});}
          completed++; progress.value = completed;
        }
        message.textContent = label+' · 자료 목록 변경 여부 재확인 중';
        const verified = await categoryCore.readAll((offset,limit)=>query(limit,offset,selection,undefined,controller.signal),{signal:controller.signal}); active();
        if (JSON.stringify(verified) !== JSON.stringify(list)) throw new Error('다운로드 중 자료가 변경되었습니다. 새로고침 후 다시 시도해주세요.');
        const csv = [['자료ID','증빙일','업체','유형','검토','공개 메모','상태','이미지 경로'],...metadata].map(row=>row.map(value=>'"'+safe(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
        await writer.add('metadata.csv',new Blob(['\ufeff'+csv]));
        if (originals) await writer.add('backup-manifest.json',new Blob([JSON.stringify({format:'reborn-evidence-export-1',exportedAt:new Date().toISOString(),items:manifest},null,2)]));
        await writer.add('archive-info.json',new Blob([JSON.stringify({format:'reborn-evidence-images-1',scope:selection,originals,expectedCount:expected,imageCount:completed,complete:completed===expected,exportedAt:new Date().toISOString()},null,2)]));
        await writer.add('README.txt',new Blob([originals?'선택 범위의 등록 파일·메타데이터·이력 내보내기입니다. 업로드용 조정 사본을 등록했다면 촬영 원본이 아니라 사본이 포함됩니다. 시스템 전체 백업이나 자동 복구 파일은 아닙니다. 비공개로 보관하세요.':'공개 이미지와 공개 분류 정보입니다. 등록 원본은 포함하지 않습니다. 사진 보관은 회계 장부 반영이 아닙니다.']));
        active(); const blob = await writer.finish(); active(); if (blob) save(blob,filename);
        message.textContent = writable ? `${label} · ${completed}장 ZIP 저장 완료` : `${label} · ${completed}장 ZIP 생성 완료. 브라우저 다운로드 목록에서 저장 완료를 확인해주세요.`;
      } catch (error) {
        if (writer) await writer.abort(); else if (writable) {try {await writable.abort();} catch {}}
        message.textContent = `${label} · 다운로드 미완료 (${completed}/${expected ?? '확인 중'}) · ${error.name==='AbortError'?'중단 또는 권한 변경':error.message}`;
      } finally {
        if (exportController === controller) exportController = null;
        cancel.hidden = true; progress.hidden = true;
        for (const button of [byId('evidenceExport'),byId('evidenceBackup'),byId('evidenceCategoryDownload')]) button.disabled = false;
      }
    }
    filters.addEventListener('submit', event => {event.preventDefault(); page = 0; load();});
    byId('evidenceReload').addEventListener('click', () => {lastRole = null; refreshAccess();});
    byId('evidencePrevious').addEventListener('click', () => {if (page > 0) {page--; load();}});
    byId('evidenceNext').addEventListener('click', () => {if (total !== null && (page+1)*24 < total) {page++; load();}});
    byId('evidenceGrid').addEventListener('click', event => {const button = event.target.closest('[data-evidence-id]'); if (button) openDetail(button.dataset.evidenceId).catch(() => status('자료 상세 조회 실패',true));});
    byId('evidenceNew').addEventListener('click', async () => {if (!admin) return; if (!categoriesReady && !await loadCategories()) {status('업체 목록을 확인하지 못해 등록창을 열지 않았습니다. 새로고침해주세요.',true); return;} if (!admin || !callbacks.isAdmin()) return; partnerOptions(currentPartner); byId('evidenceUploadForm').elements.public_confirmed.checked = false; uploadDialog.showModal();});
    byId('evidenceUploadPartner').addEventListener('change',syncPartnerInput);
    byId('evidencePartnerSearch').addEventListener('input',()=>{partnerLimit = 100; if (categoriesReady) renderPartners();});
    byId('evidencePartnerSort').addEventListener('change',()=>{partnerLimit = 100; if (categoriesReady) renderPartners();});
    byId('evidencePartnersMore').addEventListener('click',()=>{partnerLimit += 100; if (categoriesReady) renderPartners();});
    byId('evidenceCategoryTrash').addEventListener('change',()=>{if (!admin) return; filters.elements.trash.value = byId('evidenceCategoryTrash').value; page = 0; reloadEvidence();});
    byId('evidenceCategoryBack').addEventListener('click',()=>showCategory(null));
    byId('evidencePartnerList').addEventListener('click',event=>{
      const open = event.target.closest('[data-partner-open]'), download = event.target.closest('[data-partner-download]');
      if (open && partners[Number(open.dataset.partnerOpen)]) showCategory(partners[Number(open.dataset.partnerOpen)].name);
      if (download && partners[Number(download.dataset.partnerDownload)]) exportBundle(false,{partner:partners[Number(download.dataset.partnerDownload)].name,allDates:true});
    });
    byId('evidenceCategoryDownload').addEventListener('click',()=>{if (currentPartner !== null) exportBundle(byId('evidenceCategoryKind').value==='original',{allDates:true});});
    byId('evidenceDownloadCancel').addEventListener('click',()=>{exportController?.abort(); byId('evidenceDownloadStatus').textContent = '다운로드 중단 요청 · 현재 요청 종료 후 정리합니다.';});
    for (const dialog of [uploadDialog,detailDialog]) {
      dialog.querySelector('[data-close]').addEventListener('click', () => {if (dialog === uploadDialog && uploading) {if (!confirm('등록 중입니다. 중단을 요청하고 닫을까요? 저장 여부는 다시 확인해야 합니다.')) return; stopRequested = true; activeController?.abort();} dialog.close();});
      dialog.addEventListener('cancel', event => {if (dialog === uploadDialog && uploading) {event.preventDefault(); byId('evidenceUploadStatus').textContent = '등록 중에는 중단 요청 후 닫아주세요.';}});
      dialog.addEventListener('close', () => {if (dialog === detailDialog) {releaseUrl(detailUrl); detailUrl = null; selected = null; byId('evidenceDetailImage').removeAttribute('src');}});
    }
    byId('evidencePhotoInput').addEventListener('change', event => {const files = [...event.target.files]; event.target.value = ''; addPhotos(files).catch(() => {byId('evidenceUploadStatus').textContent = '사진 검증 실패';});});
    byId('evidenceQueue').addEventListener('click', event => {
      const preview = event.target.closest('[data-queue-preview]');
      if (preview && admin && callbacks.isAdmin()) {
        const item = queue.find(value=>value.id===preview.dataset.queuePreview); if (!item?.uploadFile) return;
        releaseUrl(preparedUrl); preparedUrl = objectUrl(item.uploadFile); byId('evidencePreparedImage').src = preparedUrl;
        byId('evidencePreparedInfo').textContent = item.source.width+'×'+item.source.height+' → '+item.output.width+'×'+item.output.height+' · 원본은 PC에 그대로 남고 이 사본만 등록됩니다.';
        byId('evidencePreparedSave').href = preparedUrl; byId('evidencePreparedSave').download = item.uploadFile.name; preparedDialog.showModal();
      }
      const button = event.target.closest('[data-queue-remove]'); if (!uploading && !preparing && button) {const index = queue.findIndex(item => item.id === button.dataset.queueRemove); if (index >= 0) queue.splice(index,1); byId('evidenceResizeAccepted').checked = false; renderQueue();}
    });
    preparedDialog.querySelector('[data-close]').addEventListener('click',()=>preparedDialog.close());
    preparedDialog.addEventListener('close',()=>{releaseUrl(preparedUrl); preparedUrl=null; byId('evidencePreparedImage').removeAttribute('src'); byId('evidencePreparedSave').removeAttribute('href');});
    uploadDialog.addEventListener('close',()=>{if (preparing) preparationId++; if (preparedDialog.open) preparedDialog.close();});
    byId('evidenceUploadForm').addEventListener('submit', upload);
    byId('evidenceUploadStop').addEventListener('click', () => {stopRequested = true; if (preparing) preparationId++; activeController?.abort(); byId('evidenceUploadStatus').textContent = preparing ? '사진 검증 중단 요청 · 아직 등록하지 않은 사진은 서버로 전송되지 않습니다.' : '중단 요청했습니다. 서버에서 이미 저장되었을 수 있으므로 새로고침으로 확인하세요.';});
    byId('evidenceEditForm').addEventListener('submit', event => {event.preventDefault(); change('수정');});
    byId('evidenceTrash').addEventListener('click', () => change('휴지통')); byId('evidenceRestore').addEventListener('click', () => change('복원'));
    byId('evidenceRotate').addEventListener('click', () => {rotation = (rotation+90)%360; transform();});
    byId('evidenceZoomIn').addEventListener('click', () => {zoom = Math.min(3,zoom+0.25); transform();}); byId('evidenceZoomOut').addEventListener('click', () => {zoom = Math.max(0.5,zoom-0.25); transform();});
    byId('evidenceDownload').addEventListener('click', async () => {try {if (selected) save(await image(selected.preview_path),'evidence-'+selected.id+'.jpg');} catch (error) {byId('evidenceDetailStatus').textContent = error.message;}});
    byId('evidenceOriginal').addEventListener('click', async () => {try {if (!selected) return; const item = await original(selected); save(await image(item.original_path),'evidence-'+selected.id+(item.mime==='image/png'?'.png':'.jpg'));} catch (error) {byId('evidenceDetailStatus').textContent = error.message;}});
    byId('evidenceExport').addEventListener('click', () => exportBundle(false)); byId('evidenceBackup').addEventListener('click', () => exportBundle(true));
    document.addEventListener('reborn-workspace-view', event => {if (event.detail.view === 'evidence') {if (!initialized) {initialized = true; refreshAccess(); reloadEvidence();}}});
    new MutationObserver(refreshAccess).observe(document.body,{attributes:true,attributeFilter:['class']});
    showAdmin(); refreshAccess();
  }
  window.RebornEvidenceUI = Object.freeze({init});
})();
