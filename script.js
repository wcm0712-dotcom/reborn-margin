/* =========================
   RE:BORN Margin Calculator
   FULL SAFE FINAL
========================= */

const productCategories = [
  ["누룽지", [
    ["찹쌀 누룽지 스위트", 2200],
    ["찹쌀 누룽지 무가당", 2200],
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
    ["에낙 치킨", 4916.6],
    ["에낙 스파이시", 4916.6]
  ]],
  ["꽈배기", [
    ["명가 참깨", 4200],
    ["명가 흑당", 4200]
  ]],
  ["네모스낵", [
    ["네모스낵 치킨맛", 172.2],
    ["네모스낵 불고기맛", 172.2],
    ["네모스낵 매콤한맛", 172.2]
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
  savedInputs: "reborn_saved_inputs"
};

let allProducts = [];
let selectedProduct = null;
let openedCategory = "";
let pickerOpen = false;

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

/* 상품 */

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

/* 품목 선택 UI */

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
    <button type="button" id="rebornPickerMain" class="reborn-picker-main">
      <span id="rebornPickerLabel">품목 선택</span>
      <span class="reborn-picker-arrow">▼</span>
    </button>
    <div id="rebornPickerPanel" class="reborn-picker-panel"></div>
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

      if (pickerOpen) {
        renderCategoryPicker();
      }
    });
  }

  document.addEventListener("click", () => {
    pickerOpen = false;
    picker.classList.remove("open");
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

/* 상품 적용 */

function applyProduct(product) {
  if (!product) return;

  selectedProduct = product;

  const unitCost = $("unitCost");
  if (unitCost) {
    unitCost.value = product.price;
  }

  updatePickerLabel(product);
  updateFavoriteButton();
  calculate();
}

/* 박스비 */

function applyBoxSize(size, shouldCalculate = true, hideAfterSelect = true) {
  const boxFee = $("boxFee");
  const boxSize = $("boxSize");
  const boxUI = $("boxSizeOptions");

  if (!boxFee || !boxSize) return;

  const price = boxPrices[size] || 0;

  boxFee.value = price;
  boxSize.value = size;

  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });

  if (boxUI) {
    if (hideAfterSelect) {
      boxUI.classList.add("box-hidden");
      boxUI.style.display = "none";
    } else {
      boxUI.classList.remove("box-hidden");
      boxUI.style.display = "grid";
    }
  }

  if (shouldCalculate) calculate();
}

function showBoxUI() {
  const boxUI = $("boxSizeOptions");

  if (boxUI) {
    boxUI.classList.remove("box-hidden");
    boxUI.style.display = "grid";
  }
}

function setupBoxButtons() {
  document.querySelectorAll(".box-size-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      applyBoxSize(btn.dataset.size, true, true);
    });
  });

  const boxFee = $("boxFee");
  const changeBoxBtn = $("changeBoxBtn");

  if (boxFee) {
    boxFee.addEventListener("click", showBoxUI);
    boxFee.addEventListener("focus", showBoxUI);
  }

  if (changeBoxBtn) {
    changeBoxBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showBoxUI();
    });
  }
}

/* 저장 */

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
        applyBoxSize(saved.boxSize, false, false);
      }
      return;
    }

    if (id === "boxFee") return;

    const el = $(id);
    if (el) {
      el.value = saved[id];
    }
  });

  const boxUI = $("boxSizeOptions");
  if (boxUI) {
    boxUI.classList.remove("box-hidden");
    boxUI.style.display = "grid";
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

/* 즐겨찾기 */

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

/* 계산 */

function calculate() {
  const cost = num(safeValue("unitCost"));
  const qty = num(safeValue("quantity"));
  const sale = num(safeValue("salePrice"));
  const boxFee = num(safeValue("boxFee"));
  const ship = num(safeValue("shippingFee"));

  const feeRate = num(safeValue("coupangFeeRate")) / 100;
  const vatRate = num(safeValue("vatRate")) / 100;
  const earlyRate = num(safeValue("earlySettlementRate")) / 100;

  const productCost = cost * qty;
  const coupangFee = sale * feeRate;
  const vatFee = sale * vatRate;
  const earlyFee = sale * earlyRate;

  const total = productCost + boxFee + ship + coupangFee + vatFee + earlyFee;
  const profit = sale - total;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  safeText("totalProductCost", won(productCost));
  safeText("boxFeeResult", won(boxFee));
  safeText("coupangFee", won(coupangFee));
  safeText("earlySettlementFee", won(earlyFee));
  safeText("vat", won(vatFee));
  safeText("totalCost", won(total));
  safeText("profit", won(profit));
  safeText("marginRate", pct(margin));

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

/* 입력 편의 */

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

/* 이벤트 */

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

  const recentBox = $("recentList");
  if (recentBox) {
    recentBox.innerHTML = "";
    recentBox.style.display = "none";
  }
}

/* 초기화 */

function init() {
  initProducts();
  applyDefaults();
  restoreSavedInputs();

  renderHiddenSelect();
  createCategoryPicker();
  renderFavorites();

  setupProductEvents();
  setupInputs();
  setupBoxButtons();
  setupSaveButtons();

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
