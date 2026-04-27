/* =========================
   RE:BORN Margin Calculator
   SAFE FINAL script.js
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
  recent: "reborn_recent",
  favorite: "reborn_favorite"
};

let allProducts = [];
let selectedProduct = null;
let recentVisible = false;

const $ = (id) => document.getElementById(id);

function safeText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function safeValue(id) {
  const el = $(id);
  return el ? el.value : "";
}

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

function setArr(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
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

function initProducts() {
  allProducts = [];

  productCategories.forEach(([category, list]) => {
    list.forEach(([name, price]) => {
      allProducts.push({
        key: `${category}__${name}`,
        category,
        name,
        price: num(price)
      });
    });
  });
}

function renderProducts(keyword = "") {
  const select = $("productSelect");
  if (!select) return;

  const k = normalizeText(keyword);

  const filtered = allProducts.filter((product) => {
    const target = normalizeText(`${product.category}${product.name}`);
    return target.includes(k);
  });

  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = filtered.length ? "품목 선택" : "검색 결과 없음";
  select.appendChild(first);

  const grouped = {};

  filtered.forEach((product) => {
    if (!grouped[product.category]) grouped[product.category] = [];
    grouped[product.category].push(product);
  });

  Object.keys(grouped).forEach((category) => {
    const group = document.createElement("optgroup");
    group.label = category;

    grouped[category].forEach((product) => {
      const option = document.createElement("option");
      option.value = product.key;
      option.textContent = `${product.name} / ${product.price.toLocaleString("ko-KR")}원`;
      group.appendChild(option);
    });

    select.appendChild(group);
  });
}

function getProductByKey(key) {
  return allProducts.find((product) => product.key === key) || null;
}

function syncSelect(product) {
  const select = $("productSelect");
  if (!select || !product) return;

  const exists = Array.from(select.options).some((option) => option.value === product.key);
  if (exists) select.value = product.key;
}

function selectProduct(product) {
  if (!product) return;

  selectedProduct = product;

  const unitCost = $("unitCost");
  if (unitCost) {
    unitCost.value = product.price;
  }

  saveRecent(product);
  updateFavoriteButton();
  calculate();
}

function saveRecent(product) {
  if (!product) return;

  let list = getArr(STORAGE.recent);
  list = list.filter((item) => item.key !== product.key);
  list.unshift(product);
  list = list.slice(0, 6);

  setArr(STORAGE.recent, list);

  if (recentVisible) {
    renderRecent();
  }
}

function removeRecent(key) {
  let list = getArr(STORAGE.recent);
  list = list.filter((item) => item.key !== key);
  setArr(STORAGE.recent, list);
  renderRecent();
}

function clearRecent() {
  localStorage.removeItem(STORAGE.recent);
  renderRecent();
}

function hideRecent() {
  const box = $("recentList");
  if (box) box.innerHTML = "";
  recentVisible = false;
}

function showRecent() {
  recentVisible = true;
  renderRecent();
}

function renderRecent() {
  const box = $("recentList");
  if (!box) return;

  box.innerHTML = "";

  if (!recentVisible) return;

  const list = getArr(STORAGE.recent);
  if (!list.length) return;

  const titleRow = document.createElement("div");
  titleRow.className = "recent-title-row";

  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "최근 선택";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "clear-recent-btn";
  clearBtn.textContent = "전체 삭제";
  clearBtn.addEventListener("click", clearRecent);

  titleRow.appendChild(title);
  titleRow.appendChild(clearBtn);
  box.appendChild(titleRow);

  list.forEach((product) => {
    const item = document.createElement("div");
    item.className = "recent-item";

    const productBtn = document.createElement("button");
    productBtn.type = "button";
    productBtn.className = "quick-product-btn";
    productBtn.textContent = `${product.name} · ${num(product.price).toLocaleString("ko-KR")}원`;
    productBtn.addEventListener("click", () => {
      selectProduct(product);
      syncSelect(product);
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-recent-btn";
    removeBtn.textContent = "삭제";
    removeBtn.addEventListener("click", () => removeRecent(product.key));

    item.appendChild(productBtn);
    item.appendChild(removeBtn);
    box.appendChild(item);
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
      selectProduct(product);
      syncSelect(product);
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

  const select = $("productSelect");
  const product = selectedProduct || getProductByKey(select?.value);

  if (!product) {
    btn.textContent = "☆";
    btn.title = "최근 선택 보기";
    return;
  }

  if (isFavorite(product)) {
    btn.textContent = "★";
    btn.title = "즐겨찾기에서 제거 / 최근 선택 보기";
  } else {
    btn.textContent = "☆";
    btn.title = "즐겨찾기 추가 / 최근 선택 보기";
  }
}

function calculate() {
  const cost = num(safeValue("unitCost"));
  const qty = num(safeValue("quantity"));
  const sale = num(safeValue("salePrice"));
  const ship = num(safeValue("shippingFee"));

  const feeRate = num(safeValue("coupangFeeRate")) / 100;
  const vatRate = num(safeValue("vatRate")) / 100;
  const earlyRate = num(safeValue("earlySettlementRate")) / 100;

  const productCost = cost * qty;
  const coupangFee = sale * feeRate;
  const vatFee = sale * vatRate;
  const earlyFee = sale * earlyRate;

  const total = productCost + ship + coupangFee + vatFee + earlyFee;
  const profit = sale - total;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  safeText("totalProductCost", won(productCost));
  safeText("coupangFee", won(coupangFee));
  safeText("earlySettlementFee", won(earlyFee));
  safeText("vat", won(vatFee));
  safeText("totalCost", won(total));
  safeText("profit", won(profit));
  safeText("marginRate", pct(margin));

  safeText("quickProfit", won(profit));
  safeText("quickMargin", pct(margin));
  safeText("quickBreakEven", won(total));
  safeText("summarySalePrice", won(sale));
  safeText("summaryTotalCost", won(total));
  safeText("summaryProfit", won(profit));
  safeText("summaryMargin", pct(margin));

  updateProfitStyle(profit);
}

function updateProfitStyle(profit) {
  ["profitCard", "marginCard"].forEach((id) => {
    const el = $(id);
    if (!el) return;

    el.classList.remove("profit", "loss");
    el.classList.add(profit >= 0 ? "profit" : "loss");
  });

  ["profit", "marginRate", "quickProfit", "quickMargin", "summaryProfit", "summaryMargin"].forEach((id) => {
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
  const select = $("productSelect");
  const favoriteBtn = $("addFavoriteBtn");
  const clearBtn = $("clearProductSearchBtn");

  if (search) {
    search.addEventListener("input", () => {
      renderProducts(search.value);
      selectedProduct = null;
      updateFavoriteButton();
    });

    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        if (select) select.focus();
      }
    });
  }

  if (select) {
    select.addEventListener("change", () => {
      const product = getProductByKey(select.value);

      if (!product) {
        selectedProduct = null;
        updateFavoriteButton();
        return;
      }

      selectProduct(product);
    });
  }

  if (favoriteBtn) {
    favoriteBtn.addEventListener("click", () => {
      showRecent();

      const product = selectedProduct || getProductByKey(select?.value);

      if (!product) {
        if (select) select.focus();
        return;
      }

      toggleFavorite(product);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (search) search.value = "";
      if (select) select.value = "";

      selectedProduct = null;
      renderProducts();
      updateFavoriteButton();

      if (search) search.focus();
    });
  }
}

function init() {
  initProducts();
  applyDefaults();

  renderProducts();
  renderFavorites();
  hideRecent();

  setupProductEvents();
  setupInputs();

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
