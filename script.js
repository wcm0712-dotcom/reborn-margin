/* =========================
   RE:BORN Margin Calculator
   FULL SAFE FINAL
========================= */

const productCategories = [
  ["누룽지", [
    ["찹쌀 누룽지 스위트&무가당", 2200],
    ["찹쌀 누룽지 츄러스", 2300]
  ]],
  ["메밀칩", [
    ["싱싱 양파 160g", 1650],
    ["싱싱 양파 100g", 1000],
    ["푸드킹 양파 160g", 1500]
  ]],
  ["브이콘", [
    ["브이콘 50g", 412.5],
    ["브이콘 100g", 825]
  ]],
  ["에낙", [
    ["에낙 치킨&스파", 4916.6]
  ]],
  ["꽈배기", [
    ["명가 참깨&흑당", 4200]
  ]],
  ["네모스낵", [
    ["네모스낵 치킨&불&매콤", 172.2]
  ]],
  ["그 외 과자", [
    ["황금 고구마칩", 3500],
    ["촉촉한 고구마", 770],
    ["촉촉한 밤", 1080],
    ["감자알칩", 282.5],
    ["차카니", 286.6],
    ["라멘 뽀식이", 510],
    ["바베큐맛 스낵", 500],
    ["보리건빵", 125],
    ["허니눈꽃 920g", 6800],
    ["꾀돌이", 275]
  ]],
  ["생필품", [
    ["코디(휴지)", 8500]
  ]]
];

const defaultValues = {
  shippingFee: "2400",
  coupangFeeRate: "12",
  vatRate: "10",
  earlySettlementRate: "1.2"
};

const boxPrices = {
  대: 480,
  중: 380,
  소: 250
};

const inputIds = [
  "unitCost",
  "quantity",
  "salePrice",
  "shippingFee",
  "coupangFeeRate",
  "vatRate",
  "earlySettlementRate"
];

const STORAGE = {
  favorite: "reborn_favorite",
  recent: "reborn_recent_products",
  savedInputs: "reborn_saved_inputs",
  businessMode: "reborn_business_mode",
  themeMode: "reborn_theme_mode"
};

let allProducts = [];
let selectedProduct = null;
let openedCategory = "";
let pickerOpen = false;
let businessMode = localStorage.getItem(STORAGE.businessMode) || "본점";
let themeMode = localStorage.getItem(STORAGE.themeMode) || "dark";

const $ = (id) => document.getElementById(id);

function num(value) {
  const raw = String(value ?? "").replace(/,/g, "").trim();
  if (raw === "") return 0;

  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function won(value) {
  return `${Math.round(num(value)).toLocaleString("ko-KR")}원`;
}

function pct(value) {
  return `${num(value).toFixed(2)}%`;
}

function roundToTen(value) {
  const n = num(value);
  if (n <= 0) return 0;
  return Math.ceil(n / 10) * 10;
}

function setResultStatus(tone, labelText, detailText) {
  const label = $("profitStatusLabel");
  const detail = $("quickDecision");
  [label, detail].forEach((el) => {
    if (!el) return;
    el.classList.remove("idle", "good", "warn", "bad");
    el.classList.add(tone);
  });
  if (label) label.textContent = labelText;
  if (detail) detail.textContent = detailText;
}

function safeText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function safeValue(id) {
  const el = $(id);
  return el ? el.value : "";
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getArr(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function setArr(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getObj(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function setObj(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


function resolveThemeMode(mode) {
  if (mode === "auto") {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  return mode === "light" ? "light" : "dark";
}

function applyThemeMode(mode) {
  const selectedMode = mode || "dark";
  const resolvedTheme = resolveThemeMode(selectedMode);

  themeMode = selectedMode;
  localStorage.setItem(STORAGE.themeMode, selectedMode);

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themeMode = selectedMode;

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    const isActive = btn.dataset.themeChoice === selectedMode;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setupThemeControls() {
  const buttons = document.querySelectorAll(".theme-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      applyThemeMode(btn.dataset.themeChoice || "dark");
    });
  });

  applyThemeMode(themeMode);

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncAutoTheme = () => {
      if (themeMode === "auto") {
        applyThemeMode("auto");
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncAutoTheme);
    } else if (typeof media.addListener === "function") {
      media.addListener(syncAutoTheme);
    }
  }
}

function hideSplash() {
  const splash = $("rebornSplash");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("hide");

    setTimeout(() => {
      if (splash.parentNode) {
        splash.parentNode.removeChild(splash);
      }
    }, 400);
  }, 1000);
}

function setupBusinessModeTabs() {
  const buttons = document.querySelectorAll(".business-mode-btn");

  buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === businessMode);

    btn.addEventListener("click", () => {
      businessMode = btn.dataset.mode;
      localStorage.setItem(STORAGE.businessMode, businessMode);

      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.mode === businessMode);
      });

      calculate();
    });
  });
}

function initProducts() {
  allProducts = [];

  productCategories.forEach(([category, products]) => {
    products.forEach(([name, price]) => {
      allProducts.push({
        key: `${category}__${name}`,
        category,
        name,
        price: num(price)
      });
    });
  });
}

function injectCategoryPickerStyle() {
  if (document.getElementById("rebornCategoryPickerStyle")) return;

  const style = document.createElement("style");
  style.id = "rebornCategoryPickerStyle";
  style.textContent = `
    .reborn-category-picker { position: relative; width: 100%; }

    .reborn-picker-main {
      width: 100%;
      height: 50px;
      border: 1px solid rgba(203, 213, 225, 0.86);
      border-radius: 18px;
      background: linear-gradient(145deg, #ffffff, #f8fafc);
      color: #334155;
      font-size: 14px;
      font-weight: 850;
      letter-spacing: -0.02em;
      padding: 0 15px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 9px 22px rgba(15, 23, 42, 0.045);
    }

    .reborn-picker-main span:first-child {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .reborn-picker-arrow {
      color: #10b981;
      font-size: 13px;
      font-weight: 900;
      margin-left: 8px;
      transition: transform 0.18s ease, color 0.18s ease;
    }

    .reborn-category-picker.open .reborn-picker-arrow {
      transform: rotate(180deg);
      color: #059669;
    }

    .reborn-picker-panel {
      display: none;
      margin-top: 10px;
      padding: 10px;
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(226, 232, 240, 0.95);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.09);
    }

    .reborn-category-picker.open .reborn-picker-panel {
      display: block;
    }

    .reborn-category-btn {
      width: 100%;
      border: 0;
      border-radius: 16px;
      padding: 12px 13px;
      margin-bottom: 7px;
      background: linear-gradient(145deg, #fff7fb, #f8fafc);
      color: #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 14px;
      font-weight: 900;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
    }

    .reborn-category-btn.active {
      background: linear-gradient(145deg, #ecfdf5, #fff8e7);
      color: #065f46;
      border: 1px solid rgba(167, 243, 208, 0.95);
    }

    .reborn-category-count {
      font-size: 11px;
      color: #10b981;
      font-weight: 900;
    }

    .reborn-product-list {
      display: grid;
      gap: 7px;
      margin: 2px 0 10px;
      padding: 7px;
      border-radius: 18px;
      background: rgba(248, 250, 252, 0.88);
    }

    .reborn-product-btn {
      width: 100%;
      border: 1px solid rgba(226, 232, 240, 0.95);
      border-radius: 15px;
      padding: 11px 12px;
      background: #ffffff;
      color: #334155;
      font-size: 13px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      text-align: left;
    }

    .reborn-product-name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .reborn-product-price {
      flex: 0 0 auto;
      color: #059669;
      font-size: 12px;
      font-weight: 900;
    }

    .reborn-empty-products {
      padding: 14px;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 800;
      text-align: center;
    }
  `;

  document.head.appendChild(style);
}

function createCategoryPicker() {
  injectCategoryPickerStyle();

  const nativeSelect = $("productSelect");
  if (!nativeSelect) return;

  nativeSelect.style.display = "none";

  const existing = $("rebornCategoryPicker");
  if (existing) existing.remove();

  const picker = document.createElement("div");
  picker.id = "rebornCategoryPicker";
  picker.className = "reborn-category-picker";

  picker.innerHTML = `
    <button type="button" id="rebornPickerMain" class="reborn-picker-main" aria-expanded="false" aria-controls="rebornPickerPanel">
      <span id="rebornPickerLabel">품목 선택</span>
      <span class="reborn-picker-arrow" aria-hidden="true">▼</span>
    </button>
    <div id="rebornPickerPanel" class="reborn-picker-panel" role="listbox" aria-label="품목 목록"></div>
  `;

  nativeSelect.parentNode.appendChild(picker);

  picker.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const mainBtn = $("rebornPickerMain");

  if (mainBtn) {
    mainBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      pickerOpen = !pickerOpen;
      picker.classList.toggle("open", pickerOpen);
      mainBtn.setAttribute("aria-expanded", String(pickerOpen));

      if (pickerOpen) {
        renderCategoryPicker();
      }
    });
  }

  document.addEventListener("click", () => {
    pickerOpen = false;
    picker.classList.remove("open");
    if (mainBtn) mainBtn.setAttribute("aria-expanded", "false");
  });

  renderCategoryPicker();
}

function renderCategoryPicker() {
  const panel = $("rebornPickerPanel");
  const search = $("productSearch");
  if (!panel) return;

  const keyword = normalizeText(search ? search.value : "");
  panel.innerHTML = "";

  const filteredProducts = allProducts.filter((product) => {
    const target = normalizeText(`${product.category}${product.name}`);
    return target.includes(keyword);
  });

  if (!filteredProducts.length) {
    const empty = document.createElement("div");
    empty.className = "reborn-empty-products";
    empty.textContent = "검색 결과가 없습니다.";
    panel.appendChild(empty);
    return;
  }

  const categories = productCategories
    .map(([category]) => category)
    .filter((category) => filteredProducts.some((product) => product.category === category));

  categories.forEach((category) => {
    const products = filteredProducts.filter((product) => product.category === category);

    const categoryBtn = document.createElement("button");
    categoryBtn.type = "button";
    categoryBtn.className = "reborn-category-btn";

    if (openedCategory === category || keyword) {
      categoryBtn.classList.add("active");
    }

    categoryBtn.innerHTML = `
      <span>${category}</span>
      <span class="reborn-category-count">${products.length}개</span>
    `;

    categoryBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (keyword) {
        openedCategory = category;
      } else {
        openedCategory = openedCategory === category ? "" : category;
      }

      pickerOpen = true;

      const picker = $("rebornCategoryPicker");
      if (picker) picker.classList.add("open");

      renderCategoryPicker();
    });

    panel.appendChild(categoryBtn);

    if (openedCategory === category || keyword) {
      const list = document.createElement("div");
      list.className = "reborn-product-list";

      products.forEach((product) => {
        const productBtn = document.createElement("button");
        productBtn.type = "button";
        productBtn.className = "reborn-product-btn";
        productBtn.setAttribute("role", "option");
        productBtn.innerHTML = `
          <span class="reborn-product-name">${product.name}</span>
          <span class="reborn-product-price">${product.price.toLocaleString("ko-KR")}원</span>
        `;

        productBtn.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();

          applyProduct(product);

          pickerOpen = false;

          const picker = $("rebornCategoryPicker");
          if (picker) picker.classList.remove("open");
          const mainBtn = $("rebornPickerMain");
          if (mainBtn) mainBtn.setAttribute("aria-expanded", "false");
        });

        list.appendChild(productBtn);
      });

      panel.appendChild(list);
    }
  });
}

function updatePickerLabel(product) {
  const label = $("rebornPickerLabel");
  const nativeSelect = $("productSelect");

  if (label && product) {
    label.textContent = product.name;
  }

  if (nativeSelect && product) {
    nativeSelect.value = product.key;
  }
}

function renderHiddenSelect() {
  const select = $("productSelect");
  if (!select) return;

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = "품목 선택";
  select.appendChild(first);

  allProducts.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.key;
    option.textContent = `${product.name} / ${product.price.toLocaleString("ko-KR")}원`;
    select.appendChild(option);
  });
}

function applyProduct(product) {
  if (!product) return;

  selectedProduct = product;

  const unitCost = $("unitCost");
  if (unitCost) {
    unitCost.value = product.price;
  }

  addRecentProduct(product);
  updatePickerLabel(product);
  updateFavoriteButton();
  renderRecentProducts();
  calculate();
}

function showBoxUI() {
  const boxUI = $("boxSizeOptions");
  if (!boxUI) return;

  boxUI.classList.remove("box-hidden");
  boxUI.removeAttribute("aria-hidden");
  boxUI.style.display = "grid";

  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.disabled = false;
    btn.tabIndex = 0;
  });
}

function hideBoxUI() {
  const boxUI = $("boxSizeOptions");
  if (!boxUI) return;

  boxUI.classList.add("box-hidden");
  boxUI.setAttribute("aria-hidden", "true");
  boxUI.style.display = "none";

  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.disabled = true;
    btn.tabIndex = -1;
  });
}

function applyBoxSize(size, shouldCalculate = true, shouldHide = true) {
  const boxFee = $("boxFee");
  const boxSize = $("boxSize");

  if (!boxFee || !boxSize) return;

  const price = boxPrices[size] || 0;

  boxFee.value = price;
  boxSize.value = size;

  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });

  if (shouldHide) {
    hideBoxUI();
  }

  if (shouldCalculate) {
    calculate();
  }
}

function setupBoxButtons() {
  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const boxUI = $("boxSizeOptions");
      if (!boxUI || boxUI.classList.contains("box-hidden") || btn.disabled) return;

      const size = btn.dataset.size;
      applyBoxSize(size, true, true);
    });
  });

  const changeBoxBtn = $("changeBoxBtn");

  if (changeBoxBtn) {
    changeBoxBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showBoxUI();
    });
  }

  const boxField = document.querySelector(".box-field");
  if (boxField) {
    boxField.addEventListener("click", (event) => {
      const target = event.target;
      if (target && target.closest && target.closest(".box-size-btn, #changeBoxBtn, .field-save-btn")) return;
      event.stopPropagation();
    });
  }

  const boxFee = $("boxFee");

  if (boxFee) {
    boxFee.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    boxFee.addEventListener("focus", () => {
      boxFee.blur();
    });
  }
}

function saveInputValue(target) {
  const saved = getObj(STORAGE.savedInputs);

  if (target === "boxSize") {
    saved.boxSize = safeValue("boxSize");
    saved.boxFee = safeValue("boxFee");
  } else {
    saved[target] = safeValue(target);
  }

  setObj(STORAGE.savedInputs, saved);
  markSavedButton(target);
}

function restoreSavedInputs() {
  const saved = getObj(STORAGE.savedInputs);

  Object.keys(saved).forEach((id) => {
    if (id === "boxSize") {
      if (saved.boxSize) {
        applyBoxSize(saved.boxSize, false, true);
      }
      return;
    }

    if (id === "boxFee") return;

    const el = $(id);
    if (el) {
      el.value = saved[id];
    }
  });

  if (!saved.boxSize) {
    showBoxUI();
  }
}

function markSavedButton(target) {
  const btn = document.querySelector(`.field-save-btn[data-save="${target}"]`);
  if (!btn) return;

  btn.textContent = "저장됨";
  btn.classList.add("saved");

  setTimeout(() => {
    btn.textContent = "저장";
    btn.classList.remove("saved");
  }, 900);
}

function setupSaveButtons() {
  document.querySelectorAll(".field-save-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.save;
      saveInputValue(target);
    });
  });
}

function isFavorite(product) {
  if (!product) return false;

  const list = getArr(STORAGE.favorite);
  return list.some((item) => item.key === product.key);
}

function toggleFavorite(product) {
  if (!product) return;

  let list = getArr(STORAGE.favorite);

  if (isFavorite(product)) {
    list = list.filter((item) => item.key !== product.key);
  } else {
    list.unshift(product);
  }

  setArr(STORAGE.favorite, list);
  renderFavorites();
  updateFavoriteButton();
}

function addRecentProduct(product) {
  if (!product) return;

  let list = getArr(STORAGE.recent).filter((item) => item.key !== product.key);
  list.unshift({
    key: product.key,
    category: product.category,
    name: product.name,
    price: product.price
  });
  setArr(STORAGE.recent, list.slice(0, 6));
}

function removeRecentProduct(productKey) {
  if (!productKey) return;

  const list = getArr(STORAGE.recent).filter((item) => item.key !== productKey);
  setArr(STORAGE.recent, list);
  renderRecentProducts();
}

function clearRecentProducts() {
  localStorage.removeItem(STORAGE.recent);
  renderRecentProducts();
}

function renderRecentProducts() {
  const box = $("recentList");
  if (!box) return;

  const list = getArr(STORAGE.recent).slice(0, 5);
  box.innerHTML = "";

  if (!list.length) {
    box.style.display = "none";
    return;
  }

  box.style.display = "block";
  box.classList.add("recent-compact");

  const header = document.createElement("div");
  header.className = "recent-header";

  const title = document.createElement("div");
  title.className = "recent-title";
  title.textContent = "최근 사용";

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.className = "recent-clear-all-btn";
  clearAllBtn.textContent = "전체 삭제";
  clearAllBtn.setAttribute("aria-label", "최근 사용 상품 전체 삭제");
  clearAllBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearRecentProducts();
  });

  header.appendChild(title);
  header.appendChild(clearAllBtn);
  box.appendChild(header);

  const listWrap = document.createElement("div");
  listWrap.className = "recent-chip-list";

  list.forEach((product) => {
    const item = document.createElement("div");
    item.className = "recent-chip";

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "recent-apply-btn";
    applyBtn.title = `${product.name} 적용`;
    applyBtn.innerHTML = `
      <span class="recent-chip-name">${product.name}</span>
      <span class="recent-chip-price">${num(product.price).toLocaleString("ko-KR")}원</span>
    `;
    applyBtn.addEventListener("click", () => applyProduct(product));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "recent-remove-btn";
    removeBtn.textContent = "×";
    removeBtn.title = `${product.name} 최근 사용에서 삭제`;
    removeBtn.setAttribute("aria-label", `${product.name} 최근 사용에서 삭제`);
    removeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeRecentProduct(product.key);
    });

    item.appendChild(applyBtn);
    item.appendChild(removeBtn);
    listWrap.appendChild(item);
  });

  box.appendChild(listWrap);
}

function renderFavorites() {
  const box = $("favoriteList");
  if (!box) return;

  const list = getArr(STORAGE.favorite);
  box.innerHTML = "";

  if (!list.length) return;

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "즐겨찾기";
  box.appendChild(title);

  list.forEach((product) => {
    const item = document.createElement("div");
    item.className = "favorite-item";

    const productBtn = document.createElement("button");
    productBtn.type = "button";
    productBtn.className = "quick-product-btn";
    productBtn.textContent = `${product.name} · ${num(product.price).toLocaleString("ko-KR")}원`;
    productBtn.addEventListener("click", () => {
      applyProduct(product);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-favorite-btn";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => toggleFavorite(product));

    item.appendChild(productBtn);
    item.appendChild(removeBtn);
    box.appendChild(item);
  });
}

function updateFavoriteButton() {
  const btn = $("addFavoriteBtn");
  if (!btn) return;

  if (!selectedProduct) {
    btn.textContent = "☆";
    btn.title = "상품을 먼저 선택하세요";
    return;
  }

  if (isFavorite(selectedProduct)) {
    btn.textContent = "★";
    btn.title = "즐겨찾기에서 제거";
  } else {
    btn.textContent = "☆";
    btn.title = "즐겨찾기 추가";
  }
}

function calculate() {
  const cost = num(safeValue("unitCost"));
  const qty = num(safeValue("quantity"));
  const sale = num(safeValue("salePrice"));
  const boxFee = num(safeValue("boxFee"));
  const ship = num(safeValue("shippingFee"));

  const feeRate = num(safeValue("coupangFeeRate")) / 100;
  const vatRate = num(safeValue("vatRate")) / 100;
  const earlyRate = num(safeValue("earlySettlementRate")) / 100;
  const variableRate = feeRate + vatRate + earlyRate;

  const productCost = cost * qty;
  const fixedCost = productCost + boxFee + ship;
  const coupangFee = sale * feeRate;
  const vatFee = sale * vatRate;
  const earlyFee = sale * earlyRate;

  const total = fixedCost + coupangFee + vatFee + earlyFee;
  const profit = sale - total;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;
  const breakEven = variableRate < 1 ? fixedCost / (1 - variableRate) : 0;
  const targetSale = variableRate + 0.1 < 1 ? fixedCost / (1 - variableRate - 0.1) : 0;

  safeText("totalProductCost", won(productCost));
  safeText("boxFeeResult", won(boxFee));
  safeText("coupangFee", won(coupangFee));
  safeText("earlySettlementFee", won(earlyFee));
  safeText("vat", won(vatFee));
  safeText("totalCost", won(total));
  safeText("profit", won(profit));
  safeText("marginRate", pct(margin));
  safeText("breakEvenPrice", won(roundToTen(breakEven)));
  safeText("targetSalePrice", won(roundToTen(targetSale)));
  safeText("heroProfitMirror", sale > 0 ? won(profit) : "자동 계산");
  safeText("heroMarginMirror", sale > 0 ? pct(margin) : "0.00%");

  if (!sale || !fixedCost) {
    setResultStatus("idle", "대기", "원가·수량·판매가 입력 후 자동 판단됩니다.");
  } else if (profit < 0) {
    setResultStatus("bad", "손실", `손익분기 판매가보다 ${won(Math.abs(sale - breakEven))} 낮습니다.`);
  } else if (margin < 10) {
    setResultStatus("warn", "주의", "이익은 있지만 마진율 10% 미만입니다.");
  } else {
    setResultStatus("good", "양호", "현재 입력값 기준으로 판매 가능성이 높습니다.");
  }

  updateProfitStyle(profit);
}

function updateProfitStyle(profit) {
  ["profitCard", "marginCard"].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.classList.remove("profit", "loss");
    el.classList.add(profit >= 0 ? "profit" : "loss");
  });

  ["profit", "marginRate"].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.classList.remove("profit-text", "loss-text");
    el.classList.add(profit >= 0 ? "profit-text" : "loss-text");
  });
}

function applyDefaults() {
  Object.keys(defaultValues).forEach((id) => {
    const el = $(id);
    if (!el) return;

    const value = String(el.value || "").trim();

    if (value === "" || value === "0") {
      el.value = defaultValues[id];
    }
  });
}

function removeLeadingZero(input) {
  const value = String(input.value || "");

  if (value.length > 1 && value.startsWith("0") && !value.startsWith("0.")) {
    input.value = value.replace(/^0+/, "");
  }
}

function setupInputs() {
  const inputs = inputIds.map((id) => $(id)).filter(Boolean);

  inputs.forEach((input, index) => {
    input.setAttribute("enterkeyhint", index === inputs.length - 1 ? "done" : "next");

    input.addEventListener("focus", () => {
      if (input.value === "0") input.value = "";
    });

    input.addEventListener("blur", () => {
      if (String(input.value || "").trim() === "") {
        input.value = "0";
      }

      calculate();
    });

    input.addEventListener("input", () => {
      removeLeadingZero(input);
      calculate();
    });

    input.addEventListener("change", calculate);

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      const next = inputs[index + 1];

      if (next) {
        next.focus();
        if (typeof next.select === "function") next.select();
      } else {
        input.blur();
      }
    });
  });
}

function setupProductEvents() {
  const search = $("productSearch");
  const favoriteBtn = $("addFavoriteBtn");
  const clearBtn = $("clearProductSearchBtn");

  if (search) {
    search.addEventListener("input", () => {
      openedCategory = "";
      pickerOpen = true;

      const picker = $("rebornCategoryPicker");
      if (picker) picker.classList.add("open");

      renderCategoryPicker();
    });

    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        pickerOpen = true;

        const picker = $("rebornCategoryPicker");
        if (picker) picker.classList.add("open");

        renderCategoryPicker();
      }
    });
  }

  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", () => {
      if (!selectedProduct) return;
      toggleFavorite(selectedProduct);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (search) search.value = "";
      openedCategory = "";
      renderCategoryPicker();

      if (search) search.focus();
    });
  }

  renderRecentProducts();
}

function restoreRecommendedDefaults() {
  Object.entries(defaultValues).forEach(([id, value]) => {
    const el = $(id);
    if (el) el.value = value;
  });
  calculate();
}

function clearCoreInputs() {
  ["unitCost", "quantity", "salePrice"].forEach((id) => {
    const el = $(id);
    if (el) el.value = "0";
  });

  selectedProduct = null;
  const nativeSelect = $("productSelect");
  if (nativeSelect) nativeSelect.value = "";
  const pickerLabel = $("rebornPickerLabel");
  if (pickerLabel) pickerLabel.textContent = "품목 선택";

  updateFavoriteButton();
  calculate();
}

function setupQuickActions() {
  const restoreBtn = $("restoreDefaultsBtn");
  const clearBtn = $("clearInputsBtn");
  const jumpBtn = $("jumpResultsBtn");

  if (restoreBtn) restoreBtn.addEventListener("click", restoreRecommendedDefaults);
  if (clearBtn) clearBtn.addEventListener("click", clearCoreInputs);
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      const results = $("results");
      if (results) results.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function init() {
  setupThemeControls();
  initProducts();
  applyDefaults();
  restoreSavedInputs();

  renderHiddenSelect();
  createCategoryPicker();
  renderFavorites();
  renderRecentProducts();

  setupBusinessModeTabs();
  setupProductEvents();
  setupInputs();
  setupBoxButtons();
  setupSaveButtons();
  setupQuickActions();

  calculate();
  updateFavoriteButton();
}

document.addEventListener("DOMContentLoaded", () => {
  hideSplash();

  try {
    init();
  } catch (error) {
    console.error("RE:BORN 초기화 오류:", error);
  }
});
