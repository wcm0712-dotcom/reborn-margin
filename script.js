(() => {
  "use strict";

  const STORAGE_KEY = "reborn.wms.state.v4.safe";
  const BACKUP_KEY = "reborn.wms.backups.v3";
  const UNDO_KEY = "reborn.wms.undo.v1";
  const ORDER_CACHE_KEY = "reborn.wms.lastOrderAnalysis.v3";

  const SUPABASE_CONFIG = {
    enabled: true,
    url: "https://zbjnoputejbviwbxulxo.supabase.co",
    key: "sb_publishable_y9Z5PQtDR5oIDqWYYndKew_3NyoLniY",
    appStateTable: "app_state",
    appStateRowId: "main",
    backupTable: "inventory_backups",
    movementTable: "stock_movements",
    orderStatsTable: "order_stats",
    defaultSyncIntervalMs: 60 * 1000
  };
  const ADMIN_AUTH_CONFIG = {
    enabled: true,
    lockWmsEditingUntilLogin: true,
    allowedUserIds: ["779ce4cf-e50c-4907-ab9c-11c95c288d50"],
    revealClicks: 5
  };
  let adminSession = null;
  let adminLoginPanelOpen = false;

  const SYNC_INTERVAL_KEY = "reborn.wms.sync.interval.v1";

  const BOX_PRICES = { large: 480, medium: 380, small: 250 };
  const BOX_SKU_BY_SIZE = { large: "박스 대", medium: "박스 중", small: "박스 소" };
  const BOX_LABEL = { large: "대 박스", medium: "중 박스", small: "소 박스", none: "박스 없음" };

  const MARGIN_PRODUCTS = [
    { name: "직접 입력", cost: 0 },
    { name: "찹쌀 누룽지 무가당", cost: 2200 },
    { name: "찹쌀 누룽지 검정콩", cost: 2200 },
    { name: "찹쌀 누룽지 츄러스", cost: 2300 },
    { name: "찹쌀 누룽지 스위트", cost: 2200 },
    { name: "브이콘 50g", cost: 412.5 },
    { name: "브이콘 100g", cost: 825 },
    { name: "명가 참깨", cost: 4200 },
    { name: "명가 흑당", cost: 4200 },
    { name: "에낙 치킨", cost: 163.8 },
    { name: "에낙 스파이시", cost: 163.8 },
    { name: "싱싱 양파 160g", cost: 1650 },
    { name: "싱싱 양파 100g", cost: 1000 },
    { name: "김 메밀칩 160g", cost: 1650 },
    { name: "푸드킹 양파 160g", cost: 1500 },
    { name: "감자알칩", cost: 282.5 },
    { name: "꾀돌이", cost: 275 },
    { name: "라멘뽀식이", cost: 510 },
    { name: "바베큐맛스낵", cost: 500 },
    { name: "차카니", cost: 286.6 },
    { name: "보리건빵 30g", cost: 125 },
    { name: "황금 고구마칩", cost: 3500 },
    { name: "네모스낵 치킨맛", cost: 172.2 },
    { name: "네모스낵 불고기맛", cost: 172.2 },
    { name: "네모스낵 매콤한맛", cost: 172.2 },
    { name: "허니눈꽃 쌀과자 920g", cost: 6800 },
    { name: "풋젤리", cost: 580 },
    { name: "촉촉한 고구마", cost: 770 },
    { name: "촉촉한 밤", cost: 1080 },
    { name: "코디 3겹", cost: 8500 },
    { name: "박스 대", cost: BOX_PRICES.large },
    { name: "박스 중", cost: BOX_PRICES.medium },
    { name: "박스 소", cost: BOX_PRICES.small }
  ];

  const INVENTORY_DEFS = {
    "풋젤리": { group: "과자", boxesPerPallet: 60, unitsPerBox: 48, structure: "1파렛=60완박스 / 1완박스=4내부박스 / 1내부박스=12개", cost: 580, safetyStock: { pallets: 1 } },
    "차카니": { group: "과자", boxesPerPallet: 90, unitsPerBox: 30, structure: "1파렛=90완박스 / 1완박스=30개", cost: 286.6, safetyStock: { pallets: 1 } },
    "보리건빵 30g": { group: "과자", boxesPerPallet: 32, unitsPerBox: 200, structure: "1파렛=32완박스 / 1완박스=200개", cost: 125, safetyStock: { pallets: 3 } },
    "황금 고구마칩": { group: "고구마/밤", boxesPerPallet: 56, unitsPerBox: 10, structure: "1파렛=56완박스 / 1완박스=10개", cost: 3500, safetyStock: { pallets: 2 } },
    "네모스낵 치킨맛": { group: "네모스낵", boxesPerPallet: 72, unitsPerBox: 360, structure: "1파렛=72완박스 / 1완박스=12내부박스 / 1내부박스=30개", cost: 172.2, safetyStock: { boxes: 50 } },
    "네모스낵 불고기맛": { group: "네모스낵", boxesPerPallet: 72, unitsPerBox: 360, structure: "1파렛=72완박스 / 1완박스=12내부박스 / 1내부박스=30개", cost: 172.2, safetyStock: { boxes: 30 } },
    "네모스낵 매콤한맛": { group: "네모스낵", boxesPerPallet: 72, unitsPerBox: 360, structure: "1파렛=72완박스 / 1완박스=12내부박스 / 1내부박스=30개", cost: 172.2, safetyStock: { boxes: 30 } },
    "허니눈꽃 쌀과자 920g": { group: "쌀과자", boxesPerPallet: 42, unitsPerBox: 4, structure: "1파렛=42완박스 / 1완박스=4개", cost: 6800, safetyStock: { pallets: 3 } },
    "찹쌀 누룽지 무가당": { group: "찹쌀 누룽지", boxesPerPallet: 26, unitsPerBox: 20, structure: "1파렛=26완박스 / 1완박스=20개", cost: 2200 },
    "찹쌀 누룽지 검정콩": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2200, safetyStock: { pallets: 4 } },
    "찹쌀 누룽지 츄러스": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2300, safetyStock: { pallets: 1 } },
    "찹쌀 누룽지 스위트": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2200, safetyStock: { pallets: 4 } },
    "에낙 치킨": { group: "에낙", boxesPerPallet: 70, unitsPerBox: 180, structure: "1파렛=70완박스 / 1완박스=6내부박스 / 1내부박스=30개", cost: 163.8, safetyStock: { pallets: 2 } },
    "에낙 스파이시": { group: "에낙", boxesPerPallet: 70, unitsPerBox: 180, structure: "1파렛=70완박스 / 1완박스=6내부박스 / 1내부박스=30개", cost: 163.8, safetyStock: { pallets: 2 } },
    "꾀돌이": { group: "과자", boxesPerPallet: 150, unitsPerBox: 40, structure: "1파렛=150완박스 / 1완박스=40개", cost: 275, safetyStock: { pallets: 2 } },
    "라멘뽀식이": { group: "과자", boxesPerPallet: 72, unitsPerBox: 20, structure: "1파렛=72완박스 / 1완박스=20개", cost: 510, safetyStock: { pallets: 1 } },
    "바베큐맛스낵": { group: "과자", boxesPerPallet: 72, unitsPerBox: 20, structure: "1파렛=72완박스 / 1완박스=20개", cost: 500, safetyStock: { pallets: 1 } },
    "촉촉한 고구마": { group: "고구마/밤", boxesPerPallet: 132, unitsPerBox: 50, structure: "1파렛=132완박스 / 1완박스=50개", cost: 770, safetyStock: { boxes: 80 } },
    "촉촉한 밤": { group: "고구마/밤", boxesPerPallet: 121, unitsPerBox: 40, structure: "1파렛=121완박스 / 1완박스=40개", cost: 1080, safetyStock: { boxes: 60 } },
    "싱싱 양파 160g": { group: "양파/칩", boxesPerPallet: 36, unitsPerBox: 8, structure: "1파렛=36완박스 / 1완박스=8개", cost: 1650, safetyStock: { pallets: 4 } },
    "싱싱 양파 100g": { group: "양파/칩", boxesPerPallet: 56, unitsPerBox: 10, structure: "1파렛=56완박스 / 1완박스=10개", cost: 1000, safetyStock: { pallets: 2 } },
    "김 메밀칩 160g": { group: "양파/칩", boxesPerPallet: 56, unitsPerBox: 8, structure: "1파렛=56완박스 / 1완박스=8개", cost: 1650 },
    "푸드킹 양파 160g": { group: "양파/칩", boxesPerPallet: 38, unitsPerBox: 10, structure: "1파렛=38완박스 / 1완박스=10개", cost: 1500, safetyStock: { pallets: 2 } },
    "브이콘 50g": { group: "브이콘", boxesPerPallet: 96, unitsPerBox: 40, structure: "1파렛=96완박스 / 1완박스=40개", cost: 412.5, safetyStock: { pallets: 4 } },
    "브이콘 100g": { group: "브이콘", boxesPerPallet: 104, unitsPerBox: 20, structure: "1파렛=104완박스 / 1완박스=20개", cost: 825, safetyStock: { pallets: 1 } },
    "감자알칩": { group: "과자", boxesPerPallet: 56, unitsPerBox: 40, structure: "1파렛=56완박스 / 1완박스=40개", cost: 282.5, safetyStock: { pallets: 3 } },
    "명가 참깨": { group: "명가", boxesPerPallet: 45, unitsPerBox: 16, structure: "1파렛=45완박스 / 1완박스=16개", cost: 4200, safetyStock: { pallets: 2 } },
    "명가 흑당": { group: "명가", boxesPerPallet: 45, unitsPerBox: 16, structure: "1파렛=45완박스 / 1완박스=16개", cost: 4200, safetyStock: { pallets: 2 } },
    "코디 3겹": { group: "휴지", boxesPerPallet: 48, unitsPerBox: 1, structure: "1파렛=48개 / 박스 사용 없음", cost: 8500, safetyStock: { pallets: 6 } },
    "박스 대": { group: "포장박스", boxesPerPallet: 48, unitsPerBox: 15, structure: "1파렛=48묶음 / 1묶음=15장", cost: BOX_PRICES.large, isBox: true, safetyStock: { pallets: 3 } },
    "박스 중": { group: "포장박스", boxesPerPallet: 56, unitsPerBox: 20, structure: "1파렛=56묶음 / 1묶음=20장", cost: BOX_PRICES.medium, isBox: true, safetyStock: { pallets: 3 } },
    "박스 소": { group: "포장박스", boxesPerPallet: 90, unitsPerBox: 20, structure: "1파렛=90묶음 / 1묶음=20장", cost: BOX_PRICES.small, isBox: true, safetyStock: { pallets: 2 } }
  };

  const INITIAL_STOCK_INPUT = {
    "찹쌀 누룽지 스위트": { pallets: 11, boxes: 29, eaches: 0, original: "11파렛 29박스" },
    "찹쌀 누룽지 무가당": { pallets: 3, boxes: 47, eaches: 0, original: "3파렛 47박스" },
    "찹쌀 누룽지 검정콩": { pallets: 9, boxes: 0, eaches: 0, original: "9파렛" },
    "찹쌀 누룽지 츄러스": { pallets: 0, boxes: 40, eaches: 0, original: "40박스" },
    "꾀돌이": { pallets: 0, boxes: 58, eaches: 0, original: "58박스" },
    "차카니": { pallets: 1, boxes: 11, eaches: 0, original: "1파렛 11박스" },
    "바베큐맛스낵": { pallets: 1, boxes: 16, eaches: 0, original: "1파렛 16박스" },
    "라멘뽀식이": { pallets: 1, boxes: 92, eaches: 0, original: "1파렛 92박스" },
    "풋젤리": { pallets: 3, boxes: 48, eaches: 0, original: "3파렛 48박스" },
    "촉촉한 고구마": { pallets: 0, boxes: 482, eaches: 0, original: "482박스" },
    "촉촉한 밤": { pallets: 2, boxes: 61, eaches: 0, original: "2파렛 61박스" },
    "싱싱 양파 160g": { pallets: 13, boxes: 2, eaches: 0, original: "13파렛 2박스" },
    "싱싱 양파 100g": { pallets: 4, boxes: 30, eaches: 0, original: "4파렛 30박스" },
    "김 메밀칩 160g": { pallets: 6, boxes: 3, eaches: 0, original: "6파렛 3박스" },
    "브이콘 50g": { pallets: 5, boxes: 85, eaches: 0, original: "5파렛 85박스" },
    "브이콘 100g": { pallets: 3, boxes: 49, eaches: 0, original: "3파렛 49박스" },
    "보리건빵 30g": { pallets: 6, boxes: 0, eaches: 0, original: "6파렛" },
    "황금 고구마칩": { pallets: 9, boxes: 18, eaches: 0, original: "9파렛 18박스" },
    "감자알칩": { pallets: 5, boxes: 50, eaches: 0, original: "5파렛 50박스" },
    "네모스낵 치킨맛": { pallets: 1, boxes: 24, eaches: 0, original: "1파렛 24박스" },
    "네모스낵 불고기맛": { pallets: 0, boxes: 32, eaches: 0, original: "32박스" },
    "네모스낵 매콤한맛": { pallets: 0, boxes: 24, eaches: 0, original: "24박스" },
    "에낙 치킨": { pallets: 3, boxes: 81, eaches: 0, original: "3파렛 81박스" },
    "에낙 스파이시": { pallets: 2, boxes: 50, eaches: 0, original: "2파렛 50박스" },
    "명가 참깨": { pallets: 7, boxes: 14, eaches: 0, original: "7파렛 14박스" },
    "명가 흑당": { pallets: 2, boxes: 32, eaches: 0, original: "2파렛 32박스" },
    "허니눈꽃 쌀과자 920g": { pallets: 2, boxes: 18, eaches: 0, original: "2파렛 18박스" },
    "코디 3겹": { pallets: 23, boxes: 13, eaches: 0, original: "23파렛 13개" },
    "박스 대": { pallets: 1, boxes: 62, eaches: 0, original: "1파렛 62묶음" },
    "박스 중": { pallets: 3, boxes: 16, eaches: 0, original: "3파렛 16묶음" },
    "박스 소": { pallets: 5, boxes: 11, eaches: 0, original: "5파렛 11묶음" }
  };

  const INITIAL_PALLETS = { KPP: 174, AJ: 75, "쿠팡": 1, "개인": 70 };

  const $ = (id) => document.getElementById(id);
  const money = (value) => `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
  const isMobileWmsCompactView = () => typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(max-width: 760px)").matches;
  const compactKoreanWon = (value) => {
    const raw = Math.round(Number(value) || 0);
    const sign = raw < 0 ? "-" : "";
    const amount = Math.abs(raw);
    const eok = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    const rest = amount % 10000;
    let text = "";
    if (eok) text += `${eok}억`;
    if (man) text += `${man}만`;
    if (rest || !text) text += `${rest}`;
    return `${sign}${text}원`;
  };
  const number = (value) => Number(value || 0).toLocaleString("ko-KR");
  const cleanNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const text = String(value).replace(/[^0-9.-]/g, "");
    return Number(text) || 0;
  };
  const roundToTen = (value) => Math.round((Number(value) || 0) / 10) * 10;
  const dateKey = (date) => {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return "";
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const todayKey = () => dateKey(new Date());

  function unitsFromInput(sku, input) {
    const def = INVENTORY_DEFS[sku];
    if (!def) return 0;
    const pallets = cleanNumber(input?.pallets);
    const boxes = cleanNumber(input?.boxes);
    const eaches = cleanNumber(input?.eaches);
    return (pallets * def.boxesPerPallet * def.unitsPerBox) + (boxes * def.unitsPerBox) + eaches;
  }

  function normalizeUnits(sku, totalUnits) {
    const def = INVENTORY_DEFS[sku];
    if (!def) return { pallets: 0, boxes: 0, eaches: 0 };
    const sign = totalUnits < 0 ? -1 : 1;
    const abs = Math.abs(Math.round(totalUnits || 0));
    const unitsPerPallet = def.boxesPerPallet * def.unitsPerBox;
    const pallets = Math.floor(abs / unitsPerPallet);
    const afterPallet = abs % unitsPerPallet;
    const boxes = Math.floor(afterPallet / def.unitsPerBox);
    const eaches = afterPallet % def.unitsPerBox;
    return { pallets: pallets * sign, boxes, eaches };
  }

  function formatStock(sku, units) {
    const def = INVENTORY_DEFS[sku];
    const n = normalizeUnits(sku, units);
    const boxWord = def?.isBox ? "묶음" : sku === "코디 3겹" ? "개" : "완박스";
    const eachWord = def?.isBox ? "장" : sku === "코디 3겹" ? "개" : "낱개";
    const parts = [];
    if (n.pallets) parts.push(`${n.pallets.toLocaleString("ko-KR")}파렛`);
    if (n.boxes) parts.push(`${n.boxes.toLocaleString("ko-KR")}${boxWord}`);
    if (n.eaches) parts.push(`${n.eaches.toLocaleString("ko-KR")}${eachWord}`);
    return parts.length ? parts.join(" ") : "0";
  }
  function safetyUnits(sku) {
    const def = INVENTORY_DEFS[sku];
    if (!def?.safetyStock) return 0;
    return unitsFromInput(sku, def.safetyStock);
  }

  function safetyStatus(sku, units) {
    const threshold = safetyUnits(sku);
    if (!threshold) return null;
    const shortage = Math.max(0, threshold - (units || 0));
    return {
      threshold,
      shortage,
      isLow: shortage > 0,
      thresholdText: formatStock(sku, threshold),
      shortageText: shortage > 0 ? formatStock(sku, shortage) : ""
    };
  }



  function createInitialState() {
    const stock = {};
    Object.keys(INVENTORY_DEFS).forEach((sku) => {
      const input = INITIAL_STOCK_INPUT[sku] || { pallets: 0, boxes: 0, eaches: 0, original: "0" };
      stock[sku] = {
        units: unitsFromInput(sku, input),
        original: input.original || "0"
      };
    });
    return {
      version: 2,
      stock,
      pallets: { ...INITIAL_PALLETS },
      history: [],
      orderStats: [],
      orderYearArchives: {},
      updatedAt: new Date().toISOString()
    };
  }

  let state = loadState();
  let lastOrderAnalysis = null;
  let stockMoveRowSeq = 0;
  let orderChartMode = "daily";
  let chartResizeTimer = null;

  function normalizeState(parsed) {
    const fresh = createInitialState();
    if (!parsed || typeof parsed !== "object") return fresh;

    const normalizedStock = { ...fresh.stock };
    Object.keys(INVENTORY_DEFS).forEach((sku) => {
      const incoming = parsed.stock?.[sku];
      if (!incoming || typeof incoming !== "object") return;
      normalizedStock[sku] = {
        ...normalizedStock[sku],
        ...incoming,
        units: Number(incoming.units) || 0
      };
    });

    const normalizedPallets = { ...fresh.pallets };
    Object.keys({ ...fresh.pallets, ...(parsed.pallets || {}) }).forEach((key) => {
      normalizedPallets[key] = Number(parsed.pallets?.[key] ?? fresh.pallets[key] ?? 0) || 0;
    });

    return {
      ...fresh,
      ...parsed,
      stock: normalizedStock,
      pallets: normalizedPallets,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      orderStats: Array.isArray(parsed.orderStats) ? parsed.orderStats : [],
      orderYearArchives: parsed.orderYearArchives && typeof parsed.orderYearArchives === "object" ? parsed.orderYearArchives : {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      return normalizeState(JSON.parse(raw));
    } catch {
      return createInitialState();
    }
  }

  function saveState(reason = "저장", options = {}) {
    const { trackUndo = true, cloud = true } = options;
    if (trackUndo) pushUndoSnapshot(reason);
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    addBackup(reason, { cloud });
    renderAll();
    if (cloud) queueSupabaseAppStateSave(reason);
  }

  function addBackup(reason, options = {}) {
    const { cloud = true } = options;
    const backup = { at: new Date().toISOString(), reason, state: safeClone(state) };
    const backups = loadBackups();
    backups.unshift(backup);
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 30)));
    if (cloud) queueSupabaseBackupSave(backup);
  }

  function loadBackups() {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function loadUndoSnapshots() {
    try {
      const raw = localStorage.getItem(UNDO_KEY);
      const parsed = JSON.parse(raw || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveUndoSnapshots(snapshots) {
    localStorage.setItem(UNDO_KEY, JSON.stringify((snapshots || []).slice(0, 50)));
  }

  function pushUndoSnapshot(reason) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const previousState = raw ? JSON.parse(raw) : createInitialState();
      const snapshots = loadUndoSnapshots();
      snapshots.unshift({
        at: new Date().toISOString(),
        reason: `이전값: ${reason || "저장 전"}`,
        state: previousState
      });
      saveUndoSnapshots(snapshots);
    } catch {
      // 복구용 스냅샷 저장 실패는 본 저장 동작을 막지 않습니다.
    }
  }

  function restorePreviousState() {
    const snapshots = loadUndoSnapshots();
    if (!snapshots.length) {
      alert("복구할 이전값이 없습니다.");
      return;
    }
    const snapshot = snapshots.shift();
    saveUndoSnapshots(snapshots);
    addBackup("이전값 복구 전 백업");
    state = normalizeState(snapshot.state);
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    addBackup("이전값 복구");
    renderAll();
    alert(`이전값을 불러왔습니다.\n${formatDateTime(snapshot.at)} · ${snapshot.reason || "저장 전 상태"}`);
  }


  function safeClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }

  let supabaseClient = null;
  let supabaseSaveTimer = null;
  let supabaseSaveReason = "저장";
  let supabaseSyncTimer = null;
  let supabaseBusy = false;
  let lastSupabaseSavePromise = Promise.resolve();


  function getAdminUser() {
    return adminSession?.user || null;
  }

  function isAllowedAdminUser(user = getAdminUser()) {
    if (!user?.id) return false;
    const allowedUserIds = ADMIN_AUTH_CONFIG.allowedUserIds || [];
    if (!allowedUserIds.length) return true;
    return allowedUserIds.includes(user.id);
  }

  function isEditorSession() {
    return !ADMIN_AUTH_CONFIG.enabled || !ADMIN_AUTH_CONFIG.lockWmsEditingUntilLogin || isAllowedAdminUser();
  }

  function findCardByTitle(titleText) {
    const headings = Array.from(document.querySelectorAll(".card h2"));
    const heading = headings.find((item) => item.textContent.trim() === titleText);
    return heading?.closest(".card") || null;
  }

  function markAdminOnlySections() {
    const adminOnlyNodes = [
      document.querySelector(".stock-move-card"),
      findCardByTitle("엑셀 주문 처리"),
      document.getElementById("orderResultCard"),
      // 파렛/박스 현황은 일반 이용자도 조회 가능해야 하므로 숨기지 않습니다.
      document.getElementById("backupCard")
    ].filter(Boolean);

    adminOnlyNodes.forEach((node) => {
      node.dataset.adminOnly = "true";
      node.classList.add("admin-only-section");
    });
  }

  function setAdminLoginPanelOpen(open) {
    adminLoginPanelOpen = Boolean(open);
    document.body.classList.toggle("admin-login-open", adminLoginPanelOpen || isEditorSession());
    updateEditorLock();
  }

  function revealAdminLogin() {
    setAdminLoginPanelOpen(true);
    setAdminAuthStatus("관리자 로그인창을 열었습니다. 등록된 관리자 계정으로 로그인하세요.", "muted");
    setTimeout(() => $("adminEmail")?.focus(), 80);
  }

  function hideAdminLogin() {
    if (isEditorSession()) return;
    setAdminLoginPanelOpen(false);
  }

  function initAdminLoginReveal() {
    let tapCount = 0;
    let tapTimer = null;

    const resetTapCount = () => {
      tapCount = 0;
      if (tapTimer) {
        clearTimeout(tapTimer);
        tapTimer = null;
      }
    };

    const handleHiddenTrigger = () => {
      tapCount += 1;
      if (tapTimer) clearTimeout(tapTimer);
      tapTimer = setTimeout(resetTapCount, 3500);
      if (tapCount >= ADMIN_AUTH_CONFIG.revealClicks) {
        resetTapCount();
        revealAdminLogin();
      }
    };

    const hiddenTriggers = [
      document.querySelector("#page-wms .wms-head h1"),
      document.querySelector(".brand-mark"),
      document.querySelector(".brand-title")
    ].filter(Boolean);

    hiddenTriggers.forEach((trigger) => {
      trigger.addEventListener("click", handleHiddenTrigger);
    });

    document.addEventListener("keydown", (event) => {
      const key = event.key?.toLowerCase();
      if (event.ctrlKey && event.altKey && key === "a") {
        event.preventDefault();
        revealAdminLogin();
      }
      if (event.key === "Escape" && adminLoginPanelOpen && !isEditorSession()) {
        hideAdminLogin();
      }
    });
  }

  function setAdminAuthStatus(text, tone = "muted") {
    const status = $("adminAuthStatus");
    if (!status) return;
    status.textContent = text || "";
    status.dataset.tone = tone;
  }

  function updateEditorLock() {
    markAdminOnlySections();

    const editable = isEditorSession();
    const loggedIn = Boolean(getAdminUser());
    const authorized = isAllowedAdminUser();
    const showLoginPanel = editable || adminLoginPanelOpen || loggedIn;

    document.body.classList.toggle("admin-active", editable);
    document.body.classList.toggle("admin-login-open", showLoginPanel);
    document.body.classList.toggle("view-only-mode", !editable);

    document.querySelectorAll("[data-admin-only='true']").forEach((node) => {
      node.hidden = !editable;
      node.setAttribute("aria-hidden", String(!editable));
    });

    // 조회용 카드: 일반 이용자는 볼 수만 있고, 입력/저장 기능은 아래에서 잠급니다.
    ["palletCard", "boxStockCard"].forEach((id) => {
      const node = $(id);
      if (!node) return;
      node.hidden = false;
      node.removeAttribute("aria-hidden");
      node.classList.remove("admin-only-section");
      delete node.dataset.adminOnly;
    });

    const syncCard = $("syncCard");
    if (syncCard) {
      const showSyncCard = editable || showLoginPanel;
      syncCard.hidden = !showSyncCard;
      syncCard.setAttribute("aria-hidden", String(!showSyncCard));
      syncCard.classList.toggle("sync-login-only", showLoginPanel && !editable);
    }

    const panel = $("adminAuthPanel");
    if (panel) {
      panel.hidden = !showLoginPanel;
      panel.setAttribute("aria-hidden", String(!showLoginPanel));
    }

    const lockSelectors = [
      "#syncNow", "#syncIntervalSelect",
      "#savePallets", "#saveBoxStock",
      "#exportBackup", "#restorePreviousWms", "#resetWms",
      "#orderFile", "#parseOrderFile", "#applyOrderDeductions",
      "#moveMemo", "#quickInboundExample", "#addStockMoveRow", "#clearStockMoveRows", "#applyStockMove",
      "#palletGrid input", "#boxStockGrid input",
      "#stockMoveRows input", "#stockMoveRows select", "#stockMoveRows button"
    ];

    document.querySelectorAll(lockSelectors.join(",")).forEach((node) => {
      node.disabled = !editable;
      node.setAttribute("aria-disabled", String(!editable));
    });

    document.querySelectorAll(".file-trigger, .import-label").forEach((label) => {
      label.classList.toggle("is-disabled", !editable);
      label.setAttribute("aria-disabled", String(!editable));
      label.tabIndex = editable ? 0 : -1;
    });

    const loginButton = $("adminLogin");
    const logoutButton = $("adminLogout");
    const emailInput = $("adminEmail");
    const passwordInput = $("adminPassword");

    if (loginButton) loginButton.hidden = loggedIn;
    if (logoutButton) logoutButton.hidden = !loggedIn;
    if (emailInput) emailInput.hidden = loggedIn;
    if (passwordInput) passwordInput.hidden = loggedIn;

    if (editable) {
      setAdminAuthStatus("관리자 수정 모드입니다. 입고, 주문 차감, 박스/파렛 수정, 백업/복구를 사용할 수 있습니다.", "success");
    } else if (loggedIn && !authorized) {
      setAdminAuthStatus("로그인된 계정이 등록된 관리자 UID가 아닙니다. 이 계정은 수정할 수 없습니다.", "danger");
    } else if (showLoginPanel) {
      setAdminAuthStatus("관리자 로그인 전에는 수정 기능이 숨겨집니다.", "muted");
    } else {
      setAdminAuthStatus("보기 전용 모드입니다.", "muted");
    }
  }


  function requireEditor(action = "수정") {
    if (isEditorSession()) return true;
    setAdminAuthStatus(`${action}은 관리자 로그인 후 가능합니다.`, "warn");
    alert(`${action}은 관리자 로그인 후 가능합니다.`);
    updateEditorLock();
    return false;
  }

  async function initAdminAuth() {
    const client = getSupabaseClient();
    const panel = $("adminAuthPanel");

    if (!ADMIN_AUTH_CONFIG.enabled || !panel) {
      adminSession = null;
      updateEditorLock();
      return;
    }

    if (!client?.auth) {
      adminSession = null;
      setAdminAuthStatus("Supabase 연결 전이라 관리자 로그인을 사용할 수 없습니다.", "muted");
      updateEditorLock();
      return;
    }

    $("adminLogin")?.addEventListener("click", async () => {
      const email = $("adminEmail")?.value.trim();
      const password = $("adminPassword")?.value || "";

      if (!email || !password) {
        setAdminAuthStatus("관리자 이메일과 비밀번호를 입력하세요.", "danger");
        return;
      }

      setAdminAuthStatus("로그인 확인 중입니다...", "muted");

      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        adminSession = null;
        setAdminAuthStatus(`로그인 실패: ${error.message}`, "danger");
        updateEditorLock();
        return;
      }

      adminSession = data?.session || null;

      if (!isAllowedAdminUser(adminSession?.user)) {
        await client.auth.signOut();
        adminSession = null;
        adminLoginPanelOpen = false;
        setAdminAuthStatus("로그인된 계정이 등록된 관리자 UID가 아닙니다. 수정 권한이 없습니다.", "danger");
        updateEditorLock();
        return;
      }

      adminLoginPanelOpen = true;
      setAdminAuthStatus("관리자 수정 권한이 확인되었습니다.", "success");
      updateEditorLock();
      syncFromSupabase({ forcePull: true, silent: true });
    });

    $("adminLogout")?.addEventListener("click", async () => {
      await client.auth.signOut();
      adminSession = null;
      adminLoginPanelOpen = false;
      setAdminAuthStatus("로그아웃되었습니다. 수정 기능은 숨겨집니다.", "muted");
      updateEditorLock();
      syncFromSupabase({ forcePull: true, silent: true });
    });

    const { data } = await client.auth.getSession();
    adminSession = data?.session || null;

    if (adminSession && !isAllowedAdminUser(adminSession.user)) {
      await client.auth.signOut();
      adminSession = null;
      adminLoginPanelOpen = false;
    } else {
      adminLoginPanelOpen = isAllowedAdminUser(adminSession?.user);
    }

    updateEditorLock();

    client.auth.onAuthStateChange(async (_event, session) => {
      if (session && !isAllowedAdminUser(session.user)) {
        adminSession = null;
        adminLoginPanelOpen = false;
        await client.auth.signOut();
        updateEditorLock();
        return;
      }

      adminSession = session || null;
      adminLoginPanelOpen = isAllowedAdminUser(adminSession?.user);
      updateEditorLock();
    });
  }

  function hasLocalSavedState() {
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return false;
    }
  }

  function getSupabaseClient() {
    if (!SUPABASE_CONFIG.enabled) return null;
    if (supabaseClient) return supabaseClient;
    if (!window.supabase?.createClient) return null;
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.key) return null;
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    return supabaseClient;
  }

  function setSyncStatus(kind, text, detail) {
    const dot = $("syncStatusDot");
    const label = $("syncStatusText");
    const desc = $("syncStatusDetail");
    if (dot) dot.className = `sync-dot ${kind || "muted"}`;
    if (label) label.textContent = text || "동기화 대기";
    if (desc) desc.textContent = detail || "";
  }

  function setSyncBusy(isBusy) {
    supabaseBusy = isBusy;
    const button = $("syncNow");
    if (button) {
      button.disabled = isBusy;
      button.textContent = isBusy ? "동기화 중..." : "지금 동기화";
    }
  }

  function setSyncTimes({ lastAt, remoteAt } = {}) {
    if (lastAt) setText("syncLastAt", formatDateTime(lastAt));
    if (remoteAt) setText("syncRemoteAt", formatDateTime(remoteAt));
  }

  function toTimeValue(value) {
    const date = new Date(value || 0);
    const time = date.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  function extractRemoteState(row) {
    const payload = row?.data;
    if (!payload || typeof payload !== "object") return null;
    const candidate = payload.state && typeof payload.state === "object" ? payload.state : payload;
    if (!candidate.stock || !candidate.pallets) return null;
    const normalized = normalizeState(candidate);
    if (row?.updated_at && toTimeValue(row.updated_at) > toTimeValue(normalized.updatedAt)) {
      normalized.updatedAt = row.updated_at;
    }
    return normalized;
  }

  function buildAppStatePayload(reason) {
    return {
      ...safeClone(state),
      cloudMeta: {
        reason: reason || "저장",
        savedAt: new Date().toISOString(),
        source: "reborn-margin-wms"
      }
    };
  }

  async function saveSupabaseAppState(reason = "저장") {
    if (ADMIN_AUTH_CONFIG.enabled && !isEditorSession()) {
      setSyncStatus("warn", "읽기 전용", "관리자 로그인 전에는 Supabase DB에 저장하지 않습니다. 화면은 DB 최신값을 불러오는 용도로만 작동합니다.");
      return false;
    }

    const client = getSupabaseClient();
    if (!client) {
      setSyncStatus("warn", "브라우저 저장", "Supabase 라이브러리 또는 설정을 찾지 못해 localStorage로 작동 중입니다.");
      return false;
    }

    const now = new Date().toISOString();
    setSyncStatus("saving", "저장 중", `${reason} 내용을 Supabase에 저장하고 있습니다.`);
    setSyncBusy(true);

    try {
      const payload = buildAppStatePayload(reason);
      const { error } = await client
        .from(SUPABASE_CONFIG.appStateTable)
        .upsert({
          id: SUPABASE_CONFIG.appStateRowId,
          data: payload,
          updated_at: now
        }, { onConflict: "id" });

      if (error) throw error;
      setSyncTimes({ lastAt: now, remoteAt: now });
      setSyncStatus("ok", "최신 상태", "Supabase와 브라우저 저장값이 동기화되었습니다.");
      return true;
    } catch (error) {
      console.warn("Supabase app_state 저장 실패", error);
      setSyncStatus("bad", "DB 저장 실패", "인터넷 또는 Supabase 설정 문제로 브라우저 저장값만 유지 중입니다.");
      return false;
    } finally {
      setSyncBusy(false);
    }
  }

  function queueSupabaseAppStateSave(reason = "저장") {
    if (!SUPABASE_CONFIG.enabled) return;
    if (ADMIN_AUTH_CONFIG.enabled && !isEditorSession()) return;
    supabaseSaveReason = reason || supabaseSaveReason || "저장";
    clearTimeout(supabaseSaveTimer);
    supabaseSaveTimer = setTimeout(() => {
      lastSupabaseSavePromise = lastSupabaseSavePromise.finally(() => saveSupabaseAppState(supabaseSaveReason));
    }, 450);
  }

  async function insertSupabaseRecord(tableName, fullRecord, minimalRecord) {
    if (ADMIN_AUTH_CONFIG.enabled && !isEditorSession()) return false;
    const client = getSupabaseClient();
    if (!client || !tableName) return false;
    try {
      const { error } = await client.from(tableName).insert(fullRecord);
      if (!error) return true;

      const fallback = minimalRecord || { data: fullRecord };
      const retry = await client.from(tableName).insert(fallback);
      if (retry.error) throw retry.error;
      return true;
    } catch (error) {
      console.warn(`${tableName} Supabase 기록 실패`, error);
      return false;
    }
  }

  function queueSupabaseBackupSave(backup) {
    if (!SUPABASE_CONFIG.enabled || !backup) return;
    setTimeout(() => {
      insertSupabaseRecord(
        SUPABASE_CONFIG.backupTable,
        {
          reason: backup.reason || "백업",
          data: backup,
          created_at: backup.at || new Date().toISOString()
        },
        { data: backup }
      );
    }, 0);
  }

  function queueSupabaseMovementSave(record) {
    if (!SUPABASE_CONFIG.enabled || !record) return;
    setTimeout(() => {
      insertSupabaseRecord(
        SUPABASE_CONFIG.movementTable,
        {
          type: record.type || "기록",
          memo: record.memo || "",
          qty_text: record.qtyText || "",
          data: record,
          created_at: record.at || new Date().toISOString()
        },
        { data: record }
      );
    }, 0);
  }

  function queueSupabaseOrderStatSave(record) {
    if (!SUPABASE_CONFIG.enabled || !record) return;
    setTimeout(() => {
      insertSupabaseRecord(
        SUPABASE_CONFIG.orderStatsTable,
        {
          order_rows: record.orderRows || 0,
          payment_group_count: record.paymentGroupCount || 0,
          payment_unique_sum: record.paymentUniqueSum || 0,
          data: record,
          created_at: record.at || new Date().toISOString()
        },
        { data: record }
      );
    }, 0);
  }

  async function syncFromSupabase(options = {}) {
    const { forcePull = false, silent = false } = options;
    if (supabaseBusy) return;

    const client = getSupabaseClient();
    if (!client) {
      setSyncStatus("warn", "브라우저 저장", "Supabase CDN을 불러오지 못했거나 연결 정보가 없어 localStorage로 작동 중입니다.");
      return;
    }

    if (!silent) setSyncStatus("checking", "확인 중", "Supabase에 저장된 최신 재고를 확인하고 있습니다.");
    setSyncBusy(true);

    try {
      const { data, error } = await client
        .from(SUPABASE_CONFIG.appStateTable)
        .select("data,updated_at")
        .eq("id", SUPABASE_CONFIG.appStateRowId)
        .maybeSingle();

      if (error) throw error;

      const remoteState = extractRemoteState(data);
      const remoteAt = data?.updated_at || remoteState?.updatedAt || "";
      const localAt = state?.updatedAt || "";

      if (!remoteState) {
        if (isEditorSession()) {
          setSyncStatus("saving", "DB 초기 저장", "Supabase에 아직 유효한 재고 상태가 없어 현재 브라우저 값을 올립니다.");
          setSyncBusy(false);
          await saveSupabaseAppState("DB 초기 저장");
        } else {
          setSyncStatus("warn", "읽기 전용", "DB에 아직 유효한 재고가 없습니다. 관리자 로그인 후 초기 저장이 가능합니다.");
        }
        return;
      }

      const shouldApplyRemote = forcePull || !hasLocalSavedState() || toTimeValue(remoteAt) > toTimeValue(localAt) || (ADMIN_AUTH_CONFIG.enabled && !isEditorSession());

      if (shouldApplyRemote) {
        state = normalizeState(remoteState);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        setSyncTimes({ lastAt: new Date().toISOString(), remoteAt: remoteAt || state.updatedAt });
        setSyncStatus("ok", "최신 상태", "Supabase의 최신 재고를 불러와 화면에 반영했습니다.");
      } else {
        setSyncTimes({ lastAt: new Date().toISOString(), remoteAt: remoteAt || localAt });
        setSyncStatus("ok", "최신 상태", "현재 브라우저 재고가 DB와 같거나 더 최신입니다.");
        if (toTimeValue(localAt) > toTimeValue(remoteAt) && isEditorSession()) {
          setSyncBusy(false);
          await saveSupabaseAppState("로컬 최신 상태 동기화");
          return;
        }
      }
    } catch (error) {
      console.warn("Supabase 동기화 실패", error);
      setSyncStatus("bad", "동기화 실패", "Supabase 연결에 실패했습니다. 현재 화면은 브라우저 저장값으로 계속 작동합니다.");
    } finally {
      setSyncBusy(false);
    }
  }

  function getStoredSyncInterval() {
    try {
      const saved = Number(localStorage.getItem(SYNC_INTERVAL_KEY));
      if ([0, 60000, 300000, 600000, 1800000, 3600000].includes(saved)) return saved;
    } catch {
      // ignore
    }
    return SUPABASE_CONFIG.defaultSyncIntervalMs;
  }

  function setAutoSyncInterval(ms) {
    clearInterval(supabaseSyncTimer);
    supabaseSyncTimer = null;
    const interval = Number(ms) || 0;
    try { localStorage.setItem(SYNC_INTERVAL_KEY, String(interval)); } catch { /* ignore */ }
    if (interval > 0) {
      supabaseSyncTimer = setInterval(() => syncFromSupabase({ silent: true }), interval);
    }
  }

  function initSupabaseSync() {
    const select = $("syncIntervalSelect");
    const savedInterval = getStoredSyncInterval();
    if (select) {
      select.value = String(savedInterval);
      select.addEventListener("change", () => setAutoSyncInterval(select.value));
    }

    $("syncNow")?.addEventListener("click", () => syncFromSupabase({ forcePull: false }));

    if (!getSupabaseClient()) {
      setSyncStatus("warn", "브라우저 저장", "Supabase 라이브러리를 아직 불러오지 못해 localStorage로 작동 중입니다.");
      setAutoSyncInterval(0);
      if (select) select.value = "0";
      return;
    }

    setSyncStatus("checking", "연결 확인", "Supabase 연결을 확인하고 최신 재고를 불러옵니다.");
    setAutoSyncInterval(savedInterval);
    syncFromSupabase({ silent: false });
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function initRouting() {
    const buttons = [...document.querySelectorAll("[data-route]")];
    const routeTo = (route) => {
      const safeRoute = route === "wms" ? "wms" : "margin";
      document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
      $(`page-${safeRoute}`)?.classList.add("active");
      document.querySelectorAll(".category-btn").forEach((button) => button.classList.toggle("active", button.dataset.route === safeRoute));
      if (location.hash !== `#${safeRoute}`) history.replaceState(null, "", `#${safeRoute}`);
      if (safeRoute === "wms") requestAnimationFrame(renderOrderChart);
    };
    buttons.forEach((button) => button.addEventListener("click", () => routeTo(button.dataset.route)));
    window.addEventListener("hashchange", () => routeTo(location.hash.replace("#", "")));
    routeTo(location.hash.replace("#", "") || "margin");
  }

  function enhanceNativeSelects(root = document) {
    root.querySelectorAll("label.field select:not([data-select-polished])").forEach((select) => {
      select.dataset.selectPolished = "1";
      if (select.parentElement?.classList.contains("select-shell")) return;
      const shell = document.createElement("span");
      shell.className = "select-shell";
      select.parentNode.insertBefore(shell, select);
      shell.appendChild(select);
    });
  }

  function initMarginClearOnFocus() {
    document.querySelectorAll("#page-margin input[type='number']").forEach((input) => {
      if (input.dataset.clearReady) return;
      input.dataset.clearReady = "1";
      input.addEventListener("focus", () => {
        if (input.readOnly || input.disabled) return;
        input.dataset.previousValue = input.value;
        input.value = "";
        input.classList.add("editing-now");
      });
      input.addEventListener("blur", () => {
        if (input.value.trim() === "" && input.dataset.previousValue !== undefined) {
          input.value = input.dataset.previousValue;
        }
        input.classList.remove("editing-now");
        calculateMargin();
      });
    });
  }

  function initCollapsibleSections() {
    document.querySelectorAll("[data-collapsible]").forEach((card) => {
      if (card.dataset.collapseReady) return;
      const titleRow = card.querySelector(".card-title-row");
      if (!titleRow) return;

      const body = document.createElement("div");
      body.className = "collapsible-body";
      const nodes = [];
      let node = titleRow.nextSibling;
      while (node) {
        nodes.push(node);
        node = node.nextSibling;
      }
      nodes.forEach((child) => body.appendChild(child));
      card.appendChild(body);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "collapse-toggle";
      button.innerHTML = '<span>접기</span><i aria-hidden="true"></i>';
      titleRow.appendChild(button);

      const key = card.dataset.collapseKey || card.id || "section";
      const saved = localStorage.getItem(`reborn-collapse:${key}`);
      const defaultClosed = card.dataset.collapseDefault === "closed";
      const setCollapsed = (collapsed, save = false) => {
        card.classList.toggle("collapsed", collapsed);
        button.setAttribute("aria-expanded", String(!collapsed));
        button.querySelector("span").textContent = collapsed ? "펼치기" : "접기";
        if (save) localStorage.setItem(`reborn-collapse:${key}`, collapsed ? "1" : "0");
        if (!collapsed && card.id === "orderChartCard") requestAnimationFrame(renderOrderChart);
      };

      setCollapsed(saved ? saved === "1" : defaultClosed);
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        setCollapsed(!card.classList.contains("collapsed"), true);
      });
      card.dataset.collapseReady = "1";
    });
  }


  function buildMarginProductPicker(select) {
    if (!select || select.dataset.customPickerReady) return;
    select.dataset.customPickerReady = "1";
    const shell = select.closest(".select-shell") || select;
    shell.classList.add("is-hidden-select");

    const picker = document.createElement("div");
    picker.className = "product-picker";
    picker.innerHTML = `
      <button type="button" class="product-picker-trigger" aria-expanded="false">
        <span class="picker-label">상품을 선택하세요</span>
        <small>원가 자동 입력</small>
      </button>
      <div class="product-picker-menu" hidden>
        <input type="search" class="product-picker-search" placeholder="상품명 검색" autocomplete="off" />
        <div class="product-picker-list" role="listbox"></div>
      </div>
    `;
    shell.after(picker);

    const trigger = picker.querySelector(".product-picker-trigger");
    const menu = picker.querySelector(".product-picker-menu");
    const search = picker.querySelector(".product-picker-search");
    const list = picker.querySelector(".product-picker-list");
    const label = picker.querySelector(".picker-label");

    const syncLabel = () => {
      const selected = MARGIN_PRODUCTS.find((item) => item.name === select.value) || MARGIN_PRODUCTS[0];
      label.textContent = selected?.name || "상품을 선택하세요";
      trigger.querySelector("small").textContent = selected?.cost ? `${money(selected.cost)} 자동 입력` : "원가 직접 입력";
    };

    const close = () => {
      menu.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      picker.classList.remove("open");
    };

    const open = () => {
      menu.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      picker.classList.add("open");
      renderList(search.value);
      requestAnimationFrame(() => search.focus());
    };

    const renderList = (keyword = "") => {
      const q = keyword.trim().toLowerCase();
      const items = MARGIN_PRODUCTS.filter((item) => !q || item.name.toLowerCase().includes(q));
      list.innerHTML = items.map((item) => `
        <button type="button" class="product-picker-option ${item.name === select.value ? "active" : ""}" data-name="${escapeHtml(item.name)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.cost ? money(item.cost) : "원가 직접 입력"}</span>
        </button>
      `).join("") || `<p class="picker-empty">검색 결과가 없습니다.</p>`;
    };

    trigger.addEventListener("click", () => menu.hidden ? open() : close());
    search.addEventListener("input", () => renderList(search.value));
    list.addEventListener("click", (event) => {
      const option = event.target.closest(".product-picker-option");
      if (!option) return;
      select.value = option.dataset.name;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      syncLabel();
      close();
    });
    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) close();
    });
    select.addEventListener("change", syncLabel);
    syncLabel();
  }

  function initMarginCalculator() {
    const select = $("productSelect");
    if (!select) return;
    select.innerHTML = MARGIN_PRODUCTS.map((item) => `<option value="${escapeHtml(item.name)}" data-cost="${item.cost}">${escapeHtml(item.name)}${item.cost ? ` · ${money(item.cost)}` : ""}</option>`).join("");
    enhanceNativeSelects($("page-margin") || document);
    initMarginClearOnFocus();
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const cost = cleanNumber(option?.dataset.cost);
      if (cost > 0) $("unitCost").value = cost;
      calculateMargin();
    });
    document.querySelectorAll("#page-margin input, #page-margin select").forEach((el) => el.addEventListener("input", calculateMargin));
    document.querySelectorAll("[data-box-cost]").forEach((button) => button.addEventListener("click", () => {
      $("boxFee").value = button.dataset.boxCost;
      calculateMargin();
    }));
    $("resetMarginDefaults")?.addEventListener("click", () => {
      $("shippingFee").value = 2400;
      $("commissionRate").value = 12;
      $("vatRate").value = 10;
      $("earlyRate").value = 1.2;
      $("saleQty").value = 1;
      $("boxFee").value = 0;
      calculateMargin();
    });
    select.dispatchEvent(new Event("change"));
  }

  function calculateMargin() {
    // 기준 파일의 계산 방식 적용:
    // 판매가는 수량을 곱하지 않은 총 결제/판매금액으로 보고,
    // 상품 원가만 '낱개당 매입가 × 판매 수량'으로 계산합니다.
    const sale = cleanNumber($("salePrice")?.value);
    const qty = cleanNumber($("saleQty")?.value);
    const unitCost = cleanNumber($("unitCost")?.value);
    const shippingFee = cleanNumber($("shippingFee")?.value);
    const boxFee = cleanNumber($("boxFee")?.value);
    const commissionRate = cleanNumber($("commissionRate")?.value) / 100;
    const vatRate = cleanNumber($("vatRate")?.value) / 100;
    const earlyRate = cleanNumber($("earlyRate")?.value) / 100;
    const variableRate = commissionRate + vatRate + earlyRate;

    const productCost = unitCost * qty;
    const fixedCost = productCost + boxFee + shippingFee;
    const commission = sale * commissionRate;
    const vat = sale * vatRate;
    const early = sale * earlyRate;
    const total = fixedCost + commission + vat + early;
    const net = sale - total;
    const marginRate = sale > 0 ? (net / sale) * 100 : 0;
    const breakEven = variableRate < 1 ? fixedCost / (1 - variableRate) : 0;
    const targetSale = variableRate + 0.1 < 1 ? fixedCost / (1 - variableRate - 0.1) : 0;

    setText("grossSales", money(sale));
    setText("productCost", money(productCost));
    setText("boxFeeResult", money(boxFee));
    setText("shippingFeeResult", money(shippingFee));
    setText("commissionCost", money(commission));
    setText("vatCost", money(vat));
    setText("earlyCost", money(early));
    setText("totalCost", money(total));
    setText("breakEvenPrice", money(roundToTen(breakEven)));
    setText("targetSalePrice", money(roundToTen(targetSale)));
    setText("netProfit", money(net));
    setText("marginRateText", `마진율 ${marginRate.toFixed(2)}%`);

    const badge = $("marginBadge");
    if (badge) {
      if (!sale || !fixedCost) {
        badge.textContent = "대기";
        badge.className = "status-badge";
      } else if (net < 0) {
        badge.textContent = "손실";
        badge.className = "status-badge bad";
      } else if (marginRate < 10) {
        badge.textContent = "주의";
        badge.className = "status-badge warn";
      } else {
        badge.textContent = "양호";
        badge.className = "status-badge good";
      }
    }
  }

  function initWms() {
    if (archiveOldOrderStats()) {
      state.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    renderPalletInputs();
    renderBoxStockInputs();
    renderStockMoveRows();
    bindWmsEvents();
    renderAll();
    enhanceNativeSelects($("page-wms") || document);
    initCollapsibleSections();
  }

  
  let mobileCompactSummaryResizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(mobileCompactSummaryResizeTimer);
    mobileCompactSummaryResizeTimer = window.setTimeout(() => {
      renderSummary();
    }, 120);
  });

function refreshActiveOrderAnalysisSummary() {
    if (!lastOrderAnalysis) return;
    const summary = $("excelSummary");
    if (!summary) return;

    const currentAsset = computeInventoryAssetValue({ includeBoxes: true }).asset;
    const assetDeductionValue = lastOrderAnalysis.assetDeductionValue ?? calcMovementAssetValue(lastOrderAnalysis.deductions || []);
    const boxAssetDeductionValue = lastOrderAnalysis.boxAssetDeductionValue ?? calcMovementAssetValue(lastOrderAnalysis.boxUsages || [], { includeBoxes: true });
    const afterAsset = currentAsset - assetDeductionValue - boxAssetDeductionValue;

    summary.innerHTML = `
        <div>주문 행 기준: <strong>${number(lastOrderAnalysis.orderRows)}건</strong></div>
        <div>주소+판매금액 기준 주문: <strong>${number(lastOrderAnalysis.paymentGroupCount)}건</strong></div>
        <div>중복 제외 주문금액: <strong>${money(lastOrderAnalysis.paymentUniqueSum)}</strong></div>
        <div>중복 제외 추가배송비: <strong>${money(lastOrderAnalysis.extraShippingSum || 0)}</strong></div>
        <div>중복 제외 주문금액+추가배송비: <strong>${money(lastOrderAnalysis.paymentUniqueWithExtraShipping || lastOrderAnalysis.paymentUniqueSum)}</strong></div>
        <div class="asset-loss">상품 재고자산 차감 예정: <strong>${money(assetDeductionValue)}</strong></div>
        <div class="asset-loss muted-small">박스 재고 차감액: <strong>${money(boxAssetDeductionValue)}</strong></div>
        <div class="asset-loss muted-small">차감 후 예상 재고자산: <strong>${money(afterAsset)}</strong></div>
      `;
  }

  function renderAll() {
    renderInventory();
    renderPalletInputs(false);
    renderBoxStockInputs(false);
    renderSummary();
    renderOrderChart();
    renderHistory();
    renderBackups();
    refreshActiveOrderAnalysisSummary();
    updateEditorLock();
  }

  function renderPalletInputs(rebuild = true) {
    const grid = $("palletGrid");
    if (!grid) return;
    if (!rebuild && grid.children.length) {
      Object.entries(state.pallets).forEach(([key, value]) => {
        const input = grid.querySelector(`[data-pallet-key="${cssEscape(key)}"]`);
        if (input && document.activeElement !== input) input.value = value;
      });
      return;
    }
    grid.innerHTML = Object.entries(state.pallets).map(([key, value]) => `
      <div class="pallet-item">
        <label>${escapeHtml(key)}</label>
        <input type="number" min="0" inputmode="numeric" value="${value}" data-pallet-key="${escapeHtml(key)}" />
      </div>
    `).join("");
  }
  function boxSkus() {
    return Object.keys(INVENTORY_DEFS).filter((sku) => INVENTORY_DEFS[sku]?.isBox);
  }

  function renderBoxStockInputs(rebuild = true) {
    const grid = $("boxStockGrid");
    if (!grid) return;

    if (!rebuild && grid.children.length) {
      boxSkus().forEach((sku) => {
        const item = grid.querySelector(`[data-box-sku="${cssEscape(sku)}"]`);
        if (!item) return;
        const normalized = normalizeUnits(sku, state.stock[sku]?.units || 0);
        const fields = { pallets: normalized.pallets, boxes: normalized.boxes, eaches: normalized.eaches };
        Object.entries(fields).forEach(([field, value]) => {
          const input = item.querySelector(`[data-box-field="${field}"]`);
          if (input && document.activeElement !== input) input.value = value;
        });
        const preview = item.querySelector(".box-stock-preview");
        if (preview) preview.textContent = formatStock(sku, state.stock[sku]?.units || 0);
      });
      return;
    }

    grid.innerHTML = boxSkus().map((sku) => {
      const def = INVENTORY_DEFS[sku];
      const normalized = normalizeUnits(sku, state.stock[sku]?.units || 0);
      return `
        <div class="box-stock-item" data-box-sku="${escapeHtml(sku)}">
          <div class="box-stock-head">
            <strong>${escapeHtml(sku)}</strong>
            <span class="box-stock-preview">${escapeHtml(formatStock(sku, state.stock[sku]?.units || 0))}</span>
          </div>
          <div class="box-stock-meta">${escapeHtml(def.structure || "")}</div>
          <div class="box-stock-inputs">
            <label><span>파렛</span><input type="number" min="0" inputmode="numeric" value="${normalized.pallets}" data-box-field="pallets" /></label>
            <label><span>묶음</span><input type="number" min="0" inputmode="numeric" value="${normalized.boxes}" data-box-field="boxes" /></label>
            <label><span>장</span><input type="number" min="0" inputmode="numeric" value="${normalized.eaches}" data-box-field="eaches" /></label>
          </div>
        </div>
      `;
    }).join("");
  }

  function skuOptions(selectedSku = "") {
    return Object.keys(INVENTORY_DEFS)
      .map((sku) => `<option value="${escapeHtml(sku)}" ${sku === selectedSku ? "selected" : ""}>${escapeHtml(sku)}</option>`)
      .join("");
  }

  function renderStockMoveRows() {
    const wrap = $("stockMoveRows");
    if (!wrap) return;
    if (!wrap.children.length) addStockMoveRow();
    updateMoveBatchSummary();
  }

  function addStockMoveRow(defaults = {}) {
    const wrap = $("stockMoveRows");
    if (!wrap) return;
    const rowId = `move-row-${++stockMoveRowSeq}`;
    const row = document.createElement("div");
    row.className = "move-row";
    row.dataset.rowId = rowId;
    row.innerHTML = `
      <label class="field move-sku">
        <span>품목</span>
        <select class="moveSku">${skuOptions(defaults.sku || "")}</select>
      </label>
      <label class="field move-qty">
        <span>파렛</span>
        <input class="movePallets" type="number" inputmode="numeric" min="0" value="${defaults.pallets || 0}" />
      </label>
      <label class="field move-qty">
        <span>박스/묶음</span>
        <input class="moveBoxes" type="number" inputmode="numeric" min="0" value="${defaults.boxes || 0}" />
      </label>
      <label class="field move-qty">
        <span>낱개</span>
        <input class="moveEaches" type="number" inputmode="numeric" min="0" value="${defaults.eaches || 0}" />
      </label>
      <button type="button" class="icon-btn removeMoveRow" aria-label="입력 행 삭제">×</button>
    `;
    wrap.appendChild(row);
    enhanceNativeSelects(row);
    row.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", updateMoveBatchSummary);
      el.addEventListener("change", updateMoveBatchSummary);
    });
    row.querySelector(".removeMoveRow")?.addEventListener("click", () => {
      if (wrap.children.length <= 1) {
        row.querySelectorAll("input").forEach((input) => input.value = 0);
      } else {
        row.remove();
      }
      updateMoveBatchSummary();
    });
    updateMoveBatchSummary();
  }

  function clearStockMoveRows() {
    const wrap = $("stockMoveRows");
    if (!wrap) return;
    wrap.innerHTML = "";
    addStockMoveRow();
    const memo = $("moveMemo");
    if (memo) memo.value = "";
    updateMoveBatchSummary();
  }

  function getStockMoveRows() {
    return [...document.querySelectorAll("#stockMoveRows .move-row")].map((row) => {
      const sku = row.querySelector(".moveSku")?.value || "";
      const input = {
        pallets: cleanNumber(row.querySelector(".movePallets")?.value),
        boxes: cleanNumber(row.querySelector(".moveBoxes")?.value),
        eaches: cleanNumber(row.querySelector(".moveEaches")?.value)
      };
      return { sku, input, units: sku ? unitsFromInput(sku, input) : 0 };
    });
  }

  function updateMoveBatchSummary() {
    const summary = $("moveBatchSummary");
    if (!summary) return;
    const rows = getStockMoveRows().filter((row) => row.sku && row.units > 0);
    const inputTotals = rows.reduce((acc, row) => {
      acc.pallets += row.input.pallets || 0;
      acc.boxes += row.input.boxes || 0;
      acc.eaches += row.input.eaches || 0;
      acc.units += row.units || 0;
      return acc;
    }, { pallets: 0, boxes: 0, eaches: 0, units: 0 });
    summary.innerHTML = `입력 예정 <strong>${number(rows.length)}개 품목</strong> · 파렛 <strong>${number(inputTotals.pallets)}</strong> · 박스/묶음 <strong>${number(inputTotals.boxes)}</strong> · 낱개 <strong>${number(inputTotals.eaches)}</strong> · 총 환산 <strong>${number(inputTotals.units)}개</strong>`;
  }

  function renderInventory() {
    const tbody = $("inventoryTable");
    if (!tbody) return;
    const keyword = ($("inventorySearch")?.value || "").trim().toLowerCase();
    const matchedSkus = Object.keys(INVENTORY_DEFS)
      .filter((sku) => !keyword || sku.toLowerCase().includes(keyword) || INVENTORY_DEFS[sku].group.toLowerCase().includes(keyword));

    matchedSkus.sort((a, b) => {
      const aLow = safetyStatus(a, state.stock[a]?.units || 0)?.isLow ? 1 : 0;
      const bLow = safetyStatus(b, state.stock[b]?.units || 0)?.isLow ? 1 : 0;
      return bLow - aLow;
    });

    const rows = matchedSkus.map((sku) => {
        const def = INVENTORY_DEFS[sku];
        const item = state.stock[sku] || { units: 0 };
        const asset = def.cost ? item.units * def.cost : null;
        const safety = safetyStatus(sku, item.units);
        const isZeroOrNegative = item.units <= 0;
        const unitsClass = item.units < 0 ? "negative" : item.units === 0 ? "zero-stock-number" : "";
        const stockKind = isZeroOrNegative ? "danger" : safety?.isLow ? "low" : "safe";
        const stockLabel = item.units < 0
          ? "마이너스 재고"
          : item.units === 0
            ? "재고 0개"
            : safety ? (safety.isLow ? "안전재고 미만" : "안전재고 이상") : "현재 재고";
        const stockRatio = safety?.threshold ? Math.min(100, Math.max(0, Math.round(((item.units || 0) / safety.threshold) * 100))) : (item.units <= 0 ? 0 : 100);
        const safetyText = item.units <= 0 ? `
          <div class="danger-stock-badge">재고 없음</div>
          ${safety?.thresholdText ? `<div class="danger-stock-detail">기준 ${escapeHtml(safety.thresholdText)}</div>` : ""}
        ` : safety?.isLow ? `
          <div class="low-stock-badge">안전재고 부족</div>
          <div class="low-stock-detail">기준 ${escapeHtml(safety.thresholdText)} · 부족 ${escapeHtml(safety.shortageText)}</div>
        ` : safety ? `
          <div class="safe-stock-badge">안전권</div>
          <div class="safe-stock-detail">기준 ${escapeHtml(safety.thresholdText)}</div>
        ` : `<span class="muted">안전재고 미설정</span>`;
        const rowKindClass = isZeroOrNegative ? "danger-stock-row" : safety?.isLow ? "low-stock-row" : "safe-stock-row";
        return `
          <tr class="inventory-click-row ${rowKindClass}" data-inventory-sku="${escapeHtml(sku)}" tabindex="0" role="button" aria-label="${escapeHtml(sku)} 재고 상세 보기">
            <td data-label="품목"><strong>${escapeHtml(sku)}</strong><br><span class="muted">${escapeHtml(def.group)}</span></td>
            <td data-label="구조">${escapeHtml(def.structure)}${def.note ? `<br><span class="muted caution-note">${escapeHtml(def.note)}</span>` : ""}</td>
            <td data-label="현재 재고" class="stock-now-cell">
              <div class="stock-status ${stockKind}">
                <div class="stock-status-top">
                  <strong>${escapeHtml(formatStock(sku, item.units))}</strong>
                  <span>${escapeHtml(stockLabel)}</span>
                </div>
                <div class="stock-meter" aria-hidden="true"><i style="width:${stockRatio}%"></i></div>
              </div>
            </td>
            <td data-label="총 낱개" class="${unitsClass}">${number(item.units)}</td>
            <td data-label="재고자산">${asset === null ? "<span class='muted'>원가 미입력</span>" : money(asset)}</td>
            <td data-label="상태" class="safety-cell">${safetyText}</td>
          </tr>`;
      }).join("");
    tbody.innerHTML = rows || `<tr><td colspan="6" class="muted">검색 결과가 없습니다.</td></tr>`;
  }

  function lowSafetyItems() {
    return Object.keys(INVENTORY_DEFS)
      .map((sku) => ({ sku, status: safetyStatus(sku, state.stock[sku]?.units || 0) }))
      .filter((item) => item.status?.isLow);
  }

  function computeInventoryAssetValue(options = {}) {
    const { includeBoxes = true } = options;
    let asset = 0;
    let unknown = 0;
    Object.entries(INVENTORY_DEFS).forEach(([sku, def]) => {
      if (def.isBox && !includeBoxes) return;
      const units = Number(state.stock[sku]?.units) || 0;
      if (def.cost) asset += units * def.cost;
      else unknown += 1;
    });
    return { asset, unknown };
  }

  function calcMovementAssetValue(list = [], options = {}) {
    const { includeBoxes = false } = options;
    return list.reduce((sum, { sku, units }) => {
      const def = INVENTORY_DEFS[sku];
      if (!def?.cost) return sum;
      if (def.isBox && !includeBoxes) return sum;
      return sum + (Number(units) || 0) * def.cost;
    }, 0);
  }

  function renderSummary() {
    const { asset, unknown } = computeInventoryAssetValue();
    setText("assetValue", isMobileWmsCompactView() ? compactKoreanWon(asset) : money(asset));
    setText("unknownCostInfo", `상품/박스 원가 미입력 ${unknown}개 품목 제외`);
    const lowItems = lowSafetyItems();
    setText("lowStockCount", `${number(lowItems.length)}개`);
    setText("lowStockInfo", lowItems.length ? `${lowItems.slice(0, 2).map((item) => item.sku).join(", ")}${lowItems.length > 2 ? " 외" : ""}` : "모든 품목 안전권");

    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const today = todayKey();
    const stats = state.orderStats || [];
    const countSince = (days) => stats
      .filter((item) => (now - new Date(item.at)) <= days * dayMs)
      .reduce((sum, item) => sum + (item.orderRows || 0), 0);
    setText("ordersToday", `${stats.filter((item) => dateKey(item.at) === today).reduce((sum, item) => sum + (item.orderRows || 0), 0).toLocaleString("ko-KR")}건`);
    setText("ordersWeek", `${countSince(7).toLocaleString("ko-KR")}건`);
    setText("ordersMonth", `${countSince(30).toLocaleString("ko-KR")}건`);
    setText("cumulativeOrderTotal", `${number(getCumulativeOrderTotal())}건`);
    setText("waterReminder", waterReminderText());
  }

  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function formatMonthDay(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function monthKey(date) {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) return "";
    return `${safeDate.getFullYear()}-${String(safeDate.getMonth() + 1).padStart(2, "0")}`;
  }

  function orderStatRows() {
    return (state.orderStats || [])
      .map((item) => ({
        at: new Date(item.at),
        orderRows: cleanNumber(item.orderRows)
      }))
      .filter((item) => !Number.isNaN(item.at.getTime()) && item.orderRows > 0);
  }

  function buildDailyChartData() {
    const today = startOfDay(new Date());
    const points = [];
    const totals = new Map();
    orderStatRows().forEach((item) => {
      const key = dateKey(item.at);
      totals.set(key, (totals.get(key) || 0) + item.orderRows);
    });
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset);
      const key = dateKey(date);
      points.push({ label: formatMonthDay(date), value: totals.get(key) || 0 });
    }
    return { subtitle: "1번 · 최근 1주일 일별 주문건수", points };
  }

  function buildWeeklyChartData() {
    const today = startOfDay(new Date());
    const points = [];
    const stats = orderStatRows();
    for (let offset = 3; offset >= 0; offset -= 1) {
      const start = addDays(today, -(offset * 7 + 6));
      const end = addDays(start, 6);
      const value = stats
        .filter((item) => item.at >= start && item.at < addDays(end, 1))
        .reduce((sum, item) => sum + item.orderRows, 0);
      points.push({ label: `${formatMonthDay(start)}~${formatMonthDay(end)}`, value });
    }
    return { subtitle: "2번 · 최근 1달 주차별 주문건수", points };
  }

  function buildMonthlyChartData() {
    const now = new Date();
    const totals = new Map();
    orderStatRows().forEach((item) => {
      const key = monthKey(item.at);
      totals.set(key, (totals.get(key) || 0) + item.orderRows);
    });
    const points = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthKey(date);
      points.push({ label: `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}`, value: totals.get(key) || 0 });
    }
    return { subtitle: "3번 · 최근 1년 월별 주문건수", points };
  }

  function getOrderChartData() {
    if (orderChartMode === "weekly") return buildWeeklyChartData();
    if (orderChartMode === "monthly") return buildMonthlyChartData();
    return buildDailyChartData();
  }

  function renderOrderChart() {
    const canvas = $("orderChart");
    if (!canvas) return;
    document.querySelectorAll(".chart-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.chartMode === orderChartMode));
    const data = getOrderChartData();
    const total = data.points.reduce((sum, point) => sum + point.value, 0);
    setText("orderChartSubtitle", data.subtitle);
    setText("orderChartTotal", `합계 ${number(total)}건`);
    const empty = $("orderChartEmpty");
    if (empty) empty.hidden = orderStatRows().length > 0;
    drawLineChart(canvas, data.points);
  }

  function drawLineChart(canvas, points) {
    const parent = canvas.parentElement;
    const cssWidth = Math.max(320, Math.floor(parent?.clientWidth || canvas.clientWidth || 900));
    const cssHeight = Math.max(240, Math.floor(canvas.clientHeight || 300));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const isNarrowChart = cssWidth < 520;
    const pad = isNarrowChart
      ? { top: 32, right: 14, bottom: 58, left: 38 }
      : { top: 34, right: 24, bottom: 56, left: 52 };
    const width = cssWidth - pad.left - pad.right;
    const height = cssHeight - pad.top - pad.bottom;
    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const yMax = Math.max(5, Math.ceil(maxValue / 5) * 5);

    ctx.font = "12px Pretendard, system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.fillStyle = "rgba(232,238,255,0.58)";
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + height * (i / 4);
      const value = Math.round(yMax * (1 - i / 4));
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(cssWidth - pad.right, y);
      ctx.stroke();
      ctx.fillText(number(value), 12, y + 4);
    }

    const coords = points.map((point, index) => {
      const x = points.length === 1 ? pad.left + width / 2 : pad.left + width * (index / (points.length - 1));
      const y = pad.top + height - (point.value / yMax) * height;
      return { ...point, x, y };
    });

    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + height);
    gradient.addColorStop(0, "rgba(255,94,158,0.28)");
    gradient.addColorStop(1, "rgba(139,92,246,0.02)");
    ctx.beginPath();
    coords.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(coords[coords.length - 1].x, pad.top + height);
    ctx.lineTo(coords[0].x, pad.top + height);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    coords.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,94,158,0.96)";
    ctx.stroke();

    coords.forEach((point) => {
      ctx.beginPath();
      ctx.fillStyle = "rgba(17,22,38,0.95)";
      ctx.strokeStyle = "rgba(255,255,255,0.82)";
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "700 12px Pretendard, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(number(point.value), point.x, Math.max(18, point.y - 12));
    });

    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(232,238,255,0.62)";
    ctx.font = "700 12px Pretendard, system-ui, sans-serif";
    const labelStep = isNarrowChart && points.length > 7 ? 2 : 1;
    coords.forEach((point, index) => {
      if (labelStep > 1 && index % labelStep !== 0 && index !== coords.length - 1) return;
      ctx.fillText(point.label, point.x, cssHeight - 24);
    });
  }

  function archiveOldOrderStats() {
    const stats = state.orderStats || [];
    if (!stats.length) return false;
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const archives = { ...(state.orderYearArchives || {}) };
    const keep = [];
    stats.forEach((item) => {
      const date = new Date(item.at);
      const orderRows = cleanNumber(item.orderRows);
      if (!Number.isNaN(date.getTime()) && date < cutoff) {
        const year = String(date.getFullYear());
        archives[year] = cleanNumber(archives[year]) + orderRows;
      } else {
        keep.push(item);
      }
    });
    const changed = keep.length !== stats.length;
    state.orderStats = keep;
    state.orderYearArchives = archives;
    return changed;
  }

  function getCumulativeYearTotals() {
    const totals = { ...(state.orderYearArchives || {}) };
    orderStatRows().forEach((item) => {
      const year = String(item.at.getFullYear());
      totals[year] = cleanNumber(totals[year]) + item.orderRows;
    });
    return Object.entries(totals)
      .map(([year, value]) => ({ year, value: cleanNumber(value) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => Number(b.year) - Number(a.year));
  }

  function getCumulativeOrderTotal() {
    return getCumulativeYearTotals().reduce((sum, item) => sum + item.value, 0);
  }

  function openCumulativeSales() {
    const overlay = $("cumulativeOverlay");
    const body = $("cumulativeBody");
    if (!overlay || !body) return;
    const rows = getCumulativeYearTotals();
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    const max = Math.max(1, ...rows.map((item) => item.value));
    setText("cumulativeMeta", `전체 누적 ${number(total)}건 · 연도별 주문건수 합계`);
    body.innerHTML = rows.length
      ? rows.map((item) => `
        <div class="year-total-line">
          <strong>${escapeHtml(item.year)}년</strong>
          <span>${number(item.value)}건</span>
          <div class="year-total-bar" aria-hidden="true"><i style="width:${Math.max(6, Math.round((item.value / max) * 100))}%"></i></div>
        </div>`).join("")
      : `<div class="detail-empty">아직 누적 판매량으로 표시할 주문 처리 기록이 없습니다.</div>`;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeCumulativeSales() {
    const overlay = $("cumulativeOverlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("open");
    overlay.hidden = true;
  }

  function waterReminderText() {
    const now = new Date();
    const start = new Date(2026, 4, 1);
    if (now < start) return "2026년 5월 1일 예정";
    if (now.getDate() === 1) return "오늘 보충 확인";
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return `${next.getMonth() + 1}월 1일 예정`;
  }

  function renderHistory() {
    const tbody = $("historyTable");
    if (!tbody) return;
    const rows = (state.history || []).slice(0, 80).map((item, index) => {
      const key = item.id || `idx-${index}`;
      return `
        <tr class="history-row" data-history-key="${escapeHtml(key)}">
          <td>${escapeHtml(formatDateTime(item.at))}</td>
          <td>${escapeHtml(item.type || "기록")}</td>
          <td><button type="button" class="history-detail-trigger" data-history-key="${escapeHtml(key)}">${escapeHtml(item.memo || "상세내용")}</button></td>
          <td>${escapeHtml(item.qtyText || "")}</td>
        </tr>`;
    }).join("");
    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">아직 기록이 없습니다.</td></tr>`;
  }

  function renderBackups() {
    const list = $("backupList");
    if (!list) return;
    const backups = loadBackups().slice(0, 6);
    list.innerHTML = backups.map((backup) => `<li>${escapeHtml(formatDateTime(backup.at))} · ${escapeHtml(backup.reason || "저장")}</li>`).join("") || `<li>아직 백업이 없습니다.</li>`;
  }

  function bindWmsEvents() {
    $("inventorySearch")?.addEventListener("input", renderInventory);
    $("orderFile")?.addEventListener("change", (event) => {
      const fileName = event.target.files?.[0]?.name || "엑셀 파일 선택";
      setText("orderFileName", fileName);
    });
    $("inventoryTable")?.addEventListener("click", (event) => {
      const row = event.target.closest("[data-inventory-sku]");
      if (row) openInventoryItemDetail(row.dataset.inventorySku);
    });
    $("inventoryTable")?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const row = event.target.closest("[data-inventory-sku]");
      if (!row) return;
      event.preventDefault();
      openInventoryItemDetail(row.dataset.inventorySku);
    });
    $("savePallets")?.addEventListener("click", () => {
      if (!requireEditor("파렛 보유 현황 수정")) return;
      document.querySelectorAll("[data-pallet-key]").forEach((input) => {
        state.pallets[input.dataset.palletKey] = cleanNumber(input.value);
      });
      pushHistory("파렛", "파렛 보유 현황 수정", Object.entries(state.pallets).map(([k, v]) => `${k} ${v}`).join(" / "));
      saveState("파렛 보유 현황 저장");
    });

    $("saveBoxStock")?.addEventListener("click", () => {
      if (!requireEditor("박스 재고 수정")) return;
      const changed = [];
      document.querySelectorAll("#boxStockGrid .box-stock-item").forEach((item) => {
        const sku = item.dataset.boxSku;
        if (!sku || !INVENTORY_DEFS[sku]?.isBox) return;
        const before = state.stock[sku]?.units || 0;
        const next = unitsFromInput(sku, {
          pallets: item.querySelector('[data-box-field="pallets"]')?.value,
          boxes: item.querySelector('[data-box-field="boxes"]')?.value,
          eaches: item.querySelector('[data-box-field="eaches"]')?.value
        });
        if (before !== next) {
          state.stock[sku] = { ...(state.stock[sku] || {}), units: next };
          changed.push(`${sku} ${formatStock(sku, before)} → ${formatStock(sku, next)}`);
        }
      });

      if (!changed.length) {
        renderBoxStockInputs(false);
        return;
      }

      pushHistory("박스수정", `${changed.length}개 박스 재고 직접 수정`, changed.join(" / "));
      saveState("박스 재고 직접 수정 저장");
    });
    $("quickInboundExample")?.addEventListener("click", () => {
      if (!requireEditor("입고 예시 입력")) return;
      fillInboundExample();
    });
    $("addStockMoveRow")?.addEventListener("click", () => {
      if (!requireEditor("입고 행 추가")) return;
      addStockMoveRow();
    });
    $("clearStockMoveRows")?.addEventListener("click", () => {
      if (!requireEditor("입고 입력 초기화")) return;
      clearStockMoveRows();
    });
    $("applyStockMove")?.addEventListener("click", () => {
      if (!requireEditor("입고 적용")) return;
      applyStockMove();
    });
    $("parseOrderFile")?.addEventListener("click", parseOrderFile);
    $("applyOrderDeductions")?.addEventListener("click", () => {
      if (!requireEditor("엑셀 주문 차감 적용")) return;
      applyLastOrderDeductions();
    });
    $("historyTable")?.addEventListener("click", (event) => {
      const trigger = event.target.closest(".history-detail-trigger, .history-row");
      if (!trigger) return;
      openHistoryDetail(trigger.dataset.historyKey || trigger.closest(".history-row")?.dataset.historyKey);
    });
    $("closeHistoryDetail")?.addEventListener("click", closeHistoryDetail);
    $("historyDetailOverlay")?.addEventListener("click", (event) => {
      if (event.target.id === "historyDetailOverlay") closeHistoryDetail();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeHistoryDetail();
        closeCumulativeSales();
        closeInventoryItemDetail();
      }
    });
    $("exportBackup")?.addEventListener("click", () => {
      if (!requireEditor("백업 파일 받기")) return;
      exportBackup();
    });
    $("importBackup")?.addEventListener("change", (event) => {
      if (!requireEditor("백업 파일 불러오기")) {
        event.target.value = "";
        return;
      }
      importBackup(event);
    });
    $("restorePreviousWms")?.addEventListener("click", () => {
      if (!requireEditor("이전값 복구")) return;
      restorePreviousState();
    });
    $("resetWms")?.addEventListener("click", () => {
      if (!requireEditor("초기값 복구")) return;
      if (!confirm("WMS 재고를 초기값으로 복구할까요? 현재 브라우저 저장값은 백업 후 초기화됩니다.")) return;
      addBackup("초기화 전 백업");
      state = createInitialState();
      saveState("초기값 복구");
    });
    document.querySelectorAll(".chart-tab").forEach((tab) => tab.addEventListener("click", () => {
      orderChartMode = tab.dataset.chartMode || "daily";
      renderOrderChart();
    }));
    $("cumulativeSalesCard")?.addEventListener("click", openCumulativeSales);
    $("cumulativeSalesCard")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openCumulativeSales();
      }
    });
    $("closeCumulative")?.addEventListener("click", closeCumulativeSales);
    $("closeInventoryItem")?.addEventListener("click", closeInventoryItemDetail);
    $("inventoryItemOverlay")?.addEventListener("click", (event) => {
      if (event.target.id === "inventoryItemOverlay") closeInventoryItemDetail();
    });
    $("cumulativeOverlay")?.addEventListener("click", (event) => {
      if (event.target.id === "cumulativeOverlay") closeCumulativeSales();
    });
    window.addEventListener("resize", () => {
      clearTimeout(chartResizeTimer);
      chartResizeTimer = setTimeout(renderOrderChart, 140);
    });
    document.querySelectorAll(".subtab").forEach((tab) => tab.addEventListener("click", () => switchResultTab(tab.dataset.resultTab)));
  }

  function applyStockMove() {
    const memo = ($("moveMemo")?.value || "").trim();
    const rows = getStockMoveRows().filter((row) => row.sku && INVENTORY_DEFS[row.sku] && row.units > 0);

    if (!rows.length) {
      alert("입고할 수량을 한 줄 이상 넣어주세요.");
      return;
    }

    const bySku = new Map();
    rows.forEach((row) => bySku.set(row.sku, (bySku.get(row.sku) || 0) + row.units));

    [...bySku.entries()].forEach(([sku, units]) => {
      if (!state.stock[sku]) state.stock[sku] = { units: 0 };
      state.stock[sku].units = (Number(state.stock[sku].units) || 0) + units;
    });

    const detailItems = [...bySku.entries()].map(([sku, units]) => ({
      sku,
      units,
      direction: "in",
      text: formatMovementDetail(sku, units, "in")
    }));

    const totalUnits = detailItems.reduce((sum, item) => sum + item.units, 0);
    pushHistory("입고묶음", `${number(detailItems.length)}개 품목 일괄 입고${memo ? ` · ${memo}` : ""}`, `+${number(totalUnits)}개`, detailItems);
    clearStockMoveRows();
    saveState(`${number(detailItems.length)}개 품목 일괄 입고`);
  }

  function pushHistory(type, memo, qtyText, details = []) {
    state.history = state.history || [];
    const record = {
      id: createHistoryId(),
      at: new Date().toISOString(),
      type,
      memo,
      qtyText,
      details
    };
    state.history.unshift(record);
    state.history = state.history.slice(0, 500);
    queueSupabaseMovementSave(record);
  }

  function createHistoryId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function formatMovementDetail(sku, units, direction = "out") {
    const action = direction === "in" ? "입고" : "출고";
    return `${formatStock(sku, units)} ${action}`;
  }

  function fillInboundExample() {
    clearStockMoveRows();
    [
      ["에낙 치킨", 3],
      ["브이콘 50g", 6],
      ["명가 참깨", 2],
      ["라멘뽀식이", 3]
    ].forEach(([sku, pallets]) => addStockMoveRow({ sku, pallets, boxes: 0, eaches: 0 }));
    $("moveMemo").value = "14파렛 입고";
    updateMoveBatchSummary();
  }

  function findHistoryByKey(key) {
    const list = state.history || [];
    if (!key) return null;
    if (key.startsWith("idx-")) return list[Number(key.replace("idx-", ""))] || null;
    return list.find((item) => item.id === key) || null;
  }

  function stockPercentText(sku) {
    const units = state.stock[sku]?.units || 0;
    const safety = safetyStatus(sku, units);
    if (!safety?.threshold) return "안전재고 미설정";
    const percent = Math.round((units / safety.threshold) * 100);
    return `${percent}% · 기준 ${safety.thresholdText}`;
  }

  function openInventoryItemDetail(sku) {
    const def = INVENTORY_DEFS[sku];
    const item = state.stock[sku];
    if (!def || !item) return;
    const overlay = $("inventoryItemOverlay");
    const body = $("inventoryItemBody");
    if (!overlay || !body) return;

    const units = item.units || 0;
    const safety = safetyStatus(sku, state.stock[sku]?.units || 0);
    setText("inventoryItemTitle", sku);
    setText("inventoryItemMeta", `${def.group || "분류 없음"} · ${def.structure || "구조 정보 없음"}`);

    const rows = [
      ["현재 재고", formatStock(sku, units)],
      ["총 낱개 환산", `${number(units)}개`],
      ["안전재고", safety?.threshold ? safety.thresholdText : "미설정"],
      ["안전재고 상태", safety?.isLow ? `부족 · 현재 ${stockPercentText(sku)}` : `정상 · 현재 ${stockPercentText(sku)}`],
      ["낱개 원가", def.cost ? money(def.cost) : "원가 미입력"],
      ["재고 자산", def.cost ? money(units * def.cost) : "원가 미입력"]
    ];

    body.innerHTML = `
      <div class="inventory-detail-list">
        ${rows.map(([label, value]) => `<div class="inventory-detail-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
      ${def.isBox ? `<p class="detail-note">박스 재고는 파렛/묶음/장 기준으로 직접 수정할 수 있습니다.</p>` : `<p class="detail-note">이 품목의 입고는 입고 직접 입력에서 여러 줄로 한 번에 적용할 수 있습니다.</p>`}
    `;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeInventoryItemDetail() {
    const overlay = $("inventoryItemOverlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("open");
    overlay.hidden = true;
  }

  function openHistoryDetail(key) {
    const item = findHistoryByKey(key);
    if (!item) return;
    const overlay = $("historyDetailOverlay");
    if (!overlay) return;

    setText("historyDetailTitle", item.type || "상세내용");
    setText("historyDetailMeta", `${formatDateTime(item.at)} · ${item.memo || ""} · ${item.qtyText || ""}`);

    const body = $("historyDetailBody");
    const details = Array.isArray(item.details) ? item.details : [];
    body.innerHTML = details.length
      ? details.map((detail) => `
        <div class="detail-line">
          <strong>${escapeHtml(detail.sku || "품목")}</strong>
          <span>${escapeHtml(detail.text || formatMovementDetail(detail.sku, detail.units || 0, detail.direction || "out"))}</span>
        </div>`).join("")
      : `<div class="detail-empty">이전 버전에서 저장된 기록이라 품목별 상세 내역이 없습니다.</div>`;

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeHistoryDetail() {
    const overlay = $("historyDetailOverlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("open");
    overlay.hidden = true;
  }

  async function parseOrderFile() {
    const input = $("orderFile");
    const file = input?.files?.[0];
    if (!file) {
      alert("엑셀 파일을 먼저 선택해주세요.");
      return;
    }
    if (!window.XLSX) {
      setText("excelNotice", "엑셀 분석 라이브러리를 불러오지 못했습니다. 인터넷 연결 또는 CDN 차단 여부를 확인해주세요.");
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const analysis = analyzeOrderRows(rows);
      lastOrderAnalysis = analysis;
      localStorage.setItem(ORDER_CACHE_KEY, JSON.stringify(analysis));
      renderOrderAnalysis(analysis);
      $("applyOrderDeductions").disabled = analysis.deductions.length === 0 && analysis.boxUsages.length === 0;
    } catch (error) {
      console.error(error);
      setText("excelNotice", "엑셀 파일을 읽는 중 오류가 발생했습니다. .xlsx로 저장 후 다시 시도해주세요.");
    }
  }

  function analyzeOrderRows(rows) {
    const deductions = new Map();
    const boxUsages = new Map();
    const needs = [];
    const excluded = [];

    // 결제/주문금액 집계 기준:
    // 주소 + 판매금액이 완전히 같은 행은 같은 주문 결제금액으로 보고 1번만 더한다.
    // 주소가 같아도 판매금액이 다르면 서로 다른 주문으로 유지한다.
    // 재고 차감과 박스 차감은 기존처럼 모든 상품 행을 그대로 처리한다.
    const paymentGroups = new Map();

    let orderRows = 0;
    let amountRawSum = 0;
    let duplicatePaymentRowCount = 0;

    rows.forEach((row, index) => {
      const cols = detectColumns(row);
      const productName = String(cols.name || "").trim();
      if (!productName || isLikelyHeaderRow(cols)) return;

      orderRows += 1;
      const orderedQty = Math.max(1, cleanNumber(cols.qty) || 1);
      const unitsInName = extractUnitsFromName(productName);
      const lineUnits = Math.max(1, unitsInName || 1) * orderedQty;

      const rawAddress = String(cols.address || "").trim();
      const rawAmount = String(cols.amount ?? "").trim();
      const amount = cleanNumber(rawAmount);
      const extraShipping = cleanNumber(cols.extraShipping);

      amountRawSum += amount;

      const hasPaymentKey = rawAddress !== "" && rawAmount !== "";
      const paymentKey = hasPaymentKey ? `${rawAddress}||${amount}` : `row-${index}`;

      if (!paymentGroups.has(paymentKey)) {
        paymentGroups.set(paymentKey, {
          address: rawAddress,
          amount,
          extraShipping,
          rows: [index + 1]
        });
      } else {
        paymentGroups.get(paymentKey).rows.push(index + 1);
        duplicatePaymentRowCount += 1;
      }

      const match = matchOrderLine(productName, lineUnits);
      if (match.excluded) {
        excluded.push({ row: index + 1, productName, qty: lineUnits, reason: "재고 계산 제외 품목" });
        return;
      }
      if (match.needs?.length) {
        match.needs.forEach((reason) => needs.push({ row: index + 1, productName, qty: lineUnits, reason }));
        return;
      }
      if (!match.items?.length) {
        needs.push({ row: index + 1, productName, qty: lineUnits, reason: "상품명 매칭 실패" });
        return;
      }
      match.items.forEach(({ sku, units }) => {
        deductions.set(sku, (deductions.get(sku) || 0) + units);
        const boxResult = getBoxUsage(sku, units);
        if (boxResult.needCheck) {
          needs.push({ row: index + 1, productName, qty: units, reason: boxResult.needCheck });
        }
        if (boxResult.size && boxResult.size !== "none") {
          const boxSku = BOX_SKU_BY_SIZE[boxResult.size];
          boxUsages.set(boxSku, (boxUsages.get(boxSku) || 0) + 1);
        }
      });
    });

    const paymentRecords = [...paymentGroups.values()];
    const paymentUniqueSum = paymentRecords.reduce((sum, item) => sum + item.amount, 0);
    const extraShippingSum = paymentRecords.reduce((sum, item) => sum + item.extraShipping, 0);
    const deductionList = [...deductions.entries()].map(([sku, units]) => ({ sku, units }));
    const boxUsageList = [...boxUsages.entries()].map(([sku, units]) => ({ sku, units }));
    const assetDeductionValue = calcMovementAssetValue(deductionList);
    const boxAssetDeductionValue = calcMovementAssetValue(boxUsageList, { includeBoxes: true });

    return {
      at: new Date().toISOString(),
      orderRows,
      paymentGroupCount: paymentGroups.size,
      duplicatePaymentRowCount,
      amountRawSum,
      extraShippingSum,
      paymentUniqueSum,
      paymentUniqueWithExtraShipping: paymentUniqueSum + extraShippingSum,
      assetDeductionValue,
      boxAssetDeductionValue,
      deductions: deductionList,
      boxUsages: boxUsageList,
      needs,
      excluded
    };
  }

  function detectColumns(row) {
    if (Array.isArray(row)) {
      return {
        address: row[0] ?? "",
        name: row[1] ?? "",
        amount: row[2] ?? "",
        extraShipping: row[3] ?? "",
        qty: ""
      };
    }

    const keys = Object.keys(row || {});
    const find = (candidates) => {
      const found = keys.find((key) => candidates.some((candidate) => normalizeHeader(key).includes(candidate)));
      return found ? row[found] : "";
    };

    return {
      address: find(["주소", "배송지", "수취인주소", "배송주소", "address"]),
      name: find(["상품명", "상품", "제품명", "품명", "옵션", "주문상품", "goods", "product"]),
      amount: find(["판매금액", "결제금액", "주문금액", "총금액", "금액", "amount", "price"]),
      extraShipping: find(["추가배송비", "배송비", "추가운임", "shipping", "delivery"]),
      qty: find(["수량", "개수", "주문수량", "구매수량", "qty", "quantity"])
    };
  }

  function isLikelyHeaderRow(cols) {
    const address = normalizeHeader(cols.address);
    const name = normalizeHeader(cols.name);
    const amount = normalizeHeader(cols.amount);
    return (address.includes("주소") && name.includes("상품")) || name === "상품명" || amount === "판매금액";
  }

  function normalizeHeader(text) {
    return String(text || "").toLowerCase().replace(/[\s_()\[\]{}]/g, "");
  }

  function extractUnitsFromName(name) {
    const text = String(name || "");
    const patterns = [
      /(?:x|×|\*)\s*([0-9,]+)\s*개/i,
      /([0-9,]+)\s*개\s*(?:입|묶음|세트)?/i
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return cleanNumber(match[1]);
    }
    return 0;
  }

  function normalizedText(text) {
    return String(text || "").toLowerCase().replace(/\s+/g, "");
  }

  function matchOrderLine(name, units) {
    const text = normalizedText(name);
    const needs = [];
    if (/와플매트|와플싱글|컴피싱글/.test(text)) return { excluded: true };

    if (/네모스낵/.test(text) && /3종|혼합|세가지|3가지/.test(text)) {
      if (units % 3 !== 0) return { needs: ["네모스낵 3종 혼합 수량이 3으로 나누어떨어지지 않음"] };
      const each = units / 3;
      return { items: [
        { sku: "네모스낵 치킨맛", units: each },
        { sku: "네모스낵 불고기맛", units: each },
        { sku: "네모스낵 매콤한맛", units: each }
      ] };
    }
    if (/네모스낵/.test(text) && /치킨/.test(text) && /불고기/.test(text)) {
      if (units % 2 !== 0) return { needs: ["네모스낵 치킨+불고기 수량이 2로 나누어떨어지지 않음"] };
      const each = units / 2;
      return { items: [
        { sku: "네모스낵 치킨맛", units: each },
        { sku: "네모스낵 불고기맛", units: each }
      ] };
    }

    const rules = [
      [/foot|풋젤리/, "풋젤리"],
      [/sweetpotato\(50g\)|sweetpotato50g|스위트포테이토|촉촉한고구마/, "촉촉한 고구마"],
      [/촉촉한밤|^밤$|밤/, "촉촉한 밤"],
      [/무가당.*300g/, "찹쌀 누룽지 검정콩"],
      [/무가당\(288g\)|무가당288g/, "찹쌀 누룽지 무가당"],
      [/검정콩|검은콩/, "찹쌀 누룽지 검정콩"],
      [/찹쌀.*츄러스|누룽지.*츄러스|츄러스/, "찹쌀 누룽지 츄러스"],
      [/찹쌀.*무가당|누룽지.*무가당/, "찹쌀 누룽지 무가당"],
      [/찹쌀.*스위트|누룽지.*스위트|^찹쌀누룽지$|찹쌀누룽지/, "찹쌀 누룽지 스위트"],
      [/네모스낵.*치킨/, "네모스낵 치킨맛"],
      [/네모스낵.*불고기/, "네모스낵 불고기맛"],
      [/네모스낵.*매콤|네모스낵.*매운|네모스낵.*스파이시/, "네모스낵 매콤한맛"],
      [/에낙.*스파|애낙.*스파/, "에낙 스파이시"],
      [/에낙.*치킨|애낙.*치킨/, "에낙 치킨"],
      [/차카니/, "차카니"],
      [/보리건빵|건빵/, "보리건빵 30g"],
      [/황금고구마칩/, "황금 고구마칩"],
      [/허니눈꽃|눈꽃.*920|920g/, "허니눈꽃 쌀과자 920g"],
      [/꾀돌이/, "꾀돌이"],
      [/라멘뽀식이|라면뽀식이/, "라멘뽀식이"],
      [/바베큐맛스낵|바베큐스낵/, "바베큐맛스낵"],
      [/푸드킹.*양파|푸드킹.*160|푸드킹양파/, "푸드킹 양파 160g"],
      [/싱싱양파.*160|양파.*160/, "싱싱 양파 160g"],
      [/싱싱양파.*100|양파.*100/, "싱싱 양파 100g"],
      [/김메밀칩|메밀칩/, "김 메밀칩 160g"],
      [/브이콘.*100|v콘.*100|vicon.*100/, "브이콘 100g"],
      [/브이콘|v콘|vicon/, "브이콘 50g"],
      [/감자알칩/, "감자알칩"],
      [/명가.*참깨/, "명가 참깨"],
      [/명가.*흑당/, "명가 흑당"],
      [/코디|3겹|휴지/, "코디 3겹"]
    ];

    const found = rules.find(([pattern]) => pattern.test(text));
    if (!found) return { needs: ["등록되지 않은 상품명"] };
    return { items: [{ sku: found[1], units }] };
  }

  function getBoxUsage(sku, units) {
    const def = INVENTORY_DEFS[sku];
    if (!def || def.isBox || sku === "코디 3겹") return { size: "none" };
    const remainder = units % def.unitsPerBox;
    const qty = remainder === 0 ? 0 : remainder;
    if (qty === 0) return { size: "none" };

    const small = "small";
    const medium = "medium";
    const large = "large";

    if (sku === "풋젤리") return { size: qty <= 30 ? small : medium };
    if (sku === "차카니") return { size: "none" };
    if (sku === "보리건빵 30g") {
      if (qty >= 30 && qty <= 100) return { size: medium };
      if (qty < 30) return { size: small };
      return { size: "none", needCheck: "보리건빵 101~199개 박스 기준 확인 필요" };
    }
    if (sku === "황금 고구마칩") return { size: qty <= 5 ? small : medium };
    if (sku.startsWith("네모스낵")) return { size: qty <= 60 ? small : medium };
    if (sku === "허니눈꽃 쌀과자 920g") return { size: qty <= 3 ? medium : "none" };
    if (sku.startsWith("찹쌀 누룽지")) {
      if (qty <= 6) return { size: medium };
      if (qty <= 10) return { size: large };
      return { size: "none" };
    }
    if (sku === "에낙 치킨" || sku === "에낙 스파이시") {
      if (qty <= 60) return { size: medium };
      if (qty <= 150) return { size: large };
      return { size: "none" };
    }
    if (sku === "꾀돌이") return { size: qty <= 39 ? medium : "none" };
    if (sku === "라멘뽀식이" || sku === "바베큐맛스낵") return { size: qty <= 19 ? medium : "none" };
    if (sku === "촉촉한 고구마") return { size: qty <= 49 ? small : "none" };
    if (sku === "촉촉한 밤") return { size: qty <= 39 ? small : "none" };
    if (sku === "싱싱 양파 160g") return { size: qty <= 4 ? medium : large };
    if (sku === "싱싱 양파 100g" || sku === "김 메밀칩 160g" || sku === "푸드킹 양파 160g") return { size: qty <= 4 ? medium : large };
    if (sku === "브이콘 50g") return { size: qty <= 19 ? small : medium };
    if (sku === "브이콘 100g") return { size: qty <= 9 ? small : medium };
    if (sku === "감자알칩") return { size: qty <= 20 ? large : "none" };
    if (sku === "명가 참깨" || sku === "명가 흑당") {
      if (qty <= 4) return { size: medium };
      if (qty <= 9) return { size: large };
      return { size: "none" };
    }
    return { size: "none", needCheck: "박스 사용 기준 미등록" };
  }

  function renderOrderAnalysis(analysis) {
    $("orderResultCard").hidden = false;
    const duplicatePaymentText = analysis.duplicatePaymentRowCount ? `, 주문금액 중복 ${analysis.duplicatePaymentRowCount.toLocaleString("ko-KR")}행 제외` : "";
    setText("excelNotice", `분석 완료: ${analysis.orderRows.toLocaleString("ko-KR")}행 처리, 주소+판매금액 기준 ${analysis.paymentGroupCount.toLocaleString("ko-KR")}건${duplicatePaymentText}, 확인 필요 ${analysis.needs.length.toLocaleString("ko-KR")}건, 제외 ${analysis.excluded.length.toLocaleString("ko-KR")}건 · 문제 없으면 "분석 결과 차감 적용"을 눌러 재고에서 뺄 수 있습니다.`);
    const summary = $("excelSummary");
    if (summary) {
      const currentAsset = computeInventoryAssetValue({ includeBoxes: true }).asset;
      const assetDeductionValue = analysis.assetDeductionValue ?? calcMovementAssetValue(analysis.deductions || []);
      const boxAssetDeductionValue = analysis.boxAssetDeductionValue ?? calcMovementAssetValue(analysis.boxUsages || [], { includeBoxes: true });
      const afterAsset = currentAsset - assetDeductionValue - boxAssetDeductionValue;
      summary.innerHTML = `
        <div>주문 행 기준: <strong>${number(analysis.orderRows)}건</strong></div>
        <div>주소+판매금액 기준 주문: <strong>${number(analysis.paymentGroupCount)}건</strong></div>
        <div>중복 제외 주문금액: <strong>${money(analysis.paymentUniqueSum)}</strong></div>
        <div>중복 제외 추가배송비: <strong>${money(analysis.extraShippingSum || 0)}</strong></div>
        <div>중복 제외 주문금액+추가배송비: <strong>${money(analysis.paymentUniqueWithExtraShipping || analysis.paymentUniqueSum)}</strong></div>
        <div class="asset-loss">상품 재고자산 차감 예정: <strong>${money(assetDeductionValue)}</strong></div>
        <div class="asset-loss muted-small">박스 재고 차감액: <strong>${money(boxAssetDeductionValue)}</strong></div>
        <div class="asset-loss muted-small">차감 후 예상 재고자산: <strong>${money(afterAsset)}</strong></div>
      `;
    }
    $("deductTable").innerHTML = analysis.deductions.map(({ sku, units }) => `
      <tr><td>${escapeHtml(sku)}</td><td>${number(units)}</td><td>${escapeHtml(formatStock(sku, units))}</td></tr>
    `).join("") || `<tr><td colspan="3" class="muted">차감할 품목이 없습니다.</td></tr>`;
    $("boxUseTable").innerHTML = analysis.boxUsages.map(({ sku, units }) => `
      <tr><td>${escapeHtml(sku)}</td><td>${number(units)}장</td><td>${escapeHtml(formatStock(sku, units))}</td></tr>
    `).join("") || `<tr><td colspan="3" class="muted">사용할 박스가 없습니다.</td></tr>`;
    const needRows = [...analysis.needs, ...analysis.excluded].map((item) => `
      <tr><td>${item.row}</td><td>${escapeHtml(item.productName)}</td><td>${number(item.qty)}</td><td>${escapeHtml(item.reason)}</td></tr>
    `).join("");
    $("needsTable").innerHTML = needRows || `<tr><td colspan="4" class="muted">확인 필요 항목이 없습니다.</td></tr>`;
  }

  function switchResultTab(tab) {
    document.querySelectorAll(".subtab").forEach((button) => button.classList.toggle("active", button.dataset.resultTab === tab));
    document.querySelectorAll(".result-pane").forEach((pane) => pane.classList.remove("active"));
    $(`pane-${tab}`)?.classList.add("active");
  }

  function applyLastOrderDeductions() {
    const analysis = lastOrderAnalysis || (() => {
      try { return JSON.parse(localStorage.getItem(ORDER_CACHE_KEY) || "null"); } catch { return null; }
    })();
    if (!analysis) return;
    if (analysis.needs?.length && !confirm(`확인 필요 ${analysis.needs.length}건이 있습니다. 확인 필요 항목은 제외하고 차감할까요?`)) return;

    analysis.deductions.forEach(({ sku, units }) => {
      if (state.stock[sku]) state.stock[sku].units -= units;
    });
    analysis.boxUsages.forEach(({ sku, units }) => {
      if (state.stock[sku]) state.stock[sku].units -= units;
    });
    archiveOldOrderStats();
    const orderStatRecord = {
      at: new Date().toISOString(),
      orderRows: analysis.orderRows,
      paymentGroupCount: analysis.paymentGroupCount,
      paymentUniqueSum: analysis.paymentUniqueSum
    };
    state.orderStats.unshift(orderStatRecord);
    queueSupabaseOrderStatSave(orderStatRecord);
    state.orderStats = state.orderStats.slice(0, 2000);
    const detailItems = analysis.deductions.map(({ sku, units }) => ({
      sku,
      units,
      direction: "out",
      text: formatMovementDetail(sku, units, "out")
    }));
    pushHistory("주문처리", `엑셀 주문 ${analysis.orderRows}행 차감`, `결제그룹 ${analysis.paymentGroupCount}건 / ${money(analysis.paymentUniqueSum)}`, detailItems);
    saveState("엑셀 주문 차감 적용");
    $("applyOrderDeductions").disabled = true;
  }

  function exportBackup() {
    if (!requireEditor("백업 파일 받기")) return;
    const payload = { exportedAt: new Date().toISOString(), state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reborn-wms-backup-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event) {
    if (!requireEditor("백업 파일 불러오기")) {
      if (event?.target) event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = parsed.state || parsed;
      if (!imported.stock || !imported.pallets) throw new Error("invalid backup");
      addBackup("백업 불러오기 전 자동 백업");
      state = { ...createInitialState(), ...imported };
      saveState("백업 파일 불러오기");
      event.target.value = "";
    } catch {
      alert("백업 파일 형식이 올바르지 않습니다.");
    }
  }

  function formatDateTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  document.addEventListener("DOMContentLoaded", () => {
    initRouting();
    initMarginCalculator();
    initWms();
    initSupabaseSync();
    initAdminLoginReveal();
    initAdminAuth();
  });
})();
