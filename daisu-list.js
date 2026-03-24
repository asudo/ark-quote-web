document.addEventListener('DOMContentLoaded', () => {
    const bulkTableBody = document.getElementById('bulkTableBody');
    const intermediateTableBody = document.getElementById('intermediateTableBody');
    const summaryTableBody = document.getElementById('summaryTableBody');
    const addBulkRowBtn = document.getElementById('addBulkRowBtn');
    const bulkScrollArea = document.getElementById('bulkScrollArea');
    const interScrollArea = document.getElementById('interScrollArea');

    // スクロール同期
    if (bulkScrollArea && interScrollArea) {
        bulkScrollArea.addEventListener('scroll', () => { interScrollArea.scrollTop = bulkScrollArea.scrollTop; });
        interScrollArea.addEventListener('scroll', () => { bulkScrollArea.scrollTop = interScrollArea.scrollTop; });
    }

    // 初期化：20行
    for (let i = 0; i < 20; i++) { addInputRow(); }

    if (addBulkRowBtn) {
        addBulkRowBtn.addEventListener('click', () => {
            addInputRow(true); // 直前の行をコピー
            updateAllTables();
        });
    }

    function addInputRow(shouldInherit = false) {
        let lastFloor = "";
        let lastPlace = "";
        if (shouldInherit && bulkTableBody.lastElementChild) {
            lastFloor = bulkTableBody.lastElementChild.querySelector('.memo-floor').value;
            lastPlace = bulkTableBody.lastElementChild.querySelector('.memo-place').value;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="text-center align-middle"><input type="checkbox" class="form-check-input row-reflect-check m-0" checked></td>
            <td><input type="text" class="form-control form-control-sm memo-floor text-center" value="${lastFloor}"></td>
            <td><input type="text" class="form-control form-control-sm memo-place" value="${lastPlace}"></td>
            <td><input type="text" class="form-control form-control-sm memo-type"></td>
            <td><input type="number" class="form-control form-control-sm memo-qty text-end"></td>
            <td><input type="text" class="form-control form-control-sm memo-shape"></td>
            <td><input type="text" class="form-control form-control-sm memo-note"></td>
            <td class="text-center"><button type="button" class="btn-delete-row"><i class="fa-solid fa-xmark"></i></button></td>
        `;
        bulkTableBody.appendChild(tr);

        // イベント登録
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
    }

    // 🔹 擬似結合：上の行と同じ値なら透明にする処理
    function applyPseudoMerge() {
        const rows = bulkTableBody.querySelectorAll('tr');
        let prevFloor = null;
        let prevPlace = null;

        rows.forEach(row => {
            const floorInput = row.querySelector('.memo-floor');
            const placeInput = row.querySelector('.memo-place');

            // 階の判定
            if (prevFloor !== null && floorInput.value === prevFloor && floorInput.value !== "") {
                floorInput.classList.add('duplicate-value');
            } else {
                floorInput.classList.remove('duplicate-value');
                prevFloor = floorInput.value;
            }

            // 場所の判定
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
                // チェック外れている場合はグレーアウト表示
                trInt.innerHTML = `<td colspan="2" class="small">集計対象外</td>`;
                trInt.classList.add('row-disabled');
            }
            intermediateTableBody.appendChild(trInt);
        });

        // 🔹 3箇所の合計表示を更新
        document.getElementById('bulkTotalQty').textContent = grandTotal.toLocaleString();
        document.getElementById('interTotalQty').textContent = grandTotal.toLocaleString();
        document.getElementById('summaryTotalQty').textContent = grandTotal.toLocaleString();

        renderSummary(summaryMap);
    }

    function renderSummary(summaryMap) {
        summaryTableBody.innerHTML = '';
        if (summaryMap.size === 0) {
            summaryTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3">現場メモを入力すると集計されます</td></tr>';
            return;
        }
        summaryMap.forEach((data, name) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="text-center"><input type="checkbox" class="form-check-input" checked></td>
                <td class="fw-bold ps-3">${name}</td>
                <td><input type="text" class="form-control form-control-sm" placeholder="型番を入力"></td>
                <td class="text-end fw-bold pe-3">${data.qty}</td>
                <td><div class="input-group input-group-sm"><span class="input-group-text">¥</span><input type="number" class="form-control text-end" value="0"></div></td>
            `;
            summaryTableBody.appendChild(tr);
        });
    }

    updateAllTables();

    // 🔹 セル移動の制御を追加
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
                    while (nextCell && !nextCell.querySelector('input[type="text"], input[type="number"]')) {
                        nextCell = nextCell.nextElementSibling;
                    }
                    nextTarget = nextCell?.querySelector('input');
                }
                break;
            case 'ArrowLeft':
                if (target.selectionStart === 0) {
                    let prevCell = cell.previousElementSibling;
                    while (prevCell && !prevCell.querySelector('input[type="text"], input[type="number"]')) {
                        prevCell = prevCell.previousElementSibling;
                    }
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