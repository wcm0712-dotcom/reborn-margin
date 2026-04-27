/* =========================
   RE:BORN Margin Calculator
   BOX FINAL COMPLETE
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

const STORAGE = {
  savedInputs: "reborn_saved_inputs"
};

const $ = (id) => document.getElementById(id);

/* =========================
   유틸
========================= */

function num(v) {
  return Number(v) || 0;
}

function won(v) {
  return `${Math.round(v).toLocaleString()}원`;
}

function pct(v) {
  return `${v.toFixed(2)}%`;
}

/* =========================
   박스 선택
========================= */

function applyBoxSize(size, shouldCalculate = true) {
  const boxFee = $("boxFee");
  const boxSize = $("boxSize");
  const boxUI = $("boxSizeOptions");

  const price = boxPrices[size] || 0;

  boxFee.value = price;
  boxSize.value = size;

  // 버튼 숨김
  if (boxUI) boxUI.style.display = "none";

  if (shouldCalculate) calculate();
}

function showBoxUI() {
  const boxUI = $("boxSizeOptions");
  if (boxUI) boxUI.style.display = "grid";
}

function setupBoxButtons() {
  document.querySelectorAll(".box-size-btn").forEach(btn => {
    btn.onclick = () => {
      applyBoxSize(btn.dataset.size);
    };
  });

  const boxFee = $("boxFee");

  if (boxFee) {
    boxFee.onclick = showBoxUI;
    boxFee.onfocus = showBoxUI;
  }
}

/* =========================
   저장 기능
========================= */

function getSaved() {
  return JSON.parse(localStorage.getItem(STORAGE.savedInputs) || "{}");
}

function saveValue(key, value) {
  const data = getSaved();
  data[key] = value;
  localStorage.setItem(STORAGE.savedInputs, JSON.stringify(data));
}

function restoreSaved() {
  const data = getSaved();

  Object.keys(data).forEach(key => {
    const el = $(key);

    if (key === "boxSize") {
      applyBoxSize(data[key], false);
      return;
    }

    if (el) el.value = data[key];
  });
}

function setupSaveButtons() {
  document.querySelectorAll(".field-save-btn").forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.save;

      if (key === "boxSize") {
        saveValue("boxSize", $("boxSize").value);
        return;
      }

      saveValue(key, $(key).value);

      btn.innerText = "저장됨";
      setTimeout(() => btn.innerText = "저장", 800);
    };
  });
}

/* =========================
   계산
========================= */

function calculate() {
  const cost = num($("unitCost").value);
  const qty = num($("quantity").value);
  const sale = num($("salePrice").value);
  const box = num($("boxFee").value);
  const ship = num($("shippingFee").value);

  const fee = num($("coupangFeeRate").value) / 100;
  const vat = num($("vatRate").value) / 100;
  const early = num($("earlySettlementRate").value) / 100;

  const productCost = cost * qty;
  const coupangFee = sale * fee;
  const vatFee = sale * vat;
  const earlyFee = sale * early;

  const total = productCost + box + ship + coupangFee + vatFee + earlyFee;
  const profit = sale - total;
  const margin = sale > 0 ? (profit / sale) * 100 : 0;

  $("totalProductCost").innerText = won(productCost);
  $("boxFeeResult").innerText = won(box);
  $("coupangFee").innerText = won(coupangFee);
  $("earlySettlementFee").innerText = won(earlyFee);
  $("vat").innerText = won(vatFee);
  $("totalCost").innerText = won(total);
  $("profit").innerText = won(profit);
  $("marginRate").innerText = pct(margin);
}

/* =========================
   입력 UX
========================= */

function setupInputs() {
  document.querySelectorAll("input").forEach(input => {
    input.oninput = calculate;

    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        const inputs = Array.from(document.querySelectorAll("input"));
        const idx = inputs.indexOf(input);
        if (inputs[idx + 1]) inputs[idx + 1].focus();
      }
    };
  });
}

/* =========================
   초기화
========================= */

function init() {
  restoreSaved();
  setupBoxButtons();
  setupSaveButtons();
  setupInputs();
  calculate();
}

document.addEventListener("DOMContentLoaded", init);
