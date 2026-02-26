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

  // --- 1. 登録・更新処理 ---
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // 入力値の取得
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

    data.amount = data.quantity * data.unitPrice;

    // 初回入力時の「データ未入力」行を削除
    const emptyRow = tableBody.querySelector('td[colspan]');
    if (emptyRow) { tableBody.innerHTML = ''; }

    const rowHtml = `
      <td>
        <button type="button" class="editBtn btn btn-sm btn-success" style="background-color: green; color: white;">編集</button>
        <button type="button" class="deleteBtn btn btn-sm btn-danger" style="background-color: red; color: white;">削除</button>
      </td>
      <td>${editRow ? editRow.children[1].textContent : itemCount++}</td>
      <td>${data.name}</td><td>${data.spec}</td><td>${data.quantity}</td><td>${data.unit}</td>
      <td>${data.unitPrice}</td><td>${data.amount}</td><td>${data.remark}</td>
      <td>${data.listPrice}</td><td>${data.listTotal}</td><td>${data.costPrice}</td>
      <td>${data.costTotal}</td><td>${data.costRate}</td><td>${data.sellRate}</td>
      <td>${data.itemName}</td><td>${data.actual}</td><td>${data.company}</td>
    `;

    if (editRow) {
      editRow.innerHTML = rowHtml;
      attachRowEvents(editRow, prefix);
      editRow = null;
    } else {
      const newRow = document.createElement("tr");
      newRow.innerHTML = rowHtml;
      tableBody.appendChild(newRow);
      attachRowEvents(newRow, prefix);
    }

    calculateTotals(prefix);

    // モーダルを閉じてフォームをリセット
    const modalInstance = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
    modalInstance.hide();
    form.reset();
  });

  // --- 2. 編集・削除ボタンのイベント登録 ---
  function attachRowEvents(row, prefix) {
    // 編集ボタン
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

  // --- 3. 合計計算処理 ---
  function calculateTotals(prefix) {
    const rows = tableBody.querySelectorAll("tr");
    let tAmount = 0, tList = 0, tCost = 0;

    rows.forEach(row => {
      const cells = row.children;
      if (cells.length < 18) return;
      tAmount += parseFloat(cells[7].textContent) || 0;
      tList += parseFloat(cells[10].textContent) || 0;
      tCost += parseFloat(cells[12].textContent) || 0;
    });

    const profit = tAmount - tCost;

    document.getElementById(`${prefix}-totalAmount`).textContent = `¥${tAmount.toLocaleString()}`;
    document.getElementById(`${prefix}-totalListPrice`).textContent = `¥${tList.toLocaleString()}`;
    document.getElementById(`${prefix}-totalCostPrice`).textContent = `¥${tCost.toLocaleString()}`;
    document.getElementById(`${prefix}-totalCostRate`).textContent = tList ? (tCost / tList * 100).toFixed(2) + "%" : "0%";
    document.getElementById(`${prefix}-totalSellRate`).textContent = tList ? (tAmount / tList * 100).toFixed(2) + "%" : "0%";
    document.getElementById(`${prefix}-totalProfit`).textContent = `¥${profit.toLocaleString()}`;
    document.getElementById(`${prefix}-totalProfitRate`).textContent = tAmount ? (profit / tAmount * 100).toFixed(2) + "%" : "0%";

    if (window.syncMaterialTotals) {
      window.syncMaterialTotals();
    }
  }

  // --- 4. 入力時の自動計算 (モーダル内) ---
  function updateAutoFields() {
    const qty = Number(document.getElementById(`${prefix}-modal-quantity`).value);
    const cost = Number(document.getElementById(`${prefix}-modal-costPrice`).value);
    const list = Number(document.getElementById(`${prefix}-modal-listPrice`).value);
    const actual = Number(document.getElementById(`${prefix}-modal-actual`).value);
    const unitPriceInput = document.getElementById(`${prefix}-modal-unitPrice`);

    // 入値から単価を自動設定 (単価入力欄を直接操作していない場合)
    if (cost > 0 && document.activeElement !== unitPriceInput) {
      unitPriceInput.value = Math.ceil((cost * 1.3) / 100) * 100;
    }

    const uprice = Number(unitPriceInput.value);
    document.getElementById(`${prefix}-modal-amount`).value = uprice * qty || "";

    let lTotal = (list * qty) || (uprice * qty);
    document.getElementById(`${prefix}-modal-listTotal`).value = lTotal || "";

    let cTotal = (actual > 0) ? (cost * actual) : (cost * qty);
    document.getElementById(`${prefix}-modal-costTotal`).value = cTotal || "";

    if (list > 0) {
      document.getElementById(`${prefix}-modal-costRate`).value = ((cost / list) * 100).toFixed(2) + "%";
      document.getElementById(`${prefix}-modal-sellRate`).value = ((uprice / list) * 100).toFixed(2) + "%";
    } else {
      document.getElementById(`${prefix}-modal-costRate`).value = "";
      document.getElementById(`${prefix}-modal-sellRate`).value = "";
    }
  }

  // 各入力欄に計算イベントを設定
  const fields = ['costPrice', 'quantity', 'listPrice', 'actual', 'unitPrice'];
  fields.forEach(f => {
    const el = document.getElementById(`${prefix}-modal-${f}`);
    if (el) el.addEventListener("input", updateAutoFields);
  });
}