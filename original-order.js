(function () {
  "use strict";
  const FORMAT = "original-order-01";
  const columns = { A: [0, ["수취인성함", "수취인명"]], C: [2, ["사이트", "사이트이름"]],
    D: [3, ["수취인휴대폰", "수취인전화번호"]], E: [4, ["수취인우편번호", "우편번호"]],
    F: [5, ["수취인주소", "주소"]], H: [7, ["주문선택사항"]], I: [8, ["결재금액", "결제금액"]],
    K: [10, ["낙찰번호"]], L: [11, ["운송장번호"]], U: [20, ["구매자핸드폰", "구매자휴대폰"]], X: [23, ["배송비", "추가배송비"]] };
  const text = value => String(value ?? "").trim();
  const header = value => text(value).replace(/\s+/g, "");
  const validId = value => typeof value === "string" && text(value) !== "" && !/^(?:0+|-|n\/?a|null|undefined)$/i.test(text(value));
  const finiteMoney = value => {
    if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
    const raw = text(value);
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) return null;
    const result = Number(raw.replaceAll(",", ""));
    return Number.isFinite(result) && result >= 0 && result <= Number.MAX_SAFE_INTEGER ? result : null;
  };
  const safeAdd = (left, right) => Number.isFinite(left + right) && Math.abs(left + right) <= Number.MAX_SAFE_INTEGER;
  const isCoupang = site => /^(?:쿠팡|coupang)(?:$|[\s(_\-/])/i.test(text(site));

  function inspect(rows) {
    const headerRow = rows.slice(0, 30).findIndex(row => header(row?.[7]) === "주문선택사항");
    if (headerRow < 0) throw new Error("원본 주문 양식의 H열 헤더를 찾지 못했습니다.");
    const conflicts = Object.entries(columns).filter(([, [index, names]]) => !names.includes(header(rows[headerRow]?.[index]))).map(([letter]) => letter);
    if (conflicts.length) throw new Error("원본 주문 양식의 열 연결 확인 필요: " + conflicts.join(", "));
    const orderRows = rows.slice(headerRow + 1).filter(row => text(row?.[7])).length;
    return {headerRow, orderRows, mapping: "F 주소 · H 상품/낱개 수량 · I 결제금액 · K 낙찰번호 · L 송장 · X 고객 배송비"};
  }

  function calculateMargins(values) {
    const {revenue, goods, delivery, fee, early, vat, boxes} = values;
    const known = [revenue, goods, delivery, fee, early].every(value => typeof value === "number" && Number.isFinite(value));
    const candidate = known ? revenue - goods - delivery - fee - early : null;
    const margin = candidate !== null && Number.isFinite(candidate) && Math.abs(candidate) <= Number.MAX_SAFE_INTEGER ? candidate : null;
    const subtract = (left, right) => typeof left === "number" && typeof right === "number" && safeAdd(left, -right) ? left - right : null;
    return {margin, afterVat: subtract(margin, vat),
      withBoxes: subtract(margin, boxes),
      afterVatWithBoxes: subtract(subtract(margin, vat), boxes),
      rate: margin !== null && revenue > 0 ? margin / revenue * 100 : null};
  }

  function analyze(rows, hooks) {
    const format = inspect(rows);
    const payments = new Map(), shipments = new Map(), deductions = new Map(), boxes = new Map(), products = new Map();
    const needs = [], excluded = [], financeIssues = [];
    const trackingRows = new Map();
    rows.slice(format.headerRow + 1).forEach(row => {if (text(row?.[7]) && validId(row?.[11])) {const key = text(row[11]); trackingRows.set(key, (trackingRows.get(key) || 0) + 1);}});
    const scope = {rows: 0, otherRows: 0, heldRows: 0, boxPendingRows: 0, goodsComplete: true, boxesComplete: true, goodsCost: 0, boxCost: 0};
    let orderRows = 0, amountRawSum = 0, extraRawSum = 0, amountsValid = true, paymentRowsInvalid = 0;
    const addIssue = (row, reason) => financeIssues.push({row, reason});
    for (let index = format.headerRow + 1; index < rows.length; index++) {
      const row = rows[index] || [], name = text(row[7]);
      if (!name) continue;
      const rowNumber = index + 1, coupang = isCoupang(row[2]);
      orderRows++;
      if (coupang) scope.rows++; else scope.otherRows++;
      const amount = finiteMoney(row[8]), extra = finiteMoney(row[23]);
      if (amount !== null && safeAdd(amountRawSum, amount)) amountRawSum += amount; else amountsValid = false;
      if (extra !== null && safeAdd(extraRawSum, extra)) extraRawSum += extra; else amountsValid = false;
      const identityColumns = [0, 2, 3, 4, 5, 10, 20];
      const paymentValid = identityColumns.every(column => validId(row[column])) && amount !== null && extra !== null;
      if (!paymentValid) { paymentRowsInvalid++; addIssue(rowNumber, "결제 식별정보 또는 I/X 금액 확인 필요"); }
      const paymentKey = paymentValid ? JSON.stringify([text(row[2]), text(row[10])]) : "invalid-row-" + rowNumber;
      const identity = JSON.stringify([0, 3, 4, 5, 20].map(column => text(row[column])));
      if (!payments.has(paymentKey)) payments.set(paymentKey, {amount, extra, identity, coupang, valid: paymentValid, rows: [rowNumber]});
      else {
        const payment = payments.get(paymentKey);
        payment.rows.push(rowNumber);
        if (payment.identity !== identity || payment.amount !== amount || payment.extra !== extra) {
          payment.valid = false;
          addIssue(rowNumber, "같은 사이트/낙찰번호의 수취정보·결제금액·배송비 불일치");
        }
      }
      if (!validId(row[11])) { if (coupang) addIssue(rowNumber, "빈 값 또는 비문자열 운송장: 배송 건수 확인 필요"); }
      else {
        const key = text(row[11]);
        const destination = JSON.stringify([0, 3, 4, 5].map(column => text(row[column])));
        if (!shipments.has(key)) shipments.set(key, {coupang, involvesCoupang: coupang, destination, conflict: false});
        else {
          const shipment = shipments.get(key);
          shipment.involvesCoupang = shipment.involvesCoupang || coupang;
          if (shipment.coupang !== coupang || shipment.destination !== destination) {
            shipment.conflict = true;
            if (shipment.involvesCoupang) addIssue(rowNumber, "동일 운송장의 수취정보/사이트 불일치: 배송 건수 확인 필요");
          }
        }
      }
      const result = hooks.goods(name);
      const rowItems = result.deductions || [];
      const safeItems = rowItems.length > 0 && Number.isSafeInteger(rowItems.reduce((sum, item) => sum + item.units, 0)) && rowItems.every(item => Number.isSafeInteger(item.units) && item.units > 0
        && Number.isSafeInteger((deductions.get(item.sku)?.units || 0) + item.units));
      const held = !safeItems;
      if (held) {
        const reasons = (result.needs || []).map(item => item.reason);
        needs.push({row: rowNumber, productName: "원본 주문 " + rowNumber + "행", qty: null,
          reason: reasons.join(" / ") || (result.excluded?.length ? "재고 계산 제외 품목" : "상품명·수량 또는 누적 안전 정수 범위 확인 필요")});
        if (coupang) {scope.heldRows++; scope.goodsComplete = false; scope.boxesComplete = false;}
        if (result.excluded?.length) excluded.push({row: rowNumber, productName: "원본 주문 " + rowNumber + "행", qty: 0, reason: "재고 계산 제외 품목"});
        continue;
      }
      for (const item of rowItems) {
        const aggregate = deductions.get(item.sku) || {sku: item.sku, units: 0, orderCount: 0};
        aggregate.units += item.units; aggregate.orderCount++; deductions.set(item.sku, aggregate);
        const unitCost = hooks.cost(item.sku);
        const product = products.get(item.sku) || {sku: item.sku, units: 0, marginUnits: 0, orderCount: 0, unitCost, subtotal: 0};
        product.units += item.units; product.orderCount++;
        if (coupang) product.marginUnits += item.units;
        if (unitCost === null || !safeAdd(product.subtotal || 0, item.units * unitCost)) product.subtotal = null;
        else if (product.subtotal !== null) product.subtotal += item.units * unitCost;
        products.set(item.sku, product);
        if (coupang) {
          if (unitCost === null || !safeAdd(scope.goodsCost, item.units * unitCost)) scope.goodsComplete = false;
          else scope.goodsCost += item.units * unitCost;
        }
      }
      if (result.needs?.length) {
        for (const issue of result.needs) needs.push({row: rowNumber, productName: rowItems.map(item => item.sku).join(" + "), qty: rowItems.reduce((sum, item) => sum + item.units, 0), reason: issue.reason});
        if (coupang) {scope.boxPendingRows++; scope.boxesComplete = false;}
      }
      const sharedBoxPending = (trackingRows.get(text(row[11])) || 0) > 1 && result.boxUsages?.length;
      if (sharedBoxPending) {
        needs.push({row: rowNumber, productName: rowItems.map(item => item.sku).join(" + "), qty: rowItems.reduce((sum, item) => sum + item.units, 0), reason: "동일 송장 다품목 포장박스 기준 확인 필요 (상품 재고는 차감 목록에 포함)"});
        if (coupang) {scope.boxesComplete = false; scope.boxPendingRows++;}
      }
      for (const item of sharedBoxPending ? [] : result.boxUsages || []) {
        const previous = boxes.get(item.sku) || 0;
        if (!Number.isSafeInteger(previous + item.units)) throw new Error("박스 누적 수량 안전 정수 범위 초과");
        boxes.set(item.sku, previous + item.units);
        if (coupang) {
          const unitCost = hooks.cost(item.sku);
          if (unitCost === null || !safeAdd(scope.boxCost, item.units * unitCost)) scope.boxesComplete = false;
          else scope.boxCost += item.units * unitCost;
        }
      }
    }
    const groups = [...payments.values()], validGroups = groups.filter(group => group.valid);
    const coupangGroups = groups.filter(group => group.coupang);
    const aggregateMoney = (items, field) => {
      let total = 0;
      for (const item of items) { if (item[field] === null || !safeAdd(total, item[field])) return null; total += item[field]; }
      return total;
    };
    const paymentComplete = groups.every(group => group.valid) && amountsValid;
    const coupangPaymentComplete = coupangGroups.every(group => group.valid);
    const paymentSum = aggregateMoney(validGroups, "amount"), extraSum = aggregateMoney(validGroups, "extra");
    const knownAmount = aggregateMoney(coupangGroups.filter(group => group.valid), "amount");
    const knownExtra = aggregateMoney(coupangGroups.filter(group => group.valid), "extra");
    const deliveryIncomplete = financeIssues.some(issue => /배송 건수/.test(issue.reason)) || [...shipments.values()].some(item => item.conflict && item.involvesCoupang);
    const shipmentCount = [...shipments.values()].filter(item => item.coupang).length;
    const revenue = coupangPaymentComplete && knownAmount !== null && knownExtra !== null && safeAdd(knownAmount, knownExtra) ? Math.round(knownAmount + knownExtra) : null;
    const values = {revenue, goods: scope.goodsComplete ? Math.round(scope.goodsCost) : null,
      delivery: deliveryIncomplete ? null : shipmentCount * 2170,
      fee: coupangPaymentComplete && knownAmount !== null ? Math.round(knownAmount * 0.12) : null,
      early: coupangPaymentComplete && knownAmount !== null ? Math.round(knownAmount * 0.012) : null,
      vat: revenue !== null ? Math.round(revenue / 11) : null, boxes: scope.boxesComplete ? Math.round(scope.boxCost) : null};
    if (scope.rows === 0) { for (const key of Object.keys(values)) values[key] = null; }
    const goodsList = [...deductions.values()];
    const allGoodsCost = [...products.values()].reduce((sum, item) => sum === null || item.subtotal === null || !safeAdd(sum, item.subtotal) ? null : sum + item.subtotal, 0);
    const allBoxCost = [...boxes.entries()].reduce((sum, [sku, units]) => {const cost = hooks.cost(sku); return sum === null || cost === null || !safeAdd(sum, units * cost) ? null : sum + units * cost;}, 0);
    return {formatId: FORMAT, at: new Date().toISOString(), orderRows,
      paymentGroupCount: validGroups.length, duplicatePaymentRowCount: validGroups.reduce((sum, group) => sum + group.rows.length - 1, 0),
      paymentUniqueSum: paymentSum, paymentUniqueWithExtraShipping: paymentSum !== null && extraSum !== null ? paymentSum + extraSum : null,
      extraShippingSum: extraSum, amountRawSum: amountsValid ? amountRawSum : null,
      assetDeductionValue: allGoodsCost, boxAssetDeductionValue: allBoxCost,
      deductions: goodsList, boxUsages: [...boxes.entries()].map(([sku, units]) => ({sku, units})), needs, excluded,
      finance: {scope, values, margins: calculateMargins(values), products: [...products.values()], issues: financeIssues,
        paymentComplete, paymentRowsInvalid, shipmentCount, coupangPaymentCount: coupangGroups.filter(group => group.valid).length,
        knownAmount, knownExtra, extraRawSum: amountsValid ? extraRawSum : null,
        knownBoxCost: scope.boxCost, knownGoodsCost: scope.goodsCost,
        policy: {delivery: 2170, fee: 12, early: 1.2, feeBase: "쿠팡 상품 결제금액 I, X 제외", vat: "부가세 포함 매출÷11, 매입세액 공제 미반영", rounding: "파일 합산 후 원 단위 반올림"}}};
  }
  window.RebornOriginalOrder = Object.freeze({formatId: FORMAT, inspect, analyze, calculateMargins, finiteMoney, isCoupang});
})();
