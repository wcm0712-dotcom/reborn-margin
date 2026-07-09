(() => {
  "use strict";
  window.__REBORN_LOADED_SCRIPT_VERSION__ = "reborn-labor-cost-shared-sync-fix-02";

  const STORAGE_KEY = "reborn.wms.state.v4.safe";
  const BACKUP_KEY = "reborn.wms.backups.v3";
  const UNDO_KEY = "reborn.wms.undo.v1";
  const ORDER_CACHE_KEY = "reborn.wms.lastOrderAnalysis.v3";
  const PURCHASE_VIEW_MODE_KEY = "reborn.wms.ui.purchaseViewMode.v1";
  const LABOR_COST_STORAGE_KEY = "reborn.laborCost.calendar.v1";
  const PURCHASE_VIEW_MODES = ["expanded", "compact", "collapsed"];
  const APPLIED_ORDER_HISTORY_LIMIT = 200;
  const ADMIN_ACTION_LOG_DISPLAY_LIMIT = 80;
  const ADMIN_ACTION_LOG_STORAGE_LIMIT = 2000;
  const LABOR_COST_DEFAULTS = Object.freeze({
    workerCount: 4,
    dailyRate: 135000,
    overtimeWorkerCount: 4,
    overtimeHours: 0,
    overtimeRate: 15000,
    memo: ""
  });
  let purchaseViewMode = "expanded";

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

  const BOX_PRICES = { xlarge: 680, large: 480, medium: 380, small: 250 };
  const BOX_SKU_BY_SIZE = { xlarge: "박스 특대", large: "박스 대", medium: "박스 중", small: "박스 소" };
  const BOX_LABEL = { xlarge: "특대 박스", large: "대 박스", medium: "중 박스", small: "소 박스", none: "박스 없음" };
  const BOX_XL_SKU = "박스 특대";
  const COOKIE_CHOCO_SKU = "쿠키속 초코짱";
  const CODI_TISSUE_SKU = "코디 3겹";
  const RETURN_ADJUSTMENT_TYPES = {
    postShipCancel: { label: "출고 후 주문취소", restores: true },
    saleableReturn: { label: "판매 가능 반품", restores: true },
    defectiveReturn: { label: "불량 반품", restores: false },
    inspectionPendingReturn: { label: "검수 대기 반품", restores: false },
    overDeductRestore: { label: "오차감 복구", restores: true }
  };
  const STOCK_MOVE_SOURCES = {
    manualInbound: "manualInbound",
    manualOutbound: "manualOutbound"
  };
  const CANONICAL_UNSWEETENED_NURUNGJI_SKU = "찹쌀 누룽지 무가당";
  const LEGACY_BLACK_BEAN_NURUNGJI_SKU = "찹쌀 누룽지 검정콩";
  const SKU_ALIASES = {
    [LEGACY_BLACK_BEAN_NURUNGJI_SKU]: CANONICAL_UNSWEETENED_NURUNGJI_SKU,
    "찹쌀 누룽지 무가당 검정콩": CANONICAL_UNSWEETENED_NURUNGJI_SKU
  };

  function canonicalSku(sku) {
    const key = String(sku || "").trim();
    return SKU_ALIASES[key] || key;
  }

  function replaceLegacySkuText(value) {
    return String(value || "")
      .replaceAll("찹쌀 누룽지 무가당 검정콩", CANONICAL_UNSWEETENED_NURUNGJI_SKU)
      .replaceAll(LEGACY_BLACK_BEAN_NURUNGJI_SKU, CANONICAL_UNSWEETENED_NURUNGJI_SKU)
      .replaceAll("검정콩", "무가당")
      .replaceAll("검은콩", "무가당");
  }

  const MARGIN_PRODUCTS = [
    { name: "직접 입력", cost: 0 },
    { name: "찹쌀 누룽지 무가당", cost: 2200 },
    { name: "찹쌀 누룽지 츄러스", cost: 2300 },
    { name: "찹쌀 누룽지 스위트", cost: 2200 },
    { name: "브이콘 50g", cost: 412.5 },
    { name: "브이콘 100g", cost: 825 },
    { name: "명가 참깨", cost: 4200 },
    { name: "명가 흑당", cost: 4200 },
    { name: "에낙 치킨", cost: 163.8 },
    { name: "에낙 스파이시", cost: 163.8 },
    { name: "에낙 스모크", cost: 163.8 },
    { name: "싱싱 양파 160g", cost: 1650 },
    { name: "싱싱 양파 100g", cost: 1000 },
    { name: "김 메밀칩 160g", cost: 1650 },
    { name: "대파 메밀칩 160g", cost: 1625 },
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
    { name: "쿠키속 초코짱", cost: 195 },
    { name: "코디 3겹", cost: 8500 },
    { name: "박스 특대", cost: BOX_PRICES.xlarge },
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
    "찹쌀 누룽지 무가당": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2200, safetyStock: { pallets: 4 } },
    "찹쌀 누룽지 츄러스": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2300, safetyStock: { pallets: 1 } },
    "찹쌀 누룽지 스위트": { group: "찹쌀 누룽지", boxesPerPallet: 42, unitsPerBox: 14, structure: "1파렛=42완박스 / 1완박스=14개", cost: 2200, safetyStock: { pallets: 4 } },
    "에낙 치킨": { group: "에낙", boxesPerPallet: 70, unitsPerBox: 180, structure: "1파렛=70완박스 / 1완박스=6내부박스 / 1내부박스=30개", cost: 163.8, safetyStock: { pallets: 2 } },
    "에낙 스파이시": { group: "에낙", boxesPerPallet: 70, unitsPerBox: 180, structure: "1파렛=70완박스 / 1완박스=6내부박스 / 1내부박스=30개", cost: 163.8, safetyStock: { pallets: 2 } },
    "에낙 스모크": { group: "에낙", boxesPerPallet: 70, unitsPerBox: 180, structure: "1파렛=70완박스 / 1완박스=6내부박스 / 1내부박스=30개", cost: 163.8, safetyStock: { pallets: 2 } },
    "꾀돌이": { group: "과자", boxesPerPallet: 150, unitsPerBox: 40, structure: "1파렛=150완박스 / 1완박스=40개", cost: 275, safetyStock: { pallets: 2 } },
    "라멘뽀식이": { group: "과자", boxesPerPallet: 72, unitsPerBox: 20, structure: "1파렛=72완박스 / 1완박스=20개", cost: 510, safetyStock: { pallets: 1 } },
    "바베큐맛스낵": { group: "과자", boxesPerPallet: 72, unitsPerBox: 20, structure: "1파렛=72완박스 / 1완박스=20개", cost: 500, safetyStock: { pallets: 1 } },
    "촉촉한 고구마": { group: "고구마/밤", boxesPerPallet: 132, unitsPerBox: 50, structure: "1파렛=132완박스 / 1완박스=50개", cost: 770, safetyStock: { boxes: 80 } },
    "촉촉한 밤": { group: "고구마/밤", boxesPerPallet: 121, unitsPerBox: 40, structure: "1파렛=121완박스 / 1완박스=40개", cost: 1080, safetyStock: { boxes: 60 } },
    "싱싱 양파 160g": { group: "양파/칩", boxesPerPallet: 36, unitsPerBox: 8, structure: "1파렛=36완박스 / 1완박스=8개", cost: 1650, safetyStock: { pallets: 4 } },
    "싱싱 양파 100g": { group: "양파/칩", boxesPerPallet: 56, unitsPerBox: 10, structure: "1파렛=56완박스 / 1완박스=10개", cost: 1000, safetyStock: { pallets: 2 } },
    "김 메밀칩 160g": { group: "양파/칩", boxesPerPallet: 56, unitsPerBox: 8, structure: "1파렛=56완박스 / 1완박스=8개", cost: 1650 },
    "대파 메밀칩 160g": { group: "양파/칩", boxesPerPallet: 36, unitsPerBox: 8, structure: "1파렛=36완박스 / 1완박스=8개", cost: 1625 },
    "푸드킹 양파 160g": { group: "양파/칩", boxesPerPallet: 38, unitsPerBox: 10, structure: "1파렛=38완박스 / 1완박스=10개", cost: 1500, safetyStock: { pallets: 2 } },
    "브이콘 50g": { group: "브이콘", boxesPerPallet: 96, unitsPerBox: 40, structure: "1파렛=96완박스 / 1완박스=40개", cost: 412.5, safetyStock: { pallets: 4 } },
    "브이콘 100g": { group: "브이콘", boxesPerPallet: 104, unitsPerBox: 20, structure: "1파렛=104완박스 / 1완박스=20개", cost: 825, safetyStock: { pallets: 1 } },
    "감자알칩": { group: "과자", boxesPerPallet: 56, unitsPerBox: 40, structure: "1파렛=56완박스 / 1완박스=40개", cost: 282.5, safetyStock: { pallets: 3 } },
    "명가 참깨": { group: "명가", boxesPerPallet: 45, unitsPerBox: 16, structure: "1파렛=45완박스 / 1완박스=16개", cost: 4200, safetyStock: { pallets: 2 } },
    "명가 흑당": { group: "명가", boxesPerPallet: 45, unitsPerBox: 16, structure: "1파렛=45완박스 / 1완박스=16개", cost: 4200, safetyStock: { pallets: 2 } },
    "코디 3겹": { group: "휴지", boxesPerPallet: 48, unitsPerBox: 1, structure: "1파렛=48개 / 박스 사용 없음", cost: 8500, safetyStock: { pallets: 6 } },
    [COOKIE_CHOCO_SKU]: { group: "과자", boxesPerPallet: 12, unitsPerBox: 40, structure: "파렛 미정 / 1완박스=12박스 / 1박스=40개 / 1완박스=480개", cost: 195, safetyStock: 0, unitLabels: { pallet: "완박스", box: "박스", each: "개" }, palletUnknown: true },
    "박스 특대": { group: "포장박스", boxesPerPallet: 30, unitsPerBox: 20, structure: "1파렛=30묶음 / 1묶음=20장 / 1파렛=600장", cost: BOX_PRICES.xlarge, isBox: true, safetyStock: { units: 2400, pallets: 4 } },
    "박스 대": { group: "포장박스", boxesPerPallet: 48, unitsPerBox: 15, structure: "1파렛=48묶음 / 1묶음=15장", cost: BOX_PRICES.large, isBox: true, safetyStock: { pallets: 3 } },
    "박스 중": { group: "포장박스", boxesPerPallet: 56, unitsPerBox: 20, structure: "1파렛=56묶음 / 1묶음=20장", cost: BOX_PRICES.medium, isBox: true, safetyStock: { pallets: 3 } },
    "박스 소": { group: "포장박스", boxesPerPallet: 90, unitsPerBox: 20, structure: "1파렛=90묶음 / 1묶음=20장", cost: BOX_PRICES.small, isBox: true, safetyStock: { pallets: 2 } }
  };

  const INITIAL_STOCK_INPUT = {
    "찹쌀 누룽지 스위트": { pallets: 11, boxes: 29, eaches: 0, original: "11파렛 29박스" },
    "찹쌀 누룽지 무가당": { units: 7792, original: "무가당 통합 재고" },
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
    "박스 특대": { pallets: 0, boxes: 0, eaches: 0, original: "0" },
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
    sku = canonicalSku(sku);
    const def = INVENTORY_DEFS[sku];
    if (!def) return 0;
    if (input && Object.prototype.hasOwnProperty.call(input, "units")) {
      return cleanNumber(input.units);
    }
    const pallets = cleanNumber(input?.pallets);
    const boxes = cleanNumber(input?.boxes);
    const eaches = cleanNumber(input?.eaches);
    return (pallets * def.boxesPerPallet * def.unitsPerBox) + (boxes * def.unitsPerBox) + eaches;
  }

  function normalizeUnits(sku, totalUnits) {
    sku = canonicalSku(sku);
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

  function getUnitLabels(sku) {
    const def = INVENTORY_DEFS[canonicalSku(sku)] || {};
    const labels = def.unitLabels || {};
    return {
      pallet: labels.pallet || "파렛",
      box: labels.box || (def.isBox ? "묶음" : canonicalSku(sku) === CODI_TISSUE_SKU ? "개" : "완박스"),
      each: labels.each || (def.isBox ? "장" : canonicalSku(sku) === CODI_TISSUE_SKU ? "개" : "낱개"),
    };
  }

  function formatStock(sku, units) {
    sku = canonicalSku(sku);
    const n = normalizeUnits(sku, units);
    const labels = getUnitLabels(sku);
    const parts = [];
    if (n.pallets) parts.push(`${n.pallets.toLocaleString("ko-KR")}${labels.pallet}`);
    if (n.boxes) parts.push(`${n.boxes.toLocaleString("ko-KR")}${labels.box}`);
    if (n.eaches) parts.push(`${n.eaches.toLocaleString("ko-KR")}${labels.each}`);
    return parts.length ? parts.join(" ") : "0";
  }
  function safetyUnits(sku) {
    sku = canonicalSku(sku);
    const def = INVENTORY_DEFS[sku];
    if (!def?.safetyStock) return 0;
    return unitsFromInput(sku, def.safetyStock);
  }

  function safetyStatus(sku, units) {
    sku = canonicalSku(sku);
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


  function defaultSkuCost(sku) {
    sku = canonicalSku(sku);
    const def = INVENTORY_DEFS[sku];
    const value = Number(def?.cost);
    return Number.isFinite(value) ? value : 0;
  }

  function isCodiTissueSku(sku) {
    return canonicalSku(sku) === CODI_TISSUE_SKU;
  }

  function codiTissueBoxXlUnits(sku, units) {
    if (!isCodiTissueSku(sku)) return 0;
    return Math.max(0, cleanNumber(units));
  }

  function isCookieChocoSku(sku) {
    return canonicalSku(sku) === COOKIE_CHOCO_SKU;
  }

  function getCookieChocoPackagingBoxSize(units) {
    const qty = cleanNumber(units);
    if (qty <= 0) return "none";
    const remainder = qty % 480;
    if (remainder >= 1 && remainder <= 80) return "small";
    if (remainder >= 81 && remainder <= 240) return "medium";
    if (remainder >= 241 && remainder <= 440) return "large";
    return "none";
  }

  function getCookieChocoPackagingBoxUsage(sku, units) {
    if (!isCookieChocoSku(sku)) return null;
    const size = getCookieChocoPackagingBoxSize(units);
    return size === "none" ? null : { size, units: 1 };
  }

  function normalizeProductCosts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const canonicalSource = { ...source };
    Object.entries(source).forEach(([key, value]) => {
      const canonical = canonicalSku(key);
      if (canonical !== key && !Object.prototype.hasOwnProperty.call(canonicalSource, canonical)) {
        canonicalSource[canonical] = value;
      }
    });
    const costs = {};
    Object.keys(INVENTORY_DEFS).forEach((sku) => {
      const hasSaved = Object.prototype.hasOwnProperty.call(canonicalSource, sku);
      const saved = cleanNumber(canonicalSource[sku]);
      costs[sku] = hasSaved && saved >= 0 ? saved : defaultSkuCost(sku);
    });
    return costs;
  }

  function getSkuCost(sku) {
    sku = canonicalSku(sku);
    const costs = state?.productCosts;
    if (costs && Object.prototype.hasOwnProperty.call(costs, sku)) {
      const value = cleanNumber(costs[sku]);
      return value >= 0 ? value : defaultSkuCost(sku);
    }
    return defaultSkuCost(sku);
  }

  function getMarginProductCost(product) {
    if (!product) return 0;
    const sku = canonicalSku(product.name);
    if (INVENTORY_DEFS[sku]) return getSkuCost(sku);
    return cleanNumber(product.cost);
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
      productCosts: normalizeProductCosts(),
      pallets: { ...INITIAL_PALLETS },
      history: [],
      orderStatus: [],
      purchaseCompletedRecords: [],
      purchaseCompletedHiddenIds: [],
      returnAdjustments: [],
      appliedOrderFiles: [],
      adminActionLogs: [],
      orderStats: [],
      orderYearArchives: {},
      laborCostRecords: {},
      laborCostSyncMeta: {},
      updatedAt: new Date().toISOString()
    };
  }

  let localStateLoadFailed = false;
  let state = loadState();
  let lastOrderAnalysis = null;
  let stockMoveRowSeq = 0;
  let orderChartMode = "daily";
  let chartResizeTimer = null;
  let activeInventoryDetailSku = null;
  let purchaseCompleteDraftKey = "";
  let laborCostRecords = loadLaborCostRecords();
  let laborCalendarMonth = getLaborMonthStart(new Date());
  let activeLaborCostDate = "";
  const DAILY_FLOW_PAGE_SIZE = 10;
  const HISTORY_PAGE_SIZE = 50;
  const expandedDailyFlowDates = new Set();
  let dailyFlowVisibleDateCount = DAILY_FLOW_PAGE_SIZE;
  let historyVisibleRecordCount = HISTORY_PAGE_SIZE;
  let dailyFlowPeriod = "month";
  let dailyFlowFilter = "all";

  function normalizeMovementDetails(details) {
    if (!Array.isArray(details)) return [];
    return details.map((detail) => {
      if (!detail || typeof detail !== "object") return detail;
      const sku = canonicalSku(detail.sku);
      return {
        ...detail,
        sku,
        text: replaceLegacySkuText(detail.text)
      };
    });
  }

  function normalizeHistoryRecord(record) {
    if (!record || typeof record !== "object") return record;
    return {
      ...record,
      memo: replaceLegacySkuText(record.memo),
      qtyText: replaceLegacySkuText(record.qtyText),
      details: normalizeMovementDetails(record.details)
    };
  }

  function normalizeOrderAnalysis(analysis) {
    if (!analysis || typeof analysis !== "object") return analysis;
    const mergeRows = (rows = []) => {
      const totals = new Map();
      const orderCounts = new Map();
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const sku = canonicalSku(row?.sku);
        if (!sku) return;
        totals.set(sku, (totals.get(sku) || 0) + cleanNumber(row.units));
        orderCounts.set(sku, (orderCounts.get(sku) || 0) + cleanNumber(row.orderCount));
      });
      return [...totals.entries()].map(([sku, units]) => ({
        sku,
        units,
        orderCount: orderCounts.get(sku) || 0
      }));
    };
    const deductions = mergeRows(analysis.deductions);
    return {
      ...analysis,
      deductions,
      assetDeductionValue: calcMovementAssetValue(deductions),
      needs: Array.isArray(analysis.needs) ? analysis.needs.map((item) => ({ ...item, productName: replaceLegacySkuText(item.productName), reason: replaceLegacySkuText(item.reason) })) : [],
      excluded: Array.isArray(analysis.excluded) ? analysis.excluded.map((item) => ({ ...item, productName: replaceLegacySkuText(item.productName), reason: replaceLegacySkuText(item.reason) })) : []
    };
  }


  function normalizeAppliedOrderFile(record) {
    if (!record || typeof record !== "object") return null;
    const fileMeta = record.fileMeta && typeof record.fileMeta === "object" ? record.fileMeta : {};
    const signature = record.signature && typeof record.signature === "object" ? record.signature : {};
    return {
      id: String(record.id || createHistoryId()),
      at: record.at || record.appliedAt || new Date().toISOString(),
      fileName: String(record.fileName || fileMeta.name || ""),
      fileSize: cleanNumber(record.fileSize ?? fileMeta.size),
      orderRows: cleanNumber(record.orderRows),
      paymentGroupCount: cleanNumber(record.paymentGroupCount),
      paymentUniqueSum: cleanNumber(record.paymentUniqueSum),
      paymentUniqueWithExtraShipping: cleanNumber(record.paymentUniqueWithExtraShipping),
      majorSummary: Array.isArray(record.majorSummary) ? record.majorSummary.map(function(item) { return String(item || ""); }).filter(Boolean) : [],
      summaryHash: String(record.summaryHash || signature.summaryHash || ""),
      fingerprint: String(record.fingerprint || signature.fingerprint || ""),
      adminUid: String(record.adminUid || ""),
      adminEmail: String(record.adminEmail || ""),
      source: "excelOrderDeduction"
    };
  }

  function normalizeAdminActionLog(record) {
    if (!record || typeof record !== "object") return null;
    return {
      id: String(record.id || createHistoryId()),
      at: record.at || new Date().toISOString(),
      actionType: String(record.actionType || record.type || "작업"),
      itemName: replaceLegacySkuText(record.itemName || record.sku || ""),
      qty: cleanNumber(record.qty),
      unit: String(record.unit || ""),
      memo: replaceLegacySkuText(record.memo || ""),
      adminUid: String(record.adminUid || ""),
      adminEmail: String(record.adminEmail || ""),
      source: String(record.source || ""),
      details: Array.isArray(record.details) ? normalizeMovementDetails(record.details) : []
    };
  }

  function storedStockUnitsForSku(sku, incoming) {
    if (!incoming || typeof incoming !== "object") return 0;
    if (Object.prototype.hasOwnProperty.call(incoming, "units")) {
      return cleanNumber(incoming.units);
    }
    if (Object.prototype.hasOwnProperty.call(incoming, "pallets")
      || Object.prototype.hasOwnProperty.call(incoming, "boxes")
      || Object.prototype.hasOwnProperty.call(incoming, "eaches")) {
      return unitsFromInput(sku, incoming);
    }
    return 0;
  }


  function isValidPurchaseStableId(value) {
    const text = String(value || "").trim();
    return /^pg_[a-z0-9]+$/i.test(text);
  }

  function normalizePurchaseCompletedHiddenIds(input) {
    const values = Array.isArray(input) ? input : [];
    const seen = new Set();
    values.forEach((value) => {
      const id = String(value || "").trim();
      if (isValidPurchaseStableId(id)) seen.add(id);
    });
    return Array.from(seen);
  }

  function normalizePurchaseCompletedDisplayItem(item) {
    if (typeof item === "string") {
      const name = replaceLegacySkuText(item).trim();
      return name ? { name, qtyText: "" } : null;
    }
    if (!item || typeof item !== "object") return null;
    const rawName = item.name || item.productName || item.productKey || item.sku || item.title || item.label || "";
    const name = replaceLegacySkuText(rawName).trim();
    if (!name) return null;
    const explicitQtyText = item.qtyText || item.quantityText || item.qtyLabel || item.quantityLabel || "";
    let qtyText = String(explicitQtyText || "").trim();
    if (!qtyText && (item.qty !== undefined || item.quantity !== undefined)) {
      const qty = cleanNumber(item.qty ?? item.quantity);
      const unit = String(item.unitLabel || item.unit || "").trim();
      if (qty) qtyText = unit ? `${formatPurchaseQtyValue(qty)}${unit}` : formatPurchaseQtyValue(qty);
    }
    return { name, qtyText };
  }

  function normalizePurchaseCompletedDisplayItems(input) {
    const values = Array.isArray(input) ? input : [];
    const seen = new Set();
    const result = [];
    values.forEach((item) => {
      const normalized = normalizePurchaseCompletedDisplayItem(item);
      if (!normalized) return;
      const key = `${normalized.name}__${normalized.qtyText}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
    return result;
  }

  function normalizePurchaseCompletedRecord(record) {
    if (!record || typeof record !== "object") return null;
    const paymentAmount = cleanNumber(record.paymentAmount ?? record.amount ?? record.depositAmount ?? 0);
    const inboundDate = normalizePurchaseDate(record.inboundDate || record.receivedDate || record.arrivalDate || "", record.createdAt || new Date());
    const paymentDate = normalizePurchaseDate(record.paymentDate || record.depositDate || "", record.createdAt || new Date());
    if (paymentAmount <= 0 || !inboundDate || !paymentDate) return null;
    const sourcePurchaseIds = Array.isArray(record.sourcePurchaseIds)
      ? normalizePurchaseCompletedHiddenIds(record.sourcePurchaseIds)
      : isValidPurchaseStableId(record.sourcePurchaseId)
        ? [String(record.sourcePurchaseId).trim()]
        : [];
    const purchaseItems = normalizePurchaseCompletedDisplayItems(record.purchaseItems);
    const productNames = normalizePurchaseCompletedDisplayItems(record.productNames)
      .map((item) => item.name)
      .filter(Boolean);
    const fallbackProductNames = purchaseItems.map((item) => item.name).filter(Boolean);
    return {
      id: String(record.id || `purchase-completed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      paymentAmount,
      inboundDate,
      paymentDate,
      createdAt: record.createdAt || new Date().toISOString(),
      sourcePurchaseIds,
      productNames: productNames.length ? productNames : fallbackProductNames,
      purchaseItems,
      createdByRole: String(record.createdByRole || "admin")
    };
  }

  function hasSharedLaborCostRecords(record) {
    return Boolean(record && typeof record === "object" && Object.prototype.hasOwnProperty.call(record, "laborCostRecords"));
  }

  function normalizeLaborCostRecords(records, referenceDate = new Date()) {
    return pruneLaborCostRecords(records, referenceDate).records;
  }

  function normalizeLaborCostSyncMeta(meta) {
    if (!meta || typeof meta !== "object") return {};
    const normalized = {};
    ["updatedAt", "migratedAt", "deletedAllAt", "source"].forEach((key) => {
      const value = String(meta[key] || "").trim();
      if (value) normalized[key] = value;
    });
    if (meta.recordCount !== undefined) {
      normalized.recordCount = normalizeLaborInteger(meta.recordCount, 0);
    }
    return normalized;
  }

  function hasLaborCostSyncMeta(meta) {
    return Object.keys(normalizeLaborCostSyncMeta(meta)).length > 0;
  }

  function markLaborCostSyncMeta(source, records, previousMeta = {}) {
    const now = new Date().toISOString();
    const recordCount = Object.keys(normalizeLaborCostRecords(records)).length;
    const meta = {
      ...normalizeLaborCostSyncMeta(previousMeta),
      updatedAt: now,
      source: source || "labor-cost-sync",
      recordCount
    };
    if (recordCount > 0 && !meta.migratedAt) {
      meta.migratedAt = now;
    }
    if (recordCount === 0) {
      meta.deletedAllAt = now;
    } else {
      delete meta.deletedAllAt;
    }
    return meta;
  }

  function getLaborCostShareStatus(record) {
    const records = hasSharedLaborCostRecords(record) ? normalizeLaborCostRecords(record.laborCostRecords) : {};
    const hasRecords = Object.keys(records).length > 0;
    const meta = normalizeLaborCostSyncMeta(record?.laborCostSyncMeta);
    return {
      hasField: hasSharedLaborCostRecords(record),
      hasRecords,
      hasMeta: hasLaborCostSyncMeta(meta),
      isAuthoritative: hasRecords || hasLaborCostSyncMeta(meta),
      records,
      meta
    };
  }

  function shouldUseRemoteLaborCostShare(remoteShare, localShare) {
    if (!remoteShare?.isAuthoritative) return false;
    if (!localShare?.isAuthoritative) return true;
    const remoteTime = toTimeValue(remoteShare.meta.updatedAt || remoteShare.meta.migratedAt || remoteShare.meta.deletedAllAt);
    const localTime = toTimeValue(localShare.meta.updatedAt || localShare.meta.migratedAt || localShare.meta.deletedAllAt);
    if (remoteTime || localTime) return remoteTime >= localTime;
    return remoteShare.hasRecords && !localShare.hasMeta;
  }

  function normalizeState(parsed) {
    const fresh = createInitialState();
    if (!parsed || typeof parsed !== "object") return fresh;

    const normalizedStock = { ...fresh.stock };
    const incomingStock = parsed.stock && typeof parsed.stock === "object" ? parsed.stock : {};
    Object.keys(INVENTORY_DEFS).forEach((sku) => {
      const incoming = incomingStock[sku];
      if (!incoming || typeof incoming !== "object") return;
      normalizedStock[sku] = {
        ...normalizedStock[sku],
        ...incoming,
        units: storedStockUnitsForSku(sku, incoming)
      };
    });
    const aliasTargetsReset = new Set();
    Object.entries(incomingStock).forEach(([rawSku, incoming]) => {
      const sku = canonicalSku(rawSku);
      if (sku === rawSku || !INVENTORY_DEFS[sku] || !incoming || typeof incoming !== "object") return;
      if (!Object.prototype.hasOwnProperty.call(incomingStock, sku) && !aliasTargetsReset.has(sku)) {
        normalizedStock[sku] = { ...normalizedStock[sku], units: 0, original: "통합" };
        aliasTargetsReset.add(sku);
      }
      normalizedStock[sku] = {
        ...normalizedStock[sku],
        units: cleanNumber(normalizedStock[sku]?.units) + cleanNumber(incoming.units),
        original: replaceLegacySkuText(normalizedStock[sku]?.original || incoming.original || "통합")
      };
    });

    const normalizedPallets = { ...fresh.pallets };
    Object.keys({ ...fresh.pallets, ...(parsed.pallets || {}) }).forEach((key) => {
      normalizedPallets[key] = Number(parsed.pallets?.[key] ?? fresh.pallets[key] ?? 0) || 0;
    });

    const completedRecords = Array.isArray(parsed.purchaseCompletedRecords)
      ? parsed.purchaseCompletedRecords.map(normalizePurchaseCompletedRecord).filter(Boolean)
      : [];
    const completedRecordSourceIds = completedRecords.flatMap((record) => record.sourcePurchaseIds || []);
    const purchaseCompletedHiddenIds = normalizePurchaseCompletedHiddenIds([
      ...(Array.isArray(parsed.purchaseCompletedHiddenIds) ? parsed.purchaseCompletedHiddenIds : []),
      ...completedRecordSourceIds
    ]);
    const laborShare = getLaborCostShareStatus(parsed);
    const laborCostRecords = laborShare.hasField ? laborShare.records : fresh.laborCostRecords;

    return {
      ...fresh,
      ...parsed,
      stock: normalizedStock,
      productCosts: normalizeProductCosts(parsed.productCosts),
      pallets: normalizedPallets,
      history: Array.isArray(parsed.history) ? parsed.history.map(normalizeHistoryRecord) : [],
      orderStatus: Array.isArray(parsed.orderStatus) ? parsed.orderStatus.map(normalizePurchaseItem).filter(Boolean) : [],
      purchaseCompletedRecords: completedRecords,
      purchaseCompletedHiddenIds,
      returnAdjustments: Array.isArray(parsed.returnAdjustments) ? parsed.returnAdjustments.map(normalizeReturnAdjustment).filter(Boolean) : [],
      appliedOrderFiles: Array.isArray(parsed.appliedOrderFiles) ? parsed.appliedOrderFiles.map(normalizeAppliedOrderFile).filter(Boolean).slice(0, APPLIED_ORDER_HISTORY_LIMIT) : [],
      adminActionLogs: Array.isArray(parsed.adminActionLogs) ? parsed.adminActionLogs.map(normalizeAdminActionLog).filter(Boolean).slice(0, ADMIN_ACTION_LOG_STORAGE_LIMIT) : [],
      orderStats: Array.isArray(parsed.orderStats) ? parsed.orderStats : [],
      orderYearArchives: parsed.orderYearArchives && typeof parsed.orderYearArchives === "object" ? parsed.orderYearArchives : {},
      laborCostRecords,
      laborCostSyncMeta: laborShare.meta
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const initialState = createInitialState();
        const legacyRecords = loadLegacyLaborCostRecords();
        if (Object.keys(legacyRecords).length) {
          initialState.laborCostRecords = legacyRecords;
          initialState.laborCostSyncMeta = markLaborCostSyncMeta("legacy-local", legacyRecords, initialState.laborCostSyncMeta);
        }
        return initialState;
      }
      localStateLoadFailed = false;
      const parsed = JSON.parse(raw);
      const normalized = normalizeState(parsed);
      if (!getLaborCostShareStatus(parsed).isAuthoritative) {
        const legacyRecords = loadLegacyLaborCostRecords();
        if (Object.keys(legacyRecords).length) {
          normalized.laborCostRecords = legacyRecords;
          normalized.laborCostSyncMeta = markLaborCostSyncMeta("legacy-local", legacyRecords, normalized.laborCostSyncMeta);
        }
      }
      return normalized;
    } catch (error) {
      localStateLoadFailed = true;
      console.warn("[Reborn storage] saved state load failed; using temporary initial state without deleting saved data.", error);
      return createInitialState();
    }
  }

  function setLocalStorageItem(key, value, context = "") {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("[Reborn storage] localStorage write failed; data was not cleared.", {
        key,
        context,
        message: error?.message || String(error)
      });
      return false;
    }
  }

  function saveState(reason = "저장", options = {}) {
    const { trackUndo = true, cloud = true } = options;
    if (trackUndo) pushUndoSnapshot(reason);
    state.updatedAt = new Date().toISOString();
    state.laborCostRecords = normalizeLaborCostRecords(state.laborCostRecords || laborCostRecords || {});
    state.laborCostSyncMeta = normalizeLaborCostSyncMeta(state.laborCostSyncMeta);
    if (localStateLoadFailed) {
      console.warn("[Reborn storage] state save skipped because saved state failed to load. Existing browser data was preserved.");
    } else {
      setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), reason || "saveState");
      addBackup(reason, { cloud });
    }
    renderAll();
    refreshInventoryItemOrderTrendIfOpen();
    if (cloud && !localStateLoadFailed) queueSupabaseAppStateSave(reason);
  }

  function addBackup(reason, options = {}) {
    const { cloud = true } = options;
    const backup = { at: new Date().toISOString(), reason, state: safeClone(state) };
    const backups = loadBackups();
    backups.unshift(backup);
    setLocalStorageItem(BACKUP_KEY, JSON.stringify(backups.slice(0, 30)), reason || "addBackup");
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

  function getLaborMonthStart(date) {
    const safeDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(safeDate.getTime())) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);
  }

  function addLaborMonths(date, diff) {
    const base = getLaborMonthStart(date);
    return new Date(base.getFullYear(), base.getMonth() + diff, 1);
  }

  function getLaborRetentionStart(referenceDate = new Date()) {
    const monthStart = getLaborMonthStart(referenceDate);
    return new Date(monthStart.getFullYear(), monthStart.getMonth() - 2, 1);
  }

  function getLaborMonthKey(date) {
    return dateKey(getLaborMonthStart(date));
  }

  function isBlankLaborValue(value) {
    return value === null || value === undefined || String(value).trim() === "";
  }

  function normalizeLaborInteger(value, fallback = 0) {
    if (isBlankLaborValue(value)) return fallback;
    return Math.max(0, Math.floor(cleanNumber(value)));
  }

  function normalizeLaborMoney(value, fallback = 0) {
    if (isBlankLaborValue(value)) return fallback;
    const numeric = cleanNumber(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
  }

  function normalizeLaborHours(value, fallback = 0) {
    if (isBlankLaborValue(value)) return fallback;
    const numeric = cleanNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return Math.round(numeric * 2) / 2;
  }

  function normalizeLaborCostRecord(record = {}) {
    const workerCount = normalizeLaborInteger(record.workerCount, LABOR_COST_DEFAULTS.workerCount);
    const dailyRate = normalizeLaborMoney(record.dailyRate, LABOR_COST_DEFAULTS.dailyRate);
    const overtimeWorkerCount = Math.min(
      workerCount,
      normalizeLaborInteger(record.overtimeWorkerCount, LABOR_COST_DEFAULTS.overtimeWorkerCount)
    );
    const overtimeHours = normalizeLaborHours(record.overtimeHours, LABOR_COST_DEFAULTS.overtimeHours);
    const overtimeRate = normalizeLaborMoney(record.overtimeRate, LABOR_COST_DEFAULTS.overtimeRate);
    return {
      workerCount,
      dailyRate,
      overtimeWorkerCount,
      overtimeHours,
      overtimeRate,
      memo: String(record.memo || "").trim().slice(0, 80)
    };
  }

  function getLaborWorkerSplit(record = {}) {
    const item = normalizeLaborCostRecord(record);
    return {
      overtimeWorkerCount: item.overtimeWorkerCount,
      regularWorkerCount: Math.max(0, item.workerCount - item.overtimeWorkerCount)
    };
  }

  function calculateLaborBasePay(record) {
    const item = normalizeLaborCostRecord(record);
    return item.workerCount * item.dailyRate;
  }

  function calculateLaborOvertimePay(record) {
    const item = normalizeLaborCostRecord(record);
    return item.overtimeWorkerCount * item.overtimeHours * item.overtimeRate;
  }

  function calculateLaborDailyTotal(record) {
    return calculateLaborBasePay(record) + calculateLaborOvertimePay(record);
  }

  function pruneLaborCostRecords(records, referenceDate = new Date()) {
    const source = records && typeof records === "object" ? records : {};
    const retentionStartKey = dateKey(getLaborRetentionStart(referenceDate));
    const pruned = {};
    let changed = false;
    Object.entries(source).forEach(([key, value]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < retentionStartKey) {
        changed = true;
        return;
      }
      pruned[key] = normalizeLaborCostRecord(value);
      if (JSON.stringify(pruned[key]) !== JSON.stringify(value)) changed = true;
    });
    return { records: pruned, changed };
  }

  function persistLocalLaborCostRecords(records, context = "laborCostRecords") {
    return setLocalStorageItem(LABOR_COST_STORAGE_KEY, JSON.stringify(normalizeLaborCostRecords(records)), context);
  }

  function loadLegacyLaborCostRecords() {
    try {
      const raw = localStorage.getItem(LABOR_COST_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const result = pruneLaborCostRecords(parsed);
      if (result.changed) {
        setLocalStorageItem(LABOR_COST_STORAGE_KEY, JSON.stringify(result.records), "loadLegacyLaborCostRecords prune");
      }
      return result.records;
    } catch (error) {
      console.warn("[Reborn labor cost] saved labor records could not be loaded. Existing data was not cleared.", error);
      return {};
    }
  }

  function loadLaborCostRecords() {
    const sharedRecords = normalizeLaborCostRecords(state?.laborCostRecords || {});
    if (getLaborCostShareStatus(state).isAuthoritative) {
      persistLocalLaborCostRecords(sharedRecords, "loadLaborCostRecords shared mirror");
      return sharedRecords;
    }
    const legacyRecords = loadLegacyLaborCostRecords();
    if (Object.keys(legacyRecords).length) {
      state.laborCostRecords = legacyRecords;
      state.laborCostSyncMeta = markLaborCostSyncMeta("legacy-local", legacyRecords, state.laborCostSyncMeta);
    }
    return legacyRecords;
  }

  function syncLaborCostRecordsFromState(context = "syncLaborCostRecordsFromState") {
    laborCostRecords = normalizeLaborCostRecords(state?.laborCostRecords || {});
    state.laborCostRecords = laborCostRecords;
    state.laborCostSyncMeta = normalizeLaborCostSyncMeta(state.laborCostSyncMeta);
    persistLocalLaborCostRecords(laborCostRecords, context);
    return laborCostRecords;
  }

  function applyLaborCostRecordsAfterStateReplace(sourceState, context = "state replace labor sync", fallbackRecords = laborCostRecords) {
    const share = getLaborCostShareStatus(sourceState);
    if (!share.isAuthoritative) {
      const fallback = normalizeLaborCostRecords(fallbackRecords || {});
      if (Object.keys(fallback).length) {
        state.laborCostRecords = fallback;
        state.laborCostSyncMeta = markLaborCostSyncMeta("legacy-local", fallback, state.laborCostSyncMeta);
      }
    } else {
      state.laborCostRecords = share.records;
      state.laborCostSyncMeta = share.meta;
    }
    return syncLaborCostRecordsFromState(context);
  }

  function saveLaborCostRecords() {
    try {
      const result = pruneLaborCostRecords(laborCostRecords);
      laborCostRecords = result.records;
      state.laborCostRecords = laborCostRecords;
      state.laborCostSyncMeta = markLaborCostSyncMeta("labor-cost-save", laborCostRecords, state.laborCostSyncMeta);
      persistLocalLaborCostRecords(laborCostRecords, "saveLaborCostRecords");
      saveState("용역비 기록 저장", { trackUndo: false });
      return true;
    } catch (error) {
      console.warn("[Reborn labor cost] save skipped; existing WMS data was not touched.", error);
      return false;
    }
  }

  function getLaborMonthSummary(monthDate) {
    const month = getLaborMonthStart(monthDate);
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-`;
    return Object.entries(laborCostRecords).reduce((summary, [key, record]) => {
      if (!key.startsWith(prefix)) return summary;
      const item = normalizeLaborCostRecord(record);
      const basePay = calculateLaborBasePay(item);
      const overtimePay = calculateLaborOvertimePay(item);
      summary.totalPay += basePay + overtimePay;
      summary.workerCount += item.workerCount;
      summary.overtimeHours += item.overtimeWorkerCount * item.overtimeHours;
      summary.overtimePay += overtimePay;
      summary.recordCount += 1;
      return summary;
    }, { totalPay: 0, workerCount: 0, overtimeHours: 0, overtimePay: 0, recordCount: 0 });
  }

  function formatLaborMonthLabel(date) {
    const month = getLaborMonthStart(date);
    return `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  }

  function formatLaborDateLabel(key) {
    const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return key || "-";
    return `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일`;
  }

  function formatLaborHours(value) {
    const hours = normalizeLaborHours(value);
    return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  }

  function renderLaborCostCalendar() {
    const grid = $("laborCalendarGrid");
    if (!grid) return;
    const month = getLaborMonthStart(laborCalendarMonth);
    const summary = getLaborMonthSummary(month);
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const firstWeekday = month.getDay();
    const today = todayKey();
    setText("laborMonthLabel", formatLaborMonthLabel(month));
    setText("laborMonthTotal", money(summary.totalPay));
    setText("laborMonthWorkers", `${number(summary.workerCount)}명`);
    setText("laborMonthOvertimeHours", `${formatLaborHours(summary.overtimeHours)}시간`);
    setText("laborMonthOvertimePay", money(summary.overtimePay));
    const prevButton = $("laborPrevMonth");
    if (prevButton) prevButton.disabled = getLaborMonthKey(addLaborMonths(month, -1)) < getLaborMonthKey(getLaborRetentionStart());

    const cells = [];
    for (let i = 0; i < firstWeekday; i += 1) {
      cells.push(`<div class="labor-day labor-day-placeholder" aria-hidden="true"></div>`);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
      const record = laborCostRecords[key] ? normalizeLaborCostRecord(laborCostRecords[key]) : null;
      const classes = ["labor-day"];
      if (key === today) classes.push("is-today");
      if (record) classes.push("has-record");
      else classes.push("is-empty");
      const detail = record
        ? `
          <span class="labor-day-meta">${number(record.workerCount)}명 · 잔업 ${formatLaborHours(record.overtimeHours)}h</span>
          <strong class="labor-day-total">${money(calculateLaborDailyTotal(record))}</strong>
          ${record.memo ? `<span class="labor-day-memo">${escapeHtml(record.memo)}</span>` : ""}`
        : `<span class="labor-day-empty">미기록</span>`;
      cells.push(`
        <button type="button" class="${classes.join(" ")}" data-labor-date="${escapeHtml(key)}" aria-label="${escapeHtml(formatLaborDateLabel(key))} 용역비 기록">
          <span class="labor-day-number">${day}</span>
          ${detail}
        </button>`);
    }
    grid.innerHTML = cells.join("");
  }

  function setLaborCostForm(record) {
    const item = normalizeLaborCostRecord(record);
    const fields = {
      laborWorkerCount: item.workerCount,
      laborDailyRate: item.dailyRate,
      laborOvertimeWorkerCount: item.overtimeWorkerCount,
      laborOvertimeHours: item.overtimeHours,
      laborOvertimeRate: item.overtimeRate,
      laborMemo: item.memo
    };
    Object.entries(fields).forEach(([id, value]) => {
      const input = $(id);
      if (input) input.value = value;
    });
    updateLaborCostPreview();
  }

  function readLaborCostFormRecord(options = {}) {
    const { notify = false } = options;
    const workerCount = normalizeLaborInteger($("laborWorkerCount")?.value, LABOR_COST_DEFAULTS.workerCount);
    let overtimeWorkerCount = normalizeLaborInteger($("laborOvertimeWorkerCount")?.value, LABOR_COST_DEFAULTS.overtimeWorkerCount);
    const overtimeInput = $("laborOvertimeWorkerCount");
    if (overtimeInput) {
      overtimeInput.max = String(workerCount);
      overtimeInput.setCustomValidity("");
    }
    if (overtimeWorkerCount > workerCount) {
      overtimeWorkerCount = workerCount;
      if (overtimeInput) {
        overtimeInput.setCustomValidity("잔업 인원은 출근 인원을 초과할 수 없습니다.");
        if (notify) {
          overtimeInput.value = String(overtimeWorkerCount);
          overtimeInput.setCustomValidity("");
        }
      }
      if (notify) alert("잔업 인원은 출근 인원을 초과할 수 없어 출근 인원 이하로 조정했습니다.");
    }
    return normalizeLaborCostRecord({
      workerCount,
      dailyRate: $("laborDailyRate")?.value ?? LABOR_COST_DEFAULTS.dailyRate,
      overtimeWorkerCount,
      overtimeHours: $("laborOvertimeHours")?.value ?? LABOR_COST_DEFAULTS.overtimeHours,
      overtimeRate: $("laborOvertimeRate")?.value ?? LABOR_COST_DEFAULTS.overtimeRate,
      memo: $("laborMemo")?.value || ""
    });
  }

  function updateLaborCostPreview() {
    const record = readLaborCostFormRecord();
    const split = getLaborWorkerSplit(record);
    setText("laborBasePayPreview", money(calculateLaborBasePay(record)));
    setText("laborOvertimePayPreview", money(calculateLaborOvertimePay(record)));
    setText("laborDailyTotalPreview", money(calculateLaborDailyTotal(record)));
    setText("laborWorkerSplitPreview", `잔업 ${number(split.overtimeWorkerCount)}명 / 일반 ${number(split.regularWorkerCount)}명`);
    setText("laborOvertimeWorkerHint", `잔업 ${number(split.overtimeWorkerCount)}명 / 일반 ${number(split.regularWorkerCount)}명`);
  }

  function openLaborCostEditor(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return;
    activeLaborCostDate = key;
    const overlay = $("laborCostOverlay");
    if (!overlay) return;
    setText("laborCostTitle", `${formatLaborDateLabel(key)} 용역비`);
    setText("laborCostMeta", laborCostRecords[key] ? "저장된 기록을 수정합니다." : "기본값으로 미리 계산되며, 저장 전까지는 기록되지 않습니다.");
    setLaborCostForm(laborCostRecords[key] || LABOR_COST_DEFAULTS);
    const deleteButton = $("deleteLaborCost");
    if (deleteButton) deleteButton.hidden = !laborCostRecords[key];
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
  }

  function closeLaborCostEditor() {
    const overlay = $("laborCostOverlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("open");
    overlay.hidden = true;
    activeLaborCostDate = "";
  }

  function saveActiveLaborCostRecord() {
    if (!activeLaborCostDate) return;
    if (activeLaborCostDate < dateKey(getLaborRetentionStart())) {
      alert("용역비 기록은 최근 3개월 범위만 저장합니다.");
      return;
    }
    const record = readLaborCostFormRecord({ notify: true });
    laborCostRecords[activeLaborCostDate] = record;
    saveLaborCostRecords();
    renderLaborCostCalendar();
    closeLaborCostEditor();
  }

  function deleteActiveLaborCostRecord() {
    if (!activeLaborCostDate || !laborCostRecords[activeLaborCostDate]) return;
    if (!confirm("이 날짜의 용역비 기록만 삭제할까요? WMS 데이터는 삭제되지 않습니다.")) return;
    delete laborCostRecords[activeLaborCostDate];
    saveLaborCostRecords();
    renderLaborCostCalendar();
    closeLaborCostEditor();
  }

  function setWmsMainView(view = "inventory") {
    const activeView = view === "labor" ? "labor" : "inventory";
    const showLabor = activeView === "labor";
    const inventoryCard = $("inventoryPanelCard");
    const laborCard = $("laborCostCard");
    if (inventoryCard) inventoryCard.hidden = showLabor;
    if (laborCard) laborCard.hidden = !showLabor;
    document.querySelectorAll("[data-wms-main-view]").forEach((button) => {
      const isActive = button.dataset.wmsMainView === activeView;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    if (showLabor) renderLaborCostCalendar();
  }

  function bindWmsMainViewTabs() {
    document.querySelectorAll("[data-wms-main-view]").forEach((button) => {
      button.addEventListener("click", () => setWmsMainView(button.dataset.wmsMainView || "inventory"));
    });
    setWmsMainView("inventory");
  }

  function bindLaborCostEvents() {
    $("laborPrevMonth")?.addEventListener("click", () => {
      const nextMonth = addLaborMonths(laborCalendarMonth, -1);
      if (getLaborMonthKey(nextMonth) < getLaborMonthKey(getLaborRetentionStart())) return;
      laborCalendarMonth = nextMonth;
      renderLaborCostCalendar();
    });
    $("laborNextMonth")?.addEventListener("click", () => {
      laborCalendarMonth = addLaborMonths(laborCalendarMonth, 1);
      renderLaborCostCalendar();
    });
    $("laborTodayMonth")?.addEventListener("click", () => {
      laborCalendarMonth = getLaborMonthStart(new Date());
      renderLaborCostCalendar();
    });
    $("laborCalendarGrid")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-labor-date]");
      if (!button) return;
      openLaborCostEditor(button.dataset.laborDate);
    });
    $("laborCostOverlay")?.addEventListener("click", (event) => {
      if (event.target.id === "laborCostOverlay") closeLaborCostEditor();
    });
    $("closeLaborCost")?.addEventListener("click", closeLaborCostEditor);
    $("cancelLaborCost")?.addEventListener("click", closeLaborCostEditor);
    $("saveLaborCost")?.addEventListener("click", saveActiveLaborCostRecord);
    $("deleteLaborCost")?.addEventListener("click", deleteActiveLaborCostRecord);
    $("laborCostOverlay")?.querySelector(".labor-cost-form")?.addEventListener("input", updateLaborCostPreview);
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
    setLocalStorageItem(UNDO_KEY, JSON.stringify((snapshots || []).slice(0, 50)), "saveUndoSnapshots");
  }

  function undoRecordKey(record) {
    if (!record || typeof record !== "object") return "";
    return String(record.id || [record.at, record.type, record.actionType, record.memo, record.qtyText, record.source].filter(Boolean).join("|"));
  }

  function isInventoryUndoHistoryRecord(record) {
    const source = String(record?.source || "");
    const text = `${record?.type || ""} ${record?.memo || ""} ${record?.qtyText || ""}`.toLowerCase();
    return source === STOCK_MOVE_SOURCES.manualInbound
      || source === STOCK_MOVE_SOURCES.manualOutbound
      || source === "excelOrderDeduction"
      || source === "returnAdjustment"
      || /입고|출고|주문처리|취소|반품/.test(text);
  }

  function isInventoryUndoAdminLog(log) {
    const source = String(log?.source || "");
    const text = `${log?.actionType || ""} ${log?.memo || ""}`.toLowerCase();
    return source === STOCK_MOVE_SOURCES.manualInbound
      || source === STOCK_MOVE_SOURCES.manualOutbound
      || source === "excelOrderDeduction"
      || source === "returnAdjustment"
      || /manual_adjust|재고 직접 수정|입고|출고|엑셀 주문|취소|반품/.test(text);
  }

  function findNewUndoRecord(currentRecords, previousRecords, predicate) {
    const previousKeys = new Set((previousRecords || []).map(undoRecordKey).filter(Boolean));
    return (currentRecords || []).find((record) => predicate(record) && !previousKeys.has(undoRecordKey(record))) || null;
  }

  function getUndoStockChanges(previousState, currentState) {
    const previousStock = previousState?.stock || {};
    const currentStock = currentState?.stock || {};
    const keys = new Set([...Object.keys(previousStock), ...Object.keys(currentStock)].map(canonicalSku).filter(Boolean));
    return [...keys].map((sku) => {
      const beforeUnits = storedStockUnitsForSku(sku, previousStock[sku]);
      const afterUnits = storedStockUnitsForSku(sku, currentStock[sku]);
      return { sku, beforeUnits, afterUnits, diffUnits: afterUnits - beforeUnits };
    }).filter((item) => item.diffUnits !== 0);
  }

  function isInventoryUndoReason(reason) {
    const text = String(reason || "");
    if (/복구|초기값|백업|불러오기|원가|가격|발주|파렛/.test(text)) return false;
    return /입고|출고|엑셀 주문 차감|취소\/반품|취소|반품|재고 직접 수정/.test(text);
  }

  function formatUndoStockChange(item) {
    const sign = item.diffUnits > 0 ? "+" : "-";
    const units = Math.abs(item.diffUnits);
    const qty = INVENTORY_DEFS[item.sku] ? formatStock(item.sku, units) : `${number(units)}개`;
    return `${item.sku} ${sign}${qty}`;
  }

  function summarizeOneStepUndoCandidate(candidate) {
    if (!candidate) return "되돌릴 최근 재고 변경 작업이 없습니다.";
    const record = candidate.historyRecord;
    const log = candidate.adminLog;
    const actionLine = record
      ? `${formatDateTime(record.at)} · ${record.type || "재고 작업"} · ${record.memo || ""} ${record.qtyText || ""}`.trim()
      : log
        ? `${formatDateTime(log.at)} · ${log.actionType || "재고 작업"} · ${log.itemName || ""} ${log.qty ? number(log.qty) + (log.unit || "") : ""}`.trim()
        : `${formatDateTime(candidate.snapshot.at)} · ${candidate.reasonText || "저장 직전 상태"}`;
    const changes = candidate.stockChanges.slice(0, 4).map(formatUndoStockChange).join(" / ");
    const more = candidate.stockChanges.length > 4 ? ` 외 ${number(candidate.stockChanges.length - 4)}개` : "";
    return `${actionLine}${changes ? ` · ${changes}${more}` : ""}`;
  }

  function getLatestInventoryUndoCandidate() {
    const snapshots = loadUndoSnapshots();
    const snapshot = snapshots[0];
    if (!snapshot?.state) return null;
    const previousState = normalizeState(snapshot.state);
    const currentState = normalizeState(state);
    const stockChanges = getUndoStockChanges(previousState, currentState);
    if (!stockChanges.length) return null;
    const historyRecord = findNewUndoRecord(currentState.history, previousState.history, isInventoryUndoHistoryRecord);
    const adminLog = findNewUndoRecord(currentState.adminActionLogs, previousState.adminActionLogs, isInventoryUndoAdminLog);
    const reasonText = String(snapshot.reason || "");
    if (!historyRecord && !adminLog && !isInventoryUndoReason(reasonText)) return null;
    return { snapshots, snapshot, previousState, stockChanges, historyRecord, adminLog, reasonText };
  }

  function renderOneStepUndoStatus() {
    const button = $("undoLatestInventoryChange");
    const status = $("oneStepUndoStatus");
    if (!button && !status) return;
    const candidate = getLatestInventoryUndoCandidate();
    if (button) button.disabled = !candidate;
    if (status) {
      status.textContent = candidate
        ? `되돌릴 대상: ${summarizeOneStepUndoCandidate(candidate)}`
        : "되돌릴 최근 재고 변경 작업이 없습니다. 정확한 직전 상태가 확인될 때만 활성화됩니다.";
    }
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

  function restoreLatestInventoryChange() {
    const candidate = getLatestInventoryUndoCandidate();
    if (!candidate) {
      alert("되돌릴 최근 작업이 없습니다. 정확한 직전 백업을 찾을 수 없어 되돌릴 수 없습니다.");
      renderOneStepUndoStatus();
      return;
    }
    const summary = summarizeOneStepUndoCandidate(candidate);
    if (!confirm(`가장 최근 재고 변경 작업 1건만 되돌립니다.\n\n${summary}\n\n계속할까요?`)) return;
    addBackup("최근 작업 1단계 되돌리기 전 백업");
    saveUndoSnapshots(candidate.snapshots.slice(1));
    state = normalizeState(candidate.previousState);
    applyLaborCostRecordsAfterStateReplace(candidate.previousState, "restoreLatestInventoryChange labor sync");
    state.updatedAt = new Date().toISOString();
    localStateLoadFailed = false;
    setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), "restoreLatestInventoryChange");
    addBackup("최근 작업 1단계 되돌리기");
    renderAll();
    refreshInventoryItemOrderTrendIfOpen();
    queueSupabaseAppStateSave("최근 작업 1단계 되돌리기");
    alert(`최근 작업 1단계를 되돌렸습니다.\n${summary}`);
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
    applyLaborCostRecordsAfterStateReplace(snapshot.state, "restorePreviousState labor sync");
    addAdminActionLog("데이터 복구/import", { itemName: "이전값 복구", memo: snapshot.reason || "저장 전 상태", source: "restorePreviousState" });
    state.updatedAt = new Date().toISOString();
    localStateLoadFailed = false;
    setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), "restorePreviousState");
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
  let lastFailedSupabaseReason = "";
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
    const visibleRevealButton = document.querySelector("#adminLoginRevealButton");
    if (visibleRevealButton) {
      visibleRevealButton.addEventListener("click", () => {
        revealAdminLogin();
      });
    }

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

  function showWmsStatus(message, ok = true) {
    if (message) setAdminAuthStatus(message, ok ? "ok" : "warn");
    if (ok) console.info(message);
    else console.warn(message);
  }


  function getAdminActorMeta() {
    const user = getAdminUser();
    return {
      adminUid: user && user.id ? user.id : "",
      adminEmail: user && (user.email || (user.user_metadata && user.user_metadata.email)) ? (user.email || user.user_metadata.email) : ""
    };
  }

  function addAdminActionLog(actionType, payload) {
    if (!isEditorSession()) return null;
    const actor = getAdminActorMeta();
    const log = normalizeAdminActionLog(Object.assign({
      id: createHistoryId(),
      at: new Date().toISOString(),
      actionType: actionType
    }, payload || {}, actor));
    if (!log) return null;
    state.adminActionLogs = Array.isArray(state.adminActionLogs) ? state.adminActionLogs : [];
    state.adminActionLogs.unshift(log);
    state.adminActionLogs = state.adminActionLogs.slice(0, ADMIN_ACTION_LOG_STORAGE_LIMIT);
    return log;
  }

  function renderAdminActionLogs() {
    const list = $("adminActionLogList");
    const summary = $("adminActionLogSummary");
    if (!list && !summary) return;
    const logs = Array.isArray(state.adminActionLogs) ? state.adminActionLogs.map(normalizeAdminActionLog).filter(Boolean) : [];
    state.adminActionLogs = logs.slice(0, ADMIN_ACTION_LOG_STORAGE_LIMIT);
    if (summary) {
      if (logs.length) {
        summary.innerHTML = '<span class="summary-pill primary">최근 ' + number(Math.min(logs.length, ADMIN_ACTION_LOG_DISPLAY_LIMIT)) + '건 표시</span><span class="summary-pill muted">전체 ' + number(logs.length) + '건</span>';
      } else {
        summary.textContent = "기록 없음";
      }
    }
    if (!list) return;
    const visible = logs.slice(0, ADMIN_ACTION_LOG_DISPLAY_LIMIT);
    list.innerHTML = visible.length ? visible.map(function(log) {
      const detailText = log.details && log.details.length ? " · 상세 " + number(log.details.length) + "건" : "";
      const itemText = log.itemName ? " · " + escapeHtml(log.itemName) : "";
      const qtyText = log.qty ? " · " + number(log.qty) + escapeHtml(log.unit || "") : "";
      const actor = log.adminEmail || log.adminUid || "관리자";
      const memoText = log.memo ? " · " + escapeHtml(log.memo) : "";
      return '<li class="admin-action-log-item">'
        + '<div class="admin-action-log-main"><strong>' + escapeHtml(log.actionType) + '</strong><span>' + formatDateTime(log.at) + ' · ' + escapeHtml(actor) + '</span></div>'
        + '<p>' + itemText + qtyText + detailText + memoText + '</p>'
        + '</li>';
    }).join("") : '<li class="admin-action-log-empty">아직 기록된 관리자 작업이 없습니다.</li>';
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
      "#syncNow", "#retrySupabaseSave", "#syncIntervalSelect",
      "#savePallets", "#saveBoxStock",
      "#exportBackup", "#restorePreviousWms", "#undoLatestInventoryChange", "#resetWms",
      "#orderFile", "#parseOrderFile", "#applyOrderDeductions",
      "#moveMemo", "#quickInboundExample", "#addStockMoveRow", "#clearStockMoveRows", "#applyStockMove",
      "#palletGrid input", "#boxStockGrid input",
      "#stockMoveRows input", "#stockMoveRows select", "#stockMoveRows button",
      "#purchaseAdminPanel input", "#purchaseAdminPanel select", "#purchaseAdminPanel button",
      "#returnAdjustmentAdminPanel input", "#returnAdjustmentAdminPanel select", "#returnAdjustmentAdminPanel button",
      "#productCostEditorCard input", "#productCostEditorCard button",
      "#purchaseList [data-purchase-action]"
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

    applyPurchaseViewMode();
  }


  function requireEditor(action = "수정") {
    if (isEditorSession()) return true;
    setAdminAuthStatus(`${action}은 관리자 로그인 후 가능합니다.`, "warn");
    alert(`${action}은 관리자 로그인 후 가능합니다.`);
    updateEditorLock();
    return false;
  }

  function refreshUiAfterAdminAuthChange() {
    renderAll();
    updateEditorLock();
  }


  let passwordRecoveryInitialized = false;
  let passwordRecoveryMode = false;

  function getPasswordRecoveryUrlState() {
    const hash = String(location.hash || "").replace(/^#/, "");
    const search = String(location.search || "").replace(/^\?/, "");
    const hashParams = new URLSearchParams(hash);
    const searchParams = new URLSearchParams(search);
    const error = hashParams.get("error") || searchParams.get("error") || "";
    const errorCode = hashParams.get("error_code") || searchParams.get("error_code") || "";
    const rawDescription = hashParams.get("error_description") || searchParams.get("error_description") || "";
    const errorDescription = rawDescription ? rawDescription.replace(/\+/g, " ") : "";
    const type = hashParams.get("type") || searchParams.get("type") || "";
    const hasSessionTokens = hashParams.has("access_token") || hashParams.has("refresh_token");
    const isRecovery = type === "recovery" || hasSessionTokens || Boolean(error) || Boolean(errorCode);
    return { isRecovery, type, hasSessionTokens, error, errorCode, errorDescription };
  }

  function setPasswordRecoveryStatus(message, tone = "muted") {
    const status = $("passwordRecoveryStatus");
    if (!status) return;
    status.textContent = message || "";
    status.classList.remove("is-success", "is-danger", "is-warn");
    if (tone === "success") status.classList.add("is-success");
    if (tone === "danger") status.classList.add("is-danger");
    if (tone === "warn") status.classList.add("is-warn");
  }

  function showPasswordRecoveryOverlay(message = "새 비밀번호를 입력해 주세요.", tone = "muted") {
    const overlay = $("passwordRecoveryOverlay");
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add("password-recovery-open");
    setPasswordRecoveryStatus(message, tone);
    window.setTimeout(() => $("recoveryPassword")?.focus(), 80);
  }

  function hidePasswordRecoveryOverlay() {
    const overlay = $("passwordRecoveryOverlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("password-recovery-open");
  }

  function clearPasswordRecoveryUrl() {
    const cleanPath = `${location.origin}${location.pathname}#home`;
    history.replaceState(null, "", cleanPath);
  }

  function koreanPasswordRecoveryError(urlState) {
    const code = urlState?.errorCode || "";
    const description = urlState?.errorDescription || "";
    if (code === "otp_expired" || /expired/i.test(description)) {
      return "비밀번호 재설정 링크가 만료되었습니다. Supabase에서 재설정 메일을 새로 보낸 뒤, 가장 최근 메일의 링크를 다시 눌러주세요.";
    }
    if (code || description) {
      return `비밀번호 재설정 링크를 확인할 수 없습니다. ${description || code}`;
    }
    return "비밀번호 재설정 세션을 확인할 수 없습니다. 재설정 메일을 새로 보낸 뒤 다시 시도해 주세요.";
  }

  async function initPasswordRecoveryFlow() {
    if (passwordRecoveryInitialized) return;
    passwordRecoveryInitialized = true;

    const client = getSupabaseClient();
    const overlay = $("passwordRecoveryOverlay");
    if (!client?.auth || !overlay) return;

    const closeRecovery = async ({ signOut = true, clearUrl = true } = {}) => {
      hidePasswordRecoveryOverlay();
      $("recoveryPassword") && ($("recoveryPassword").value = "");
      $("recoveryPasswordConfirm") && ($("recoveryPasswordConfirm").value = "");
      if (signOut && passwordRecoveryMode) {
        await client.auth.signOut();
        adminSession = null;
        adminLoginPanelOpen = false;
        refreshUiAfterAdminAuthChange();
      }
      passwordRecoveryMode = false;
      if (clearUrl) clearPasswordRecoveryUrl();
    };

    $("passwordRecoveryClose")?.addEventListener("click", () => closeRecovery());
    $("cancelPasswordRecovery")?.addEventListener("click", () => closeRecovery());

    $("submitPasswordRecovery")?.addEventListener("click", async () => {
      const submitButton = $("submitPasswordRecovery");
      const password = $("recoveryPassword")?.value || "";
      const confirm = $("recoveryPasswordConfirm")?.value || "";

      if (password.length < 8) {
        setPasswordRecoveryStatus("새 비밀번호는 최소 8자 이상으로 입력해 주세요.", "danger");
        return;
      }

      if (password !== confirm) {
        setPasswordRecoveryStatus("새 비밀번호와 확인값이 서로 다릅니다.", "danger");
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData?.session) {
        setPasswordRecoveryStatus("비밀번호 재설정 세션이 없습니다. 재설정 메일을 새로 보낸 뒤 다시 시도해 주세요.", "danger");
        return;
      }

      submitButton && (submitButton.disabled = true);
      setPasswordRecoveryStatus("비밀번호를 변경하는 중입니다...", "warn");

      const { error } = await client.auth.updateUser({ password });

      if (error) {
        setPasswordRecoveryStatus(`비밀번호 변경 실패: ${error.message}`, "danger");
        submitButton && (submitButton.disabled = false);
        return;
      }

      setPasswordRecoveryStatus("비밀번호가 변경되었습니다. 보안을 위해 로그아웃 처리됩니다. 새 비밀번호로 다시 로그인해 주세요.", "success");
      $("recoveryPassword") && ($("recoveryPassword").value = "");
      $("recoveryPasswordConfirm") && ($("recoveryPasswordConfirm").value = "");

      window.setTimeout(() => {
        submitButton && (submitButton.disabled = false);
        closeRecovery({ signOut: true, clearUrl: true });
        revealAdminLogin();
      }, 1300);
    });

    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryMode = true;
        adminSession = session || null;
        adminLoginPanelOpen = false;
        showPasswordRecoveryOverlay("새 비밀번호를 입력해 주세요.", "success");
      }
    });

    const urlState = getPasswordRecoveryUrlState();
    if (!urlState.isRecovery) return;

    if (urlState.error || urlState.errorCode) {
      passwordRecoveryMode = false;
      showPasswordRecoveryOverlay(koreanPasswordRecoveryError(urlState), "danger");
      return;
    }

    passwordRecoveryMode = true;
    showPasswordRecoveryOverlay("비밀번호 재설정 링크를 확인하는 중입니다...", "warn");

    window.setTimeout(async () => {
      const { data, error } = await client.auth.getSession();
      if (error) {
        setPasswordRecoveryStatus(`재설정 세션 확인 실패: ${error.message}`, "danger");
        return;
      }

      if (!data?.session) {
        setPasswordRecoveryStatus("재설정 세션을 찾지 못했습니다. 메일 링크가 만료되었을 수 있으니 새 재설정 메일을 보내 다시 시도해 주세요.", "danger");
        return;
      }

      adminSession = data.session;
      setPasswordRecoveryStatus("새 비밀번호를 입력해 주세요.", "success");
      $("recoveryPassword")?.focus();
    }, 350);
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
        refreshUiAfterAdminAuthChange();
        return;
      }

      adminSession = data?.session || null;

      if (!isAllowedAdminUser(adminSession?.user)) {
        await client.auth.signOut();
        adminSession = null;
        adminLoginPanelOpen = false;
        setAdminAuthStatus("로그인된 계정이 등록된 관리자 UID가 아닙니다. 수정 권한이 없습니다.", "danger");
        refreshUiAfterAdminAuthChange();
        return;
      }

      adminLoginPanelOpen = true;
      setAdminAuthStatus("관리자 수정 권한이 확인되었습니다.", "success");
      refreshUiAfterAdminAuthChange();
      syncFromSupabase({ forcePull: true, silent: true });
    });

    $("adminLogout")?.addEventListener("click", async () => {
      await client.auth.signOut();
      adminSession = null;
      adminLoginPanelOpen = false;
      setAdminAuthStatus("로그아웃되었습니다. 수정 기능은 숨겨집니다.", "muted");
      refreshUiAfterAdminAuthChange();
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

    refreshUiAfterAdminAuthChange();

    client.auth.onAuthStateChange(async (_event, session) => {
      if (session && !isAllowedAdminUser(session.user)) {
        adminSession = null;
        adminLoginPanelOpen = false;
        await client.auth.signOut();
        refreshUiAfterAdminAuthChange();
        return;
      }

      adminSession = session || null;
      adminLoginPanelOpen = isAllowedAdminUser(adminSession?.user);
      refreshUiAfterAdminAuthChange();
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
    const retryButton = $("retrySupabaseSave");
    if (dot) dot.className = "sync-dot " + (kind || "muted");
    if (label) label.textContent = text || "동기화 대기";
    if (desc) desc.textContent = detail || "";
    if (retryButton) retryButton.hidden = !(kind === "bad" && isEditorSession());
  }

  function setSyncBusy(isBusy) {
    supabaseBusy = isBusy;
    const button = $("syncNow");
    if (button) {
      button.disabled = isBusy;
      button.textContent = isBusy ? "동기화 중..." : "지금 동기화";
    }
    const retryButton = $("retrySupabaseSave");
    if (retryButton) retryButton.disabled = isBusy;
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

  function getRemoteLaborCostShareStatus(row) {
    const payload = row?.data;
    if (!payload || typeof payload !== "object") return getLaborCostShareStatus(null);
    const candidate = payload.state && typeof payload.state === "object" ? payload.state : payload;
    return getLaborCostShareStatus(candidate);
  }

  function buildAppStatePayload(reason) {
    const payload = safeClone(state);
    payload.laborCostRecords = normalizeLaborCostRecords(state.laborCostRecords || laborCostRecords || {});
    payload.laborCostSyncMeta = normalizeLaborCostSyncMeta(state.laborCostSyncMeta);
    return {
      ...payload,
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
      lastFailedSupabaseReason = "";
      setSyncStatus("ok", "최신 상태", "Supabase와 브라우저 저장값이 동기화되었습니다.");
      return true;
    } catch (error) {
      console.warn("Supabase app_state 저장 실패", error);
      lastFailedSupabaseReason = reason || "저장 재시도";
      setSyncStatus("bad", "DB 저장 실패", "Supabase 저장에 실패했습니다. localStorage에는 현재 화면 상태가 보존되어 있으며, 관리자 화면에서 다시 저장을 시도할 수 있습니다.");
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
      const remoteLaborCostShare = getRemoteLaborCostShareStatus(data);
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
        applyLaborCostRecordsAfterStateReplace(remoteLaborCostShare.isAuthoritative ? remoteState : null, "syncFromSupabase labor sync");
        localStateLoadFailed = false;
        setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), "syncFromSupabase");
        renderAll();
        setSyncTimes({ lastAt: new Date().toISOString(), remoteAt: remoteAt || state.updatedAt });
        setSyncStatus("ok", "최신 상태", "Supabase의 최신 재고를 불러와 화면에 반영했습니다.");
        if (!remoteLaborCostShare.isAuthoritative && Object.keys(laborCostRecords).length && isEditorSession()) {
          setSyncBusy(false);
          await saveSupabaseAppState("용역비 기록 공유 동기화");
          return;
        }
      } else {
        setSyncTimes({ lastAt: new Date().toISOString(), remoteAt: remoteAt || localAt });
        setSyncStatus("ok", "최신 상태", "현재 브라우저 재고가 DB와 같거나 더 최신입니다.");
        if (shouldUseRemoteLaborCostShare(remoteLaborCostShare, getLaborCostShareStatus(state))) {
          state.laborCostRecords = remoteLaborCostShare.records;
          state.laborCostSyncMeta = remoteLaborCostShare.meta;
          syncLaborCostRecordsFromState("syncFromSupabase remote labor preserve");
          setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), "syncFromSupabase remote labor preserve");
        }
        if (!remoteLaborCostShare.isAuthoritative && Object.keys(laborCostRecords).length && isEditorSession()) {
          setSyncBusy(false);
          await saveSupabaseAppState("용역비 기록 공유 동기화");
          return;
        }
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
    setLocalStorageItem(SYNC_INTERVAL_KEY, String(interval), "setAutoSyncInterval");
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
    $("retrySupabaseSave")?.addEventListener("click", () => saveSupabaseAppState(lastFailedSupabaseReason || "저장 재시도"));

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

  function getFileExtension(fileName = "") {
    const cleanName = String(fileName || "").trim().toLowerCase();
    const match = cleanName.match(/\.([a-z0-9]+)$/);
    return match ? match[1] : "";
  }

  function setExcelFormatWarning(file) {
    const warning = $("excelFormatWarning");
    if (!warning) return;

    const ext = getFileExtension(file?.name);
    const isLegacyXls = ext === "xls";
    const isUnsupported = Boolean(ext) && !["xlsx", "xls", "csv"].includes(ext);

    const shouldShow = isLegacyXls || isUnsupported;
    warning.hidden = !shouldShow;
    warning.classList.toggle("hidden", !shouldShow);
    warning.classList.toggle("is-danger", isUnsupported);

    if (isUnsupported) {
      warning.textContent = "지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일만 업로드해 주세요.";
      return;
    }

    warning.textContent = ".xls는 오래된 엑셀 형식이라 일부 인식 오류가 발생할 수 있습니다. 가능하면 .xlsx로 변환 후 업로드해 주세요. 분석은 계속 시도할 수 있습니다.";
  }


  function isSupabaseAuthRedirectHash(hash = location.hash) {
    const raw = String(hash || "");
    return raw.includes("access_token=")
      || raw.includes("refresh_token=")
      || raw.includes("type=recovery")
      || raw.includes("error_code=")
      || raw.includes("error_description=");
  }

  function isSupabaseAuthRedirectSearch(search = location.search) {
    const raw = String(search || "");
    return raw.includes("type=recovery")
      || raw.includes("error_code=")
      || raw.includes("error_description=");
  }

  function initRouting() {
    const routes = ["home", "margin", "wms", "excel-count"];
    const buttons = [...document.querySelectorAll("[data-route]")];
    const routeTo = (route) => {
      const safeRoute = routes.includes(route) ? route : "home";
      document.querySelectorAll(".page").forEach((page) => page.classList.remove("active"));
      $(`page-${safeRoute}`)?.classList.add("active");
      document.querySelectorAll(".category-btn").forEach((button) => button.classList.toggle("active", button.dataset.route === safeRoute));
      document.body.classList.toggle("route-home", safeRoute === "home");
      document.body.classList.toggle("route-margin", safeRoute === "margin");
      document.body.classList.toggle("route-wms", safeRoute === "wms");
      document.body.classList.toggle("route-excel-count", safeRoute === "excel-count");
      const hasAuthRedirectParams = isSupabaseAuthRedirectHash(location.hash) || isSupabaseAuthRedirectSearch(location.search);
      if (!hasAuthRedirectParams && location.hash !== `#${safeRoute}`) history.replaceState(null, "", `#${safeRoute}`);
      if (safeRoute === "wms") requestAnimationFrame(renderOrderChart);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    buttons.forEach((button) => button.addEventListener("click", () => routeTo(button.dataset.route)));
    window.addEventListener("hashchange", () => routeTo(location.hash.replace("#", "")));
    routeTo("home");
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
    const marginPage = $("page-margin") || document;
    let lastPointerTarget = null;
    let lastPointerTime = 0;
    let suppressFocusUntil = 0;

    const markWindowReturn = () => {
      suppressFocusUntil = Date.now() + 900;
    };

    window.addEventListener("blur", markWindowReturn);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) markWindowReturn();
    });

    marginPage.addEventListener("pointerdown", (event) => {
      lastPointerTarget = event.target.closest("#page-margin input[type='number']");
      lastPointerTime = Date.now();
    }, true);

    document.querySelectorAll("#page-margin input[type='number']").forEach((input) => {
      if (input.dataset.clearReady) return;
      input.dataset.clearReady = "1";

      input.addEventListener("input", () => {
        input.dataset.marginEdited = "1";
      });

      input.addEventListener("focus", () => {
        if (input.readOnly || input.disabled) return;

        input.dataset.previousValue = input.value;
        input.classList.add("editing-now");

        const now = Date.now();
        const focusedByPointer = lastPointerTarget === input && now - lastPointerTime < 500;
        const returningFromOtherWindow = now < suppressFocusUntil;
        const rawValue = String(input.value || "").trim();

        // 0 기본값은 마우스/터치로 직접 누른 경우에만 비웁니다.
        // Tab 이동이나 브라우저 창 복귀로 다시 focus될 때는 값을 건드리지 않습니다.
        if (focusedByPointer && !returningFromOtherWindow && !input.dataset.marginEdited && rawValue === "0") {
          input.value = "";
          return;
        }

        if (!returningFromOtherWindow && rawValue !== "") {
          requestAnimationFrame(() => {
            if (document.activeElement === input) {
              try {
                input.select();
              } catch (error) {
                // 일부 모바일 브라우저에서 select()가 막혀도 계산기는 정상 작동해야 합니다.
              }
            }
          });
        }
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


  function initMarginZeroButtons() {
    const marginPage = $("page-margin");
    if (!marginPage) return;

    const zeroButtonInputIds = [
      "salePrice",
      "saleQty",
      "unitCost",
      "shippingFee",
      "boxFee",
      "commissionRate",
      "vatRate",
      "earlyRate"
    ];

    zeroButtonInputIds.forEach((inputId) => {
      const input = $(inputId);
      if (!input || input.dataset.zeroButtonReady) return;
      if (!marginPage.contains(input) || input.matches("select, textarea") || input.type !== "number") return;

      input.dataset.zeroButtonReady = "1";
      const fieldLabel = Array.from(input.closest("label.field")?.children || [])
        .find((child) => child.tagName === "SPAN" && !child.classList.contains("margin-zero-input-wrap"))
        ?.textContent?.trim() || inputId;

      let wrapper = input.closest(".margin-zero-input-wrap");
      if (!wrapper) {
        wrapper = document.createElement("span");
        wrapper.className = "margin-zero-input-wrap";
        input.parentNode.insertBefore(wrapper, input);
        wrapper.appendChild(input);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "margin-input-zero-btn";
      button.dataset.marginZeroTarget = inputId;
      button.setAttribute("aria-label", `${fieldLabel} 0으로 초기화`);
      button.textContent = "0";

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        input.value = "0";
        input.dataset.marginEdited = "1";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        calculateMargin();
      });

      wrapper.appendChild(button);
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
        if (card.id === "outboundDiagnosticsCard") {
          button.setAttribute("aria-label", collapsed ? "출고 데이터 진단 펼치기" : "출고 데이터 진단 접기");
          button.setAttribute("title", collapsed ? "출고 데이터 진단 펼치기" : "출고 데이터 진단 접기");
        }
        if (save) setLocalStorageItem(`reborn-collapse:${key}`, collapsed ? "1" : "0", "setCollapsed");
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

  function readPurchaseViewMode() {
    try {
      const saved = localStorage.getItem(PURCHASE_VIEW_MODE_KEY);
      if (PURCHASE_VIEW_MODES.includes(saved)) return saved;
    } catch {
      // UI 설정 저장소를 읽지 못해도 기본 펼침 상태로 작동해야 합니다.
    }
    return "expanded";
  }

  function savePurchaseViewMode(mode) {
    try {
      setLocalStorageItem(PURCHASE_VIEW_MODE_KEY, mode, "setPurchaseViewMode");
    } catch {
      // UI 설정 저장 실패는 발주 데이터 저장과 분리되어야 합니다.
    }
  }

  function applyPurchaseViewMode() {
    const card = $("purchaseStatusCard");
    if (!card) return;

    const editable = isEditorSession();
    let mode = PURCHASE_VIEW_MODES.includes(purchaseViewMode) ? purchaseViewMode : (editable ? "expanded" : "compact");
    if (!editable && mode === "expanded") mode = "compact";
    purchaseViewMode = mode;

    const isCompact = mode === "compact";
    const isCollapsed = mode === "collapsed";

    card.dataset.purchaseViewMode = mode;
    card.classList.toggle("purchase-view-compact", isCompact);
    card.classList.toggle("purchase-view-collapsed", isCollapsed);

    const adminPanel = $("purchaseAdminPanel");
    if (adminPanel) {
      const showAdminPanel = editable && mode === "expanded";
      adminPanel.hidden = !showAdminPanel;
      adminPanel.setAttribute("aria-hidden", String(!showAdminPanel));
    }

    ["purchaseSummaryList", "purchaseList", "purchaseEmptyState"].forEach((id) => {
      const node = $(id);
      if (!node) return;
      node.hidden = isCollapsed;
      node.setAttribute("aria-hidden", String(isCollapsed));
    });

    document.querySelectorAll("[data-purchase-view-mode]").forEach((button) => {
      const isExpandedButton = button.dataset.purchaseViewMode === "expanded";
      const hideForViewer = isExpandedButton && !editable;
      button.hidden = hideForViewer;
      button.setAttribute("aria-hidden", String(hideForViewer));
      const active = !hideForViewer && button.dataset.purchaseViewMode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setPurchaseViewMode(mode, save = true) {
    if (!PURCHASE_VIEW_MODES.includes(mode)) return;
    purchaseViewMode = mode;
    if (save) savePurchaseViewMode(mode);
    applyPurchaseViewMode();
  }

  function initPurchaseViewMode() {
    purchaseViewMode = readPurchaseViewMode();
    applyPurchaseViewMode();
  }



  function buildMarginProductPicker(select) {
    if (!select || select.dataset.customPickerReady) return;
    select.dataset.customPickerReady = "1";

    const shell = select.closest(".select-shell") || select;
    shell.classList.add("is-hidden-select");

    const picker = document.createElement("div");
    picker.className = "product-picker product-search-picker";
    picker.innerHTML = `
      <div class="product-picker-input-wrap">
        <input type="search" class="product-picker-input" placeholder="상품명 직접 입력 또는 검색" autocomplete="off" aria-expanded="false" aria-autocomplete="list" />
        <small class="product-picker-cost-hint">상품명을 입력하거나 추천상품을 선택하세요</small>
      </div>
      <div class="product-picker-menu" hidden>
        <div class="product-picker-list" role="listbox"></div>
      </div>
    `;
    shell.after(picker);

    const input = picker.querySelector(".product-picker-input");
    const hint = picker.querySelector(".product-picker-cost-hint");
    const menu = picker.querySelector(".product-picker-menu");
    const list = picker.querySelector(".product-picker-list");
    const directProduct = MARGIN_PRODUCTS.find((item) => item.name === "직접 입력") || MARGIN_PRODUCTS[0];
    let currentItems = [];
    let activeIndex = -1;

    const normalizeKeyword = (value) => String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .trim();

    const getSearchItems = (keyword = "") => {
      const raw = String(keyword || "").trim();
      const compact = normalizeKeyword(raw);
      const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
      const candidates = MARGIN_PRODUCTS.filter((item) => item.name !== "직접 입력");
      if (!compact) return candidates;
      return candidates
        .map((item) => {
          const name = item.name.toLowerCase();
          const compactName = normalizeKeyword(item.name);
          let score = 0;
          if (name === raw.toLowerCase()) score += 100;
          if (compactName === compact) score += 90;
          if (name.startsWith(raw.toLowerCase())) score += 45;
          if (compactName.startsWith(compact)) score += 40;
          if (name.includes(raw.toLowerCase())) score += 25;
          if (compactName.includes(compact)) score += 20;
          if (words.length && words.every((word) => name.includes(word))) score += 15;
          return { item, score };
        })
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "ko"))
        .map((entry) => entry.item);
    };

    const exactMatch = (keyword = "") => {
      const compact = normalizeKeyword(keyword);
      if (!compact) return null;
      return MARGIN_PRODUCTS.find((item) => item.name !== "직접 입력" && normalizeKeyword(item.name) === compact) || null;
    };

    const setHint = (item = null) => {
      if (item && getMarginProductCost(item) > 0) {
        hint.textContent = `${money(getMarginProductCost(item))} 자동 입력`;
        picker.classList.add("has-selected-product");
        return;
      }
      hint.textContent = "등록되지 않은 상품은 원가를 직접 입력하세요";
      picker.classList.remove("has-selected-product");
    };

    const close = () => {
      menu.hidden = true;
      input.setAttribute("aria-expanded", "false");
      picker.classList.remove("open");
      activeIndex = -1;
    };

    const open = () => {
      menu.hidden = false;
      input.setAttribute("aria-expanded", "true");
      picker.classList.add("open");
      renderList(input.value);
    };

    const setDirectMode = () => {
      if (directProduct && select.value !== directProduct.name) {
        select.value = directProduct.name;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setHint(null);
      calculateMargin();
    };

    const applyProduct = (item, shouldClose = true) => {
      if (!item) return;
      input.value = item.name;
      select.value = item.name;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      setHint(item);
      renderList(input.value);
      if (shouldClose) close();
    };

    function renderList(keyword = "") {
      currentItems = getSearchItems(keyword);
      if (activeIndex >= currentItems.length) activeIndex = currentItems.length - 1;
      if (!currentItems.length) {
        list.innerHTML = `<p class="picker-empty">추천 상품이 없습니다. 상품명은 그대로 입력하고 원가는 직접 입력하세요.</p>`;
        return;
      }
      list.innerHTML = currentItems.map((item, index) => `
        <button type="button" class="product-picker-option ${item.name === select.value ? "active" : ""} ${index === activeIndex ? "is-focused" : ""}" data-index="${index}" data-name="${escapeHtml(item.name)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${getMarginProductCost(item) ? money(getMarginProductCost(item)) : "원가 직접 입력"}</span>
        </button>
      `).join("");
    }

    input.addEventListener("focus", () => open());
    input.addEventListener("click", () => open());
    input.addEventListener("input", () => {
      const matched = exactMatch(input.value);
      if (matched) {
        select.value = matched.name;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        setHint(matched);
      } else {
        setDirectMode();
      }
      activeIndex = currentItems.length ? 0 : -1;
      open();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        close();
        input.blur();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (menu.hidden) open();
        activeIndex = currentItems.length ? Math.min(activeIndex + 1, currentItems.length - 1) : -1;
        renderList(input.value);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = currentItems.length ? Math.max(activeIndex - 1, 0) : -1;
        renderList(input.value);
        return;
      }
      if (event.key === "Enter" && !menu.hidden && activeIndex >= 0 && currentItems[activeIndex]) {
        event.preventDefault();
        applyProduct(currentItems[activeIndex]);
      }
    });

    list.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const option = event.target.closest(".product-picker-option");
      if (!option) return;
      const item = currentItems[Number(option.dataset.index)] || MARGIN_PRODUCTS.find((entry) => entry.name === option.dataset.name);
      applyProduct(item);
    });

    document.addEventListener("click", (event) => {
      if (!picker.contains(event.target)) close();
    });

    const initial = MARGIN_PRODUCTS.find((item) => item.name === select.value);
    if (initial && initial.name !== "직접 입력") {
      input.value = initial.name;
      setHint(initial);
    } else {
      input.value = "";
      setHint(null);
    }
    renderList("");
  }


  function renderProductOptions() {
    const select = $("productSelect");
    if (!select) return;
    const current = select.value;
    select.innerHTML = MARGIN_PRODUCTS.map((item) => {
      const cost = getMarginProductCost(item);
      return `<option value="${escapeHtml(item.name)}" data-cost="${cost}">${escapeHtml(item.name)}${cost ? ` · ${money(cost)}` : ""}</option>`;
    }).join("");
    select.value = MARGIN_PRODUCTS.some((item) => item.name === current) ? current : "직접 입력";
  }

  function initMarginCalculator() {
    const select = $("productSelect");
    if (!select) return;
    renderProductOptions();
    enhanceNativeSelects($("page-margin") || document);
    initMarginClearOnFocus();
    initMarginZeroButtons();
    select.addEventListener("change", () => {
      const option = select.selectedOptions[0];
      const cost = cleanNumber(option?.dataset.cost);
      if (cost > 0) $("unitCost").value = cost;
      calculateMargin();
    });
    buildMarginProductPicker(select);
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
    setText("miniNetProfit", money(net));
    setText("marginRateText", `마진율 ${marginRate.toFixed(2)}%`);

    const miniProfitBadge = $("miniNetProfitBadge");
    if (miniProfitBadge) {
      miniProfitBadge.className = `margin-profit-mini ${net > 0 ? "profit-positive" : net < 0 ? "profit-negative" : "profit-zero"}`;
    }

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
      if (!localStateLoadFailed) setLocalStorageItem(STORAGE_KEY, JSON.stringify(state), "initWms archiveOldOrderStats");
    }
    renderPalletInputs();
    renderBoxStockInputs();
    renderStockMoveRows();
    renderPurchaseProductOptions();
    setReturnAdjustmentDefaults();
    ensurePurchaseDateInputDefault();
    bindWmsEvents();
    bindLaborCostEvents();
    bindWmsMainViewTabs();
    bindInventoryManualAdjustEvents();
    initPurchaseViewMode();
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


  function getDefByKey(key) {
    return INVENTORY_DEFS[canonicalSku(key)] || null;
  }

  function generatePurchaseId() {
    return `po_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizePurchaseDate(value, fallbackDate) {
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const parsed = raw ? dateKey(raw) : "";
    if (parsed) return parsed;
    return dateKey(fallbackDate || new Date());
  }

  function purchaseDateLabel(value) {
    const key = normalizePurchaseDate(value, new Date());
    const date = new Date(`${key}T00:00:00`);
    if (Number.isNaN(date.getTime())) return key || "날짜 미지정";
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  }

  function ensurePurchaseDateInputDefault() {
    const input = $("purchaseDateInput");
    if (input && !input.value) input.value = todayKey();
  }

  function normalizePurchaseItem(item) {
    if (!item || typeof item !== "object") return null;
    const rawProductKey = typeof item.productKey === "string" ? item.productKey : "";
    const productKey = rawProductKey ? canonicalSku(rawProductKey) : "";
    const def = productKey ? getDefByKey(productKey) : null;
    const rawName = String(item.name || productKey || "").trim();
    const name = INVENTORY_DEFS[canonicalSku(rawName)] ? canonicalSku(rawName) : replaceLegacySkuText(rawName);
    if (!name) return null;
    const createdAt = String(item.createdAt || new Date().toISOString());
    const orderDate = normalizePurchaseDate(item.orderDate || item.purchaseDate || item.expectedDate, createdAt);
    return {
      id: String(item.id || generatePurchaseId()),
      batchId: String(item.batchId || ""),
      batchName: replaceLegacySkuText(item.batchName || ""),
      productKey,
      name,
      qty: cleanNumber(item.qty),
      unit: String(item.unit || "unit"),
      unitPrice: cleanNumber(item.unitPrice || def?.cost || 0),
      status: String(item.status || "발주중"),
      memo: String(item.memo || ""),
      orderDate,
      createdAt,
    };
  }

  function normalizeReturnAdjustment(item) {
    if (!item || typeof item !== "object") return null;
    const sku = canonicalSku(item.sku);
    if (!INVENTORY_DEFS[sku]) return null;
    const typeKey = RETURN_ADJUSTMENT_TYPES[item.type] ? item.type : "postShipCancel";
    const date = String(item.date || todayKey()).slice(0, 10);
    const qty = cleanNumber(item.qty);
    const unit = ["unit", "box", "pallet"].includes(String(item.unit)) ? String(item.unit) : "unit";
    const units = Math.max(0, Math.round(cleanNumber(item.units)));
    return {
      id: String(item.id || createHistoryId()),
      type: typeKey,
      sku,
      qty,
      unit,
      units,
      date,
      memo: String(item.memo || ""),
      restores: Boolean(item.restores ?? RETURN_ADJUSTMENT_TYPES[typeKey]?.restores),
      createdAt: String(item.createdAt || new Date().toISOString())
    };
  }

  function purchaseUnitsPerSelectedUnit(item) {
    const def = item.productKey ? getDefByKey(item.productKey) : null;
    if (!def) return 1;
    if (item.unit === "pallet") return cleanNumber(def.boxesPerPallet) * cleanNumber(def.unitsPerBox) || 1;
    if (item.unit === "box") return cleanNumber(def.unitsPerBox) || 1;
    return 1;
  }

  function purchaseUnitLabel(item) {
    const def = item.productKey ? getDefByKey(item.productKey) : null;
    if (item.unit === "pallet") return "파렛";
    if (item.unit === "box") return def?.isBox ? "묶음" : "완박스";
    return def?.isBox ? "장" : "낱개";
  }

  function calculatePurchaseItemAmount(item) {
    return Math.round(cleanNumber(item.qty) * purchaseUnitsPerSelectedUnit(item) * cleanNumber(item.unitPrice));
  }

  function purchaseQtyLabel(item) {
    const qty = cleanNumber(item.qty);
    const formattedQty = Number.isInteger(qty) ? String(qty) : qty.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
    const unitCount = purchaseUnitsPerSelectedUnit(item);
    if (unitCount > 1) return `${formattedQty}${purchaseUnitLabel(item)} · ${number(Math.round(qty * unitCount))}${item.productKey && getDefByKey(item.productKey)?.isBox ? "장" : "개"} 기준`;
    return `${formattedQty}${purchaseUnitLabel(item)}`;
  }

  function createPurchaseDraftRow(values = {}) {
    return {
      id: String(values.id || `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      productKey: String(values.productKey || ""),
      name: String(values.name || ""),
      qty: values.qty === undefined || values.qty === null ? "" : String(values.qty),
      unit: String(values.unit || "pallet"),
      unitPrice: values.unitPrice === undefined || values.unitPrice === null ? "" : String(values.unitPrice),
    };
  }

  let purchaseDraftRows = [createPurchaseDraftRow()];

  function purchaseProductOptionsHtml(selected = "") {
    return `<option value="">직접 입력</option>` + Object.entries(INVENTORY_DEFS).map(([sku, def]) => `
      <option value="${escapeHtml(sku)}" ${sku === selected ? "selected" : ""}>${escapeHtml(sku)} · ${escapeHtml(def.group || "기타")}</option>
    `).join("");
  }

  function purchaseDraftUnitOptions(selected = "pallet") {
    const options = [
      ["pallet", "파렛"],
      ["box", "완박스/묶음"],
      ["unit", "낱개/장"],
    ];
    return options.map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("");
  }

  function collectPurchaseDraftRowsFromDom() {
    const wrap = $("purchaseDraftRows");
    if (!wrap || !wrap.children.length) return;
    purchaseDraftRows = Array.from(wrap.querySelectorAll("[data-purchase-draft-id]")).map((row) => createPurchaseDraftRow({
      id: row.dataset.purchaseDraftId,
      productKey: row.querySelector("[data-purchase-draft-field='productKey']")?.value || "",
      name: row.querySelector("[data-purchase-draft-field='name']")?.value || "",
      qty: row.querySelector("[data-purchase-draft-field='qty']")?.value || "",
      unit: row.querySelector("[data-purchase-draft-field='unit']")?.value || "pallet",
      unitPrice: row.querySelector("[data-purchase-draft-field='unitPrice']")?.value || "",
    }));
    if (!purchaseDraftRows.length) purchaseDraftRows = [createPurchaseDraftRow()];
  }

  function renderPurchaseDraftRows() {
    const wrap = $("purchaseDraftRows");
    if (!wrap) return;
    if (!Array.isArray(purchaseDraftRows) || !purchaseDraftRows.length) purchaseDraftRows = [createPurchaseDraftRow()];
    wrap.innerHTML = purchaseDraftRows.map((row, index) => `
      <div class="purchase-draft-row" data-purchase-draft-id="${escapeHtml(row.id)}">
        <div class="purchase-draft-index">${number(index + 1)}</div>
        <label>
          <span>등록 품목</span>
          <select data-purchase-draft-field="productKey">${purchaseProductOptionsHtml(row.productKey)}</select>
        </label>
        <label>
          <span>품목명</span>
          <input data-purchase-draft-field="name" type="text" value="${escapeHtml(row.name)}" placeholder="예: 브이콘 50g / SAMPLE-A" />
        </label>
        <label>
          <span>수량</span>
          <input data-purchase-draft-field="qty" type="number" min="0" step="0.01" value="${escapeHtml(row.qty)}" placeholder="예: 1" />
        </label>
        <label>
          <span>단위</span>
          <select data-purchase-draft-field="unit">${purchaseDraftUnitOptions(row.unit)}</select>
        </label>
        <label>
          <span>낱개 단가</span>
          <input data-purchase-draft-field="unitPrice" type="number" min="0" step="0.01" value="${escapeHtml(row.unitPrice)}" placeholder="자동 또는 직접 입력" />
        </label>
        <button type="button" class="icon-btn purchase-remove-draft" data-purchase-draft-remove="${escapeHtml(row.id)}" aria-label="발주 입력 행 삭제" ${purchaseDraftRows.length <= 1 ? "disabled" : ""}>×</button>
      </div>
    `).join("");
  }

  function renderPurchaseProductOptions() {
    const wrap = $("purchaseDraftRows");
    if (!wrap) return;
    collectPurchaseDraftRowsFromDom();
    renderPurchaseDraftRows();
  }

  function syncPurchaseFormFromProduct(rowId, productKey) {
    const wrap = $("purchaseDraftRows");
    const row = Array.from(wrap?.querySelectorAll("[data-purchase-draft-id]") || []).find((item) => item.dataset.purchaseDraftId === rowId);
    const def = productKey ? getDefByKey(productKey) : null;
    if (!row || !def) return;
    const nameInput = row.querySelector("[data-purchase-draft-field='name']");
    const unitPriceInput = row.querySelector("[data-purchase-draft-field='unitPrice']");
    if (nameInput) nameInput.value = productKey;
    if (unitPriceInput) unitPriceInput.value = String(getSkuCost(productKey));
  }

  function addPurchaseDraftRow() {
    if (!requireEditor("발주 품목 줄 추가")) return;
    collectPurchaseDraftRowsFromDom();
    purchaseDraftRows.push(createPurchaseDraftRow());
    renderPurchaseDraftRows();
  }

  function removePurchaseDraftRow(rowId) {
    if (!requireEditor("발주 품목 줄 삭제")) return;
    collectPurchaseDraftRowsFromDom();
    purchaseDraftRows = purchaseDraftRows.filter((row) => row.id !== rowId);
    if (!purchaseDraftRows.length) purchaseDraftRows = [createPurchaseDraftRow()];
    renderPurchaseDraftRows();
  }

  function resetPurchaseForm() {
    purchaseDraftRows = [createPurchaseDraftRow()];
    renderPurchaseDraftRows();
    ["purchaseStatusInput", "purchaseMemoInput", "purchaseBatchNameInput"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    const dateInput = $("purchaseDateInput");
    if (dateInput) dateInput.value = todayKey();
  }

  function makeAutoPurchaseBatchName(rows) {
    const validRows = Array.isArray(rows) ? rows.filter((row) => String(row?.name || "").trim()) : [];
    if (!validRows.length) return "발주 묶음";
    if (validRows.length === 1) return String(validRows[0].name || "발주 묶음").trim();
    return `${String(validRows[0].name || "발주 묶음").trim()} 외 ${number(validRows.length - 1)}품목`;
  }

  function addPurchaseItemFromForm() {
    if (!requireEditor("발주 현황 추가")) return;
    collectPurchaseDraftRowsFromDom();
    const status = ($("purchaseStatusInput")?.value || "발주중").trim() || "발주중";
    const memo = ($("purchaseMemoInput")?.value || "").trim();
    const requestedBatchName = ($("purchaseBatchNameInput")?.value || "").trim();
    const orderDate = normalizePurchaseDate($("purchaseDateInput")?.value || todayKey(), new Date());
    const createdAt = new Date().toISOString();
    const rows = purchaseDraftRows
      .map((row) => {
        const productKey = INVENTORY_DEFS[row.productKey] ? row.productKey : "";
        const name = (row.name || productKey || "").trim();
        const qty = cleanNumber(row.qty || 0);
        const unit = row.unit || "unit";
        const unitPrice = cleanNumber(row.unitPrice || (productKey ? getSkuCost(productKey) : 0));
        return { productKey, name, qty, unit, unitPrice };
      })
      .filter((row) => row.productKey || row.name || row.qty > 0 || row.unitPrice > 0);

    if (!rows.length) {
      showWmsStatus("추가할 발주 품목을 1개 이상 입력해 주세요.", false);
      return;
    }

    const invalid = rows.find((row) => !row.name || row.qty <= 0 || row.unitPrice < 0);
    if (invalid) {
      showWmsStatus("발주 품목명, 수량, 단가를 확인해 주세요.", false);
      return;
    }

    const batchId = generatePurchaseId();
    const batchName = rows.length > 1 ? (requestedBatchName || makeAutoPurchaseBatchName(rows)) : "";
    const additions = rows.map((row) => normalizePurchaseItem({
      id: generatePurchaseId(),
      batchId,
      batchName,
      productKey: row.productKey,
      name: row.name,
      qty: row.qty,
      unit: row.unit,
      unitPrice: row.unitPrice,
      status,
      memo,
      orderDate,
      createdAt,
    })).filter(Boolean);

    addBackup("발주 현황 추가 전 자동 백업");
    state.orderStatus = [...additions, ...(Array.isArray(state.orderStatus) ? state.orderStatus : [])];
    addAdminActionLog("발주 추가", {
      itemName: batchName || makeAutoPurchaseBatchName(rows),
      qty: additions.length,
      unit: "품목",
      memo: memo || status,
      source: "purchaseStatus",
      details: additions.map((item) => ({ sku: item.productKey || item.name, units: purchaseUnitsPerSelectedUnit(item) * cleanNumber(item.qty), text: purchaseQtyLabel(item) }))
    });
    resetPurchaseForm();
    renderAll();
    saveState(additions.length > 1 ? `발주 품목 ${number(additions.length)}개가 추가되었습니다.` : "발주 현황이 추가되었습니다.");
  }

  function removePurchaseItem(id) {
    if (!requireEditor("발주 현황 삭제")) return;
    const target = state.orderStatus.find((item) => item.id === id);
    addBackup("발주 현황 삭제 전 자동 백업");
    state.orderStatus = state.orderStatus.filter((item) => item.id !== id);
    addAdminActionLog("발주 삭제", {
      itemName: target?.name || target?.productKey || "발주 항목",
      qty: cleanNumber(target?.qty),
      unit: purchaseUnitLabel(target || {}),
      memo: target?.memo || "",
      source: "purchaseStatus"
    });
    renderAll();
    saveState("발주 현황에서 삭제되었습니다.");
  }

  function updatePurchaseItemField(id, field, value) {
    if (!requireEditor("발주 현황 수정")) return;
    const item = state.orderStatus.find((entry) => entry.id === id);
    if (!item) return;
    const beforeValue = item[field];
    addBackup("발주 현황 수정 전 자동 백업");
    if (field === "qty" || field === "unitPrice") {
      item[field] = cleanNumber(value);
    } else if (field === "orderDate") {
      item[field] = normalizePurchaseDate(value, item.createdAt || new Date());
    } else {
      item[field] = String(value || "");
    }
    addAdminActionLog("발주 수정", {
      itemName: item.name || item.productKey || "발주 항목",
      qty: field === "qty" ? cleanNumber(item.qty) : 0,
      unit: purchaseUnitLabel(item),
      memo: field + ": " + (beforeValue ?? "") + " → " + (item[field] ?? ""),
      source: "purchaseStatus"
    });
    renderPurchaseStatus();
    saveState("발주 현황이 수정되었습니다.", { silent: true });
  }

  function updatePurchaseBatchName(batchId, value) {
    if (!requireEditor("발주 묶음 대표 이름 수정")) return;
    const id = String(batchId || "");
    if (!id) return;
    const nextName = String(value || "").trim();
    let changed = false;
    state.orderStatus.forEach((entry) => {
      if (String(entry.batchId || "") === id) {
        entry.batchName = nextName;
        changed = true;
      }
    });
    if (!changed) return;
    addBackup("발주 묶음 대표 이름 수정 전 자동 백업");
    addAdminActionLog("발주 묶음명 수정", { itemName: nextName || "발주 묶음", memo: "batchId " + id, source: "purchaseStatus" });
    renderPurchaseStatus();
    saveState("발주 묶음 대표 이름이 수정되었습니다.", { silent: true });
  }

  function formatPurchaseQtyValue(qty) {
    const value = cleanNumber(qty);
    if (Number.isInteger(value)) return number(value);
    return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
  }

  function purchaseBaseUnitLabel(item) {
    return item.productKey && getDefByKey(item.productKey)?.isBox ? "장" : "개";
  }

  function buildPurchaseBatchCounts(items) {
    const counts = new Map();
    items.forEach((item) => {
      const batchId = String(item.batchId || "");
      if (!batchId) return;
      counts.set(batchId, (counts.get(batchId) || 0) + 1);
    });
    return counts;
  }

  function getPurchaseGroupKey(item, batchCounts = new Map()) {
    const batchId = String(item.batchId || "");
    if (batchId && (batchCounts.get(batchId) || 0) > 1) return `batch__${batchId}`;
    return `product__${item.productKey || item.name.trim()}`;
  }

  function getPurchaseItemDate(item) {
    return normalizePurchaseDate(item?.orderDate || item?.purchaseDate || item?.expectedDate, item?.createdAt || new Date());
  }

  function buildPurchaseGroups(items) {
    const groups = new Map();
    const batchCounts = buildPurchaseBatchCounts(items);

    items.forEach((item) => {
      const key = getPurchaseGroupKey(item, batchCounts);
      const isBatchGroup = key.startsWith("batch__");
      const amount = calculatePurchaseItemAmount(item);
      const unitLabel = purchaseUnitLabel(item);
      const baseUnits = cleanNumber(item.qty) * purchaseUnitsPerSelectedUnit(item);
      const baseUnitLabel = purchaseBaseUnitLabel(item);
      const created = item.createdAt ? new Date(item.createdAt) : null;
      const createdTime = created && !Number.isNaN(created.getTime()) ? created.getTime() : 0;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          type: isBatchGroup ? "batch" : "product",
          batchId: isBatchGroup ? String(item.batchId || "") : "",
          batchName: isBatchGroup ? String(item.batchName || "") : "",
          name: item.productKey || item.name,
          productKey: isBatchGroup ? "" : item.productKey,
          items: [],
          amount: 0,
          count: 0,
          baseUnits: 0,
          baseUnitLabel,
          unitTotals: new Map(),
          statusCounts: new Map(),
          productNames: new Set(),
          latestCreatedTime: 0,
        });
      }

      const group = groups.get(key);
      group.items.push(item);
      group.amount += amount;
      group.count += 1;
      group.baseUnits += baseUnits;
      group.latestCreatedTime = Math.max(group.latestCreatedTime, createdTime);
      group.statusCounts.set(item.status || "발주중", (group.statusCounts.get(item.status || "발주중") || 0) + 1);
      group.productNames.add(item.productKey || item.name);
      if (isBatchGroup && !group.batchName && item.batchName) group.batchName = String(item.batchName || "");

      const unitKey = `${item.unit || "unit"}__${unitLabel}`;
      const prev = group.unitTotals.get(unitKey) || { label: unitLabel, qty: 0 };
      prev.qty += cleanNumber(item.qty);
      group.unitTotals.set(unitKey, prev);
    });

    const result = Array.from(groups.values()).map((group) => {
      group.productCount = group.productNames.size || group.items.length;
      if (group.type === "batch") {
        group.name = group.batchName || makeAutoPurchaseBatchName(group.items);
        group.itemPreview = Array.from(group.productNames).slice(0, 3).join(" · ");
        if (group.productCount > 3) group.itemPreview += ` 외 ${number(group.productCount - 3)}품목`;
      } else {
        group.itemPreview = purchaseGroupQtyLabel(group);
      }
      return group;
    });

    return result.sort((a, b) => {
      if (b.latestCreatedTime !== a.latestCreatedTime) return b.latestCreatedTime - a.latestCreatedTime;
      if (b.amount !== a.amount) return b.amount - a.amount;
      return String(a.name).localeCompare(String(b.name), "ko-KR");
    });
  }

  function purchaseGroupQtyLabel(group) {
    if (group?.type === "batch") {
      const productText = `${number(group.productCount || group.items?.length || 0)}품목 묶음`;
      const itemText = `${number(group.count || 0)}건`;
      return `${productText} · ${itemText}`;
    }
    const unitParts = Array.from(group.unitTotals.values()).map((unit) => `${formatPurchaseQtyValue(unit.qty)}${unit.label}`);
    const unitSummary = unitParts.join(" + ");
    const baseUnits = Math.round(cleanNumber(group.baseUnits));
    const baseLabel = `${number(baseUnits)}${group.baseUnitLabel} 기준`;
    return unitSummary ? `${unitSummary} · ${baseLabel}` : baseLabel;
  }

  function purchaseGroupStatusLabel(group) {
    const parts = Array.from(group.statusCounts.entries()).map(([status, count]) => {
      return count > 1 ? `${status} ${number(count)}건` : status;
    });
    return parts.join(" · ") || "발주중";
  }

  function buildPurchaseDateSections(items) {
    const sections = new Map();
    items.forEach((item) => {
      const key = getPurchaseItemDate(item);
      if (!sections.has(key)) sections.set(key, []);
      sections.get(key).push(item);
    });
    return Array.from(sections.entries())
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([date, dateItems]) => ({
        date,
        label: purchaseDateLabel(date),
        items: dateItems,
        groups: buildPurchaseGroups(dateItems),
        amount: dateItems.reduce((sum, item) => sum + calculatePurchaseItemAmount(item), 0),
      }));
  }

  function renderPurchaseSummary(items) {
    const summary = $("purchaseSummaryList");
    const grandTotal = $("purchaseGrandTotal");
    if (!summary) return;
    const groups = buildPurchaseGroups(items);
    const total = groups.reduce((sum, group) => sum + group.amount, 0);
    const batchCount = groups.filter((group) => group.type === "batch").length;
    if (grandTotal) grandTotal.textContent = money(total);
    if (!items.length) {
      summary.innerHTML = "";
      return;
    }
    const dateCount = new Set(items.map(getPurchaseItemDate)).size;
    summary.innerHTML = `
      <div class="purchase-summary-compact">
        <span>날짜 ${number(dateCount)}일</span>
        <span>카드 ${number(groups.length)}개</span>
        <span>묶음 ${number(batchCount)}개</span>
        <span>발주 ${number(items.length)}건</span>
        <strong>${money(total)}</strong>
      </div>`;
  }

  function purchaseCompleteGroupKey(sectionDate, group) {
    return `${String(sectionDate || "")}|${String(group?.key || "")}`;
  }

  function purchaseStableIdToken(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function purchaseStableIdHash(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
  }

  function getPurchaseGroupStableId(sectionDate, group) {
    if (!group || typeof group !== "object") return "";
    const items = Array.isArray(group.items) ? group.items : [];
    const rawTokenGroups = items.map((item) => [
      purchaseStableIdToken(item.productKey),
      purchaseStableIdToken(item.name),
      purchaseStableIdToken(item.qty),
      purchaseStableIdToken(item.unit),
      purchaseStableIdToken(item.unitPrice),
      purchaseStableIdToken(item.status),
      purchaseStableIdToken(item.memo),
      purchaseStableIdToken(item.batchId),
      purchaseStableIdToken(item.batchName),
      purchaseStableIdToken(item.orderDate),
    ]);
    const itemParts = rawTokenGroups.map((tokens) => tokens.join("|")).sort();
    const meaningfulTokens = [
      purchaseStableIdToken(sectionDate),
      purchaseStableIdToken(group.key),
      purchaseStableIdToken(group.name),
      purchaseStableIdToken(group.productKey),
      purchaseStableIdToken(group.batchId),
      purchaseStableIdToken(group.orderDate),
      ...rawTokenGroups.flat(),
    ].filter((part) => part && part !== "0");
    if (meaningfulTokens.length < 3) return "";
    const baseParts = [
      "purchase-group-v1",
      purchaseStableIdToken(sectionDate),
      purchaseStableIdToken(group.key),
      purchaseStableIdToken(group.name),
      purchaseStableIdToken(group.productKey),
      purchaseStableIdToken(group.batchId),
      purchaseStableIdToken(group.orderDate),
      String(items.length),
      ...itemParts,
    ].filter(Boolean);
    return `pg_${purchaseStableIdHash(baseParts.join("||"))}`;
  }

  function getPurchaseStableIdDiagnostics(sectionDate, group) {
    const stableId = getPurchaseGroupStableId(sectionDate, group);
    if (!stableId) {
      return {
        stableId: "",
        label: "식별값 확인 필요",
        status: "warn",
        message: "안전하게 비교할 수 있는 발주 항목 정보가 부족합니다. 저장/숨김 처리는 하지 않습니다.",
        duplicateCount: 0,
      };
    }
    const items = Array.isArray(state.orderStatus)
      ? state.orderStatus.map(normalizePurchaseItem).filter(Boolean)
      : [];
    const sections = buildPurchaseDateSections(items);
    let sameIdCount = 0;
    sections.forEach((section) => {
      (section.groups || []).forEach((candidate) => {
        if (getPurchaseGroupStableId(section.date, candidate) === stableId) sameIdCount += 1;
      });
    });
    if (sameIdCount > 1) {
      return {
        stableId,
        label: stableId,
        status: "warn",
        message: `동일한 식별값이 ${sameIdCount}개 그룹에서 확인되었습니다. 나중 단계에서 숨김 처리 전 추가 확인이 필요합니다.`,
        duplicateCount: sameIdCount,
      };
    }
    return {
      stableId,
      label: stableId,
      status: "ok",
      message: "저장하지 않는 검증용 식별값입니다. 새로고침 후 같은 항목에서 동일한지 확인해주세요.",
      duplicateCount: sameIdCount,
    };
  }

  function findPurchaseGroupByCompleteKey(groupKey) {
    const targetKey = String(groupKey || "");
    if (!targetKey) return null;
    const items = Array.isArray(state.orderStatus) ? state.orderStatus.map(normalizePurchaseItem).filter(Boolean) : [];
    const sections = buildPurchaseDateSections(items);
    for (const section of sections) {
      for (const group of section.groups || []) {
        if (purchaseCompleteGroupKey(section.date, group) === targetKey) {
          return { section, group };
        }
      }
    }
    return null;
  }

  function formatPurchaseCompactDate(value) {
    const text = normalizePurchaseDate(value, new Date());
    if (!text) return "-";
    const date = new Date(`${text}T00:00:00`);
    if (Number.isNaN(date.getTime())) return text;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function renderPurchaseCompleteInlineForm(section, group) {
    const formKey = purchaseCompleteGroupKey(section?.date, group);
    if (!isEditorSession() || purchaseCompleteDraftKey !== formKey) return "";
    const today = todayKey();
    const suggestedAmount = Math.max(0, Math.round(cleanNumber(group?.amount)));
    const stableInfo = getPurchaseStableIdDiagnostics(section?.date, group);
    return `
      <form class="purchase-complete-form purchase-complete-step2-preview" data-purchase-complete-form="${escapeHtml(formKey)}" data-purchase-complete-preview="${escapeHtml(formKey)}" data-admin-only="true" role="group" aria-label="처리완료 저장 입력">
        <div class="purchase-complete-form-head">
          <strong>처리완료 입력 확인</strong>
          <span>5단계에서는 저장 후 발주현황 화면에서만 숨깁니다.</span>
        </div>
        <div class="purchase-complete-stable-check ${stableInfo.status === "ok" ? "is-ok" : "is-warn"}">
          <span class="purchase-complete-stable-label">발주 식별값</span>
          <strong>${escapeHtml(stableInfo.label)}</strong>
          <small>${escapeHtml(stableInfo.message)}</small>
        </div>
        <div class="purchase-complete-form-grid">
          <label>
            <span>입금금액</span>
            <input type="text" inputmode="numeric" autocomplete="off" value="${escapeHtml(number(suggestedAmount))}" data-purchase-complete-field="paymentAmount" placeholder="예: 1,200,000" aria-label="입금금액" />
          </label>
          <label>
            <span>입고날짜</span>
            <input type="date" value="${escapeHtml(today)}" data-purchase-complete-field="inboundDate" aria-label="입고날짜" />
          </label>
          <label>
            <span>입금날짜</span>
            <input type="date" value="${escapeHtml(today)}" data-purchase-complete-field="paymentDate" aria-label="입금날짜" />
          </label>
        </div>
        <div class="purchase-complete-form-actions">
          <button type="button" class="btn ghost" data-purchase-complete-cancel="true">닫기</button>
          <button type="submit" class="btn purchase-complete-validate-btn" data-purchase-complete-save="${escapeHtml(formKey)}">저장</button>
        </div>
        <p class="purchase-complete-form-message" data-purchase-complete-message="${escapeHtml(formKey)}" hidden></p>
        <p class="purchase-complete-form-note">정상 입력 시 처리완료 내역에 저장하고, 안전한 식별값이 확인된 발주 항목만 화면에서 숨깁니다. 원본 데이터는 삭제하지 않습니다.</p>
      </form>`;
  }

  function createPurchaseCompletedDisplayItemsFromGroup(group) {
    const items = Array.isArray(group?.items) ? group.items : [];
    return normalizePurchaseCompletedDisplayItems(items.map((item) => ({
      name: item.productKey || item.name,
      qtyText: purchaseQtyLabel(item),
    })));
  }

  function findPurchaseCompletedSourceGroup(record) {
    const ids = new Set(Array.isArray(record?.sourcePurchaseIds) ? record.sourcePurchaseIds.filter(isValidPurchaseStableId) : []);
    if (!ids.size) return null;
    const items = Array.isArray(state.orderStatus) ? state.orderStatus.map(normalizePurchaseItem).filter(Boolean) : [];
    const sections = buildPurchaseDateSections(items);
    for (const section of sections) {
      for (const group of section.groups || []) {
        const stableId = getPurchaseGroupStableId(section.date, group);
        if (ids.has(stableId)) return group;
      }
    }
    return null;
  }

  function getPurchaseCompletedDisplayItems(record) {
    const directItems = normalizePurchaseCompletedDisplayItems(record?.purchaseItems);
    if (directItems.length) return directItems;
    const productNameItems = normalizePurchaseCompletedDisplayItems(record?.productNames);
    if (productNameItems.length) return productNameItems;
    const sourceGroup = findPurchaseCompletedSourceGroup(record);
    const sourceItems = createPurchaseCompletedDisplayItemsFromGroup(sourceGroup);
    return sourceItems.length ? sourceItems : [];
  }

  function renderPurchaseCompletedProductNames(record) {
    const items = getPurchaseCompletedDisplayItems(record);
    const visibleItems = items.slice(0, 3);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);
    const itemHtml = visibleItems.length
      ? visibleItems.map((item) => `
          <span class="purchase-completed-product-chip">
            <strong>${escapeHtml(item.name)}</strong>
            ${item.qtyText ? `<small>${escapeHtml(item.qtyText)}</small>` : ""}
          </span>`).join("")
      : `<span class="purchase-completed-product-chip is-missing"><strong>상품명 확인 필요</strong></span>`;
    const moreHtml = hiddenCount ? `<span class="purchase-completed-product-more">외 ${number(hiddenCount)}개</span>` : "";
    return `
      <div class="purchase-completed-products">
        <span class="purchase-completed-products-label">상품명</span>
        <div class="purchase-completed-product-list">${itemHtml}${moreHtml}</div>
      </div>`;
  }

  function formatPurchaseCompletedRecentDate(record) {
    const date = new Date(record?.createdAt || record?.paymentDate || record?.inboundDate || "");
    if (Number.isNaN(date.getTime())) return "확인 필요";
    return dateKey(date);
  }

  function renderPurchaseCompletedRecords() {
    const root = $("purchaseCompletedSection");
    if (!root) return;
    const records = Array.isArray(state.purchaseCompletedRecords)
      ? state.purchaseCompletedRecords.map(normalizePurchaseCompletedRecord).filter(Boolean)
      : [];
    state.purchaseCompletedRecords = records;
    const totalAmount = records.reduce((sum, record) => sum + Number(record.paymentAmount || record.amount || 0), 0);
    const recentDate = records.length
      ? records
          .map(formatPurchaseCompletedRecentDate)
          .filter((value) => value && value !== "확인 필요")
          .sort()
          .pop() || "확인 필요"
      : "-";
    const canEditCompletedRecords = isEditorSession();
    const recordCards = records
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((record) => {
        const productNamesHtml = renderPurchaseCompletedProductNames(record);
        const completedDate = formatPurchaseCompletedRecentDate(record);
        return `
        <article class="purchase-completed-record-card">
          <div class="purchase-completed-record-head">
            ${productNamesHtml}
            <div class="purchase-completed-record-main">
              <span class="purchase-completed-record-label">금액</span>
              <strong>${number(record.paymentAmount || record.amount || 0)}원</strong>
            </div>
          </div>
          <div class="purchase-completed-record-dates">
            <span><b>처리일</b> ${escapeHtml(completedDate)}</span>
            <span><b>입고날짜</b> ${escapeHtml(record.inboundDate || record.receivedDate || "-")}</span>
            <span><b>입금날짜</b> ${escapeHtml(record.paymentDate || record.paidDate || "-")}</span>
          </div>
          ${canEditCompletedRecords ? `
            <div class="purchase-completed-record-actions" data-admin-only="true">
              <button type="button" class="btn ghost purchase-completed-remove-btn" data-purchase-completed-remove="${escapeHtml(record.id)}">내역 삭제</button>
            </div>
          ` : ""}
        </article>
      `;
      })
      .join("");

    root.innerHTML = `
      <details class="purchase-completed-panel">
        <summary class="purchase-completed-summary">
          <span class="purchase-completed-summary-main">
            <strong>처리완료 내역 ${number(records.length)}건</strong>
            <small>총 결제금액 ${number(totalAmount)}원 · 최근 처리일 ${escapeHtml(recentDate)}</small>
          </span>
          <span class="purchase-completed-summary-side">
            <span class="purchase-completed-toggle-text"><em class="when-closed">펼치기</em><em class="when-open">접기</em></span>
          </span>
        </summary>
        <div class="purchase-completed-body">
          ${records.length ? `
            <div class="purchase-completed-toolbar">
              <button type="button" class="btn ghost purchase-completed-download" data-purchase-completed-download="true">CSV 다운로드</button>
              ${canEditCompletedRecords ? `
                <button type="button" class="btn ghost purchase-completed-clear-btn" data-admin-only="true" data-purchase-completed-clear="true">처리완료 내역 전체 삭제</button>
              ` : ""}
            </div>
            <div class="purchase-completed-record-grid">${recordCards}</div>
          ` : `
            <p class="muted">아직 저장된 처리완료 내역이 없습니다.</p>
          `}
        </div>
      </details>
    `;
  }

  function startPurchaseComplete(groupKey) {
    if (!requireEditor("발주 처리완료 입력창 열기")) return;
    purchaseCompleteDraftKey = String(groupKey || "");
    renderPurchaseStatus();
  }

  function cancelPurchaseComplete() {
    purchaseCompleteDraftKey = "";
    renderPurchaseStatus();
  }

  function normalizePurchaseCompleteAmountInput(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    return digits ? number(Number(digits)) : "";
  }

  function parsePurchaseCompleteAmount(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "");
    if (!digits) return 0;
    const amount = Number(digits);
    return Number.isFinite(amount) ? amount : 0;
  }

  function setPurchaseCompleteValidationMessage(formKey, type, message) {
    const safeKey = String(formKey || "");
    const box = safeKey ? document.querySelector(`[data-purchase-complete-message="${CSS.escape(safeKey)}"]`) : null;
    if (!box) return;
    box.className = `purchase-complete-form-message ${type === "ready" ? "is-ready" : "is-error"}`;
    box.textContent = message;
    box.hidden = false;
  }

  function clearPurchaseCompleteValidationMessage(form) {
    const box = form?.querySelector?.("[data-purchase-complete-message]");
    if (box) box.hidden = true;
  }

  function createPurchaseCompletedRecordId(sourcePurchaseId) {
    const source = String(sourcePurchaseId || "manual").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "manual";
    return `pc-${source}-${Date.now().toString(36)}`;
  }

  function isSafePurchaseCompletedHideTarget(stableInfo) {
    return isValidPurchaseStableId(stableInfo?.stableId) && Number(stableInfo?.duplicateCount || 0) === 1;
  }

  function getPurchaseCompletedHiddenIdSet() {
    const completedRecordIds = Array.isArray(state.purchaseCompletedRecords)
      ? state.purchaseCompletedRecords.flatMap((record) => Array.isArray(record?.sourcePurchaseIds) ? record.sourcePurchaseIds : [])
      : [];
    state.purchaseCompletedHiddenIds = normalizePurchaseCompletedHiddenIds([
      ...(Array.isArray(state.purchaseCompletedHiddenIds) ? state.purchaseCompletedHiddenIds : []),
      ...completedRecordIds
    ]);
    return new Set(state.purchaseCompletedHiddenIds);
  }

  function addPurchaseCompletedHiddenId(stableId) {
    const id = String(stableId || "").trim();
    if (!isValidPurchaseStableId(id)) return false;
    state.purchaseCompletedHiddenIds = normalizePurchaseCompletedHiddenIds(state.purchaseCompletedHiddenIds);
    if (!state.purchaseCompletedHiddenIds.includes(id)) {
      state.purchaseCompletedHiddenIds.push(id);
      return true;
    }
    return false;
  }

  function completePurchaseGroup(groupKey) {
    // Step 5: save the completed-record copy and hide only the matching rendered purchase group. Do not mutate original purchase rows.
    const formKey = String(groupKey || purchaseCompleteDraftKey || "");
    purchaseCompleteDraftKey = formKey;
    const form = formKey ? document.querySelector(`[data-purchase-complete-form="${CSS.escape(formKey)}"]`) : null;
    if (!form) return;

    const amountInput = form.querySelector('[data-purchase-complete-field="paymentAmount"]');
    const inboundDateInput = form.querySelector('[data-purchase-complete-field="inboundDate"]');
    const paymentDateInput = form.querySelector('[data-purchase-complete-field="paymentDate"]');
    const paymentAmount = parsePurchaseCompleteAmount(amountInput?.value);
    const inboundDate = String(inboundDateInput?.value || "").trim();
    const paymentDate = String(paymentDateInput?.value || "").trim();

    if (!paymentAmount || paymentAmount <= 0) {
      setPurchaseCompleteValidationMessage(formKey, "error", "입금금액을 숫자로 입력해주세요. 예: 1,200,000");
      amountInput?.focus();
      return;
    }
    if (!inboundDate) {
      setPurchaseCompleteValidationMessage(formKey, "error", "입고날짜를 선택해주세요.");
      inboundDateInput?.focus();
      return;
    }
    if (!paymentDate) {
      setPurchaseCompleteValidationMessage(formKey, "error", "입금날짜를 선택해주세요.");
      paymentDateInput?.focus();
      return;
    }

    const match = findPurchaseGroupByCompleteKey(formKey);
    const stableInfo = match ? getPurchaseStableIdDiagnostics(match.section.date, match.group) : { stableId: "", label: "식별값 확인 필요", message: "발주 그룹을 다시 찾을 수 없습니다.", duplicateCount: 0 };
    const sourcePurchaseId = stableInfo.stableId || "";
    const completedPurchaseItems = match ? createPurchaseCompletedDisplayItemsFromGroup(match.group) : [];
    const record = normalizePurchaseCompletedRecord({
      id: createPurchaseCompletedRecordId(sourcePurchaseId),
      amount: paymentAmount,
      inboundDate,
      receivedDate: inboundDate,
      paymentDate,
      paidDate: paymentDate,
      sourcePurchaseId: sourcePurchaseId || null,
      sourcePurchaseIds: sourcePurchaseId ? [sourcePurchaseId] : [],
      productNames: completedPurchaseItems.map((item) => item.name).filter(Boolean),
      purchaseItems: completedPurchaseItems,
      createdAt: new Date().toISOString(),
      createdByRole: isEditorSession() ? "admin" : "user",
    });

    state.purchaseCompletedRecords = Array.isArray(state.purchaseCompletedRecords) ? state.purchaseCompletedRecords : [];
    state.purchaseCompletedRecords.push(record);
    const hiddenEligible = isSafePurchaseCompletedHideTarget(stableInfo);
    const hiddenAdded = hiddenEligible ? addPurchaseCompletedHiddenId(sourcePurchaseId) : false;
    if (amountInput) amountInput.value = number(paymentAmount);
    purchaseCompleteDraftKey = "";
    saveState();
    renderPurchaseStatus();
    showWmsStatus(
      hiddenEligible
        ? `처리완료 내역 저장 완료 · 발주현황에서 해당 항목을 숨겼습니다. · 입금금액 ${number(paymentAmount)}원`
        : `처리완료 내역 저장 완료 · 식별값이 안전하지 않아 발주현황 숨김은 적용하지 않았습니다.`,
      hiddenEligible
    );
    console.info("[purchaseComplete:step5:record-saved-and-hidden]", {
      groupKey: formKey,
      stableId: sourcePurchaseId || null,
      duplicateCount: stableInfo.duplicateCount,
      record,
      originalPurchaseMutated: false,
      hiddenEligible,
      hiddenAdded,
    });
  }


  function removePurchaseCompletedRecord(recordId) {
    if (!requireEditor("처리완료 내역 삭제")) return;
    const id = String(recordId || "").trim();
    if (!id) return;
    const beforeCount = Array.isArray(state.purchaseCompletedRecords) ? state.purchaseCompletedRecords.length : 0;
    state.purchaseCompletedRecords = (Array.isArray(state.purchaseCompletedRecords) ? state.purchaseCompletedRecords : [])
      .map(normalizePurchaseCompletedRecord)
      .filter(Boolean)
      .filter((record) => String(record.id || "") !== id);
    const removed = state.purchaseCompletedRecords.length < beforeCount;
    if (!removed) {
      toast("삭제할 처리완료 내역을 찾지 못했습니다.");
      return;
    }
    // Step 6: delete only the completed record card. Keep purchaseCompletedHiddenIds so completed purchases do not reappear.
    saveState();
    renderPurchaseStatus();
    showWmsStatus("처리완료 내역 1건을 삭제했습니다. 발주현황 숨김 상태는 유지됩니다.", true);
    console.info("[purchaseComplete:step6:record-removed]", {
      recordId: id,
      hiddenIdsKept: true,
      originalPurchaseMutated: false,
    });
  }

  function clearPurchaseCompletedRecords() {
    if (!requireEditor("처리완료 내역 전체 삭제")) return;
    const records = Array.isArray(state.purchaseCompletedRecords)
      ? state.purchaseCompletedRecords.map(normalizePurchaseCompletedRecord).filter(Boolean)
      : [];
    if (!records.length) {
      toast("삭제할 처리완료 내역이 없습니다.");
      return;
    }
    if (!window.confirm(`처리완료 내역 ${number(records.length)}건을 모두 삭제할까요? 발주현황 숨김 상태는 유지됩니다.`)) return;
    state.purchaseCompletedRecords = [];
    // Step 6: keep purchaseCompletedHiddenIds unchanged. This prevents completed purchases from returning to the purchase list.
    saveState();
    renderPurchaseStatus();
    showWmsStatus(`처리완료 내역 ${number(records.length)}건을 전체 삭제했습니다. 발주현황 숨김 상태는 유지됩니다.`, true);
    console.info("[purchaseComplete:step6:records-cleared]", {
      removedCount: records.length,
      hiddenIdsKept: true,
      originalPurchaseMutated: false,
    });
  }


  function escapeCsvCell(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function formatCsvDateText(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    // Step 7 display fix: keep ISO dates as text in Excel so narrow columns do not show #######.
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `="${text}"`;
    return text;
  }

  function downloadPurchaseCompletedCsv() {
    const records = Array.isArray(state.purchaseCompletedRecords)
      ? state.purchaseCompletedRecords.map(normalizePurchaseCompletedRecord).filter(Boolean)
      : [];
    state.purchaseCompletedRecords = records;
    if (!records.length) {
      toast("다운로드할 처리완료 내역이 없습니다.");
      return;
    }

    const headers = ["입금금액", "입고날짜", "입금날짜"];
    const rows = records
      .slice()
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .map((record) => [
        String(cleanNumber(record.paymentAmount || record.amount || 0)),
        formatCsvDateText(record.inboundDate || record.receivedDate || ""),
        formatCsvDateText(record.paymentDate || record.paidDate || "")
      ]);
    const csvText = "\ufeff" + [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\r\n");
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reborn-purchase-completed-${todayKey()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast(`처리완료 내역 CSV ${number(records.length)}건을 다운로드했습니다.`);
    console.info("[purchaseComplete:step7:csv-downloaded]", {
      recordCount: records.length,
      hiddenIdsKept: true,
      originalPurchaseMutated: false,
    });
  }


  function renderPurchaseStatus() {
    renderPurchaseCompletedRecords();
    const list = $("purchaseList");
    const empty = $("purchaseEmptyState");
    if (!list) return;
    const items = Array.isArray(state.orderStatus) ? state.orderStatus.map(normalizePurchaseItem).filter(Boolean) : [];
    state.orderStatus = items;
    const hiddenIdSet = getPurchaseCompletedHiddenIdSet();
    const sections = buildPurchaseDateSections(items)
      .map((section) => {
        const visibleGroups = (section.groups || []).filter((group) => {
          const stableId = getPurchaseGroupStableId(section.date, group);
          return !isValidPurchaseStableId(stableId) || !hiddenIdSet.has(stableId);
        });
        const visibleItems = visibleGroups.flatMap((group) => Array.isArray(group.items) ? group.items : []);
        return {
          ...section,
          items: visibleItems,
          groups: visibleGroups,
          amount: visibleGroups.reduce((sum, group) => sum + cleanNumber(group.amount), 0),
        };
      })
      .filter((section) => section.groups.length > 0);
    const visibleItems = sections.flatMap((section) => section.items || []);
    renderPurchaseSummary(visibleItems);
    if (!visibleItems.length) {
      list.innerHTML = "";
      if (empty) empty.hidden = false;
      applyPurchaseViewMode();
      updateEditorLock();
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = sections.map((section) => `
      <section class="purchase-date-section">
        <div class="purchase-date-head">
          <strong>${escapeHtml(section.label)}</strong>
          <span>${number(section.items.length)}건 · 카드 ${number(section.groups.length)}개 · ${money(section.amount)}</span>
        </div>
        <div class="purchase-date-grid">
          ${section.groups.map((group) => {
            const statusLabel = purchaseGroupStatusLabel(group);
            const isBundle = group.type === "batch" && group.items.length > 1;
            const completeGroupKey = purchaseCompleteGroupKey(section.date, group);
            const shouldKeepPurchaseCardOpen = purchaseCompleteDraftKey === completeGroupKey;
            const adminBatchEditor = isEditorSession() && isBundle ? `
              <div class="purchase-bundle-admin" data-admin-only="true">
                <label>
                  <span>묶음 대표 이름</span>
                  <input type="text" value="${escapeHtml(group.batchName || group.name)}" data-purchase-action="batchName" data-purchase-batch-id="${escapeHtml(group.batchId)}" aria-label="발주 묶음 대표 이름 수정" />
                </label>
              </div>` : "";

            return `
              <details class="purchase-card purchase-card-toggle${isBundle ? " purchase-bundle-card" : ""}"${shouldKeepPurchaseCardOpen ? " open" : ""}>
                <summary class="purchase-card-summary">
                  <div class="purchase-card-main">
                    <div class="purchase-card-name">
                      <strong>${escapeHtml(group.name)}</strong>
                      <span>${escapeHtml(isBundle ? (group.itemPreview || purchaseGroupQtyLabel(group)) : purchaseGroupQtyLabel(group))}</span>
                    </div>
                    <div class="purchase-card-amount">
                      <strong>${money(group.amount)}</strong>
                      <span>${isBundle ? `${number(group.productCount)}품목` : `${number(group.count)}건`}</span>
                    </div>
                  </div>
                  <div class="purchase-card-meta">
                    <span>${escapeHtml(isBundle ? "묶음 발주" : "품목 발주")}</span>
                    <span>${escapeHtml(statusLabel)}</span>
                    <span>${escapeHtml(section.label)}</span>
                    <span class="purchase-card-open-text">상세 보기</span>
                  </div>
                </summary>
                <div class="purchase-card-detail-body">
                  ${adminBatchEditor}
                  ${isEditorSession() ? `
                    <div class="purchase-complete-action-row" data-admin-only="true">
                      <button type="button" class="btn purchase-complete-start" data-purchase-complete-start="${escapeHtml(completeGroupKey)}">처리완료</button>
                    </div>
                    ${renderPurchaseCompleteInlineForm(section, group)}
                  ` : ""}
                  <div class="purchase-detail-list">
                    ${group.items.map((item) => {
                      const amount = calculatePurchaseItemAmount(item);
                      const created = item.createdAt ? new Date(item.createdAt) : null;
                      const createdLabel = created && !Number.isNaN(created.getTime()) ? created.toLocaleDateString("ko-KR") : "-";
                      const adminRow = isEditorSession() ? `
                        <div class="purchase-row-admin" data-admin-only="true">
                          <label><span>날짜</span><input type="date" value="${escapeHtml(getPurchaseItemDate(item))}" data-purchase-action="orderDate" data-purchase-id="${escapeHtml(item.id)}" aria-label="발주 날짜 수정" /></label>
                          <label><span>수량</span><input type="number" min="0" step="0.01" value="${escapeHtml(String(item.qty))}" data-purchase-action="qty" data-purchase-id="${escapeHtml(item.id)}" aria-label="발주 수량 수정" /></label>
                          <label><span>낱개 단가</span><input type="number" min="0" step="0.01" value="${escapeHtml(String(item.unitPrice))}" data-purchase-action="unitPrice" data-purchase-id="${escapeHtml(item.id)}" aria-label="발주 단가 수정" /></label>
                          <label><span>상태</span><input type="text" value="${escapeHtml(item.status)}" data-purchase-action="status" data-purchase-id="${escapeHtml(item.id)}" aria-label="발주 상태 수정" /></label>
                          <label><span>메모</span><input type="text" value="${escapeHtml(item.memo)}" data-purchase-action="memo" data-purchase-id="${escapeHtml(item.id)}" aria-label="발주 메모 수정" /></label>
                          <button type="button" class="btn ghost danger-lite" data-purchase-action="remove" data-purchase-id="${escapeHtml(item.id)}">삭제</button>
                        </div>` : "";
                      return `
                        <article class="purchase-detail-row">
                          <div class="purchase-detail-head">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${escapeHtml(purchaseQtyLabel(item))}</span>
                            <span>${money(amount)}</span>
                            <span>${escapeHtml(item.status || "발주중")}</span>
                            <span>등록 ${escapeHtml(createdLabel)}</span>
                            ${item.memo ? `<span>메모 ${escapeHtml(item.memo)}</span>` : ""}
                          </div>
                          ${adminRow}
                        </article>`;
                    }).join("")}
                  </div>
                </div>
              </details>`;
          }).join("")}
        </div>
      </section>`).join("");
    updateEditorLock();
  }


  function returnAdjustmentTypeOptionsHtml(selected = "postShipCancel") {
    return Object.entries(RETURN_ADJUSTMENT_TYPES).map(([key, info]) => `
      <option value="${escapeHtml(key)}" ${key === selected ? "selected" : ""}>${escapeHtml(info.label)}${info.restores ? " · 재고 복구" : " · 기록만"}</option>
    `).join("");
  }

  function returnAdjustmentSkuOptionsHtml(selected = "") {
    return `<option value="">품목 선택</option>` + Object.entries(INVENTORY_DEFS).map(([sku, def]) => `
      <option value="${escapeHtml(sku)}" ${sku === selected ? "selected" : ""}>${escapeHtml(sku)} · ${escapeHtml(def.group || "기타")}</option>
    `).join("");
  }

  function returnAdjustmentUnitOptionsHtml(sku, selected = "unit") {
    const def = sku ? getDefByKey(sku) : null;
    const boxLabel = def?.isBox ? "묶음" : "완박스";
    const unitLabel = def?.isBox ? "장" : sku === "코디 3겹" ? "개" : "낱개";
    return `
      <option value="unit" ${selected === "unit" ? "selected" : ""}>${unitLabel}</option>
      <option value="box" ${selected === "box" ? "selected" : ""}>${boxLabel}</option>
      <option value="pallet" ${selected === "pallet" ? "selected" : ""}>파렛</option>
    `;
  }

  function returnAdjustmentUnitsPerSelectedUnit(sku, unit) {
    const def = getDefByKey(sku);
    if (!def) return 1;
    if (unit === "pallet") return cleanNumber(def.boxesPerPallet) * cleanNumber(def.unitsPerBox) || 1;
    if (unit === "box") return cleanNumber(def.unitsPerBox) || 1;
    return 1;
  }

  function returnAdjustmentUnitLabel(sku, unit) {
    const def = getDefByKey(sku);
    if (unit === "pallet") return "파렛";
    if (unit === "box") return def?.isBox ? "묶음" : "완박스";
    return def?.isBox ? "장" : sku === "코디 3겹" ? "개" : "낱개";
  }

  function formatReturnAdjustmentInputQty(record) {
    const qty = cleanNumber(record.qty);
    const qtyText = Number.isInteger(qty) ? number(qty) : qty.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
    const unitLabel = returnAdjustmentUnitLabel(record.sku, record.unit);
    return `${qtyText}${unitLabel} · ${formatStock(record.sku, record.units)} 환산`;
  }

  function setReturnAdjustmentDefaults() {
    const type = $("returnAdjustmentType");
    const sku = $("returnAdjustmentSku");
    const unit = $("returnAdjustmentUnit");
    const date = $("returnAdjustmentDate");
    if (type && !type.children.length) type.innerHTML = returnAdjustmentTypeOptionsHtml();
    if (sku && !sku.children.length) sku.innerHTML = returnAdjustmentSkuOptionsHtml();
    if (unit && !unit.children.length) unit.innerHTML = returnAdjustmentUnitOptionsHtml(sku?.value || "", unit.value || "unit");
    if (date && !date.value) date.value = todayKey();
  }

  function refreshReturnAdjustmentUnitOptions() {
    const sku = $("returnAdjustmentSku")?.value || "";
    const unit = $("returnAdjustmentUnit");
    if (!unit) return;
    const current = unit.value || "unit";
    unit.innerHTML = returnAdjustmentUnitOptionsHtml(sku, current);
  }

  function showReturnAdjustmentMessage(message, ok = true) {
    const target = $("returnAdjustmentMessage");
    if (target) {
      target.hidden = false;
      target.textContent = message;
      target.className = `return-adjust-message ${ok ? "success" : "danger"}`;
    }
    showWmsStatus(message, ok);
  }

  function handleReturnAdjustmentProcessClick(event) {
    if (event) event.preventDefault();
    try {
      addReturnAdjustmentFromForm();
    } catch (error) {
      console.error("return adjustment process failed", error);
      showReturnAdjustmentMessage("취소/반품 처리 중 오류가 발생했습니다. 콘솔 오류를 확인해 주세요.", false);
    }
  }

  function addReturnAdjustmentFromForm() {
    if (!requireEditor("취소/반품 처리")) {
      showReturnAdjustmentMessage("취소/반품 처리는 관리자 로그인 후 가능합니다.", false);
      return;
    }
    const typeKey = $("returnAdjustmentType")?.value || "postShipCancel";
    const info = RETURN_ADJUSTMENT_TYPES[typeKey] || RETURN_ADJUSTMENT_TYPES.postShipCancel;
    const sku = canonicalSku($("returnAdjustmentSku")?.value || "");
    const qty = cleanNumber($("returnAdjustmentQty")?.value);
    const unit = $("returnAdjustmentUnit")?.value || "unit";
    const date = ($("returnAdjustmentDate")?.value || todayKey()).slice(0, 10);
    const memo = ($("returnAdjustmentMemo")?.value || "").trim();

    if (!INVENTORY_DEFS[sku]) {
      showReturnAdjustmentMessage("처리할 품목을 선택해 주세요.", false);
      return;
    }
    if (qty <= 0) {
      showReturnAdjustmentMessage("수량을 1 이상 입력해 주세요.", false);
      return;
    }

    addBackup("취소/반품 처리 전 자동 백업");
    const units = Math.round(qty * returnAdjustmentUnitsPerSelectedUnit(sku, unit));
    const record = {
      id: createHistoryId(),
      type: typeKey,
      sku,
      qty,
      unit,
      units,
      date,
      memo,
      restores: Boolean(info.restores),
      createdAt: new Date().toISOString()
    };

    state.returnAdjustments = Array.isArray(state.returnAdjustments) ? state.returnAdjustments : [];
    state.returnAdjustments.unshift(record);
    state.returnAdjustments = state.returnAdjustments.slice(0, 1000);

    const typeLabel = info.label;
    const at = new Date(`${date}T12:00:00`).toISOString();
    state.stock[sku] = state.stock[sku] || { units: 0 };
    let adjustmentDetails = [];
    if (info.restores) {
      state.stock[sku].units = cleanNumber(state.stock[sku].units) + units;
      adjustmentDetails = [{
        sku,
        units,
        direction: "in",
        source: "returnAdjustment",
        adjustmentType: typeKey,
        affectsNetOutbound: true,
        text: `${sku} ${formatStock(sku, units)} 복구`
      }];
      const boxXlRestoreUnits = codiTissueBoxXlUnits(sku, units);
      if (boxXlRestoreUnits > 0 && INVENTORY_DEFS[BOX_XL_SKU]) {
        state.stock[BOX_XL_SKU] = state.stock[BOX_XL_SKU] || { units: 0 };
        state.stock[BOX_XL_SKU].units = cleanNumber(state.stock[BOX_XL_SKU].units) + boxXlRestoreUnits;
        adjustmentDetails.push({
          sku: BOX_XL_SKU,
          units: boxXlRestoreUnits,
          direction: "in",
          source: "returnAdjustment",
          adjustmentType: typeKey,
          autoBoxFor: CODI_TISSUE_SKU,
          affectsNetOutbound: true,
          text: `${BOX_XL_SKU} ${formatStock(BOX_XL_SKU, boxXlRestoreUnits)} 복구`
        });
      }
      const cookieReturnBoxUsage = getCookieChocoPackagingBoxUsage(sku, units);
      if (cookieReturnBoxUsage) {
        const cookieReturnBoxSku = BOX_SKU_BY_SIZE[cookieReturnBoxUsage.size];
        state.stock[cookieReturnBoxSku] = state.stock[cookieReturnBoxSku] || { units: 0 };
        state.stock[cookieReturnBoxSku].units = cleanNumber(state.stock[cookieReturnBoxSku].units) + cookieReturnBoxUsage.units;
        adjustmentDetails.push({
          sku: cookieReturnBoxSku,
          units: cookieReturnBoxUsage.units,
          direction: "in",
          source: "returnAdjustment",
          adjustmentType: typeKey,
          autoBoxFor: COOKIE_CHOCO_SKU,
          affectsNetOutbound: true,
          text: `${cookieReturnBoxSku} ${formatStock(cookieReturnBoxSku, cookieReturnBoxUsage.units)} 복구`
        });
      }
      pushHistory("취소/반품", `${typeLabel} · ${sku}${memo ? ` · ${memo}` : ""}`, `재고 복구 ${formatStock(sku, units)}`, adjustmentDetails, { at, source: "returnAdjustment" });
    } else {
      adjustmentDetails = [{ sku, units, direction: "hold", source: "returnAdjustment", adjustmentType: typeKey }];
      pushHistory("취소/반품", `${typeLabel} · ${sku}${memo ? ` · ${memo}` : ""}`, `재고 미복구 ${formatStock(sku, units)}`, [], { at, source: "returnAdjustment" });
    }

    addAdminActionLog("취소/반품 처리", {
      itemName: sku,
      qty,
      unit: returnAdjustmentUnitLabel(sku, unit),
      memo: typeLabel + (memo ? " · " + memo : ""),
      source: "returnAdjustment",
      details: adjustmentDetails
    });
    saveState("취소/반품 처리가 적용되었습니다.");
    const qtyInput = $("returnAdjustmentQty");
    const memoInput = $("returnAdjustmentMemo");
    if (qtyInput) qtyInput.value = "";
    if (memoInput) memoInput.value = "";
    showReturnAdjustmentMessage("취소/반품 처리가 적용되었습니다.", true);
  }

  function renderReturnAdjustmentPanel() {
    setReturnAdjustmentDefaults();
    const summary = $("returnAdjustmentSummary");
    const list = $("returnAdjustmentList");
    if (!list) return;
    const records = Array.isArray(state.returnAdjustments) ? state.returnAdjustments.map(normalizeReturnAdjustment).filter(Boolean) : [];
    state.returnAdjustments = records;

    if (!isEditorSession()) {
      if (summary) summary.textContent = "";
      list.innerHTML = "";
      list.classList.remove("is-scrollable");
      return;
    }

    const restoreCount = records.filter((record) => record.restores).length;
    if (summary) {
      if (records.length) {
        summary.innerHTML = '<span class="summary-pill primary">총 ' + number(records.length) + '건</span><span class="summary-pill success">재고 복구 ' + number(restoreCount) + '건</span>';
      } else {
        summary.textContent = "처리 기록 없음";
      }
    }
    list.classList.toggle("is-scrollable", records.length > 3);

    list.innerHTML = records.length ? records.slice(0, 40).map((record) => {
      const info = RETURN_ADJUSTMENT_TYPES[record.type] || RETURN_ADJUSTMENT_TYPES.postShipCancel;
      const tone = record.restores ? "restore" : "hold";
      return `
        <article class="return-adjust-record ${tone}">
          <div class="return-adjust-record-main">
            <strong>${escapeHtml(record.sku)}</strong>
            <span>${escapeHtml(info.label)} · ${escapeHtml(record.date || "-")}</span>
          </div>
          <div class="return-adjust-record-qty">
            <b>${escapeHtml(formatStock(record.sku, record.units))}</b>
            <small>${escapeHtml(formatReturnAdjustmentInputQty(record))}</small>
          </div>
          <span class="return-adjust-badge ${tone}">${record.restores ? "재고 복구" : "재고 미복구"}</span>
          ${record.memo ? `<p>${escapeHtml(record.memo)}</p>` : ""}
        </article>`;
    }).join("") : `<div class="detail-empty">아직 취소/반품 처리 기록이 없습니다.</div>`;
  }

  function renderProductCostEditor() {
    const list = $("productCostEditorList");
    if (!list) return;
    state.productCosts = normalizeProductCosts(state.productCosts);
    const query = ($("productCostSearch")?.value || "").trim().toLowerCase();
    const rows = Object.entries(INVENTORY_DEFS)
      .filter(([sku, def]) => !query || sku.toLowerCase().includes(query) || String(def.group || "").toLowerCase().includes(query))
      .sort((a, b) => String(a[1].group || "").localeCompare(String(b[1].group || ""), "ko-KR") || a[0].localeCompare(b[0], "ko-KR"));

    list.innerHTML = rows.length ? rows.map(([sku, def]) => {
      const currentCost = getSkuCost(sku);
      const baseCost = defaultSkuCost(sku);
      const changed = currentCost !== baseCost;
      return `
        <div class="product-cost-row" data-cost-sku="${escapeHtml(sku)}">
          <div class="product-cost-name">
            <strong>${escapeHtml(sku)}</strong>
            <span>${escapeHtml(def.group || "기타")} · 기본 ${money(baseCost)}${changed ? " · 변경됨" : ""}</span>
          </div>
          <div class="product-cost-actions">
            <input type="number" min="0" step="0.01" value="${escapeHtml(String(currentCost))}" data-product-cost-input="${escapeHtml(sku)}" aria-label="${escapeHtml(sku)} 원가" />
            <button type="button" class="ghost-btn mini" data-product-cost-reset="${escapeHtml(sku)}">기본</button>
          </div>
        </div>`;
    }).join("") : `<div class="detail-empty">검색된 품목이 없습니다.</div>`;
  }

  function updateProductCost(sku, value) {
    if (!requireEditor("품목 원가 수정")) return;
    if (!INVENTORY_DEFS[sku]) return;
    const next = cleanNumber(value);
    if (!Number.isFinite(next) || next < 0) {
      alert("원가는 0 이상 숫자로 입력해주세요.");
      renderProductCostEditor();
      return;
    }
    const before = getSkuCost(sku);
    state.productCosts = normalizeProductCosts(state.productCosts);
    if (before === next) return;
    addBackup("가격 수정 전 자동 백업");
    state.productCosts[sku] = next;
    pushHistory("원가수정", sku + " 원가 " + money(before) + " → " + money(next), money(next));
    addAdminActionLog("가격 수정", { itemName: sku, qty: next, unit: "원", memo: money(before) + " → " + money(next), source: "productCost" });
    saveState("품목 원가 수정");
    renderProductOptions();
  }

  function resetProductCost(sku) {
    if (!requireEditor("품목 원가 기본값 복구")) return;
    if (!INVENTORY_DEFS[sku]) return;
    const before = getSkuCost(sku);
    const base = defaultSkuCost(sku);
    state.productCosts = normalizeProductCosts(state.productCosts);
    if (before === base) {
      renderProductCostEditor();
      return;
    }
    addBackup("가격 수정 전 자동 백업");
    state.productCosts[sku] = base;
    pushHistory("원가복구", sku + " 원가 " + money(before) + " → 기본 " + money(base), money(base));
    addAdminActionLog("가격 기본값 복구", { itemName: sku, qty: base, unit: "원", memo: money(before) + " → " + money(base), source: "productCost" });
    saveState("품목 원가 기본값 복구");
    renderProductOptions();
  }

  function renderAll() {
    renderProductOptions();
    renderInventory();
    renderPalletInputs(false);
    renderBoxStockInputs(false);
    renderSummary();
    renderSkuOrderRankSummary();
    renderOrderChart();
    renderHistory();
    renderBackups();
    renderPurchaseStatus();
    renderReturnAdjustmentPanel();
    renderProductCostEditor();
    renderAdminActionLogs();
    ensureStockMoveDefaults();
    renderInventoryItemOrderTrend();
    renderLaborCostCalendar();
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
            <label><span class="unit-label-pallet">파렛</span><input type="number" min="0" inputmode="numeric" value="${normalized.pallets}" data-box-field="pallets" /></label>
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

  function getStockMoveDirection() {
    return $("stockMoveDirection")?.value === "out" ? "out" : "in";
  }

  function stockMoveDirectionLabel(direction = getStockMoveDirection()) {
    return direction === "out" ? "직접 출고" : "입고";
  }

  function ensureStockMoveDefaults() {
    const dateInput = $("moveDate");
    if (dateInput && !dateInput.value) dateInput.value = todayKey();
    updateStockMoveDirectionUi();
    if (!$("stockMoveRows")?.children.length) renderStockMoveRows();
  }

  function updateStockMoveDirectionUi() {
    const direction = getStockMoveDirection();
    const card = $("stockMoveCard");
    if (card) card.dataset.moveDirection = direction;
    const badge = $("moveDirectionBadge");
    if (badge) {
      badge.textContent = direction === "out" ? "직접 출고 모드" : "입고 모드";
      badge.classList.toggle("outbound", direction === "out");
    }
    const memo = $("moveMemo");
    if (memo) {
      memo.placeholder = direction === "out"
        ? "예: 배송 누락 재출고 / 오배송 재처리 / 고객 재발송"
        : "예: 4/28 14파렛 입고";
    }
    const applyBtn = $("applyStockMove");
    if (applyBtn) applyBtn.textContent = direction === "out" ? "직접 출고 적용" : "입고 적용";
    const quickBtn = $("quickInboundExample");
    if (quickBtn) quickBtn.hidden = direction === "out";
    document.querySelectorAll("#stockMoveRows .move-row").forEach((row) => {
      const label = row.querySelector(".moveUnitPriceLabel");
      if (label) label.textContent = direction === "out" ? "출고 단가" : "입고 단가";
      const priceInput = row.querySelector(".moveUnitPrice");
      if (priceInput) {
        const sku = row.querySelector(".moveSku")?.value || "";
        priceInput.placeholder = sku ? `현재 ${money(getSkuCost(sku))}` : "예: 2200";
      }
    });
    updateMoveBatchSummary();
  }

  function buildStockMoveAt(dateValue) {
    const date = normalizePurchaseDate(dateValue || todayKey(), new Date());
    return new Date(`${date}T12:00:00`).toISOString();
  }

  function resolveDirectOutboundUnitPrice(row, sku) {
    const raw = String(row?.unitPriceRaw || "").replace(/,/g, "").trim();
    const hasManualPrice = raw !== "";
    const inputPrice = cleanNumber(row?.unitPrice);
    if (hasManualPrice && (!Number.isFinite(inputPrice) || inputPrice <= 0)) {
      return { ok: false, unitPrice: 0, source: "invalid", message: `${sku} 출고 단가는 0보다 큰 숫자로 입력해주세요.` };
    }
    if (inputPrice > 0) return { ok: true, unitPrice: inputPrice, source: "manual" };
    const fallbackPrice = getSkuCost(sku);
    if (fallbackPrice > 0) return { ok: true, unitPrice: fallbackPrice, source: "productCost" };
    return { ok: false, unitPrice: 0, source: "missing", message: `${sku} 출고 단가를 입력하거나 품목 원가를 먼저 등록해주세요.` };
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
    const selectedSku = defaults.sku || Object.keys(INVENTORY_DEFS)[0] || "";
    const defaultUnitPrice = defaults.unitPrice ?? (selectedSku ? getSkuCost(selectedSku) : "");
    const currentPricePlaceholder = selectedSku ? `현재 ${money(getSkuCost(selectedSku))}` : "예: 2200";
    const direction = getStockMoveDirection();
    const priceLabel = direction === "out" ? "출고 단가" : "입고 단가";
    const row = document.createElement("div");
    row.className = "move-row";
    row.dataset.rowId = rowId;
    row.innerHTML = `
      <label class="field move-sku">
        <span>품목</span>
        <select class="moveSku">${skuOptions(selectedSku)}</select>
      </label>
      <label class="field move-qty">
        <span class="unit-label-pallet">파렛</span>
        <input class="movePallets" type="number" inputmode="numeric" min="0" value="${defaults.pallets || 0}" />
      </label>
      <label class="field move-qty">
        <span class="unit-label-box">박스/묶음</span>
        <input class="moveBoxes" type="number" inputmode="numeric" min="0" value="${defaults.boxes || 0}" />
      </label>
      <label class="field move-qty">
        <span class="unit-label-each">낱개</span>
        <input class="moveEaches" type="number" inputmode="numeric" min="0" value="${defaults.eaches || 0}" />
      </label>
      <label class="field move-qty move-price">
        <span class="moveUnitPriceLabel">${escapeHtml(priceLabel)}</span>
        <input class="moveUnitPrice" type="text" inputmode="numeric" value="${escapeHtml(String(defaultUnitPrice || ""))}" placeholder="${escapeHtml(currentPricePlaceholder)}" title="비워두면 현재 품목 원가를 사용합니다." />
      </label>
      <button type="button" class="icon-btn removeMoveRow" aria-label="입력 행 삭제">×</button>
    `;
    wrap.appendChild(row);
    enhanceNativeSelects(row);
    const syncRowUnitLabels = () => {
      const labels = getUnitLabels(row.querySelector(".moveSku")?.value);
      const palletLabel = row.querySelector(".unit-label-pallet");
      const boxLabel = row.querySelector(".unit-label-box");
      const eachLabel = row.querySelector(".unit-label-each");
      if (palletLabel) palletLabel.textContent = labels.pallet;
      if (boxLabel) boxLabel.textContent = labels.box;
      if (eachLabel) eachLabel.textContent = labels.each;
    };
    syncRowUnitLabels();
    row.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", updateMoveBatchSummary);
      el.addEventListener("change", () => {
        if (el.classList.contains("moveSku")) {
          syncRowUnitLabels();
          const priceInput = row.querySelector(".moveUnitPrice");
          const nextCost = getSkuCost(el.value);
          if (priceInput) {
            priceInput.value = nextCost || "";
            priceInput.placeholder = nextCost ? `현재 ${money(nextCost)}` : "예: 2200";
          }
        }
        updateMoveBatchSummary();
      });
    });
    row.querySelector(".removeMoveRow")?.addEventListener("click", () => {
      if (wrap.children.length <= 1) {
        row.querySelectorAll("input").forEach((input) => input.value = 0);
      } else {
        row.remove();
      }
      updateMoveBatchSummary();
    });
    updateStockMoveDirectionUi();
  }

  function clearStockMoveRows(options = {}) {
    const { keepDirection = false, keepDate = false } = options;
    const wrap = $("stockMoveRows");
    if (!wrap) return;
    wrap.innerHTML = "";
    addStockMoveRow();
    const memo = $("moveMemo");
    if (memo) memo.value = "";
    const dateInput = $("moveDate");
    if (dateInput && !keepDate) dateInput.value = todayKey();
    if (!keepDirection) {
      const directionInput = $("stockMoveDirection");
      if (directionInput) directionInput.value = "in";
    }
    updateStockMoveDirectionUi();
  }

  function getStockMoveRows() {
    return [...document.querySelectorAll("#stockMoveRows .move-row")].map((row) => {
      const sku = row.querySelector(".moveSku")?.value || "";
      const priceValue = row.querySelector(".moveUnitPrice")?.value?.trim() ?? "";
      const input = {
        pallets: cleanNumber(row.querySelector(".movePallets")?.value),
        boxes: cleanNumber(row.querySelector(".moveBoxes")?.value),
        eaches: cleanNumber(row.querySelector(".moveEaches")?.value)
      };
      return { sku, input, units: sku ? unitsFromInput(sku, input) : 0, unitPriceRaw: priceValue, unitPrice: priceValue === "" ? null : cleanNumber(priceValue) };
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
    const direction = getStockMoveDirection();
    const actionLabel = direction === "out" ? "직접 출고 예정" : "입고 예정";
    const assetValue = calcMovementAssetValue(rows.map((row) => ({ sku: row.sku, units: row.units })), { includeBoxes: true });
    summary.innerHTML = `${actionLabel} <strong>${number(rows.length)}개 품목</strong> · 파렛 <strong>${number(inputTotals.pallets)}</strong> · 박스/묶음 <strong>${number(inputTotals.boxes)}</strong> · 낱개 <strong>${number(inputTotals.eaches)}</strong> · 총 환산 <strong>${number(inputTotals.units)}개</strong> · 재고자산 ${direction === "out" ? "차감" : "증가"} 예상 <strong>${money(assetValue)}</strong>`;
  }

  function normalizeInventorySearchText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\s()\[\]{}·._\-/]+/g, "");
  }

  function updateInventorySearchUi(rawKeyword, matchedCount, totalCount) {
    const clearBtn = $("inventorySearchClear");
    if (clearBtn) clearBtn.hidden = !String(rawKeyword || "").trim();
    const meta = $("inventorySearchMeta");
    if (!meta) return;
    if (!String(rawKeyword || "").trim()) {
      meta.textContent = `전체 ${number(totalCount)}개 품목`;
      return;
    }
    meta.textContent = `검색 결과 ${number(matchedCount)}개 / 전체 ${number(totalCount)}개`;
  }

  function renderInventory() {
    const tbody = $("inventoryTable");
    if (!tbody) return;
    const rawKeyword = ($("inventorySearch")?.value || "").trim();
    const keyword = normalizeInventorySearchText(rawKeyword);
    const allSkus = Object.keys(INVENTORY_DEFS);
    const matchedSkus = allSkus
      .filter((sku) => {
        if (!keyword) return true;
        const def = INVENTORY_DEFS[sku] || {};
        const searchable = [sku, def.group]
          .filter(Boolean)
          .map(normalizeInventorySearchText);
        return searchable.some((text) => text.includes(keyword));
      });
    updateInventorySearchUi(rawKeyword, matchedSkus.length, allSkus.length);

    matchedSkus.sort((a, b) => {
      const aLow = safetyStatus(a, state.stock[a]?.units || 0)?.isLow ? 1 : 0;
      const bLow = safetyStatus(b, state.stock[b]?.units || 0)?.isLow ? 1 : 0;
      return bLow - aLow;
    });

    const rows = matchedSkus.map((sku) => {
        const def = INVENTORY_DEFS[sku];
        const item = state.stock[sku] || { units: 0 };
        const unitCost = getSkuCost(sku);
        const asset = Number.isFinite(unitCost) ? item.units * unitCost : null;
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
      const unitCost = getSkuCost(sku);
      if (Number.isFinite(unitCost)) asset += units * unitCost;
      else unknown += 1;
    });
    return { asset, unknown };
  }

  function calcMovementAssetValue(list = [], options = {}) {
    const { includeBoxes = false } = options;
    return list.reduce((sum, { sku, units }) => {
      sku = canonicalSku(sku);
      const def = INVENTORY_DEFS[sku];
      if (!def) return sum;
      if (def.isBox && !includeBoxes) return sum;
      const unitCost = getSkuCost(sku);
      if (!Number.isFinite(unitCost)) return sum;
      return sum + (Number(units) || 0) * unitCost;
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

  function buildSkuOrderRankSummary() {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = addDays(todayStart, 1);
    const weekStart = addDays(todayStart, -6);
    const monthStart = addDays(todayStart, -29);
    const itemsBySku = new Map(
      Object.keys(INVENTORY_DEFS)
        .filter((sku) => !INVENTORY_DEFS[sku]?.isBox)
        .map((sku) => [sku, { sku, today: 0, week: 0, month: 0 }])
    );

    (state.history || []).forEach((record) => {
      const at = new Date(record.at);
      if (Number.isNaN(at.getTime()) || at < monthStart || at >= tomorrowStart) return;
      const details = Array.isArray(record.details) ? record.details : [];
      details.forEach((detail) => {
        const sku = detail?.sku;
        const def = INVENTORY_DEFS[sku];
        if (!sku || !def || def.isBox) return;
        if (detail.direction && detail.direction !== "out") return;
        if (record.source === STOCK_MOVE_SOURCES.manualOutbound || detail.source === STOCK_MOVE_SOURCES.manualOutbound) return;
        const rawCount = cleanNumber(detail.orderCount ?? detail.orders ?? detail.orderRows ?? 0);
        const orderCount = rawCount > 0 ? rawCount : 1;
        const item = itemsBySku.get(sku) || { sku, today: 0, week: 0, month: 0 };
        item.month += orderCount;
        if (at >= weekStart) item.week += orderCount;
        if (at >= todayStart) item.today += orderCount;
        itemsBySku.set(sku, item);
      });
    });

    const activeItems = [...itemsBySku.values()].filter((item) => item.month > 0);
    const byHigh = [...activeItems].sort((a, b) =>
      b.month - a.month || b.week - a.week || b.today - a.today || a.sku.localeCompare(b.sku, "ko-KR")
    );
    const byLow = [...activeItems].sort((a, b) =>
      a.month - b.month || a.week - b.week || a.today - b.today || a.sku.localeCompare(b.sku, "ko-KR")
    );

    return {
      top: byHigh.slice(0, 3),
      low: byLow.slice(0, 3),
      totalActive: activeItems.length,
      startLabel: dateKey(monthStart),
      endLabel: dateKey(todayStart)
    };
  }

  function renderSkuOrderRankSummary() {
    const topList = $("skuOrderTopList");
    const lowList = $("skuOrderLowList");
    if (!topList || !lowList) return;

    const summary = buildSkuOrderRankSummary();
    setText("skuOrderRankBasis", summary.totalActive
      ? `${summary.startLabel} ~ ${summary.endLabel} 주문처리 기록 기준 · 오늘/7일/30일 주문건수 표시`
      : "아직 품목별 주문처리 기록이 없습니다. 엑셀 주문 차감 적용 후 자동 집계됩니다."
    );

    const renderRows = (items, type) => {
      if (!items.length) {
        return `<div class="sku-rank-empty">표시할 주문 기록이 없습니다.</div>`;
      }
      return items.map((item, index) => `
        <div class="sku-rank-row ${type}">
          <span class="sku-rank-no">${index + 1}</span>
          <div class="sku-rank-main">
            <strong>${escapeHtml(item.sku)}</strong>
            <div class="sku-rank-counts" aria-label="${escapeHtml(item.sku)} 주문건수">
              <span><b>${number(item.today)}건</b><small>하루</small></span>
              <span><b>${number(item.week)}건</b><small>7일</small></span>
              <span><b>${number(item.month)}건</b><small>30일</small></span>
            </div>
          </div>
        </div>`).join("");
    };

    topList.innerHTML = renderRows(summary.top, "top");
    lowList.innerHTML = renderRows(summary.low, "low");
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
      ? { top: 36, right: 18, bottom: 60, left: 44 }
      : { top: 38, right: 28, bottom: 58, left: 56 };
    const width = cssWidth - pad.left - pad.right;
    const height = cssHeight - pad.top - pad.bottom;
    const maxValue = Math.max(1, ...points.map((point) => point.value));
    const yMax = Math.max(5, Math.ceil(maxValue / 5) * 5);

    const gridColor = "rgba(15, 23, 42, 0.10)";
    const axisTextColor = "rgba(51, 65, 85, 0.88)";
    const mainLineColor = "rgba(148, 27, 29, 0.92)";
    const pointFillColor = "#ffffff";
    const pointStrokeColor = "rgba(148, 27, 29, 0.86)";
    const labelBgColor = "rgba(255, 255, 255, 0.92)";
    const labelBorderColor = "rgba(15, 23, 42, 0.12)";
    const labelTextColor = "#020617";

    ctx.font = "700 12px Pretendard, system-ui, sans-serif";
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = axisTextColor;
    ctx.textAlign = "left";
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + height * (i / 4);
      const value = Math.round(yMax * (1 - i / 4));
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(cssWidth - pad.right, y);
      ctx.stroke();
      ctx.fillText(number(value), 10, y + 4);
    }

    const coords = points.map((point, index) => {
      const x = points.length === 1 ? pad.left + width / 2 : pad.left + width * (index / (points.length - 1));
      const y = pad.top + height - (point.value / yMax) * height;
      return { ...point, x, y };
    });

    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + height);
    gradient.addColorStop(0, "rgba(148, 27, 29, 0.16)");
    gradient.addColorStop(0.58, "rgba(37, 99, 235, 0.07)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.02)");
    ctx.beginPath();
    coords.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    if (coords.length) {
      ctx.lineTo(coords[coords.length - 1].x, pad.top + height);
      ctx.lineTo(coords[0].x, pad.top + height);
    }
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
    ctx.strokeStyle = mainLineColor;
    ctx.stroke();

    function roundedRect(x, y, w, h, r) {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }

    coords.forEach((point, index) => {
      ctx.beginPath();
      ctx.fillStyle = pointFillColor;
      ctx.strokeStyle = pointStrokeColor;
      ctx.lineWidth = 2;
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.font = "800 12px Pretendard, system-ui, sans-serif";
      ctx.textAlign = "center";
      const valueText = number(point.value);
      const labelWidth = Math.max(28, ctx.measureText(valueText).width + 14);
      const labelHeight = 20;
      const stagger = isNarrowChart ? (index % 2 ? 20 : 10) : 12;
      const labelX = Math.min(Math.max(point.x - labelWidth / 2, 4), cssWidth - labelWidth - 4);
      const labelY = Math.max(8, point.y - labelHeight - stagger);
      roundedRect(labelX, labelY, labelWidth, labelHeight, 9);
      ctx.fillStyle = labelBgColor;
      ctx.fill();
      ctx.strokeStyle = labelBorderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = labelTextColor;
      ctx.fillText(valueText, labelX + labelWidth / 2, labelY + 14);
    });

    ctx.textAlign = "center";
    ctx.fillStyle = axisTextColor;
    ctx.font = "800 12px Pretendard, system-ui, sans-serif";
    const labelStep = points.length > 14 ? Math.ceil(points.length / (isNarrowChart ? 6 : 10)) : (isNarrowChart && points.length > 7 ? 2 : 1);
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

  function getArchivedOrderYearTotals() {
    return Object.entries(state.orderYearArchives || {})
      .map(([year, value]) => ({ year, value: cleanNumber(value) }))
      .filter((item) => item.value > 0)
      .sort((a, b) => Number(b.year) - Number(a.year));
  }

  function getCumulativeMonthlySections() {
    const years = new Map();
    orderStatRows().forEach((item) => {
      const year = String(item.at.getFullYear());
      const month = item.at.getMonth() + 1;
      if (!years.has(year)) years.set(year, new Map());
      const months = years.get(year);
      months.set(month, (months.get(month) || 0) + item.orderRows);
    });

    return [...years.entries()]
      .map(([year, months]) => {
        const rows = [...months.entries()]
          .map(([month, value]) => ({ month, value: cleanNumber(value) }))
          .filter((item) => item.value > 0)
          .sort((a, b) => a.month - b.month);
        return {
          year,
          total: rows.reduce((sum, item) => sum + item.value, 0),
          months: rows
        };
      })
      .filter((section) => section.total > 0)
      .sort((a, b) => Number(b.year) - Number(a.year));
  }

  function getCumulativeOrderTotal() {
    return getCumulativeYearTotals().reduce((sum, item) => sum + item.value, 0);
  }

  function openCumulativeSales() {
    const overlay = $("cumulativeOverlay");
    const body = $("cumulativeBody");
    if (!overlay || !body) return;
    const yearRows = getCumulativeYearTotals();
    const monthSections = getCumulativeMonthlySections();
    const archivedRows = getArchivedOrderYearTotals();
    const total = yearRows.reduce((sum, item) => sum + item.value, 0);
    const monthlyTotal = monthSections.reduce((sum, section) => sum + section.total, 0);
    const archivedTotal = archivedRows.reduce((sum, item) => sum + item.value, 0);
    const maxYear = Math.max(1, ...yearRows.map((item) => item.value));
    const maxMonth = Math.max(1, ...monthSections.flatMap((section) => section.months.map((item) => item.value)));
    const archivedText = archivedTotal > 0 ? ` · 보관 연도별 ${number(archivedTotal)}건은 월별 세부 확인 필요` : "";
    setText("cumulativeTitle", "월별 총 주문건수");
    setText("cumulativeMeta", `전체 누적 ${number(total)}건 · 월별 표시 ${number(monthlyTotal)}건${archivedText}`);

    const monthlyHtml = monthSections.length
      ? monthSections.map((section) => `
        <div class="monthly-total-year">
          <div class="monthly-total-head">
            <strong>${escapeHtml(section.year)}년</strong>
            <span>소계 ${number(section.total)}건</span>
          </div>
          <div class="monthly-total-list">
            ${section.months.map((item) => `
              <div class="month-total-line">
                <strong>${escapeHtml(section.year)}년 ${number(item.month)}월</strong>
                <span>${number(item.value)}건</span>
                <div class="year-total-bar" aria-hidden="true"><i style="width:${Math.max(6, Math.round((item.value / maxMonth) * 100))}%"></i></div>
              </div>`).join("")}
          </div>
        </div>`).join("")
      : `<div class="detail-empty">월별 주문 데이터가 없습니다.</div>`;

    const yearlyHtml = yearRows.length
      ? yearRows.map((item) => `
        <div class="year-total-line">
          <strong>${escapeHtml(item.year)}년</strong>
          <span>${number(item.value)}건</span>
          <div class="year-total-bar" aria-hidden="true"><i style="width:${Math.max(6, Math.round((item.value / maxYear) * 100))}%"></i></div>
        </div>`).join("")
      : `<div class="detail-empty">아직 누적 판매량으로 표시할 주문 처리 기록이 없습니다.</div>`;

    body.innerHTML = yearRows.length
      ? `
        <div class="cumulative-section">
          <div class="cumulative-section-head">
            <strong>월별 총 주문건수</strong>
            <span>엑셀 주문처리 행 기준</span>
          </div>
          ${monthlyHtml}
        </div>
        ${archivedRows.length ? `<div class="cumulative-note">1년이 지난 주문 기록은 기존 구조상 연도별 합계만 보관되어 월별 세부 데이터는 확인 필요입니다.</div>` : ""}
        <div class="cumulative-section">
          <div class="cumulative-section-head">
            <strong>연도별 합계</strong>
            <span>전체 누적 ${number(total)}건</span>
          </div>
          ${yearlyHtml}
        </div>`
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

  function isReturnAdjustmentHistory(item) {
    return item?.type === "취소/반품" || item?.source === "returnAdjustment";
  }

  function isInternalAdminHistory(item) {
    return isReturnAdjustmentHistory(item) || item?.type === "직접출고" || item?.source === STOCK_MOVE_SOURCES.manualOutbound;
  }

  function getVisibleHistoryItems() {
    const items = state.history || [];
    return isEditorSession() ? items : items.filter((item) => !isInternalAdminHistory(item));
  }

  function getVisibleHistoryRecordItems() {
    return getVisibleHistoryItems().map((record, index) => ({
      record,
      key: record?.id || `idx-${index}`
    }));
  }

  function getHistoryDateKey(record) {
    const date = new Date(record?.at || "");
    if (Number.isNaN(date.getTime())) return "";
    return dateKey(date);
  }

  function shiftDateKeyByDays(dayKey, days) {
    const [year, month, day] = String(dayKey || "").split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return "";
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return dateKey(date);
  }

  function shiftDateKeyByMonths(dayKey, months) {
    const [year, month, day] = String(dayKey || "").split("-").map(Number);
    if (![year, month, day].every(Number.isFinite)) return "";
    const targetMonthIndex = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  }

  function getDailyFlowPeriodBounds(period = dailyFlowPeriod) {
    const endKey = todayKey();
    const startKey = period === "week"
      ? shiftDateKeyByDays(endKey, -6)
      : shiftDateKeyByMonths(endKey, period === "quarter" ? -3 : -1);
    return { startKey, endKey };
  }

  function isHistoryRecordInDailyFlowPeriod(record) {
    const dayKey = getHistoryDateKey(record);
    const { startKey, endKey } = getDailyFlowPeriodBounds();
    return Boolean(dayKey && startKey && dayKey >= startKey && dayKey <= endKey);
  }

  function getDailyFlowFilteredRecordItems() {
    return getVisibleHistoryRecordItems().filter(({ record }) =>
      isHistoryRecordInDailyFlowPeriod(record) && matchesDailyFlowFilter(record)
    ).sort((a, b) => new Date(b.record?.at || 0) - new Date(a.record?.at || 0));
  }

  function getDailyFlowPeriodLabel(period = dailyFlowPeriod) {
    return ({ week: "최근 7일", month: "최근 1개월", quarter: "최근 3개월" })[period] || "최근 1개월";
  }

  function renderDailyFlowRangeInfo(filteredRecordItems = getDailyFlowFilteredRecordItems()) {
    const info = $("dailyFlowRangeInfo");
    if (!info) return;
    const dayKeys = getVisibleHistoryItems().map(getHistoryDateKey).filter(Boolean).sort();
    if (!dayKeys.length) {
      info.textContent = "저장된 입출고 기록이 없습니다.";
      return;
    }
    const { startKey, endKey } = getDailyFlowPeriodBounds();
    info.textContent = `저장된 기록 범위: ${dayKeys[0]} ~ ${dayKeys[dayKeys.length - 1]} · ${getDailyFlowPeriodLabel()} ${number(filteredRecordItems.length)}건 · 조회 범위 ${startKey} ~ ${endKey}`;
  }

  function createDailyFlowBucket(dayKey) {
    return {
      date: dayKey,
      records: [],
      recordItems: [],
      missingRecords: [],
      totals: { inbound: 0, outbound: 0, excel: 0, returnIn: 0, returnOut: 0 },
      entries: { inbound: [], outbound: [], excel: [], returnIn: [], returnOut: [], returnHold: [], unknown: [] },
      products: new Map()
    };
  }

  function classifyFlowDetail(record, detail) {
    const source = String(detail?.source || record?.source || "");
    const direction = String(detail?.direction || "").toLowerCase();
    if (source === "returnAdjustment" || isReturnAdjustmentHistory(record)) {
      if (direction === "in") return "returnIn";
      if (direction === "out") return "returnOut";
      if (direction === "hold") return "returnHold";
      return "unknown";
    }
    if (source === "excelOrderDeduction") return "excel";
    if (source === STOCK_MOVE_SOURCES.manualInbound || direction === "in") return "inbound";
    if (source === STOCK_MOVE_SOURCES.manualOutbound || direction === "out") return "outbound";
    return "unknown";
  }

  function getFlowKindLabel(kind) {
    return ({
      inbound: "입고",
      outbound: "출고",
      excel: "엑셀 차감",
      returnIn: "반품/취소 복구",
      returnOut: "반품/취소 차감",
      returnHold: "반품/취소 기록",
      unknown: "상세 데이터 없음"
    })[kind] || "상세 데이터 없음";
  }

  function getFlowKindClass(kind) {
    return ({
      inbound: "inbound",
      outbound: "outbound",
      excel: "excel",
      returnIn: "return",
      returnOut: "return",
      returnHold: "return",
      unknown: "unknown"
    })[kind] || "unknown";
  }

  function getDailyFlowProduct(bucket, sku) {
    const key = canonicalSku(sku || "");
    if (!key) return null;
    if (!bucket.products.has(key)) {
      bucket.products.set(key, { sku: key, inbound: 0, outbound: 0, excel: 0, returnIn: 0, returnOut: 0 });
    }
    return bucket.products.get(key);
  }

  function addDailyFlowEntry(bucket, record, detail) {
    const units = Math.max(0, Math.round(cleanNumber(detail?.units)));
    const sku = canonicalSku(detail?.sku || "");
    const kind = classifyFlowDetail(record, detail);
    const entry = {
      kind,
      sku,
      units,
      at: record?.at || "",
      type: record?.type || "",
      memo: record?.memo || "",
      qtyText: record?.qtyText || "",
      text: detail?.text || (sku ? formatMovementDetail(sku, units, detail?.direction || "out") : "")
    };
    bucket.entries[kind] = bucket.entries[kind] || [];
    bucket.entries[kind].push(entry);

    if (["inbound", "outbound", "excel", "returnIn", "returnOut"].includes(kind)) {
      bucket.totals[kind] += units;
    }

    const product = getDailyFlowProduct(bucket, sku);
    if (product && ["inbound", "outbound", "excel", "returnIn", "returnOut"].includes(kind)) {
      product[kind] += units;
    }
  }

  function buildDailyFlowBuckets(recordItems = getVisibleHistoryRecordItems()) {
    const buckets = new Map();
    recordItems.forEach((recordItem, historyIndex) => {
      const record = recordItem?.record || recordItem;
      const recordKey = recordItem?.key || record?.id || `idx-${historyIndex}`;
      const dayKey = getHistoryDateKey(record);
      if (!dayKey) return;
      if (!buckets.has(dayKey)) buckets.set(dayKey, createDailyFlowBucket(dayKey));
      const bucket = buckets.get(dayKey);
      bucket.records.push(record);
      bucket.recordItems.push({ record, key: recordKey });
      const details = Array.isArray(record.details) ? record.details.filter(Boolean) : [];
      if (!details.length) {
        bucket.missingRecords.push(record);
        return;
      }
      details.forEach((detail) => addDailyFlowEntry(bucket, record, detail));
    });
    return Array.from(buckets.values()).sort((a, b) => b.date.localeCompare(a.date));
  }

  function findDailyFlowBucket(dayKey) {
    return buildDailyFlowBuckets().find((bucket) => bucket.date === dayKey) || null;
  }

  function calculateDailyFlowNet(bucket) {
    if (!bucket) return 0;
    return bucket.totals.inbound + bucket.totals.returnIn - bucket.totals.outbound - bucket.totals.excel - bucket.totals.returnOut;
  }

  function formatDailyFlowUnits(sku, units) {
    const safeUnits = Math.max(0, Math.round(cleanNumber(units)));
    if (sku && INVENTORY_DEFS[canonicalSku(sku)]) {
      return `${number(safeUnits)}개 · ${formatStock(sku, safeUnits)}`;
    }
    return `${number(safeUnits)}개`;
  }

  function hasFlowDetailUnits(units) {
    const value = cleanNumber(units);
    return Number.isFinite(value) && value > 0;
  }

  function getFlowKindQuantityLabel(kind) {
    return ({
      inbound: "입고 수량",
      outbound: "출고 수량",
      excel: "엑셀 차감 수량",
      returnIn: "반품/취소 복구 수량",
      returnOut: "반품/취소 차감 수량",
      returnHold: "수량",
      unknown: "수량"
    })[kind] || "수량";
  }

  function getMovementDetailQuantityLabel(detail) {
    const source = String(detail?.source || "");
    const direction = String(detail?.direction || "").toLowerCase();
    if (source === "excelOrderDeduction") return "엑셀 차감 수량";
    if (direction === "in") return "입고 수량";
    if (direction === "out") return "출고 수량";
    return "수량";
  }

  function formatFlowDetailQuantityText(sku, units) {
    if (!hasFlowDetailUnits(units)) return "수량 상세 없음";
    return formatDailyFlowUnits(sku || "", units);
  }

  function renderHistoryDetailQuantity(detail) {
    const text = hasFlowDetailUnits(detail?.units)
      ? `${getMovementDetailQuantityLabel(detail)}: ${formatFlowDetailQuantityText(detail?.sku, detail.units)}`
      : "수량 상세 없음";
    const className = hasFlowDetailUnits(detail?.units) ? "flow-detail-quantity" : "flow-detail-quantity is-empty";
    return `<em class="${className}">${escapeHtml(text)}</em>`;
  }

  function formatSignedFlowUnits(units) {
    const value = Math.round(cleanNumber(units));
    const sign = value > 0 ? "+" : "";
    return `${sign}${number(value)}개`;
  }

  function getDailyFlowRecordKinds(record) {
    const kinds = new Set();
    const details = Array.isArray(record?.details) ? record.details.filter(Boolean) : [];
    details.forEach((detail) => kinds.add(classifyFlowDetail(record, detail)));
    if (!kinds.size) kinds.add("unknown");
    return kinds;
  }

  function matchesDailyFlowFilter(record) {
    if (dailyFlowFilter === "all") return true;
    return getDailyFlowRecordKinds(record).has(dailyFlowFilter);
  }

  function getDailyFlowRecordPrimaryKind(record) {
    const kinds = getDailyFlowRecordKinds(record);
    return ["inbound", "outbound", "excel", "returnIn", "returnOut", "returnHold", "unknown"]
      .find((kind) => kinds.has(kind)) || "unknown";
  }

  function countDailyFlowRecords(bucket, kinds) {
    const acceptedKinds = new Set(kinds);
    return (bucket?.recordItems || []).filter(({ record }) =>
      [...getDailyFlowRecordKinds(record)].some((kind) => acceptedKinds.has(kind))
    ).length;
  }

  function formatDailyFlowTime(value) {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "시간 정보 없음";
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function renderDailyFlowRecordDetail(record, detail) {
    const kind = classifyFlowDetail(record, detail);
    const sku = canonicalSku(detail?.sku || "");
    const quantityText = sku && hasFlowDetailUnits(detail?.units)
      ? `${getFlowKindQuantityLabel(kind)}: ${formatDailyFlowUnits(sku, detail.units)}`
      : "수량 상세 없음";
    return `
      <span class="daily-flow-record-product">
        <strong>${escapeHtml(sku || "품목 상세 없음")}</strong>
        <span class="${hasFlowDetailUnits(detail?.units) ? "" : "is-empty"}">${escapeHtml(quantityText)}</span>
      </span>`;
  }

  function renderDailyFlowRecordItem(recordItem) {
    const record = recordItem?.record;
    if (!record) return "";
    const kind = getDailyFlowRecordPrimaryKind(record);
    const details = Array.isArray(record.details) ? record.details.filter(Boolean) : [];
    return `
      <button type="button" class="daily-flow-record ${getFlowKindClass(kind)}" data-history-key="${escapeHtml(recordItem.key)}" aria-label="${escapeHtml(formatDateTime(record.at))} ${escapeHtml(record.type || getFlowKindLabel(kind))} 상세 보기">
        <span class="daily-flow-record-head">
          <b>${escapeHtml(formatDailyFlowTime(record.at))}</b>
          <em>${escapeHtml(record.type || getFlowKindLabel(kind))}</em>
        </span>
        <span class="daily-flow-record-products">
          ${details.length
            ? details.map((detail) => renderDailyFlowRecordDetail(record, detail)).join("")
            : `<span class="daily-flow-record-empty">${escapeHtml(record.qtyText || "수량 상세 없음")}</span>`}
        </span>
        ${record.memo ? `<small title="${escapeHtml(record.memo)}">${escapeHtml(record.memo)}</small>` : ""}
        <span class="daily-flow-record-open">상세 보기</span>
      </button>`;
  }

  function renderDailyFlowGroup(bucket) {
    const recordItems = (bucket.recordItems || [])
      .filter(({ record }) => matchesDailyFlowFilter(record))
      .sort((a, b) => new Date(b.record?.at || 0) - new Date(a.record?.at || 0));
    if (!recordItems.length) return "";
    const isExpanded = expandedDailyFlowDates.has(bucket.date);
    const bodyId = `daily-flow-body-${bucket.date}`;
    const net = calculateDailyFlowNet(bucket);
    const inboundCount = countDailyFlowRecords(bucket, ["inbound", "returnIn"]);
    const outboundCount = countDailyFlowRecords(bucket, ["outbound", "returnOut"]);
    const excelCount = countDailyFlowRecords(bucket, ["excel"]);
    return `
      <section class="daily-flow-group${isExpanded ? " is-open" : ""}" data-flow-date="${escapeHtml(bucket.date)}">
        <button type="button" class="daily-flow-group-toggle" data-flow-toggle-date="${escapeHtml(bucket.date)}" aria-expanded="${isExpanded ? "true" : "false"}" aria-controls="${bodyId}">
          <span class="daily-flow-date-block">
            <strong>${escapeHtml(bucket.date)}</strong>
            <small>총 ${number(bucket.records.length)}건</small>
          </span>
          <span class="daily-flow-pills">
            <b class="flow-pill inbound">입고 ${number(inboundCount)}건 · ${number(bucket.totals.inbound + bucket.totals.returnIn)}개</b>
            <b class="flow-pill outbound">출고 ${number(outboundCount)}건 · ${number(bucket.totals.outbound + bucket.totals.returnOut)}개</b>
            <b class="flow-pill excel">엑셀 ${number(excelCount)}건 · ${number(bucket.totals.excel)}개</b>
            <b class="flow-pill net ${net >= 0 ? "positive" : "negative"}">순변동 ${escapeHtml(formatSignedFlowUnits(net))}</b>
          </span>
          <span class="daily-flow-chevron" aria-hidden="true">⌄</span>
        </button>
        <div id="${bodyId}" class="daily-flow-group-body"${isExpanded ? "" : " hidden"}>
          <div class="daily-flow-record-list">${recordItems.map(renderDailyFlowRecordItem).join("")}</div>
          <button type="button" class="daily-flow-date-detail" data-flow-detail-date="${escapeHtml(bucket.date)}">${escapeHtml(bucket.date)} 전체 상세 보기</button>
        </div>
      </section>`;
  }

  function renderDailyFlowList() {
    const list = $("dailyFlowList");
    if (!list) return;
    const filteredRecordItems = getDailyFlowFilteredRecordItems();
    const allBuckets = buildDailyFlowBuckets(filteredRecordItems);
    const buckets = allBuckets.slice(0, dailyFlowVisibleDateCount);
    if (!allBuckets.length) {
      list.innerHTML = `<div class="daily-flow-empty">선택한 기간과 종류에 해당하는 입출고 기록이 없습니다.</div>`;
    } else {
      list.innerHTML = buckets.map(renderDailyFlowGroup).join("");
    }
    document.querySelectorAll("[data-flow-period]").forEach((button) => {
      const selected = button.dataset.flowPeriod === dailyFlowPeriod;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    document.querySelectorAll("[data-flow-filter]").forEach((button) => {
      const selected = button.dataset.flowFilter === dailyFlowFilter;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
    renderDailyFlowRangeInfo(filteredRecordItems);
    const loadMoreButton = $("dailyFlowLoadMore");
    if (loadMoreButton) {
      const remaining = Math.max(0, allBuckets.length - buckets.length);
      loadMoreButton.hidden = remaining === 0;
      loadMoreButton.textContent = remaining ? `이전 날짜 더 보기 (${number(remaining)}일)` : "";
    }
  }

  function renderHistory() {
    const tbody = $("historyTable");
    if (!tbody) return;
    renderDailyFlowList();
    const historyRecordItems = getDailyFlowFilteredRecordItems();
    const visibleRecordItems = historyRecordItems.slice(0, historyVisibleRecordCount);
    const rows = visibleRecordItems.map(({ record: item, key }) => {
      const dayKey = getHistoryDateKey(item);
      return `
        <tr class="history-row" data-history-key="${escapeHtml(key)}" data-flow-date="${escapeHtml(dayKey)}">
          <td>${escapeHtml(formatDateTime(item.at))}</td>
          <td>${escapeHtml(item.type || "기록")}</td>
          <td><button type="button" class="history-detail-trigger" data-history-key="${escapeHtml(key)}">${escapeHtml(item.memo || "상세내용")}</button></td>
          <td>${escapeHtml(item.qtyText || "")}</td>
        </tr>`;
    }).join("");
    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">선택한 기간과 종류에 해당하는 원본 기록이 없습니다.</td></tr>`;
    setText("historyArchiveSummaryCount", `선택 기간 ${number(historyRecordItems.length)}건`);
    const loadMoreButton = $("historyLoadMore");
    if (loadMoreButton) {
      const remaining = Math.max(0, historyRecordItems.length - visibleRecordItems.length);
      loadMoreButton.hidden = remaining === 0;
      loadMoreButton.textContent = remaining ? `원본 기록 더 보기 (${number(remaining)}건)` : "";
    }
  }

  function renderBackups() {
    const list = $("backupList");
    if (!list) return;
    const backups = loadBackups().slice(0, 6);
    list.innerHTML = backups.map((backup) => `<li>${escapeHtml(formatDateTime(backup.at))} · ${escapeHtml(backup.reason || "저장")}</li>`).join("") || `<li>아직 백업이 없습니다.</li>`;
    renderOneStepUndoStatus();
  }

  function bindWmsEvents() {

    document.querySelectorAll("[data-purchase-view-mode]").forEach((button) => {
      button.addEventListener("click", () => setPurchaseViewMode(button.dataset.purchaseViewMode));
    });

    $("purchaseAddRowBtn")?.addEventListener("click", addPurchaseDraftRow);
    $("purchaseDraftRows")?.addEventListener("change", (event) => {
      const target = event.target.closest("[data-purchase-draft-field]");
      if (!target) return;
      const row = target.closest("[data-purchase-draft-id]");
      if (!row) return;
      if (target.dataset.purchaseDraftField === "productKey") syncPurchaseFormFromProduct(row.dataset.purchaseDraftId, target.value);
    });
    $("purchaseDraftRows")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-purchase-draft-remove]");
      if (!button) return;
      removePurchaseDraftRow(button.dataset.purchaseDraftRemove);
    });
    $("purchaseAddBtn")?.addEventListener("click", addPurchaseItemFromForm);
    $("returnAdjustmentSku")?.addEventListener("change", refreshReturnAdjustmentUnitOptions);
    $("returnAdjustmentCard")?.addEventListener("click", (event) => {
      const button = event.target.closest("#returnAdjustmentProcessBtn");
      if (!button) return;
      handleReturnAdjustmentProcessClick(event);
    });
    $("purchaseList")?.addEventListener("click", (event) => {
      const completeStart = event.target.closest("[data-purchase-complete-start]");
      if (completeStart) {
        event.preventDefault();
        event.stopPropagation();
        startPurchaseComplete(completeStart.dataset.purchaseCompleteStart || "");
        return;
      }
      const completeSave = event.target.closest("[data-purchase-complete-save]");
      if (completeSave) {
        event.preventDefault();
        event.stopPropagation();
        completePurchaseGroup(completeSave.dataset.purchaseCompleteSave || "");
        return;
      }
      const completeCancel = event.target.closest("[data-purchase-complete-cancel]");
      if (completeCancel) {
        event.preventDefault();
        event.stopPropagation();
        cancelPurchaseComplete();
        return;
      }
      if (event.target.closest("[data-purchase-complete-form], .purchase-complete-action-row")) {
        event.stopPropagation();
        return;
      }
      const target = event.target.closest("[data-purchase-action]");
      if (!target) return;
      if (target.dataset.purchaseAction === "remove") removePurchaseItem(target.dataset.purchaseId);
    });
    $("purchaseList")?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.matches('[data-purchase-complete-field="paymentAmount"]')) {
        target.value = normalizePurchaseCompleteAmountInput(target.value);
        clearPurchaseCompleteValidationMessage(target.closest("[data-purchase-complete-form]"));
      } else if (target.matches('[data-purchase-complete-field="inboundDate"], [data-purchase-complete-field="paymentDate"]')) {
        clearPurchaseCompleteValidationMessage(target.closest("[data-purchase-complete-form]"));
      }
    });
    $("purchaseList")?.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-purchase-complete-form]");
      if (!form) return;
      event.preventDefault();
      event.stopPropagation();
      completePurchaseGroup(form.dataset.purchaseCompleteForm || "");
    });
    document.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-purchase-completed-remove]");
      if (removeButton) {
        event.preventDefault();
        removePurchaseCompletedRecord(removeButton.dataset.purchaseCompletedRemove || "");
        return;
      }
      const clearButton = event.target.closest("[data-purchase-completed-clear]");
      if (clearButton) {
        event.preventDefault();
        clearPurchaseCompletedRecords();
        return;
      }
      const downloadButton = event.target.closest("[data-purchase-completed-download]");
      if (!downloadButton) return;
      event.preventDefault();
      downloadPurchaseCompletedCsv();
    });
    $("purchaseList")?.addEventListener("change", (event) => {
      const target = event.target.closest("[data-purchase-action]");
      if (!target) return;
      const action = target.dataset.purchaseAction;
      if (action === "batchName") {
        updatePurchaseBatchName(target.dataset.purchaseBatchId, target.value);
        return;
      }
      if (["orderDate", "qty", "unitPrice", "status", "memo"].includes(action)) updatePurchaseItemField(target.dataset.purchaseId, action, target.value);
    });

    $("productCostSearch")?.addEventListener("input", renderProductCostEditor);
    $("productCostEditorList")?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-product-cost-input]");
      if (!input) return;
      updateProductCost(input.dataset.productCostInput, input.value);
    });
    $("productCostEditorList")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-product-cost-reset]");
      if (!button) return;
      resetProductCost(button.dataset.productCostReset);
    });
    $("inventorySearch")?.addEventListener("input", renderInventory);
    $("inventorySearchClear")?.addEventListener("click", () => {
      const input = $("inventorySearch");
      if (!input) return;
      input.value = "";
      renderInventory();
      input.focus();
    });
    $("orderFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0] || null;
      const fileName = file?.name || "엑셀 파일 선택";
      setText("orderFileName", fileName);
      setExcelFormatWarning(file);
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
    $("stockMoveDirection")?.addEventListener("change", updateStockMoveDirectionUi);
    $("moveDate")?.addEventListener("change", updateMoveBatchSummary);
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
    document.querySelectorAll("[data-flow-period]").forEach((button) => {
      button.addEventListener("click", () => {
        dailyFlowPeriod = ["week", "month", "quarter"].includes(button.dataset.flowPeriod)
          ? button.dataset.flowPeriod
          : "month";
        dailyFlowVisibleDateCount = DAILY_FLOW_PAGE_SIZE;
        historyVisibleRecordCount = HISTORY_PAGE_SIZE;
        expandedDailyFlowDates.clear();
        renderHistory();
      });
    });
    document.querySelectorAll("[data-flow-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        dailyFlowFilter = button.dataset.flowFilter || "all";
        dailyFlowVisibleDateCount = DAILY_FLOW_PAGE_SIZE;
        historyVisibleRecordCount = HISTORY_PAGE_SIZE;
        expandedDailyFlowDates.clear();
        renderHistory();
      });
    });
    $("dailyFlowExpandAll")?.addEventListener("click", () => {
      buildDailyFlowBuckets(getDailyFlowFilteredRecordItems())
        .slice(0, dailyFlowVisibleDateCount)
        .forEach((bucket) => expandedDailyFlowDates.add(bucket.date));
      renderDailyFlowList();
    });
    $("dailyFlowCollapseAll")?.addEventListener("click", () => {
      expandedDailyFlowDates.clear();
      renderDailyFlowList();
    });
    $("dailyFlowLoadMore")?.addEventListener("click", () => {
      dailyFlowVisibleDateCount += DAILY_FLOW_PAGE_SIZE;
      renderDailyFlowList();
    });
    $("historyLoadMore")?.addEventListener("click", () => {
      historyVisibleRecordCount += HISTORY_PAGE_SIZE;
      renderHistory();
    });
    $("dailyFlowList")?.addEventListener("click", (event) => {
      const recordTrigger = event.target.closest("[data-history-key]");
      if (recordTrigger) {
        openHistoryDetail(recordTrigger.dataset.historyKey || "");
        return;
      }
      const detailTrigger = event.target.closest("[data-flow-detail-date]");
      if (detailTrigger) {
        openDailyFlowDetail(detailTrigger.dataset.flowDetailDate || "");
        return;
      }
      const toggle = event.target.closest("[data-flow-toggle-date]");
      if (!toggle) return;
      const dayKey = toggle.dataset.flowToggleDate || "";
      if (expandedDailyFlowDates.has(dayKey)) expandedDailyFlowDates.delete(dayKey);
      else expandedDailyFlowDates.add(dayKey);
      renderDailyFlowList();
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
        closeLaborCostEditor();
      }
    });
    $("copyOutboundDiagnosticsBtn")?.addEventListener("click", copyOutboundTrendDiagnostics);
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
    $("undoLatestInventoryChange")?.addEventListener("click", () => {
      if (!requireEditor("최근 작업 1단계 되돌리기")) return;
      restoreLatestInventoryChange();
    });
    $("resetWms")?.addEventListener("click", () => {
      if (!requireEditor("초기값 복구")) return;
      if (!confirm("WMS 재고를 초기값으로 복구할까요? 현재 브라우저 저장값은 백업 후 초기화됩니다.")) return;
      addBackup("초기화 전 백업");
      const currentLaborCostRecords = normalizeLaborCostRecords(laborCostRecords);
      state = createInitialState();
      state.laborCostRecords = currentLaborCostRecords;
      syncLaborCostRecordsFromState("resetWms preserve labor sync");
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
      chartResizeTimer = setTimeout(() => {
        renderOrderChart();
        refreshInventoryItemOrderTrendIfOpen();
      }, 140);
    });
    document.querySelectorAll(".subtab").forEach((tab) => tab.addEventListener("click", () => switchResultTab(tab.dataset.resultTab)));
  }

  function applyStockMove() {
    if (!requireEditor("입고/직접 출고 처리")) return;

    const direction = getStockMoveDirection();
    const isOutbound = direction === "out";
    const memo = ($("moveMemo")?.value || "").trim();
    const at = buildStockMoveAt($("moveDate")?.value || todayKey());
    const rows = getStockMoveRows().filter((row) => row.sku && INVENTORY_DEFS[row.sku] && row.units > 0);

    if (!rows.length) {
      alert(stockMoveDirectionLabel(direction) + "할 수량을 한 줄 이상 넣어주세요.");
      return;
    }

    const outboundPriceBySku = new Map();
    if (isOutbound) {
      for (const row of rows) {
        const sku = canonicalSku(row.sku);
        const priceInfo = resolveDirectOutboundUnitPrice(row, sku);
        if (!priceInfo.ok) {
          alert(priceInfo.message);
          return;
        }
        const previous = outboundPriceBySku.get(sku) || { value: 0, manual: false };
        previous.value += row.units * priceInfo.unitPrice;
        previous.manual = previous.manual || priceInfo.source === "manual";
        outboundPriceBySku.set(sku, previous);
      }
    }

    addBackup(isOutbound ? "직접 출고 적용 전 자동 백업" : "입고 입력 적용 전 자동 백업");
    const bySku = new Map();
    const changedPrices = [];
    rows.forEach((row) => {
      const sku = canonicalSku(row.sku);
      bySku.set(sku, (bySku.get(sku) || 0) + row.units);
      if (!isOutbound && row.unitPrice !== null && Number.isFinite(row.unitPrice) && row.unitPrice >= 0) {
        const beforePrice = getSkuCost(sku);
        state.productCosts = normalizeProductCosts(state.productCosts);
        state.productCosts[sku] = row.unitPrice;
        if (beforePrice !== row.unitPrice) changedPrices.push(`${sku} ${money(beforePrice)} → ${money(row.unitPrice)}`);
      }
    });

    if (isOutbound && INVENTORY_DEFS[BOX_XL_SKU]) {
      const codiUnits = cleanNumber(bySku.get(CODI_TISSUE_SKU));
      const manualBoxXlUnits = cleanNumber(bySku.get(BOX_XL_SKU));
      const autoBoxXlUnits = Math.max(0, codiTissueBoxXlUnits(CODI_TISSUE_SKU, codiUnits) - manualBoxXlUnits);
      if (autoBoxXlUnits > 0) {
        bySku.set(BOX_XL_SKU, manualBoxXlUnits + autoBoxXlUnits);
        const boxPriceMeta = outboundPriceBySku.get(BOX_XL_SKU) || { value: 0, manual: false };
        boxPriceMeta.value += autoBoxXlUnits * getSkuCost(BOX_XL_SKU);
        outboundPriceBySku.set(BOX_XL_SKU, boxPriceMeta);
      }
      const cookieUnits = cleanNumber(bySku.get(COOKIE_CHOCO_SKU));
      const cookieBoxUsage = getCookieChocoPackagingBoxUsage(COOKIE_CHOCO_SKU, cookieUnits);
      if (cookieBoxUsage) {
        const cookieBoxSku = BOX_SKU_BY_SIZE[cookieBoxUsage.size];
        const manualCookieBoxUnits = cleanNumber(bySku.get(cookieBoxSku));
        const autoCookieBoxUnits = Math.max(0, cookieBoxUsage.units - manualCookieBoxUnits);
        if (autoCookieBoxUnits > 0) {
          bySku.set(cookieBoxSku, manualCookieBoxUnits + autoCookieBoxUnits);
          const cookieBoxPriceMeta = outboundPriceBySku.get(cookieBoxSku) || { value: 0, manual: false };
          cookieBoxPriceMeta.value += autoCookieBoxUnits * getSkuCost(cookieBoxSku);
          outboundPriceBySku.set(cookieBoxSku, cookieBoxPriceMeta);
        }
      }
    }

    [...bySku.entries()].forEach(([sku, units]) => {
      if (!state.stock[sku]) state.stock[sku] = { units: 0 };
      const current = Number(state.stock[sku].units) || 0;
      state.stock[sku].units = isOutbound ? current - units : current + units;
    });

    const detailItems = [...bySku.entries()].map(([sku, units]) => {
      if (!isOutbound) {
        return {
          sku,
          units,
          direction,
          source: STOCK_MOVE_SOURCES.manualInbound,
          orderCount: 0,
          text: formatMovementDetail(sku, units, direction)
        };
      }
      const priceMeta = outboundPriceBySku.get(sku);
      const unitPrice = priceMeta && units > 0 ? Math.round((priceMeta.value / units) * 100) / 100 : getSkuCost(sku);
      const value = priceMeta ? priceMeta.value : calcMovementAssetValue([{ sku, units }]);
      return {
        sku,
        units,
        direction,
        source: STOCK_MOVE_SOURCES.manualOutbound,
        orderCount: 0,
        unitPrice,
        unitPriceSource: priceMeta?.manual ? "manual" : "productCost",
        value,
        autoBoxFor: sku === BOX_XL_SKU && codiTissueBoxXlUnits(CODI_TISSUE_SKU, cleanNumber(bySku.get(CODI_TISSUE_SKU))) > 0
          ? CODI_TISSUE_SKU
          : (getCookieChocoPackagingBoxUsage(COOKIE_CHOCO_SKU, cleanNumber(bySku.get(COOKIE_CHOCO_SKU)))?.size && sku === BOX_SKU_BY_SIZE[getCookieChocoPackagingBoxUsage(COOKIE_CHOCO_SKU, cleanNumber(bySku.get(COOKIE_CHOCO_SKU))).size])
            ? COOKIE_CHOCO_SKU
            : "",
        text: formatMovementDetail(sku, units, direction, { unitPrice, value })
      };
    });

    const totalUnits = detailItems.reduce((sum, item) => sum + item.units, 0);
    const priceMemo = !isOutbound && changedPrices.length ? ` · 단가 변경 ${number(changedPrices.length)}건` : "";
    const type = isOutbound ? "직접출고" : "입고묶음";
    const actionText = isOutbound ? "직접 출고" : "일괄 입고";
    const qtyPrefix = isOutbound ? "-" : "+";
    const source = isOutbound ? STOCK_MOVE_SOURCES.manualOutbound : STOCK_MOVE_SOURCES.manualInbound;
    pushHistory(type, number(detailItems.length) + "개 품목 " + actionText + priceMemo + (memo ? " · " + memo : ""), qtyPrefix + number(totalUnits) + "개", detailItems, { at, source });
    addAdminActionLog(isOutbound ? "직접 출고 입력" : "입고 입력", {
      itemName: detailItems.length === 1 ? detailItems[0].sku : number(detailItems.length) + "개 품목",
      qty: totalUnits,
      unit: "개",
      memo: memo || actionText,
      source,
      details: detailItems
    });
    clearStockMoveRows({ keepDirection: true, keepDate: true });
    saveState(`${number(detailItems.length)}개 품목 ${actionText}`);
  }

  function pushHistory(type, memo, qtyText, details = [], options = {}) {
    state.history = state.history || [];
    const at = options?.at ? String(options.at) : new Date().toISOString();
    const record = {
      id: createHistoryId(),
      at,
      type,
      memo,
      qtyText,
      source: options?.source || "",
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

  function formatMovementDetail(sku, units, direction = "out", options = {}) {
    const action = direction === "in" ? "입고" : "출고";
    const unitPrice = cleanNumber(options?.unitPrice);
    const value = cleanNumber(options?.value) || (unitPrice > 0 ? units * unitPrice : 0);
    const priceText = unitPrice > 0 ? ` · 단가 ${money(unitPrice)} · 금액 ${money(value)}` : "";
    return `${formatStock(sku, units)} ${action}${priceText}`;
  }

  function fillInboundExample() {
    const directionInput = $("stockMoveDirection");
    if (directionInput) directionInput.value = "in";
    const dateInput = $("moveDate");
    if (dateInput && !dateInput.value) dateInput.value = todayKey();
    clearStockMoveRows({ keepDirection: true, keepDate: true });
    [
      ["에낙 치킨", 3],
      ["브이콘 50g", 6],
      ["명가 참깨", 2],
      ["라멘뽀식이", 3]
    ].forEach(([sku, pallets]) => addStockMoveRow({ sku, pallets, boxes: 0, eaches: 0 }));
    $("moveMemo").value = "14파렛 입고";
    updateStockMoveDirectionUi();
  }

  function findHistoryByKey(key) {
    const list = getVisibleHistoryItems();
    if (!key) return null;
    if (key.startsWith("idx-")) return list[Number(key.replace("idx-", ""))] || null;
    return list.find((item) => item.id === key) || null;
  }

  function stockPercentText(sku) {
    sku = canonicalSku(sku);
    const units = state.stock[sku]?.units || 0;
    const safety = safetyStatus(sku, units);
    if (!safety?.threshold) return "안전재고 미설정";
    const percent = Math.round((units / safety.threshold) * 100);
    return `${percent}% · 기준 ${safety.thresholdText}`;
  }


  function safeParseStorageJson(raw, key = "") {
  if (!raw || typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    outboundTrendDiagnostics.parsedKeys += key ? 1 : 0;
    return parsed;
  } catch (error) {
    if (key) {
      outboundTrendDiagnostics.parseFailedKeys += 1;
      addDiagnosticKeySummary({ key, type: "파싱 실패", count: 0, error: error?.message || String(error) });
    }
    return null;
  }
}

function isOutboundStorageKey(key) {
  if (!key) return false;
  return OUTBOUND_DIAGNOSTIC_STORAGE_KEYWORDS.some((word) => key.toLowerCase().includes(word))
    && !/manifest|theme|setting|preference|accent|appearance/i.test(key);
}



const OUTBOUND_DIAGNOSTIC_STORAGE_KEYWORDS = [
  "stock",
  "wms",
  "inventory",
  "history",
  "log",
  "movement",
  "outbound",
  "order",
  "excel",
  "shipment",
  "dispatch",
  "backup",
  "reborn",
  "ribbon"
];

let outboundTrendDiagnostics = createEmptyOutboundTrendDiagnostics();

function createEmptyOutboundTrendDiagnostics() {
  return {
    generatedAt: new Date().toISOString(),
    cacheVersion: "reborn-labor-cost-shared-sync-fix-02",
    functionCalled: {
      collect: false,
      stockout: false,
      trend: false,
      render: false,
    },
    localStorageAvailable: false,
    scannedKeys: [],
    keySummaries: [],
    parsedKeys: 0,
    parseFailedKeys: 0,
    candidateRecordCount: 0,
    outboundCandidateCount: 0,
    recentOutboundCount: 0,
    stockUnitsTotal: 0,
    stockRead: false,
    averageDailyOutbound: 0,
    duplicateExcludedCount: 0,
    atFieldDetectedCount: 0,
    atParsedSuccessCount: 0,
    atParseFailedCount: 0,
    normalizeHelperAvailable: true,
    stockReadFailureReason: "확인 필요",
    localStorageFailureReason: "아직 localStorage 접근 진단을 실행하지 않음",
    dataSourcesRead: [],
    renderSkipReason: "",
    collectionStatus: "not-started",
    selectedSku: "",
    currentSku: "",
    selectedItemName: "",
    currentItemName: "",
    selectedStockUnits: 0,
    totalStockUnitsAll: 0,
    detailOverlayOpen: false,
    selectedSkuCandidateCount: 0,
    selectedSkuMatchedCount: 0,
    selectedSkuRecentCount: 0,
    selectedSkuExcludedNoDate: 0,
    selectedSkuExcludedNoQuantity: 0,
    selectedSkuExcludedNameMismatch: 0,
    selectedSkuExcludedType: 0,
    selectedSkuExcludedDuplicate: 0,
    selectedSkuExcludedOldRecord: 0,
    selectedSkuPossibleNameMatches: [],
    selectedSkuRecordSamples: [],
    selectedSkuExcludedSamples: [],
    selectedSkuBoxUsageCount: 0,
    selectedSkuBoxUsageRecordCount: 0,
    selectedSkuDeductionCount: 0,
    selectedSkuDeductionRecordCount: 0,
    selectedSkuHasBoxUsageOnly: false,
    selectedSkuNameMatchedBeforeFilter: 0,
    selectedSkuTypeAcceptedCount: 0,
    selectedSkuDateAcceptedCount: 0,
    selectedSkuQuantityAcceptedCount: 0,
    selectedSkuAcceptedBeforeDedupe: 0,
    selectedSkuDuplicateExcludedCount: 0,
    selectedSkuAcceptedAfterDedupe: 0,
    selectedSkuDedupeRepresentativeSamples: [],
    selectedSkuDuplicateSamples: [],
    selectedSkuRejectedByTypeSamples: [],
    selectedSkuRejectedByDateSamples: [],
    selectedSkuRejectedByQuantitySamples: [],
    selectedSkuFinalAcceptedSamples: [],
    selectedSkuDisplayReason: "",
    selectedSkuDedupeStrategy: "source-priority + sku/date/units/detail fingerprint",
    selectedSkuPrimarySourceCount: 0,
    selectedSkuBackupSourceCount: 0,
    selectedSkuUndoSourceCount: 0,
    selectedSkuDiagnosticNote: "",
    trendDateSource: "",
    trendDateFieldUsed: "",
    trendDateBasis: "not-evaluated",
    outboundTrendCalculationSources: [],
    outboundTrendDiagnosticOnlySources: [],
    excludedDiagnosticSources: [],
    todayOutboundBySource: {},
    dailyOutboundBySource: {},
    todayExcludedBackupUnits: 0,
    todayExcludedUndoUnits: 0,
    todayExcludedLastAnalysisUnits: 0,
    todayIncludedActiveHistoryUnits: 0,
    backupUndoExcludedCount: 0,
    lastAnalysisExcludedCount: 0,
    activeHistoryRecordCount: 0,
    calculationRecordCount: 0,
    diagnosticOnlyRecordCount: 0,
    sourceContributionSamples: [],
    todaySourceContributionSamples: [],
    selectedSkuCalculationSourceBreakdown: {},
    selectedSkuDiagnosticSourceBreakdown: {},
    restoredOrBackupRecordDetectedCount: 0,
    dailyOutboundSamples: [],
    todayOutboundTotal: 0,
    todayOutboundRecordCount: 0,
    todayOutboundSamples: [],
    recordsGroupedByProcessingDateCount: 0,
    recordsGroupedByActualOutboundDateCount: 0,
    dateAmbiguousRecordCount: 0,
    dateAmbiguousSamples: [],
    selectedSkuDailyBreakdown: [],
    selectedSkuTodayBreakdown: [],
    selectedSkuDateFieldCounts: {},
    selectedSkuDateBasisCounts: {},
    excludedReasons: {
      noDate: 0,
      noQuantity: 0,
      noProduct: 0,
      inbound: 0,
      restoreOrReturn: 0,
      dateParseFailed: 0,
      uncertain: 0,
      duplicate: 0,
      oldRecord: 0,
      recordError: 0,
    },
    possibleKeys: [],
    candidateFields: [],
    recordErrors: [],
    lastError: "",
    renderStatus: "not-rendered",
    supabaseStatus: "확인 필요",
    note: "날짜별 순출고 계산은 현재 유효 history 기준입니다. backup/undo/lastOrderAnalysis는 중복 위험이 있어 기본 계산에서 제외하고 진단용으로만 표시합니다. ZIP 파일에는 실제 브라우저 localStorage 데이터가 포함되지 않을 수 있습니다.",
  };
}

function resetOutboundTrendDiagnostics() {
  outboundTrendDiagnostics = createEmptyOutboundTrendDiagnostics();
}

function addDiagnosticDataSource(source) {
  const name = String(source || "").trim();
  if (!name) return;
  if (!outboundTrendDiagnostics.dataSourcesRead.includes(name)) {
    outboundTrendDiagnostics.dataSourcesRead.push(name);
  }
}

function summarizeCurrentStockForDiagnostics(selectedSku = "") {
  const stock = state && state.stock && typeof state.stock === "object" ? state.stock : null;
  const stockKeys = stock ? Object.keys(stock) : [];
  const totalUnits = stockKeys.reduce((sum, key) => sum + Math.max(0, cleanNumber(stock[key]?.units)), 0);
  const sku = canonicalSku(selectedSku);
  const selectedStock = sku && stock ? stock[sku] : null;
  outboundTrendDiagnostics.currentSku = sku || "";
  outboundTrendDiagnostics.selectedSku = sku || "";
  outboundTrendDiagnostics.currentItemName = sku || "";
  outboundTrendDiagnostics.selectedItemName = sku || "";
  outboundTrendDiagnostics.totalStockUnitsAll = totalUnits;
  outboundTrendDiagnostics.selectedStockUnits = selectedStock ? Math.max(0, cleanNumber(selectedStock.units)) : 0;

  if (sku) {
    outboundTrendDiagnostics.stockRead = !!selectedStock;
    outboundTrendDiagnostics.stockUnitsTotal = selectedStock ? Math.max(0, cleanNumber(selectedStock.units)) : 0;
    outboundTrendDiagnostics.stockReadFailureReason = selectedStock
      ? (outboundTrendDiagnostics.stockUnitsTotal > 0 ? "" : "선택 품목 현재 재고 수량 0")
      : "선택 품목 재고 데이터를 찾지 못함";
    return;
  }

  outboundTrendDiagnostics.stockRead = !!stock && stockKeys.length > 0;
  outboundTrendDiagnostics.stockUnitsTotal = totalUnits;
  outboundTrendDiagnostics.stockReadFailureReason = outboundTrendDiagnostics.stockRead
    ? "선택 품목 없음 · 전체 재고 합계만 확인됨"
    : "state.stock 데이터 없음 또는 읽기 실패";
}

function markOutboundTrendRenderSkip(reason, selectedSku = "") {
  outboundTrendDiagnostics.renderStatus = "render-skipped";
  outboundTrendDiagnostics.renderSkipReason = reason || "확인 필요";
  summarizeCurrentStockForDiagnostics(selectedSku);
}

function incrementDiagnosticReason(reason) {
  if (!outboundTrendDiagnostics.excludedReasons[reason]) outboundTrendDiagnostics.excludedReasons[reason] = 0;
  outboundTrendDiagnostics.excludedReasons[reason] += 1;
}


function normalizeSkuComparisonText(value) {
  return replaceLegacySkuText(value)
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[\[\](){}<>]/g, " ")
    .replace(/[·ㆍ,._/\\|:+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSkuComparisonText(value) {
  return normalizeSkuComparisonText(value).replace(/\s+/g, "");
}

function isSafeSameSkuName(a, b) {
  const left = canonicalSku(String(a || "").trim());
  const right = canonicalSku(String(b || "").trim());
  if (!left || !right) return false;
  if (left === right) return true;
  const compactLeft = compactSkuComparisonText(left);
  const compactRight = compactSkuComparisonText(right);
  return !!compactLeft && compactLeft === compactRight;
}

function getRecordNameCandidates(record, parent) {
  const fields = ["sku", "productSku", "product", "productName", "itemName", "item", "name", "title", "label", "text", "memo"];
  const names = [];
  [record, parent].forEach((source) => {
    if (!source || typeof source !== "object") return;
    fields.forEach((field) => {
      const value = source[field];
      if (value == null || value === "") return;
      const text = String(value).trim();
      if (text && !names.includes(text)) names.push(text);
    });
  });
  return names.slice(0, 12);
}

function addSelectedSkuPossibleNameMatch(rawName, sourceHint = "") {
  const name = String(rawName || "").trim();
  if (!name || outboundTrendDiagnostics.selectedSkuPossibleNameMatches.length >= 12) return;
  const exists = outboundTrendDiagnostics.selectedSkuPossibleNameMatches.some((item) => item.name === name && item.source === sourceHint);
  if (!exists) outboundTrendDiagnostics.selectedSkuPossibleNameMatches.push({ name, source: sourceHint || "record" });
}

function addSelectedSkuSample(listName, sample) {
  const list = outboundTrendDiagnostics[listName];
  if (!Array.isArray(list) || list.length >= 10) return;
  list.push(sample);
}


function getOutboundSourcePriority(source = "") {
  const text = String(source || "").toLowerCase();
  if (text.startsWith("state.history")) return 10;
  if (text.startsWith("state.adminactionlogs")) return 20;
  if (text.includes("localstorage:reborn.wms.state.v4.safe")) return 30;
  if (text.includes("lastorderanalysis") || text.includes("deductions")) return 40;
  if (text.includes("localstorage:reborn.wms.state.v3")) return 50;
  if (text.includes("backup")) return 80;
  if (text.includes("undo")) return 90;
  return 60;
}

function getOutboundSourceBucket(source = "") {
  const text = String(source || "").toLowerCase();
  if (text.startsWith("state.history") || text.startsWith("state.adminactionlogs") || text.includes("localstorage:reborn.wms.state.v4.safe")) return "primary";
  if (text.includes("backup")) return "backup";
  if (text.includes("undo")) return "undo";
  return "other";
}

function getOutboundSourceFamily(source = "") {
  const text = String(source || "").toLowerCase();
  if (text.startsWith("state.history")) return "state.history";
  if (text.startsWith("state.adminactionlogs")) return "state.adminActionLogs";
  if (text.includes("localstorage:reborn.wms.state.v4.safe.history")) return "localStorage:state.v4.history";
  if (text.includes("localstorage:reborn.wms.state.v4.safe.adminactionlogs")) return "localStorage:state.v4.adminActionLogs";
  if (text.includes("lastorderanalysis") || text.includes("reborn.wms.lastorderanalysis") || text.includes("deductions")) return "lastOrderAnalysis.diagnostic";
  if (text.includes("undo")) return "undo.diagnostic";
  if (text.includes("backup")) return "backup.diagnostic";
  if (text.includes("localstorage:reborn.wms.state.v3")) return "legacyState.v3.diagnostic";
  return source ? "other.diagnostic" : "unknown";
}

function isOutboundTrendCalculationSource(source = "") {
  const text = String(source || "").toLowerCase();
  if (text.startsWith("state.history")) return true;
  if (text.includes("localstorage:reborn.wms.state.v4.safe.history")) return true;
  return false;
}

function getOutboundTrendSourceRole(source = "") {
  return isOutboundTrendCalculationSource(source) ? "calculation" : "diagnostic-only";
}

function addUniqueDiagnosticListValue(listName, value) {
  const text = String(value || "").trim();
  if (!text) return;
  if (!Array.isArray(outboundTrendDiagnostics[listName])) outboundTrendDiagnostics[listName] = [];
  if (!outboundTrendDiagnostics[listName].includes(text)) outboundTrendDiagnostics[listName].push(text);
}

function addSourceBreakdownValue(mapName, sourceFamily, units = 0, count = 1) {
  const key = String(sourceFamily || "unknown");
  if (!outboundTrendDiagnostics[mapName] || typeof outboundTrendDiagnostics[mapName] !== "object") outboundTrendDiagnostics[mapName] = {};
  const current = outboundTrendDiagnostics[mapName][key] || { count: 0, units: 0 };
  current.count += count;
  current.units += cleanNumber(units);
  outboundTrendDiagnostics[mapName][key] = current;
}

function addDailyOutboundBySource(dateValue, sourceFamily, units = 0) {
  const day = String(dateValue || "").slice(0, 10) || "unknown";
  if (!outboundTrendDiagnostics.dailyOutboundBySource[day]) outboundTrendDiagnostics.dailyOutboundBySource[day] = {};
  const key = String(sourceFamily || "unknown");
  outboundTrendDiagnostics.dailyOutboundBySource[day][key] = (outboundTrendDiagnostics.dailyOutboundBySource[day][key] || 0) + cleanNumber(units);
}

function addSourceContributionSample(listName, record, role = "diagnostic") {
  const list = outboundTrendDiagnostics[listName];
  if (!Array.isArray(list) || list.length >= 12 || !record) return;
  list.push({
    role,
    sku: record.sku || "",
    units: cleanNumber(record.units),
    date: record.date instanceof Date && !Number.isNaN(record.date.getTime()) ? dateKey(record.date) : "",
    source: record.sourceFamily || getOutboundSourceFamily(record.source || ""),
    rawSource: record.source || "",
    dateFieldUsed: record.dateFieldUsed || "",
    dateBasis: record.dateBasis || "",
  });
}

function summarizeOutboundSourceScopeDiagnostics(records, calculationRecords, targetSku = "") {
  const sku = canonicalSku(targetSku);
  const today = todayKey();
  records.forEach((record) => {
    const family = record.sourceFamily || getOutboundSourceFamily(record.source || "");
    const role = record.calculationEligible ? "calculation" : "diagnostic-only";
    if (record.calculationEligible) addUniqueDiagnosticListValue("outboundTrendCalculationSources", family);
    else {
      addUniqueDiagnosticListValue("outboundTrendDiagnosticOnlySources", family);
      addUniqueDiagnosticListValue("excludedDiagnosticSources", family);
    }
    if (family.includes("backup") || family.includes("undo")) {
      outboundTrendDiagnostics.restoredOrBackupRecordDetectedCount += 1;
      if (!record.calculationEligible) outboundTrendDiagnostics.backupUndoExcludedCount += 1;
    }
    if (family.includes("lastOrderAnalysis") && !record.calculationEligible) outboundTrendDiagnostics.lastAnalysisExcludedCount += 1;
    if (record.calculationEligible) outboundTrendDiagnostics.activeHistoryRecordCount += 1;
    else outboundTrendDiagnostics.diagnosticOnlyRecordCount += 1;

    const isSelected = sku && canonicalSku(record.sku) === sku;
    if (isSelected) {
      addSourceBreakdownValue(record.calculationEligible ? "selectedSkuCalculationSourceBreakdown" : "selectedSkuDiagnosticSourceBreakdown", family, record.units, 1);
    }

    if (record.date instanceof Date && !Number.isNaN(record.date.getTime())) {
      const day = dateKey(record.date);
      const units = cleanNumber(record.units);
      addDailyOutboundBySource(day, family, units);
      if (day === today) {
        outboundTrendDiagnostics.todayOutboundBySource[family] = (outboundTrendDiagnostics.todayOutboundBySource[family] || 0) + units;
        if (record.calculationEligible) outboundTrendDiagnostics.todayIncludedActiveHistoryUnits += units;
        else if (family.includes("backup")) outboundTrendDiagnostics.todayExcludedBackupUnits += units;
        else if (family.includes("undo")) outboundTrendDiagnostics.todayExcludedUndoUnits += units;
        else if (family.includes("lastOrderAnalysis")) outboundTrendDiagnostics.todayExcludedLastAnalysisUnits += units;
        addSourceContributionSample("todaySourceContributionSamples", record, role);
      }
    }
    if (isSelected) addSourceContributionSample("sourceContributionSamples", record, role);
  });
  outboundTrendDiagnostics.calculationRecordCount = calculationRecords.length;
}

function finalizeOutboundFinalCalculationSourceDiagnostics(uniqueRecords, targetSku = "") {
  const sku = canonicalSku(targetSku);
  const today = todayKey();
  outboundTrendDiagnostics.todayIncludedActiveHistoryUnits = 0;
  outboundTrendDiagnostics.selectedSkuCalculationSourceBreakdown = {};
  outboundTrendDiagnostics.calculationRecordCount = uniqueRecords.length;
  uniqueRecords.forEach((record) => {
    const family = record.sourceFamily || getOutboundSourceFamily(record.source || "");
    if (sku && canonicalSku(record.sku) === sku) {
      addSourceBreakdownValue("selectedSkuCalculationSourceBreakdown", family, record.units, 1);
    }
    if (record.date instanceof Date && !Number.isNaN(record.date.getTime()) && dateKey(record.date) === today) {
      outboundTrendDiagnostics.todayIncludedActiveHistoryUnits += cleanNumber(record.units);
    }
  });
}

function getSelectedTargetSku() {
  return canonicalSku(outboundTrendDiagnostics.currentSku || outboundTrendDiagnostics.selectedSku || "");
}

function isRecordForSelectedSku(record) {
  const targetSku = getSelectedTargetSku();
  return !!targetSku && record && canonicalSku(record.sku) === targetSku;
}

function buildSelectedRecordSample(record, reason = "sample") {
  return {
    source: record?.source || "record",
    reason,
    sku: record?.sku || "",
    units: Number.isFinite(Number(record?.units)) ? Number(record.units) : 0,
    date: record?.date instanceof Date && !Number.isNaN(record.date.getTime()) ? record.date.toISOString() : String(record?.date || ""),
    dedupeKey: record?.dedupeKey || "",
  };
}

function countSelectedSkuAcceptedSource(record) {
  if (!isRecordForSelectedSku(record)) return;
  const bucket = getOutboundSourceBucket(record.source);
  if (bucket === "primary") outboundTrendDiagnostics.selectedSkuPrimarySourceCount += 1;
  else if (bucket === "backup") outboundTrendDiagnostics.selectedSkuBackupSourceCount += 1;
  else if (bucket === "undo") outboundTrendDiagnostics.selectedSkuUndoSourceCount += 1;
}

function markSelectedSkuPipelineStage(record, parent, sourceHint, stage, data = {}) {
  const targetSku = getSelectedTargetSku();
  if (!targetSku) return false;
  const sku = canonicalSku(data.sku || getRecordSku(record, parent) || "");
  if (sku !== targetSku) return false;
  if (stage === "typeAccepted") outboundTrendDiagnostics.selectedSkuTypeAcceptedCount += 1;
  if (stage === "quantityAccepted") outboundTrendDiagnostics.selectedSkuQuantityAcceptedCount += 1;
  if (stage === "dateAccepted") outboundTrendDiagnostics.selectedSkuDateAcceptedCount += 1;
  return true;
}

function normalizeDedupeText(value) {
  return safeNormalizeText(value)
    .replace(/localstorage:reborn\.wms\.state\.v\d+\.safe/g, "state")
    .replace(/localstorage:reborn\.wms\.backups\.v\d+/g, "backup")
    .replace(/localstorage:reborn\.wms\.undo\.v\d+/g, "undo")
    .replace(/\[\d+\]/g, "[]")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRecordDedupeFingerprint(record, parent, sourceHint = "") {
  const names = getRecordNameCandidates(record, parent).join("|");
  const parts = [
    record?.orderCount,
    record?.rowIndex,
    record?.row,
    record?.line,
    record?.text,
    record?.memo,
    record?.note,
    parent?.memo,
    parent?.title,
    names,
  ].filter((value) => value !== undefined && value !== null && value !== "");
  const fingerprint = normalizeDedupeText(parts.join("|"));
  if (fingerprint) return fingerprint;
  return normalizeDedupeText(String(sourceHint || "").replace(/^localStorage:[^\.]+\./, ""));
}

function buildOutboundDedupeKey(record) {
  const day = dateKey(record.date);
  const roundedUnits = Math.round(Math.abs(cleanNumber(record.units)) * 1000) / 1000;
  const stableId = record.id ? `id:${record.id}` : "no-id";
  if (record.id) {
    return [stableId, `sku:${record.sku}`, `date:${day}`, `units:${roundedUnits}`].join("|");
  }
  const fingerprint = record.fingerprint || "no-fingerprint";
  return [stableId, `sku:${record.sku}`, `date:${day}`, `units:${roundedUnits}`, `fp:${fingerprint}`].join("|");
}

function sortOutboundRecordsBySourcePriority(records) {
  return [...records].sort((a, b) => {
    const rankDiff = (a.sourcePriority || 60) - (b.sourcePriority || 60);
    if (rankDiff) return rankDiff;
    const timeDiff = (a.date?.getTime?.() || 0) - (b.date?.getTime?.() || 0);
    if (timeDiff) return timeDiff;
    return String(a.source || "").localeCompare(String(b.source || ""));
  });
}

function isPotentialSimilarSkuName(targetSku, rawName) {
  const target = normalizeSkuComparisonText(targetSku);
  const raw = normalizeSkuComparisonText(rawName);
  if (!target || !raw) return false;
  if (compactSkuComparisonText(target) === compactSkuComparisonText(raw)) return true;
  const targetTokens = target.split(" ").filter((token) => token.length >= 2);
  const rawCompact = compactSkuComparisonText(raw);
  const matched = targetTokens.filter((token) => rawCompact.includes(compactSkuComparisonText(token)));
  return matched.length >= Math.min(2, targetTokens.length) && targetTokens.length > 0;
}

function noteSelectedSkuCandidate(record, parent, sourceHint, reason, data = {}) {
  const targetSku = canonicalSku(outboundTrendDiagnostics.currentSku || outboundTrendDiagnostics.selectedSku || "");
  if (!targetSku) return false;
  const recordSku = canonicalSku(data.sku || getRecordSku(record, parent) || "");
  const names = getRecordNameCandidates(record, parent);
  const directMatch = recordSku && recordSku === targetSku;
  const rawMatch = names.some((name) => isSafeSameSkuName(name, targetSku));
  const possibleMatch = names.some((name) => isPotentialSimilarSkuName(targetSku, name));

  if (possibleMatch && !directMatch && !rawMatch) {
    names.filter((name) => isPotentialSimilarSkuName(targetSku, name)).slice(0, 3).forEach((name) => addSelectedSkuPossibleNameMatch(name, sourceHint));
  }

  if (!directMatch && !rawMatch) return false;

  outboundTrendDiagnostics.selectedSkuNameMatchedBeforeFilter += 1;
  outboundTrendDiagnostics.selectedSkuCandidateCount += 1;
  const units = data.units != null ? data.units : getRecordUnits(record);
  const dateRaw = data.dateRaw != null ? data.dateRaw : getRecordDateValue(record, parent);
  const sample = {
    source: sourceHint || "record",
    reason: reason || "matched",
    sku: recordSku || targetSku,
    names: names.slice(0, 4),
    units: Number.isFinite(Number(units)) ? Number(units) : units || 0,
    date: dateRaw || "",
  };

  if (reason === "matched") {
    addSelectedSkuSample("selectedSkuRecordSamples", sample);
  } else {
    addSelectedSkuSample("selectedSkuExcludedSamples", sample);
    if (reason === "noDate" || reason === "dateParseFailed") {
      outboundTrendDiagnostics.selectedSkuExcludedNoDate += 1;
      addSelectedSkuSample("selectedSkuRejectedByDateSamples", sample);
    } else if (reason === "noQuantity") {
      outboundTrendDiagnostics.selectedSkuExcludedNoQuantity += 1;
      addSelectedSkuSample("selectedSkuRejectedByQuantitySamples", sample);
    } else if (reason === "uncertain" || reason === "inbound" || reason === "restoreOrReturn") {
      outboundTrendDiagnostics.selectedSkuExcludedType += 1;
      addSelectedSkuSample("selectedSkuRejectedByTypeSamples", sample);
    }
  }
  return true;
}

function scanSelectedSkuSupplementalRecords(value, sourceHint, targetSku, depth = 0, seen = new Set()) {
  if (!targetSku || !value || depth > 5) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSelectedSkuSupplementalRecords(entry, `${sourceHint}[${index}]`, targetSku, depth + 1, seen));
    return;
  }
  if (typeof value !== "object") return;

  ["deductions", "boxUsages"].forEach((key) => {
    const rows = Array.isArray(value[key]) ? value[key] : [];
    rows.forEach((row, index) => {
      const rowSku = canonicalSku(row?.sku || row?.product || row?.productName || row?.itemName || row?.name || "");
      if (!isSafeSameSkuName(rowSku, targetSku)) return;
      const units = Math.max(0, cleanNumber(row?.units ?? row?.qty ?? row?.quantity ?? row?.count));
      const dedupeKey = `${key}|${rowSku}|${units}|${sourceHint}|${index}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      if (key === "boxUsages") {
        outboundTrendDiagnostics.selectedSkuBoxUsageRecordCount += 1;
        outboundTrendDiagnostics.selectedSkuBoxUsageCount += units;
        addSelectedSkuSample("selectedSkuRecordSamples", { source: `${sourceHint}.${key}`, reason: "boxUsageOnly", sku: rowSku, units, date: value.at || row?.at || "" });
      } else {
        outboundTrendDiagnostics.selectedSkuDeductionRecordCount += 1;
        outboundTrendDiagnostics.selectedSkuDeductionCount += units;
      }
    });
  });

  ["analysis", "lastOrderAnalysis", "state", "data", "payload", "appliedOrderFiles", "records", "items", "orders", "entries", "list"].forEach((key) => {
    if (value[key]) scanSelectedSkuSupplementalRecords(value[key], `${sourceHint}.${key}`, targetSku, depth + 1, seen);
  });
}

function analyzeSelectedSkuSupplementalSources(targetSku) {
  targetSku = canonicalSku(targetSku);
  if (!targetSku) return;
  const seen = new Set();
  try {
    if (lastOrderAnalysis) scanSelectedSkuSupplementalRecords(lastOrderAnalysis, "lastOrderAnalysis", targetSku, 0, seen);
  } catch (error) {
    addDiagnosticRecordError(error, "selectedSkuSupplemental:lastOrderAnalysis");
  }
  try {
    if (state) scanSelectedSkuSupplementalRecords(state, "state", targetSku, 0, seen);
  } catch (error) {
    addDiagnosticRecordError(error, "selectedSkuSupplemental:state");
  }
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      [ORDER_CACHE_KEY, "reborn.wms.lastOrderAnalysis.v2", STORAGE_KEY].forEach((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const parsed = safeParseStorageJson(raw, `selectedSkuSupplemental:${key}`);
        if (parsed) scanSelectedSkuSupplementalRecords(parsed, `localStorage:${key}`, targetSku, 0, seen);
      });
    }
  } catch (error) {
    addDiagnosticRecordError(error, "selectedSkuSupplemental:localStorage");
  }
  const def = INVENTORY_DEFS[targetSku];
  if (def?.isBox && outboundTrendDiagnostics.selectedSkuBoxUsageCount > 0 && outboundTrendDiagnostics.selectedSkuRecentCount === 0) {
    outboundTrendDiagnostics.selectedSkuHasBoxUsageOnly = true;
    outboundTrendDiagnostics.selectedSkuDiagnosticNote = "선택 품목은 포장 부자재이며, 박스 사용량 데이터가 일반 상품 출고 기록과 별도 구조로 저장되어 있습니다.";
  }
}

function describeDiagnosticValue(value) {
  if (Array.isArray(value)) return { type: "배열", count: value.length };
  if (value && typeof value === "object") {
    const arrays = [];
    Object.keys(value).forEach((key) => {
      if (Array.isArray(value[key])) arrays.push(`${key}:${value[key].length}`);
    });
    return { type: "객체", count: arrays.length ? arrays.join(", ") : Object.keys(value).length };
  }
  if (typeof value === "string") return { type: "문자열", count: value.length };
  return { type: typeof value, count: 0 };
}

function addDiagnosticKeySummary(summary) {
  outboundTrendDiagnostics.keySummaries.push(summary);
  if (summary?.key && !outboundTrendDiagnostics.scannedKeys.includes(summary.key)) {
    outboundTrendDiagnostics.scannedKeys.push(summary.key);
  }
}

function addCandidateFieldName(fieldName) {
  const name = String(fieldName || "").trim();
  if (!name) return;
  if (outboundTrendDiagnostics.candidateFields.length >= 80) return;
  if (!outboundTrendDiagnostics.candidateFields.includes(name)) {
    outboundTrendDiagnostics.candidateFields.push(name);
  }
}

function collectCandidateFields(value, depth = 0, prefix = "") {
  if (value == null || depth > 2) return;
  try {
    if (Array.isArray(value)) {
      value.slice(0, 8).forEach((entry) => collectCandidateFields(entry, depth + 1, prefix));
      return;
    }
    if (typeof value !== "object") return;
    Object.keys(value).slice(0, 40).forEach((key) => {
      const path = prefix ? `${prefix}.${key}` : key;
      addCandidateFieldName(path);
      const child = value[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          addCandidateFieldName(`${path}[]`);
          child.slice(0, 5).forEach((entry) => collectCandidateFields(entry, depth + 1, `${path}[]`));
        } else {
          collectCandidateFields(child, depth + 1, path);
        }
      }
    });
  } catch (error) {
    incrementDiagnosticReason("recordError");
    addDiagnosticRecordError(error, `collectCandidateFields:${prefix || "root"}`);
  }
}

function collectDiagnosticFieldNames(record) {
  collectCandidateFields(record);
}

function addDiagnosticRecordError(error, sourceHint = "") {
  const message = error?.message || String(error || "알 수 없는 오류");
  if (outboundTrendDiagnostics.recordErrors.length < 8) {
    outboundTrendDiagnostics.recordErrors.push({ source: sourceHint || "record", error: message });
  }
  outboundTrendDiagnostics.lastError = message;
}

function getCandidateStorageKeys() {
  const keys = new Set([STORAGE_KEY]);
  try {
    if (typeof localStorage === "undefined" || !localStorage) {
      outboundTrendDiagnostics.localStorageAvailable = false;
      outboundTrendDiagnostics.localStorageFailureReason = "localStorage 객체 없음 또는 접근 불가";
      outboundTrendDiagnostics.possibleKeys = [...keys];
      outboundTrendDiagnostics.scannedKeys = [...new Set([...(outboundTrendDiagnostics.scannedKeys || []), ...keys])];
      return [...keys];
    }
    outboundTrendDiagnostics.localStorageAvailable = true;
    outboundTrendDiagnostics.localStorageFailureReason = "";
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (isOutboundStorageKey(key)) keys.add(key);
    }
    Object.keys(localStorage || {}).forEach((key) => {
      if (isOutboundStorageKey(key)) keys.add(key);
    });
  } catch (error) {
    outboundTrendDiagnostics.localStorageAvailable = false;
    outboundTrendDiagnostics.localStorageFailureReason = error?.message || String(error) || "localStorage 키 스캔 실패";
    outboundTrendDiagnostics.lastError = `localStorage 키 스캔 실패: ${error?.message || error}`;
  }
  outboundTrendDiagnostics.possibleKeys = [...keys];
  outboundTrendDiagnostics.scannedKeys = [...new Set([...(outboundTrendDiagnostics.scannedKeys || []), ...keys])];
  if (!outboundTrendDiagnostics.localStorageAvailable && !outboundTrendDiagnostics.localStorageFailureReason) {
    outboundTrendDiagnostics.localStorageFailureReason = "localStorage 접근 진단 실패 사유 확인 필요";
  }
  return [...keys];
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "object" && Array.isArray(value.items)) return value.items;
  return [];
}

function getObjectText(value) {
  if (!value || typeof value !== "object") return "";
  return [
    value.type,
    value.action,
    value.mode,
    value.direction,
    value.kind,
    value.source,
    value.status,
    value.label,
    value.title,
    value.memo,
    value.note,
    value.message,
    value.description,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function safeNormalizeText(value) {
  if (value == null) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeText(value) {
  return safeNormalizeText(value);
}

function getRecordDateInfo(record, parent, sourceHint = "") {
  const actualDateFields = ["outboundDate", "outboundAt", "shippedAt", "shippedDate", "shipmentDate", "orderDate", "orderedAt", "excelDate", "fileDate"];
  const neutralDateFields = ["date"];
  const processingDateFields = ["appliedDate", "appliedAt", "processedAt", "processed_at"];
  const recordedDateFields = ["createdAt", "created_at", "timestamp", "at", "time", "updatedAt", "updated_at"];
  const fields = [...actualDateFields, ...neutralDateFields, ...processingDateFields, ...recordedDateFields];
  let rawDate = null;
  let sourceField = "";
  let owner = "record";
  for (const field of fields) {
    if (record && record[field] != null && record[field] !== "") {
      rawDate = record[field];
      sourceField = field;
      owner = "record";
      break;
    }
  }
  if ((rawDate == null || rawDate === "") && parent) {
    for (const field of fields) {
      if (parent[field] != null && parent[field] !== "") {
        rawDate = parent[field];
        sourceField = `parent.${field}`;
        owner = "parent";
        break;
      }
    }
  }
  const plainField = sourceField.replace(/^parent\./, "");
  const isAtField = plainField === "at";
  if (isAtField) outboundTrendDiagnostics.atFieldDetectedCount += 1;
  if (rawDate == null || rawDate === "") return { date: null, hasRaw: false, sourceField: "", rawDate: null, basis: "missing", owner };
  const date = parseTrendDate(rawDate);
  if (isAtField) {
    if (date) outboundTrendDiagnostics.atParsedSuccessCount += 1;
    else outboundTrendDiagnostics.atParseFailedCount += 1;
  }
  const lowerSource = String(sourceHint || "").toLowerCase();
  const isExcelLike = /excel|orderanalysis|lastorderanalysis|deduction|주문|차감/.test(lowerSource) || /excel|주문|차감/.test(`${getObjectText(record)} ${getObjectText(parent)}`.toLowerCase());
  let basis = "recordedAt";
  if (actualDateFields.includes(plainField)) basis = "actualOutboundDate";
  else if (processingDateFields.includes(plainField)) basis = "processingDate";
  else if (plainField === "date") basis = isExcelLike ? "ambiguousDate" : "recordDate";
  else if ((plainField === "at" || plainField === "createdAt" || plainField === "created_at" || plainField === "timestamp" || plainField === "time") && isExcelLike) basis = "processingDate";
  else if (plainField === "updatedAt" || plainField === "updated_at") basis = "ambiguousDate";
  return { date, hasRaw: true, sourceField, rawDate, basis, owner };
}

function getRecordDateValue(record, parent) {
  return getRecordDateInfo(record, parent).rawDate;
}

function parseTrendDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const normalized = value > 0 && value < 1000000000000 ? value * 1000 : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  let text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return parseTrendDate(Number(text));
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;
  let normalizedText = text
    .replace(/년/g, "-")
    .replace(/월/g, "-")
    .replace(/일/g, " ")
    .replace(/[.]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  const isPm = /오후|PM/i.test(normalizedText);
  const isAm = /오전|AM/i.test(normalizedText);
  normalizedText = normalizedText.replace(/오전|오후|AM|PM/gi, "").replace(/\s+/g, " ").trim();
  const match = normalizedText.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    let hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);
    const second = Number(match[6] || 0);
    if (isPm && hour < 12) hour += 12;
    if (isAm && hour === 12) hour = 0;
    const parsed = new Date(year, month, day, hour, minute, second);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
function getRecordSku(record, parent) {
  const raw =
    record?.sku ||
    record?.productSku ||
    record?.product ||
    record?.productName ||
    record?.itemName ||
    record?.item ||
    record?.name ||
    record?.title ||
    record?.label ||
    parent?.sku ||
    parent?.productSku ||
    parent?.product ||
    parent?.productName ||
    parent?.itemName ||
    parent?.item ||
    parent?.name ||
    parent?.title ||
    parent?.label ||
    "";
  const direct = canonicalSku(raw);
  if (direct && state.stock[direct]) return direct;
  const normalized = safeNormalizeText(raw);
  if (!normalized) return "";
  return Object.keys(INVENTORY_DEFS).find((name) => {
    const normalizedName = safeNormalizeText(name);
    return normalized.includes(normalizedName) || normalizedName.includes(normalized);
  }) || direct || "";
}

function getRecordUnits(record) {
  const fields = [
    "units",
    "unitCount",
    "totalUnits",
    "deductedUnits",
    "outboundUnits",
    "outboundQty",
    "quantityUnits",
    "eaches",
    "qty",
    "quantity",
    "count",
    "totalQty",
    "ea",
    "deductedQty",
    "shippedQty",
    "qtyText",
    "amount",
  ];
  for (const field of fields) {
    if (record && record[field] !== undefined && record[field] !== null && record[field] !== "") {
      const value = Math.abs(cleanNumber(record[field]));
      if (value > 0) return value;
    }
  }
  return 0;
}

function isReturnOrRestoreRecord(record, parent) {
  const text = `${getObjectText(record)} ${getObjectText(parent)}`;
  return /returnadjustment|restore|restored|refund|cancel|반품|취소|복구|입고복구|재고복구/.test(text);
}

function isOutboundRecord(record, parent, sourceHint = "") {
  const direction = String(record?.direction || record?.movementType || record?.type || parent?.direction || "").toLowerCase();
  const text = `${sourceHint} ${getObjectText(parent)} ${getObjectText(record)}`.toLowerCase();
  if (isReturnOrRestoreRecord(record, parent)) return false;
  if (/inbound|입고/.test(direction) && !/outbound|출고|차감/.test(direction)) return false;
  if (/outbound|manualoutbound|excelorderdeduction|deduct|deduction|ship|shipping|order\s*out|출고|차감|주문처리/.test(text)) return true;
  if (record?.direction === "out" || record?.mode === "out" || record?.action === "out") return true;
  return false;
}

function getDetailListFromRecord(record) {
  if (!record || typeof record !== "object") return [];
  const detailKeys = ["details", "items", "rows", "products", "lines", "deductions", "entries", "records"];
  for (const key of detailKeys) {
    if (Array.isArray(record[key]) && record[key].length) return record[key];
  }
  return [];
}

function normalizeOutboundTrendRecord(record, parent, sourceHint = "") {
  if (!record || typeof record !== "object") return null;
  collectDiagnosticFieldNames(record);
  const sku = getRecordSku(record, parent);
  const sourceText = `${sourceHint || ""} ${getObjectText(parent)} ${getObjectText(record)}`.toLowerCase();
  if (isReturnOrRestoreRecord(record, parent)) {
    incrementDiagnosticReason("restoreOrReturn");
    noteSelectedSkuCandidate(record, parent, sourceHint, "restoreOrReturn", { sku });
    return null;
  }
  if (/inbound|입고/.test(sourceText) && !/outbound|출고|차감|deduct|shipment/.test(sourceText)) {
    incrementDiagnosticReason("inbound");
    noteSelectedSkuCandidate(record, parent, sourceHint, "inbound", { sku });
    return null;
  }
  if (!sku || !state.stock[sku]) {
    incrementDiagnosticReason("noProduct");
    noteSelectedSkuCandidate(record, parent, sourceHint, "noProduct", { sku });
    return null;
  }
  if (!isOutboundRecord(record, parent, sourceHint)) {
    incrementDiagnosticReason("uncertain");
    noteSelectedSkuCandidate(record, parent, sourceHint, "uncertain", { sku });
    return null;
  }
  markSelectedSkuPipelineStage(record, parent, sourceHint, "typeAccepted", { sku });
  const units = getRecordUnits(record);
  if (!units) {
    incrementDiagnosticReason("noQuantity");
    noteSelectedSkuCandidate(record, parent, sourceHint, "noQuantity", { sku, units });
    return null;
  }
  markSelectedSkuPipelineStage(record, parent, sourceHint, "quantityAccepted", { sku, units });
  const dateInfo = getRecordDateInfo(record, parent, sourceHint);
  const date = dateInfo.date;
  if (!date) {
    const reason = dateInfo.hasRaw ? "dateParseFailed" : "noDate";
    incrementDiagnosticReason(reason);
    noteSelectedSkuCandidate(record, parent, sourceHint, reason, { sku, units, dateRaw: dateInfo.rawDate });
    return null;
  }
  markSelectedSkuPipelineStage(record, parent, sourceHint, "dateAccepted", { sku, units });
  outboundTrendDiagnostics.outboundCandidateCount += 1;
  noteSelectedSkuCandidate(record, parent, sourceHint, "matched", { sku, units, dateRaw: dateInfo.rawDate });
  const source = sourceHint || record?.source || parent?.source || "local";
  const sourceFamily = getOutboundSourceFamily(source);
  const calculationEligible = isOutboundTrendCalculationSource(source);
  return {
    sku,
    units,
    date,
    id: record?.id || parent?.id || "",
    source,
    sourceHint: sourceHint || "",
    sourceFamily,
    sourceRole: getOutboundTrendSourceRole(source),
    calculationEligible,
    sourcePriority: getOutboundSourcePriority(source),
    fingerprint: buildRecordDedupeFingerprint(record, parent, sourceHint),
    rawNames: getRecordNameCandidates(record, parent),
    dateFieldUsed: dateInfo.sourceField || "",
    dateRaw: dateInfo.rawDate || "",
    dateBasis: dateInfo.basis || "unknown",
  };
}

function collectRecordsFromCandidate(candidate, sourceHint, depth = 0, output = [], parentContext = null) {
  if (!candidate || depth > 5) return output;
  if (Array.isArray(candidate)) {
    candidate.forEach((entry) => collectRecordsFromCandidate(entry, sourceHint, depth + 1, output, parentContext));
    return output;
  }
  if (typeof candidate !== "object") return output;

  outboundTrendDiagnostics.candidateRecordCount += 1;
  try {
    collectCandidateFields(candidate);
  } catch (error) {
    incrementDiagnosticReason("recordError");
    addDiagnosticRecordError(error, `${sourceHint}:fields`);
  }

  try {
    const normalized = normalizeOutboundTrendRecord(candidate, parentContext, sourceHint);
    if (normalized) output.push(normalized);
  } catch (error) {
    incrementDiagnosticReason("recordError");
    addDiagnosticRecordError(error, sourceHint);
  }

  const details = getDetailListFromRecord(candidate);
  if (details.length) {
    details.forEach((detail, index) => {
      try {
        collectRecordsFromCandidate(detail, `${sourceHint}.details[${index}]`, depth + 1, output, candidate);
      } catch (error) {
        incrementDiagnosticReason("recordError");
        addDiagnosticRecordError(error, `${sourceHint}.details`);
      }
    });
  }

  const relevantNestedKeys = [
    "history",
    "stockHistory",
    "stockMovements",
    "movements",
    "movementLogs",
    "outboundLogs",
    "outboundHistory",
    "excelHistory",
    "excelLogs",
    "orderHistory",
    "appliedOrderFiles",
    "processedOrders",
    "adminActionLogs",
    "state",
    "data",
    "payload",
    "logs",
    "records",
    "items",
    "orders",
    "entries",
    "list",
  ];
  relevantNestedKeys.forEach((key) => {
    try {
      if (candidate[key]) collectRecordsFromCandidate(candidate[key], `${sourceHint}.${key}`, depth + 1, output, candidate);
    } catch (error) {
      incrementDiagnosticReason("recordError");
      addDiagnosticRecordError(error, `${sourceHint}.${key}`);
    }
  });
  return output;
}

function collectStoredOutboundTrendRecords() {
  outboundTrendDiagnostics.functionCalled.collect = true;
  outboundTrendDiagnostics.collectionStatus = "collecting";
  outboundTrendDiagnostics.renderStatus = "collecting";
  const records = [];
  try {
    const stateHistory = Array.isArray(state.history) ? state.history : [];
    const stateAdminLogs = Array.isArray(state.adminActionLogs) ? state.adminActionLogs : [];
    addDiagnosticDataSource("state.history");
    addDiagnosticDataSource("state.adminActionLogs");
    collectRecordsFromCandidate(stateHistory, "state.history", 0, records);
    collectRecordsFromCandidate(stateAdminLogs, "state.adminActionLogs", 0, records);
    addDiagnosticKeySummary({ key: "state.history", ...describeDiagnosticValue(stateHistory) });
    addDiagnosticKeySummary({ key: "state.adminActionLogs", ...describeDiagnosticValue(stateAdminLogs) });

    getCandidateStorageKeys().forEach((key) => {
      let parsed = null;
      try {
        if (!(outboundTrendDiagnostics.localStorageAvailable && typeof localStorage !== "undefined" && localStorage)) {
          addDiagnosticKeySummary({ key: `localStorage:${key}`, type: "접근 불가", count: 0, error: outboundTrendDiagnostics.localStorageFailureReason || "localStorage 사용 불가" });
          return;
        }
        const raw = localStorage.getItem(key);
        if (raw == null || raw === "") {
          addDiagnosticKeySummary({ key: `localStorage:${key}`, type: "저장값 없음", count: 0 });
          return;
        }
        parsed = safeParseStorageJson(raw, key);
        if (parsed) {
          addDiagnosticKeySummary({ key: `localStorage:${key}`, ...describeDiagnosticValue(parsed) });
          addDiagnosticDataSource(`localStorage:${key}`);
          collectRecordsFromCandidate(parsed, `localStorage:${key}`, 0, records);
        }
      } catch (error) {
        addDiagnosticKeySummary({ key: `localStorage:${key}`, type: "읽기 실패", count: 0, error: error?.message || String(error) });
        addDiagnosticRecordError(error, `localStorage:${key}`);
      }
    });

    const targetSku = getSelectedTargetSku();
    const calculationRecords = records.filter((record) => record && record.calculationEligible);
    summarizeOutboundSourceScopeDiagnostics(records, calculationRecords, targetSku);
    outboundTrendDiagnostics.selectedSkuAcceptedBeforeDedupe = targetSku
      ? calculationRecords.filter((record) => canonicalSku(record.sku) === targetSku).length
      : 0;

    const seen = new Set();
    const sortedRecords = sortOutboundRecordsBySourcePriority(calculationRecords);
    const uniqueRecords = sortedRecords.filter((record) => {
      const key = buildOutboundDedupeKey(record);
      record.dedupeKey = key;
      if (seen.has(key)) {
        outboundTrendDiagnostics.duplicateExcludedCount += 1;
        incrementDiagnosticReason("duplicate");
        if (targetSku && canonicalSku(record.sku) === targetSku) {
          outboundTrendDiagnostics.selectedSkuExcludedDuplicate += 1;
          outboundTrendDiagnostics.selectedSkuDuplicateExcludedCount += 1;
          addSelectedSkuSample("selectedSkuDuplicateSamples", buildSelectedRecordSample(record, "duplicate"));
        }
        return false;
      }
      seen.add(key);
      countSelectedSkuAcceptedSource(record);
      if (targetSku && canonicalSku(record.sku) === targetSku) {
        addSelectedSkuSample("selectedSkuDedupeRepresentativeSamples", buildSelectedRecordSample(record, "representative"));
      }
      return true;
    });
    outboundTrendDiagnostics.candidateRecordCount = Math.max(outboundTrendDiagnostics.candidateRecordCount, records.length);
    outboundTrendDiagnostics.outboundCandidateCount = uniqueRecords.length;
    finalizeOutboundFinalCalculationSourceDiagnostics(uniqueRecords, targetSku);
    outboundTrendDiagnostics.selectedSkuAcceptedAfterDedupe = targetSku
      ? uniqueRecords.filter((record) => canonicalSku(record.sku) === targetSku).length
      : 0;
    outboundTrendDiagnostics.collectionStatus = "collected";
    outboundTrendDiagnostics.renderStatus = "collected";
    return uniqueRecords;
  } catch (error) {
    addDiagnosticRecordError(error, "collectStoredOutboundTrendRecords");
    outboundTrendDiagnostics.collectionStatus = "collect-error";
    outboundTrendDiagnostics.renderStatus = "collect-error";
    return records;
  }
}


function normalizeTrendDateBasisLabel(basis = "") {
  if (basis === "actualOutboundDate") return "실제 출고일 기준";
  if (basis === "processingDate") return "엑셀 차감/처리일 기준";
  if (basis === "recordDate") return "기록일 기준";
  if (basis === "recordedAt") return "기록 생성일 기준";
  if (basis === "ambiguousDate") return "날짜 기준 확인 필요";
  return "날짜 기준 확인 필요";
}

function addLimitedDiagnosticSample(listName, sample, limit = 10) {
  const list = outboundTrendDiagnostics[listName];
  if (!Array.isArray(list) || list.length >= limit) return;
  list.push(sample);
}

function incrementDiagnosticCounterMap(mapName, key) {
  const name = String(key || "unknown");
  if (!outboundTrendDiagnostics[mapName] || typeof outboundTrendDiagnostics[mapName] !== "object") outboundTrendDiagnostics[mapName] = {};
  outboundTrendDiagnostics[mapName][name] = (outboundTrendDiagnostics[mapName][name] || 0) + 1;
}

function addTrendDateDiagnostics(record, dateKeyValue) {
  if (!record) return;
  const basis = record.dateBasis || "unknown";
  const field = record.dateFieldUsed || "unknown";
  incrementDiagnosticCounterMap("selectedSkuDateBasisCounts", basis);
  incrementDiagnosticCounterMap("selectedSkuDateFieldCounts", field);
  if (basis === "actualOutboundDate") outboundTrendDiagnostics.recordsGroupedByActualOutboundDateCount += 1;
  else if (basis === "processingDate") outboundTrendDiagnostics.recordsGroupedByProcessingDateCount += 1;
  else {
    outboundTrendDiagnostics.dateAmbiguousRecordCount += 1;
    addLimitedDiagnosticSample("dateAmbiguousSamples", {
      sku: record.sku || "",
      units: record.units || 0,
      date: record.date instanceof Date ? record.date.toISOString() : String(record.date || ""),
      field,
      basis,
      source: record.source || "",
    }, 8);
  }
  const sample = {
    date: dateKeyValue || (record.date instanceof Date ? dateKey(record.date) : ""),
    sku: record.sku || "",
    units: record.units || 0,
    field,
    basis,
    source: record.source || "",
  };
  addLimitedDiagnosticSample("dailyOutboundSamples", sample, 12);
  if (dateKeyValue && dateKeyValue === todayKey()) {
    outboundTrendDiagnostics.todayOutboundTotal += cleanNumber(record.units);
    outboundTrendDiagnostics.todayOutboundRecordCount += 1;
    addLimitedDiagnosticSample("todayOutboundSamples", sample, 12);
  }
}

function finalizeTrendDateDiagnostics(dailyData, recentRecords) {
  const basisCounts = outboundTrendDiagnostics.selectedSkuDateBasisCounts || {};
  const fieldCounts = outboundTrendDiagnostics.selectedSkuDateFieldCounts || {};
  const sortedBasis = Object.entries(basisCounts).sort((a, b) => b[1] - a[1]);
  const sortedFields = Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]);
  outboundTrendDiagnostics.trendDateBasis = sortedBasis.length === 1
    ? sortedBasis[0][0]
    : sortedBasis.length > 1
      ? "mixed"
      : "no-records";
  outboundTrendDiagnostics.trendDateFieldUsed = sortedFields.length ? `${sortedFields[0][0]} (${sortedFields[0][1].toLocaleString()}건)` : "";
  outboundTrendDiagnostics.trendDateSource = sortedBasis.length
    ? `${normalizeTrendDateBasisLabel(outboundTrendDiagnostics.trendDateBasis)} · ${sortedFields[0]?.[0] || "필드 확인 필요"}`
    : "집계 가능한 날짜 기록 없음";
  outboundTrendDiagnostics.selectedSkuDailyBreakdown = (dailyData || [])
    .filter((point) => point.units > 0)
    .map((point) => ({ date: dateKey(point.date), units: point.units }))
    .slice(-12);
  outboundTrendDiagnostics.selectedSkuTodayBreakdown = (recentRecords || [])
    .filter((record) => record.date instanceof Date && dateKey(record.date) === todayKey())
    .map((record) => ({
      sku: record.sku,
      units: record.units,
      source: record.source || "",
      dateFieldUsed: record.dateFieldUsed || "",
      dateBasis: record.dateBasis || "",
      date: record.date.toISOString(),
    }))
    .slice(0, 12);
}

function getOutboundSourceScopeNotice() {
  return "현재 유효 재고 기록 기준 · backup/undo/마지막 엑셀 분석 결과는 기본 집계 제외";
}

function getTrendBasisNotice() {
  const basis = outboundTrendDiagnostics.trendDateBasis;
  const fieldText = outboundTrendDiagnostics.trendDateFieldUsed ? ` · 사용 필드 ${outboundTrendDiagnostics.trendDateFieldUsed}` : "";
  if (basis === "actualOutboundDate") return `실제 출고일 기준${fieldText}`;
  if (basis === "processingDate") return `엑셀 차감/처리일 기준${fieldText} · 실제 출고일 필드가 없으면 처리일에 수량이 몰릴 수 있습니다.`;
  if (basis === "mixed") return `혼합 날짜 기준${fieldText} · 실제 출고일과 처리일/기록일이 섞여 있어 진단 확인이 필요합니다.`;
  if (basis === "ambiguousDate" || basis === "recordedAt" || basis === "recordDate") return `${normalizeTrendDateBasisLabel(basis)}${fieldText} · 실제 출고일 필드가 없으면 날짜 해석에 주의가 필요합니다.`;
  return "날짜 기준 확인 필요";
}

function buildSkuOutboundTrend(sku, days = 30) {
  outboundTrendDiagnostics.functionCalled.trend = true;
  const targetSku = canonicalSku(sku);
  const today = startOfDay(new Date());
  const from = addDays(today, -(days - 1));
  const daily = new Map();
  for (let i = 0; i < days; i += 1) {
    const date = addDays(from, i);
    daily.set(dateKey(date), { date, units: 0 });
  }

  const allUniqueRecords = collectStoredOutboundTrendRecords();
  analyzeSelectedSkuSupplementalSources(targetSku);
  const allRecords = allUniqueRecords.filter((record) => canonicalSku(record.sku) === targetSku);
  outboundTrendDiagnostics.selectedSkuMatchedCount = allRecords.length;
  outboundTrendDiagnostics.selectedSkuAcceptedAfterDedupe = allRecords.length;
  outboundTrendDiagnostics.selectedSkuExcludedNameMismatch = Math.max(0, allUniqueRecords.length - allRecords.length);
  const recentRecords = [];
  allRecords.forEach((record) => {
    const date = startOfDay(record.date);
    if (Number.isNaN(date.getTime())) {
      incrementDiagnosticReason("dateParseFailed");
      return;
    }
    if (date < from || date > today) {
      incrementDiagnosticReason("oldRecord");
      outboundTrendDiagnostics.selectedSkuExcludedOldRecord += 1;
      return;
    }
    recentRecords.push(record);
    addSelectedSkuSample("selectedSkuFinalAcceptedSamples", buildSelectedRecordSample(record, "finalAccepted"));
    const key = dateKey(date);
    addTrendDateDiagnostics(record, key);
    if (!daily.has(key)) daily.set(key, { date, units: 0 });
    daily.get(key).units += record.units;
  });

  const dailyData = [...daily.values()].sort((a, b) => a.date - b.date);
  const total = dailyData.reduce((sum, item) => sum + item.units, 0);
  const activeDays = dailyData.filter((item) => item.units > 0).length;
  const averagePerDay = total > 0 ? total / days : 0;
  outboundTrendDiagnostics.recentOutboundCount = recentRecords.length;
  outboundTrendDiagnostics.selectedSkuRecentCount = recentRecords.length;
  if (INVENTORY_DEFS[targetSku]?.isBox && outboundTrendDiagnostics.selectedSkuBoxUsageCount > 0 && recentRecords.length === 0) {
    outboundTrendDiagnostics.selectedSkuHasBoxUsageOnly = true;
    outboundTrendDiagnostics.selectedSkuDiagnosticNote = "선택 품목은 포장 부자재이며, 박스 사용량은 boxUsages에 별도 저장되어 있어 상품 순출고 추적에는 자동 합산하지 않았습니다.";
  }
  finalizeTrendDateDiagnostics(dailyData, recentRecords);
  outboundTrendDiagnostics.averageDailyOutbound = averagePerDay;
  outboundTrendDiagnostics.selectedSkuDisplayReason = getSelectedSkuNoDataMessage(targetSku);
  return { days, total, activeDays, averagePerDay, dailyData, records: recentRecords, allRecords, dateBasis: outboundTrendDiagnostics.trendDateBasis };
}

function getTrendStatusForSku(sku) {
  outboundTrendDiagnostics.functionCalled.stockout = true;
  const targetSku = canonicalSku(sku);
  const stock = state.stock[targetSku] || null;
  const currentUnits = Math.max(0, cleanNumber(stock?.units));
  summarizeCurrentStockForDiagnostics(targetSku);
  outboundTrendDiagnostics.stockRead = !!stock;
  outboundTrendDiagnostics.stockUnitsTotal = currentUnits;
  outboundTrendDiagnostics.selectedStockUnits = currentUnits;
  outboundTrendDiagnostics.stockReadFailureReason = stock ? (currentUnits > 0 ? "" : "현재 재고 수량 0") : "선택 품목 재고 데이터를 찾지 못함";
  const trend = buildSkuOutboundTrend(targetSku, 30);
  if (!currentUnits) {
    return { trend, currentUnits, status: "noStock", value: "현재 재고 없음", note: "재고 수량이 0이거나 입력되지 않았습니다." };
  }
  if (!trend.total || trend.averagePerDay <= 0) {
    return { trend, currentUnits, status: "noOutbound", value: "출고 기록 부족", note: "최근 30일 기준으로 계산 가능한 출고 기록이 없습니다." };
  }
  const daysLeft = Math.max(1, Math.ceil(currentUnits / trend.averagePerDay));
  const depletionDate = addDays(new Date(), daysLeft);
  return {
    trend,
    currentUnits,
    status: "ok",
    daysLeft,
    depletionDate,
    value: `${formatTrendDate(depletionDate)} · 약 ${daysLeft.toLocaleString()}일`,
    note: `최근 30일 평균 ${Math.round(trend.averagePerDay).toLocaleString()}개/일 기준 · ${getTrendBasisNotice()}`,
  };
}

function formatTrendDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDetailNumber(value, suffix = "") {
  const num = Number(value || 0);
  return `${Number.isFinite(num) ? Math.round(num).toLocaleString("ko-KR") : "0"}${suffix}`;
}

function formatDetailAverage(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0개/일";
  const fixed = num >= 10 ? Math.round(num).toLocaleString("ko-KR") : num.toFixed(1);
  return `${fixed}개/일`;
}

function getStockoutVisualClass(status) {
  if (!status || status.status === "noStock") return "danger";
  if (status.status === "noOutbound") return "empty";
  if (status.status !== "ok") return "warning";
  const daysLeft = Number(status.daysLeft || 0);
  if (daysLeft > 0 && daysLeft <= 30) return "danger";
  if (daysLeft > 0 && daysLeft <= 90) return "warning";
  return "safe";
}

function getTrendBasisVisualClass() {
  const basis = outboundTrendDiagnostics.trendDateBasis;
  if (basis === "actualOutboundDate") return "is-safe";
  if (basis === "processingDate" || basis === "mixed" || basis === "recordDate" || basis === "recordedAt") return "is-warning";
  if (basis === "ambiguousDate" || basis === "missing") return "is-danger";
  return "is-info";
}

function getTrendBasisShortLabel() {
  const basis = outboundTrendDiagnostics.trendDateBasis;
  if (basis === "actualOutboundDate") return "실제 출고일 기준";
  if (basis === "processingDate") return "처리일 기준";
  if (basis === "mixed") return "혼합 날짜 기준";
  if (basis === "recordDate" || basis === "recordedAt") return "기록일 기준";
  if (basis === "ambiguousDate") return "날짜 기준 확인 필요";
  return "날짜 기준 확인 중";
}

function getRecentTrendPoints(trend, limit = 8) {
  const points = Array.isArray(trend?.dailyData) ? trend.dailyData : [];
  return points.filter((point) => Number(point?.units || 0) > 0).slice(-limit);
}


function getSelectedSkuNoDataMessage(sku) {
  sku = canonicalSku(sku);
  const diag = outboundTrendDiagnostics;
  if (diag.collectionStatus === "collect-error") return "출고 기록 수집 실패 · 진단 패널에서 실패 사유를 확인해주세요.";
  if (INVENTORY_DEFS[sku]?.isBox && diag.selectedSkuBoxUsageCount > 0) {
    return "박스 사용량 기록은 별도 데이터(boxUsages)에 저장되어 있어 상품 순출고 추적에는 자동 합산하지 않았습니다.";
  }
  if ((diag.selectedSkuRecentCount || 0) > 0) return "최근 30일 출고 기록이 집계되었습니다.";
  if ((diag.selectedSkuAcceptedAfterDedupe || 0) > 0 && (diag.selectedSkuRecentCount || 0) === 0) {
    return "선택 품목 출고 후보가 있고 대표 기록도 남았지만 최근 30일 범위 밖입니다.";
  }
  if ((diag.selectedSkuAcceptedBeforeDedupe || 0) > 0 && (diag.selectedSkuAcceptedAfterDedupe || 0) === 0) {
    return "선택 품목 출고 후보는 있으나 중복 제거 과정에서 모두 제외되었습니다. 진단 패널에서 원본/중복 기준을 확인해주세요.";
  }
  if ((diag.selectedSkuNameMatchedBeforeFilter || 0) > 0) {
    if ((diag.selectedSkuExcludedNoDate || 0) > 0) return "선택 품목 출고 후보가 있으나 날짜 정보가 없어 추적에서 제외되었습니다.";
    if ((diag.selectedSkuExcludedNoQuantity || 0) > 0) return "선택 품목 출고 후보가 있으나 수량 정보가 없어 추적에서 제외되었습니다.";
    if ((diag.selectedSkuExcludedType || 0) > 0) return "선택 품목 출고 후보는 있으나 출고 유형으로 확정되지 않아 제외되었습니다.";
    if ((diag.selectedSkuExcludedDuplicate || 0) > 0) return "선택 품목 후보는 있으나 중복 제거 후 대표 기록이 남지 않았습니다.";
    return "선택 품목과 유사하거나 일치하는 후보는 있으나 계산 가능한 출고 기록으로 확정되지 않았습니다.";
  }
  if ((diag.outboundCandidateCount || 0) > 0) {
    return "전체 출고 후보는 있으나 선택 품목과 일치하는 출고 기록이 없습니다.";
  }
  return "최근 30일 출고 기록이 없습니다.";
}

function refreshInventoryItemOrderTrendIfOpen() {
  const overlay = $("inventoryItemOverlay");
  if (!overlay || overlay.hidden || !activeInventoryDetailSku) return;
  renderInventoryItemOrderTrend();
}

function renderInventoryItemOrderTrend() {
  const overlay = $("inventoryItemOverlay");
  const rawActiveSku = activeInventoryDetailSku;
  const overlayOpen = !!(overlay && !overlay.hidden);

  if (!overlayOpen && !rawActiveSku) {
    if (outboundTrendDiagnostics.renderStatus === "not-rendered") {
      resetOutboundTrendDiagnostics();
      outboundTrendDiagnostics.functionCalled.render = true;
      outboundTrendDiagnostics.detailOverlayOpen = false;
      markOutboundTrendRenderSkip("품목 상세창이 열려 있지 않아 예상 소진일 렌더링을 건너뜀", "");
      try {
        getCandidateStorageKeys();
      } catch (error) {
        addDiagnosticRecordError(error, "renderInventoryItemOrderTrend.noOpenDetail");
      }
      renderOutboundTrendDiagnostics();
    }
    return;
  }

  resetOutboundTrendDiagnostics();
  outboundTrendDiagnostics.functionCalled.render = true;
  outboundTrendDiagnostics.detailOverlayOpen = overlayOpen;

  const sku = canonicalSku(rawActiveSku);
  outboundTrendDiagnostics.selectedSku = sku || "";
  outboundTrendDiagnostics.currentSku = sku || "";
  outboundTrendDiagnostics.selectedItemName = sku || "";
  outboundTrendDiagnostics.currentItemName = sku || "";

  const valueEl = $("inventoryItemStockoutValue");
  const noteEl = $("inventoryItemStockoutNote");
  const canvas = $("inventoryItemOrderChart");
  const meta = $("inventoryItemOrderTrendMeta");
  const summary = $("inventoryItemOrderTrendSummary");
  const empty = $("inventoryItemOrderChartEmpty");
  const list = $("inventoryItemOrderTrendList");
  const breakdown = $("inventoryItemOrderTrendBreakdown");
  const forecastCard = $("inventoryItemStockoutForecast");
  const trendTotalEl = $("inventoryItemTrendTotal");
  const trendAverageEl = $("inventoryItemTrendAverage");
  const trendActiveDaysEl = $("inventoryItemTrendActiveDays");
  const trendLastDateEl = $("inventoryItemTrendLastDate");
  const basisBadge = $("inventoryItemOrderTrendBasisBadge");

  if (!sku) {
    markOutboundTrendRenderSkip("선택된 품목 SKU가 없어 예상 소진일/순출고 추적을 계산하지 못함", "");
    try {
      collectStoredOutboundTrendRecords();
    } catch (error) {
      addDiagnosticRecordError(error, "renderInventoryItemOrderTrend.noSku.collect");
    }
    outboundTrendDiagnostics.renderStatus = "render-skipped";
    if (valueEl) valueEl.textContent = "데이터 확인 필요";
    if (noteEl) noteEl.textContent = "품목 정보가 없어 예상 소진일을 계산할 수 없습니다.";
    if (meta) meta.textContent = "선택 품목 정보가 없어 출고 기록을 연결하지 못했습니다.";
    if (empty) {
      empty.hidden = false;
      empty.textContent = "품목 정보가 없어 날짜별 출고 기록을 표시할 수 없습니다.";
    }
    if (summary) summary.innerHTML = `<div class="detail-empty">선택 품목 정보 확인이 필요합니다.</div>`;
    if (list) list.innerHTML = `<span class="muted">선택 품목 없음</span>`;
    if (breakdown) breakdown.innerHTML = `<span class="muted">선택 품목 없음</span>`;
    renderOutboundTrendDiagnostics();
    return;
  }

  try {
    const status = getTrendStatusForSku(sku);
    const trend = status.trend || { total: 0, activeDays: 0, averagePerDay: 0, dailyData: [], records: [] };
    const collectionFailed = outboundTrendDiagnostics.collectionStatus === "collect-error";
    const hasData = !collectionFailed && trend.total > 0;
    const recentPoints = (trend.dailyData || []).filter((point) => point.units > 0).slice(-7);
    const recentRecords = [...(trend.records || [])]
      .sort((a, b) => b.date - a.date)
      .slice(0, 6);

    outboundTrendDiagnostics.recentOutboundCount = trend.records?.length || 0;
    outboundTrendDiagnostics.averageDailyOutbound = trend.averagePerDay || 0;
    outboundTrendDiagnostics.renderStatus = collectionFailed ? "rendered-collect-error" : (hasData ? "rendered-with-data" : "rendered-no-records");

    if (forecastCard) {
      forecastCard.classList.remove("safe", "warning", "danger", "empty");
      forecastCard.classList.add(collectionFailed ? "danger" : getStockoutVisualClass(status));
    }
    const latestPoint = [...(trend.dailyData || [])].reverse().find((point) => Number(point?.units || 0) > 0);
    if (trendTotalEl) trendTotalEl.textContent = formatDetailNumber(trend.total, "개");
    if (trendAverageEl) trendAverageEl.textContent = formatDetailAverage(trend.averagePerDay);
    if (trendActiveDaysEl) trendActiveDaysEl.textContent = `${Number(trend.activeDays || 0).toLocaleString("ko-KR")}일`;
    if (trendLastDateEl) trendLastDateEl.textContent = latestPoint ? shortDateLabel(latestPoint.date) : "기록 없음";
    if (basisBadge) {
      basisBadge.textContent = getTrendBasisShortLabel();
      basisBadge.className = `sku-order-trend-basis ${getTrendBasisVisualClass()}`;
    }

    if (valueEl) valueEl.textContent = collectionFailed ? "데이터 확인 필요" : status.value;
    if (noteEl) {
      noteEl.textContent = collectionFailed
        ? "출고 기록 수집 중 오류가 있어 진단 패널의 마지막 오류와 record 단위 오류를 확인해야 합니다."
        : status.note;
    }
    if (meta) {
      meta.textContent = collectionFailed
        ? "출고 기록 수집 실패 · 진단 패널에서 실패 사유를 확인해주세요."
        : hasData
          ? `최근 30일 순출고 ${formatStock(sku, trend.total)} · 출고 발생 ${trend.activeDays.toLocaleString()}일 · 평균 ${Math.round(trend.averagePerDay).toLocaleString()}개/일 · ${getTrendBasisNotice()} · ${getOutboundSourceScopeNotice()}`
          : `${getSelectedSkuNoDataMessage(sku)} · ${getTrendBasisNotice()} · ${getOutboundSourceScopeNotice()}`;
    }

    if (summary) {
      summary.innerHTML = collectionFailed
        ? `<div class="detail-empty sku-trend-empty-card">출고 기록 수집 실패 · 진단 패널 확인 필요</div>`
        : hasData
          ? getRecentTrendPoints(trend, 4).map((point) => `
            <div class="sku-order-trend-pill">
              <span>${escapeHtml(shortDateLabel(point.date))}</span>
              <strong>${escapeHtml(formatDetailNumber(point.units, "개"))}</strong>
            </div>`).join("")
          : `<div class="detail-empty sku-trend-empty-card">${escapeHtml(getSelectedSkuNoDataMessage(sku))}</div>`;
    }

    if (breakdown) {
      const dailyBreakdown = getRecentTrendPoints(trend, 8).reverse();
      breakdown.innerHTML = hasData
        ? dailyBreakdown.map((point) => `
          <div class="sku-order-day-line is-compact">
            <span>${escapeHtml(shortDateLabel(point.date))}</span>
            <strong>${escapeHtml(formatDetailNumber(point.units, "개"))}</strong>
          </div>`).join("")
        : `<span class="muted">${escapeHtml(collectionFailed ? "출고 기록 수집 실패" : getSelectedSkuNoDataMessage(sku))}</span>`;
    }

    if (list) {
      list.innerHTML = hasData
        ? recentRecords.map((record) => `<div class="sku-order-day-line"><span>${escapeHtml(shortDateLabel(record.date))}</span><strong>${escapeHtml(formatDetailNumber(record.units, "개"))}</strong></div>`).join("")
        : `<span class="muted">${escapeHtml(collectionFailed ? "출고 기록 수집 실패" : getSelectedSkuNoDataMessage(sku))}</span>`;
    }

    if (empty) {
      empty.hidden = hasData;
      empty.textContent = collectionFailed ? "출고 기록을 수집하지 못했습니다." : getSelectedSkuNoDataMessage(sku);
    }

    if (!canvas || !canvas.getContext) {
      renderOutboundTrendDiagnostics();
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      renderOutboundTrendDiagnostics();
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 320;
    const height = Number(canvas.getAttribute("height")) || 260;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!hasData) {
      renderOutboundTrendDiagnostics();
      return;
    }

    const padding = { top: 54, right: width < 430 ? 16 : 24, bottom: 54, left: width < 430 ? 44 : 56 };
    const chartW = Math.max(1, width - padding.left - padding.right);
    const chartH = Math.max(1, height - padding.top - padding.bottom);
    const values = trend.dailyData.map((point) => Number(point.units || 0));
    const rawMaxValue = Math.max(...values, 1);
    const headroomValue = rawMaxValue * 1.18;
    const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(headroomValue)) - 1));
    const maxValue = Math.max(1, Math.ceil(headroomValue / magnitude) * magnitude);
    const stepX = chartW / Math.max(1, trend.dailyData.length - 1);
    const fontStack = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

    const roundPath = (x, y, w, h, r = 10) => {
      const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };
    const fillRoundRect = (x, y, w, h, r, fillStyle) => {
      ctx.fillStyle = fillStyle;
      roundPath(x, y, w, h, r);
      ctx.fill();
    };
    const strokeRoundRect = (x, y, w, h, r, strokeStyle, lineWidth = 1) => {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      roundPath(x, y, w, h, r);
      ctx.stroke();
    };
    const getPoint = (point, idx) => {
      const units = Number(point.units || 0);
      return {
        x: padding.left + idx * stepX,
        y: padding.top + chartH - (units / maxValue) * chartH,
        units,
        point,
        idx,
      };
    };
    const points = trend.dailyData.map(getPoint);

    const backdrop = ctx.createLinearGradient(0, 0, width, height);
    backdrop.addColorStop(0, "rgba(22, 28, 52, 0.96)");
    backdrop.addColorStop(0.58, "rgba(42, 37, 76, 0.98)");
    backdrop.addColorStop(1, "rgba(20, 27, 49, 0.96)");
    fillRoundRect(0, 0, width, height, 28, backdrop);

    const glow = ctx.createRadialGradient(width * 0.38, height * 0.1, 20, width * 0.38, height * 0.1, Math.max(width, height) * 0.8);
    glow.addColorStop(0, "rgba(255, 96, 170, 0.20)");
    glow.addColorStop(0.55, "rgba(84, 117, 255, 0.10)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    fillRoundRect(0, 0, width, height, 28, glow);

    const gridFractions = [0, 0.25, 0.5, 0.75, 1];
    ctx.font = `600 ${width < 430 ? 11 : 12}px ${fontStack}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    gridFractions.forEach((ratioLine) => {
      const y = padding.top + chartH * (1 - ratioLine);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.strokeStyle = ratioLine === 0 ? "rgba(255, 255, 255, 0.20)" : "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = ratioLine === 0 ? 1.3 : 1;
      ctx.stroke();
      const axisValue = Math.round(maxValue * ratioLine);
      if (ratioLine === 0 || ratioLine === 1 || width >= 430) {
        ctx.fillStyle = "rgba(226, 232, 240, 0.78)";
        const suffix = width < 430 ? "" : "개";
        ctx.fillText(`${axisValue.toLocaleString("ko-KR")}${suffix}`, padding.left - 10, y);
      }
    });

    const peakIndex = values.reduce((peakIdx, units, idx) => {
      if (peakIdx < 0) return units > 0 ? idx : peakIdx;
      return units > values[peakIdx] ? idx : peakIdx;
    }, -1);
    const nonZeroPoints = points.filter((entry) => entry.units > 0);

    const areaGradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    areaGradient.addColorStop(0, "rgba(255, 92, 168, 0.22)");
    areaGradient.addColorStop(0.68, "rgba(255, 92, 168, 0.06)");
    areaGradient.addColorStop(1, "rgba(255, 92, 168, 0)");
    if (points.length > 1) {
      ctx.beginPath();
      points.forEach((entry, idx) => {
        if (idx === 0) ctx.moveTo(entry.x, entry.y);
        else ctx.lineTo(entry.x, entry.y);
      });
      ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
      ctx.lineTo(points[0].x, padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();
    }

    ctx.beginPath();
    points.forEach((entry, idx) => {
      if (idx === 0) ctx.moveTo(entry.x, entry.y);
      else ctx.lineTo(entry.x, entry.y);
    });
    ctx.strokeStyle = "rgba(255, 92, 168, 0.98)";
    ctx.lineWidth = width < 430 ? 3.2 : 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255, 92, 168, 0.42)";
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.shadowBlur = 0;

    points.forEach((entry) => {
      const isPeak = entry.idx === peakIndex;
      const isNonZero = entry.units > 0;
      const radius = isPeak ? 6 : isNonZero ? 5 : 4;
      ctx.beginPath();
      ctx.arc(entry.x, entry.y, radius + 3, 0, Math.PI * 2);
      ctx.fillStyle = isNonZero ? "rgba(255, 255, 255, 0.20)" : "rgba(255, 255, 255, 0.10)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(entry.x, entry.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isNonZero ? "#111827" : "rgba(17, 24, 39, 0.86)";
      ctx.fill();
      ctx.lineWidth = isPeak ? 3 : 2.4;
      ctx.strokeStyle = isPeak ? "#ffffff" : "rgba(226, 232, 240, 0.90)";
      ctx.stroke();
    });

    const labelIndexes = new Set();
    if (peakIndex >= 0) labelIndexes.add(peakIndex);
    if (nonZeroPoints.length) {
      labelIndexes.add(nonZeroPoints[nonZeroPoints.length - 1].idx);
      const valueLabelStep = Math.max(1, Math.ceil(nonZeroPoints.length / (width < 430 ? 3 : 5)));
      nonZeroPoints.forEach((entry, orderIdx) => {
        if (orderIdx % valueLabelStep === 0 || entry.idx === peakIndex) labelIndexes.add(entry.idx);
      });
    }

    const placedLabelBoxes = [];
    const canPlaceLabel = (box, idx) => {
      if (idx === peakIndex) return true;
      return !placedLabelBoxes.some((placed) => {
        return !(box.x2 < placed.x1 || box.x1 > placed.x2 || box.y2 < placed.y1 || box.y1 > placed.y2);
      });
    };
    ctx.font = `800 ${width < 430 ? 12 : 13}px ${fontStack}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    [...labelIndexes].sort((a, b) => a - b).forEach((idx) => {
      const entry = points[idx];
      if (!entry || entry.units <= 0) return;
      const label = `${Math.round(entry.units).toLocaleString("ko-KR")}개`;
      const textWidth = Math.ceil(ctx.measureText(label).width);
      const boxW = Math.min(width - 18, textWidth + 18);
      const boxH = width < 430 ? 22 : 24;
      const boxX = Math.min(width - padding.right - boxW, Math.max(padding.left - 4, entry.x - boxW / 2));
      const boxY = Math.max(8, entry.y - boxH - 12);
      const box = { x1: boxX - 3, y1: boxY - 3, x2: boxX + boxW + 3, y2: boxY + boxH + 3 };
      if (!canPlaceLabel(box, idx)) return;
      placedLabelBoxes.push(box);
      fillRoundRect(boxX, boxY, boxW, boxH, 5, idx === peakIndex ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.90)");
      strokeRoundRect(boxX, boxY, boxW, boxH, 5, idx === peakIndex ? "rgba(255, 92, 168, 0.36)" : "rgba(255, 255, 255, 0.18)", 1);
      ctx.fillStyle = idx === peakIndex ? "#111827" : "#1f2937";
      ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
    });

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = `800 ${width < 430 ? 11 : 12}px ${fontStack}`;
    const labelEvery = Math.max(1, Math.ceil(trend.dailyData.length / (width < 430 ? 5 : 7)));
    const xLabelCandidates = trend.dailyData.map((point, idx) => ({
      point,
      idx,
      priority: idx === peakIndex ? 1 : Number(point.units || 0) > 0 ? 2 : (idx === 0 || idx === trend.dailyData.length - 1 ? 3 : idx % labelEvery === 0 ? 4 : 9),
    })).filter((entry) => entry.priority < 9).sort((a, b) => a.priority - b.priority || a.idx - b.idx);
    const xLabelBoxes = [];
    xLabelCandidates.forEach(({ point, idx }) => {
      const entry = points[idx];
      const dateLabel = shortDateLabel(point.date);
      const labelWidth = ctx.measureText(dateLabel).width + 14;
      const box = { x1: entry.x - labelWidth / 2, x2: entry.x + labelWidth / 2 };
      const overlaps = xLabelBoxes.some((placed) => !(box.x2 < placed.x1 || box.x1 > placed.x2));
      if (overlaps && idx !== peakIndex) return;
      xLabelBoxes.push(box);
      ctx.fillStyle = Number(point.units || 0) > 0 ? "rgba(255, 255, 255, 0.90)" : "rgba(203, 213, 225, 0.70)";
      ctx.fillText(dateLabel, entry.x, padding.top + chartH + 17);
    });
    renderOutboundTrendDiagnostics();
  } catch (error) {
    outboundTrendDiagnostics.lastError = error?.stack || error?.message || String(error);
    outboundTrendDiagnostics.renderStatus = "render-error";
    console.warn("[inventory trend] render failed", error);
    if (valueEl) valueEl.textContent = "데이터 확인 필요";
    if (noteEl) noteEl.textContent = "출고 기록 데이터 구조를 확인해야 합니다.";
    if (meta) meta.textContent = "출고 기록을 불러오지 못했습니다.";
    if (empty) {
      empty.hidden = false;
      empty.textContent = "출고 기록을 불러오지 못했습니다.";
    }
    if (summary) summary.innerHTML = "";
    if (breakdown) breakdown.innerHTML = `<span class="muted">오류 확인 필요</span>`;
    if (list) list.innerHTML = `<span class="muted">오류 확인 필요</span>`;
    renderOutboundTrendDiagnostics();
  }
}

function buildOutboundDiagnosticsText() {
  const payload = {
    generatedAt: outboundTrendDiagnostics.generatedAt,
    cacheVersion: outboundTrendDiagnostics.cacheVersion,
    renderStatus: outboundTrendDiagnostics.renderStatus,
    functionCalled: outboundTrendDiagnostics.functionCalled,
    localStorageAvailable: outboundTrendDiagnostics.localStorageAvailable,
    localStorageFailureReason: outboundTrendDiagnostics.localStorageFailureReason,
    scannedKeys: outboundTrendDiagnostics.scannedKeys,
    keySummaries: outboundTrendDiagnostics.keySummaries,
    candidateRecordCount: outboundTrendDiagnostics.candidateRecordCount,
    outboundCandidateCount: outboundTrendDiagnostics.outboundCandidateCount,
    recentOutboundCount: outboundTrendDiagnostics.recentOutboundCount,
    stockRead: outboundTrendDiagnostics.stockRead,
    stockUnitsTotal: outboundTrendDiagnostics.stockUnitsTotal,
    averageDailyOutbound: outboundTrendDiagnostics.averageDailyOutbound,
    duplicateExcludedCount: outboundTrendDiagnostics.duplicateExcludedCount,
    atFieldDetectedCount: outboundTrendDiagnostics.atFieldDetectedCount,
    atParsedSuccessCount: outboundTrendDiagnostics.atParsedSuccessCount,
    atParseFailedCount: outboundTrendDiagnostics.atParseFailedCount,
    stockReadFailureReason: outboundTrendDiagnostics.stockReadFailureReason,
    renderSkipReason: outboundTrendDiagnostics.renderSkipReason,
    collectionStatus: outboundTrendDiagnostics.collectionStatus,
    selectedSku: outboundTrendDiagnostics.selectedSku,
    currentSku: outboundTrendDiagnostics.currentSku,
    selectedItemName: outboundTrendDiagnostics.selectedItemName,
    currentItemName: outboundTrendDiagnostics.currentItemName,
    selectedStockUnits: outboundTrendDiagnostics.selectedStockUnits,
    totalStockUnitsAll: outboundTrendDiagnostics.totalStockUnitsAll,
    detailOverlayOpen: outboundTrendDiagnostics.detailOverlayOpen,
    selectedSkuCandidateCount: outboundTrendDiagnostics.selectedSkuCandidateCount,
    selectedSkuMatchedCount: outboundTrendDiagnostics.selectedSkuMatchedCount,
    selectedSkuRecentCount: outboundTrendDiagnostics.selectedSkuRecentCount,
    selectedSkuExcludedNoDate: outboundTrendDiagnostics.selectedSkuExcludedNoDate,
    selectedSkuExcludedNoQuantity: outboundTrendDiagnostics.selectedSkuExcludedNoQuantity,
    selectedSkuExcludedNameMismatch: outboundTrendDiagnostics.selectedSkuExcludedNameMismatch,
    selectedSkuExcludedType: outboundTrendDiagnostics.selectedSkuExcludedType,
    selectedSkuExcludedDuplicate: outboundTrendDiagnostics.selectedSkuExcludedDuplicate,
    selectedSkuExcludedOldRecord: outboundTrendDiagnostics.selectedSkuExcludedOldRecord,
    selectedSkuPossibleNameMatches: outboundTrendDiagnostics.selectedSkuPossibleNameMatches,
    selectedSkuRecordSamples: outboundTrendDiagnostics.selectedSkuRecordSamples,
    selectedSkuExcludedSamples: outboundTrendDiagnostics.selectedSkuExcludedSamples,
    selectedSkuBoxUsageCount: outboundTrendDiagnostics.selectedSkuBoxUsageCount,
    selectedSkuBoxUsageRecordCount: outboundTrendDiagnostics.selectedSkuBoxUsageRecordCount,
    selectedSkuDeductionCount: outboundTrendDiagnostics.selectedSkuDeductionCount,
    selectedSkuDeductionRecordCount: outboundTrendDiagnostics.selectedSkuDeductionRecordCount,
    selectedSkuHasBoxUsageOnly: outboundTrendDiagnostics.selectedSkuHasBoxUsageOnly,
    selectedSkuNameMatchedBeforeFilter: outboundTrendDiagnostics.selectedSkuNameMatchedBeforeFilter,
    selectedSkuTypeAcceptedCount: outboundTrendDiagnostics.selectedSkuTypeAcceptedCount,
    selectedSkuDateAcceptedCount: outboundTrendDiagnostics.selectedSkuDateAcceptedCount,
    selectedSkuQuantityAcceptedCount: outboundTrendDiagnostics.selectedSkuQuantityAcceptedCount,
    selectedSkuAcceptedBeforeDedupe: outboundTrendDiagnostics.selectedSkuAcceptedBeforeDedupe,
    selectedSkuDuplicateExcludedCount: outboundTrendDiagnostics.selectedSkuDuplicateExcludedCount,
    selectedSkuAcceptedAfterDedupe: outboundTrendDiagnostics.selectedSkuAcceptedAfterDedupe,
    selectedSkuDedupeRepresentativeSamples: outboundTrendDiagnostics.selectedSkuDedupeRepresentativeSamples,
    selectedSkuDuplicateSamples: outboundTrendDiagnostics.selectedSkuDuplicateSamples,
    selectedSkuRejectedByTypeSamples: outboundTrendDiagnostics.selectedSkuRejectedByTypeSamples,
    selectedSkuRejectedByDateSamples: outboundTrendDiagnostics.selectedSkuRejectedByDateSamples,
    selectedSkuRejectedByQuantitySamples: outboundTrendDiagnostics.selectedSkuRejectedByQuantitySamples,
    selectedSkuFinalAcceptedSamples: outboundTrendDiagnostics.selectedSkuFinalAcceptedSamples,
    selectedSkuDisplayReason: outboundTrendDiagnostics.selectedSkuDisplayReason,
    selectedSkuDedupeStrategy: outboundTrendDiagnostics.selectedSkuDedupeStrategy,
    selectedSkuPrimarySourceCount: outboundTrendDiagnostics.selectedSkuPrimarySourceCount,
    selectedSkuBackupSourceCount: outboundTrendDiagnostics.selectedSkuBackupSourceCount,
    selectedSkuUndoSourceCount: outboundTrendDiagnostics.selectedSkuUndoSourceCount,
    selectedSkuDiagnosticNote: outboundTrendDiagnostics.selectedSkuDiagnosticNote,
    trendDateSource: outboundTrendDiagnostics.trendDateSource,
    trendDateFieldUsed: outboundTrendDiagnostics.trendDateFieldUsed,
    trendDateBasis: outboundTrendDiagnostics.trendDateBasis,
    outboundTrendCalculationSources: outboundTrendDiagnostics.outboundTrendCalculationSources,
    outboundTrendDiagnosticOnlySources: outboundTrendDiagnostics.outboundTrendDiagnosticOnlySources,
    excludedDiagnosticSources: outboundTrendDiagnostics.excludedDiagnosticSources,
    todayOutboundBySource: outboundTrendDiagnostics.todayOutboundBySource,
    dailyOutboundBySource: outboundTrendDiagnostics.dailyOutboundBySource,
    todayExcludedBackupUnits: outboundTrendDiagnostics.todayExcludedBackupUnits,
    todayExcludedUndoUnits: outboundTrendDiagnostics.todayExcludedUndoUnits,
    todayExcludedLastAnalysisUnits: outboundTrendDiagnostics.todayExcludedLastAnalysisUnits,
    todayIncludedActiveHistoryUnits: outboundTrendDiagnostics.todayIncludedActiveHistoryUnits,
    backupUndoExcludedCount: outboundTrendDiagnostics.backupUndoExcludedCount,
    lastAnalysisExcludedCount: outboundTrendDiagnostics.lastAnalysisExcludedCount,
    activeHistoryRecordCount: outboundTrendDiagnostics.activeHistoryRecordCount,
    calculationRecordCount: outboundTrendDiagnostics.calculationRecordCount,
    diagnosticOnlyRecordCount: outboundTrendDiagnostics.diagnosticOnlyRecordCount,
    sourceContributionSamples: outboundTrendDiagnostics.sourceContributionSamples,
    todaySourceContributionSamples: outboundTrendDiagnostics.todaySourceContributionSamples,
    selectedSkuCalculationSourceBreakdown: outboundTrendDiagnostics.selectedSkuCalculationSourceBreakdown,
    selectedSkuDiagnosticSourceBreakdown: outboundTrendDiagnostics.selectedSkuDiagnosticSourceBreakdown,
    restoredOrBackupRecordDetectedCount: outboundTrendDiagnostics.restoredOrBackupRecordDetectedCount,
    dailyOutboundSamples: outboundTrendDiagnostics.dailyOutboundSamples,
    todayOutboundTotal: outboundTrendDiagnostics.todayOutboundTotal,
    todayOutboundRecordCount: outboundTrendDiagnostics.todayOutboundRecordCount,
    todayOutboundSamples: outboundTrendDiagnostics.todayOutboundSamples,
    recordsGroupedByProcessingDateCount: outboundTrendDiagnostics.recordsGroupedByProcessingDateCount,
    recordsGroupedByActualOutboundDateCount: outboundTrendDiagnostics.recordsGroupedByActualOutboundDateCount,
    dateAmbiguousRecordCount: outboundTrendDiagnostics.dateAmbiguousRecordCount,
    dateAmbiguousSamples: outboundTrendDiagnostics.dateAmbiguousSamples,
    selectedSkuDailyBreakdown: outboundTrendDiagnostics.selectedSkuDailyBreakdown,
    selectedSkuTodayBreakdown: outboundTrendDiagnostics.selectedSkuTodayBreakdown,
    selectedSkuDateFieldCounts: outboundTrendDiagnostics.selectedSkuDateFieldCounts,
    selectedSkuDateBasisCounts: outboundTrendDiagnostics.selectedSkuDateBasisCounts,
    dataSourcesRead: outboundTrendDiagnostics.dataSourcesRead,
    excludedReasons: outboundTrendDiagnostics.excludedReasons,
    candidateFields: outboundTrendDiagnostics.candidateFields,
    recordErrors: outboundTrendDiagnostics.recordErrors,
    lastError: outboundTrendDiagnostics.lastError,
    supabaseStatus: outboundTrendDiagnostics.supabaseStatus,
    note: outboundTrendDiagnostics.note,
  };
  return JSON.stringify(payload, null, 2);
}


function outboundDiagNumber(value, suffix = "") {
  const num = Number(value || 0);
  return `${Number.isFinite(num) ? num.toLocaleString() : "0"}${suffix}`;
}

function outboundDiagText(value, fallback = "없음") {
  if (value == null || value === "") return fallback;
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  if (typeof value === "object") return Object.keys(value).length ? JSON.stringify(value) : fallback;
  return String(value);
}

function outboundDiagVariantByCount(count, zeroVariant = "quiet") {
  return Number(count || 0) > 0 ? "warn" : zeroVariant;
}

function outboundDiagRenderVariant(diag) {
  if (diag.lastError || String(diag.renderStatus || "").includes("error")) return "danger";
  if (String(diag.renderStatus || "").includes("rendered")) return "success";
  if (String(diag.renderStatus || "").includes("skipped")) return "warn";
  return "info";
}

function outboundDiagDateVariant(basis = "") {
  if (basis === "actualOutboundDate") return "success";
  if (basis === "processingDate" || basis === "mixed" || basis === "recordDate" || basis === "recordedAt") return "warn";
  if (basis === "ambiguousDate" || basis === "missing") return "danger";
  return "info";
}

function outboundDiagCard(title, value, meta = "", variant = "neutral") {
  return `
    <article class="outbound-diagnostic-kpi is-${escapeHtml(variant)}">
      <span class="outbound-diagnostic-kpi-label">${escapeHtml(title)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${meta ? `<em>${escapeHtml(meta)}</em>` : ""}
    </article>
  `;
}

function outboundDiagPill(label, value = "", variant = "neutral") {
  const text = value === "" || value == null ? label : `${label} ${value}`;
  return `<span class="outbound-diagnostic-pill is-${escapeHtml(variant)}">${escapeHtml(text)}</span>`;
}

function outboundDiagPillsFromArray(items, variant = "neutral", emptyText = "없음") {
  if (!Array.isArray(items) || !items.length) return outboundDiagPill(emptyText, "", "quiet");
  return items.map((item) => outboundDiagPill(String(item), "", variant)).join("");
}

function outboundDiagPillsFromMap(map, zeroText = "없음", activeVariant = "warn") {
  const entries = Object.entries(map || {});
  if (!entries.length) return outboundDiagPill(zeroText, "", "quiet");
  return entries.map(([key, raw]) => {
    const value = typeof raw === "object" && raw !== null
      ? `${outboundDiagNumber(raw.count || 0)}건 · ${outboundDiagNumber(raw.units || raw.value || 0)}개`
      : outboundDiagNumber(raw || 0);
    const variant = Number(typeof raw === "object" && raw !== null ? raw.count || raw.units || 0 : raw || 0) > 0 ? activeVariant : "quiet";
    return outboundDiagPill(key, value, variant);
  }).join("");
}

function outboundDiagSimpleRows(rows) {
  return rows.map(([label, value, variant = "neutral"]) => `
    <div class="outbound-diagnostic-row is-${escapeHtml(variant)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function outboundDiagSampleTitle(item) {
  if (!item || typeof item !== "object") return String(item ?? "-");
  const parts = [];
  if (item.date) parts.push(item.date);
  if (item.sku) parts.push(item.sku);
  if (item.units != null) parts.push(`${outboundDiagNumber(item.units)}개`);
  if (item.source) parts.push(item.source);
  if (item.reason) parts.push(item.reason);
  if (item.dateFieldUsed) parts.push(`필드:${item.dateFieldUsed}`);
  if (item.basis || item.dateBasis) parts.push(`기준:${item.basis || item.dateBasis}`);
  return parts.filter(Boolean).join(" · ") || JSON.stringify(item);
}

function outboundDiagSampleRows(items, limit = 3) {
  if (!Array.isArray(items) || !items.length) return '<p class="outbound-diagnostic-empty">샘플 없음</p>';
  return items.slice(0, limit).map((item) => `
    <li>
      <span>${escapeHtml(outboundDiagSampleTitle(item))}</span>
      <code>${escapeHtml(JSON.stringify(item))}</code>
    </li>
  `).join("");
}

function outboundDiagSummary(title, meta = "", desc = "") {
  const metaHtml = meta ? `<span class="outbound-diagnostic-summary-count">${escapeHtml(String(meta))}</span>` : "";
  const descHtml = desc ? `<span class="outbound-diagnostic-summary-desc">${escapeHtml(String(desc))}</span>` : "";
  return `
    <summary class="outbound-diagnostic-summary">
      <span class="outbound-diagnostic-summary-main">
        <span class="outbound-diagnostic-summary-title">${escapeHtml(String(title || "상세 보기"))}</span>
        ${descHtml}
      </span>
      <span class="outbound-diagnostic-summary-side">
        ${metaHtml}
        <span class="outbound-diagnostic-summary-chevron" aria-hidden="true"></span>
      </span>
    </summary>
  `;
}

function outboundDiagDetails(title, items, limit = 3, open = false) {
  const count = Array.isArray(items) ? items.length : 0;
  return `
    <details class="outbound-diagnostic-details" ${open ? "open" : ""}>
      ${outboundDiagSummary(title, outboundDiagNumber(count, "건"), "샘플 상세") }
      <ul class="outbound-diagnostic-sample-list">${outboundDiagSampleRows(items, limit)}</ul>
    </details>
  `;
}

function outboundDiagJsonDetails(title, payload, open = false) {
  return `
    <details class="outbound-diagnostic-json" ${open ? "open" : ""}>
      ${outboundDiagSummary(title, "", "원본 데이터") }
      <pre>${escapeHtml(typeof payload === "string" ? payload : JSON.stringify(payload || {}, null, 2))}</pre>
    </details>
  `;
}

function renderOutboundTrendDiagnostics() {
  const body = $("outboundDiagnosticsBody");
  if (!body) return;
  const diag = outboundTrendDiagnostics || createEmptyOutboundTrendDiagnostics();
  const renderVariant = outboundDiagRenderVariant(diag);
  const collectVariant = diag.collectionStatus === "collected" ? "success" : (diag.collectionStatus === "not-started" ? "warn" : "info");
  const localVariant = diag.localStorageAvailable ? "success" : "warn";
  const errorVariant = diag.lastError ? "danger" : "success";
  const dateVariant = outboundDiagDateVariant(diag.trendDateBasis);
  const rawJson = buildOutboundDiagnosticsText();
  const excludedReasons = diag.excludedReasons || {};
  const reasonPills = Object.entries(excludedReasons).map(([reason, count]) => (
    outboundDiagPill(reason, outboundDiagNumber(count), Number(count || 0) > 0 ? "warn" : "quiet")
  )).join("") || outboundDiagPill("제외 사유 없음", "", "quiet");
  const keyRows = (diag.keySummaries || []).slice(0, 18).map((summary) => `
    <tr>
      <td>${escapeHtml(summary.key || "-")}</td>
      <td>${escapeHtml(summary.type || "-")}</td>
      <td>${escapeHtml(String(summary.count ?? 0))}</td>
      <td>${escapeHtml(summary.error || "")}</td>
    </tr>
  `).join("") || '<tr><td colspan="4" class="muted">발견된 관련 키가 없습니다.</td></tr>';

  body.innerHTML = `
    <div class="outbound-diagnostic-shell">
      <div class="outbound-diagnostic-toolbar">
        <div>
          <span class="outbound-diagnostic-eyebrow">Admin diagnostic dashboard</span>
          <h3>출고 데이터 진단 요약</h3>
          <p>${escapeHtml(getOutboundSourceScopeNotice ? getOutboundSourceScopeNotice() : "현재 유효 기록 기준으로 진단합니다.")}</p>
        </div>
        <div class="outbound-diagnostic-actions">
          <button type="button" class="outbound-diagnostic-copy" onclick="copyOutboundTrendDiagnostics()">진단 JSON 복사</button>
        </div>
      </div>

      <section class="outbound-diagnostic-kpi-grid" aria-label="출고 데이터 진단 핵심 요약">
        ${outboundDiagCard("렌더 상태", outboundDiagText(diag.renderStatus), diag.lastError ? "오류 확인 필요" : "화면 렌더 흐름", renderVariant)}
        ${outboundDiagCard("수집 상태", outboundDiagText(diag.collectionStatus), `collect:${!!diag.functionCalled?.collect} · trend:${!!diag.functionCalled?.trend}`, collectVariant)}
        ${outboundDiagCard("계산 기록", outboundDiagNumber(diag.calculationRecordCount, "건"), `후보 ${outboundDiagNumber(diag.outboundCandidateCount, "건")}`, "info")}
        ${outboundDiagCard("진단 제외", outboundDiagNumber(diag.diagnosticOnlyRecordCount, "건"), `backup/undo ${outboundDiagNumber(diag.backupUndoExcludedCount, "건")}`, Number(diag.diagnosticOnlyRecordCount || 0) ? "warn" : "quiet")}
        ${outboundDiagCard("오늘 집계", outboundDiagNumber(diag.todayOutboundTotal, "개"), `${outboundDiagNumber(diag.todayOutboundRecordCount, "건")} · 계산포함 ${outboundDiagNumber(diag.todayIncludedActiveHistoryUnits, "개")}`, Number(diag.todayOutboundTotal || 0) ? "warn" : "success")}
        ${outboundDiagCard("선택 품목", outboundDiagText(diag.currentSku || diag.selectedSku, "선택 없음"), `재고 ${outboundDiagNumber(diag.selectedStockUnits, "개")}`, "neutral")}
        ${outboundDiagCard("localStorage", diag.localStorageAvailable ? "사용 가능" : "확인 필요", outboundDiagText(diag.localStorageFailureReason, "정상"), localVariant)}
        ${outboundDiagCard("lastError", diag.lastError ? "오류 있음" : "오류 없음", diag.lastError ? String(diag.lastError).slice(0, 70) : "record 단위 오류 없음", errorVariant)}
      </section>

      <section class="outbound-diagnostic-card-grid">
        <article class="outbound-diagnostic-card is-featured">
          <div class="outbound-diagnostic-card-head">
            <div>
              <span>Selected SKU</span>
              <h4>선택 품목 진단</h4>
            </div>
            ${outboundDiagPill(diag.selectedSkuRecentCount > 0 ? "최근 출고 있음" : "최근 출고 없음", outboundDiagNumber(diag.selectedSkuRecentCount, "건"), diag.selectedSkuRecentCount > 0 ? "success" : "warn")}
          </div>
          <div class="outbound-diagnostic-row-grid">
            ${outboundDiagSimpleRows([
              ["품목", outboundDiagText(diag.currentSku || diag.selectedSku, "없음"), "neutral"],
              ["현재 재고", outboundDiagNumber(diag.selectedStockUnits, "개"), "info"],
              ["최근 30일", outboundDiagNumber(diag.selectedSkuRecentCount, "건"), Number(diag.selectedSkuRecentCount || 0) ? "success" : "warn"],
              ["dedupe 후", outboundDiagNumber(diag.selectedSkuAcceptedAfterDedupe, "건"), Number(diag.selectedSkuAcceptedAfterDedupe || 0) ? "success" : "warn"],
              ["중복 제외", outboundDiagNumber(diag.selectedSkuDuplicateExcludedCount, "건"), Number(diag.selectedSkuDuplicateExcludedCount || 0) ? "warn" : "quiet"],
              ["deductions", `${outboundDiagNumber(diag.selectedSkuDeductionCount, "개")} / ${outboundDiagNumber(diag.selectedSkuDeductionRecordCount, "건")}`, Number(diag.selectedSkuDeductionRecordCount || 0) ? "info" : "quiet"],
            ])}
          </div>
          <div class="outbound-diagnostic-message is-${escapeHtml(diag.selectedSkuDisplayReason ? "info" : "quiet")}">${escapeHtml(diag.selectedSkuDisplayReason || diag.selectedSkuDiagnosticNote || getSelectedSkuNoDataMessage(diag.currentSku || diag.selectedSku || ""))}</div>
          ${outboundDiagJsonDetails("일자별 집계 보기", diag.selectedSkuDailyBreakdown || [])}
          ${outboundDiagDetails("최종 집계 샘플", diag.selectedSkuFinalAcceptedSamples || [], 3)}
          ${outboundDiagDetails("대표 기록 샘플", diag.selectedSkuDedupeRepresentativeSamples || [], 3)}
          ${outboundDiagDetails("중복 제외 샘플", diag.selectedSkuDuplicateSamples || [], 3)}
        </article>

        <article class="outbound-diagnostic-card">
          <div class="outbound-diagnostic-card-head">
            <div>
              <span>Sources</span>
              <h4>소스별 기여도</h4>
            </div>
            ${outboundDiagPill("계산/진단", `${outboundDiagNumber(diag.calculationRecordCount)} / ${outboundDiagNumber(diag.diagnosticOnlyRecordCount)}`, "info")}
          </div>
          <h5>계산 포함 소스</h5>
          <div class="outbound-diagnostic-pill-row">${outboundDiagPillsFromArray(diag.outboundTrendCalculationSources, "success", "계산 포함 소스 없음")}</div>
          <h5>진단 전용 · 계산 제외</h5>
          <div class="outbound-diagnostic-pill-row">${outboundDiagPillsFromArray(diag.excludedDiagnosticSources || diag.outboundTrendDiagnosticOnlySources, "warn", "진단 전용 소스 없음")}</div>
          <div class="outbound-diagnostic-row-grid compact">
            ${outboundDiagSimpleRows([
              ["오늘 포함", outboundDiagNumber(diag.todayIncludedActiveHistoryUnits, "개"), Number(diag.todayIncludedActiveHistoryUnits || 0) ? "success" : "quiet"],
              ["backup 제외", outboundDiagNumber(diag.todayExcludedBackupUnits, "개"), Number(diag.todayExcludedBackupUnits || 0) ? "warn" : "quiet"],
              ["undo 제외", outboundDiagNumber(diag.todayExcludedUndoUnits, "개"), Number(diag.todayExcludedUndoUnits || 0) ? "warn" : "quiet"],
              ["lastAnalysis 제외", outboundDiagNumber(diag.todayExcludedLastAnalysisUnits, "개"), Number(diag.todayExcludedLastAnalysisUnits || 0) ? "warn" : "quiet"],
            ])}
          </div>
          ${outboundDiagJsonDetails("오늘 소스별 수량", diag.todayOutboundBySource || {})}
          ${outboundDiagJsonDetails("선택 SKU 계산 소스", diag.selectedSkuCalculationSourceBreakdown || {})}
          ${outboundDiagJsonDetails("선택 SKU 진단전용 소스", diag.selectedSkuDiagnosticSourceBreakdown || {})}
          ${outboundDiagDetails("오늘 소스 샘플", diag.todaySourceContributionSamples || [], 3)}
          ${outboundDiagDetails("소스 기여 샘플", diag.sourceContributionSamples || [], 3)}
        </article>

        <article class="outbound-diagnostic-card">
          <div class="outbound-diagnostic-card-head">
            <div>
              <span>Date basis</span>
              <h4>날짜 기준</h4>
            </div>
            ${outboundDiagPill(normalizeTrendDateBasisLabel ? normalizeTrendDateBasisLabel(diag.trendDateBasis) : outboundDiagText(diag.trendDateBasis), "", dateVariant)}
          </div>
          <div class="outbound-diagnostic-message is-${escapeHtml(dateVariant)}">${escapeHtml(diag.trendDateSource || getTrendBasisNotice())}</div>
          <div class="outbound-diagnostic-row-grid compact">
            ${outboundDiagSimpleRows([
              ["날짜 필드", outboundDiagText(diag.trendDateFieldUsed, "확인 필요"), dateVariant],
              ["실제 출고일 그룹", outboundDiagNumber(diag.recordsGroupedByActualOutboundDateCount, "건"), Number(diag.recordsGroupedByActualOutboundDateCount || 0) ? "success" : "quiet"],
              ["처리일 그룹", outboundDiagNumber(diag.recordsGroupedByProcessingDateCount, "건"), Number(diag.recordsGroupedByProcessingDateCount || 0) ? "warn" : "quiet"],
              ["날짜 확인 필요", outboundDiagNumber(diag.dateAmbiguousRecordCount, "건"), Number(diag.dateAmbiguousRecordCount || 0) ? "danger" : "quiet"],
            ])}
          </div>
          ${outboundDiagJsonDetails("선택 SKU 날짜 필드", diag.selectedSkuDateFieldCounts || {})}
          ${outboundDiagJsonDetails("선택 SKU 날짜 기준 분포", diag.selectedSkuDateBasisCounts || {})}
          ${outboundDiagDetails("오늘 집계 샘플", diag.todayOutboundSamples || [], 3)}
          ${outboundDiagDetails("날짜 확인 필요 샘플", diag.dateAmbiguousSamples || [], 3)}
        </article>

        <article class="outbound-diagnostic-card">
          <div class="outbound-diagnostic-card-head">
            <div>
              <span>Excluded</span>
              <h4>제외 사유</h4>
            </div>
            ${outboundDiagPill("중복 제외", outboundDiagNumber(diag.duplicateExcludedCount, "건"), Number(diag.duplicateExcludedCount || 0) ? "warn" : "quiet")}
          </div>
          <div class="outbound-diagnostic-pill-row">${reasonPills}</div>
          <div class="outbound-diagnostic-row-grid compact">
            ${outboundDiagSimpleRows([
              ["선택 이름 불일치", outboundDiagNumber(diag.selectedSkuExcludedNameMismatch, "건"), outboundDiagVariantByCount(diag.selectedSkuExcludedNameMismatch)],
              ["선택 날짜 없음", outboundDiagNumber(diag.selectedSkuExcludedNoDate, "건"), outboundDiagVariantByCount(diag.selectedSkuExcludedNoDate)],
              ["선택 수량 없음", outboundDiagNumber(diag.selectedSkuExcludedNoQuantity, "건"), outboundDiagVariantByCount(diag.selectedSkuExcludedNoQuantity)],
              ["선택 유형 제외", outboundDiagNumber(diag.selectedSkuExcludedType, "건"), outboundDiagVariantByCount(diag.selectedSkuExcludedType)],
              ["선택 중복 제외", outboundDiagNumber(diag.selectedSkuExcludedDuplicate, "건"), outboundDiagVariantByCount(diag.selectedSkuExcludedDuplicate)],
              ["record 오류", outboundDiagNumber((diag.recordErrors || []).length, "건"), (diag.recordErrors || []).length ? "danger" : "success"],
            ])}
          </div>
          ${outboundDiagDetails("유형 제외 샘플", diag.selectedSkuRejectedByTypeSamples || [], 3)}
          ${outboundDiagDetails("날짜 제외 샘플", diag.selectedSkuRejectedByDateSamples || [], 3)}
          ${outboundDiagDetails("수량 제외 샘플", diag.selectedSkuRejectedByQuantitySamples || [], 3)}
          ${outboundDiagDetails("record 오류", diag.recordErrors || [], 3)}
        </article>
      </section>

      <section class="outbound-diagnostic-accordion">
        <details class="outbound-diagnostic-json">
          ${outboundDiagSummary("발견 필드명", outboundDiagNumber((diag.candidateFields || []).length, "개"), "record 필드 목록")}
          <div class="outbound-diagnostic-pill-row">${outboundDiagPillsFromArray((diag.candidateFields || []).slice(0, 80), "neutral", "확인된 필드 없음")}</div>
        </details>
        <details class="outbound-diagnostic-json">
          ${outboundDiagSummary("읽은 데이터 출처", outboundDiagNumber((diag.dataSourcesRead || []).length, "개"), "수집된 후보 소스")}
          <div class="outbound-diagnostic-pill-row">${outboundDiagPillsFromArray(diag.dataSourcesRead || [], "neutral", "읽은 데이터 출처 없음")}</div>
        </details>
        <details class="outbound-diagnostic-json">
          ${outboundDiagSummary("관련 저장 키", outboundDiagNumber((diag.keySummaries || []).length, "개"), "localStorage/state 요약")}
          <div class="diagnostic-table-wrap">
            <table class="diagnostic-table">
              <thead><tr><th>키</th><th>타입</th><th>개수/요약</th><th>오류</th></tr></thead>
              <tbody>${keyRows}</tbody>
            </table>
          </div>
        </details>
        <details class="outbound-diagnostic-json">
          ${outboundDiagSummary("마지막 오류 / 사유", diag.lastError ? "오류" : "정상", "렌더·재고·localStorage 상태")}
          <pre>${escapeHtml(diag.lastError || "오류 없음")}</pre>
          <div class="outbound-diagnostic-row-grid compact">
            ${outboundDiagSimpleRows([
              ["재고 사유", outboundDiagText(diag.stockReadFailureReason, "없음"), diag.stockRead ? "success" : "warn"],
              ["localStorage 사유", outboundDiagText(diag.localStorageFailureReason, "없음"), diag.localStorageAvailable ? "success" : "warn"],
              ["렌더 건너뜀", outboundDiagText(diag.renderSkipReason, "없음"), diag.renderSkipReason ? "warn" : "success"],
              ["파싱 실패 키", outboundDiagNumber(diag.parseFailedKeys, "개"), Number(diag.parseFailedKeys || 0) ? "warn" : "success"],
            ])}
          </div>
        </details>
        <details class="outbound-diagnostic-json">
          ${outboundDiagSummary("원본 JSON 보기", "JSON", "복사되는 진단 원문")}
          <pre>${escapeHtml(rawJson)}</pre>
        </details>
      </section>
      <p class="outbound-diagnostic-note">${escapeHtml(diag.note || "")}</p>
    </div>
  `;
}

function getOutboundTrendDiagnosticsCopy() {
  return buildOutboundDiagnosticsText();
}

function renderOutboundTrendDiagnosticPanel() {
  return renderOutboundTrendDiagnostics();
}

async function copyOutboundTrendDiagnostics() {
  if (outboundTrendDiagnostics.renderStatus === "not-rendered") {
    renderInventoryItemOrderTrend();
  }
  const text = getOutboundTrendDiagnosticsCopy();
  const buttons = Array.from(document.querySelectorAll("#copyOutboundDiagnosticsBtn, .outbound-diagnostic-copy"));
  const originalLabels = buttons.map((button) => button.textContent);
  const setCopyButtonState = (label, isError = false) => {
    buttons.forEach((button) => {
      button.textContent = label;
      button.classList.toggle("is-copy-error", !!isError);
      button.classList.toggle("is-copy-success", !isError && label.includes("완료"));
    });
  };
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopyButtonState("복사 완료");
  } catch (error) {
    setCopyButtonState("복사 실패", true);
  } finally {
    window.setTimeout(() => {
      buttons.forEach((button, index) => {
        button.textContent = originalLabels[index] || "진단 JSON 복사";
        button.classList.remove("is-copy-error", "is-copy-success");
      });
    }, 1600);
  }
}

function renderInventoryManualAdjustPanel(sku, def, currentUnits) {
  if (!isEditorSession()) return "";
  const safeSku = escapeHtml(sku);
  const unitText = def?.unitLabel ? `${escapeHtml(def.unitLabel)} 기준` : "총 낱개 기준";
  return `
      <section class="inventory-adjust-card" data-inventory-adjust-card="${safeSku}">
        <div class="inventory-adjust-head">
          <div>
            <span class="eyebrow">ADMIN ONLY</span>
            <strong>재고 직접 수정</strong>
          </div>
          <button type="button" class="btn small" data-inventory-adjust-open="${safeSku}">재고 수정</button>
        </div>
        <p class="inventory-adjust-note">현재 재고 수량만 총 낱개 기준으로 조정합니다. 기존 입고/출고 기록은 삭제되지 않습니다.</p>
        <div class="inventory-adjust-form" data-inventory-adjust-form hidden>
          <label class="mini-label" for="inventoryAdjustQty">수정 후 재고 수량</label>
          <input id="inventoryAdjustQty" type="number" step="1" inputmode="numeric" value="${Number(currentUnits) || 0}" data-inventory-adjust-qty aria-label="${safeSku} 수정 후 재고 수량" />
          <div class="hint">${unitText} · 현재 ${escapeHtml(number(currentUnits))}개</div>
          <label class="mini-label" for="inventoryAdjustReason">수정 사유</label>
          <input id="inventoryAdjustReason" type="text" placeholder="예: 실사 재고 보정, 오출고 보정, 누락 입고 보정, 파손/폐기 반영, 기타" data-inventory-adjust-reason />
          <div class="inventory-adjust-actions">
            <button type="button" class="btn primary small" data-inventory-adjust-save="${safeSku}">수정 저장</button>
            <button type="button" class="btn ghost small" data-inventory-adjust-cancel>취소</button>
          </div>
        </div>
      </section>`;
}

function saveInventoryManualAdjust(sku) {
  if (!requireEditor("재고 수량 직접 수정")) return;
  const def = INVENTORY_DEFS[sku];
  if (!def) {
    alert("재고 수정 대상을 찾을 수 없습니다.");
    return;
  }
  const overlay = $("inventoryItemOverlay");
  const qtyInput = overlay ? overlay.querySelector("[data-inventory-adjust-qty]") : null;
  const reasonInput = overlay ? overlay.querySelector("[data-inventory-adjust-reason]") : null;
  const rawQty = qtyInput ? String(qtyInput.value || "").trim() : "";
  if (!/^-?\d+$/.test(rawQty)) {
    alert("재고 수량은 정수로 입력해주세요.");
    if (qtyInput) qtyInput.focus();
    return;
  }
  const nextUnits = Number(rawQty);
  if (!Number.isSafeInteger(nextUnits) || !Number.isFinite(nextUnits)) {
    alert("재고 수량을 확인해주세요.");
    if (qtyInput) qtyInput.focus();
    return;
  }
  const reason = reasonInput ? String(reasonInput.value || "").trim() : "";
  if (!reason) {
    alert("재고 수정 사유를 입력해주세요.");
    if (reasonInput) reasonInput.focus();
    return;
  }
  const prevUnits = Number(state.stock?.[sku]?.units || 0);
  const diffUnits = nextUnits - prevUnits;
  const ok = confirm("재고 수량을 직접 수정합니다. 기존 입고/출고 기록은 삭제되지 않고, 현재 재고 수량만 조정됩니다. 계속하시겠습니까?");
  if (!ok) return;

  state.stock[sku] = { units: nextUnits };
  addAdminActionLog("manual_adjust", {
    itemName: sku,
    qty: diffUnits,
    memo: `재고 직접 수정: ${reason}`,
    details: [
      {
        itemName: sku,
        qty: diffUnits,
        beforeUnits: prevUnits,
        afterUnits: nextUnits,
        reason,
        adjustType: "manual_adjust",
      },
    ],
  });
  saveState({ action: "재고 직접 수정", immediate: true, forceSupabase: true });
  renderAll();
  openInventoryItemDetail(sku);
  showToast(`${sku} 재고가 ${number(nextUnits)}개로 수정되었습니다.`);
}

function bindInventoryManualAdjustEvents() {
  const overlay = $("inventoryItemOverlay");
  if (!overlay || overlay.dataset.manualAdjustBound === "1") return;
  overlay.dataset.manualAdjustBound = "1";
  overlay.addEventListener("click", (event) => {
    const openBtn = event.target.closest("[data-inventory-adjust-open]");
    if (openBtn) {
      event.preventDefault();
      event.stopPropagation();
      if (!requireEditor("재고 수량 직접 수정")) return;
      const card = openBtn.closest("[data-inventory-adjust-card]");
      const form = card ? card.querySelector("[data-inventory-adjust-form]") : null;
      const qtyInput = form ? form.querySelector("[data-inventory-adjust-qty]") : null;
      if (form) form.hidden = false;
      openBtn.hidden = true;
      if (qtyInput) qtyInput.focus();
      return;
    }
    const cancelBtn = event.target.closest("[data-inventory-adjust-cancel]");
    if (cancelBtn) {
      event.preventDefault();
      event.stopPropagation();
      const card = cancelBtn.closest("[data-inventory-adjust-card]");
      const form = card ? card.querySelector("[data-inventory-adjust-form]") : null;
      const open = card ? card.querySelector("[data-inventory-adjust-open]") : null;
      if (form) form.hidden = true;
      if (open) open.hidden = false;
      return;
    }
    const saveBtn = event.target.closest("[data-inventory-adjust-save]");
    if (saveBtn) {
      event.preventDefault();
      event.stopPropagation();
      saveInventoryManualAdjust(saveBtn.dataset.inventoryAdjustSave || "");
    }
  });
}

function openInventoryItemDetail(sku) {
    sku = canonicalSku(sku);
    const def = INVENTORY_DEFS[sku];
    const item = state.stock[sku];
    if (!def || !item) return;
    const overlay = $("inventoryItemOverlay");
    const body = $("inventoryItemBody");
    if (!overlay || !body) return;

    activeInventoryDetailSku = sku;
    const units = item.units || 0;
    const safety = safetyStatus(sku, state.stock[sku]?.units || 0);
    setText("inventoryItemTitle", sku);
    setText("inventoryItemMeta", `${def.group || "분류 없음"} · ${def.structure || "구조 정보 없음"}`);

    const unitCost = getSkuCost(sku);
    const rows = [
      ["현재 재고", formatStock(sku, units)],
      ["총 낱개 환산", `${number(units)}개`],
      ["안전재고", safety?.threshold ? safety.thresholdText : "미설정"],
      ["안전재고 상태", safety?.isLow ? `부족 · 현재 ${stockPercentText(sku)}` : `정상 · 현재 ${stockPercentText(sku)}`],
      ["낱개 원가", Number.isFinite(unitCost) ? money(unitCost) : "원가 미입력"],
      ["재고 자산", Number.isFinite(unitCost) ? money(units * unitCost) : "원가 미입력"]
    ];

    body.innerHTML = `
      <div class="inventory-detail-overview">
        <article class="inventory-detail-primary-card ${safety?.isLow ? "is-low" : "is-safe"}">
          <span>현재 재고</span>
          <strong>${escapeHtml(formatStock(sku, units))}</strong>
          <em>${escapeHtml(number(units))}개 · ${escapeHtml(safety?.isLow ? "안전재고 주의" : "안전재고 정상")}</em>
        </article>
        <div class="inventory-detail-stat-grid">
          <article><span>안전재고</span><strong>${escapeHtml(safety?.threshold ? safety.thresholdText : "미설정")}</strong></article>
          <article><span>재고 상태</span><strong>${escapeHtml(safety?.isLow ? `부족 · ${stockPercentText(sku)}` : `정상 · ${stockPercentText(sku)}`)}</strong></article>
          <article><span>낱개 원가</span><strong>${escapeHtml(Number.isFinite(unitCost) ? money(unitCost) : "원가 미입력")}</strong></article>
          <article><span>재고 자산</span><strong>${escapeHtml(Number.isFinite(unitCost) ? money(units * unitCost) : "원가 미입력")}</strong></article>
        </div>
      </div>
      ${def.isBox ? `<p class="detail-note inventory-detail-note">박스 재고는 파렛/묶음/장 기준으로 직접 수정할 수 있습니다.</p>` : `<p class="detail-note inventory-detail-note">이 품목의 입고와 직접 출고는 입고/직접 출고 입력에서 여러 줄로 한 번에 적용할 수 있습니다.</p>`}
      ${renderInventoryManualAdjustPanel(sku, def, units)}
      <section class="sku-stockout-forecast-card empty" id="inventoryItemStockoutForecast">
        <div class="sku-stockout-forecast-main">
          <span>예상 소진일</span>
          <strong id="inventoryItemStockoutValue">계산 중</strong>
          <p id="inventoryItemStockoutNote">엑셀 주문 처리 기록을 기준으로 계산하고 있습니다.</p>
        </div>
        <div class="sku-stockout-forecast-metrics">
          <div><span>최근 30일 총 출고</span><b id="inventoryItemTrendTotal">-</b></div>
          <div><span>평균 출고량</span><b id="inventoryItemTrendAverage">-</b></div>
          <div><span>출고 발생일</span><b id="inventoryItemTrendActiveDays">-</b></div>
          <div><span>최근 출고일</span><b id="inventoryItemTrendLastDate">-</b></div>
        </div>
      </section>
      <section class="sku-order-trend-card" id="inventoryItemOrderTrend">
        <div class="sku-order-trend-head">
          <div>
            <p class="eyebrow">ORDER OUT TREND</p>
            <strong>날짜별 순출고 추적</strong>
            <small>현재 유효 재고 기록 기준 · backup/undo 제외</small>
          </div>
          <span id="inventoryItemOrderTrendBasisBadge" class="sku-order-trend-basis is-info">기준 확인 중</span>
        </div>
        <p id="inventoryItemOrderTrendMeta" class="sku-order-trend-meta">출고 기록을 불러오는 중입니다.</p>
        <div class="sku-order-chart-stage">
          <canvas id="inventoryItemOrderChart" height="300" aria-label="날짜별 순출고 그래프"></canvas>
          <div id="inventoryItemOrderChartEmpty" class="detail-empty" hidden>엑셀 주문 차감 적용 이후 저장된 품목별 출고 기록이 아직 없습니다.</div>
        </div>
        <div id="inventoryItemOrderTrendSummary" class="sku-order-trend-summary"></div>
        <div class="sku-order-trend-recent">
          <span>일자별 최근 출고</span>
          <div id="inventoryItemOrderTrendBreakdown" class="sku-order-trend-breakdown"></div>
        </div>
        <div class="sku-order-trend-recent">
          <span>최근 출고 기록</span>
          <div id="inventoryItemOrderTrendList" class="sku-order-trend-list"></div>
        </div>
      </section>
    `;
    overlay.hidden = false;
    renderInventoryItemOrderTrend();
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      renderInventoryItemOrderTrend();
    });
  }

  function closeInventoryItemDetail() {
    const overlay = $("inventoryItemOverlay");
    if (!overlay || overlay.hidden) return;
    overlay.classList.remove("open");
    overlay.hidden = true;
    activeInventoryDetailSku = null;
  }

  function renderDailyFlowEntryList(bucket, kind) {
    const entries = bucket?.entries?.[kind] || [];
    if (!entries.length) return "";
    return `
      <section class="daily-flow-detail-section ${getFlowKindClass(kind)}">
        <h3>${escapeHtml(getFlowKindLabel(kind))}</h3>
        <div class="daily-flow-detail-list">
          ${entries.map((entry) => `
            <div class="daily-flow-detail-row">
              <strong>${escapeHtml(entry.sku || "상세 데이터 없음")}</strong>
              <span>${escapeHtml(entry.sku && hasFlowDetailUnits(entry.units) ? `${getFlowKindQuantityLabel(kind)}: ${formatDailyFlowUnits(entry.sku, entry.units)}` : "수량 상세 없음")}</span>
              <small>${escapeHtml(formatDateTime(entry.at))}${entry.memo ? " · " + escapeHtml(entry.memo) : ""}</small>
            </div>
          `).join("")}
        </div>
      </section>`;
  }

  function renderDailyFlowMissingRecords(bucket) {
    const records = bucket?.missingRecords || [];
    if (!records.length) return "";
    return `
      <section class="daily-flow-detail-section unknown">
        <h3>상세 데이터 없음</h3>
        <div class="daily-flow-detail-list">
          ${records.map((record) => `
            <div class="daily-flow-detail-row">
              <strong>${escapeHtml(record.type || "기록")}</strong>
              <span>${escapeHtml(record.qtyText || "제품별 상세 없음")}</span>
              <small>${escapeHtml(formatDateTime(record.at))}${record.memo ? " · " + escapeHtml(record.memo) : ""}</small>
            </div>
          `).join("")}
        </div>
      </section>`;
  }

  function renderDailyFlowProductSummary(bucket) {
    const rows = Array.from(bucket?.products?.values?.() || [])
      .map((item) => {
        const net = item.inbound + item.returnIn - item.outbound - item.excel - item.returnOut;
        return { ...item, net };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.inbound + b.outbound + b.excel - (a.inbound + a.outbound + a.excel) || a.sku.localeCompare(b.sku, "ko-KR"));

    if (!rows.length) {
      return `<div class="detail-empty">제품별 상세 데이터가 없습니다. 기존 기록에 제품별 상세가 없으면 임의로 역산하지 않습니다.</div>`;
    }

    return `
      <div class="daily-flow-product-table">
        <div class="daily-flow-product-head">
          <span>제품명</span><span>입고</span><span>출고</span><span>엑셀</span><span>순변동</span>
        </div>
        ${rows.map((row) => `
          <div class="daily-flow-product-row">
            <strong>${escapeHtml(row.sku)}</strong>
            <span>${escapeHtml(formatDailyFlowUnits(row.sku, row.inbound + row.returnIn))}</span>
            <span>${escapeHtml(formatDailyFlowUnits(row.sku, row.outbound + row.returnOut))}</span>
            <span>${escapeHtml(formatDailyFlowUnits(row.sku, row.excel))}</span>
            <b class="${row.net >= 0 ? "positive" : "negative"}">${escapeHtml(formatSignedFlowUnits(row.net))}</b>
          </div>
        `).join("")}
      </div>`;
  }

  function renderDailyFlowDetailHtml(bucket, options = {}) {
    if (!bucket) return `<div class="detail-empty">해당 날짜의 입출고 상세 기록을 찾을 수 없습니다.</div>`;
    const net = calculateDailyFlowNet(bucket);
    const title = options.compact ? "같은 날짜 전체 흐름" : "제품별 상세";
    return `
      <div class="daily-flow-detail">
        <div class="daily-flow-summary-grid">
          <div><span>총 입고</span><strong>${escapeHtml(formatDailyFlowUnits("", bucket.totals.inbound + bucket.totals.returnIn))}</strong></div>
          <div><span>총 출고</span><strong>${escapeHtml(formatDailyFlowUnits("", bucket.totals.outbound + bucket.totals.returnOut))}</strong></div>
          <div><span>엑셀 차감</span><strong>${escapeHtml(formatDailyFlowUnits("", bucket.totals.excel))}</strong></div>
          <div><span>순변동</span><strong class="${net >= 0 ? "positive" : "negative"}">${escapeHtml(formatSignedFlowUnits(net))}</strong></div>
        </div>
        <h3 class="daily-flow-detail-heading">${escapeHtml(title)}</h3>
        ${renderDailyFlowProductSummary(bucket)}
        ${renderDailyFlowEntryList(bucket, "inbound")}
        ${renderDailyFlowEntryList(bucket, "outbound")}
        ${renderDailyFlowEntryList(bucket, "excel")}
        ${renderDailyFlowEntryList(bucket, "returnIn")}
        ${renderDailyFlowEntryList(bucket, "returnOut")}
        ${renderDailyFlowEntryList(bucket, "returnHold")}
        ${renderDailyFlowMissingRecords(bucket)}
      </div>`;
  }

  function openDailyFlowDetail(dayKey) {
    const bucket = findDailyFlowBucket(dayKey);
    const overlay = $("historyDetailOverlay");
    const body = $("historyDetailBody");
    if (!overlay || !body || !bucket) return;
    setText("historyDetailTitle", `${bucket.date} 입출고 상세`);
    setText("historyDetailMeta", `기존 기록 기준 · ${number(bucket.records.length)}건 · 조회 전용`);
    body.innerHTML = renderDailyFlowDetailHtml(bucket);
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
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
    const recordHtml = details.length
      ? details.map((detail) => `
        <div class="detail-line">
          <strong>${escapeHtml(detail.sku || "품목")}</strong>
          <span>${escapeHtml(detail.text || (hasFlowDetailUnits(detail.units) ? formatMovementDetail(detail.sku, detail.units, detail.direction || "out") : "수량 상세 없음"))}</span>
          ${renderHistoryDetailQuantity(detail)}
        </div>`).join("")
      : `<div class="detail-empty">이전 버전에서 저장된 기록이라 품목별 상세 내역이 없습니다.</div>`;
    const bucket = findDailyFlowBucket(getHistoryDateKey(item));
    body.innerHTML = `
      <section class="history-record-detail">
        <h3>이 기록의 상세</h3>
        ${recordHtml}
      </section>
      ${bucket ? renderDailyFlowDetailHtml(bucket, { compact: true }) : ""}
    `;

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
    if (!requireEditor("엑셀 주문 분석")) return;

    const input = $("orderFile");
    const file = input?.files?.[0];
    if (!file) {
      alert("엑셀 파일을 먼저 선택해주세요.");
      return;
    }

    setExcelFormatWarning(file);

    const ext = getFileExtension(file.name);
    if (ext && !["xlsx", "xls", "csv"].includes(ext)) {
      setText("excelNotice", "지원하지 않는 파일 형식입니다. .xlsx, .xls, .csv 파일만 업로드해 주세요.");
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
      const analysis = normalizeOrderAnalysis(analyzeOrderRows(rows));
      analysis.fileMeta = {
        name: file.name || "",
        size: file.size || 0,
        lastModified: file.lastModified || 0,
        extension: ext || "",
        parsedAt: new Date().toISOString()
      };
      analysis.orderApplicationSignature = buildOrderApplicationSignature(analysis);
      lastOrderAnalysis = analysis;
      setLocalStorageItem(ORDER_CACHE_KEY, JSON.stringify(analysis), "analyzeOrderFile");
      renderOrderAnalysis(analysis);
      $("applyOrderDeductions").disabled = analysis.deductions.length === 0 && analysis.boxUsages.length === 0;
    } catch (error) {
      console.error(error);
      setText("excelNotice", "엑셀 파일을 읽는 중 오류가 발생했습니다. .xlsx로 저장 후 다시 시도해주세요.");
    }
  }

  function analyzeOrderRows(rows) {
    const deductions = new Map();
    const deductionOrderCounts = new Map();
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
        deductionOrderCounts.set(sku, (deductionOrderCounts.get(sku) || 0) + 1);
        const boxResult = getBoxUsage(sku, units);
        if (boxResult.needCheck) {
          needs.push({ row: index + 1, productName, qty: units, reason: boxResult.needCheck });
        }
        if (boxResult.size && boxResult.size !== "none") {
          const boxSku = BOX_SKU_BY_SIZE[boxResult.size];
          boxUsages.set(boxSku, (boxUsages.get(boxSku) || 0) + 1);
        }
        const boxXlUnits = codiTissueBoxXlUnits(sku, units);
        if (boxXlUnits > 0) {
          boxUsages.set(BOX_XL_SKU, (boxUsages.get(BOX_XL_SKU) || 0) + boxXlUnits);
        }
      });
    });

    const paymentRecords = [...paymentGroups.values()];
    const paymentUniqueSum = paymentRecords.reduce((sum, item) => sum + item.amount, 0);
    const extraShippingSum = paymentRecords.reduce((sum, item) => sum + item.extraShipping, 0);
    const deductionList = [...deductions.entries()].map(([sku, units]) => ({
      sku,
      units,
      orderCount: deductionOrderCounts.get(sku) || 0
    }));
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
      /(?:x|×|\*)\s*([0-9,]+)\b/i,
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

    if (/대파x/.test(text) && !/대파x[0-9,]+(?:개)?/.test(text)) {
      return { needs: ["대파 x 수량 확인 필요"] };
    }

    const rules = [
      [/foot|풋젤리/, "풋젤리"],
      [/sweetpotato\(50g\)|sweetpotato50g|스위트포테이토|촉촉한고구마/, "촉촉한 고구마"],
      [/촉촉한밤|^밤$|밤/, "촉촉한 밤"],
      [/무가당.*300g/, "찹쌀 누룽지 무가당"],
      [/무가당\(288g\)|무가당288g/, "찹쌀 누룽지 무가당"],
      [/검정콩|검은콩/, "찹쌀 누룽지 무가당"],
      [/찹쌀.*츄러스|누룽지.*츄러스|츄러스/, "찹쌀 누룽지 츄러스"],
      [/찹쌀.*무가당|누룽지.*무가당/, "찹쌀 누룽지 무가당"],
      [/찹쌀.*스위트|누룽지.*스위트|^찹쌀누룽지$|찹쌀누룽지/, "찹쌀 누룽지 스위트"],
      [/네모스낵.*치킨/, "네모스낵 치킨맛"],
      [/네모스낵.*불고기/, "네모스낵 불고기맛"],
      [/네모스낵.*매콤|네모스낵.*매운|네모스낵.*스파이시/, "네모스낵 매콤한맛"],
      [/에낙.*스모크|애낙.*스모크|에낙.*smoke|애낙.*smoke|enak.*smoke/i, "에낙 스모크"],
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
      [/대파x[0-9,]+(?:개)?/, "대파 메밀칩 160g"],
      [/김메밀칩|메밀칩/, "김 메밀칩 160g"],
      [/브이콘.*100|v콘.*100|vicon.*100/, "브이콘 100g"],
      [/브이콘|v콘|vicon/, "브이콘 50g"],
      [/감자알칩/, "감자알칩"],
      [/명가.*참깨/, "명가 참깨"],
      [/명가.*흑당/, "명가 흑당"],
      [/쿠키속\s*초코짱|쿠키속초코짱|쿠키/i, COOKIE_CHOCO_SKU],
      [/코디|3겹|휴지/, "코디 3겹"]
    ];

    const found = rules.find(([pattern]) => pattern.test(text));
    if (!found) return { needs: ["등록되지 않은 상품명"] };
    return { items: [{ sku: canonicalSku(found[1]), units }] };
  }

  function getBoxUsage(sku, units) {
    sku = canonicalSku(sku);
    const def = INVENTORY_DEFS[sku];
    if (!def || def.isBox || sku === "코디 3겹") return { size: "none" };
    const cookieBoxUsage = getCookieChocoPackagingBoxUsage(sku, units);
    if (cookieBoxUsage) return cookieBoxUsage;
    if (isCookieChocoSku(sku)) return { size: "none" };
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
    if (sku === "에낙 치킨" || sku === "에낙 스파이시" || sku === "에낙 스모크") {
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


  function stableHash(text) {
    const input = String(text || "");
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function buildOrderMajorSummary(analysis) {
    const rows = [].concat(analysis && analysis.deductions ? analysis.deductions : [], analysis && analysis.boxUsages ? analysis.boxUsages : [])
      .map(function(item) { return { sku: canonicalSku(item.sku), units: cleanNumber(item.units) }; })
      .filter(function(item) { return item.sku && item.units > 0; })
      .sort(function(a, b) { return b.units - a.units || a.sku.localeCompare(b.sku, "ko-KR"); })
      .slice(0, 12);
    return rows.map(function(item) { return item.sku + ":" + Math.round(item.units); });
  }

  function buildOrderApplicationSignature(analysis) {
    const fileMeta = analysis && analysis.fileMeta ? analysis.fileMeta : {};
    const majorSummary = buildOrderMajorSummary(analysis || {});
    const summaryHash = stableHash(majorSummary.join("|"));
    const normalizedFileName = String(fileMeta.name || (analysis && analysis.fileName) || "").trim().toLowerCase();
    const fileSize = cleanNumber(fileMeta.size || (analysis && analysis.fileSize) || 0);
    const orderRows = cleanNumber(analysis && analysis.orderRows);
    const paymentGroupCount = cleanNumber(analysis && analysis.paymentGroupCount);
    const paymentUniqueSum = Math.round(cleanNumber(analysis && analysis.paymentUniqueSum));
    const paymentUniqueWithExtraShipping = Math.round(cleanNumber((analysis && analysis.paymentUniqueWithExtraShipping) || (analysis && analysis.paymentUniqueSum)));
    const fingerprint = stableHash([
      normalizedFileName,
      fileSize,
      orderRows,
      paymentGroupCount,
      paymentUniqueSum,
      paymentUniqueWithExtraShipping,
      summaryHash
    ].join("|"));
    return {
      fileName: normalizedFileName,
      fileSize,
      orderRows,
      paymentGroupCount,
      paymentUniqueSum,
      paymentUniqueWithExtraShipping,
      majorSummary,
      summaryHash,
      fingerprint
    };
  }

  function findPotentialDuplicateOrderApplication(analysis) {
    const signature = buildOrderApplicationSignature(analysis);
    const records = Array.isArray(state.appliedOrderFiles) ? state.appliedOrderFiles.map(normalizeAppliedOrderFile).filter(Boolean) : [];
    let best = null;
    records.forEach(function(record) {
      let score = 0;
      if (signature.fingerprint && record.fingerprint === signature.fingerprint) score += 6;
      if (signature.fileName && record.fileName && signature.fileName === String(record.fileName).toLowerCase()) score += 1;
      if (signature.fileSize && record.fileSize && signature.fileSize === record.fileSize) score += 1;
      if (signature.orderRows && record.orderRows && signature.orderRows === record.orderRows) score += 1;
      if (signature.paymentGroupCount && record.paymentGroupCount && signature.paymentGroupCount === record.paymentGroupCount) score += 1;
      if (signature.paymentUniqueSum && record.paymentUniqueSum && signature.paymentUniqueSum === Math.round(record.paymentUniqueSum)) score += 1;
      if (signature.summaryHash && record.summaryHash && signature.summaryHash === record.summaryHash) score += 2;
      if (score > (best ? best.score : 0)) best = { record, score, signature };
    });
    if (!best) return null;
    const filenameOnly = best.score === 1 && signature.fileName && best.record.fileName && signature.fileName === String(best.record.fileName).toLowerCase();
    if (filenameOnly) return null;
    return best.score >= 4 ? best : null;
  }

  function addAppliedOrderFileRecord(analysis) {
    const signature = buildOrderApplicationSignature(analysis);
    const actor = getAdminActorMeta();
    const record = normalizeAppliedOrderFile({
      id: createHistoryId(),
      at: new Date().toISOString(),
      fileName: signature.fileName,
      fileSize: signature.fileSize,
      orderRows: signature.orderRows,
      paymentGroupCount: signature.paymentGroupCount,
      paymentUniqueSum: signature.paymentUniqueSum,
      paymentUniqueWithExtraShipping: signature.paymentUniqueWithExtraShipping,
      majorSummary: signature.majorSummary,
      summaryHash: signature.summaryHash,
      fingerprint: signature.fingerprint,
      adminUid: actor.adminUid,
      adminEmail: actor.adminEmail
    });
    state.appliedOrderFiles = Array.isArray(state.appliedOrderFiles) ? state.appliedOrderFiles : [];
    state.appliedOrderFiles.unshift(record);
    state.appliedOrderFiles = state.appliedOrderFiles.slice(0, APPLIED_ORDER_HISTORY_LIMIT);
    return record;
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
    if (!requireEditor("엑셀 주문 차감")) return;

    const analysis = normalizeOrderAnalysis(lastOrderAnalysis || (() => {
      try { return JSON.parse(localStorage.getItem(ORDER_CACHE_KEY) || "null"); } catch { return null; }
    })());
    if (!analysis) return;
    lastOrderAnalysis = analysis;
    setLocalStorageItem(ORDER_CACHE_KEY, JSON.stringify(analysis), "applyLastOrderDeductions");
    if (analysis.needs?.length && !confirm(`확인 필요 ${analysis.needs.length}건이 있습니다. 확인 필요 항목은 제외하고 차감할까요?`)) return;

    const duplicate = findPotentialDuplicateOrderApplication(analysis);
    if (duplicate && !confirm("이미 적용된 파일일 수 있습니다. 다시 적용하면 재고가 중복 차감될 수 있습니다.\n\n이전 적용: " + formatDateTime(duplicate.record.at) + " / " + (duplicate.record.fileName || "파일명 없음") + " / " + number(duplicate.record.orderRows) + "행\n계속 진행하시겠습니까?")) return;

    addBackup("엑셀 주문 적용 전 자동 백업");

    analysis.deductions.forEach(({ sku, units }) => {
      sku = canonicalSku(sku);
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
    const detailItems = analysis.deductions.map(({ sku, units, orderCount }) => ({
      sku,
      units,
      orderCount: Math.max(1, cleanNumber(orderCount)),
      direction: "out",
      source: "excelOrderDeduction",
      text: formatMovementDetail(sku, units, "out")
    }));
    pushHistory("주문처리", "엑셀 주문 " + analysis.orderRows + "행 차감", "결제그룹 " + analysis.paymentGroupCount + "건 / " + money(analysis.paymentUniqueSum), detailItems, { source: "excelOrderDeduction" });
    const appliedRecord = addAppliedOrderFileRecord(analysis);
    addAdminActionLog("엑셀 주문 적용", {
      itemName: appliedRecord?.fileName || "엑셀 주문 파일",
      qty: analysis.orderRows,
      unit: "행",
      memo: "결제그룹 " + number(analysis.paymentGroupCount) + "건 / " + money(analysis.paymentUniqueSum),
      source: "excelOrderDeduction",
      details: detailItems
    });
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
      state = normalizeState({ ...createInitialState(), ...imported });
      applyLaborCostRecordsAfterStateReplace(imported, "importBackup labor sync");
      addAdminActionLog("데이터 복구/import", { itemName: file.name || "백업 파일", memo: "백업 파일 불러오기", source: "importBackup" });
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


  function escapeAttr(value) {
    return escapeHtml(value);
  }

  function parseHistoryTime(record) {
    const source = record || {};
    const raw = source.at || source.date || source.createdAt || source.created_at || source.timestamp || source.processedAt || source.processed_at || source.updatedAt || source.updated_at;
    if (!raw) return null;
    const parsed = raw instanceof Date ? raw : new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatDateShort(value) {
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value ?? "");
    return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
  }

  function shortDateLabel(value) {
    const parsed = value instanceof Date ? value : new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getMonth() + 1}/${parsed.getDate()}`;
    }
    const raw = String(value ?? "").trim();
    const match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return `${Number(match[2])}/${Number(match[3])}`;
    }
    return raw || "-";
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }


  function initExcelCountCalculator() {
    const root = $("page-excel-count");
    if (!root || root.dataset.excelCountReady === "1") return;
    root.dataset.excelCountReady = "1";

    const COL_C = 2;
    const COL_H = 7;
    const COL_X = 23;
    const COL_AA = 26;
    const SPECIAL_SELLER_IDS = new Set(["lkh5209", "live_rock", "lkh52009"]);
    const SPECIAL_SELLER_NAME = "lkh5209 통합판매자";
    const SUPPORTED_FILE_EXTS = new Set(["xlsx", "xls", "xlsm", "csv"]);
    const SELLER_COLOR_PALETTE = [
      { accent: "#93c5fd", border: "#bfdbfe", tint: "#f8fbff", hover: "#eff6ff" },
      { accent: "#86efac", border: "#bbf7d0", tint: "#f6fef9", hover: "#ecfdf5" },
      { accent: "#fcd34d", border: "#fde68a", tint: "#fffdf2", hover: "#fffbeb" },
      { accent: "#fca5a5", border: "#fecaca", tint: "#fff8f8", hover: "#fef2f2" },
      { accent: "#c4b5fd", border: "#ddd6fe", tint: "#fbf9ff", hover: "#f5f3ff" },
      { accent: "#67e8f9", border: "#a5f3fc", tint: "#f2feff", hover: "#ecfeff" }
    ];

    const state = {
      workbook: null,
      sheetNames: [],
      activeSheetName: "",
      fileName: "",
      fileExt: "",
      summary: null,
      sellerGroups: [],
      sellerTotals: [],
      sellerOptionRows: [],
      overallOptionRows: [],
      needReviewRows: [],
      shippingFeeSummary: null,
      shippingFeeRows: [],
      shippingFeeSiteRows: [],
      shippingFeeSiteSummary: null,
      shippingFeeWarnings: [],
      expandedSellers: new Set(),
      fileCheck: null,
      warnings: [],
      fileCheckStatus: null,
      isFileCheckOpen: false
    };

    const el = {
      fileInput: root.querySelector("#fileInput"),
      sheetSelectorWrap: root.querySelector("#sheetSelectorWrap"),
      sheetSelect: root.querySelector("#sheetSelect"),
      statusBox: root.querySelector("#statusBox"),
      resultArea: root.querySelector("#resultArea"),
      fileCheckPanel: root.querySelector("#fileCheckPanel"),
      sellerSearch: root.querySelector("#sellerSearch"),
      optionSearch: root.querySelector("#optionSearch"),
      expandAllBtn: root.querySelector("#expandAllBtn"),
      collapseAllBtn: root.querySelector("#collapseAllBtn"),
      resetBtn: root.querySelector("#resetBtn"),
      summaryGrid: root.querySelector("#summaryGrid"),
      sellerList: root.querySelector("#sellerList"),
      shippingFeePanel: root.querySelector("#shippingFeePanel"),
      overallOptionTable: root.querySelector("#overallOptionTable"),
      needReviewTable: root.querySelector("#needReviewTable"),
      downloadXlsxBtn: root.querySelector("#downloadXlsxBtn"),
      downloadSellerDetailCsvBtn: root.querySelector("#downloadSellerDetailCsvBtn"),
      downloadSellerTotalCsvBtn: root.querySelector("#downloadSellerTotalCsvBtn"),
      downloadOverallCsvBtn: root.querySelector("#downloadOverallCsvBtn")
    };

    if (!el.fileInput || !el.resultArea || !el.sellerList) {
      console.warn("[Excel count] required elements are missing; initialization skipped.");
      return;
    }

    function clean(value) {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\u00a0/g, " ").trim();
    }

    function lower(value) {
      return clean(value).toLowerCase();
    }

    function formatNumber(value) {
      return Number(value || 0).toLocaleString("ko-KR");
    }

    function formatCurrency(value) {
      return `${formatNumber(value)}원`;
    }

    function cell(row, index) {
      if (!Array.isArray(row)) return "";
      return clean(row[index]);
    }

    function isRowNotEmpty(row) {
      return Array.isArray(row) && row.some(value => clean(value) !== "");
    }

    function getFileExt(fileName) {
      const match = clean(fileName).match(/\.([^.]+)$/);
      return match ? match[1].toLowerCase() : "알 수 없음";
    }

    function extractSellerFromC(cValue) {
      const c = clean(cValue);
      if (!c) return "";
      const parenMatch = c.match(/\(([^)]+)\)/);
      if (parenMatch && clean(parenMatch[1])) return clean(parenMatch[1]);
      return c;
    }

    function resolveSeller(cValue, aaValue, hasAAColumn) {
      const c = clean(cValue);
      const aa = hasAAColumn ? clean(aaValue) : "";
      const aaKey = aa.toLowerCase();

      if (aa && SPECIAL_SELLER_IDS.has(aaKey)) {
        return { seller: SPECIAL_SELLER_NAME, source: "AA열 통합 규칙", reason: "" };
      }

      if (c) {
        return { seller: extractSellerFromC(c), source: "C열", reason: "" };
      }

      if (aa) {
        return { seller: aa, source: "AA열", reason: "" };
      }

      return {
        seller: "",
        source: "",
        reason: hasAAColumn
          ? "C열과 AA열 모두 비어 있음"
          : "C열과 AA열 모두 비어 있음 / AA열 없음"
      };
    }

    function sortByCountThenName(a, b, countKey = "주문건수", nameKey = "주문선택사항") {
      return (b[countKey] - a[countKey]) || String(a[nameKey] || "").localeCompare(String(b[nameKey] || ""), "ko");
    }

    function getSellerColorStyle(seller) {
      const text = clean(seller);
      let hash = 0;
      for (let index = 0; index < text.length; index += 1) {
        hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
      }

      const color = SELLER_COLOR_PALETTE[hash % SELLER_COLOR_PALETTE.length];
      return `--seller-accent:${color.accent}; --seller-border:${color.border}; --seller-tint:${color.tint}; --seller-hover:${color.hover};`;
    }

    function parseShippingFeeValue(value) {
      const raw = clean(value);
      if (!raw) return { status: "empty", amount: 0, raw };

      const normalized = raw
        .replace(/,/g, "")
        .replace(/원/g, "")
        .replace(/₩/g, "")
        .replace(/\s/g, "");

      if (!normalized) return { status: "empty", amount: 0, raw };
      if (normalized.includes(".")) return { status: "decimal", amount: 0, raw, reason: "소수점 금액" };
      if (!/^-?\d+$/.test(normalized)) return { status: "invalid", amount: 0, raw, reason: "숫자로 해석 불가" };

      const amount = Number(normalized);
      if (amount < 0) return { status: "negative", amount, raw, reason: "음수 배송비" };
      if (amount === 0) return { status: "zero", amount, raw };
      return { status: "positive", amount, raw };
    }

    function resolveShippingSiteFromC(cValue, hasCColumn) {
      if (!hasCColumn) return "확인 필요";
      const site = extractSellerFromC(cValue);
      return site || "확인 필요";
    }

    function analyzeShippingFees(dataRows, check) {
      const amountMap = new Map();
      const siteMap = new Map();
      const warnings = [];
      const summary = {
        chargedCount: 0,
        totalAmount: 0,
        distinctAmountCount: 0,
        zeroCount: 0,
        emptyCount: 0,
        warningCount: 0,
        missingColumn: !check.hasX
      };
      const siteSummary = {
        siteCount: 0,
        chargedCount: 0,
        totalAmount: 0,
        matchesChargedCount: true,
        matchesTotalAmount: true
      };

      if (!check.hasX) {
        warnings.push({
          "원본 행 번호": "-",
          "X열 배송비": "열 없음",
          "사유": "X열 배송비를 찾지 못했습니다."
        });
        summary.warningCount = warnings.length;
        return { summary, rows: [], siteRows: [], siteSummary, warnings };
      }

      dataRows.forEach((row, index) => {
        const sourceRowNumber = index + 2;
        const parsed = parseShippingFeeValue(cell(row, COL_X));

        if (parsed.status === "positive") {
          const site = resolveShippingSiteFromC(cell(row, COL_C), check.hasC);
          const current = amountMap.get(parsed.amount) || { amount: parsed.amount, count: 0 };
          current.count += 1;
          amountMap.set(parsed.amount, current);
          if (!siteMap.has(site)) {
            siteMap.set(site, { site, chargedCount: 0, totalAmount: 0, amountMap: new Map() });
          }
          const siteEntry = siteMap.get(site);
          siteEntry.chargedCount += 1;
          siteEntry.totalAmount += parsed.amount;
          siteEntry.amountMap.set(parsed.amount, (siteEntry.amountMap.get(parsed.amount) || 0) + 1);
          summary.chargedCount += 1;
          summary.totalAmount += parsed.amount;
          return;
        }

        if (parsed.status === "zero") {
          summary.zeroCount += 1;
          return;
        }

        if (parsed.status === "empty") {
          summary.emptyCount += 1;
          return;
        }

        warnings.push({
          "원본 행 번호": sourceRowNumber,
          "X열 배송비": parsed.raw,
          "사유": parsed.reason
        });
      });

      const rows = Array.from(amountMap.values())
        .sort((a, b) => a.amount - b.amount)
        .map(item => ({
          "배송비 금액": formatCurrency(item.amount),
          "건수": item.count,
          "합계 금액": formatCurrency(item.amount * item.count)
        }));

      const siteRows = Array.from(siteMap.values())
        .map(item => {
          const amountEntries = Array.from(item.amountMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([amount, count]) => ({
              amount,
              count,
              label: `${formatCurrency(amount)} ${formatNumber(count)}건`
            }));

          return {
            site: item.site,
            chargedCount: item.chargedCount,
            totalAmount: item.totalAmount,
            amountEntries,
            amountBreakdown: amountEntries.map(entry => entry.label).join(", ")
          };
        })
        .sort((a, b) => (b.totalAmount - a.totalAmount) || (b.chargedCount - a.chargedCount) || a.site.localeCompare(b.site, "ko"));

      summary.distinctAmountCount = rows.length;
      summary.warningCount = warnings.length;
      siteSummary.siteCount = siteRows.length;
      siteSummary.chargedCount = siteRows.reduce((sum, item) => sum + item.chargedCount, 0);
      siteSummary.totalAmount = siteRows.reduce((sum, item) => sum + item.totalAmount, 0);
      siteSummary.matchesChargedCount = siteSummary.chargedCount === summary.chargedCount;
      siteSummary.matchesTotalAmount = siteSummary.totalAmount === summary.totalAmount;

      return { summary, rows, siteRows, siteSummary, warnings };
    }

    function setStatus(message, type = "") {
      el.statusBox.className = `status ${type}`.trim();
      el.statusBox.textContent = message;
    }

    function requireXlsx() {
      if (!window.XLSX) {
        throw new Error("엑셀 라이브러리 SheetJS를 불러오지 못했습니다. 인터넷 연결을 확인하거나 xlsx.full.min.js 파일을 index.html과 같은 폴더에 넣어주세요.");
      }
    }

    function resetAnalysisOnly() {
      state.summary = null;
      state.sellerGroups = [];
      state.sellerTotals = [];
      state.sellerOptionRows = [];
      state.overallOptionRows = [];
      state.needReviewRows = [];
      state.shippingFeeSummary = null;
      state.shippingFeeRows = [];
      state.shippingFeeSiteRows = [];
      state.shippingFeeSiteSummary = null;
      state.shippingFeeWarnings = [];
      state.expandedSellers = new Set();
      state.fileCheck = null;
      state.warnings = [];
      state.fileCheckStatus = null;
      state.isFileCheckOpen = false;
      root.classList.add("is-empty");
      el.sellerSearch.value = "";
      el.optionSearch.value = "";
      el.resultArea.classList.add("hidden");
      el.summaryGrid.innerHTML = "";
      el.sellerList.innerHTML = "";
      el.shippingFeePanel.innerHTML = "";
      el.overallOptionTable.innerHTML = "";
      el.needReviewTable.innerHTML = "";
      el.fileCheckPanel.innerHTML = "";
    }

    function resetAll() {
      state.workbook = null;
      state.sheetNames = [];
      state.activeSheetName = "";
      state.fileName = "";
      state.fileExt = "";
      el.fileInput.value = "";
      el.sheetSelect.innerHTML = "";
      el.sheetSelectorWrap.classList.add("hidden");
      resetAnalysisOnly();
      setStatus("초기화 완료. 새 엑셀 파일을 선택하면 다시 분석됩니다.");
    }

    function getRowsFromSheet(sheetName) {
      const sheet = state.workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: false
      });
    }

    function buildColumnCheck(rows) {
      const maxColumns = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const dataRows = rows.slice(1).filter(isRowNotEmpty);
      const firstDataRowIndex = rows.findIndex((row, index) => index > 0 && isRowNotEmpty(row));
      const firstDataRow = firstDataRowIndex >= 0 ? rows[firstDataRowIndex] : [];

      const hasC = maxColumns > COL_C;
      const hasH = maxColumns > COL_H;
      const hasX = maxColumns > COL_X;
      const hasAA = maxColumns > COL_AA;

      const hNonEmptyCount = dataRows.filter(row => cell(row, COL_H)).length;
      const hEmptyCount = Math.max(0, dataRows.length - hNonEmptyCount);
      const hNonEmptyRatio = dataRows.length ? hNonEmptyCount / dataRows.length : 0;

      const warnings = [];
      const dangerWarnings = [];

      if (!hasC) dangerWarnings.push("C열을 찾지 못했습니다. 판매자 구분이 어려울 수 있습니다.");
      if (!hasH) dangerWarnings.push("H열 주문선택사항을 찾지 못했습니다. 열 개수 부족 가능성이 큽니다.");
      if (!hasAA) warnings.push("AA열을 찾지 못했습니다. C열 기준으로 가능한 만큼 분석합니다.");
      if (dataRows.length === 0) dangerWarnings.push("첫 행 제목 아래에 분석할 데이터 행이 없습니다.");
      if (hasH && dataRows.length > 0 && (hNonEmptyCount === 0 || hNonEmptyRatio < 0.1)) {
        dangerWarnings.push("H열 주문선택사항을 찾지 못했을 수 있습니다. H열 값이 거의 비어 있습니다.");
      }
      if (state.fileExt === "xls") {
        warnings.push(".xls는 구형 엑셀 형식입니다. 한글/날짜/숫자가 이상하면 엑셀에서 .xlsx로 다시 저장 후 업로드해보세요.");
      }

      return {
        maxColumns,
        dataRowCount: dataRows.length,
        firstDataRowNumber: firstDataRowIndex >= 0 ? firstDataRowIndex + 1 : "",
        preview: {
          "C열": hasC ? cell(firstDataRow, COL_C) : "열 없음",
          "H열": hasH ? cell(firstDataRow, COL_H) : "열 없음",
          "X열": hasX ? cell(firstDataRow, COL_X) : "열 없음",
          "AA열": hasAA ? cell(firstDataRow, COL_AA) : "열 없음"
        },
        hasC,
        hasH,
        hasX,
        hasAA,
        hNonEmptyCount,
        hEmptyCount,
        hNonEmptyRatio,
        warnings,
        dangerWarnings
      };
    }

    function analyzeRows(rows) {
      const check = buildColumnCheck(rows);
      const dataRows = rows.slice(1).filter(isRowNotEmpty);
      const validRows = [];
      const needReviewRows = [];
      const shippingFeeAnalysis = analyzeShippingFees(dataRows, check);

      dataRows.forEach((row, index) => {
        const sourceRowNumber = index + 2;
        const cValue = check.hasC ? cell(row, COL_C) : "";
        const hValue = check.hasH ? cell(row, COL_H) : "";
        const aaValue = check.hasAA ? cell(row, COL_AA) : "";
        const reasons = [];

        if (!check.hasC || !check.hasH) {
          reasons.push("열 개수 부족");
        }

        if (!check.hasAA) {
          reasons.push("AA열 없음");
        }

        if (!hValue) {
          reasons.push("H열 주문선택사항 비어 있음");
        }

        const sellerResult = resolveSeller(cValue, aaValue, check.hasAA);
        if (!sellerResult.seller) {
          reasons.push(sellerResult.reason || "판매자 확인 불가");
        }

        const shouldReview =
          !hValue ||
          !sellerResult.seller ||
          !check.hasH ||
          !check.hasC;

        if (shouldReview) {
          needReviewRows.push({
            "원본 행 번호": sourceRowNumber,
            "C열 값": cValue,
            "AA열 값": check.hasAA ? aaValue : "AA열 없음",
            "H열 주문선택사항": hValue,
            "사유": unique(reasons).join(" / ")
          });
          return;
        }

        validRows.push({
          rowNumber: sourceRowNumber,
          seller: sellerResult.seller,
          sellerSource: sellerResult.source,
          option: hValue,
          cValue,
          aaValue
        });
      });

      const sellerMap = new Map();
      const optionMap = new Map();

      validRows.forEach(item => {
        if (!sellerMap.has(item.seller)) {
          sellerMap.set(item.seller, { seller: item.seller, total: 0, optionMap: new Map() });
        }

        const sellerGroup = sellerMap.get(item.seller);
        sellerGroup.total += 1;
        sellerGroup.optionMap.set(item.option, (sellerGroup.optionMap.get(item.option) || 0) + 1);
        optionMap.set(item.option, (optionMap.get(item.option) || 0) + 1);
      });

      const sellerGroups = Array.from(sellerMap.values()).map(group => {
        const optionRows = Array.from(group.optionMap.entries())
          .map(([option, count]) => ({
            "판매자": group.seller,
            "주문선택사항": option,
            "주문건수": count
          }))
          .sort((a, b) => sortByCountThenName(a, b));

        return {
          seller: group.seller,
          total: group.total,
          uniqueOptionCount: optionRows.length,
          optionRows
        };
      }).sort((a, b) => (b.total - a.total) || a.seller.localeCompare(b.seller, "ko"));

      const sellerTotals = sellerGroups.map(group => ({
        "판매자": group.seller,
        "총 주문건수": group.total,
        "고유 주문선택사항 수": group.uniqueOptionCount
      }));

      const sellerOptionRows = sellerGroups.flatMap(group => group.optionRows);

      const overallOptionRows = Array.from(optionMap.entries())
        .map(([option, count]) => ({
          "주문선택사항": option,
          "전체 주문건수": count
        }))
        .sort((a, b) => (b["전체 주문건수"] - a["전체 주문건수"]) || a["주문선택사항"].localeCompare(b["주문선택사항"], "ko"));

      const sellerTotalSum = sellerTotals.reduce((sum, row) => sum + row["총 주문건수"], 0);
      const overallOptionSum = overallOptionRows.reduce((sum, row) => sum + row["전체 주문건수"], 0);

      const summary = {
        "전체 데이터 행 수": dataRows.length,
        "분석된 주문 수": validRows.length,
        "판매자 수": sellerGroups.length,
        "고유 주문선택사항 수": overallOptionRows.length,
        "확인 필요 건수": needReviewRows.length,
        "판매자별 총 주문건수 합계": sellerTotalSum,
        "전체 주문선택사항별 주문건수 합계": overallOptionSum,
        "검증 결과": sellerTotalSum === validRows.length && overallOptionSum === validRows.length ? "정상" : "불일치"
      };

      return {
        summary,
        sellerGroups,
        sellerTotals,
        sellerOptionRows,
        overallOptionRows,
        needReviewRows,
        shippingFeeSummary: shippingFeeAnalysis.summary,
        shippingFeeRows: shippingFeeAnalysis.rows,
        shippingFeeSiteRows: shippingFeeAnalysis.siteRows,
        shippingFeeSiteSummary: shippingFeeAnalysis.siteSummary,
        shippingFeeWarnings: shippingFeeAnalysis.warnings,
        fileCheck: check,
        warnings: [...check.warnings, ...check.dangerWarnings.map(text => `위험: ${text}`)]
      };
    }

    function unique(values) {
      return [...new Set(values.filter(Boolean))];
    }

    async function handleFile(file) {
      if (!file) return;
      resetAnalysisOnly();
      state.workbook = null;
      state.sheetNames = [];
      state.activeSheetName = "";
      state.fileName = file.name;
      state.fileExt = getFileExt(file.name);
      el.sheetSelect.innerHTML = "";
      el.sheetSelectorWrap.classList.add("hidden");

      if (!SUPPORTED_FILE_EXTS.has(state.fileExt)) {
        throw new Error("지원하지 않는 파일 형식입니다. .xlsx, .xls, .xlsm, .csv 파일만 선택해주세요.");
      }

      requireXlsx();
      setStatus(`파일 읽는 중: ${file.name}`);

      try {
        const buffer = await file.arrayBuffer();
        state.workbook = XLSX.read(buffer, {
          type: "array",
          raw: false,
          cellDates: false,
          WTF: false,
          codepage: 949
        });
      } catch (error) {
        console.error(error);
        const extra = state.fileExt === "xls"
          ? " .xls 파일은 구형 형식이라 일부 파일에서 깨질 수 있습니다. 엑셀에서 .xlsx로 다시 저장 후 업로드해보세요."
          : "";
        throw new Error(`파일 읽기 오류가 발생했습니다.${extra}`);
      }

      state.sheetNames = state.workbook.SheetNames || [];
      if (state.sheetNames.length === 0) {
        throw new Error("엑셀 파일 안에서 분석할 시트를 찾지 못했습니다.");
      }

      populateSheetSelector();
      analyzeActiveSheet(state.sheetNames[0]);
    }

    function populateSheetSelector() {
      el.sheetSelect.innerHTML = state.sheetNames
        .map(name => `<option value="${escapeAttr(name)}">${escapeHtml(name)}</option>`)
        .join("");

      if (state.sheetNames.length > 1) {
        el.sheetSelectorWrap.classList.remove("hidden");
      } else {
        el.sheetSelectorWrap.classList.add("hidden");
      }
    }

    function analyzeActiveSheet(sheetName) {
      requireXlsx();

      if (!state.workbook || !sheetName) {
        throw new Error("분석할 엑셀 파일 또는 시트를 찾지 못했습니다.");
      }

      resetAnalysisOnly();

      state.activeSheetName = sheetName;
      el.sheetSelect.value = sheetName;

      let rows;
      try {
        rows = getRowsFromSheet(sheetName);
      } catch (error) {
        console.error(error);
        throw new Error("시트 데이터를 읽는 중 오류가 발생했습니다.");
      }

      if (!rows || rows.length < 2) {
        throw new Error("분석할 데이터가 없습니다. 첫 행은 제목, 두 번째 행부터 주문 데이터여야 합니다.");
      }

      const analyzed = analyzeRows(rows);
      Object.assign(state, analyzed);
      state.expandedSellers = new Set();
      state.fileCheckStatus = getFileCheckStatus();
      state.isFileCheckOpen = false;

      renderAll();
      el.resultArea.classList.remove("hidden");
      root.classList.remove("is-empty");

      const validationOk = state.summary["검증 결과"] === "정상";
      const hasDanger = state.fileCheck.dangerWarnings.length > 0;

      if (validationOk && !hasDanger) {
        setStatus(`분석 완료: ${state.fileName} / 시트: ${state.activeSheetName} / 분석된 주문 ${formatNumber(state.summary["분석된 주문 수"])}건`, "good");
      } else if (validationOk && hasDanger) {
        setStatus(`분석은 완료됐지만 열 검증 경고가 있습니다. C/H/AA열 미리보기를 확인해주세요.`, "warn");
      } else {
        setStatus("분석은 완료됐지만 총합 검증이 일치하지 않습니다. 결과를 확인해주세요.", "danger");
      }
    }

    function renderAll() {
      renderFileCheck();
      renderSummary();
      renderShippingFeeAnalysis();
      renderSellerCards();
      renderOverallOptionTable();
      renderNeedReviewTable();
    }

    function getFileCheckStatus() {
      const s = state.summary;
      const c = state.fileCheck;

      if (!s || !c) {
        return { level: "normal", label: "정상", description: "분석 전", badgeClass: "normal" };
      }

      const isTotalMismatch = s["검증 결과"] !== "정상";
      const isDanger =
        !c.hasC ||
        !c.hasH ||
        c.dangerWarnings.length > 0 ||
        isTotalMismatch ||
        s["분석된 주문 수"] === 0;

      if (isDanger) {
        let description = "검증 확인 필요";
        if (!c.hasH || c.hNonEmptyRatio < 0.1) description = "H열 주문선택사항 확인 필요";
        else if (!c.hasC) description = "C열 판매자 확인 필요";
        else if (isTotalMismatch) description = "총합 불일치";
        else if (s["분석된 주문 수"] === 0) description = "분석된 주문 0건";

        return { level: "danger", label: "위험", description, badgeClass: "danger" };
      }

      const isWarning =
        !c.hasAA ||
        c.warnings.length > 0 ||
        s["확인 필요 건수"] > 0 ||
        state.fileExt === "xls";

      if (isWarning) {
        let description = "주의 필요";
        if (s["확인 필요 건수"] > 0) description = `확인 필요 ${formatNumber(s["확인 필요 건수"])}건`;
        else if (!c.hasAA) description = "AA열 없음";
        else if (state.fileExt === "xls") description = ".xls 구형 형식";

        return { level: "warning", label: "주의", description, badgeClass: "warning" };
      }

      return { level: "normal", label: "정상", description: "총합 일치", badgeClass: "normal" };
    }

    function renderFileCheck() {
      const s = state.summary;
      const c = state.fileCheck;
      if (!s || !c) return;

      const status = getFileCheckStatus();
      state.fileCheckStatus = status;

      const validationClass = s["검증 결과"] === "정상" ? "good" : "danger";
      const validationText = s["검증 결과"] === "정상" ? "총합 일치" : "총합 불일치";

      const warningHtml = [
        ...c.dangerWarnings.map(text => `<div class="warning-item danger">⚠ ${escapeHtml(text)}</div>`),
        ...c.warnings.map(text => `<div class="warning-item">주의: ${escapeHtml(text)}</div>`)
      ].join("");

      el.fileCheckPanel.className = `panel file-check-accordion ${state.isFileCheckOpen ? "open" : ""}`;

      el.fileCheckPanel.innerHTML = `
        <div class="file-check-header">
          <div>
            <div class="file-check-title-row">
              <div class="file-check-title">파일 / 열 검증</div>
              <span class="status-badge ${status.badgeClass}">${escapeHtml(status.label)}</span>
              <span class="file-check-desc">${escapeHtml(status.description)}</span>
            </div>
            <div class="file-check-meta">
              <span title="${escapeAttr(state.fileName)}">파일: ${escapeHtml(state.fileName)}</span>
              <span title="${escapeAttr(state.activeSheetName)}">시트: ${escapeHtml(state.activeSheetName)}</span>
            </div>
          </div>
          <button id="fileCheckToggleBtn" class="file-check-toggle" type="button" aria-expanded="${state.isFileCheckOpen ? "true" : "false"}" aria-controls="fileCheckBody">
            ${state.isFileCheckOpen ? "검증 정보 접기" : "검증 정보 펼치기"}
          </button>
        </div>

        <div id="fileCheckBody" class="file-check-body">
          <div class="check-grid">
            <div class="check-box"><div class="k">파일명</div><div class="v">${escapeHtml(state.fileName)}</div></div>
            <div class="check-box"><div class="k">확장자</div><div class="v">.${escapeHtml(state.fileExt)}</div></div>
            <div class="check-box"><div class="k">분석 시트</div><div class="v">${escapeHtml(state.activeSheetName)}</div></div>
            <div class="check-box"><div class="k">전체 시트 수</div><div class="v">${formatNumber(state.sheetNames.length)}개</div></div>
            <div class="check-box"><div class="k">감지된 최대 열 수</div><div class="v">${formatNumber(c.maxColumns)}개</div></div>
            <div class="check-box"><div class="k">첫 데이터 행</div><div class="v">${c.firstDataRowNumber ? `${formatNumber(c.firstDataRowNumber)}행` : "없음"}</div></div>
            <div class="check-box"><div class="k">H열 입력 비율</div><div class="v">${Math.round(c.hNonEmptyRatio * 100)}%</div></div>
            <div class="check-box"><div class="k">총합 검증</div><div class="v"><span class="pill ${validationClass}">${validationText}</span></div></div>
          </div>

          <div class="preview-grid">
            <div class="check-box"><div class="k">첫 데이터 행 C열 미리보기</div><div class="v">${escapeHtml(c.preview["C열"] || "빈 값")}</div></div>
            <div class="check-box"><div class="k">첫 데이터 행 H열 미리보기</div><div class="v">${escapeHtml(c.preview["H열"] || "빈 값")}</div></div>
            <div class="check-box"><div class="k">첫 데이터 행 X열 배송비</div><div class="v">${escapeHtml(c.preview["X열"] || "빈 값")}</div></div>
            <div class="check-box"><div class="k">첫 데이터 행 AA열 미리보기</div><div class="v">${escapeHtml(c.preview["AA열"] || "빈 값")}</div></div>
          </div>

          <div class="check-grid" style="margin-top:12px;">
            <div class="check-box"><div class="k">분석된 주문 수</div><div class="v">${formatNumber(s["분석된 주문 수"])}건</div></div>
            <div class="check-box"><div class="k">판매자별 총합</div><div class="v">${formatNumber(s["판매자별 총 주문건수 합계"])}건</div></div>
            <div class="check-box"><div class="k">전체 주문선택사항 총합</div><div class="v">${formatNumber(s["전체 주문선택사항별 주문건수 합계"])}건</div></div>
            <div class="check-box"><div class="k">확인 필요</div><div class="v">${formatNumber(s["확인 필요 건수"])}건</div></div>
          </div>

          <div class="warning-list">
            ${warningHtml || `<div class="warning-item good">열 검증에서 큰 문제를 찾지 못했습니다.</div>`}
          </div>
        </div>
      `;

      const toggleBtn = root.querySelector("#fileCheckToggleBtn");
      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          state.isFileCheckOpen = !state.isFileCheckOpen;
          renderFileCheck();
        });
      }
    }

    function renderSummary() {
      const s = state.summary;
      if (!s) return;

      const cards = [
        ["전체 데이터 행 수", s["전체 데이터 행 수"]],
        ["분석된 주문 수", s["분석된 주문 수"]],
        ["확인 필요 건수", s["확인 필요 건수"]],
        ["배송비 부과 건수", state.shippingFeeSummary?.chargedCount || 0],
        ["배송비 총액", state.shippingFeeSummary?.totalAmount || 0, "원"],
        ["판매자 수", s["판매자 수"]],
        ["고유 주문선택사항 수", s["고유 주문선택사항 수"]]
      ];

      el.summaryGrid.innerHTML = cards.map(([label, value, suffix = ""]) => `
        <div class="summary-card ${label === "확인 필요 건수" && value > 0 ? "attention" : ""}">
          <div class="label">${escapeHtml(label)}</div>
          <div class="value">${formatNumber(value)}${suffix}</div>
        </div>
      `).join("");
    }

    function renderShippingFeeAnalysis() {
      const summary = state.shippingFeeSummary;
      if (!summary) return;

      const overviewItems = [
        ["배송비 부과 건수", `${formatNumber(summary.chargedCount)}건`],
        ["배송비 총액", formatCurrency(summary.totalAmount)],
        ["금액 종류", `${formatNumber(summary.distinctAmountCount)}개`],
        ["경고", `${formatNumber(summary.warningCount)}건`]
      ];

      const overviewHtml = `
        <div class="shipping-overview">
          ${overviewItems.map(([label, value]) => `
            <div class="check-box">
              <div class="k">${escapeHtml(label)}</div>
              <div class="v">${escapeHtml(value)}</div>
            </div>
          `).join("")}
        </div>
      `;

      const noteHtml = `
        <p class="shipping-note">
          X열에서 0보다 큰 정수 금액만 집계합니다. 0원 ${formatNumber(summary.zeroCount)}건, 빈 값 ${formatNumber(summary.emptyCount)}건은 정상 제외했습니다.
        </p>
      `;

      const warningHtml = state.shippingFeeWarnings.length > 0
        ? `
          <div class="shipping-warning-summary">
            <div class="warning-item">배송비 집계에서 제외된 확인 필요 값 ${formatNumber(state.shippingFeeWarnings.length)}건이 있습니다.</div>
            ${renderRows(state.shippingFeeWarnings, ["원본 행 번호", "X열 배송비", "사유"], { label: "배송비 경고 목록" })}
          </div>
        `
        : `<div class="warning-item good">배송비 경고 값이 없습니다.</div>`;

      const rowsHtml = renderRows(state.shippingFeeRows, ["배송비 금액", "건수", "합계 금액"], {
        countKey: "건수",
        label: "배송비 금액별 분석"
      });

      const siteSummary = state.shippingFeeSiteSummary;
      const siteRows = state.shippingFeeSiteRows || [];
      const hasSiteDetail = siteSummary && siteRows.length > 0;
      const siteCheckClass = siteSummary && siteSummary.matchesChargedCount && siteSummary.matchesTotalAmount ? "good" : "danger";
      const siteCheckText = siteSummary && siteSummary.matchesChargedCount && siteSummary.matchesTotalAmount
        ? "상세 합계가 전체 배송비 분석과 일치합니다."
        : "상세 합계가 전체 배송비 분석과 다를 수 있어 확인이 필요합니다.";
      const siteDetailHtml = !hasSiteDetail
        ? `<div class="empty">배송비 상세 데이터가 없습니다.</div>`
        : `
          <details class="shipping-site-breakdown">
            <summary>
              <span>사이트별 배송비 상세</span>
              <em>${formatNumber(siteSummary.siteCount)}개 사이트 · ${formatNumber(siteSummary.chargedCount)}건 · ${formatCurrency(siteSummary.totalAmount)}</em>
            </summary>
            <div class="shipping-site-breakdown-body">
              <div class="warning-item ${siteCheckClass}">${siteCheckText}</div>
              <div class="shipping-site-grid">
                ${siteRows.map(row => `
                  <article class="shipping-site-card ${row.site === "확인 필요" ? "needs-review" : ""}">
                    <div class="shipping-site-head">
                      <div class="shipping-site-name">${escapeHtml(row.site)}</div>
                      <div class="shipping-site-total">${formatCurrency(row.totalAmount)}</div>
                    </div>
                    <div class="shipping-site-meta">
                      <span class="pill">${formatNumber(row.chargedCount)}건</span>
                      <span class="pill subtle">${formatNumber(row.amountEntries.length)}개 금액</span>
                    </div>
                    <div class="shipping-site-amounts" aria-label="${escapeAttr(`${row.site} 배송비 금액별 분포`)}">
                      ${row.amountEntries.map(entry => `
                        <div class="shipping-site-amount">
                          <span>${escapeHtml(formatCurrency(entry.amount))}</span>
                          <strong>${formatNumber(entry.count)}건</strong>
                        </div>
                      `).join("")}
                    </div>
                  </article>
                `).join("")}
              </div>
            </div>
          </details>
        `;

      el.shippingFeePanel.innerHTML = `
        ${overviewHtml}
        ${noteHtml}
        ${rowsHtml}
        ${siteDetailHtml}
        ${warningHtml}
      `;
    }

    function getFilters() {
      return {
        seller: lower(el.sellerSearch.value),
        option: lower(el.optionSearch.value)
      };
    }

    function getSellerColumnCount() {
      if (window.matchMedia("(max-width: 980px)").matches) return 1;
      if (window.matchMedia("(max-width: 1520px)").matches) return 2;
      return 3;
    }

    function renderSellerCards() {
      const filters = getFilters();

      const filteredGroups = state.sellerGroups
        .map(group => {
          const sellerMatch = !filters.seller || lower(group.seller).includes(filters.seller);
          const filteredRows = group.optionRows.filter(row => {
            return !filters.option || lower(row["주문선택사항"]).includes(filters.option);
          });

          return {
            ...group,
            filteredRows,
            filteredTotal: filteredRows.reduce((sum, row) => sum + row["주문건수"], 0),
            sellerMatch
          };
        })
        .filter(group => group.sellerMatch && group.filteredRows.length > 0);

      if (filteredGroups.length === 0) {
        el.sellerList.innerHTML = `<div class="empty">검색 조건에 맞는 판매자 또는 주문선택사항이 없습니다.</div>`;
        return;
      }

      const renderSellerCard = group => {
        const isOpen = state.expandedSellers.has(group.seller);
        const filterActive = Boolean(filters.option);
        const colorStyle = getSellerColorStyle(group.seller);
        const rowsHtml = renderRows(group.filteredRows, ["주문선택사항", "주문건수"], {
          countKey: "주문건수",
          label: `${group.seller} 주문선택사항`
        });

        return `
          <article class="seller-card ${isOpen ? "open" : ""}" data-seller="${escapeAttr(group.seller)}" style="${colorStyle}">
            <button class="seller-header" type="button" data-toggle-seller="${escapeAttr(group.seller)}" aria-expanded="${isOpen ? "true" : "false"}" aria-label="${escapeAttr(`${group.seller} 상세 ${isOpen ? "접기" : "펼치기"}`)}">
              <div>
                <div class="seller-name">${escapeHtml(group.seller)}</div>
                <div class="seller-sub">
                  <span class="pill">총 주문 ${formatNumber(group.total)}건</span>
                  <span class="pill">고유 옵션 ${formatNumber(group.uniqueOptionCount)}개</span>
                  ${filterActive ? `<span class="pill">검색 결과 ${formatNumber(group.filteredTotal)}건</span>` : ""}
                </div>
              </div>
              <div class="seller-count">
                <span>${formatNumber(filterActive ? group.filteredTotal : group.total)}건</span>
                <span class="chevron">⌄</span>
              </div>
            </button>
            <div class="seller-body">
              ${rowsHtml}
            </div>
          </article>
        `;
      };

      const columnCount = Math.min(getSellerColumnCount(), filteredGroups.length);
      const columns = Array.from({ length: columnCount }, () => []);
      filteredGroups.forEach((group, index) => {
        columns[index % columnCount].push(group);
      });

      el.sellerList.innerHTML = columns.map(columnGroups => `
        <div class="seller-column">
          ${columnGroups.map(renderSellerCard).join("")}
        </div>
      `).join("");

      root.querySelectorAll("[data-toggle-seller]").forEach(button => {
        button.addEventListener("click", () => {
          const seller = button.getAttribute("data-toggle-seller");
          if (state.expandedSellers.has(seller)) {
            state.expandedSellers.delete(seller);
          } else {
            state.expandedSellers.add(seller);
          }
          renderSellerCards();
        });
      });
    }

    function renderOverallOptionTable() {
      const filters = getFilters();
      const rows = state.overallOptionRows.filter(row => {
        return !filters.option || lower(row["주문선택사항"]).includes(filters.option);
      });

      el.overallOptionTable.innerHTML = renderRows(rows, ["주문선택사항", "전체 주문건수"], { countKey: "전체 주문건수" });
    }

    function renderNeedReviewTable() {
      const filters = getFilters();
      const rows = state.needReviewRows.filter(row => {
        const optionOk = !filters.option || lower(row["H열 주문선택사항"]).includes(filters.option);
        const sellerOk = !filters.seller || lower(row["C열 값"]).includes(filters.seller) || lower(row["AA열 값"]).includes(filters.seller);
        return optionOk && sellerOk;
      });

      el.needReviewTable.innerHTML = renderRows(rows, ["원본 행 번호", "C열 값", "AA열 값", "H열 주문선택사항", "사유"], { countKey: "" });
    }

    function renderRows(rows, columns, options = {}) {
      if (!rows || rows.length === 0) {
        return `<div class="empty">표시할 데이터가 없습니다.</div>`;
      }

      const countKey = options.countKey || "";

      return `
        <div class="table-wrap">
          <table aria-label="${escapeAttr(options.label || columns.join(" / "))}">
            <thead>
              <tr>
                ${columns.map(col => `<th class="${col === countKey ? "count" : ""}">${escapeHtml(col)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  ${columns.map(col => {
                    const value = row[col];
                    const isCount = col === countKey || typeof value === "number";
                    return `<td class="${isCount ? "count" : "option-text"}">${isCount ? formatNumber(value) : escapeHtml(value)}</td>`;
                  }).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    function rowsToWorksheet(rows, headers) {
      const data = [headers, ...rows.map(row => headers.map(header => row[header] ?? ""))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = headers.map(header => {
        if (header.includes("주문선택사항")) return { wch: 54 };
        if (header.includes("사유")) return { wch: 36 };
        if (header.includes("판매자")) return { wch: 22 };
        if (header.includes("파일") || header.includes("시트")) return { wch: 28 };
        return { wch: 18 };
      });
      return ws;
    }

    function downloadXlsx() {
      requireAnalyzed();
      requireXlsx();

      const wb = XLSX.utils.book_new();

      const summaryRows = [
        { "항목": "파일명", "값": state.fileName },
        { "항목": "확장자", "값": state.fileExt },
        { "항목": "분석 시트", "값": state.activeSheetName },
        ...Object.entries(state.summary).map(([key, value]) => ({ "항목": key, "값": value }))
      ];

      const checkRows = [
        { "항목": "파일명", "값": state.fileName },
        { "항목": "확장자", "값": state.fileExt },
        { "항목": "분석 시트", "값": state.activeSheetName },
        { "항목": "전체 시트 수", "값": state.sheetNames.length },
        { "항목": "감지된 최대 열 수", "값": state.fileCheck.maxColumns },
        { "항목": "첫 데이터 행 번호", "값": state.fileCheck.firstDataRowNumber },
        { "항목": "첫 데이터 행 C열 미리보기", "값": state.fileCheck.preview["C열"] },
        { "항목": "첫 데이터 행 H열 미리보기", "값": state.fileCheck.preview["H열"] },
        { "항목": "첫 데이터 행 AA열 미리보기", "값": state.fileCheck.preview["AA열"] },
        { "항목": "H열 입력 비율", "값": `${Math.round(state.fileCheck.hNonEmptyRatio * 100)}%` },
        { "항목": "경고", "값": [...state.fileCheck.dangerWarnings, ...state.fileCheck.warnings].join(" / ") || "없음" }
      ];

      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(summaryRows, ["항목", "값"]), "요약");
      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(checkRows, ["항목", "값"]), "파일_열검증");
      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(state.sellerOptionRows, ["판매자", "주문선택사항", "주문건수"]), "판매자별_주문선택사항_주문건수");
      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(state.sellerTotals, ["판매자", "총 주문건수", "고유 주문선택사항 수"]), "판매자별_총주문건수");
      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(state.overallOptionRows, ["주문선택사항", "전체 주문건수"]), "주문선택사항별_전체주문건수");
      XLSX.utils.book_append_sheet(wb, rowsToWorksheet(state.needReviewRows, ["원본 행 번호", "C열 값", "AA열 값", "H열 주문선택사항", "사유"]), "확인필요");

      XLSX.writeFile(wb, buildFileName("주문분석결과", "xlsx"));
    }

    function csvEscape(value) {
      const text = value === null || value === undefined ? "" : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    }

    function downloadCsv(rows, headers, baseName) {
      requireAnalyzed();

      const csv = "\ufeff" + [
        headers.map(csvEscape).join(","),
        ...rows.map(row => headers.map(header => csvEscape(row[header] ?? "")).join(","))
      ].join("\r\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFileName(baseName, "csv");
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function buildFileName(baseName, ext) {
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        "_",
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0")
      ].join("");

      const safeOriginalName = state.fileName
        ? state.fileName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]/g, "_")
        : "uploaded";

      return `${safeOriginalName}_${baseName}_${stamp}.${ext}`;
    }

    function requireAnalyzed() {
      if (!state.summary) throw new Error("먼저 엑셀 파일을 업로드해서 분석해주세요.");
    }

    function escapeHtml(value) {
      return clean(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    function escapeAttr(value) {
      return escapeHtml(value).replace(/`/g, "&#096;");
    }

    el.fileInput.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        await handleFile(file);
      } catch (error) {
        console.error(error);
        resetAnalysisOnly();
        setStatus(error.message || "파일 분석 중 오류가 발생했습니다.", "danger");
      }
    });

    el.sheetSelect.addEventListener("change", () => {
      try {
        analyzeActiveSheet(el.sheetSelect.value);
      } catch (error) {
        console.error(error);
        setStatus(error.message || "시트 분석 중 오류가 발생했습니다.", "danger");
      }
    });

    el.sellerSearch.addEventListener("input", () => {
      if (!state.summary) return;
      renderSellerCards();
      renderNeedReviewTable();
    });

    el.optionSearch.addEventListener("input", () => {
      if (!state.summary) return;
      renderSellerCards();
      renderOverallOptionTable();
      renderNeedReviewTable();
    });

    el.expandAllBtn.addEventListener("click", () => {
      state.sellerGroups.forEach(group => state.expandedSellers.add(group.seller));
      renderSellerCards();
    });

    el.collapseAllBtn.addEventListener("click", () => {
      state.expandedSellers.clear();
      renderSellerCards();
    });

    el.resetBtn.addEventListener("click", resetAll);

    let sellerResizeTimer = null;
    window.addEventListener("resize", () => {
      if (!state.summary) return;
      window.clearTimeout(sellerResizeTimer);
      sellerResizeTimer = window.setTimeout(renderSellerCards, 120);
    });

    el.downloadXlsxBtn.addEventListener("click", () => {
      try { downloadXlsx(); }
      catch (error) { setStatus(error.message, "danger"); }
    });

    el.downloadSellerDetailCsvBtn.addEventListener("click", () => {
      try { downloadCsv(state.sellerOptionRows, ["판매자", "주문선택사항", "주문건수"], "판매자별_주문선택사항_주문건수"); }
      catch (error) { setStatus(error.message, "danger"); }
    });

    el.downloadSellerTotalCsvBtn.addEventListener("click", () => {
      try { downloadCsv(state.sellerTotals, ["판매자", "총 주문건수", "고유 주문선택사항 수"], "판매자별_총주문건수"); }
      catch (error) { setStatus(error.message, "danger"); }
    });

    el.downloadOverallCsvBtn.addEventListener("click", () => {
      try { downloadCsv(state.overallOptionRows, ["주문선택사항", "전체 주문건수"], "주문선택사항별_전체주문건수"); }
      catch (error) { setStatus(error.message, "danger"); }
    });

    function updateLibraryAvailability() {
      if (!window.XLSX) {
        el.fileInput.disabled = true;
        const isWaitingForFallback =
          window.__xlsxFallbackRequested &&
          !window.__xlsxFallbackFailed &&
          !window.__xlsxFallbackTimedOut;
        const message = isWaitingForFallback
          ? "엑셀 라이브러리 SheetJS를 불러오는 중입니다. 잠시 후 다시 시도해주세요."
          : "엑셀 라이브러리 SheetJS를 불러오지 못했습니다. 인터넷 연결을 확인하거나 xlsx.full.min.js 파일을 이 HTML과 같은 폴더에 넣어주세요.";
        setStatus(message, isWaitingForFallback ? "warn" : "danger");
      } else {
        const wasDisabled = el.fileInput.disabled;
        el.fileInput.disabled = false;
        if (!state.summary && wasDisabled) {
          setStatus("엑셀 파일을 선택하면 자동으로 분석됩니다.");
        }
      }
    }

    window.addEventListener("xlsx-library-change", updateLibraryAvailability);
    if (document.readyState === "complete") {
      updateLibraryAvailability();
    } else {
      window.addEventListener("load", updateLibraryAvailability);
    }
    window.setTimeout(updateLibraryAvailability, 5000);
  
  }

  function runStartupStep(name, fn) {
    try {
      const result = fn();
      if (result && typeof result.catch === "function") {
        result.catch((error) => console.error(`[Reborn startup] ${name} failed`, error));
      }
    } catch (error) {
      console.error(`[Reborn startup] ${name} failed`, error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    runStartupStep("password recovery", initPasswordRecoveryFlow);
    runStartupStep("routing", initRouting);
    runStartupStep("margin calculator", initMarginCalculator);
    runStartupStep("WMS", initWms);
    runStartupStep("excel count calculator", initExcelCountCalculator);
    runStartupStep("Supabase sync", initSupabaseSync);
    runStartupStep("admin login reveal", initAdminLoginReveal);
    runStartupStep("admin auth", initAdminAuth);
  });
})();
