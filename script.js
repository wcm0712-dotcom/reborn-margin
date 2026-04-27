/* =========================
   RE:BORN Margin Calculator
   script.js 전체 교체본
========================= */

/* 
  상품 데이터 구조

  아래 productCategories에 상품을 계속 추가하면 됨.

  형식:
  const productCategories = [
    ["카테고리명", [
      ["상품명", 원가],
      ["상품명", 원가]
    ]]
  ];
*/

const productCategories = [
  ["과자", [
    ["브이콘 50g", 0],
    ["브이콘 100g", 0],
    ["싱싱 양파 100g", 0],
    ["싱싱 양파 160g", 0],
    ["감자알칩 일반", 0],
    ["보리건빵", 0],
    ["찹쌀 누룽지", 0]
  ]],

  ["기타", [
    ["테스트 상품", 0]
  ]]
];

/* =========================
   DOM 가져오기
========================= */

const $ = (id) => document.getElementById(id);

const rebornSplash = $("rebornSplash");

const productSearch = $("productSearch");
const productSelect = $("productSelect");
const addFavoriteBtn = $("addFavoriteBtn");
const clearProductSearchBtn = $("clearProductSearchBtn");
const favoriteList = $("favoriteList");
const recentList = $("recentList");

const unitCostInput = $("unitCost");
const quantityInput = $("quantity");
const salePriceInput = $("salePrice");
const shippingFeeInput = $("shippingFee");
const coupangFeeRateInput = $("coupangFeeRate");
const vatRateInput = $("vatRate");
const earlySettlementRateInput = $("earlySettlementRate");

const totalProductCostEl = $("totalProductCost");
const coupangFeeEl = $("coupangFee");
const earlySettlementFeeEl = $("earlySettlementFee");
const vatEl = $("vat");
const totalCostEl = $("totalCost");
const profitEl = $("profit");
const marginRateEl = $("marginRate");

const profitCard = $("profitCard");
const marginCard = $("marginCard");

/* =========================
   기본 변수
========================= */

let allProducts = [];
let selectedProduct = null;

const STORAGE_KEYS = {
  recent: "reborn_recent_products",
  favorite: "reborn_favorite_products"
};

/* =========================
   공통 함수
========================= */

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatWon(value) {
  const number = Math.round(toNumber(value));
  return `${number.toLocaleString("ko-KR")}원`;
}

function formatPercent(value) {
  const number = toNumber(value);
  return `${number.toFixed(2)}%`;
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

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function makeProductKey(product) {
  return `${product.category}__${product.name}`;
}

/* =========================
   스플래시
========================= */

function hideSplash() {
  if (!rebornSplash) return;

  setTimeout(() => {
    rebornSplash.classList.add("hide");
  }, 1000);
}

/* =========================
   상품 데이터 정리
========================= */

function flattenProducts() {
  allProducts = [];

  productCategories.forEach((categoryGroup) => {
    const categoryName = categoryGroup[0];
    const products = categoryGroup[1];

    products.forEach((product) => {
      allProducts.push({
        category: categoryName,
        name: product[0],
        price: toNumber(product[1]),
        key: `${categoryName}__${product[0]}`
      });
    });
  });
}

/* =========================
   상품 드롭다운 렌더링
========================= */

function renderProductOptions(keyword = "") {
  if (!productSelect) return;

  const normalizedKeyword = normalizeText(keyword);

  const filteredProducts = allProducts.filter((product) => {
    const searchableText = normalizeText(`${product.category}${product.name}`);
    return searchableText.includes(normalizedKeyword);
  });

  const fragment = document.createDocumentFragment();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = filteredProducts.length > 0
    ? "품목 선택"
    : "검색 결과 없음";
  fragment.appendChild(defaultOption);

  const grouped = {};

  filteredProducts.forEach((product) => {
    if (!grouped[product.category]) {
      grouped[product.category] = [];
    }

    grouped[product.category].push(product);
  });

  Object.keys(grouped).forEach((categoryName) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = categoryName;

    grouped[categoryName].forEach((product) => {
      const option = document.createElement("option");

      option.value = product.key;
      option.textContent = `${product.name} / ${product.price.toLocaleString("ko-KR")}원`;
      option.dataset.name = product.name;
      option.dataset.price = product.price;
      option.dataset.category = product.category;

      optgroup.appendChild(option);
    });

    fragment.appendChild(optgroup);
  });

  productSelect.innerHTML = "";
  productSelect.appendChild(fragment);
}

/* =========================
   상품 선택
========================= */

function applyProduct(product) {
  if (!product) return;

  selectedProduct = product;

  if (unitCostInput) {
    unitCostInput.value = product.price;
  }

  saveRecentProduct(product);
  updateFavoriteButtonState();
  calculate();
}

function getSelectedProductFromSelect() {
  if (!productSelect || !productSelect.value) return null;

  return allProducts.find((product) => product.key === productSelect.value) || null;
}

/* =========================
   최근 선택
========================= */

function saveRecentProduct(product) {
  if (!product) return;

  let recent = getStorageArray(STORAGE_KEYS.recent);

  recent = recent.filter((item) => item.key !== product.key);

  recent.unshift({
    key: product.key,
    category: product.category,
    name: product.name,
    price: product.price
  });

  recent = recent.slice(0, 6);

  setStorageArray(STORAGE_KEYS.recent, recent);
  renderRecentProducts();
}

function renderRecentProducts() {
  if (!recentList) return;

  const recent = getStorageArray(STORAGE_KEYS.recent);

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
    button.textContent = `${item.name} · ${item.price.toLocaleString("ko-KR")}원`;

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

  const favorites = getStorageArray(STORAGE_KEYS.favorite);
  return favorites.some((item) => item.key === product.key);
}

function toggleFavoriteProduct(product) {
  if (!product) return;

  let favorites = getStorageArray(STORAGE_KEYS.favorite);

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

  setStorageArray(STORAGE_KEYS.favorite, favorites);

  renderFavoriteProducts();
  updateFavoriteButtonState();
}

function renderFavoriteProducts() {
  if (!favoriteList) return;

  const favorites = getStorageArray(STORAGE_KEYS.favorite);

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
    button.textContent = `${item.name} · ${item.price.toLocaleString("ko-KR")}원`;

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

function syncSelectWithProduct(product) {
  if (!productSelect || !product) return;

  const optionExists = Array.from(productSelect.options).some((option) => {
    return option.value === product.key;
  });

  if (optionExists) {
    productSelect.value = product.key;
  }
}

/* =========================
   계산 로직
========================= */

function calculate() {
  const unitCost = toNumber(unitCostInput?.value);
  const quantity = toNumber(quantityInput?.value);
  const salePrice = toNumber(salePriceInput?.value);
  const shippingFee = toNumber(shippingFeeInput?.value);
  const coupangFeeRate = toNumber(coupangFeeRateInput?.value);
  const vatRate = toNumber(vatRateInput?.value);
  const earlySettlementRate = toNumber(earlySettlementRateInput?.value);

  const totalProductCost = unitCost * quantity;
  const coupangFee = salePrice * (coupangFeeRate / 100);
  const vat = salePrice * (vatRate / 100);
  const earlySettlementFee = salePrice * (earlySettlementRate / 100);

  const totalCost =
    totalProductCost +
    shippingFee +
    coupangFee +
    vat +
    earlySettlementFee;

  const profit = salePrice - totalCost;
  const marginRate = salePrice > 0 ? (profit / salePrice) * 100 : 0;

  if (totalProductCostEl) totalProductCostEl.textContent = formatWon(totalProductCost);
  if (coupangFeeEl) coupangFeeEl.textContent = formatWon(coupangFee);
  if (earlySettlementFeeEl) earlySettlementFeeEl.textContent = formatWon(earlySettlementFee);
  if (vatEl) vatEl.textContent = formatWon(vat);
  if (totalCostEl) totalCostEl.textContent = formatWon(totalCost);
  if (profitEl) profitEl.textContent = formatWon(profit);
  if (marginRateEl) marginRateEl.textContent = formatPercent(marginRate);

  updateResultState(profit);
}

function updateResultState(profit) {
  const cards = [profitCard, marginCard];

  cards.forEach((card) => {
    if (!card) return;

    card.classList.remove("profit", "loss");

    if (profit > 0) {
      card.classList.add("profit");
    } else if (profit < 0) {
      card.classList.add("loss");
    }
  });

  if (profitEl) {
    profitEl.classList.remove("profit-text", "loss-text");

    if (profit > 0) {
      profitEl.classList.add("profit-text");
    } else if (profit < 0) {
      profitEl.classList.add("loss-text");
    }
  }

  if (marginRateEl) {
    marginRateEl.classList.remove("profit-text", "loss-text");

    if (profit > 0) {
      marginRateEl.classList.add("profit-text");
    } else if (profit < 0) {
      marginRateEl.classList.add("loss-text");
    }
  }
}

/* =========================
   입력 편의 기능
========================= */

function setupAutoCalculate() {
  const inputs = [
    unitCostInput,
    quantityInput,
    salePriceInput,
    shippingFeeInput,
    coupangFeeRateInput,
    vatRateInput,
    earlySettlementRateInput
  ];

  inputs.forEach((input) => {
    if (!input) return;

    input.addEventListener("input", () => {
      removeLeadingZero(input);
      calculate();
    });

    input.addEventListener("focus", () => {
      if (input.value === "0") {
        input.value = "";
      }
    });

    input.addEventListener("blur", () => {
      if (input.value.trim() === "") {
        input.value = "0";
      }

      calculate();
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        focusNextInput(input, inputs);
      }
    });
  });
}

function removeLeadingZero(input) {
  if (!input) return;

  const value = input.value;

  if (value.length > 1 && value.startsWith("0") && !value.startsWith("0.")) {
    input.value = value.replace(/^0+/, "");
  }
}

function focusNextInput(currentInput, inputList) {
  const currentIndex = inputList.indexOf(currentInput);
  const nextInput = inputList[currentIndex + 1];

  if (nextInput) {
    nextInput.focus();
    nextInput.select();
  } else {
    currentInput.blur();
  }
}

/* =========================
   이벤트 연결
========================= */

function setupProductEvents() {
  if (productSearch) {
    productSearch.addEventListener("input", () => {
      const keyword = productSearch.value;
      renderProductOptions(keyword);
      selectedProduct = null;
      updateFavoriteButtonState();
    });

    productSearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();

        if (productSelect) {
          productSelect.focus();
        }
      }
    });
  }

  if (clearProductSearchBtn) {
    clearProductSearchBtn.addEventListener("click", () => {
      if (productSearch) {
        productSearch.value = "";
      }

      renderProductOptions();

      if (productSelect) {
        productSelect.value = "";
      }

      selectedProduct = null;
      updateFavoriteButtonState();

      if (productSearch) {
        productSearch.focus();
      }
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
        if (productSelect) {
          productSelect.focus();
        }
        return;
      }

      toggleFavoriteProduct(product);
    });
  }
}

/* =========================
   초기 실행
========================= */

function init() {
  hideSplash();

  flattenProducts();
  renderProductOptions();
  renderFavoriteProducts();
  renderRecentProducts();

  setupProductEvents();
  setupAutoCalculate();

  calculate();
  updateFavoriteButtonState();
}

document.addEventListener("DOMContentLoaded", init);
