/**
 * daisu.js
 * 役割：【現場メモ（台数・機種）のクイック入力と自動集計】制御
 * 主な処理：一括行生成、スクロール同期、リアルタイム集計（Mapによる重複統合）、キーボードによるセル移動制御
 */

document.addEventListener('DOMContentLoaded', () => {
    const bulkTableBody = document.getElementById('bulkTableBody');
    const intermediateTableBody = document.getElementById('intermediateTableBody');
    const summaryTableBody = document.getElementById('summaryTableBody');
    const addBulkRowBtn = document.getElementById('addBulkRowBtn');
    const bulkScrollArea = document.getElementById('bulkScrollArea');
    const interScrollArea = document.getElementById('interScrollArea');

    // --- 🔹 復元用の窓口関数 ---
    window.restoreDaisuData = function (data) {
        if (!data) return;

        // データの受け取り（オブジェクト形式か配列形式かを柔軟に判定）
        const dataArray = data.daisu_list || (Array.isArray(data) ? data : []);
        const reflectArray = data.daisu_reflect || [];

        if (!bulkTableBody) return;

        // 1. 項目クイック入力の復元
        bulkTableBody.innerHTML = "";

        if (dataArray.length === 0) {
            // データがなければ初期行として20行作成
            for (let i = 0; i < 20; i++) addInputRow();
        } else {
            dataArray.forEach(rowData => {
                const tr = addInputRow(false);
                tr.querySelector('.row-reflect-check').checked = rowData[0] !== undefined ? rowData[0] : true;
                tr.querySelector('.memo-floor').value = rowData[1] || "";
                tr.querySelector('.memo-place').value = rowData[2] || "";
                tr.querySelector('.memo-type').value = rowData[3] || "";
                tr.querySelector('.memo-qty').value = rowData[4] || "";
                tr.querySelector('.memo-shape').value = rowData[5] || "";
                tr.querySelector('.memo-note').value = rowData[6] || "";
                tr.classList.toggle('row-disabled', !tr.querySelector('.row-reflect-check').checked);
            });
        }

        applyPseudoMerge();

        // 2. 自動集計テーブルを自動生成（器を作る）
        updateAllTables();

        // 3. 🔹 右側の入力欄に「保存されていた値」を流し込む
        if (reflectArray && reflectArray.length > 0) {
            setTimeout(() => {
                const summaryRows = summaryTableBody.querySelectorAll('tr');

                reflectArray.forEach(savedRow => {
                    const [sCheck, sName, sModel, sQty, sPrice] = savedRow;

                    summaryRows.forEach(row => {
                        const nameInTable = row.cells[1]?.innerText.trim();
                        if (nameInTable === sName) {
                            // 選定機種（型番）
                            const modelInput = row.cells[2]?.querySelector('input');
                            if (modelInput) modelInput.value = sModel || "";

                            // 単価
                            const priceInput = row.cells[4]?.querySelector('input');
                            if (priceInput) priceInput.value = sPrice || "0";

                            // 反映チェック
                            const chk = row.cells[0]?.querySelector('input[type="checkbox"]');
                            if (chk) chk.checked = sCheck;
                        }
                    });
                });
                console.log("集計テーブルの復元が完了しました");
            }, 50);
        }
    };

    // スクロール同期
    if (bulkScrollArea && interScrollArea) {
        bulkScrollArea.addEventListener('scroll', () => { interScrollArea.scrollTop = bulkScrollArea.scrollTop; });
        interScrollArea.addEventListener('scroll', () => { bulkScrollArea.scrollTop = interScrollArea.scrollTop; });
    }

    // 初期化：新規作成時のみ20行追加
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('id')) {
        for (let i = 0; i < 20; i++) { addInputRow(); }
    }

    if (addBulkRowBtn) {
        addBulkRowBtn.addEventListener('click', () => {
            addInputRow(false);
            updateAllTables();
            const rows = bulkTableBody.querySelectorAll('tr');
            const lastRow = rows[rows.length - 1];
            lastRow.querySelector('.memo-floor').focus();
        });
    }

    function addInputRow(shouldInherit = false) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center align-middle"><input type="checkbox" class="form-check-input row-reflect-check m-0" checked></td>
            <td><input type="text" class="form-control form-control-sm memo-floor text-center"></td>
            <td><input type="text" class="form-control form-control-sm memo-place"></td>
            <td><input type="text" class="form-control form-control-sm memo-type"></td>
            <td><input type="number" class="form-control form-control-sm memo-qty text-end"></td>
            <td><input type="text" class="form-control form-control-sm memo-shape"></td>
            <td><input type="text" class="form-control form-control-sm memo-note"></td>
            <td class="text-center"><button type="button" class="btn-delete-row"><i class="fa-solid fa-xmark"></i></button></td>
        `;
        bulkTableBody.appendChild(tr);

        tr.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                applyPseudoMerge();
                updateAllTables();
            });
            input.addEventListener('blur', applyPseudoMerge);
        });

        tr.querySelector('.row-reflect-check').addEventListener('change', (e) => {
            tr.classList.toggle('row-disabled', !e.target.checked);
            updateAllTables();
        });

        tr.querySelector('.btn-delete-row').addEventListener('click', () => {
            if (confirm('この行を削除しますか？')) {
                tr.remove();
                applyPseudoMerge();
                updateAllTables();
            }
        });
        applyPseudoMerge();
        return tr;
    }

    function applyPseudoMerge() {
        const rows = bulkTableBody.querySelectorAll('tr');
        let prevFloor = null;
        let prevPlace = null;

        rows.forEach(row => {
            const floorInput = row.querySelector('.memo-floor');
            const placeInput = row.querySelector('.memo-place');

            if (prevFloor !== null && floorInput.value === prevFloor && floorInput.value !== "") {
                floorInput.classList.add('duplicate-value');
            } else {
                floorInput.classList.remove('duplicate-value');
                prevFloor = floorInput.value;
            }

            if (prevPlace !== null && placeInput.value === prevPlace && placeInput.value !== "" && floorInput.classList.contains('duplicate-value')) {
                placeInput.classList.add('duplicate-value');
            } else {
                placeInput.classList.remove('duplicate-value');
                prevPlace = placeInput.value;
            }
        });
    }

    function updateAllTables() {
        const rows = bulkTableBody.querySelectorAll('tr');
        const summaryMap = new Map();
        let grandTotal = 0;

        intermediateTableBody.innerHTML = '';

        rows.forEach(row => {
            const isChecked = row.querySelector('.row-reflect-check').checked;
            const type = row.querySelector('.memo-type').value.trim();
            const qty = parseFloat(row.querySelector('.memo-qty').value) || 0;
            const shape = row.querySelector('.memo-shape').value.trim();

            const trInt = document.createElement('tr');
            if (isChecked) {
                const combinedName = type + shape;
                trInt.innerHTML = `<td class="align-middle">${combinedName}</td><td class="align-middle">${qty || ''}</td>`;
                grandTotal += qty;

                if (combinedName && (type || shape || qty > 0)) {
                    const current = summaryMap.get(combinedName) || { qty: 0 };
                    summaryMap.set(combinedName, { qty: current.qty + qty });
                }
            } else {
                trInt.innerHTML = `<td colspan="2" class="small">集計対象外</td>`;
                trInt.classList.add('row-disabled');
            }
            intermediateTableBody.appendChild(trInt);
        });

        document.getElementById('bulkTotalQty').textContent = grandTotal.toLocaleString();
        document.getElementById('interTotalQty').textContent = grandTotal.toLocaleString();
        document.getElementById('summaryTotalQty').textContent = grandTotal.toLocaleString();

        renderSummary(summaryMap);
    }

    function renderSummary(summaryMap) {
        // 現在の入力を一時保存
        const currentInputs = {};
        summaryTableBody.querySelectorAll('tr').forEach(row => {
            const name = row.cells[1]?.innerText.trim();
            if (name) {
                currentInputs[name] = {
                    checked: row.cells[0]?.querySelector('input[type="checkbox"]')?.checked,
                    model: row.cells[2]?.querySelector('input')?.value || "",
                    price: row.cells[4]?.querySelector('input')?.value || "0"
                };
            }
        });

        summaryTableBody.innerHTML = '';

        if (summaryMap.size === 0) {
            summaryTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">現場メモを入力すると集計されます</td></tr>';
            return;
        }

        summaryMap.forEach((data, name) => {
            const saved = currentInputs[name] || {};
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center">
                    <input type="checkbox" class="form-check-input" ${saved.checked !== false ? 'checked' : ''}>
                </td>
                <td class="fw-bold ps-3">${name}</td>
                <td>
                    <input type="text" class="form-control form-control-sm" placeholder="型番を入力" value="${saved.model || ''}">
                </td>
                <td class="text-end fw-bold pe-3">${data.qty}</td>
                <td>
                    <div class="input-group input-group-sm">
                        <span class="input-group-text">¥</span>
                        <input type="number" class="form-control text-end" value="${saved.price || '0'}">
                    </div>
                </td>
            `;
            summaryTableBody.appendChild(tr);
        });
    }

    // セル移動制御
    bulkTableBody.addEventListener('keydown', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT' || target.type === 'checkbox') return;

        const cell = target.closest('td');
        const row = target.closest('tr');
        const colIndex = Array.from(row.cells).indexOf(cell);

        let nextTarget = null;
        switch (e.key) {
            case 'ArrowRight':
                if (target.selectionStart === target.value.length) {
                    let nextCell = cell.nextElementSibling;
                    while (nextCell && !nextCell.querySelector('input[type="text"], input[type="number"]')) { nextCell = nextCell.nextElementSibling; }
                    nextTarget = nextCell?.querySelector('input');
                }
                break;
            case 'ArrowLeft':
                if (target.selectionStart === 0) {
                    let prevCell = cell.previousElementSibling;
                    while (prevCell && !prevCell.querySelector('input[type="text"], input[type="number"]')) { prevCell = prevCell.previousElementSibling; }
                    nextTarget = prevCell?.querySelector('input');
                }
                break;
            case 'ArrowDown':
                nextTarget = row.nextElementSibling?.cells[colIndex]?.querySelector('input');
                break;
            case 'ArrowUp':
                nextTarget = row.previousElementSibling?.cells[colIndex]?.querySelector('input');
                break;
            case 'Enter':
                e.preventDefault();
                nextTarget = row.nextElementSibling?.cells[colIndex]?.querySelector('input');
                break;
        }
        if (nextTarget) {
            nextTarget.focus();
            if (nextTarget.type === 'text') nextTarget.select();
        }
    });
});