document.addEventListener("DOMContentLoaded", () => {
  // A材(prefix: 'a')とB材(prefix: 'b')の各フォームを初期化
  setupMaterialForm('a');
  setupMaterialForm('b');
});

/**
* 材別のフォーム制御メイン関数
*/
function setupMaterialForm(prefix) {
  const form = document.getElementById(`${prefix}-inputForm`);
  const tableBody = document.getElementById(`${prefix}-itemTableBody`);
  const modalElement = document.getElementById(`${prefix}-inputModal`);

  if (!form || !tableBody || !modalElement) return;

  let itemCount = 1;
  let editRow = null;
  // HTML側で「新規入力」ボタンに data-bs-target が設定されていることを前提としています
  const addButtons = document.querySelectorAll(`[data-bs-target="#${prefix}-inputModal"]`);
  addButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      editRow = null; // 編集ターゲットをクリア
      form.reset();   // モーダルの入力欄をすべて空にする

      // モーダルのタイトルとボタンを「新規」用の表示に戻す
      const modalTitle = modalElement.querySelector(".modal-title");
      const submitBtn = form.querySelector('button[type="submit"]');
      if (modalTitle) modalTitle.textContent = `新規入力：${prefix.toUpperCase()}材`;
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

    // テーブルに挿入するHTMLの組み立て
    const rowHtml = `
   <td>
    <div class="d-flex justify-content-center gap-1">
     <button type="button" class="editBtn btn btn-sm btn-outline-primary">編集</button>
     <button type="button" class="deleteBtn btn btn-sm btn-outline-danger">削除</button>
    </div>
   </td>
   <td>${editRow ? editRow.children[1].textContent : itemCount++}</td>
   <td>${data.name}</td><td>${data.spec}</td><td>${data.quantity}</td><td>${data.unit}</td>
   <td>${data.unitPrice}</td><td>${data.amount}</td><td>${data.remark}</td>
   <td>${data.listPrice}</td><td>${data.listTotal}</td><td>${data.costPrice}</td>
   <td>${data.costTotal}</td><td>${data.costRate}</td><td>${data.sellRate}</td>
   <td>${data.itemName}</td><td>${data.actual}</td><td>${data.company}</td>
  `;

    if (editRow) {
      // 編集モード：既存の行を書き換え
      editRow.innerHTML = rowHtml;
      attachRowEvents(editRow, prefix);
      editRow = null;
    } else {
      // 新規モード：新しい行を追加
      const newRow = document.createElement("tr");
      if (data.remark === "※自動生成データ") {
        newRow.classList.add("initial-data-row");
      }
      newRow.innerHTML = rowHtml;
      tableBody.appendChild(newRow);
      attachRowEvents(newRow, prefix);
    }

    // 表の下にある合計欄を再計算
    calculateTotals(prefix);

    // モーダルを閉じて中身を空にする
    const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.hide();
    form.reset();
  });

  // --- 2. 編集・削除ボタンのイベント登録 ---
  function attachRowEvents(row, prefix) {
    // 編集ボタン：行のデータを取り出してモーダルにセット
    row.querySelector(".editBtn").addEventListener("click", () => {
      editRow = row;
      const cells = row.children;
      document.getElementById(`${prefix}-modal-name`).value = cells[2].textContent;
      document.getElementById(`${prefix}-modal-spec`).value = cells[3].textContent;
      document.getElementById(`${prefix}-modal-quantity`).value = cells[4].textContent;
      document.getElementById(`${prefix}-modal-unit`).value = cells[5].textContent;
      document.getElementById(`${prefix}-modal-unitPrice`).value = cells[6].textContent;
      document.getElementById(`${prefix}-modal-remark`).value = cells[8].textContent;
      document.getElementById(`${prefix}-modal-listPrice`).value = cells[9].textContent;
      document.getElementById(`${prefix}-modal-costPrice`).value = cells[11].textContent;
      document.getElementById(`${prefix}-modal-itemName`).value = cells[15].textContent;
      document.getElementById(`${prefix}-modal-actual`).value = cells[16].textContent;
      document.getElementById(`${prefix}-modal-company`).value = cells[17].textContent;

      const modalInstance = new bootstrap.Modal(modalElement);
      modalInstance.show();
    });

    // 削除ボタン
    row.querySelector(".deleteBtn").addEventListener("click", () => {
      if (confirm("本当に削除しますか？")) {
        row.remove();
        calculateTotals(prefix);
      }
    });
  }

  // --- 3. 合計計算処理（テーブル全体の集計） ---
  function calculateTotals(prefix) {
    const rows = tableBody.querySelectorAll("tr");
    let tAmount = 0, tList = 0, tCost = 0;

    rows.forEach(row => {
      const cells = row.children;
      if (cells.length < 18) return;
      tAmount += parseFloat(cells[7].textContent.replace(/[^0-9.-]+/g, "")) || 0;
      tList += parseFloat(cells[10].textContent.replace(/[^0-9.-]+/g, "")) || 0;
      tCost += parseFloat(cells[12].textContent.replace(/[^0-9.-]+/g, "")) || 0;
    });

    const profit = tAmount - tCost;

    // 各合計ラベルに数値を反映（カンマ区切り）
    document.getElementById(`${prefix}-totalAmount`).textContent = `¥${tAmount.toLocaleString()}`;
    document.getElementById(`${prefix}-totalListPrice`).textContent = `¥${tList.toLocaleString()}`;
    document.getElementById(`${prefix}-totalCostPrice`).textContent = `¥${tCost.toLocaleString()}`;
    document.getElementById(`${prefix}-totalCostRate`).textContent = tList ? (tCost / tList * 100).toFixed(2) + "%" : "0%";
    document.getElementById(`${prefix}-totalSellRate`).textContent = tList ? (tAmount / tList * 100).toFixed(2) + "%" : "0%";
    document.getElementById(`${prefix}-totalProfit`).textContent = `¥${profit.toLocaleString()}`;
    document.getElementById(`${prefix}-totalProfitRate`).textContent = tAmount ? (profit / tAmount * 100).toFixed(2) + "%" : "0%";

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

    document.getElementById(`${prefix}-modal-amount`).value = (uprice * qty) || "";
    document.getElementById(`${prefix}-modal-costTotal`).value = (actualStr !== "") ? (cost * Number(actualStr)) : (cost * qty);
    document.getElementById(`${prefix}-modal-listTotal`).value = (list > 0) ? (list * qty) : "";

    if (list > 0) {
      document.getElementById(`${prefix}-modal-costRate`).value = ((cost / list) * 100).toFixed(2) + "%";
      document.getElementById(`${prefix}-modal-sellRate`).value = ((uprice / list) * 100).toFixed(2) + "%";
    } else {
      document.getElementById(`${prefix}-modal-costRate`).value = "";
      document.getElementById(`${prefix}-modal-sellRate`).value = "";
    }
  }

  // --- 5. A材専用：入力時の連動（定価から入値・単価を自動算出） ---
  const fields = ['quantity', 'listPrice', 'unitPrice', 'costPrice', 'actual'];
  fields.forEach(f => {
    const el = document.getElementById(`${prefix}-modal-${f}`);
    if (el) {
      el.addEventListener("input", (e) => {
        if (prefix === 'a') {
          if (f === 'listPrice') {
            const listValue = Number(el.value);
            if (listValue > 0) {
              const autoCostPrice = Math.floor(listValue * 0.2); // 入値は定価の20%
              document.getElementById(`${prefix}-modal-costPrice`).value = autoCostPrice;
              document.getElementById(`${prefix}-modal-unitPrice`).value = Math.ceil((autoCostPrice * 1.3) / 100) * 100; // 単価は入値の1.3倍(百円単位切り上げ)
            }
          }
          if (f === 'costPrice') {
            const costValue = Number(el.value);
            if (costValue > 0) {
              document.getElementById(`${prefix}-modal-unitPrice`).value = Math.ceil((costValue * 1.3) / 100) * 100;
            }
          }
        }
        updateAutoFields(e);
      });
    }
  });

  // --- 6. B材限定：自動データ投入ロジック ---
  if (prefix === 'b') {
    const injectInitialData = (forceUpdate = false) => {
      // 工事種類（電気or空調）を確認
      const koujiEl = document.querySelector('input[name="koujiType"]:checked');
      if (!koujiEl) return;
      const selectedKouji = koujiEl.value;

      // 小計(laborSubtotal)の値を取得して数値化
      const p29El = document.getElementById('laborSubtotal');
      const p29Value = p29El ? parseFloat(p29El.value.replace(/[^0-9.-]+/g, "")) || 0 : 0;

      // 入値の計算（小計に基づいた丸め処理）
      let calculatedCost = 0;
      if (p29Value > 0) {
        const roundPos = p29Value > 50000 ? 10000 : 1000;
        calculatedCost = Math.ceil(p29Value / roundPos) * roundPos - p29Value;
      }

      // 単価・名称・規格を工事種類によって出し分け
      let calculatedUnitPrice = (selectedKouji === "空調工事") ? 0 : ((calculatedCost === 0) ? 1000 : calculatedCost);
      let itemName = (selectedKouji === "電気工事") ? "消耗雑雑費" : "冷媒配管";
      let itemSpec = (selectedKouji === "電気工事") ? "消耗雑材" : "";

      // 重複チェック（既に同じデータがあれば更新しない）
      const targetRow = tableBody.querySelector(".initial-data-row") || (tableBody.rows.length > 0 && !tableBody.querySelector('td[colspan]') ? tableBody.rows[0] : null);
      if (targetRow && targetRow.children.length >= 12) {
        const prevCost = parseFloat(targetRow.children[11].textContent) || 0;
        const prevName = targetRow.children[2].textContent;
        if (!forceUpdate && prevName === itemName && prevCost === calculatedCost) return;
      }

      if (targetRow) editRow = targetRow;
      else editRow = null;

      // モーダルへ値をセット
      const initialItem = {
        name: itemName, spec: itemSpec, quantity: (selectedKouji === "電気工事") ? 1 : 0,
        unit: (selectedKouji === "電気工事") ? "式" : "",
        unitPrice: calculatedUnitPrice, remark: "", listPrice: "", costPrice: calculatedCost,
        itemName: "", actual: "", company: ""
      };

      Object.keys(initialItem).forEach(key => {
        const el = document.getElementById(`${prefix}-modal-${key}`);
        if (el) el.value = initialItem[key];
      });

      // 自動計算を実行して「登録」イベントを発火
      updateAutoFields();
      form.dispatchEvent(new Event("submit"));

      // 最後に定価・備考などを強制的に空にする
      const finalRow = editRow || tableBody.lastElementChild;
      if (finalRow && finalRow.children.length >= 12) {
        finalRow.classList.add("initial-data-row");
        finalRow.children[8].textContent = "";
        finalRow.children[9].textContent = "";
        finalRow.children[10].textContent = "";
      }
      form.reset();

      // チェックボックスが入っていれば同期処理を実行
      const bCheck = document.getElementById('bMaterialCheck');
      if (bCheck && bCheck.checked) {
        if (typeof window.syncMaterialTotals === 'function') window.syncMaterialTotals();
        bCheck.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };

    // 起動時の初期投入
    setTimeout(() => injectInitialData(false), 200);

    // 工事種類が切り替わったら再計算
    document.querySelectorAll('input[name="koujiType"]').forEach(radio => {
      radio.addEventListener('change', () => injectInitialData(true));
    });

    // 小計(input)の監視
    const laborSubtotalEl = document.getElementById('laborSubtotal');
    if (laborSubtotalEl) {
      // 直接入力やイベント検知
      laborSubtotalEl.addEventListener('input', () => injectInitialData(true));
      laborSubtotalEl.addEventListener('change', () => injectInitialData(true));

      // スクリプトによる自動書き換えを定期チェック（0.5秒おき）
      let lastValue = laborSubtotalEl.value;
      setInterval(() => {
        if (laborSubtotalEl.value !== lastValue) {
          lastValue = laborSubtotalEl.value;
          injectInitialData(true);
        }
      }, 500);
    }
  }
}