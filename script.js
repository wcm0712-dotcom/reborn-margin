/* =========================
   RE:BORN Margin Calculator
   FINAL script.js
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
  ["기타", [
    ["보리건빵", 125],
    ["감자알칩", 282.5]
  ]]
];

/* =========================
   기본값
========================= */

const defaultValues = {
  shippingFee: "2400",
  coupangFeeRate: "12",
  vatRate: "10",
  earlySettlementRate: "1.2"
};

const STORAGE = {
  recent: "reborn_recent",
  favorite: "reborn_favorite"
};

let allProducts = [];
let selectedProduct = null;

/* =========================
   유틸
========================= */

const $ = (id) => document.getElementById(id);

function num(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function won(v) {
  return `${Math.round(v).toLocaleString()}원`;
}

function pct(v) {
  return `${v.toFixed(2)}%`;
}

function getArr(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}

function setArr(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* =========================
   상품 정리
========================= */

function initProducts() {
  allProducts = [];

  productCategories.forEach(([cat, list]) => {
    list.forEach(([name, price]) => {
      allProducts.push({
        key: `${cat}_${name}`,
        category: cat,
        name,
        price
      });
    });
  });
}

/* =========================
   상품 렌더링
========================= */

function renderProducts(keyword = "") {
  const select = $("productSelect");
  if (!select) return;

  const k = keyword.toLowerCase();

  const list = allProducts.filter(p =>
    `${p.category}${p.name}`.toLowerCase().includes(k)
  );

  select.innerHTML = `<option value="">품목 선택</option>`;

  const grouped = {};

  list.forEach(p => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  Object.keys(grouped).forEach(cat => {
    const g = document.createElement("optgroup");
    g.label = cat;

    grouped[cat].forEach(p => {
      const o = document.createElement("option");
      o.value = p.key;
      o.textContent = `${p.name} / ${p.price}`;
      g.appendChild(o);
    });

    select.appendChild(g);
  });
}

/* =========================
   선택
========================= */

function selectProduct(p) {
  selectedProduct = p;
  $("unitCost").value = p.price;
  saveRecent(p);
  calculate();
  renderFavorites();
}

/* =========================
   최근
========================= */

function saveRecent(p) {
  let list = getArr(STORAGE.recent);
  list = list.filter(i => i.key !== p.key);
  list.unshift(p);
  list = list.slice(0, 6);
  setArr(STORAGE.recent, list);
  renderRecent();
}

function removeRecent(key) {
  let list = getArr(STORAGE.recent);
  list = list.filter(i => i.key !== key);
  setArr(STORAGE.recent, list);
  renderRecent();
}

function clearRecent() {
  localStorage.removeItem(STORAGE.recent);
  renderRecent();
}

function renderRecent() {
  const box = $("recentList");
  if (!box) return;

  const list = getArr(STORAGE.recent);
  box.innerHTML = "";

  if (!list.length) return;

  box.innerHTML += `
    <div class="recent-title-row">
      <div class="section-title">최근 선택</div>
      <button class="clear-recent-btn">전체 삭제</button>
    </div>
  `;

  box.querySelector(".clear-recent-btn").onclick = clearRecent;

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "recent-item";

    el.innerHTML = `
      <button class="quick-product-btn">${p.name}</button>
      <button class="remove-recent-btn">삭제</button>
    `;

    el.querySelector(".quick-product-btn").onclick = () => {
      selectProduct(p);
      $("productSelect").value = p.key;
    };

    el.querySelector(".remove-recent-btn").onclick = () => {
      removeRecent(p.key);
    };

    box.appendChild(el);
  });
}

/* =========================
   즐겨찾기
========================= */

function toggleFavorite(p) {
  let list = getArr(STORAGE.favorite);

  const exist = list.find(i => i.key === p.key);

  if (exist) {
    list = list.filter(i => i.key !== p.key);
  } else {
    list.unshift(p);
  }

  setArr(STORAGE.favorite, list);
  renderFavorites();
}

function renderFavorites() {
  const box = $("favoriteList");
  if (!box) return;

  const list = getArr(STORAGE.favorite);
  box.innerHTML = "";

  if (!list.length) return;

  box.innerHTML += `<div class="section-title">즐겨찾기</div>`;

  list.forEach(p => {
    const el = document.createElement("div");
    el.className = "favorite-item";

    el.innerHTML = `
      <button class="quick-product-btn">${p.name}</button>
      <button class="remove-favorite-btn">삭제</button>
    `;

    el.querySelector(".quick-product-btn").onclick = () => {
      selectProduct(p);
      $("productSelect").value = p.key;
    };

    el.querySelector(".remove-favorite-btn").onclick = () => {
      toggleFavorite(p);
    };

    box.appendChild(el);
  });
}

/* =========================
   계산
========================= */

function calculate() {
  const cost = num($("unitCost").value);
  const qty = num($("quantity").value);
  const sale = num($("salePrice").value);
  const ship = num($("shippingFee").value);

  const fee = num($("coupangFeeRate").value) / 100;
  const vat = num($("vatRate").value) / 100;
  const early = num($("earlySettlementRate").value) / 100;

  const productCost = cost * qty;
  const coupangFee = sale * fee;
  const vatFee = sale * vat;
  const earlyFee = sale * early;

  const total = productCost + ship + coupangFee + vatFee + earlyFee;
  const profit = sale - total;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  $("totalProductCost").textContent = won(productCost);
  $("coupangFee").textContent = won(coupangFee);
  $("earlySettlementFee").textContent = won(earlyFee);
  $("vat").textContent = won(vatFee);
  $("totalCost").textContent = won(total);
  $("profit").textContent = won(profit);
  $("marginRate").textContent = pct(margin);
}

/* =========================
   초기화
========================= */

function init() {
  initProducts();
  renderProducts();
  renderRecent();
  renderFavorites();

  Object.keys(defaultValues).forEach(k => {
    const el = $(k);
    if (el && (!el.value || el.value === "0")) {
      el.value = defaultValues[k];
    }
  });

  $("productSearch").oninput = e => {
    renderProducts(e.target.value);
  };

  $("productSelect").onchange = e => {
    const p = allProducts.find(x => x.key === e.target.value);
    if (p) selectProduct(p);
  };

  $("addFavoriteBtn").onclick = () => {
    const p = selectedProduct;
    if (p) toggleFavorite(p);
  };

  document.querySelectorAll("input").forEach(input => {
    input.oninput = calculate;
  });

  calculate();
}

document.addEventListener("DOMContentLoaded", init);
