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
  const itemNameSelect = document.querySelector('[name="itemName"]');
  const contentSelect = document.getElementById('contentSelect') || document.querySelector('[name="content"]');
  const basePriceInput = document.querySelector('input[name="basePrice"]');
  const finalUnitPriceInput = document.querySelector('.totalConfirmedPrice') || document.getElementById('finalUnitPrice');
  const subtotalInput = document.getElementById('subtotalDisplay');

  // --- 数量・本数関連 ---
  const lightUseInput = document.querySelector('input[name="lightUse"]');
  const quantityInput = document.querySelector('input[name="quantity"]');
  const countInput = document.getElementById('count') || document.querySelector('input[name="count"]');

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

  // 編集中の行を保持するための変数
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

  // --- 割増率のマスター定義 ---
  function getCurrentRates() {
    return {
      'day': parseFloat(document.getElementById('rate_day')?.value) || 0,
      'night': parseFloat(document.getElementById('rate_night')?.value) || 0,
      'high': parseFloat(document.getElementById('rate_high')?.value) || 0,
      'special': parseFloat(document.getElementById('rate_special')?.value) || 0,
      'waste': parseFloat(document.getElementById('rate_waste')?.value) || 0
    };
  }

  // --- メインテーブルと登録ボタン ---
  const constructionTableBody = document.querySelector('.construction-scroll tbody');
  const modalElement = document.getElementById('constructionModal');
  const registerBtn = document.getElementById('registerBtn');

  // 「施工内容の入力へ進む」ボタンをクリックした時の処理
  const btnToForm2 = document.getElementById('btnToForm2');
  const form2TabEl = document.getElementById('form2-tab'); // タブのボタン側のID

  // 現調費を手動で修正したかを記録する変数
  let isSurveyFeeManual = false;

  // ==========================================================================
  // ★ 「施工内容の入力へ進む」ボタンをクリックした時の処理
  // ==========================================================================
  btnToForm2?.addEventListener('click', function () {
    if (form2TabEl) {
      const tab = new bootstrap.Tab(form2TabEl);
      tab.show();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // ==========================================================================
  // ★ モーダルが閉じられた時のリセット処理
  // ==========================================================================
  modalElement?.addEventListener('hidden.bs.modal', function () {
    // モーダルが閉じられたら、編集モードを解除し入力をクリアする
    editingRow = null;
    clearModalInputsExceptProfits();

    // 割増チェックを「前回の保存状態」に差し戻す
    profitCheckIds.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) cb.checked = lastProfitSettings[id];
    });

    // 係数スイッチの同期
    if (keisuCheck) {
      const hasOtherProfits = ['check_day', 'check_night', 'check_high', 'check_special', 'check_waste']
        .some(id => lastProfitSettings[id] === true);
      keisuCheck.checked = hasOtherProfits;
    }

    calculateModalProfits();
  });

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
  aMaterialCheck?.addEventListener('change', updateAllDisplays);
  bMaterialCheck?.addEventListener('change', updateAllDisplays);
  laborSubtotal?.addEventListener('input', updateAllDisplays);

  // ==========================================================================
  // 4. 施工内容：自動計算ロジック
  // ==========================================================================
  // --- 項目名・内容から基本単価を自動セット ---
  function updateBasePrice() {
    if (!itemNameSelect || !contentSelect || !basePriceInput) return;
    const selectedItem = itemNameSelect.value;
    const selectedContent = contentSelect.value;
    let calculatedPrice = 0;
    if (selectedItem.includes("照明")) {
      calculatedPrice = (selectedContent === "交換工事") ? 3500 : 1500;
    }
    basePriceInput.value = calculatedPrice;
    calculateModalProfits();
  }

  // --- 電気工事の場合の本数（count）自動計算 ---
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

  // ==========================================================================
  // ★ 割増率をリアルタイムに取得するヘルパー
  // ==========================================================================
  function getCurrentRates() {
    return {
      'day': parseFloat(document.getElementById('rate_day')?.value) || 0,
      'night': parseFloat(document.getElementById('rate_night')?.value) || 0,
      'high': parseFloat(document.getElementById('rate_high')?.value) || 0,
      'special': parseFloat(document.getElementById('rate_special')?.value) || 0,
      'waste': parseFloat(document.getElementById('rate_waste')?.value) || 0
    };
  }

  // --- モーダル内の割増・最終単価計算 ---
  function calculateModalProfits() {
    const base = parseFloat(basePriceInput?.value) || 0;
    const currentRates = getCurrentRates(); // ★最新の割増率を取得
    let total = base;

    let hasAnyCheckedProfit = false;

    profitCheckIds.forEach(id => {
      const checkBox = document.getElementById(id);
      const modalInput = document.querySelector(`.modal-body input[name="${id.replace('check_', 'profit_')}"]`);

      if (checkBox && modalInput) {
        // 1. 微調整（check_adjust）の入力可否だけ制御し、ここでは計算(total加算)しない
        if (id === 'check_adjust') {
          modalInput.disabled = !checkBox.checked;
        } else {
          // --- 通常の割増項目（昼間・夜間など）の計算 ---
          const type = id.replace('check_', '');
          const rateVal = currentRates[type] || 0; // ★最新の率を使って金額を算出
          modalInput.value = Math.round(base * rateVal);
        }

        const calcValue = parseFloat(modalInput.value) || 0;

        if (checkBox.checked) {
          if (id !== 'check_adjust') {
            total += calcValue; // 通常の割増は「確定単価」に加算
            hasAnyCheckedProfit = true;
          }
          modalInput.style.opacity = "1";
          modalInput.style.backgroundColor = "#ffffff";
        } else {
          modalInput.style.opacity = "0.5";
          modalInput.style.backgroundColor = "#f8f9fa";
        }
      }
    });

    // 係数スイッチの自動更新から「微調整」を除外して判定
    if (keisuCheck) {
      keisuCheck.checked = hasAnyCheckedProfit;
    }

    // 確定単価（合計）の更新（ここには微調整は含まれません）
    if (finalUnitPriceInput) {
      const resultTotal = Math.round(total);
      if (finalUnitPriceInput.tagName === 'INPUT') finalUnitPriceInput.value = resultTotal;
      else finalUnitPriceInput.textContent = resultTotal;
    }

    // 小計の計算へ飛ばす
    updateModalSubtotal();
  }

  // --- モーダル内の小計計算 ---
  function updateModalSubtotal() {
    // 確定単価（割増込み）
    const unitPrice = parseFloat(finalUnitPriceInput?.value || finalUnitPriceInput?.textContent) || 0;
    // 数量
    const quantity = parseFloat(quantityInput?.value) || 0;

    // 微調整の値を取得（チェックが入っている時のみ）
    const adjustCheck = document.getElementById('check_adjust');
    const adjustInput = document.querySelector('input[name="profit_adjust"]');
    const adjustVal = (adjustCheck && adjustCheck.checked) ? (parseFloat(adjustInput?.value) || 0) : 0;

    if (subtotalInput) {
      // 【計算式】 (確定単価 × 数量) + 微調整
      const sum = Math.round(unitPrice * quantity) + adjustVal;

      if (subtotalInput.tagName === 'INPUT') subtotalInput.value = sum;
      else subtotalInput.textContent = sum;
    }
  }

  // --- モーダル内の入力リセット ---
  function clearModalInputsExceptProfits() {
    if (itemNameSelect) itemNameSelect.value = "";
    if (contentSelect) contentSelect.value = "";
    if (quantityInput) quantityInput.value = "";
    if (countInput) countInput.value = "";
    if (lightUseInput) lightUseInput.value = "";
    if (basePriceInput) basePriceInput.value = "0";
    const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');
    if (unitSelect) unitSelect.value = "";

    // 微調整のリセットを追加
    const adjustCheck = document.getElementById('check_adjust');
    const adjustInput = document.querySelector('input[name="profit_adjust"]');
    if (adjustCheck) adjustCheck.checked = false;
    if (adjustInput) {
      adjustInput.value = "";
      adjustInput.disabled = true;
    }

    if (finalUnitPriceInput) {
      finalUnitPriceInput.tagName === 'INPUT' ? (finalUnitPriceInput.value = "0") : (finalUnitPriceInput.textContent = "0");
    }
    if (subtotalInput) {
      subtotalInput.tagName === 'INPUT' ? (subtotalInput.value = "0") : (subtotalInput.textContent = "0");
    }
  }

  // --- 各種イベントリスナー ---
  profitCheckIds.forEach(id => {
    document.getElementById(id)?.addEventListener('change', function () {
      calculateModalProfits();
    });
  });

  document.querySelector('input[name="profit_adjust"]')?.addEventListener('input', calculateModalProfits);

  // 係数スイッチ（〇/✕）のイベント
  keisuCheck?.addEventListener('change', function () {
    if (!this.checked) {
      profitCheckIds.forEach(id => {
        if (id !== 'check_adjust') {
          const cb = document.getElementById(id);
          if (cb) cb.checked = false;
        }
      });
      calculateModalProfits();
    }
  });

  // ==========================================================================
  // ★ 新規登録ボタン（モーダルを開くボタン）クリック時
  // ==========================================================================
  const openModalBtn = document.querySelector('[data-bs-target="#constructionModal"]:not(.editBtn)');

  openModalBtn?.addEventListener('click', function () {
    editingRow = null;
    const modalTitle = document.querySelector('#constructionModal .modal-title');
    if (modalTitle) modalTitle.textContent = "新規入力：施工内容";
    if (registerBtn) registerBtn.textContent = "登録完了";

    clearModalInputsExceptProfits();

    // --- ヘッダーの状態をモーダルにコピー ---
    const headerChecks = document.querySelectorAll('thead .coeffCheck');
    let hasAnyHeaderChecked = false;

    headerChecks.forEach(headerCb => {
      const type = headerCb.getAttribute('data-type');
      const modalCbId = `check_${type}`;
      const modalCb = document.getElementById(modalCbId);

      if (modalCb) {
        modalCb.checked = headerCb.checked;
        lastProfitSettings[modalCbId] = headerCb.checked;
        if (headerCb.checked && type !== 'adjust') {
          hasAnyHeaderChecked = true;
        }
      }
    });

    if (keisuCheck) {
      keisuCheck.checked = hasAnyHeaderChecked;
    }

    calculateModalProfits();
  });

  // --- 各入力要素のリアルタイム連動イベント設定 ---
  basePriceInput?.addEventListener('input', calculateModalProfits);
  quantityInput?.addEventListener('input', () => { updateCount(); updateModalSubtotal(); });
  document.querySelectorAll('[id^="rate_"]').forEach(el => el.addEventListener('input', calculateModalProfits));
  itemNameSelect?.addEventListener('change', updateBasePrice);
  contentSelect?.addEventListener('change', updateBasePrice);

  // ==========================================================================
  // ★ 登録・編集完了ボタンの処理
  // ==========================================================================
  registerBtn?.addEventListener('click', function (e) {
    e.preventDefault();

    const item = itemNameSelect?.value || '';
    const qty = quantityInput?.value || '';
    const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');
    const unit = unitSelect?.value || '';
    const content = contentSelect?.value || '';
    const count = countInput ? countInput.value : '';
    const basePrice = basePriceInput?.value || '0';
    const finalPrice = finalUnitPriceInput?.value || finalUnitPriceInput?.textContent || '0';
    const subtotal = subtotalInput?.value || subtotalInput?.textContent || '0';
    const lightUse = lightUseInput?.value || '';
    const isKeisuChecked = keisuCheck?.checked;

    if (!item || !qty || !unit || !content) {
      alert("「項目名」「台数/本数」「単位」「内容」は必須入力です。");
      return;
    }

    // 保存処理（微調整以外を記憶）
    profitCheckIds.forEach(id => {
      const cb = document.getElementById(id);
      lastProfitSettings[id] = (id === 'check_adjust') ? false : (cb?.checked || false);
    });

    const getProfitVal = (idName) => {
      const cb = document.getElementById(`check_${idName}`);
      const valInput = document.querySelector(`.modal-body input[name="profit_${idName}"]`);
      return (cb && cb.checked) ? (valInput?.value || '0') : '0';
    };

    const rowHtml = `
   <td>
    <div class="d-flex justify-content-center gap-1">
     <button type="button" class="editBtn">編集</button>
     <button type="button" class="deleteBtn">削除</button>
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
      editingRow.innerHTML = rowHtml;
      assignRowEvents(editingRow);
      editingRow = null;
    } else {
      const newRow = document.createElement('tr');
      newRow.innerHTML = rowHtml;
      if (constructionTableBody.innerHTML.includes('データ未入力')) {
        constructionTableBody.innerHTML = '';
      }
      const parkingRow = constructionTableBody.querySelector('tr[data-item-name="駐車場代"]');
      if (parkingRow) {
        constructionTableBody.insertBefore(newRow, parkingRow);
      } else {
        constructionTableBody.appendChild(newRow);
      }
      assignRowEvents(newRow);
    }

    updateTableNumbers();
    updateLaborSubtotal();
    updateTotalQuantity();
    syncHeaderCheckboxes();
    clearModalInputsExceptProfits();

    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
    modalInstance.hide();

    // 割増率テーブルの変更を監視し、表全体を即座に再計算する
    document.querySelectorAll('[id^="rate_"]').forEach(rateInput => {
      rateInput.addEventListener('input', function () {
        const currentRates = getCurrentRates();
        const headerChecks = {};
        document.querySelectorAll('thead .coeffCheck').forEach(cb => {
          headerChecks[cb.getAttribute('data-type')] = cb.checked;
        });

        Array.from(constructionTableBody.rows).forEach(row => {
          if (row.getAttribute('data-item-name') === '駐車場代' || row.cells.length < 17) return;

          const basePrice = parseFloat(row.cells[8].textContent) || 0;
          const qty = parseFloat(row.cells[4].textContent) || 0;
          const adjust = parseFloat(row.cells[14].textContent) || 0;
          const keisuSelect = row.querySelector('.keisu-dropdown');

          // 1. 各列の金額を新しい率で更新
          const colMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13 };
          Object.keys(colMap).forEach(type => {
            if (headerChecks[type]) {
              row.cells[colMap[type]].textContent = Math.round(basePrice * currentRates[type]);
            }
          });

          // 2. 行の確定単価と小計を更新
          if (keisuSelect?.value === 'on') {
            let totalUnitPrice = basePrice;
            for (let i = 9; i <= 13; i++) {
              totalUnitPrice += (parseFloat(row.cells[i].textContent) || 0);
            }
            row.cells[15].textContent = totalUnitPrice;
            row.cells[16].textContent = Math.round(totalUnitPrice * qty) + adjust;
          }
        });

        calculateModalProfits();
        updateLaborSubtotal();
      });
    });

  });

  // ==========================================================================
  // ★ 操作（編集・削除）および表の係数（〇✕）連動
  // ==========================================================================
  function assignRowEvents(row) {
    if (!row) return;

    // --- 1. 削除ボタン：挙動の安定化 ---
    row.querySelector('.deleteBtn')?.addEventListener('click', function (e) {
      e.stopPropagation(); // 重複動作を防止
      if (window.confirm('この施工内容を削除してもよろしいですか？')) {
        row.remove();
        updateTableNumbers();
        updateLaborSubtotal();
        updateTotalQuantity();
        if (typeof updateAllDisplays === "function") updateAllDisplays();
      }
    });

    // --- 2. 編集ボタン：表からデータを取得してモーダルにセットする ---
    row.querySelector('.editBtn')?.addEventListener('click', function (e) {
      e.stopPropagation();
      editingRow = row; // 編集対象の行を保持

      // モーダルのタイトルとボタン名を変更
      const modalTitle = document.querySelector('#constructionModal .modal-title');
      if (modalTitle) modalTitle.textContent = "編集中：施工内容";
      if (registerBtn) registerBtn.textContent = "更新完了";

      // --- 表のセルから入力欄へ値をコピー ---
      if (itemNameSelect) itemNameSelect.value = row.cells[2].textContent;   // 項目名
      if (lightUseInput) lightUseInput.value = row.cells[3].textContent;     // 灯用
      if (quantityInput) quantityInput.value = row.cells[4].textContent;     // 台数/本数

      const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');
      if (unitSelect) unitSelect.value = row.cells[5].textContent;           // 単位

      if (contentSelect) contentSelect.value = row.cells[6].textContent;     // 内容
      if (countInput) countInput.value = row.cells[7].textContent;           // 本数
      if (basePriceInput) basePriceInput.value = row.cells[8].textContent;   // 基本単価

      // --- 割増列（9〜14列）の状態を復元 ---
      const profitMapping = [
        { id: 'check_day', col: 9 },
        { id: 'check_night', col: 10 },
        { id: 'check_high', col: 11 },
        { id: 'check_special', col: 12 },
        { id: 'check_waste', col: 13 },
        { id: 'check_adjust', col: 14 }
      ];

      profitMapping.forEach(map => {
        const val = parseFloat(row.cells[map.col].textContent) || 0;
        const cb = document.getElementById(map.id);
        const input = document.querySelector(`.modal-body input[name="${map.id.replace('check_', 'profit_')}"]`);

        if (cb) {
          cb.checked = (val !== 0); // 0円以外ならチェックを入れる
          lastProfitSettings[map.id] = cb.checked; // 前回の状態として保存
        }
        if (input) {
          input.value = val !== 0 ? val : ""; // 0なら空、数値があればセット
          input.disabled = !cb.checked;
        }
      });

      // --- 係数（〇✕）スイッチの同期 ---
      const keisuVal = row.querySelector('.keisu-dropdown')?.value;
      if (keisuCheck) {
        keisuCheck.checked = (keisuVal === 'on');
      }

      // モーダルを表示
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();

      // モーダル内の計算を最新化（確定単価・小計の表示更新）
      calculateModalProfits();
    });

    // --- 3. 係数（〇✕）連動：見た目の制御 ---
    row.querySelector('.keisu-dropdown')?.addEventListener('change', function () {
      const isOff = (this.value === 'off');
      const basePrice = parseFloat(row.cells[8].textContent) || 0;
      const qty = parseFloat(row.cells[4].textContent) || 0;
      const adjust = parseFloat(row.cells[14].textContent) || 0;

      if (isOff) {
        for (let i = 9; i <= 13; i++) row.cells[i].style.opacity = "0.5";
        row.cells[15].textContent = basePrice;
        row.cells[16].textContent = Math.round(basePrice * qty) + adjust;
        row.style.backgroundColor = "#f2f2f2";
        row.style.color = "#999";
      } else {
        row.style.backgroundColor = "";
        row.style.color = "";
        for (let i = 9; i <= 13; i++) row.cells[i].style.opacity = "1";
        let totalUnitPrice = basePrice;
        for (let i = 9; i <= 13; i++) totalUnitPrice += (parseFloat(row.cells[i].textContent) || 0);
        row.cells[15].textContent = totalUnitPrice;
        row.cells[16].textContent = Math.round(totalUnitPrice * qty) + adjust;
      }
      updateLaborSubtotal();
      if (typeof updateAllDisplays === "function") updateAllDisplays();
    });
  }

  // ==========================================================================
  // ★ 駐車場代ロジック等
  // ==========================================================================
  function createParkingRow() {
    const newRow = document.createElement('tr');
    newRow.setAttribute('data-item-name', '駐車場代');
    newRow.className = 'table-custom-light';
    newRow.innerHTML = `
   <td>
    <div class="d-flex justify-content-center gap-1">
     <button type="button" class="btn btn-secondary btn-sm" disabled>直入力</button>
     <button type="button" class="deleteBtn btn-delete-parking">削除</button>
    </div>
   </td>
   <td></td>
   <td>駐車場代</td>
   <td></td>
   <td class="text-end">
    <input type="number" class="form-control form-control-sm text-end parking-qty-input" value="1" style="width: 60px; display: inline-block;">
   </td>
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

    const updateParkingSubtotal = () => {
      const qtyInput = newRow.querySelector('.parking-qty-input');
      const priceInput = newRow.querySelector('.parking-direct-input');

      const qty = parseFloat(qtyInput.value) || 0;
      const price = parseFloat(priceInput.value) || 0;
      const total = Math.round(qty * price);

      newRow.querySelector('.final-unit-price-cell').textContent = price;
      newRow.querySelector('.subtotal-cell').textContent = total;

      updateLaborSubtotal();  // 全体の合計金額を更新
      updateTotalQuantity();  // 全体の総数を更新
      if (typeof updateAllDisplays === "function") updateAllDisplays();
    };

    newRow.querySelector('.parking-qty-input').addEventListener('input', updateParkingSubtotal);
    newRow.querySelector('.parking-direct-input').addEventListener('input', updateParkingSubtotal);

    newRow.querySelector('.btn-delete-parking').addEventListener('click', function () {
      newRow.remove();
      if (parkingCheck) parkingCheck.checked = false;
      updateTableNumbers();
      updateLaborSubtotal();
      updateTotalQuantity();
    });

    assignRowEvents(newRow);
    return newRow;
  }

  parkingCheck?.addEventListener('change', function () {
    const existingRow = constructionTableBody.querySelector('tr[data-item-name="駐車場代"]');
    if (this.checked) {
      if (!existingRow) {
        // 駐車場代行が存在しない場合のみ追加
        constructionTableBody.appendChild(createParkingRow());
      }
    } else {
      existingRow?.remove();
    }
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
    headerChecks.forEach((headerCb) => {
      const type = headerCb.getAttribute('data-type');
      if (type === 'adjust') return;
      const typeIndexMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13 };
      const cellValue = firstRow.cells[typeIndexMap[type]]?.textContent || '0';
      headerCb.checked = (cellValue !== '0');
    });
  }


  // ==========================================================================
  // ★ ヘッダーのチェックボックス切り替え：全行の数値 + 係数(〇✕)を連動
  // ==========================================================================
  document.querySelectorAll('thead .coeffCheck').forEach(headerCb => {
    headerCb.addEventListener('change', function () {
      const type = this.getAttribute('data-type');
      if (type === 'adjust') return;

      const colIndexMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13 };
      const colIndex = colIndexMap[type];

      // ★ ここで最新の利率を取得するように変更
      const currentRates = getCurrentRates();

      Array.from(constructionTableBody.rows).forEach(row => {
        if (row.getAttribute('data-item-name') === '駐車場代' || row.cells.length < 17) return;

        const basePrice = parseFloat(row.cells[8].textContent) || 0;
        const qty = parseFloat(row.cells[4].textContent) || 0;
        const adjust = parseFloat(row.cells[14].textContent) || 0;
        const keisuSelect = row.querySelector('.keisu-dropdown');

        // 1. 該当する列の金額を更新
        if (this.checked) {
          // ★ PROFIT_RATES[type] ではなく currentRates[type] を使う
          const rate = currentRates[type] || 0;
          row.cells[colIndex].textContent = Math.round(basePrice * rate);
        } else {
          row.cells[colIndex].textContent = '0';
        }

        // 2. 係数(〇✕)の自動判定
        let hasAnyProfit = false;
        for (let i = 9; i <= 13; i++) {
          if ((parseFloat(row.cells[i].textContent) || 0) !== 0) {
            hasAnyProfit = true;
            break;
          }
        }

        if (keisuSelect) {
          keisuSelect.value = hasAnyProfit ? 'on' : 'off';
          // 見た目の更新
          if (hasAnyProfit) {
            row.style.backgroundColor = "";
            row.style.color = "";
            for (let i = 9; i <= 13; i++) row.cells[i].style.opacity = "1";
          } else {
            for (let i = 9; i <= 13; i++) row.cells[i].style.opacity = "0.5";
            row.style.backgroundColor = "#f2f2f2";
            row.style.color = "#999";
          }
        }

        // 3. 確定単価と小計の再計算
        if (keisuSelect && keisuSelect.value === 'on') {
          let totalUnitPrice = basePrice;
          for (let i = 9; i <= 13; i++) {
            totalUnitPrice += (parseFloat(row.cells[i].textContent) || 0);
          }
          row.cells[15].textContent = totalUnitPrice;
          row.cells[16].textContent = Math.round(totalUnitPrice * qty) + adjust;
        } else {
          row.cells[15].textContent = basePrice;
          row.cells[16].textContent = Math.round(basePrice * qty) + adjust;
        }
      });

      updateLaborSubtotal();
      if (typeof updateAllDisplays === "function") updateAllDisplays();
    });
  });

  // ==========================================================================
  // ★ 単価セクション（原価・利益計算）
  // ==========================================================================
  function updateUnitPriceSection() {
    const getNum = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      return typeof parseCurrency === 'function' ? parseCurrency(el.value) : 0;
    };

    const setVal = (id, val, isPercent = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isPercent) {
        el.value = val.toFixed(1) + "%";
      } else {
        el.value = "￥" + Math.round(val).toLocaleString();
      }
    };

    // 1. 提出見積金額を取得
    const totalEstimate = getNum('finalEstimatedPrice');

    // --- 2. 人工・外注費 ---
    let totalLaborSum = 0;
    const totalRow = document.querySelector('.row-total');
    if (totalRow) {
      totalRow.querySelectorAll('input').forEach(input => {
        totalLaborSum += (parseFloat(input.value.replace(/[^0-9]/g, '')) || 0);
      });
    }
    setVal('totalLaborCost', totalLaborSum);
    setVal('laborCostPercentage', totalEstimate > 0 ? (totalLaborSum / totalEstimate * 100) : 0, true);

    // --- 3. 産廃 ---
    let wasteAmount = 0;
    if (totalEstimate > 0) {
      wasteAmount = totalEstimate >= 100000 ? Math.round((totalEstimate * 0.02) / 1000) * 1000 : 1000;
    }
    setVal('industrialWasteCost', wasteAmount);
    setVal('industrialWastePercentage', totalEstimate > 0 ? (wasteAmount / totalEstimate * 100) : 0, true);

    // --- 4. 諸経費＋B材 ---
    const bAmount = getNum('displayMaterialB');
    const transportRow = document.querySelector('.bg-orange-row:nth-of-type(3)');
    const stayRow = document.querySelector('.bg-orange-row:nth-of-type(4)');
    let arkOverheadSum = 0;
    if (transportRow && stayRow) {
      for (let i = 0; i < 5; i++) {
        const transVal = parseFloat(transportRow.querySelectorAll('input')[i]?.value.replace(/[^0-9]/g, '')) || 0;
        const stayVal = parseFloat(stayRow.querySelectorAll('input')[i]?.value.replace(/[^0-9]/g, '')) || 0;
        arkOverheadSum += (transVal + stayVal);
      }
    }
    const totalOverheadB = bAmount + arkOverheadSum;
    setVal('overheadBMaterialCost', totalOverheadB);
    setVal('overheadBMaterialPercentage', totalEstimate > 0 ? (totalOverheadB / totalEstimate * 100) : 0, true);

    // --- 5. 高所作業車等 (HTMLのIDに合わせる) ---
    const highWorkCost = typeof calculateHighWorkTotal === 'function' ? calculateHighWorkTotal() : 0;
    setVal('highAltitudeVehicleCost', highWorkCost);
    setVal('highAltitudeVehiclePercentage', totalEstimate > 0 ? (highWorkCost / totalEstimate * 100) : 0, true);

    // --- 6. 商品・器具 (HTMLのIDに合わせる) ---
    const productCost = getNum('displayMaterialA'); // A材の合計
    setVal('productEquipmentCost', productCost);
    setVal('productEquipmentPercentage', totalEstimate > 0 ? (productCost / totalEstimate * 100) : 0, true);

    // --- 7. アーク利益 (HTMLのID: arcProfit, arcProfitPercentage に合わせる) ---
    const totalCosts = totalLaborSum + wasteAmount + totalOverheadB + highWorkCost + productCost;
    const profitAmount = totalEstimate > 0 ? (totalEstimate - totalCosts) : 0;

    setVal('arcProfit', profitAmount);
    setVal('arcProfitPercentage', totalEstimate > 0 ? (profitAmount / totalEstimate * 100) : 0, true);

    // --- 8. 報酬金 ---
    let reward = 0;
    let rewardPct = 0;

    // Excel式: =IF(T53>=100000, ROUNDDOWN(T53*0.01, -3), "")
    // profitAmount(アーク利益)が10万円以上の時のみ計算
    if (profitAmount >= 100000) {
      // 1%を掛けてから1,000円単位で切り捨て
      reward = Math.floor((profitAmount * 0.01) / 1000) * 1000;

      // 報酬金 ÷ アーク利益
      if (profitAmount > 0) {
        rewardPct = (reward / profitAmount) * 100;
      }
    }

    // 表示の反映（10万円未満なら空文字にする）
    const rewardInput = document.getElementById('rewardAmount');
    const rewardPctInput = document.getElementById('rewardPercentage');

    if (rewardInput) {
      rewardInput.value = profitAmount >= 100000 ? "￥" + reward.toLocaleString() : "";
    }
    if (rewardPctInput) {
      rewardPctInput.value = profitAmount >= 100000 ? rewardPct.toFixed(1) + "%" : "";
    }
  }

  // ==========================================================================
  // ★ 工事日数表（自動計算・集計・行操作）
  // ==========================================================================
  function updateFinancialTotals() {
    const unitPriceRow = document.querySelector('.row-unit-price');
    const transportRow = document.querySelector('.bg-orange-row:nth-of-type(3)'); // 交通費
    const stayRow = document.querySelector('.bg-orange-row:nth-of-type(4)');      // 宿泊費
    const totalRow = document.querySelector('.row-total');

    const headRowCells = document.querySelectorAll('.attendance-table thead tr td.worker-col');

    headRowCells.forEach((targetTd, index) => {
      const countText = targetTd.textContent.replace(/[^0-9]/g, '');
      const totalDays = parseInt(countText) || 0;

      // 自社スタッフ（index < 5）の交通費自動入力ロジック
      if (index < 5) {
        const transportInput = transportRow?.querySelectorAll('input')[index];
        if (transportInput) {
          transportInput.value = (totalDays > 0) ? 5000 : 0;
        }
      }

      const getVal = (row) => {
        const input = row?.querySelectorAll('input')[index];
        return parseInt(input?.value.replace(/[^0-9]/g, '') || "0");
      };

      const unitPrice = getVal(unitPriceRow);
      const transport = getVal(transportRow);
      const stay = getVal(stayRow);

      let finalTotal = 0;

      // ★修正ポイント：人数（totalDays）が1人以上の時だけ計算を実行する
      if (totalDays > 0) {
        if (index < 5) {
          // 自社：単価 × 人数
          finalTotal = unitPrice * totalDays;
        } else {
          // 外注：(単価 × 人数) + 交通費 + 宿泊費
          finalTotal = (unitPrice * totalDays) + transport + stay;
        }
      } else {
        // 人数が0人の時は、交通費などが入っていても合計は0にする
        finalTotal = 0;
      }

      const totalInput = totalRow?.querySelectorAll('input')[index];
      if (totalInput) {
        // 合計を表示（0の場合は空文字にしたい場合はここを調整してください。今回は0を表示します）
        totalInput.value = finalTotal > 0 ? finalTotal.toLocaleString() : "0";
      }
    });
    // ★ここに追加：日数表の合計が変わったので単価セクションも更新する
    updateUnitPriceSection();
  }

  // --- 1. スクロール同期 ---
  const scrollTop = document.getElementById('scroll-top');
  const scrollBottom = document.getElementById('scroll-bottom');

  if (scrollTop && scrollBottom) {
    scrollTop.addEventListener('scroll', () => { scrollBottom.scrollLeft = scrollTop.scrollLeft; });
    scrollBottom.addEventListener('scroll', () => { scrollTop.scrollLeft = scrollBottom.scrollLeft; });
  }

  // --- 2. 行を作成する関数 ---

  // [上の表：出勤管理]
  function createAttendanceRow(rowNumber) {
    const tr = document.createElement('tr');
    tr.className = 'attendance-row';

    let html = `<th class="table-secondary head-col">${rowNumber}日目 / 0人</th>`;
    for (let i = 0; i < 10; i++) {
      const extraClass = (i === 4) ? ' border-right-divider' : '';
      html += `<td class="attendance-cell${extraClass}"></td>`;
    }
    tr.innerHTML = html;

    tr.querySelectorAll('.attendance-cell').forEach(cell => {
      cell.style.cursor = 'pointer';
      cell.style.userSelect = 'none';
      cell.addEventListener('click', function () {
        if (this.textContent === '〇') {
          this.textContent = '';
          this.style.backgroundColor = '';
        } else {
          this.textContent = '〇';
          this.style.color = '#0d6efd';
          this.style.fontWeight = 'bold';
          this.style.fontSize = '1.1rem';
          this.style.textAlign = 'center';
          this.style.backgroundColor = ' #e7f1ff';
          this.style.lineHeight = '40px';
        }
        updateAttendanceCounts();
        calculateTargets(); // 人数が変わったら計算も更新
      });
    });
    return tr;
  }


  function createTargetRow(rowNumber) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-row', rowNumber);

    tr.innerHTML = `
  <th class="table-secondary text-center py-2 fw-bold head-col" style="border: 1px solid #dee2e6 !important;">
   ${rowNumber}日目 / 0人
  </th>
  <td class="p-1" style="border: 1px solid #dee2e6 !important;">
   <input type="text" class="form-control text-center shadow-none bg-light target-daily-input" readonly>
  </td>
  <td class="p-1" style="border: 1px solid #dee2e6 !important;">
   <input type="text" class="form-control text-center shadow-none bg-light target-total-display" readonly>
  </td>
  <td class="p-1" style="border: 1px solid #dee2e6 !important;">
   <input type="text" class="form-control text-center shadow-none bg-light target-per-person-display" readonly>
  </td>
  <td class="p-1" style="border: 1px solid #dee2e6 !important;">
   <input type="text" class="form-control text-center shadow-none px-2 target-date-input"
    placeholder="日付選択" 
    onfocus="this.type='date'" 
    onchange="this.type='text'; calculateTargets();"
    onblur="this.type='text'; calculateTargets();">
  </td>
 `;
    return tr;
  }

  // --- 3. 日付・計算のロジック ---
  // ---　曜日のフォーマット関数（年込み）---
  function formatDateWithDay(val) {
    if (!val || val.includes('(')) return val;
    const date = new Date(val.replace(/-/g, '/')); // スラッシュに変換してパース安定化
    if (isNaN(date)) return val;
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${y}/${m}/${d}(${days[date.getDay()]})`;
  }

  // --- 目標値（1日・完了・一人当たり）の自動計算 ----
  function calculateTargets() {
    const totalQtyInput = document.getElementById('totalQuantityDisplay');
    const constructionDaysInput = document.getElementById('constructionDays');
    const targetRows = document.querySelectorAll('#target-schedule-body tr');

    const totalQty = parseFloat(totalQtyInput?.value.replace(/[^0-9.]/g, '')) || 0;
    const totalDays = parseInt(constructionDaysInput?.value) || 0;

    let averageDailyTarget = 0;
    if (totalDays > 0 && totalQty > 0) {
      averageDailyTarget = Math.floor((totalQty / totalDays) * 10) / 10;
    }

    let workedDaysCount = 0;

    targetRows.forEach((row) => {
      const dailyInput = row.querySelector('.target-daily-input');
      const totalDisplay = row.querySelector('.target-total-display');
      const perPersonInput = row.querySelector('.target-per-person-display');
      const headCol = row.querySelector('.head-col');

      const workerMatch = headCol?.textContent.match(/(\d+)人/);
      const workerCount = workerMatch ? parseInt(workerMatch[1]) : 0;

      if (workerCount > 0 && averageDailyTarget > 0) {
        workedDaysCount++;
        dailyInput.value = averageDailyTarget.toFixed(1);

        if (workedDaysCount === totalDays) {
          totalDisplay.value = Math.round(totalQty).toLocaleString();
        } else {
          const runningTotal = averageDailyTarget * workedDaysCount;
          totalDisplay.value = Math.round(runningTotal).toLocaleString();
        }

        const perPersonResult = averageDailyTarget / workerCount;
        perPersonInput.value = perPersonResult.toFixed(1);
      } else {
        dailyInput.value = "";
        totalDisplay.value = "";
        perPersonInput.value = "";
      }
    });
  }

  // --- 指定された行（startIndex）を起点に、それ以降の行の日付を翌日連鎖させる ---
  function syncDatesFromRow(startIndex) {
    const targetRows = document.querySelectorAll('#target-schedule-body tr');
    if (!targetRows[startIndex]) return;

    const dateInput = targetRows[startIndex].querySelector('.target-date-input');
    // 現在の入力値をパース（曜日付きでも日付のみでも対応）
    let currentStr = dateInput.value.split('(')[0].trim().replace(/\//g, '-');
    let baseDate = new Date(currentStr);

    if (isNaN(baseDate.getTime())) return;

    // 起点となった行を整形
    dateInput.value = formatFullDateWithDay(baseDate);

    // 次の行から最後までループして「前日の翌日」をセットしていく
    for (let i = startIndex + 1; i < targetRows.length; i++) {
      baseDate.setDate(baseDate.getDate() + 1);
      const nextInput = targetRows[i].querySelector('.target-date-input');
      nextInput.value = formatFullDateWithDay(new Date(baseDate));
    }
  }

  // --- ヘルパー関数：日付フォーマット YYYY/MM/DD(曜) ---
  function formatFullDateWithDay(date) {
    if (!date || isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];
    return `${y}/${m}/${d}(${dayLabels[date.getDay()]})`;
  }

  // --- 入力時のイベントトリガー ---
  document.addEventListener('change', function (e) {
    // 日付入力欄が変更された場合

    if (e.target.classList.contains('target-date-input')) {
      const row = e.target.closest('tr');
      const rows = Array.from(document.querySelectorAll('#target-schedule-body tr'));
      const rowIndex = rows.indexOf(row);

      // 1. その行を起点に下の行の日付を連動
      syncDatesFromRow(rowIndex);

      // 2. もし1行目なら上部カレンダーに同期
      if (rowIndex === 0 && e.target.value) {
        const startDateInput = document.getElementById('startDate');
        const cleanVal = e.target.value.split('(')[0].trim().replace(/\//g, '-');
        if (startDateInput) {

          // カレンダー形式 YYYY-MM-DD に整えて反映
          const d = new Date(cleanVal);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const mm = ('0' + (d.getMonth() + 1)).slice(-2);
            const dd = ('0' + d.getDate()).slice(-2);
            startDateInput.value = `${y}-${mm}-${dd}`;
          }
        }
      }
      calculateTargets();
    }

    // 数値が変更された場合
    if (e.target.id === 'totalQuantityDisplay' || e.target.classList.contains('target-daily-input')) {
      calculateTargets();
    }
  });

  // 上部のカレンダー（工事開始日）が変更された場合
  document.getElementById('startDate')?.addEventListener('change', function (e) {
    const firstDateInput = document.querySelector('#target-schedule-body .target-date-input');
    if (firstDateInput) {
      firstDateInput.value = e.target.value; // カレンダーの値を1行目にセット
      syncDatesFromRow(0); // 1行目から全連動を開始
    }
    calculateTargets();
  });

  // --- 4. 初期表示とボタン操作 ---
  const attendanceBody = document.getElementById('attendance-body');
  const targetBody = document.getElementById('target-schedule-body');
  const addRowBtn = document.getElementById('addRowBtn');

  if (attendanceBody && targetBody) {
    attendanceBody.innerHTML = '';
    targetBody.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      attendanceBody.appendChild(createAttendanceRow(i));
      targetBody.appendChild(createTargetRow(i));
    }
  }

  addRowBtn?.addEventListener('click', function () {
    const currentRows = attendanceBody.querySelectorAll('tr').length;
    if (currentRows < 20) {
      const nextNum = currentRows + 1;
      attendanceBody.appendChild(createAttendanceRow(nextNum));
      const newTargetRow = createTargetRow(nextNum);
      targetBody.appendChild(newTargetRow);

      // 行追加時、直前の行の日付があればその翌日をセット
      const allRows = targetBody.querySelectorAll('tr');
      const prevRow = allRows[allRows.length - 2];
      const prevDateInput = prevRow?.querySelector('.target-date-input');

      if (prevDateInput && prevDateInput.value.includes('(')) {
        const rawStr = prevDateInput.value.split('(')[0].replace(/\//g, '-');
        const prevDate = new Date(rawStr);
        if (!isNaN(prevDate)) {
          const nextDate = new Date(prevDate);
          nextDate.setDate(prevDate.getDate() + 1);
          const newDateInput = newTargetRow.querySelector('.target-date-input');
          newDateInput.value = formatFullDateWithDay(nextDate);
        }
      }
      calculateTargets();
    }
  });



  // 初回実行

  calculateTargets();

  // --- 5. 人数集計関数 (上下の同期) ---

  function updateAttendanceCounts() {
    const table = document.querySelector('.attendance-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const headRowCells = table.querySelectorAll('thead tr td.worker-col');
    const targetRows = targetBody?.querySelectorAll('tr');

    let activeDayCount = 0;

    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('.attendance-cell');
      const rowCount = Array.from(cells).filter(c => c.textContent === '〇').length;

      if (rowCount > 0) activeDayCount++;

      const headCol = row.querySelector('.head-col');
      if (headCol) {
        const dayLabel = headCol.textContent.split(' / ')[0];
        const numberStyle = (rowCount > 0) ? 'color: #0d6efd; font-weight: bold;' : 'color: inherit;';
        headCol.innerHTML = `${dayLabel} / <span style="${numberStyle}">${rowCount}</span>人`;
      }

      if (targetRows && targetRows[index]) {
        const targetHeadCol = targetRows[index].querySelector('.head-col');
        if (targetHeadCol) {
          const targetDayLabel = (index + 1) + "日目";
          const targetNumberStyle = (rowCount > 0) ? 'color: #0d6efd; font-weight: bold;' : 'color: inherit;';
          targetHeadCol.innerHTML = `${targetDayLabel} / <span style="${targetNumberStyle}">${rowCount}</span>人`;
        }
      }
    });

    const constructionDaysInput = document.getElementById('constructionDays');
    if (constructionDaysInput) constructionDaysInput.value = activeDayCount;

    headRowCells.forEach((targetTd, index) => {
      let colTotal = 0;
      rows.forEach(row => {
        const targetCell = row.querySelectorAll('.attendance-cell')[index];
        if (targetCell && targetCell.textContent === '〇') colTotal++;
      });
      targetTd.textContent = `${colTotal}人`;
    });

    updateFinancialTotals();
    calculateTargets();
  }

  // --- 削除ボタンの連動 ---
  const removeRowBtn = document.getElementById('removeRowBtn');
  removeRowBtn?.addEventListener('click', function () {
    const currentRows = attendanceBody.querySelectorAll('tr');
    const rowCount = currentRows.length;

    if (rowCount > 5) {
      if (confirm('一番下の行（' + rowCount + '日目）を削除しますか？')) {
        attendanceBody.removeChild(currentRows[rowCount - 1]);
        targetBody.removeChild(targetBody.lastElementChild);
        updateAttendanceCounts();
        calculateTargets();
      }
    } else {
      alert('5日目以前は削除できません。');
    }
  });

  function setupCalculationTriggers() {
    const priceInputs = document.querySelectorAll('.row-unit-price input, .bg-orange-row input');
    priceInputs.forEach(input => {
      input.removeEventListener('input', updateFinancialTotals);
      input.addEventListener('input', updateFinancialTotals);
    });
  }

  setupCalculationTriggers();
  updateAttendanceCounts();

  // ==========================================================================
  // 5. 反映処理ロジック
  // ==========================================================================
  // --- 画面上の全ての金額表示と最終合計金額（提出見積金額）を更新するメイン関数 ---
  function updateAllDisplays() {
    // 労務費（小計）を数値として取得
    const rawLabor = parseCurrency(laborSubtotal?.value || "0");

    // --- 現調費の自動判定（表示のみ更新し、最終合計には加算しない） ---
    const surveyFeeInput = document.getElementById('surveyFee');
    if (surveyFeeInput && !isSurveyFeeManual) {
      if (rawLabor > 0) {
        // 労務費が5万円以下なら5,000円、それ以外は10,000円をセット
        surveyFeeInput.value = (rawLabor <= 50000) ? 5000 : 10000;
      } else {
        surveyFeeInput.value = 0;
      }
    }

    // 労務費・諸経費の表示更新
    if (displayLaborTotal) displayLaborTotal.value = `￥${rawLabor.toLocaleString()}`;

    // 高所作業車等の合計金額を計算して表示更新
    const highWorkTotal = calculateHighWorkTotal();
    if (displayHighWorkTotal) displayHighWorkTotal.value = `￥${highWorkTotal.toLocaleString()}`;

    // --- 🔹 値引き額の取得（再計算時も最新の値を確実に取得） 🔹 ---
    // 他の金額（数量や項目）が変わった際も、この関数を通じて値引きを再計算に含めます
    const discountVal = calculateDiscountValue();

    // 商品・器具(A材)の計算（チェック時のみ加算）
    const aTotalVal = (aMaterialCheck?.checked && aTotalAmountDiv) ? parseCurrency(aTotalAmountDiv.textContent) : 0;
    if (displayMaterialA) displayMaterialA.value = `￥${aTotalVal.toLocaleString()}`;

    // 消耗雑材(B材)の計算（チェック時のみ加算）
    const bTotalVal = (bMaterialCheck?.checked && bTotalAmountDiv) ? parseCurrency(bTotalAmountDiv.textContent) : 0;
    if (displayMaterialB) displayMaterialB.value = `￥${bTotalVal.toLocaleString()}`;

    // --- 🔹 最終合計（提出見積金額）の算出 🔹 ---
    // 現調費は含まず、各項目の数値を足し合わせる
    // discountVal は負の数（例: -1000）として取得されるため、加算することで値引きされます
    const finalSum = rawLabor + highWorkTotal + aTotalVal + bTotalVal + discountVal;

    // 提出見積金額の表示をカンマ区切りで更新
    if (finalEstimatedPrice) {
      finalEstimatedPrice.value = `￥${finalSum.toLocaleString()}`;
    }
    // ★ここに追加：全体金額が変わったので単価セクションも更新する
    updateUnitPriceSection();
  }


  // --- 通貨形式（￥やカンマ付き）の文字列を数値に変換する共通関数 ---
  function parseCurrency(text) {
    if (!text) return 0;
    // ￥、カンマ、空白を削除。数値認識のために「-」は残す
    const cleaned = String(text).replace(/[￥,¥\s]/g, '');
    return parseFloat(cleaned) || 0;
  }

  // --- 高所作業車テーブルのチェックされた行から合計金額を算出する ---

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


  // --- 赤い値引き入力欄から数値を抽出し、計算用の「負の数」として返す ---
  function calculateDiscountValue() {
    const el = document.getElementById('budgetDiscount');
    if (!el || !el.value) return 0;

    // 数字とマイナス記号以外を削除
    const rawValue = el.value.replace(/[^0-9-]/g, '');
    const num = parseFloat(rawValue) || 0;

    // 入力値が正の数であっても、計算上は値引き（マイナス）として扱う安全策
    return num > 0 ? -num : num;
  }


  // --- 労務費の各行（小計セル）を集計し、メインの労務費小計欄を更新する ---
  function updateLaborSubtotal() {
    let total = 0;
    document.querySelectorAll('.subtotal-cell').forEach(cell => {
      total += parseCurrency(cell.textContent);
    });
    if (laborSubtotal) {
      laborSubtotal.value = total;
      // 施工内容の変更をトリガーに、値引きも含めた全体計算を再実行
      updateAllDisplays();
    }
  }

  // --- 施工テーブル内の数量（台数）の総数を集計する ---
  function updateTotalQuantity() {
    let totalQty = 0;
    constructionTableBody?.querySelectorAll('tr').forEach(row => {
      if (row.cells.length < 5 || row.innerHTML.includes('データ未入力')) return;
      const qtyInput = row.cells[4].querySelector('input');
      const qty = qtyInput ? parseFloat(qtyInput.value) : parseFloat(row.cells[4].textContent);
      totalQty += qty || 0;
    });
    if (totalQuantityDisplay) {
      totalQuantityDisplay.value = totalQty;
    }
  }

  // 初期化：駐車場代行の生成
  if (parkingCheck) {
    parkingCheck.checked = true;
    if (constructionTableBody.innerHTML.includes('データ未入力')) {
      constructionTableBody.innerHTML = '';
    }
    constructionTableBody.appendChild(createParkingRow());
  }

  // ページ読み込み時の初回計算実行
  updateTableNumbers();
  updateLaborSubtotal();
  updateTotalQuantity();
  updateAllDisplays();
  syncHeaderCheckboxes();
  updateUnitPriceSection();



  // --- ページ読み込み完了後に、各入力フィールドへのイベント設定（リアルタイム連動）を行う ---
  // Bootstrap ツールチップ初期化
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  });

  const budgetDiscountInput = document.getElementById('budgetDiscount');
  const surveyFeeInput = document.getElementById('surveyFee');

  // フォーカス時・フォーカスアウト時の挙動（入力補助）
  [budgetDiscountInput, surveyFeeInput].forEach(input => {
    // そもそも要素が存在しない、あるいは日付入力（type="date"等）ならスキップする
    if (!input || input.type === 'date' || input.classList.contains('flatpickr-input')) return;

    let previousValue = "";

    input.addEventListener('focus', function () {
      previousValue = this.value;
      const val = this.value.replace(/[^0-9-]/g, '');
      if (val === "0" || val === "-0" || val === "") {
        this.value = '';
      }
    });

    input.addEventListener('blur', function () {
      // 🔹 修正：値が空になった場合のみ、元の値(previousValue)に戻す
      // これにより「やっぱりやめた」時に値が消えるのを防ぎます
      if (this.value.trim() === '' || this.value === '-') {
        this.value = previousValue;
      }

      // それでもまだ空（最初から空だった場合など）なら '0' を入れる
      if (this.value.trim() === '') {
        this.value = '0';
      }

      if (typeof updateAllDisplays === 'function') updateAllDisplays();
    });
  });

  // ==========================================================================
  // ★ 値引き入力時のリアルタイム処理
  // ==========================================================================
  budgetDiscountInput?.addEventListener('input', function () {
    // 1. 数字以外を削除（意図しない記号の混入を防止）
    let num = this.value.replace(/[^0-9]/g, '');

    // 2. 常に頭に「-」をつけて表示。空なら空にする
    if (num !== '') {
      this.value = '-' + num;
    } else {
      this.value = '';
    }

    // 3. 🔹この瞬間に計算を実行することで、新規登録を待たずにリアルタイム反映🔹
    updateAllDisplays();
  });
});