document.addEventListener("DOMContentLoaded", function () {

  const constructionForm = document.getElementById("constructionForm");
  const constructionTableBody = document.querySelector(".construction-scroll tbody");
  const unitSelect = document.getElementById("unitSelect");
  const contentSelect = document.getElementById("contentSelect");

  const lightUse = constructionForm.querySelector('input[name="lightUse"]');
  const quantity = constructionForm.querySelector('input[name="quantity"]');
  const count = constructionForm.querySelector('input[name="count"]');
  const basePrice = constructionForm.querySelector('input[name="basePrice"]');
  const fixedPrice = constructionForm.querySelector('input[name="fixedPrice"]');

  const koujiTypeElectric = document.getElementById("koujiType1");
  const koujiTypeAir = document.getElementById("koujiType2");
  const modal = document.getElementById("constructionModal");

  const itemNameInput = constructionForm.querySelector('select[name="itemName"]');
  const basePriceInput = constructionForm.querySelector('input[name="basePrice"]');

  // ツールチェック
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  // --- 高所作業車の表示・非表示切り替えロジック ---
  const highWorkCheck = document.getElementById("highWorkCar");
  const highWorkSection = document.getElementById("highWorkSection");

  if (highWorkCheck && highWorkSection) {
    const toggleHighWork = () => {
      // チェックが入っていれば表示(d-noneを消す)、なければ非表示(d-noneを足す)
      if (highWorkCheck.checked) {
        highWorkSection.classList.remove("d-none");
      } else {
        highWorkSection.classList.add("d-none");
      }
    };

    // ユーザーがクリックした時に実行
    highWorkCheck.addEventListener("change", toggleHighWork);

    // ページ読み込み時の初期状態（リロード対策）
    toggleHighWork();
  }

  // 高所作業車テーブルの自動計算ロジック
  const tableRows = document.querySelectorAll('table tbody tr');

  tableRows.forEach(row => {
    const qtyInput = row.cells[2]?.querySelector('input');
    const unitPriceInput = row.cells[4]?.querySelector('input');
    const transportInput = row.cells[5]?.querySelector('input');
    const totalUnitInput = row.cells[6]?.querySelector('input');
    const subtotalInput = row.cells[7]?.querySelector('input');

    if (!qtyInput || !unitPriceInput || !transportInput || !totalUnitInput || !subtotalInput) return;

    const updateRow = () => {
      const qty = parseFloat(qtyInput.value) || 0;
      const unitPrice = parseFloat(unitPriceInput.value) || 0;
      const transport = parseFloat(transportInput.value) || 0;

      const totalUnit = unitPrice + transport;
      const subtotal = qty * totalUnit;

      totalUnitInput.value = totalUnit ? totalUnit.toFixed(0) : '';
      subtotalInput.value = subtotal ? subtotal.toFixed(0) : '';
    };

    [qtyInput, unitPriceInput, transportInput].forEach(input => {
      input.addEventListener('input', updateRow);
    });
  });

  // 昼間,夜間,高所,特殊,産廃等,微調整 
  const profitFields = {
    day: document.querySelector('[name="profit_day"]'),
    night: document.querySelector('[name="profit_night"]'),
    high: document.querySelector('[name="profit_high"]'),
    special: document.querySelector('[name="profit_special"]'),
    waste: document.querySelector('[name="profit_waste"]'),
    adjust: document.querySelector('[name="profit_adjust"]'),
  };

  const types = ['day', 'night', 'high', 'special', 'waste', 'adjust'];
  let rowCount = 1;
  let editingRow = null;

  // 利益の取得
  function getProfit(type) {
    const val = parseFloat(profitFields[type]?.value);
    return isNaN(val) ? 0 : val;
  }

  // 本数自動計算
  modal.addEventListener("shown.bs.modal", function () {
    function updateCount() {
      const lightUseVal = parseFloat(lightUse.value);
      const quantityVal = parseFloat(quantity.value);
      const isElectric = koujiTypeElectric?.checked;

      if (!isElectric || isNaN(lightUseVal)) {
        count.value = "";
        return;
      }

      count.value = (!isNaN(quantityVal)) ? (lightUseVal * quantityVal) : "";
    }

    lightUse.addEventListener("input", updateCount);
    quantity.addEventListener("input", updateCount);
    koujiTypeElectric?.addEventListener("change", updateCount);
    koujiTypeAir?.addEventListener("change", updateCount);
  });

  // 行追加・編集
  constructionForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const unit = unitSelect.value;
    const content = contentSelect.value;

    if (editingRow) {
      // 編集処理（省略可）
      editingRow = null;
    } else {
      const tr = document.createElement("tr");

      // 利益用のチェックボックスカラム作成
      const profitCheckboxes = types.map(type =>
        `<td><input type="checkbox" class="coeffCheck" data-type="${type}"></td>`
      ).join("");

      tr.innerHTML = `
        <td>
          <button class="btn btn-sm btn-success edit-row">編集</button>
          <button class="btn btn-sm btn-danger delete-row ms-1">削除</button>
        </td>
        <td>${rowCount++}</td>
        <td>${itemNameInput.value}</td>
        <td>${lightUse.value}</td>
        <td>${quantity.value}</td>
        <td>${unit}</td>
        <td>${content}</td>
        <td>${count.value}</td>
        <td><input type="number" name="basePrice" class="form-control" value="${basePrice.value}"></td>

        <td><input type="text" class="form-control confirmedInput" data-type="dayConfirmed" readonly></td>
        <td><input type="text" class="form-control confirmedInput" data-type="nightConfirmed" readonly></td>
        <td><input type="text" class="form-control confirmedInput" data-type="highConfirmed" readonly></td>
        <td><input type="text" class="form-control confirmedInput" data-type="specialConfirmed" readonly></td>
        <td><input type="text" class="form-control confirmedInput" data-type="wasteConfirmed" readonly></td>
        <td><input type="text" class="form-control confirmedInput" data-type="adjustConfirmed" readonly></td>

        <td><input type="text" class="form-control totalConfirmedPrice" readonly></td>
        <td></td> <!-- 小計 -->
        <td><input type="checkbox" name="coefficient" /></td>
      `;


      const emptyRow = constructionTableBody.querySelector("tr td[colspan]");
      if (emptyRow) emptyRow.parentElement.remove();

      constructionTableBody.appendChild(tr);
    }

    constructionForm.reset();
    unitSelect.value = "";
    contentSelect.value = "";

    bootstrap.Modal.getInstance(modal).hide();
    updateRowNumbers();
    calculateConfirmedPrices();
  });

  // 利益計算ロジック
  function calculateConfirmedPrices() {
    constructionTableBody.querySelectorAll("tr").forEach(row => {
      // 基本単価を取得（input[name="basePrice"]）
      const basePriceInput = row.querySelector('input[name="basePrice"]');
      if (!basePriceInput) return;

      const basePrice = parseFloat(basePriceInput.value) || 0;
      let totalConfirmed = 0;

      // 各利益タイプごとのチェックと計算
      types.forEach(type => {
        const profit = getProfit(type); // フォーム上部の利益率を取得
        const checkbox = row.querySelector(`.coeffCheck[data-type="${type}"]`);
        const confirmedInput = row.querySelector(`.confirmedInput[data-type="${type}Confirmed"]`);
        const coeffCheckbox = row.querySelector('input[name="coefficient"]');

        const isChecked = checkbox?.checked;
        const isCoeffChecked = coeffCheckbox?.checked;

        if (confirmedInput) {
          if (isChecked || isCoeffChecked) {
            const confirmed = basePrice * profit;
            confirmedInput.value = confirmed.toFixed(0); // 四捨五入
            totalConfirmed += confirmed;
          } else {
            confirmedInput.value = '';
          }
        }
      });

      // 合計（確定単価）を入力
      const totalConfirmedInput = row.querySelector('.totalConfirmedPrice');
      if (totalConfirmedInput) {
        totalConfirmedInput.value = totalConfirmed.toFixed(0);
      }
    });
  }


  // 利益入力欄の変更時に再計算
  Object.values(profitFields).forEach(input => {
    input.addEventListener("input", calculateConfirmedPrices);
  });

  // 行内チェックボックスや係数チェックボックス変更でも再計算
  document.addEventListener("input", e => {
    if (
      e.target.matches('.coeffCheck') ||
      e.target.matches('input[name="coefficient"]') ||
      e.target.matches('input[name="basePrice"]')
    ) {
      calculateConfirmedPrices();
    }
  });


  // 行番号更新
  function updateRowNumbers() {
    const rows = constructionTableBody.querySelectorAll("tr");
    rowCount = 1;
    rows.forEach(row => {
      const cell = row.querySelector("td:nth-child(2)");
      if (cell) cell.textContent = rowCount++;
    });

    if (rows.length === 0) {
      constructionTableBody.innerHTML = `<tr><td colspan="19">データ未入力</td></tr>`;
    }
  }

  // 基本単価 自動セット
  function updateBasePrice() {
    const itemName = itemNameInput.value.trim();
    const content = contentSelect.value;

    if ((itemName === "照明40W" || itemName === "照明20W") && content === "交換工事") {
      basePriceInput.value = "3500";
    } else if (itemName === "照明40W" || itemName === "照明20W") {
      basePriceInput.value = "1500";
    } else {
      basePriceInput.value = "";
    }
  }

  itemNameInput.addEventListener("input", updateBasePrice);
  contentSelect.addEventListener("change", updateBasePrice);

  // 初期実行
  updateBasePrice();
  calculateConfirmedPrices();
});

