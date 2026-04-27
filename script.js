document.addEventListener("DOMContentLoaded", function () {
  const ids = [
    "unitCost",
    "quantity",
    "salePrice",
    "shippingFee",
    "coupangFeeRate",
    "vatRate",
    "earlySettlementRate"
  ];

  const productCategories = [
    ["누룽지", [
      ["찹쌀 누룽지 스위트", 2200],
      ["찹쌀 누룽지 무가당", 2200],
      ["찹쌀 누룽지 츄러스", 2300],
    ]],

    ["메밀칩", [
      ["싱싱 양파 160g", 1650],
      ["싱싱 양파 100g", 1000],
      ["푸드킹 양파 160g", 1500],
    ]],

    ["브이콘", [
      ["브이콘 50g", 412.5],
      ["브이콘 100g", 825],
    ]],

    ["에낙", [
      ["에낙 치킨", 4916.6],
      ["에낙 스파이시", 4916.6],
    ]],

    ["꽈배기", [
      ["명가 참깨", 4200],
      ["명가 흑당", 4200],
    ]],

    ["네모스낵", [
      ["네모스낵 치킨맛", 172.2],
      ["네모스낵 불고기맛", 172.2],
      ["네모스낵 매콤한맛", 172.2],
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
      ["꾀돌이", 275],
    ]],

    ["생필품", [
      ["코디(휴지)", 8500],
    ]]
  ];

  const productSelect = document.getElementById("productSelect");

  if (productSelect) {
    productCategories.forEach(function ([categoryName, products]) {
      const group = document.createElement("optgroup");
      group.label = categoryName;

      products.forEach(function ([name, price]) {
        const option = document.createElement("option");
        option.value = String(price);
        option.textContent = `${name} / ${price.toLocaleString("ko-KR")}원`;
        group.appendChild(option);
      });

      productSelect.appendChild(group);
    });

    productSelect.addEventListener("change", function () {
      const unitCostInput = document.getElementById("unitCost");
      if (!unitCostInput || this.value === "") return;

      unitCostInput.value = this.value;
      unitCostInput.dispatchEvent(new Event("input", { bubbles: true }));
      unitCostInput.dispatchEvent(new Event("change", { bubbles: true }));

      calculate();
    });
  }

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("focus", function () {
      if (this.value === "0") {
        this.value = "";
      }
    });

    el.addEventListener("blur", function () {
      if (this.value.trim() === "") {
        this.value = "0";
      }
      calculate();
    });
  });

  const getNumber = (id) => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const raw = String(el.value).trim();
    if (raw === "") return 0;
    const value = Number(raw.replace(/,/g, ""));
    return Number.isFinite(value) ? value : 0;
  };

  const getRate = (id) => getNumber(id) / 100;

  const money = (value) => Math.round(value).toLocaleString("ko-KR") + "원";
  const pct = (value) => value.toFixed(2) + "%";

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function setProfitClass(elementId, profit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove("profit", "loss");
    el.classList.add(profit >= 0 ? "profit" : "loss");
  }

  function setTextClass(elementId, profit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.classList.remove("profit-text", "loss-text");
    el.classList.add(profit >= 0 ? "profit-text" : "loss-text");
  }

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
    const totalCost = totalProductCost + shippingFee + coupangFee + earlySettlementFee + vat;
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

    setProfitClass("profitCard", profit);
    setProfitClass("marginCard", profit);

    ["quickProfit", "quickMargin", "summaryProfit", "summaryMargin", "profit", "marginRate"].forEach(id => {
      setTextClass(id, profit);
    });
  }

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", calculate);
      el.addEventListener("change", calculate);
      el.addEventListener("keyup", calculate);
    }
  });

  calculate();
});

// 1초 내외의 부드러운 브랜드 로고 스플래시
window.addEventListener("load", function () {
  setTimeout(function () {
    const splash = document.getElementById("rebornSplash");
    if (splash) {
      splash.classList.add("hide");
      setTimeout(function () {
        if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
      }, 400);
    }
  }, 1000);
});

// 숫자 입력 후 Enter/완료/다음 키를 누르면 다음 입력란으로 자동 이동
document.addEventListener("DOMContentLoaded", function () {
  const fields = Array.from(document.querySelectorAll("input, select, textarea"))
    .filter(el => !el.disabled && el.type !== "hidden" && el.offsetParent !== null);

  fields.forEach(function (el, index) {
    el.setAttribute("enterkeyhint", index === fields.length - 1 ? "done" : "next");

    el.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const next = fields[index + 1];
        if (next) {
          next.focus();
          if (typeof next.select === "function" && next.tagName === "INPUT") next.select();
        } else {
          el.blur();
        }
      }
    });

    el.addEventListener("focus", function () {
      if ((el.type === "number" || el.inputMode === "decimal") && el.value === "0") {
        el.value = "";
      }
    });
  });
});

function applyRebornDefaultRates() {
  const defaults = {
    shippingFee: "2400",
    coupangFeeRate: "12",
    vatRate: "10",
    earlySettlementRate: "1.2"
  };

  Object.keys(defaults).forEach(function (id) {
    const el = document.getElementById(id);
    if (el) {
      el.value = defaults[id];
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  const defaults = {
    shippingFee: "2400",
    coupangFeeRate: "12",
    vatRate: "10",
    earlySettlementRate: "1.2"
  };

  Object.keys(defaults).forEach(function (id) {
    const el = document.getElementById(id);
    if (el && (String(el.value).trim() === "" || String(el.value).trim() === "0")) {
      el.value = defaults[id];
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
});
