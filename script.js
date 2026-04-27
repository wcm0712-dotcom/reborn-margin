/* =========================
   RE:BORN Margin Calculator
   script.js 전체 교체본
========================= */

/* =========================
   상품 데이터
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

/* =========================
   기본 설정값
========================= */

const defaultValues = {
  shippingFee: "2400",
  coupangFeeRate: "12",
  vatRate: "10",
  earlySettlementRate: "1.2"
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

const storageKeys = {
  recent: "reborn_recent_products",
  favorite: "reborn_favorite_products"
};

let allProducts = [];
let selectedProduct = null;

/* =========================
   DOM 유틸
========================= */

const $ = (id) => document.getElementById(id);

function getEl(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = getEl(id);
  if (el) el.textContent = value;
}

function getNumber(id) {
  const el = getEl(id);
  if (!el) return 0;

  const raw = String(el.value).trim().replace(/,/g, "");
  if (raw === "") return 0;

  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function getRate(id) {
  return getNumber(id) / 100;
}

function money(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ko-KR")}원`;
}

function pct(value) {
  return `${(Number(value) || 0).toFixed(2)}%`;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
}

function getStorageArray(key) {
  return safeJsonParse(localStorage.getItem(key), []);
}

function setStorageArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/* =========================
   상품 데이터 정리
========================= */

function flattenProducts() {
  allProducts = [];

  productCategories.forEach(([categoryName, products]) => {
    products.forEach(([name, price]) => {
      allProducts.push({
        key: `${categoryName}__${name}`,
        category: categoryName,
        name,
        price: Number(price)
      });
    });
  });
}

/* =========================
   상품 선택창 렌더링
========================= */

function renderProductOptions(keyword = "") {
  const productSelect = $("productSelect");
  if (!productSelect) return;

  const normalizedKeyword = normalizeText(keyword);

  const filteredProducts = allProducts.filter((product) => {
    const target = normalizeText(`${product.category}${product.name}`);
    return target.includes(normalizedKeyword);
  });

  const fragment = document.createDocumentFragment();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = filteredProducts.length > 0 ? "품목 선택" : "검색 결과 없음";
  fragment.appendChild(defaultOption);

  const grouped = {};

  filteredProducts.forEach((product) => {
    if (!grouped[product.category]) grouped[product.category] = [];
    grouped[product.category].push(product);
  });

  Object.keys(grouped).forEach((categoryName) => {
    const group = document.createElement("optgroup");
    group.label = categoryName;

    grouped[categoryName].forEach((product) => {
      const option = document.createElement("option");

      option.value = product.key;
      option.textContent = `${product.name} / ${product.price.toLocaleString("ko-KR")}원`;
      option.dataset.name = product.name;
      option.dataset.price = product.price;
      option.dataset.category = product.category;

      group.appendChild(option);
    });

    fragment.appendChild(group);
  });

  productSelect.innerHTML = "";
  productSelect.appendChild(fragment);
}

function getSelectedProductFromSelect() {
  const productSelect = $("productSelect");
  if (!productSelect || !productSelect.value) return null;

  return allProducts.find((product) => product.key === productSelect.value) || null;
}

function syncSelectWithProduct(product) {
  const productSelect = $("productSelect");
  if (!productSelect || !product) return;

  const exists = Array.from(productSelect.options).some((option) => option.value === product.key);

  if (exists) {
    productSelect.value = product.key;
  }
}

/* =========================
   상품 적용
========================= */

function applyProduct(product) {
  if (!product) return;

  selectedProduct = product;

  const unitCostInput = $("unitCost");
  if (unitCostInput) {
    unitCostInput.value = product.price;
    unitCostInput.dispatchEvent(new Event("input", { bubbles: true }));
    unitCostInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  saveRecentProduct(product);
  updateFavoriteButtonState();
  calculate();
}

/* =========================
   최근 선택
========================= */

function saveRecentProduct(product) {
  if (!product) return;

  let recent = getStorageArray(storageKeys.recent);

  recent = recent.filter((item) => item.key !== product.key);

  recent.unshift({
    key: product.key,
    category: product.category,
    name: product.name,
    price: product.price
  });

  recent = recent.slice(0, 6);

  setStorageArray(storageKeys.recent, recent);
  renderRecentProducts();
}

function renderRecentProducts() {
  const recentList = $("recentList");
  if (!recentList) return;

  const recent = getStorageArray(storageKeys.recent);

  recentList.innerHTML = "";

  if (recent.length === 0) return;

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "최근 선택";
  recentList.appendChild(title);

  recent.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-product-btn";
    button.textContent = `${item.name} · ${Number(item.price).toLocaleString("ko-KR")}원`;

    button.addEventListener("click", () => {
      applyProduct(item);
      syncSelectWithProduct(item);
    });

    recentList.appendChild(button);
  });
}

/* =========================
   즐겨찾기
========================= */

function isFavorite(product) {
  if (!product) return false;

  const favorites = getStorageArray(storageKeys.favorite);
  return favorites.some((item) => item.key === product.key);
}

function toggleFavoriteProduct(product) {
  if (!product) return;

  let favorites = getStorageArray(storageKeys.favorite);

  const exists = favorites.some((item) => item.key === product.key);

  if (exists) {
    favorites = favorites.filter((item) => item.key !== product.key);
  } else {
    favorites.unshift({
      key: product.key,
      category: product.category,
      name: product.name,
      price: product.price
    });
  }

  setStorageArray(storageKeys.favorite, favorites);

  renderFavoriteProducts();
  updateFavoriteButtonState();
}

function renderFavoriteProducts() {
  const favoriteList = $("favoriteList");
  if (!favoriteList) return;

  const favorites = getStorageArray(storageKeys.favorite);

  favoriteList.innerHTML = "";

  if (favorites.length === 0) return;

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "즐겨찾기";
  favoriteList.appendChild(title);

  favorites.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "favorite-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-product-btn";
    button.textContent = `${item.name} · ${Number(item.price).toLocaleString("ko-KR")}원`;

    button.addEventListener("click", () => {
      applyProduct(item);
      syncSelectWithProduct(item);
    });

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-favorite-btn";
    removeButton.textContent = "삭제";

    removeButton.addEventListener("click", () => {
      toggleFavoriteProduct(item);
    });

    wrap.appendChild(button);
    wrap.appendChild(removeButton);
    favoriteList.appendChild(wrap);
  });
}

function updateFavoriteButtonState() {
  const addFavoriteBtn = $("addFavoriteBtn");
  if (!addFavoriteBtn) return;

  const product = selectedProduct || getSelectedProductFromSelect();

  if (!product) {
    addFavoriteBtn.textContent = "☆";
    addFavoriteBtn.title = "상품을 먼저 선택하세요";
    return;
  }

  if (isFavorite(product)) {
    addFavoriteBtn.textContent = "★";
    addFavoriteBtn.title = "즐겨찾기에서 제거";
  } else {
    addFavoriteBtn.textContent = "☆";
    addFavoriteBtn.title = "즐겨찾기 추가";
  }
}

/* =========================
   계산 로직
========================= */

function calculate() {
  const unitCost = getNumber("unitCost");
  const quantity = getNumber("quantity");
  const salePrice = getNumber("salePrice");
  const shippingFee = getNumber("shippingFee");

  const coupangFeeRate = getRate("coupangFeeRate");
  const vatRate = getRate("vatRate");
  const earlySettlementRate = getRate("earlySettlementRate");

  const totalProductCost = unitCost * quantity;
  const coupangFee = salePrice * coupangFeeRate;
  const earlySettlementFee = salePrice * earlySettlementRate;
  const vat = salePrice * vatRate;

  const totalCost =
    totalProductCost +
    shippingFee +
    coupangFee +
    earlySettlementFee +
    vat;

  const profit = salePrice - totalCost;
  const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  setText("quickProfit", money(profit));
  setText("quickMargin", pct(marginRate));
  setText("quickBreakEven", money(totalCost));

  setText("summarySalePrice", money(salePrice));
  setText("summaryTotalCost", money(totalCost));
  setText("summaryProfit", money(profit));
  setText("summaryMargin", pct(marginRate));

  setText("totalProductCost", money(totalProductCost));
  setText("coupangFee", money(coupangFee));
  setText("earlySettlementFee", money(earlySettlementFee));
  setText("vat", money(vat));
  setText("totalCost", money(totalCost));
  setText("profit", money(profit));
  setText("marginRate", pct(marginRate));

  updateProfitStyle(profit);
}

function updateProfitStyle(profit) {
  ["profitCard", "marginCard"].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.classList.remove("profit", "loss");
    el.classList.add(profit >= 0 ? "profit" : "loss");
  });

  [
    "quickProfit",
    "quickMargin",
    "summaryProfit",
    "summaryMargin",
    "profit",
    "marginRate"
  ].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.classList.remove("profit-text", "loss-text");
    el.classList.add(profit >= 0 ? "profit-text" : "loss-text");
  });
}

/* =========================
   기본값 적용
========================= */

function applyDefaultValues() {
  Object.keys(defaultValues).forEach((id) => {
    const el = $(id);
    if (!el) return;

    const currentValue = String(el.value).trim();

    if (currentValue === "" || currentValue === "0") {
      el.value = defaultValues[id];
    }
  });
}

/* =========================
   입력 편의 기능
========================= */

function setupInputEvents() {
  const inputs = inputIds
    .map((id) => $(id))
    .filter(Boolean);

  inputs.forEach((input, index) => {
    input.setAttribute("enterkeyhint", index === inputs.length - 1 ? "done" : "next");

    input.addEventListener("focus", () => {
      if (input.value === "0") {
        input.value = "";
      }
    });

    input.addEventListener("blur", () => {
      if (String(input.value).trim() === "") {
        input.value = "0";
      }

      calculate();
    });

    input.addEventListener("input", () => {
      removeLeadingZero(input);
      calculate();
    });

    input.addEventListener("change", calculate);
    input.addEventListener("keyup", calculate);

    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      const next = inputs[index + 1];

      if (next) {
        next.focus();

        if (typeof next.select === "function") {
          next.select();
        }
      } else {
        input.blur();
      }
    });
  });
}

function removeLeadingZero(input) {
  if (!input) return;

  const value = String(input.value);

  if (value.length > 1 && value.startsWith("0") && !value.startsWith("0.")) {
    input.value = value.replace(/^0+/, "");
  }
}

/* =========================
   상품 관련 이벤트
========================= */

function setupProductEvents() {
  const productSearch = $("productSearch");
  const productSelect = $("productSelect");
  const clearProductSearchBtn = $("clearProductSearchBtn");
  const addFavoriteBtn = $("addFavoriteBtn");

  if (productSearch) {
    productSearch.addEventListener("input", () => {
      renderProductOptions(productSearch.value);
      selectedProduct = null;
      updateFavoriteButtonState();
    });

    productSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;

      event.preventDefault();

      if (productSelect) {
        productSelect.focus();
      }
    });
  }

  if (clearProductSearchBtn) {
    clearProductSearchBtn.addEventListener("click", () => {
      if (productSearch) {
        productSearch.value = "";
        productSearch.focus();
      }

      if (productSelect) {
        productSelect.value = "";
      }

      selectedProduct = null;
      renderProductOptions();
      updateFavoriteButtonState();
    });
  }

  if (productSelect) {
    productSelect.addEventListener("change", () => {
      const product = getSelectedProductFromSelect();

      if (!product) {
        selectedProduct = null;
        updateFavoriteButtonState();
        return;
      }

      applyProduct(product);
    });
  }

  if (addFavoriteBtn) {
    addFavoriteBtn.addEventListener("click", () => {
      const product = selectedProduct || getSelectedProductFromSelect();

      if (!product) {
        if (productSelect) productSelect.focus();
        return;
      }

      toggleFavoriteProduct(product);
    });
  }
}

/* =========================
   스플래시
========================= */

function setupSplash() {
  window.addEventListener("load", () => {
    setTimeout(() => {
      const splash = $("rebornSplash");

      if (!splash) return;

      splash.classList.add("hide");

      setTimeout(() => {
        if (splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      }, 400);
    }, 1000);
  });
}

/* =========================
   초기 실행
========================= */

function init() {
  flattenProducts();

  applyDefaultValues();

  renderProductOptions();
  renderFavoriteProducts();
  renderRecentProducts();

  setupProductEvents();
  setupInputEvents();
  setupSplash();

  calculate();
  updateFavoriteButtonState();
}

document.addEventListener("DOMContentLoaded", init);
