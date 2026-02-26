document.addEventListener('DOMContentLoaded', function () {

  // ==========================================================================
  // 1. 各項目の要素定義
  // ==========================================================================

  // --- 提出見積金額（最終合計） ---
  const finalEstimatedPrice = document.getElementById('finalEstimatedPrice');

  // --- 高所作業車セクション ---
  const highWorkCarCheck = document.getElementById('highWorkCar');
  const highWorkSection = document.getElementById('highWorkSection');
  const highWorkTable = document.querySelector('#highWorkSection table');
  const displayHighWorkTotal = document.getElementById('displayHighWorkTotal');

  // --- 値引き設定 ---
  const discountCheck = document.getElementById('discountCheck');
  const discountAmountInput = document.getElementById('discountAmount');
  const budgetDiscount = document.getElementById('budgetDiscount');

  // --- 労務費関連 ---
  const laborSubtotal = document.getElementById('laborSubtotal');
  const displayLaborTotal = document.getElementById('displayLaborTotal');

  // --- A材・B材チェック ---
  const aMaterialCheck = document.getElementById('aMaterialCheck');
  const aTotalAmountDiv = document.getElementById('a-totalAmount');
  const displayMaterialA = document.getElementById('displayMaterialA');
  const bMaterialCheck = document.getElementById('bMaterialCheck');
  const bTotalAmountDiv = document.getElementById('b-totalAmount');
  const displayMaterialB = document.getElementById('displayMaterialB');

  // --- モーダル内の入力要素 ---
  const itemNameSelect = document.querySelector('select[name="itemName"]');
  const contentSelect = document.getElementById('contentSelect');
  const basePriceInput = document.querySelector('input[name="basePrice"]');
  const finalUnitPriceInput = document.querySelector('.totalConfirmedPrice');
  const subtotalInput = document.getElementById('subtotalDisplay');

  // --- 数量・本数関連 ---
  const lightUseInput = document.querySelector('input[name="lightUse"]');
  const quantityInput = document.querySelector('input[name="quantity"]');
  const countInput = document.querySelector('input[name="count"]');

  // --- 施工内容の統計 ---
  const totalQuantityDisplay = document.getElementById('totalQuantityDisplay');

  // --- 割増設定の各チェックボックス ---
  const profitCheckIds = ['check_day', 'check_night', 'check_high', 'check_special', 'check_waste', 'check_adjust'];

  // 係数チェックボックス
  const keisuCheck = document.getElementById('coefficientCheck');

  // --- 工事種類 ---
  const koujiType1 = document.getElementById('koujiType1');
  const koujiType2 = document.getElementById('koujiType2');

  // --- 駐車場代復活ボタン ---
  const parkingCheck = document.getElementById('parkingCheck');

  // 編集中の行を保持するための変数（上書き編集に必須）
  let editingRow = null;

  // 割増設定を引き継ぐための保存用オブジェクト
  let lastProfitSettings = {
    check_day: false,
    check_night: false,
    check_high: false,
    check_special: false,
    check_waste: false,
    check_adjust: false
  };

  // 割増率のマスター定義
  const PROFIT_RATES = {
    'day': 0.5,   // 昼間 50%
    'night': 0.5,  // 夜間 50%
    'high': 0.1,   // 高所 10%
    'special': 0.1, // 特殊 10%
    'waste': 0.05,  // 産廃 5%
    'adjust': 0   // 微調整は自動計算なし
  };

  // --- メインテーブルと登録ボタン ---
  const constructionTableBody = document.querySelector('.construction-scroll tbody');
  const modalElement = document.getElementById('constructionModal');

  // ==========================================================================
  // 2. 高所作業車：計算・イベントロジック
  // ==========================================================================

  highWorkCarCheck?.addEventListener('change', function () {
    highWorkSection?.classList.toggle('d-none', !this.checked);
    updateAllDisplays();
  });

  highWorkTable?.addEventListener('input', function (e) {
    const row = e.target.closest('tr');
    if (!row || e.target.type !== 'number') return;

    const qty = parseFloat(row.cells[2].querySelector('input').value) || 0;
    const price = parseFloat(row.cells[4].querySelector('input').value) || 0;
    const transport = parseFloat(row.cells[5].querySelector('input').value) || 0;
    const totalUnitPrice = price + transport;

    row.cells[6].querySelector('input').value = totalUnitPrice;
    row.cells[7].querySelector('input').value = qty * totalUnitPrice;

    updateAllDisplays();
  });

  highWorkTable?.addEventListener('change', function (e) {
    if (e.target.classList.contains('row-check')) {
      updateAllDisplays();
    }
  });

  // ==========================================================================
  // 3. 値引き・A材・B材：イベントロジック
  // ==========================================================================

  discountCheck?.addEventListener('change', function () {
    discountAmountInput.disabled = !this.checked;
    if (!this.checked) discountAmountInput.value = "";
    updateAllDisplays();
  });
  discountAmountInput?.addEventListener('input', updateAllDisplays);
  aMaterialCheck?.addEventListener('change', updateAllDisplays);
  bMaterialCheck?.addEventListener('change', updateAllDisplays);
  laborSubtotal?.addEventListener('input', updateAllDisplays);

  // ==========================================================================
  // 4. 施工内容新規入力：自動入力ロジック
  // ==========================================================================

  function updateBasePrice() {
    if (!itemNameSelect || !contentSelect || !basePriceInput) return;
    const selectedItem = itemNameSelect.value;
    const selectedContent = contentSelect.value;
    let calculatedPrice = 0;
    if (selectedItem.includes("照明")) {
      calculatedPrice = (selectedContent === "交換工事") ? 3500 : 1500;
    }
    basePriceInput.value = calculatedPrice;
    calculateModalProfits(); // 単価が変わったら割増も再計算
  }

  function updateCount() {
    if (!countInput) return;
    const isElec = (koujiType1?.value === "電気工事" || koujiType2?.value === "電気工事");
    if (isElec) {
      const lightUse = parseFloat(lightUseInput?.value) || 0;
      const quantity = parseFloat(quantityInput?.value) || 0;
      countInput.value = (lightUse * quantity) || "";
    }
    updateModalSubtotal();
  }

  function calculateModalProfits() {
    const base = parseFloat(basePriceInput?.value) || 0;
    let total = base;

    profitCheckIds.forEach(id => {
      const checkBox = document.getElementById(id);
      const rateEl = document.getElementById(id.replace('check_', 'rate_'));
      const modalInput = document.querySelector(`.modal-body input[name="${id.replace('check_', 'profit_')}"]`);

      if (checkBox && modalInput) {
        if (rateEl && id !== 'check_adjust') {
          const rateVal = parseFloat(rateEl.value) || 0;
          modalInput.value = Math.round(base * rateVal);
        }

        const calcValue = parseFloat(modalInput.value) || 0;
        lastProfitSettings[id] = checkBox.checked;

        if (checkBox.checked) {
          total += calcValue;
          modalInput.style.opacity = "1";
        } else {
          modalInput.style.opacity = "0.5";
        }
      }
    });

    if (finalUnitPriceInput) finalUnitPriceInput.value = total;
    updateModalSubtotal();
  }

  function updateModalSubtotal() {
    const unitPrice = parseFloat(finalUnitPriceInput?.value) || 0;
    const quantity = parseFloat(quantityInput?.value) || 0;
    if (subtotalInput) {
      subtotalInput.value = Math.round(unitPrice * quantity);
    }
  }

  profitCheckIds.forEach(id => {
    document.getElementById(id)?.addEventListener('change', function () {
      if (this.checked && keisuCheck) keisuCheck.checked = true;
      calculateModalProfits();
    });
  });

  keisuCheck?.addEventListener('change', function () {
    if (!this.checked) {
      profitCheckIds.forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = false;
      });
      calculateModalProfits();
    }
  });

  document.querySelector('.btn-primary[data-bs-target="#constructionModal"]')?.addEventListener('click', function () {
    editingRow = null;
    profitCheckIds.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = lastProfitSettings[id];
    });
    if (keisuCheck) {
      keisuCheck.checked = Object.values(lastProfitSettings).some(val => val === true);
    }
    calculateModalProfits();
  });

  basePriceInput?.addEventListener('input', calculateModalProfits);
  quantityInput?.addEventListener('input', () => { updateCount(); updateModalSubtotal(); });
  document.querySelectorAll('[id^="rate_"]').forEach(el => el.addEventListener('input', calculateModalProfits));
  itemNameSelect?.addEventListener('change', updateBasePrice);
  contentSelect?.addEventListener('change', updateBasePrice);

  // ==========================================================================
  // ★ 登録完了ボタンの処理
  // ==========================================================================
  const registerBtn = document.getElementById('registerBtn');

  registerBtn?.addEventListener('click', function (e) {
    e.preventDefault();

    const item = itemNameSelect.value;
    const qty = quantityInput.value;
    const unit = document.getElementById('unitSelect')?.value || '';
    const content = contentSelect.value;
    const count = countInput.value;
    const basePrice = basePriceInput.value;
    const finalPrice = finalUnitPriceInput.value;
    const subtotal = subtotalInput.value;
    const lightUse = lightUseInput?.value || '';

    const isKeisuChecked = keisuCheck?.checked;

    if (!item || !qty) {
      alert("項目名と台数/本数は必須です");
      return;
    }

    const getProfitVal = (idName) => {
      const cb = document.getElementById(`check_${idName}`);
      const valInput = document.querySelector(`.modal-body input[name="profit_${idName}"]`);
      return (cb && cb.checked) ? (valInput?.value || '0') : '0';
    };

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
   <td>
    <div class="d-flex justify-content-center gap-1">
     <button type="button" class="btn btn-success btn-sm btn-edit">編集</button>
     <button type="button" class="btn btn-danger btn-sm btn-delete">削除</button>
    </div>
   </td>
   <td></td>
   <td>${item}</td>
   <td>${lightUse}</td>
   <td class="text-end">${qty}</td>
   <td>${unit}</td>
   <td>${content}</td>
   <td class="text-end">${count}</td>
   <td class="text-end base-price-cell">${basePrice}</td>
   <td class="text-end profit-cell">${getProfitVal('day')}</td>
   <td class="text-end profit-cell">${getProfitVal('night')}</td>
   <td class="text-end profit-cell">${getProfitVal('high')}</td>
   <td class="text-end profit-cell">${getProfitVal('special')}</td>
   <td class="text-end profit-cell">${getProfitVal('waste')}</td>
   <td class="text-end profit-cell">${getProfitVal('adjust')}</td>
   <td class="text-end fw-bold final-unit-price-cell">${finalPrice}</td>
   <td class="text-end fw-bold subtotal-cell">${subtotal}</td>
   <td class="text-center">
    <select class="form-select form-select-sm keisu-dropdown">
     <option value="on" ${isKeisuChecked ? 'selected' : ''}>〇</option>
     <option value="off" ${!isKeisuChecked ? 'selected' : ''}>✕</option>
    </select>
   </td>
  `;

    if (editingRow) {
      constructionTableBody.replaceChild(newRow, editingRow);
      editingRow = null;
    } else {
      if (constructionTableBody.innerHTML.includes('データ未入力')) {
        constructionTableBody.innerHTML = '';
      }

      // ★ 駐車場代の行を探す
      const parkingRow = constructionTableBody.querySelector('tr[data-item-name="駐車場代"]');

      if (parkingRow) {
        // 駐車場代があれば、その「前」に挿入する
        constructionTableBody.insertBefore(newRow, parkingRow);
      } else {
        // 駐車場代がなければ、そのまま末尾に追加
        constructionTableBody.appendChild(newRow);
      }
    }

    updateTableNumbers();
    updateLaborSubtotal();
    updateTotalQuantity();
    syncHeaderCheckboxes();

    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.hide();

    // --- 次回入力のためのリセット処理 ---
    itemNameSelect.value = "";     // 項目名
    contentSelect.value = "";      // 内容
    quantityInput.value = "";      // 数量
    if (countInput) countInput.value = "";     // 本数
    if (lightUseInput) lightUseInput.value = ""; // 灯数
    basePriceInput.value = "0";    // 基本単価
    if (finalUnitPriceInput) finalUnitPriceInput.value = "0"; // 確定単価
    if (subtotalInput) subtotalInput.value = "0";             // 小計

    const unitSelect = document.getElementById('unitSelect');
    if (unitSelect) unitSelect.value = "台"; // 単位
  });

  // ==========================================================================
  // ★ 駐車場代：復活・削除・直接編集ロジック
  // ==========================================================================

  // 駐車場代の行を生成する関数
  function createParkingRow() {
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-item-name', '駐車場代');
    newRow.className = 'table-custom-light';
    newRow.innerHTML = `
      <td>
        <div class="d-flex justify-content-center gap-1">
          <button type="button" class="btn btn-secondary btn-sm" disabled>直入力</button>
          <button type="button" class="btn btn-danger btn-sm btn-delete-parking">削除</button>
        </div>
      </td>
      <td></td>
      <td>駐車場代</td>
      <td></td>
      <td class="text-end">1</td>
      <td>式</td>
      <td></td>
      <td class="text-end"></td>
      <td class="text-end">
        <input type="number" class="form-control form-control-sm text-end parking-direct-input" value="4000" style="width: 80px; display: inline-block;">
      </td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end profit-cell">0</td>
      <td class="text-end fw-bold final-unit-price-cell">4000</td>
      <td class="text-end fw-bold subtotal-cell">4000</td>
      <td class="text-center">
        <select class="form-select form-select-sm keisu-dropdown" disabled>
          <option value="off" selected>✕</option>
        </select>
      </td>
    `;

    // 金額入力時の連動
    newRow.querySelector('.parking-direct-input').addEventListener('input', function () {
      const val = parseFloat(this.value) || 0;
      const row = this.closest('tr');
      row.querySelector('.final-unit-price-cell').textContent = val;
      row.querySelector('.subtotal-cell').textContent = val;
      updateLaborSubtotal();
    });

    // 駐車場専用の削除ボタン
    newRow.querySelector('.btn-delete-parking').addEventListener('click', function () {
      newRow.remove();
      if (parkingCheck) parkingCheck.checked = false;
      updateTableNumbers();
      updateLaborSubtotal();
      updateTotalQuantity();
    });

    return newRow;
  }

  // チェックボックス連動
  parkingCheck?.addEventListener('change', function () {
    const existingRow = constructionTableBody.querySelector('tr[data-item-name="駐車場代"]');

    if (this.checked) {
      if (!existingRow) {
        // 「データ未入力」の行があれば消す
        if (constructionTableBody.innerHTML.includes('データ未入力')) {
          constructionTableBody.innerHTML = '';
        }

        // ★ 常に末尾（一番下）に追加する
        constructionTableBody.appendChild(createParkingRow());
      }
    } else {
      existingRow?.remove();
    }

    // 番号・合計・数量を更新
    updateTableNumbers();
    updateLaborSubtotal();
    updateTotalQuantity();
  });

  function updateTableNumbers() {
    Array.from(constructionTableBody.rows).forEach((r, idx) => {
      if (r.cells.length > 1 && !r.innerHTML.includes('データ未入力')) {
        r.cells[1].textContent = idx + 1;
      }
    });
  }

  function syncHeaderCheckboxes() {
    const firstRow = constructionTableBody.querySelector('tr:not(:has(td[colspan]))');
    if (!firstRow) return;
    const headerChecks = document.querySelectorAll('thead .coeffCheck');
    headerChecks.forEach((headerCb, idx) => {
      const cellValue = firstRow.cells[9 + idx]?.textContent || '0';
      if (headerCb) {
        headerCb.checked = (cellValue !== '0');
      }
    });
  }

  // ==========================================================================
  // ★ テーブル内のボタン操作（編集・削除）
  // ==========================================================================
  constructionTableBody?.addEventListener('click', function (e) {
    const target = e.target;
    const row = target.closest('tr');
    if (!row) return;

    // 通常の削除処理
    if (target.classList.contains('btn-delete')) {
      if (confirm('この行を削除してもよろしいですか？')) {
        row.remove();
        updateTableNumbers();
        updateLaborSubtotal();
        updateTotalQuantity();
        syncHeaderCheckboxes();
      }
    }

    if (target.classList.contains('btn-edit')) {
      editingRow = row;
      itemNameSelect.value = row.cells[2].textContent;
      if (lightUseInput) lightUseInput.value = row.cells[3].textContent;
      quantityInput.value = row.cells[4].textContent;
      const unitVal = row.cells[5].textContent;
      const unitSelect = document.getElementById('unitSelect');
      if (unitSelect) unitSelect.value = unitVal;
      contentSelect.value = row.cells[6].textContent;
      if (countInput) countInput.value = row.cells[7].textContent;
      basePriceInput.value = row.cells[8].textContent;

      ['day', 'night', 'high', 'special', 'waste', 'adjust'].forEach((type, idx) => {
        const val = row.cells[9 + idx].textContent;
        const cb = document.getElementById(`check_${type}`);
        const valInput = document.querySelector(`.modal-body input[name="profit_${type}"]`);
        if (cb) cb.checked = (val !== '0');
        if (valInput) valInput.value = val;
      });

      const currentKeisu = row.querySelector('.keisu-dropdown')?.value;
      if (keisuCheck) keisuCheck.checked = (currentKeisu === 'on');

      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
      calculateModalProfits();
    }
  });

  // ==========================================================================
  // ★ プルダウン変更時のリアルタイム連動
  // ==========================================================================
  constructionTableBody?.addEventListener('change', function (e) {
    if (e.target.classList.contains('keisu-dropdown')) {
      const row = e.target.closest('tr');
      const isKeisu = e.target.value === 'on';

      for (let i = 9; i <= 14; i++) {
        row.cells[i].style.opacity = isKeisu ? "1" : "0.3";
      }

      recalculateRowTotal(row);
      updateLaborSubtotal();
    }
  });

  // ==========================================================================
  // ★ ヘッダーチェック操作による全行一括計算
  // ==========================================================================
  document.querySelectorAll('thead .coeffCheck').forEach((headerCb) => {
    headerCb.addEventListener('change', function () {
      const type = this.getAttribute('data-type');
      const isChecked = this.checked;
      const typeMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13, 'adjust': 14 };
      const colIndex = typeMap[type];

      Array.from(constructionTableBody.rows).forEach((row) => {
        if (row.cells.length < 17 || row.innerHTML.includes('データ未入力')) return;

        // 駐車場代は属性を使ってスキップ
        if (row.getAttribute('data-item-name') === '駐車場代') return;

        const keisuStatus = row.querySelector('.keisu-dropdown')?.value;
        if (keisuStatus !== 'on') return;

        const basePrice = parseFloat(row.cells[8].textContent) || 0;
        const cell = row.cells[colIndex];

        if (isChecked) {
          if (type !== 'adjust') {
            const rate = PROFIT_RATES[type] || 0;
            cell.textContent = Math.round(basePrice * rate);
          }
        } else {
          cell.textContent = '0';
        }
        recalculateRowTotal(row);
      });
      updateLaborSubtotal();
    });
  });

  // 行の合計を再計算する共通関数
  function recalculateRowTotal(row) {
    const basePrice = parseFloat(row.cells[8].textContent) || 0;
    const qty = parseFloat(row.cells[4].textContent) || 0;

    const isKeisuOn = row.querySelector('.keisu-dropdown')?.value === 'on';

    let profitTotal = 0;
    for (let i = 9; i <= 14; i++) {
      if (isKeisuOn) {
        profitTotal += parseFloat(row.cells[i].textContent) || 0;
      }
    }

    const newFinalUnitPrice = basePrice + profitTotal;
    row.cells[15].textContent = newFinalUnitPrice; // 確定単価
    row.cells[16].textContent = newFinalUnitPrice * qty; // 小計
  }

  // ==========================================================================
  // 5. 反映処理ロジック
  // ==========================================================================

  function updateAllDisplays() {
    const rawLabor = parseCurrency(laborSubtotal?.value || "0");
    if (displayLaborTotal) displayLaborTotal.value = `￥${rawLabor.toLocaleString()}`;

    const highWorkTotal = calculateHighWorkTotal();
    if (displayHighWorkTotal) displayHighWorkTotal.value = `￥${highWorkTotal.toLocaleString()}`;

    const discountVal = calculateDiscountValue();
    if (budgetDiscount) {
      budgetDiscount.value = `￥${discountVal.toLocaleString()}`;
      if (discountVal < 0) {
        budgetDiscount.classList.add('text-danger', 'fw-bold');
      } else {
        budgetDiscount.classList.remove('text-danger', 'fw-bold');
      }
    }

    const aTotalVal = (aMaterialCheck?.checked && aTotalAmountDiv) ? parseCurrency(aTotalAmountDiv.textContent) : 0;
    if (displayMaterialA) displayMaterialA.value = `￥${aTotalVal.toLocaleString()}`;

    const bTotalVal = (bMaterialCheck?.checked && bTotalAmountDiv) ? parseCurrency(bTotalAmountDiv.textContent) : 0;
    if (displayMaterialB) displayMaterialB.value = `￥${bTotalVal.toLocaleString()}`;

    const finalSum = highWorkTotal + discountVal + rawLabor + aTotalVal + bTotalVal;
    if (finalEstimatedPrice) finalEstimatedPrice.value = `￥${finalSum.toLocaleString()}`;
  }

  function parseCurrency(text) {
    return parseFloat(String(text).replace(/[￥,¥,]/g, '')) || 0;
  }

  function calculateHighWorkTotal() {
    if (!highWorkCarCheck?.checked) return 0;
    let total = 0;
    highWorkTable?.querySelectorAll('tbody tr').forEach(row => {
      if (row.cells[0].querySelector('.row-check')?.checked) {
        total += parseCurrency(row.cells[7].querySelector('input').value);
      }
    });
    return total;
  }

  function calculateDiscountValue() {
    return (discountCheck?.checked && discountAmountInput?.value) ? parseFloat(discountAmountInput.value) * -1 : 0;
  }

  function updateLaborSubtotal() {
    let total = 0;
    document.querySelectorAll('.subtotal-cell').forEach(cell => {
      total += parseCurrency(cell.textContent);
    });
    if (laborSubtotal) {
      laborSubtotal.value = total;
      updateAllDisplays();
    }
  }

  function updateTotalQuantity() {
    let totalQty = 0;
    constructionTableBody?.querySelectorAll('tr').forEach(row => {
      if (row.cells.length < 5 || row.innerHTML.includes('データ未入力')) return;
      totalQty += parseFloat(row.cells[4].textContent) || 0;
    });
    if (totalQuantityDisplay) totalQuantityDisplay.value = totalQty;
  }

  // --- 初期実行：順序を整理 ---
  if (parkingCheck) {
    parkingCheck.checked = true;
    if (constructionTableBody.innerHTML.includes('データ未入力')) {
      constructionTableBody.innerHTML = '';
    }
    // 駐車場行を追加
    constructionTableBody.appendChild(createParkingRow());
  }

  // ★重要：行を追加した「後」に計算を走らせる
  updateTableNumbers();    // 番号を振る
  updateLaborSubtotal();   // ここで4000円が小計・合計に算入されます
  updateTotalQuantity();   // 数量を更新
  updateAllDisplays();     // 画面上の￥表示をすべて更新
  syncHeaderCheckboxes();  // ヘッダーのチェック状態を同期

  // ツールチップ初期化
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (el) { return new bootstrap.Tooltip(el) });
});