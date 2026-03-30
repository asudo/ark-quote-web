/**
 * main_form2.js
 * 役割：【施工内容・原価・利益計算】の統合メインロジック
 * 主な処理：施工項目の入力と単価・割増率のリアルタイム計算、出勤簿と連動した人工費・諸経費の集計、
 * 3軸（全体・工事・商品）での利益率分析、工期に応じた施工目標数と日付の自動連鎖制御。
 */

window.isSurveyFeeManual = false; // 現調費の手動修正フラグ

document.addEventListener('DOMContentLoaded', function () {

  // ==========================================================================
  // 1. 定数・変数定義
  // ==========================================================================
  let masterData = [];             // Supabaseから取得したマスタ
  let editingRow = null;           // 編集中の行
  let lastProfitSettings = {       // 割増設定の引き継ぎ用
    check_day: false, check_night: false, check_high: false,
    check_special: false, check_waste: false, check_adjust: false
  };

  // --- テーブル列番号定義 (1開始) ---
  const COL = {
    QTY: 4,               // 台数/本数　
    BASE_PRICE: 8,        // 基本単価
    PROFIT_DAY: 9,        // 昼間割増
    PROFIT_NIGHT: 10,     // 夜間割増
    PROFIT_HIGH: 11,      // 高所割増
    PROFIT_SPECIAL: 12,   // 特殊割増
    PROFIT_WASTE: 13,     // 産廃割増
    PROFIT_ADJUST: 14,    // 微調整
    FINAL_UNIT_PRICE: 15, // 確定単価
    SUBTOTAL: 16          // 小計
  };

  // --- メイン表示・合計関連 ---
  const finalEstimatedPrice = document.getElementById('finalEstimatedPrice'); // 提出見積金額
  const budgetDiscount = document.getElementById('budgetDiscount');           // 値引き
  const laborSubtotal = document.getElementById('laborSubtotal');             // 小計
  const displayLaborTotal = document.getElementById('displayLaborTotal');     // 労務・諸経費
  const displayHighWorkTotal = document.getElementById('displayHighWorkTotal'); // 高所作業車等
  const displayMaterialA = document.getElementById('displayMaterialA');       // 商品・器具(A材)
  const displayMaterialB = document.getElementById('displayMaterialB');       // 消耗雑材(B材)
  const totalQuantityDisplay = document.getElementById('totalQuantityDisplay'); // 総数

  // --- セクション制御 (高所車・A材B材・駐車場) ---
  const highWorkCarCheck = document.getElementById('highWorkCar');
  const highWorkSection = document.getElementById('highWorkSection');
  const highWorkTable = document.querySelector('#highWorkSection table');
  const aMaterialCheck = document.getElementById('aMaterialCheck');
  const aTotalAmountDiv = document.getElementById('a-totalAmount');
  const bMaterialCheck = document.getElementById('bMaterialCheck');
  const bTotalAmountDiv = document.getElementById('b-totalAmount');
  const parkingCheck = document.getElementById('parkingCheck');

  // --- モーダル内 入力要素 ---
  const modalElement = document.getElementById('constructionModal');
  const modalTitle = document.querySelector('#constructionModal .modal-title');
  const constructionForm = document.getElementById('constructionForm');
  const itemNameInput = document.getElementById('itemNameInput');
  const itemNameSelect = itemNameInput;
  const itemNameOptions = document.getElementById('itemNameOptions');
  const contentInput = document.getElementById('contentInput') || document.querySelector('[name="content"]');
  const basePriceInput = document.getElementById('basePrice') || document.querySelector('input[name="basePrice"]');
  const finalUnitPriceInput = document.querySelector('.totalConfirmedPrice') || document.getElementById('finalUnitPrice');
  const subtotalInput = document.getElementById('subtotalDisplay');
  const unitInput = document.getElementById('unitInput');
  const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');

  // --- 数量・本数関連 ---
  const lightUseInput = document.querySelector('input[name="lightUse"]');
  const quantityInput = document.querySelector('input[name="quantity"]');
  const countInput = document.getElementById('count') || document.querySelector('input[name="count"]');

  // --- 割増・係数設定 ---
  const profitCheckIds = ['check_day', 'check_night', 'check_high', 'check_special', 'check_waste', 'check_adjust'];
  const keisuCheck = document.getElementById('coefficientCheck');
  const adjustCheck = document.getElementById('check_adjust');
  const adjustInput = document.querySelector('input[name="profit_adjust"]');
  const headerChecks = document.querySelectorAll('thead .coeffCheck');

  // 割増入力欄をまとめて保持
  const profitInputs = {};
  profitCheckIds.forEach(id => {
    profitInputs[id] = document.querySelector(`.modal-body input[name="${id.replace('check_', 'profit_')}"]`);
  });

  // --- 利益率・報酬表示 ---
  const arcProfitPercentage = document.getElementById('arcProfitPercentage');
  const constructionOnlyPercentage = document.getElementById('constructionOnlyPercentage');
  const rewardAmount = document.getElementById('rewardAmount');
  const rewardPercentage = document.getElementById('rewardPercentage');

  // --- 工事種別・操作ボタン・テーブル ---
  const koujiType1 = document.getElementById('koujiType1');
  const koujiType2 = document.getElementById('koujiType2');
  const openModalBtn = document.querySelector('[data-bs-target="#constructionModal"]:not(.editBtn)');
  const registerBtn = document.getElementById('registerBtn');
  const constructionTableBody = document.querySelector('.construction-scroll tbody');
  const btnToForm2 = document.getElementById('btnToForm2');
  const form2TabEl = document.getElementById('form2-tab');

  /**
 * 🔹 施工内容タブの復元用関数
 * save_logic.js から呼び出されます
 */
  window.restoreMainForm2Data = function (data) {
    if (!data) return;
    console.log("施工内容タブの復元を開始します", data);

    // 💡 0. 単価グループ（手入力フラグと金額）の最優先復元
    if (data.unitPriceInfo) {
      if (data.unitPriceInfo.isSurveyFeeManual !== undefined) {
        window.isSurveyFeeManual = data.unitPriceInfo.isSurveyFeeManual;
      }
      const havc = document.getElementById('highAltitudeVehicleCost');
      if (havc) havc.value = data.unitPriceInfo.highAltitudeVehicleCost || "￥0";

      const sf = document.getElementById('surveyFee');
      if (sf) sf.value = data.unitPriceInfo.surveyFee || "0";
    }

    // 1. 基本入力項目の復元
    const fields = {
      'addressee': data.addressee,
      'companyName': data.companyName,
      'ceilingHeight1': data.ceilingHeight1,
      'ceilingHeight2': data.ceilingHeight2,
      'budgetDiscount': data.budgetDiscount,
      'rate_day': data.rate_day,
      'rate_night': data.rate_night,
      'rate_high': data.rate_high,
      'rate_special': data.rate_special,
      'rate_waste': data.rate_waste
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (el) el.value = value || (id.includes('rate') ? "0" : "");
    }

    // 2. 高所作業車の「全体チェック」復元
    const hwCheck = document.getElementById('highWorkCar');
    if (hwCheck) {
      hwCheck.checked = data.hasHighWorkCar === true;
      if (typeof highWorkSection !== 'undefined' && highWorkSection) {
        highWorkSection.classList.toggle('d-none', !hwCheck.checked);
      }
    }

    // 3. 高所作業車テーブルの明細行復元
    if (data.highWorkTable && Array.isArray(data.highWorkTable)) {
      const tableBody = document.querySelector('#highWorkSection tbody');
      if (tableBody) {
        const rows = tableBody.querySelectorAll('tr');
        data.highWorkTable.forEach((rowData, index) => {
          if (rows[index]) {
            const inputs = rows[index].querySelectorAll('input');
            if (inputs.length >= 9) {
              inputs[0].checked = rowData.selected;
              inputs[1].value = rowData.qty;
              inputs[2].value = rowData.unit;
              inputs[3].value = rowData.price;
              inputs[4].value = rowData.transport;
              inputs[5].value = rowData.totalPrice;
              inputs[6].value = rowData.subtotal;
              inputs[7].value = rowData.memo1;
              inputs[8].value = rowData.memo2;
            }
          }
        });
      }
    }

    // 4. メインテーブル（施工内容）の行復元
    const cBody = document.getElementById('constructionTableBody');
    if (cBody && data.constructionTable && Array.isArray(data.constructionTable)) {
      cBody.innerHTML = '';
      data.constructionTable.forEach(rowData => {
        if (rowData.itemName === "駐車場代") return;
        // すぐ下で定義している関数を呼び出す
        const newRow = window.createConstructionRow(rowData);
        cBody.appendChild(newRow);
      });
    }

    // 5. 駐車場代の復元
    const pkCheck = document.getElementById('parkingCheck');
    if (pkCheck) {
      pkCheck.checked = !!data.isParkingAdded;
      if (pkCheck.checked) {
        pkCheck.dispatchEvent(new Event('change'));
        setTimeout(() => {
          const pRow = document.querySelector('tr[data-item-name="駐車場代"]');
          if (pRow) {
            const qtyInp = pRow.querySelector('.parking-qty-input');
            const priceInp = pRow.querySelector('.parking-direct-input');
            if (qtyInp && data.parkingQty) qtyInp.value = data.parkingQty;
            if (priceInp && data.parkingPrice) priceInp.value = data.parkingPrice;
            qtyInp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }, 150);
      }
    }

    // 6. 全体の再計算と同期
    if (typeof updateTableNumbers === "function") updateTableNumbers();
    if (typeof syncHeaderCheckboxes === "function") syncHeaderCheckboxes();
    if (typeof updateAllDisplays === 'function') updateAllDisplays();

    // --- 🔹 A. アーク外注表（スタッフ氏名・単価等）の復元 ---
    console.log("スタッフ詳細情報の復元を開始します", data.staffList);

    if (data.staffList && Array.isArray(data.staffList)) {
      const scrollTopTable = document.getElementById('scroll-top');
      if (scrollTopTable) {
        // 各入力要素のリストを取得
        const nameInputs = scrollTopTable.querySelectorAll('thead tr:nth-child(2) input'); // 氏名
        const typeInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(1) input'); // 種類
        const priceInputs = scrollTopTable.querySelectorAll('tbody tr.row-unit-price input'); // 単価
        const transportInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(3) input'); // 交通費
        const stayInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(4) input'); // 宿泊費

        data.staffList.forEach((staff, i) => {
          if (nameInputs[i]) nameInputs[i].value = staff.name || "";
          if (typeInputs[i]) typeInputs[i].value = staff.type || "";
          if (priceInputs[i]) priceInputs[i].value = staff.unitPrice || "0";
          if (transportInputs[i]) transportInputs[i].value = staff.transport || "0";
          if (stayInputs[i]) stayInputs[i].value = staff.stay || "0";
        });
      }
    }

    // 7. 出勤簿・スケジュールの復元
    console.log("出勤簿・スケジュールの復元を開始します");

    // --- 出勤管理（〇印）の復元 ---
    if (data.attendanceTable && Array.isArray(data.attendanceTable)) {
      const attendanceRows = document.querySelectorAll('#attendance-body .attendance-row');
      data.attendanceTable.forEach((rowData, rowIndex) => {
        if (attendanceRows[rowIndex]) {
          const cells = attendanceRows[rowIndex].querySelectorAll('.attendance-cell');
          rowData.forEach((isMarked, cellIndex) => {
            const cell = cells[cellIndex];
            if (cell) {
              if (isMarked) {
                cell.textContent = '〇';
                cell.style.backgroundColor = "rgb(231, 241, 255)";
                cell.style.color = "rgb(13, 110, 253)";
                cell.style.fontWeight = "bold";
              }
            }
          });
        }
      });
    }

    // [2] 下の表の「日付」を復元する
    if (data.targetTable && Array.isArray(data.targetTable)) {
      const targetTbody = document.getElementById('target-schedule-body');
      if (targetTbody) {
        // 先に目標表の行が生成されていることを確認するために updateAttendanceCounts を一度呼ぶ
        if (typeof updateAttendanceCounts === 'function') updateAttendanceCounts();

        const rows = targetTbody.querySelectorAll('tr');
        data.targetTable.forEach((rowData, index) => {
          if (rows[index]) {
            const dateInput = rows[index].querySelector('.target-date-input');
            if (dateInput) {
              dateInput.value = rowData.date || "";
            }
          }
        });
      }
    }

    // --- 🔹 全ての復元が終わった後に、最終的な再計算を強制する 🔹 ---
    // ブラウザの描画と数値の反映を待つため、少し長めの待機時間を設けます
    setTimeout(() => {
      console.log("最終集計を開始します...");

      // 1. 【最重要】施工テーブルから「総数（台数）」を正しく拾い直す
      if (typeof updateTotalQuantity === 'function') {
        updateTotalQuantity();
      }

      // 2. 工事日数（〇印の数）と下の表の「人数表示」を確定させる
      if (typeof updateAttendanceCounts === 'function') {
        updateAttendanceCounts();
      }

      // 3. 上記1と2で確定した「正しい総数」と「正しい日数」を使って目標値を計算する
      if (typeof calculateTargets === 'function') {
        console.log("確定した数値で目標値を再計算します");
        calculateTargets();
      }

      // 4. 利益率や全体の金額表示を最終同期
      if (typeof updateAllDisplays === 'function') {
        updateAllDisplays();
      }
      if (typeof calculateLaborCosts === 'function') {
        calculateLaborCosts();
      }

      console.log("施工内容タブの全復元が完了しました");
    }, 300); // 300ミリ秒待機して確実に数値を読み込ませる

  };

  /**
   * 💡 保存データ(rowData)から施工内容テーブルの行(tr)を物理的に生成する関数
   */
  window.createConstructionRow = function (rowData) {
    const isKeisuChecked = rowData.keisu === 'on';
    const getV = (val) => (val === undefined || val === null) ? "" : val;

    if (rowData.checks) {
      lastProfitSettings = {
        check_day: !!rowData.checks.day,
        check_night: !!rowData.checks.night,
        check_high: !!rowData.checks.high,
        check_special: !!rowData.checks.special,
        check_waste: !!rowData.checks.waste,
        check_adjust: !!rowData.adjustment && rowData.adjustment !== 0
      };
    }

    const tr = document.createElement('tr');

    // 計算は行わず、保存されている数値をそのまま <td> に反映
    tr.innerHTML = `
    <td>
      <div class="d-flex justify-content-center gap-1">
        <button type="button" class="editBtn btn btn-sm btn-outline-primary">編集</button>
        <button type="button" class="deleteBtn btn btn-sm btn-outline-danger">削除</button>
      </div>
    </td>
    <td></td> <td>${getV(rowData.itemName)}</td>
    <td>${getV(rowData.touyo)}</td>
    <td class="text-end">${getV(rowData.qty)}</td>
    <td>${getV(rowData.unit)}</td>
    <td>${getV(rowData.content)}</td>
    <td class="text-end">${getV(rowData.honsu)}</td>
    <td class="text-end base-price-cell">${getV(rowData.basePrice)}</td>
    <td class="text-end profit-cell">${getV(rowData.checks?.day ? Math.round(rowData.basePrice * (parseFloat(document.getElementById('rate_day')?.value) || 0)) : 0)}</td>
    <td class="text-end profit-cell">${getV(rowData.checks?.night ? Math.round(rowData.basePrice * (parseFloat(document.getElementById('rate_night')?.value) || 0)) : 0)}</td>
    <td class="text-end profit-cell">${getV(rowData.checks?.high ? Math.round(rowData.basePrice * (parseFloat(document.getElementById('rate_high')?.value) || 0)) : 0)}</td>
    <td class="text-end profit-cell">${getV(rowData.checks?.special ? Math.round(rowData.basePrice * (parseFloat(document.getElementById('rate_special')?.value) || 0)) : 0)}</td>
    <td class="text-end profit-cell">${getV(rowData.checks?.waste ? Math.round(rowData.basePrice * (parseFloat(document.getElementById('rate_waste')?.value) || 0)) : 0)}</td>
    <td class="text-end profit-cell">${getV(rowData.adjustment)}</td>
    <td class="text-end fw-bold final-unit-price-cell">${getV(rowData.finalPrice)}</td>
    <td class="text-end fw-bold subtotal-cell">${getV(rowData.subtotal)}</td>
    <td class="text-center">
      <select class="form-select form-select-sm keisu-dropdown">
        <option value="on" ${isKeisuChecked ? 'selected' : ''}>〇</option>
        <option value="off" ${!isKeisuChecked ? 'selected' : ''}>✕</option>
      </select>
    </td>
  `;

    // 係数OFF(✕)時のスタイル調整
    if (!isKeisuChecked) {
      tr.style.backgroundColor = "#f2f2f2";
      tr.style.color = "#999";
      for (let i = 9; i <= 13; i++) {
        if (tr.cells[i]) tr.cells[i].style.opacity = "0.5";
      }
    }

    // 編集・削除などのボタンイベントを紐付け
    if (typeof assignRowEvents === "function") assignRowEvents(tr);

    return tr;
  };

  // ==========================================================================
  // ★ マスターデータ
  // ==========================================================================
  // Supabaseからマスタデータを取得する
  async function fetchMasterData() {
    try {
      const { data, error } = await supabaseClient.from('m_construction_items').select('*');

      if (error) throw error;

      masterData = data;
      console.log("マスタデータを取得しました:", masterData);
      updateItemNameOptions();
    } catch (err) {
      console.error('マスタデータの取得に失敗しました:', err);
    }
  }

  fetchMasterData();

  function updateItemNameOptions() {
    if (!itemNameOptions) return;
    itemNameOptions.innerHTML = ''; // クリア

    const selectedKoujiType = document.querySelector('input[name="koujiType"]:checked')?.value;

    if (Array.isArray(masterData)) {
      masterData.forEach(item => {
        if (item.category_type === selectedKoujiType) {
          const opt = document.createElement('option');
          opt.value = item.item_name;
          opt.dataset.price = item.default_price;
          opt.dataset.unit = item.unit;
          itemNameOptions.appendChild(opt);
        }
      });
    }
  }

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
  // 3. 高所作業車：計算・イベントロジック
  // ==========================================================================
  highWorkCarCheck?.addEventListener('change', function () {
    const warningText = document.getElementById('highWorkCarWarning');
    if (warningText) {
      warningText.style.display = this.checked ? 'inline' : 'none';
    }
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
  // 4. 値引き・A材・B材：イベントロジック
  // ==========================================================================
  aMaterialCheck?.addEventListener('change', updateAllDisplays);
  bMaterialCheck?.addEventListener('change', updateAllDisplays);
  laborSubtotal?.addEventListener('input', updateAllDisplays);

  const budgetDiscountInput = document.getElementById('budgetDiscount');

  // ==========================================================================
  // 5. 施工内容
  // ==========================================================================

  // -- イベントリスナーの登録 -- //

  // 1. 本数・小計の連動
  lightUseInput?.addEventListener('input', () => {
    if (typeof updateCount === "function") updateCount();
  });

  // 2. 基本単価の判定（照明判定ロジック含む）
  itemNameInput?.addEventListener('input', () => {
    if (typeof updateBasePrice === "function") updateBasePrice();
  });
  contentInput?.addEventListener('input', () => {
    if (typeof updateBasePrice === "function") updateBasePrice();
  });

  // 3. 工事種別ラジオボタンが切り替わったらプルダウンと計算をリセット
  document.querySelectorAll('input[name="koujiType"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (typeof updateItemNameOptions === "function") updateItemNameOptions();
      if (typeof updateCount === "function") updateCount();
      if (typeof updateBasePrice === "function") updateBasePrice();
    });
  });

  /**
   * ★ 割増率リアルタイム連動
   */
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
    const currentRates = getCurrentRates();
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
          const rateVal = currentRates[type] || 0;
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

    // 確定単価（合計）の更新
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
    if (itemNameInput) itemNameInput.value = "";
    if (contentInput) contentInput.value = "";
    if (quantityInput) quantityInput.value = "";
    if (countInput) countInput.value = "";
    if (lightUseInput) lightUseInput.value = "";
    if (basePriceInput) basePriceInput.value = "";
    if (unitInput) unitInput.value = "";

    // 微調整のリセットを追加
    const adjustCheck = document.getElementById('check_adjust');
    const adjustInput = document.querySelector('input[name="profit_adjust"]');
    if (adjustCheck) adjustCheck.checked = false;
    if (adjustInput) {
      adjustInput.value = "";
      adjustInput.disabled = true;
    }

    if (finalUnitPriceInput) {
      finalUnitPriceInput.tagName === 'INPUT' ? (finalUnitPriceInput.value = "") : (finalUnitPriceInput.textContent = "");
    }
    if (subtotalInput) {
      subtotalInput.tagName === 'INPUT' ? (subtotalInput.value = "") : (subtotalInput.textContent = "");
    }
  }

  // --- 各種イベントリスナー ---
  profitCheckIds.forEach(id => {
    document.getElementById(id)?.addEventListener('change', function () {
      calculateModalProfits();
    });
  });

  openModalBtn?.addEventListener('click', function () {
    editingRow = null; // 編集モード解除
    if (constructionForm) constructionForm.reset(); // フォームリセット
    if (modalTitle) modalTitle.textContent = '新規入力:施工内容';
    if (registerBtn) registerBtn.textContent = "登録";

    // 保存されている直前の設定（高所など）をモーダルに自動反映
    profitCheckIds.forEach(id => {
      const chk = document.getElementById(id);
      if (chk) {
        // lastProfitSettingsから前回の値を復元（true or false）
        chk.checked = !!lastProfitSettings[id];
        // 設定が変わったことを通知して、金額計算(calculateModalProfits)を走らせる
        chk.dispatchEvent(new Event('change'));
      }
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

  /**
  * ★ 本数・数量の計算
  */
  function updateCount() {
    if (!countInput) return;

    const koujiType = document.querySelector('input[name="koujiType"]:checked')?.value?.trim();

    // 1. 空調工事の場合は本数を空にする
    if (koujiType === "空調工事") {
      countInput.value = "";
    } else {
      // 2. 数値の取得（電気工事等の場合）
      const lightUse = parseFloat(lightUseInput?.value) || 0;
      const quantity = parseFloat(quantityInput?.value) || 0;

      // 3. 計算実行
      countInput.value = (quantity !== 0) ? (lightUse * quantity) : "";
    }

    // 【重要】数量が変わったので、小計(subtotal)を再計算させる
    updateModalSubtotal();
  }

  /**
   * ★ 基本単価の自動判定（照明判定ロジック復活版）
   */
  function updateBasePrice() {
    if (!itemNameInput || !basePriceInput) return;

    const selectedItem = itemNameInput.value.trim();
    const selectedContent = contentInput?.value?.trim();

    if (selectedItem === "") {
      basePriceInput.value = "";
      if (unitInput) unitInput.value = "";
      calculateModalProfits();
      return;
    }

    let calculatedPrice = 0;

    // --- 照明40W/20W の判定（文字列で直接比較） ---
    if (selectedItem === "照明 40W" || selectedItem === "照明 20W") {
      if (selectedContent === "交換工事") {
        calculatedPrice = 3500;
      } else {
        calculatedPrice = 1500;
      }
    }
    // --- それ以外は datalist からマスタ単価を探す ---
    else {
      const options = itemNameOptions?.querySelectorAll('option');
      options?.forEach(opt => {
        if (opt.value === selectedItem) {
          calculatedPrice = parseFloat(opt.dataset.price) || 0;
          if (unitInput && opt.dataset.unit) {
            unitInput.value = opt.dataset.unit;
          }
        }
      });
    }

    basePriceInput.value = calculatedPrice || "";
    calculateModalProfits();
  }

  /**
    * ★ モーダルが閉じられた時のリセット処理
    */
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

  /**
    * ★ 各入力要素のリアルタイム連動イベント設定
    */
  // 汎用的な変換・再計算関数
  function handleNumericInput(el, callback) {
    let isComposing = false;

    el.addEventListener('compositionstart', () => isComposing = true);
    el.addEventListener('compositionend', function () {
      isComposing = false;
      // 変換確定後に一拍置いてから処理
      setTimeout(() => {
        // 1. 全角を半角に
        let val = this.value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        // 2. 数字とドット以外を削除（これで変な文字混入を防ぐ）
        this.value = val.replace(/[^0-9.]/g, '');
        if (callback) callback();
      }, 10);
    });

    el.addEventListener('input', function () {
      if (isComposing) return;
      // 半角入力時も、数字以外が混じったら掃除する
      if (/[^0-9.]/.test(this.value)) {
        this.value = this.value.replace(/[^0-9.]/g, '');
      }
      if (callback) callback();
    });

    el.addEventListener('blur', function () {
      let val = this.value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
      this.value = val.replace(/[^0-9.]/g, '');
      if (callback) callback();
    });
  }

  // --- 基本単価への適用 ---
  if (basePriceInput) {
    handleNumericInput(basePriceInput, () => {
      calculateModalProfits();
    });
  }

  // --- 台数/数量への適用 ---
  if (quantityInput) {
    handleNumericInput(quantityInput, () => {
      updateCount();
      updateModalSubtotal();
    });
  }

  // その他の既存処理（変更なし）
  document.querySelectorAll('[id^="rate_"]').forEach(el => el.addEventListener('input', calculateModalProfits));
  itemNameSelect?.addEventListener('input', updateBasePrice);
  contentInput?.addEventListener('input', updateBasePrice);

  /**
  * ★ 登録・編集完了ボタンの処理
  */
  registerBtn?.addEventListener('click', function (e) {
    e.preventDefault();

    const item = itemNameInput?.value || '';
    const qty = quantityInput?.value || '';
    const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');
    const unit = unitInput?.value || '';
    const content = contentInput?.value || '';
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

    document.querySelectorAll('[id^="rate_"]').forEach(rateInput => {
      rateInput.addEventListener('input', function () {
        const currentRates = getCurrentRates();
        const currentHeaderChecks = {};
        document.querySelectorAll('thead .coeffCheck').forEach(cb => {
          currentHeaderChecks[cb.getAttribute('data-type')] = cb.checked;
        });

        Array.from(constructionTableBody.rows).forEach(row => {
          if (row.getAttribute('data-item-name') === '駐車場代' || row.cells.length < 17) return;

          const basePrice = parseFloat(row.cells[8].textContent) || 0;
          const qty = parseFloat(row.cells[4].textContent) || 0;
          const adjust = parseFloat(row.cells[14].textContent) || 0;
          const keisuSelect = row.querySelector('.keisu-dropdown');

          const colMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13 };
          Object.keys(colMap).forEach(type => {
            if (currentHeaderChecks[type]) {
              row.cells[colMap[type]].textContent = Math.round(basePrice * currentRates[type]);
            }
          });

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

  /**
    * ★ 操作（編集・削除）および表の係数（〇✕）連動
    */
  function assignRowEvents(row) {
    if (!row) return;

    // --- 1. 削除ボタン：挙動の安定化 ---
    row.querySelector('.deleteBtn')?.addEventListener('click', function (e) {
      e.stopPropagation();
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
      editingRow = row;

      // モーダルのタイトルとボタン名を変更
      const modalTitle = document.querySelector('#constructionModal .modal-title');
      if (modalTitle) modalTitle.textContent = "編集中：施工内容";
      if (registerBtn) registerBtn.textContent = "更新完了";

      // --- 表のセルから入力欄へ値をコピー ---
      if (itemNameInput) itemNameInput.value = row.cells[2].textContent;   // 項目名
      if (lightUseInput) lightUseInput.value = row.cells[3].textContent;    // 灯用
      if (quantityInput) quantityInput.value = row.cells[4].textContent;    // 台数/本数

      const unitSelect = document.getElementById('unitSelect') || document.querySelector('[name="unit"]');
      if (unitInput) unitInput.value = row.cells[5].textContent;       // 単位

      if (contentInput) contentInput.value = row.cells[6].textContent;    // 内容
      if (countInput) countInput.value = row.cells[7].textContent;       // 本数
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

  /**
    * ★ ヘッダーのチェックボックス切り替え：全行の数値 + 係数(〇✕)を連動
    */
  document.querySelectorAll('thead .coeffCheck').forEach(headerCb => {
    headerCb.addEventListener('change', function () {
      const type = this.getAttribute('data-type');
      if (type === 'adjust') return;

      const colIndexMap = { 'day': 9, 'night': 10, 'high': 11, 'special': 12, 'waste': 13 };
      const colIndex = colIndexMap[type];

      const currentRates = getCurrentRates();

      Array.from(constructionTableBody.rows).forEach(row => {
        if (row.getAttribute('data-item-name') === '駐車場代' || row.cells.length < 17) return;

        const basePrice = parseFloat(row.cells[8].textContent) || 0;
        const qty = parseFloat(row.cells[4].textContent) || 0;
        const adjust = parseFloat(row.cells[14].textContent) || 0;
        const keisuSelect = row.querySelector('.keisu-dropdown');

        // 1. 該当する列の金額を更新
        if (this.checked) {
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

  /**
  * ★ 駐車場代ロジック等
  */
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

      updateLaborSubtotal(); // 全体の合計金額を更新
      updateTotalQuantity(); // 全体の総数を更新
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
  // 6. 単価セクション（原価・利益計算）
  // ==========================================================================
  function updateUnitPriceSection() {
    const getNum = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;

      // input要素ならvalueを、div等ならtextContentを取得
      const valStr = el.tagName === 'INPUT' ? el.value : el.textContent;
      if (!valStr) return 0;

      if (typeof parseCurrency === 'function') {
        return parseCurrency(valStr);
      } else {
        return parseFloat(valStr.replace(/[^0-9.-]/g, '')) || 0;
      }
    };

    const setVal = (id, val, isPercent = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isPercent) {
        el.value = val.toFixed(1) + "%";
      } else {
        // 🔹 金額表示：マイナスの場合は赤文字、それ以外は通常色（#212529）
        el.value = "￥" + Math.round(val).toLocaleString();
        el.style.setProperty('color', val < 0 ? "#dc3545" : "#212529", 'important');
      }
    };

    // 🔹 背景色を変更するための補助関数（!importantを付けてHTMLの直接指定を上書き）
    const updateBgColorByRate = (el, rate) => {
      if (!el) return;
      const value = rate / 100; // パーセントを小数に変換

      let bgColor = "#f1f3f5"; // デフォルト・範囲外（グレー）
      let textColor = "#212529";

      if (value >= 0.3) {
        bgColor = "#9dd2f9"; // 青 (明るいブルー)
      } else if (value >= 0.25) {
        bgColor = "#ffc4d8"; // ピンク
      } else if (value >= 0.2) {
        bgColor = "#fff9bc"; // 黄色
      } else if (value >= 0.15) {
        bgColor = "#ffe2b4"; // オレンジ
      } else if (value < 0) {
        bgColor = "#fbb9c3"; // 赤字（マイナス時）
        textColor = "#dc3545";
      }

      // HTML側の !important よりも優先させるために setProperty を使用
      el.style.setProperty('background-color', bgColor, 'important');
      el.style.setProperty('color', textColor, 'important');
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


    // --- 5. 高所作業車等 ---
    const highWorkEl = document.getElementById('highAltitudeVehicleCost');
    const highWorkPercentEl = document.getElementById('highAltitudeVehiclePercentage');
    const highWorkAlert = document.getElementById('highWorkAlert');

    // 手入力された金額を取得
    let highWorkCost = getNum('highAltitudeVehicleCost');

    // 提出見積金額を使って％を計算
    let highWorkPct = 0;
    if (totalEstimate > 0) {
      highWorkPct = (highWorkCost / totalEstimate) * 100;
    }

    // 表示の更新
    if (document.activeElement !== highWorkEl) {
      if (highWorkEl.value !== "") {
        setVal('highAltitudeVehicleCost', highWorkCost);
      }
    }

    // パーセンテージを表示
    if (highWorkPercentEl) {
      highWorkPercentEl.value = highWorkPct.toFixed(1) + "%";
    }

    // 赤文字アラートの表示条件
    const autoCalcTotal = getNum('displayHighWorkTotal');
    if (highWorkAlert) {
      if (autoCalcTotal > 0 && highWorkCost === 0) {
        highWorkAlert.style.setProperty('display', 'inline', 'important');
      } else {
        highWorkAlert.style.setProperty('display', 'none', 'important');
      }
    }

    // --- 6. 商品・器具 ---
    const productCost = getNum('displayMaterialA'); // A材の合計
    setVal('productEquipmentCost', productCost);
    setVal('productEquipmentPercentage', totalEstimate > 0 ? (productCost / totalEstimate * 100) : 0, true);

    // --- 7. アーク利益 ---
    const arcProfitPctEl = document.getElementById('arcProfitPercentage');
    const totalCosts = totalLaborSum + wasteAmount + totalOverheadB + highWorkCost + productCost;
    const profitAmount = totalEstimate > 0 ? (totalEstimate - totalCosts) : 0;
    const arcProfitRate = totalEstimate > 0 ? (profitAmount / totalEstimate * 100) : 0;

    setVal('arcProfit', profitAmount);
    setVal('arcProfitPercentage', arcProfitRate, true);

    // 🔹 アーク利益率の背景色更新
    updateBgColorByRate(arcProfitPctEl, arcProfitRate);

    // --- 8. 報酬金 ---
    let reward = 0;
    let rewardPct = 0;

    if (profitAmount >= 100000) {
      reward = Math.floor((profitAmount * 0.01) / 1000) * 1000;
      if (profitAmount > 0) {
        rewardPct = (reward / profitAmount) * 100;
      }
    }

    // --- 9. 工事のみ利益 ---
    const constructionProfitEl = document.getElementById('constructionOnlyProfit');
    const constructionPctEl = document.getElementById('constructionOnlyPercentage');
    const aMaterialCheck = document.getElementById('aMaterialCheck');

    const laborRev = getNum('displayLaborTotal');
    const discount = getNum('budgetDiscount');
    const highWorkRev = getNum('displayHighWorkTotal');

    let constructionProfit = 0;
    let constructionPct = 0;

    if (aMaterialCheck && aMaterialCheck.checked) {
      const totalRev = laborRev + discount + highWorkRev;
      const totalCost = totalLaborSum + highWorkCost + wasteAmount + totalOverheadB;

      constructionProfit = totalRev - totalCost;

      if (totalRev !== 0) {
        constructionPct = (constructionProfit / totalRev) * 100;
      }
    } else {
      constructionProfit = profitAmount;
      constructionPct = arcProfitRate;
    }

    // 表示の反映
    setVal('constructionOnlyProfit', constructionProfit);

    if (constructionPctEl) {
      constructionPctEl.value = constructionPct.toFixed(1) + "%";
      // 🔹 工事のみ利益率の背景色更新
      updateBgColorByRate(constructionPctEl, constructionPct);
    }

    // --- 10. 商品のみ利益 ---
    const productProfitEl = document.getElementById('productOnlyProfit');
    const productPctEl = document.getElementById('productOnlyPercentage');

    // 式: 提出見積 - (人工・外注費 + 高所等 + 商品器具 + 産廃)
    const productOnlyProfit = totalEstimate - (totalLaborSum + highWorkCost + productCost + wasteAmount);

    // 表示の反映
    setVal('productOnlyProfit', productOnlyProfit);

    if (productPctEl) {
      if (aMaterialCheck && aMaterialCheck.checked) {
        const aTotalProfit = getNum('a-totalProfit');
        const aTotalAmount = getNum('a-totalAmount');
        if (aTotalAmount > 0) {
          const pPct = (aTotalProfit / aTotalAmount) * 100;
          productPctEl.value = pPct.toFixed(1) + "%";
          productPctEl.style.color = pPct < 0 ? "#dc3545" : "#212529";
        } else {
          productPctEl.value = "0.0%";
        }
      } else {
        productPctEl.value = "";
        productPctEl.style.setProperty('background-color', '#f1f3f5', 'important');
      }
    }

    // 報酬金の表示反映
    const rewardInput = document.getElementById('rewardAmount');
    const rewardPctInput = document.getElementById('rewardPercentage');

    if (rewardInput) {
      // 報酬金計算（10万円未満なら非表示、そうでなければsetValで赤字判定込表示）
      if (profitAmount >= 100000) {
        setVal('rewardAmount', reward);
      } else {
        rewardInput.value = "";
      }
    }
    if (rewardPctInput) {
      rewardPctInput.value = profitAmount >= 100000 ? rewardPct.toFixed(1) + "%" : "";
    }
  }

  // --- 監視役の追加 ---
  document.getElementById('highAltitudeVehicleCost')?.addEventListener('input', updateUnitPriceSection);
  document.getElementById('highAltitudeVehicleCost')?.addEventListener('blur', updateUnitPriceSection);
  document.getElementById('aMaterialCheck')?.addEventListener('change', updateUnitPriceSection);
  document.getElementById('budgetDiscount')?.addEventListener('input', updateUnitPriceSection);
  document.getElementById('finalEstimatedPrice')?.addEventListener('input', updateUnitPriceSection);
  document.querySelectorAll('.a-material-input').forEach(input => {
    input.addEventListener('input', updateUnitPriceSection);
  });

  // ==========================================================================
  // 7. 工事日数表（自動計算・集計・行操作）
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

      // --- 交通費のロジック修正 ---
      if (index < 5) {
        const transportInput = transportRow?.querySelectorAll('input')[index];
        if (transportInput) {
          // 手入力（is-manualクラス）がない場合のみ自動入力
          if (!transportInput.classList.contains('is-manual')) {
            transportInput.value = (totalDays > 0) ? 5000 : 0;
          }

          // もし人数が0になったら、手入力フラグを解除してリセット
          if (totalDays === 0) {
            transportInput.classList.remove('is-manual');
            transportInput.value = 0;
          }
        }
      }

      const getVal = (row) => {
        const input = row?.querySelectorAll('input')[index];
        // toLocaleStringなどのカンマを除去して数値化
        return parseInt(input?.value.replace(/[^0-9]/g, '') || "0");
      };

      const unitPrice = getVal(unitPriceRow);
      const transport = getVal(transportRow);
      const stay = getVal(stayRow);

      let finalTotal = 0;

      if (totalDays > 0) {
        if (index < 5) {
          // 自社：単価 × 人数（自社も交通費などを含めるならここを調整）
          finalTotal = unitPrice * totalDays;
        } else {
          // 外注：(単価 × 人数) + 交通費 + 宿泊費
          finalTotal = (unitPrice * totalDays) + transport + stay;
        }
      } else {
        finalTotal = 0;
      }

      const totalInput = totalRow?.querySelectorAll('input')[index];
      if (totalInput) {
        totalInput.value = finalTotal > 0 ? finalTotal.toLocaleString() : "0";
      }
    });

    updateUnitPriceSection();
  }

  // --- 手入力を検知するためのイベントリスナーを追加 ---
  document.querySelectorAll('.bg-orange-row:nth-of-type(3) input').forEach(input => {
    input.addEventListener('input', (e) => {
      // ユーザーが直接入力したら「is-manual」クラスを付与
      e.target.classList.add('is-manual');
    });
  });

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
        calculateTargets();
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

  // --- 指定された行を起点に、それ以降の行の日付を翌日連鎖させる ---
  function syncDatesFromRow(startIndex) {
    const targetRows = document.querySelectorAll('#target-schedule-body tr');
    if (!targetRows[startIndex]) return;

    const dateInput = targetRows[startIndex].querySelector('.target-date-input');
    // 現在の入力値をパース（曜日付きでも日付のみでも対応）
    let currentStr = dateInput.value.split('(')[0].trim().replace(/\//g, '-');
    let baseDate = new Date(currentStr);

    if (isNaN(baseDate.getTime())) return;

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
      firstDateInput.value = e.target.value;
      syncDatesFromRow(0);
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
  // 8. 反映処理ロジック
  // ==========================================================================
  // --- 画面上の全ての金額表示と最終合計金額（提出見積金額）を更新するメイン関数 ---
  function updateAllDisplays() {
    // 労務費（小計）を数値として取得
    const rawLabor = parseCurrency(laborSubtotal?.value || "0");

    // --- 現調費の自動判定（表示のみ更新し、最終合計には加算しない） ---
    const surveyFeeInput = document.getElementById('surveyFee');
    if (surveyFeeInput && window.isSurveyFeeManual === false) {
      if (rawLabor > 0) {
        surveyFeeInput.value = (rawLabor <= 50000) ? 5000 : 10000;
      } else {
        surveyFeeInput.value = 0;
      }
    }

    // 手入力されたらフラグを立てる
    if (surveyFeeInput && !surveyFeeInput.dataset.listenerAdded) {
      surveyFeeInput.addEventListener('input', () => {
        window.isSurveyFeeManual = true; // 手入力モードに切り替え
        console.log("現調費が手動入力されました。自動計算をオフにします。");
      });
      // 二重登録防止用のフラグ
      surveyFeeInput.dataset.listenerAdded = "true";
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

    // 入力値が正の数であっても、計算上は値引き（マイナス）
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
  updateItemNameOptions();

  // --- ページ読み込み完了後に、各入力フィールドへのイベント設定 ---
  const surveyFeeInput = document.getElementById('surveyFee');

  [budgetDiscountInput, surveyFeeInput].forEach(input => {
    if (!input || input.type === 'date' || input.classList.contains('flatpickr-input')) return;

    let previousValue = "";

    // 1.入力した瞬間に「手動フラグ」を立てる
    input.addEventListener('input', function () {
      if (this.id === 'surveyFee') {
        window.isSurveyFeeManual = true;
        console.log("現調費を手動ロックしました");
      }
    });

    input.addEventListener('focus', function () {
      previousValue = this.value;
      const val = this.value.replace(/[^0-9-]/g, '');
      if (val === "0" || val === "-0" || val === "") {
        this.value = '';
      }
    });

    input.addEventListener('blur', function () {
      // 2.値が変更されていたら手動フラグを確定させる
      if (this.id === 'surveyFee' && this.value !== previousValue) {
        window.isSurveyFeeManual = true;
      }

      // 未入力やマイナスのみの場合は前の値に戻す（既存ロジック維持）
      if (this.value.trim() === '' || this.value === '-') {
        this.value = previousValue;
      }

      // それでも空なら0にする（既存ロジック維持）
      if (this.value.trim() === '') {
        this.value = '0';
      }

      // 3. 全体再計算を呼び出す
      // ここで updateAllDisplays が呼ばれますが、
      // 手動フラグが true なので自動上書きはスルーされます。
      if (typeof updateAllDisplays === 'function') {
        updateAllDisplays();
      }
    });
  });
  // --- ツールチップを有効化する ---
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

});