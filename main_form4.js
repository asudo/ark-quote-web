document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#modal-inputModal form");
  const tableBody = document.getElementById("main-itemTableBody");
  let itemCount = 1;
  let editRow = null;

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // 入力値を取得
    const name = document.getElementById("modal-name").value;
    const spec = document.getElementById("modal-spec").value;
    const quantity = Number(document.getElementById("modal-quantity").value);
    const unit = document.getElementById("modal-unit").value;
    const unitPrice = Number(document.getElementById("modal-unitPrice").value);
    const amount = quantity * unitPrice;
    const remark = document.getElementById("modal-remark").value;
    const listPrice = Number(document.getElementById("modal-listPrice").value);
    const listTotal = quantity * listPrice;
    const costPrice = Number(document.getElementById("modal-costPrice").value);
    const costTotal = quantity * costPrice;
    const costRate = listPrice ? ((costPrice / listPrice) * 100).toFixed(2) + "%" : "";
    const sellRate = listPrice ? ((unitPrice / listPrice) * 100).toFixed(2) + "%" : "";
    const itemName = document.getElementById("modal-itemName").value;
    const actual = document.getElementById("modal-actual").value;
    const company = document.getElementById("modal-company").value;

    // 最初の「データ未入力」行を削除
    if (tableBody.children.length === 1 &&
        tableBody.children[0].children[1].colSpan === 16) {
      tableBody.innerHTML = '';
    }

    if (editRow) {
      editRow.innerHTML = `
        <td>
          <button class="editBtn" style="background-color: green; color: white;">編集</button>
          <button class="deleteBtn" style="background-color: red; color: white;">削除</button>
        </td>
        <td>${editRow.children[1].textContent}</td>
        <td>${name}</td>
        <td>${spec}</td>
        <td>${quantity}</td>
        <td>${unit}</td>
        <td>${unitPrice}</td>
        <td>${amount}</td>
        <td>${remark}</td>
        <td>${listPrice}</td>
        <td>${listTotal}</td>
        <td>${costPrice}</td>
        <td>${costTotal}</td>
        <td>${costRate}</td>
        <td>${sellRate}</td>
        <td>${itemName}</td>
        <td>${actual}</td>
        <td>${company}</td>
      `;
      attachRowEvents(editRow);
      editRow = null;
    } else {
      const newRow = document.createElement("tr");
      newRow.innerHTML = `
        <td>
          <button class="editBtn" style="background-color: green; color: white;">編集</button>
          <button class="deleteBtn" style="background-color: red; color: white;">削除</button>
        </td>
        <td>${itemCount++}</td>
        <td>${name}</td>
        <td>${spec}</td>
        <td>${quantity}</td>
        <td>${unit}</td>
        <td>${unitPrice}</td>
        <td>${amount}</td>
        <td>${remark}</td>
        <td>${listPrice}</td>
        <td>${listTotal}</td>
        <td>${costPrice}</td>
        <td>${costTotal}</td>
        <td>${costRate}</td>
        <td>${sellRate}</td>
        <td>${itemName}</td>
        <td>${actual}</td>
        <td>${company}</td>
      `;
      tableBody.appendChild(newRow);
      attachRowEvents(newRow);
    }

    calculateTotals();

    const modal = bootstrap.Modal.getInstance(document.getElementById("modal-inputModal"));
    modal.hide();

    form.reset();
  });

  function attachRowEvents(row) {
    const editBtn = row.querySelector(".editBtn");
    const deleteBtn = row.querySelector(".deleteBtn");

    if (editBtn) {
      editBtn.addEventListener("click", () => {
        editRow = row;
        const cells = row.children;
        document.getElementById("modal-name").value = cells[2].textContent;
        document.getElementById("modal-spec").value = cells[3].textContent;
        document.getElementById("modal-quantity").value = cells[4].textContent;
        document.getElementById("modal-unit").value = cells[5].textContent;
        document.getElementById("modal-unitPrice").value = cells[6].textContent;
        document.getElementById("modal-remark").value = cells[8].textContent;
        document.getElementById("modal-listPrice").value = cells[9].textContent;
        document.getElementById("modal-costPrice").value = cells[11].textContent;
        document.getElementById("modal-itemName").value = cells[15].textContent;
        document.getElementById("modal-actual").value = cells[16].textContent;
        document.getElementById("modal-company").value = cells[17].textContent;

        const modalElement = document.getElementById("modal-inputModal");
        const modalInstance = new bootstrap.Modal(modalElement);
        modalInstance.show();
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => {
        if (confirm("本当に削除しますか？")) {
          row.remove();
          calculateTotals();
        }
      });
    }
  }

  function calculateTotals() {
    const rows = document.querySelectorAll("#main-itemTableBody tr");
    let totalAmount = 0;
    let totalListPrice = 0;
    let totalCost = 0;

    rows.forEach(row => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 18) return;

      const amount = parseFloat(cells[7].textContent) || 0;
      const listTotal = parseFloat(cells[10].textContent) || 0;
      const costTotal = parseFloat(cells[12].textContent) || 0;

      totalAmount += amount;
      totalListPrice += listTotal;
      totalCost += costTotal;
    });

    const costRateTotal = totalListPrice ? (totalCost / totalListPrice * 100).toFixed(2) + "%" : "0%";
    const sellRateTotal = totalListPrice ? (totalAmount / totalListPrice * 100).toFixed(2) + "%" : "0%";
    const profit = totalAmount - totalCost;
    const profitRate = totalAmount ? (profit / totalAmount * 100).toFixed(2) + "%" : "0%";

    document.getElementById("main-totalAmount").textContent = `¥${totalAmount.toLocaleString()}`;
    document.getElementById("main-totalListPrice").textContent = `¥${totalListPrice.toLocaleString()}`;
    document.getElementById("main-totalCostPrice").textContent = `¥${totalCost.toLocaleString()}`;
    document.getElementById("main-totalCostRate").textContent = costRateTotal;
    document.getElementById("main-totalSellRate").textContent = sellRateTotal;
    document.getElementById("main-totalProfit").textContent = `¥${profit.toLocaleString()}`;
    document.getElementById("main-totalProfitRate").textContent = profitRate;
  }

  function updateAutoFields() {
    const quantity = Number(document.getElementById("modal-quantity").value);
    const unitPriceInput = document.getElementById("modal-unitPrice");
    const costPrice = Number(document.getElementById("modal-costPrice").value);
    const listPrice = Number(document.getElementById("modal-listPrice").value);
    const actual = Number(document.getElementById("modal-actual").value);

    if (!isNaN(costPrice) && costPrice > 0) {
      const autoUnitPrice = Math.ceil((costPrice * 1.3) / 100) * 100;
      unitPriceInput.value = autoUnitPrice;
    } else {
      unitPriceInput.value = "";
    }

    const updatedUnitPrice = Number(unitPriceInput.value);
    const amount = updatedUnitPrice * quantity;
    document.getElementById("modal-amount").value = !isNaN(amount) ? amount : "";

    let listTotal = listPrice * quantity;
    if (isNaN(listTotal) || listTotal === 0) {
      listTotal = updatedUnitPrice * quantity;
    }
    document.getElementById("modal-listTotal").value = !isNaN(listTotal) ? listTotal : "";

    let costTotal = !isNaN(actual) && actual > 0
      ? costPrice * actual
      : costPrice * quantity;
    document.getElementById("modal-costTotal").value = !isNaN(costTotal) ? costTotal : "";
  }

  document.getElementById("modal-costPrice").addEventListener("input", updateAutoFields);
  document.getElementById("modal-quantity").addEventListener("input", updateAutoFields);
});
