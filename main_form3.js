/**
 * main_form3.js 
 * 役割：【A材（商品）・B材（消耗品）】の明細管理と自動計算
 * 主な処理：モーダルによる材料明細の登録・編集、売価係数（利益率）に基づく一括再計算、
 * B材の自動生成ロジック（工事種類連動）、および保存データの整合性を保った復元制御。
 */

// 復元処理中かどうかを判定するフラグ
let isRestoring = false;

document.addEventListener("DOMContentLoaded", () => {
  // A材(prefix: 'a')とB材(prefix: 'b')の各フォームを初期化
  setupMaterialForm('a');
  setupMaterialForm('b');

  // ★ A材：売価係数が変更された際の一括更新イベント
  const aCoeffInput = document.getElementById('a-sell-coefficient');
  if (aCoeffInput) {
    aCoeffInput.addEventListener('input', () => {
      updateAllAItemsByCoefficient();
    });
  }
});

/**
 * 材別のフォーム制御メイン関数
 */
function setupMaterialForm(prefix) {
  const form = document.getElementById(`${prefix}-inputForm`);
  const tableBody = document.getElementById(`${prefix}-itemTableBody`);
  const modalElement = document.getElementById(`${prefix}-inputModal`);

  if (!form || !tableBody || !modalElement) return;

  let editRow = null;

  // 🔹 モーダルが閉じられた時に状態を完全にクリアする
  modalElement.addEventListener('hidden.bs.modal', function () {
    editRow = null; // 編集状態をクリア
    form.reset();   // 入力値をリセット
    const modalTitle = modalElement.querySelector(".modal-title");
    if (modalTitle) modalTitle.textContent = "入力"; // タイトルを初期化
  });

  // --- 🔹 テーブルのNoを上から順に振り直すヘルパー ---
  // 外から呼べるように公開
  window[`renumberRows_${prefix}`] = function () {
    const rows = tableBody.querySelectorAll("tr:not(:has(td[colspan]))");
    rows.forEach((row, index) => {
      row.cells[1].textContent = index + 1;
    });
  }

  // --- 🔹 次のNoを計算（新規入力用） ---
  function getNextNumber() {
    const rows = tableBody.querySelectorAll("tr:not(:has(td[colspan]))");
    // A材は1から、B材は自動生成があれば2から、なければ1から
    return rows.length + 1;
  }

  // --- 0. モーダル起動時の初期化設定（新規入力ボタン） ---
  const addButtons = document.querySelectorAll(`[data-bs-target="#${prefix}-inputModal"]`);
  addButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      editRow = null;
      form.reset();

      const modalTitle = modalElement.querySelector(".modal-title");
      const submitBtn = form.querySelector('button[type="submit"]');

      // 🔹 常に「現在の行数 + 1」を計算して表示
      const nextNo = getNextNumber();
      if (modalTitle) modalTitle.textContent = `新規入力：${prefix.toUpperCase()}材 (No.${nextNo})`;
      if (submitBtn) submitBtn.textContent = "登録完了";
    });
  });

  // --- 1. 登録・更新処理（モーダルの「登録」ボタンが押された時） ---
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // モーダル内の各入力値を取得
    const data = {
      name: document.getElementById(`${prefix}-modal-name`).value,
      spec: document.getElementById(`${prefix}-modal-spec`).value,
      quantity: Number(document.getElementById(`${prefix}-modal-quantity`).value),
      unit: document.getElementById(`${prefix}-modal-unit`).value,
      unitPrice: Number(document.getElementById(`${prefix}-modal-unitPrice`).value),
      remark: document.getElementById(`${prefix}-modal-remark`).value,
      listPrice: Number(document.getElementById(`${prefix}-modal-listPrice`).value),
      listTotal: document.getElementById(`${prefix}-modal-listTotal`).value,
      costPrice: Number(document.getElementById(`${prefix}-modal-costPrice`).value),
      costTotal: document.getElementById(`${prefix}-modal-costTotal`).value,
      costRate: document.getElementById(`${prefix}-modal-costRate`).value,
      sellRate: document.getElementById(`${prefix}-modal-sellRate`).value,
      itemName: document.getElementById(`${prefix}-modal-itemName`).value,
      actual: document.getElementById(`${prefix}-modal-actual`).value,
      company: document.getElementById(`${prefix}-modal-company`).value
    };

    // 売上金額の計算
    data.amount = data.quantity * data.unitPrice;

    // 「データがありません」という初期行があれば削除
    const emptyRow = tableBody.querySelector('td[colspan]');
    if (emptyRow) { tableBody.innerHTML = ''; }

    // 新規登録時はその時点の最大No+1を割り振る
    const currentNo = editRow ? editRow.cells[1].textContent : getNextNumber();

    // テーブルに挿入するHTMLの組み立て
    const rowHtml = `
      <td>
        <div class="d-flex justify-content-center gap-1">
          <button type="button" class="editBtn btn btn-sm btn-outline-primary">編集</button>
          <button type="button" class="deleteBtn btn btn-sm btn-outline-danger">削除</button>
        </div>
      </td>
      <td>${currentNo}</td>
      <td>${data.name}</td>
      <td>${data.spec}</td>
      <td class="text-end">${data.quantity.toLocaleString()}</td>
      <td>${data.unit}</td>
      <td class="text-end">${data.unitPrice.toLocaleString()}</td>
      <td class="text-end">${data.amount.toLocaleString()}</td>
      <td>${data.remark}</td>
      <td class="text-end">${data.listPrice.toLocaleString()}</td>
      <td class="text-end">${data.listTotal}</td>
      <td class="text-end">${data.costPrice.toLocaleString()}</td>
      <td class="text-end">${data.costTotal}</td>
      <td class="text-end">${data.costRate}</td>
      <td class="text-end">${data.sellRate}</td>
      <td>${data.itemName}</td>
      <td>${data.actual}</td>
      <td>${data.company}</td>
    `;

    // --- 1. 登録・更新処理の最後の方 ---
    if (editRow) {
      // 編集モード
      editRow.innerHTML = rowHtml;
      attachRowEvents(editRow, prefix);
      editRow = null;
    } else {
      // 新規モード
      const newRow = document.createElement("tr");
      if (data.remark === "※自動生成データ") {
        newRow.classList.add("initial-data-row");
      }
      newRow.innerHTML = rowHtml;
      tableBody.appendChild(newRow);
      attachRowEvents(newRow, prefix);
    }

    window[`renumberRows_${prefix}`](); // 🔹 ここで番号を綺麗に振り直す
    calculateTotals(prefix);

    // モーダルを閉じる
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) modalInstance.hide();
    form.reset();
  });

  // --- 2. 編集・削除ボタンのイベント登録 ---
  // window.をつけて外から呼べるように定義
  window.attachRowEvents = function (row, prefix) {
    // 編集ボタン：行のデータを取り出してモーダルにセット
    const editBtn = row.querySelector(".editBtn");
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        // 現在の prefix フォームの modalElement を参照
        const targetModal = document.getElementById(`${prefix}-inputModal`);
        editRow = row;
        const cells = row.children;
        // 🔹 追加：編集時はその行の「現在のNo」をタイトルに表示する
        const currentNo = cells[1].textContent;
        const modalTitle = targetModal.querySelector(".modal-title");
        if (modalTitle) modalTitle.textContent = `編集：${prefix.toUpperCase()}材 (No.${currentNo})`;
        document.getElementById(`${prefix}-modal-name`).value = cells[2].textContent;
        document.getElementById(`${prefix}-modal-spec`).value = cells[3].textContent;
        document.getElementById(`${prefix}-modal-quantity`).value = cells[4].textContent;
        document.getElementById(`${prefix}-modal-unit`).value = cells[5].textContent;
        document.getElementById(`${prefix}-modal-unitPrice`).value = cells[6].textContent.replace(/,/g, '');
        document.getElementById(`${prefix}-modal-remark`).value = cells[8].textContent;
        document.getElementById(`${prefix}-modal-listPrice`).value = cells[9].textContent.replace(/,/g, '');
        document.getElementById(`${prefix}-modal-costPrice`).value = cells[11].textContent.replace(/,/g, '');
        document.getElementById(`${prefix}-modal-itemName`).value = cells[15].textContent;
        document.getElementById(`${prefix}-modal-actual`).value = cells[16].textContent;
        document.getElementById(`${prefix}-modal-company`).value = cells[17].textContent;

        const modalInstance = new bootstrap.Modal(targetModal);
        modalInstance.show();
      });
    }

    // 削除ボタン
    const deleteBtn = row.querySelector(".deleteBtn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        if (confirm("本当に削除しますか？")) {
          row.remove();
          if (window[`renumberRows_${prefix}`]) window[`renumberRows_${prefix}`](); // 🔹 削除された後も番号を詰め直す
          calculateTotals(prefix);
        }
      });
    }
  }

  // --- 3. 合計計算処理（テーブル全体の集計） ---
  // window.をつけて外から呼べるように定義
  window.calculateTotals = function (prefix) {
    const targetTableBody = document.getElementById(`${prefix}-itemTableBody`);
    if (!targetTableBody) return;
    const rows = targetTableBody.querySelectorAll("tr");
    let tAmount = 0, tList = 0, tCost = 0;

    rows.forEach(row => {
      const cells = row.children;
      if (cells.length < 18 || row.querySelector('td[colspan]')) return;
      tAmount += parseFloat(cells[7].textContent.replace(/[^0-9.-]+/g, "")) || 0;
      tList += parseFloat(cells[10].textContent.replace(/[^0-9.-]+/g, "")) || 0;
      tCost += parseFloat(cells[12].textContent.replace(/[^0-9.-]+/g, "")) || 0;
    });

    const profit = tAmount - tCost;

    // 各合計ラベルに数値を反映（カンマ区切り）
    const totalAmtEl = document.getElementById(`${prefix}-totalAmount`);
    if (totalAmtEl) totalAmtEl.textContent = `¥${tAmount.toLocaleString()}`;

    const totalListEl = document.getElementById(`${prefix}-totalListPrice`);
    if (totalListEl) totalListEl.textContent = `¥${tList.toLocaleString()}`;

    const totalCostEl = document.getElementById(`${prefix}-totalCostPrice`);
    if (totalCostEl) totalCostEl.textContent = `¥${tCost.toLocaleString()}`;

    const costRateEl = document.getElementById(`${prefix}-totalCostRate`);
    if (costRateEl) costRateEl.textContent = tList ? (tCost / tList * 100).toFixed(2) + "%" : "0%";

    const sellRateEl = document.getElementById(`${prefix}-totalSellRate`);
    if (sellRateEl) sellRateEl.textContent = tList ? (tAmount / tList * 100).toFixed(2) + "%" : "0%";

    const profitEl = document.getElementById(`${prefix}-totalProfit`);
    if (profitEl) profitEl.textContent = `¥${profit.toLocaleString()}`;

    const profitRateEl = document.getElementById(`${prefix}-totalProfitRate`);
    if (profitRateEl) profitRateEl.textContent = tAmount ? (profit / tAmount * 100).toFixed(2) + "%" : "0%";

    // 予算書などの外部表示と同期
    if (window.syncMaterialTotals) window.syncMaterialTotals();

    // チェックが入っている場合、変更を即座に外部（施工内容側）へ通知する
    const materialCheck = document.getElementById(`${prefix}MaterialCheck`);
    if (materialCheck && materialCheck.checked) {
      materialCheck.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // --- 4. モーダル内共通計算ロジック（入力中の自動計算） ---
  function updateAutoFields(e) {
    const qty = Number(document.getElementById(`${prefix}-modal-quantity`).value);
    const list = Number(document.getElementById(`${prefix}-modal-listPrice`).value);
    const uprice = Number(document.getElementById(`${prefix}-modal-unitPrice`).value);
    const cost = Number(document.getElementById(`${prefix}-modal-costPrice`).value);
    const actualStr = document.getElementById(`${prefix}-modal-actual`).value;

    const amtEl = document.getElementById(`${prefix}-modal-amount`);
    if (amtEl) amtEl.value = (uprice * qty) || "";

    const costTotEl = document.getElementById(`${prefix}-modal-costTotal`);
    if (costTotEl) costTotEl.value = (actualStr !== "") ? (cost * Number(actualStr)) : (cost * qty);

    const listTotEl = document.getElementById(`${prefix}-modal-listTotal`);
    if (listTotEl) listTotEl.value = (list > 0) ? (list * qty) : "";

    const cRateEl = document.getElementById(`${prefix}-modal-costRate`);
    const sRateEl = document.getElementById(`${prefix}-modal-sellRate`);
    if (list > 0) {
      if (cRateEl) cRateEl.value = ((cost / list) * 100).toFixed(2) + "%";
      if (sRateEl) sRateEl.value = ((uprice / list) * 100).toFixed(2) + "%";
    } else {
      if (cRateEl) cRateEl.value = "";
      if (sRateEl) sRateEl.value = "";
    }
  }

  // 全材料共通の入力監視イベント設定
  const fieldsToWatch = ['quantity', 'listPrice', 'unitPrice', 'costPrice', 'actual'];
  fieldsToWatch.forEach(f => {
    const el = document.getElementById(`${prefix}-modal-${f}`);
    if (el) {
      el.addEventListener("input", (e) => {
        if (prefix === 'a') return; // A材は専用ロジックがあるためスキップ
        updateAutoFields(e);
      });
    }
  });

  // --- 5. A材専用：入力時の連動（スイッチ・バッジテキスト・ツールチップ連動版） ---
  if (prefix === 'a') {
    /**
     * 売価係数（1.3など）に合わせてバッジとはてなアイコンのテキストを更新する
     */
    function updateAMaterialLabels() {
      const coeffInput = document.getElementById('a-sell-coefficient');
      const val = coeffInput ? (parseFloat(coeffInput.value) || 1.3) : 1.3;
      const newText = `下のスイッチがONなら「入値 × ${val}」で自動算出されます。OFFにすると好きな金額を入力・固定できます。`;

      const badge = document.querySelector('label[for="a-auto-unit-check"] .badge');
      if (badge) badge.textContent = `入値×${val}`;

      const icon = document.getElementById('a-unit-tooltip-icon');
      if (icon) {
        icon.setAttribute('title', newText);
        icon.setAttribute('data-bs-original-title', newText);
        if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
          let instance = bootstrap.Tooltip.getInstance(icon);
          if (instance) {
            instance._config.title = newText;
          } else {
            new bootstrap.Tooltip(icon);
          }
        }
      }
    }

    // A材専用：入力フィールド連動
    const aFields = ['quantity', 'listPrice', 'unitPrice', 'costPrice', 'actual'];
    aFields.forEach(f => {
      const el = document.getElementById(`a-modal-${f}`);
      if (el) {
        el.addEventListener("input", (e) => {
          const coeffInput = document.getElementById('a-sell-coefficient');
          const coefficient = coeffInput ? (parseFloat(coeffInput.value) || 1.3) : 1.3;

          const listPriceInput = document.getElementById('a-modal-listPrice');
          const costInput = document.getElementById('a-modal-costPrice');
          const unitPriceInput = document.getElementById('a-modal-unitPrice');
          const qtyInput = document.getElementById('a-modal-quantity');
          const actualInput = document.getElementById('a-modal-actual');

          const isAutoCost = document.getElementById('a-auto-cost-check')?.checked;
          const isAutoUnit = document.getElementById('a-auto-unit-check')?.checked;

          if (f === 'listPrice') {
            const listValue = Number(el.value);
            if (listValue > 0 && isAutoCost && costInput) {
              costInput.value = Math.floor(listValue * 0.2);
              if (isAutoUnit && unitPriceInput) {
                unitPriceInput.value = Math.ceil((Number(costInput.value) * coefficient) / 100) * 100;
              }
            }
          }

          if (f === 'costPrice' && isAutoUnit && unitPriceInput) {
            const costValue = Number(el.value);
            if (costValue > 0) {
              unitPriceInput.value = Math.ceil((costValue * coefficient) / 100) * 100;
            }
          }

          updateAutoFields(e);
        });
      }
    });

    // スイッチの連動
    const aToggles = ['a-auto-unit-check', 'a-auto-cost-check'];
    aToggles.forEach(id => {
      const checkEl = document.getElementById(id);
      if (checkEl) {
        checkEl.addEventListener('change', function () {
          const label = document.querySelector(`label[for="${id}"]`);
          const badge = label ? label.querySelector('.badge') : null;
          if (badge) {
            if (this.checked) {
              badge.style.setProperty('border-color', '#0d6efd', 'important');
              badge.style.setProperty('color', '#0d6efd', 'important');
              badge.style.setProperty('opacity', '1', 'important');
              badge.style.setProperty('background-color', '#fff', 'important');
            } else {
              badge.style.setProperty('border-color', '#6c757d', 'important');
              badge.style.setProperty('color', '#6c757d', 'important');
              badge.style.setProperty('opacity', '0.6', 'important');
              badge.style.setProperty('background-color', '#f8f9fa', 'important');
            }
          }
          document.getElementById('a-modal-listPrice')?.dispatchEvent(new Event('input'));
        });
      }
    });

    document.getElementById('a-sell-coefficient')?.addEventListener('input', () => {
      updateAMaterialLabels();
      document.getElementById('a-modal-costPrice')?.dispatchEvent(new Event('input'));
    });
  }

  // --- 6. B材限定：自動データ投入ロジック ---
  if (prefix === 'b') {
    const injectInitialData = (forceUpdate = false) => {
      // ★ 復元中、または既にデータが存在する場合は自動生成をスキップ
      if (isRestoring) return;

      const koujiEl = document.querySelector('input[name="koujiType"]:checked');
      if (!koujiEl) return;
      const selectedKouji = koujiEl.value;
      const p29El = document.getElementById('laborSubtotal');
      const p29Value = p29El ? parseFloat(p29El.value.replace(/[^0-9.-]+/g, "")) || 0 : 0;

      let calculatedCost = 0;
      if (p29Value > 0) {
        const roundPos = p29Value > 50000 ? 10000 : 1000;
        calculatedCost = Math.ceil(p29Value / roundPos) * roundPos - p29Value;
      }

      let calculatedUnitPrice = (selectedKouji === "空調工事") ? 0 : ((calculatedCost === 0) ? 1000 : calculatedCost);
      let itemName = (selectedKouji === "電気工事") ? "消耗雑材費" : "冷媒配管";
      let itemSpec = (selectedKouji === "電気工事") ? "消耗雑材" : "";

      let targetRow = tableBody.querySelector(".initial-data-row");

      // 重複・更新チェック（入値もチェック対象に含める）
      if (targetRow) {
        const prevName = targetRow.cells[2]?.textContent;
        const prevCost = parseFloat(targetRow.cells[11]?.textContent.replace(/,/g, '')) || 0;
        if (!forceUpdate && prevName === itemName && prevCost === calculatedCost) return;
      }

      const initialItem = {
        name: itemName,
        spec: itemSpec,
        quantity: (selectedKouji === "電気工事") ? 1 : 0,
        unit: (selectedKouji === "電気工事") ? "式" : "",
        unitPrice: calculatedUnitPrice,
        costPrice: calculatedCost,
        remark: "自動生成",
        amount: ((selectedKouji === "電気工事") ? 1 : 0) * calculatedUnitPrice
      };

      // 自動生成行のHTML組み立て
      const rowHtml = `
      <td>
        <div class="d-flex justify-content-center gap-1">
          <button type="button" class="btn btn-sm btn-secondary" style="pointer-events: none;">自動</button>
          <button type="button" class="deleteBtn btn btn-sm btn-outline-danger">削除</button>
        </div>
      </td>
      <td class="bg-light">1</td>
      <td class="bg-light">${initialItem.name}</td>
      <td class="bg-light">${initialItem.spec}</td>
      <td class="bg-light text-end">${initialItem.quantity}</td>
      <td class="bg-light">${initialItem.unit}</td>
      <td class="bg-light text-end">${initialItem.unitPrice.toLocaleString()}</td>
      <td class="bg-light text-end">${initialItem.amount.toLocaleString()}</td>
      <td class="bg-light">${initialItem.remark}</td>
      <td class="bg-light text-end">0</td>
      <td class="bg-light text-end">0</td>
      <td class="bg-light text-end fw-bold">${initialItem.costPrice.toLocaleString()}</td>
      <td class="bg-light text-end fw-bold">${initialItem.costPrice.toLocaleString()}</td>
      <td class="bg-light text-end">0%</td>
      <td class="bg-light text-end">0%</td>
      <td class="bg-light"></td><td class="bg-light"></td><td class="bg-light"></td>
    `;

      if (targetRow) {
        targetRow.innerHTML = rowHtml;
        attachRowEvents(targetRow, 'b');
      } else {
        const emptyRow = tableBody.querySelector('td[colspan]');
        if (emptyRow) tableBody.innerHTML = '';

        const newRow = document.createElement("tr");
        newRow.classList.add("initial-data-row");
        newRow.innerHTML = rowHtml;
        // 常に先頭に挿入
        if (tableBody.firstChild) tableBody.insertBefore(newRow, tableBody.firstChild);
        else tableBody.appendChild(newRow);
        attachRowEvents(newRow, 'b');
      }
      // 合計を再計算（これで上の金額欄に反映されます）
      calculateTotals('b');
    };

    setTimeout(() => injectInitialData(false), 500);
    document.querySelectorAll('input[name="koujiType"]').forEach(r => r.addEventListener('change', () => injectInitialData(true)));

    if (document.getElementById('laborSubtotal')) {
      let lastVal = "";
      setInterval(() => {
        const currentVal = document.getElementById('laborSubtotal').value;
        if (currentVal !== lastVal) {
          lastVal = currentVal;
          injectInitialData(true);
        }
      }, 1000);
    }
  }
}

/**
 * ★ A材の一括更新処理：登録済みデータを現在の係数で再計算
 */
function updateAllAItemsByCoefficient() {
  const tableBody = document.getElementById('a-itemTableBody');
  const coeffInput = document.getElementById('a-sell-coefficient');
  const desc = document.getElementById('coeff-description');
  if (!tableBody || !coeffInput) return;

  const newCoeff = parseFloat(coeffInput.value) || 1.3;

  if (desc) {
    let bonusText = (newCoeff === 1.0) ? "原価と同額" : (newCoeff > 1.0 ? `${Math.round((newCoeff - 1) * 10)}割増し` : "減額設定");
    desc.textContent = `${bonusText} (100円単位切り上げ)`;
  }

  const rows = tableBody.querySelectorAll('tr');
  rows.forEach(row => {
    if (row.cells.length < 18 || row.querySelector('td[colspan]')) return;

    const costPrice = parseFloat(row.cells[11].textContent.replace(/,/g, '')) || 0;
    const quantity = parseFloat(row.cells[4].textContent) || 0;
    const listPrice = parseFloat(row.cells[9].textContent.replace(/,/g, '')) || 0;

    if (costPrice > 0) {
      const newUnitPrice = Math.ceil((costPrice * newCoeff) / 100) * 100;
      row.cells[6].textContent = newUnitPrice.toLocaleString();
      row.cells[7].textContent = (newUnitPrice * quantity).toLocaleString();
      if (listPrice > 0) {
        row.cells[14].textContent = ((newUnitPrice / listPrice) * 100).toFixed(2) + "%";
      }
    }
  });

  // A材の合計表示を更新
  if (window.calculateTotals) window.calculateTotals('a');
}

/**
 * A材・B材 共通のデータ復元処理
 * @param {string} prefix - 'a' または 'b'
 * @param {Object} data - 保存されていたデータオブジェクト
 */
window.restoreMaterialData = function (prefix, data) {
  if (!data) return;

  // ★ 復元開始
  isRestoring = true;

  // 1. 基本設定の復元（チェックボックスと売価係数）
  const checkEl = document.getElementById(`${prefix}MaterialCheck`);
  if (checkEl) checkEl.checked = data.isAddedToBudget || false;

  const coeffEl = document.getElementById(`${prefix}-sell-coefficient`);
  if (coeffEl) {
    coeffEl.value = data.sellCoefficient || "1.3";
    // A材の場合はラベルの表示更新イベントを飛ばす
    coeffEl.dispatchEvent(new Event('input'));
  }

  // 2. テーブルの復元
  const tableBody = document.getElementById(`${prefix}-itemTableBody`);
  if (!tableBody) return;
  tableBody.innerHTML = ''; // 一旦クリア

  if (!data.tableData || data.tableData.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="18" class="text-center">データ未入力</td></tr>';
    return;
  }

  data.tableData.forEach((item, index) => {
    const tr = document.createElement("tr");

    // B材の「自動生成行」判定（remarkやクラスで判断）
    const isAutoRow = (prefix === 'b' && item.remark === "自動生成");
    if (isAutoRow) {
      tr.classList.add("initial-data-row");
    }

    // 行のHTMLを組み立て（元のソースのrowHtml構造を忠実に再現）
    tr.innerHTML = `
            <td>
                <div class="d-flex justify-content-center gap-1">
                    ${isAutoRow ?
        `<button type="button" class="btn btn-sm btn-secondary" style="pointer-events: none;">自動</button>` :
        `<button type="button" class="editBtn btn btn-sm btn-outline-primary">編集</button>`
      }
                    <button type="button" class="deleteBtn btn btn-sm btn-outline-danger">削除</button>
                </div>
            </td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${index + 1}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.name || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.spec || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.qty || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.unit || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.unitPrice || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.amount || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.remark || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.listPrice || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.listTotal || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end fw-bold">${item.costPrice || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end fw-bold">${item.costTotal || "0"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.costRate || "0%"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''} text-end">${item.sellRate || "0%"}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.itemName || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.actual || ""}</td>
            <td class="${isAutoRow ? 'bg-light' : ''}">${item.company || ""}</td>
        `;

    tableBody.appendChild(tr);

    // 編集・削除イベントを再紐付け（公開した関数を利用）
    if (typeof window.attachRowEvents === 'function') {
      window.attachRowEvents(tr, prefix);
    }
  });

  // 3. 全体計算の実行
  if (typeof window.calculateTotals === 'function') {
    window.calculateTotals(prefix);
  }

  // チェックボックスの連動を反映
  const dummyEvent = new Event('change', { bubbles: true });
  checkEl?.dispatchEvent(dummyEvent);

  // 復元が終わったので、1秒後に自動計算ガードを解除する
  setTimeout(() => {
    isRestoring = false;
    console.log(`${prefix}材の復元が完了しました（ガード解除）`);
  }, 1000);
};