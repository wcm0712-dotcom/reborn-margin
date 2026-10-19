(() => {
  'use strict';
  const views = [
    ['inventory', '재고 현황', 'Boxes', '재고 업무'],
    ['flow', '입출고 흐름', 'ArrowLeftRight', '재고 업무'],
    ['movement', '입고·직접출고', 'PackagePlus', '재고 업무'],
    ['orders', '엑셀 주문 차감', 'FileSpreadsheet', '재고 업무'],
    ['statistics', '주문 통계', 'ChartNoAxesCombined', '재고 업무'],
    ['labor', '용역비', 'CalendarDays', '정산·계산'],
    ['margin', '마진계산기', 'Calculator', '정산·계산'],
    ['excel-count', '엑셀 건수 계산기', 'ListOrdered', '정산·계산'],
    ['evidence', '회계자료', 'FileSpreadsheet', '정산·계산'],
    ['management', '데이터·관리', 'Settings2', '관리']
  ];
  const byId = id => document.getElementById(id);
  const icon = name => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [key, value] of Object.entries({viewBox:'0 0 24 24', width:'20', height:'20', fill:'none', stroke:'currentColor', 'stroke-width':'1.8', 'stroke-linecap':'round', 'stroke-linejoin':'round', 'aria-hidden':'true'})) element.setAttribute(key, value);
    for (const [tag, attributes] of window.RebornWorkspaceIcons?.[name] || []) {
      const child = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) child.setAttribute(key, value);
      element.append(child);
    }
    return element;
  };
  const focusable = root => [...root.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(element => element.getClientRects().length && !element.closest('[hidden],[inert]'));
  const authRedirect = () => /access_token=|refresh_token=|type=recovery|error_code=|error_description=/.test(location.hash + location.search);
  let refreshStockAccess = () => {};

  function init(callbacks) {
    if (document.body.classList.contains('workspace-ui')) return;
    document.body.classList.add('workspace-ui');
    const shell = document.querySelector('.app-shell');
    const main = shell.querySelector('main');
    main.id = 'workspaceMain';
    main.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'workspace-skip'; skip.href = '#workspaceMain'; skip.textContent = '본문으로 이동';
    skip.addEventListener('click', event => { event.preventDefault(); main.focus(); });
    document.body.prepend(skip);
    const sidebar = document.createElement('aside');
    sidebar.id = 'workspaceSidebar'; sidebar.className = 'workspace-sidebar';
    sidebar.innerHTML = '<div class="workspace-brand"><img src="./icon-192.png" alt="" width="38" height="38"><div><strong>리본컴퍼니</strong><span>Margin · WMS</span></div><button id="workspaceMenuClose" class="workspace-icon" type="button" aria-label="메뉴 닫기" title="메뉴 닫기"></button></div><nav aria-label="업무 메뉴"></nav><div class="workspace-footer"><span>리본 업무공간</span><small id="workspaceVersion"></small></div>';
    const nav = sidebar.querySelector('nav');
    let lastGroup = '';
    for (const [key, label, glyph, group] of views) {
      if (group !== lastGroup) {
        const heading = document.createElement('p'); heading.className = 'workspace-nav-group'; heading.textContent = group; nav.append(heading); lastGroup = group;
      }
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.workspaceView = key;
      button.append(icon(glyph), document.createTextNode(label));
      if (['movement','orders'].includes(key)) { button.dataset.workspaceAdmin = 'true'; button.title = '관리자 로그인 후 사용'; }
      nav.append(button);
    }
    shell.before(sidebar);
    const shade = document.createElement('button');
    shade.type = 'button'; shade.id = 'workspaceShade'; shade.className = 'workspace-shade'; shade.hidden = true;
    shade.setAttribute('aria-label', '메뉴 닫기'); shade.tabIndex = -1;
    sidebar.after(shade);
    const topbar = document.createElement('header');
    topbar.className = 'workspace-topbar';
    topbar.innerHTML = '<div class="workspace-location"><button id="workspaceMenuToggle" class="workspace-icon" type="button" aria-label="업무 메뉴 열기" aria-controls="workspaceSidebar" aria-expanded="false" title="업무 메뉴 열기"></button><span>업무공간</span><span aria-hidden="true">/</span><strong id="workspaceLocation"></strong></div><button id="workspaceAccount" class="workspace-account" type="button" title="계정 및 동기화"><span id="workspaceRole">조회 모드</span></button>';
    shell.prepend(topbar);
    byId('workspaceMenuToggle').append(icon('Menu'));
    byId('workspaceMenuClose').append(icon('X'));
    byId('workspaceAccount').prepend(icon('UserRound'));
    byId('workspaceVersion').textContent = window.__REBORN_APP_VERSION__ || '';

    const wms = byId('page-wms');
    const panels = {};
    for (const [key, label] of views.filter(([key]) => !['margin','excel-count'].includes(key))) {
      const section = document.createElement('section');
      section.id = 'workspace-' + key; section.className = 'workspace-view'; section.hidden = true;
      section.setAttribute('aria-labelledby', 'workspace-title-' + key);
      const heading = document.createElement('div'); heading.className = 'workspace-heading';
      const title = document.createElement('h1'); title.id = 'workspace-title-' + key; title.textContent = label; title.tabIndex = -1;
      heading.append(title); section.append(heading); wms.append(section); panels[key] = section;
    }
    function move(id, view) { const element = byId(id); if (element) panels[view].append(element); }
    const summary = wms.querySelector('.wms-summary-block'); summary.id = 'workspaceSummary'; panels.inventory.append(summary);
    byId('inventoryTable').closest('table').classList.add('workspace-inventory-table');
    move('inventoryPanelCard','inventory'); move('boxStockCard','inventory'); move('palletCard','inventory');
    const flow = byId('dailyFlowList')?.closest('section.card');
    if (flow) { flow.id = flow.id || 'workspaceFlowCard'; panels.flow.append(flow); }
    move('stockMoveCard','movement'); move('excelOrderCard','orders'); move('orderResultCard','orders');
    move('orderChartCard','statistics'); move('skuOrderRankCard','statistics');
    move('laborCostCard','labor');
    move('evidenceCard','evidence');
    for (const id of ['adminLoginRevealButton','syncCard','productCostEditorCard','backupCard','adminActionLogCard','outboundDiagnosticsCard']) move(id,'management');
    const cumulative = document.createElement('button'); cumulative.type = 'button'; cumulative.className = 'ghost-btn';
    cumulative.textContent = '월별 총 주문건수'; cumulative.addEventListener('click', () => byId('cumulativeSalesCard').click());
    panels.statistics.querySelector('.workspace-heading').append(cumulative);
    for (const key of ['movement','orders']) {
      const note = document.createElement('p'); note.className = 'workspace-permission-note'; note.textContent = '관리자 로그인 후 이용할 수 있습니다.';
      const login = document.createElement('button'); login.type = 'button'; login.className = 'ghost-btn'; login.textContent = '관리자 로그인';
      login.addEventListener('click', openAccount); note.append(login); panels[key].append(note);
    }
    const inventoryTabs = document.createElement('div'); inventoryTabs.className = 'workspace-inventory-tabs'; inventoryTabs.setAttribute('role','tablist'); inventoryTabs.setAttribute('aria-label','재고 구분');
    for (const [key, label] of [['inventoryPanelCard','전체 재고'],['boxStockCard','포장박스'],['palletCard','파렛 보유']]) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.stockPanel = key; button.id = 'workspace-tab-' + key;
      button.setAttribute('role','tab'); button.setAttribute('aria-controls', key);
      const panel = byId(key); panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',button.id);
      button.addEventListener('click', () => selectStock(key)); inventoryTabs.append(button);
    }
    summary.after(inventoryTabs);
    let stockPanel = 'inventoryPanelCard';
    function selectStock(key) {
      if (!callbacks.isEditorSession() && key !== 'inventoryPanelCard') key = 'inventoryPanelCard';
      stockPanel = key;
      for (const button of inventoryTabs.querySelectorAll('button')) {
        button.hidden = button.dataset.stockPanel !== 'inventoryPanelCard' && !callbacks.isEditorSession();
        const selected = button.dataset.stockPanel === key;
        button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1;
        byId(button.dataset.stockPanel).classList.toggle('workspace-panel-hidden', !selected);
      }
    }
    inventoryTabs.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...inventoryTabs.querySelectorAll('button')].filter(button => !button.hidden), index = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].click(); buttons[next].focus();
    });
    refreshStockAccess = () => {
      const restrictedFocus = document.activeElement?.closest('#boxStockCard,#palletCard,[data-stock-panel="boxStockCard"],[data-stock-panel="palletCard"]');
      selectStock(stockPanel);
      if (!callbacks.isEditorSession() && restrictedFocus) byId('workspace-tab-inventoryPanelCard').focus({preventScroll:true});
    };
    selectStock(stockPanel);

    const compact = matchMedia('(max-width: 1040px)');
    let currentView = 'inventory', drawerOpen = false;
    function setDrawer(open, restore = false) {
      drawerOpen = Boolean(open && compact.matches);
      document.body.classList.toggle('workspace-menu-open', drawerOpen);
      shade.hidden = !drawerOpen;
      byId('workspaceMenuToggle').setAttribute('aria-expanded', String(drawerOpen));
      sidebar.inert = compact.matches && !drawerOpen;
      shell.inert = drawerOpen;
      if (drawerOpen) { sidebar.setAttribute('role','dialog'); sidebar.setAttribute('aria-modal','true'); sidebar.setAttribute('aria-label','업무 메뉴'); focusable(nav).find(button => button.getAttribute('aria-current') === 'page')?.focus(); }
      else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); if (restore) byId('workspaceMenuToggle').focus(); }
    }
    function safeView(raw) { return ({home:'inventory',wms:'inventory'}[raw]) || (views.some(([key]) => key === raw) ? raw : 'inventory'); }
    function show(raw, {write = false, focus = false} = {}) {
      currentView = safeView(raw);
      const route = ['margin','excel-count'].includes(currentView) ? currentView : 'wms';
      for (const page of document.querySelectorAll('.page')) page.classList.toggle('active', page.id === 'page-' + route);
      for (const name of ['home','margin','wms','excel-count']) document.body.classList.toggle('route-' + name, name === route);
      for (const [key, section] of Object.entries(panels)) section.hidden = key !== currentView;
      callbacks.setWmsMainView(currentView === 'labor' ? 'labor' : 'inventory');
      selectStock(stockPanel);
      for (const button of nav.querySelectorAll('button')) {
        if (button.dataset.workspaceView === currentView) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      }
      byId('workspaceLocation').textContent = views.find(([key]) => key === currentView)[1];
      if (write && !authRedirect() && location.hash !== '#' + currentView) history.pushState(null,'','#' + currentView);
      setDrawer(false);
      if (currentView === 'statistics') requestAnimationFrame(callbacks.renderOrderChart);
      document.dispatchEvent(new CustomEvent('reborn-workspace-view',{detail:{view:currentView}}));
      if (focus) {
        (panels[currentView]?.querySelector('h1') || byId('page-' + route)?.querySelector('h1') || main).focus({preventScroll:true});
        window.scrollTo({top:0,behavior:'instant'});
      }
    }
    function openAccount() {
      show('management',{write:true,focus:true});
      byId('adminLoginRevealButton').click();
      const card = byId('syncCard');
      if (card.classList.contains('collapsed')) card.querySelector('.collapse-toggle')?.click();
    }
    nav.addEventListener('click', event => { const button = event.target.closest('[data-workspace-view]'); if (button) show(button.dataset.workspaceView,{write:true,focus:true}); });
    document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click', () => show(button.dataset.route,{write:true,focus:true})));
    byId('workspaceAccount').addEventListener('click', openAccount);
    byId('workspaceMenuToggle').addEventListener('click', () => setDrawer(!drawerOpen,true));
    byId('workspaceMenuClose').addEventListener('click', () => setDrawer(false,true));
    shade.addEventListener('click', () => setDrawer(false,true));
    compact.addEventListener('change', () => setDrawer(false));
    window.addEventListener('hashchange', () => { if (!authRedirect()) show(location.hash.slice(1),{focus:true}); });
    document.addEventListener('keydown', event => {
      if (!drawerOpen) return;
      if (event.key === 'Escape') { event.preventDefault(); setDrawer(false,true); }
      if (event.key === 'Tab') trapFocus(event,sidebar);
    });
    const refreshRole = () => {
      const editable = callbacks.isEditorSession();
      byId('workspaceRole').textContent = editable ? '관리자 모드' : '조회 모드';
      document.querySelectorAll('.workspace-permission-note').forEach(note => note.hidden = editable);
      nav.querySelectorAll('[data-workspace-admin]').forEach(button => button.classList.toggle('workspace-locked', !editable));
      refreshStockAccess();
    };
    new MutationObserver(refreshRole).observe(document.body,{attributes:true,attributeFilter:['class']});
    refreshRole();
    for (const heading of document.querySelectorAll('#page-margin h1,#page-excel-count h1')) heading.tabIndex = -1;
    installDialogs(shell, sidebar);
    queueMicrotask(() => {
      for (const id of ['stockMoveCard','excelOrderCard','orderChartCard','boxStockCard','palletCard']) {
        const card = byId(id); card.classList.add('workspace-expanded');
        card.classList.remove('collapsed');
        card.querySelector('.collapse-toggle')?.setAttribute('aria-expanded','true');
      }
      show(authRedirect() ? 'inventory' : location.hash.slice(1));
    });
  }

  function trapFocus(event, root) {
    const elements = focusable(root), first = elements[0], last = elements.at(-1);
    if (!first) { event.preventDefault(); root.focus(); return; }
    if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  }

  function installDialogs(shell, sidebar) {
    const overlays = [...document.querySelectorAll('.detail-overlay,.password-recovery-overlay')];
    const returnTo = new Map();
    const opened = [];
    let lastFocus = document.activeElement;
    document.addEventListener('focusin', event => { if (!overlays.some(overlay => !overlay.hidden && overlay.contains(event.target))) lastFocus = event.target; });
    for (const overlay of overlays) {
      const dialog = overlay.querySelector('[role="dialog"]'); dialog.tabIndex = -1;
      const update = () => {
        const index = opened.indexOf(overlay);
        if (!overlay.hidden && index === -1) {
          returnTo.set(overlay,lastFocus); opened.push(overlay);
          shell.inert = true; sidebar.inert = true; document.body.classList.add('workspace-dialog-open');
          queueMicrotask(() => { if (!overlay.hidden && !overlay.contains(document.activeElement)) (focusable(dialog)[0] || dialog).focus(); });
        } else if (overlay.hidden && index !== -1) {
          opened.splice(index,1);
          if (!opened.length) {
            shell.inert = false; sidebar.inert = matchMedia('(max-width: 1040px)').matches;
            document.body.classList.remove('workspace-dialog-open');
            const target = returnTo.get(overlay);
            if (target?.isConnected && target.getClientRects().length) target.focus({preventScroll:true}); else byId('workspaceMain').focus({preventScroll:true});
          }
        }
      };
      new MutationObserver(update).observe(overlay,{attributes:true,attributeFilter:['hidden']}); update();
    }
    document.addEventListener('keydown', event => {
      const overlay = opened.at(-1); if (!overlay) return;
      if (event.key === 'Tab') trapFocus(event,overlay);
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); overlay.querySelector('.detail-close,.password-recovery-close')?.click(); }
    }, true);
  }
  window.RebornWorkspaceUI = Object.freeze({init, refreshStockAccess:() => refreshStockAccess()});
})();
