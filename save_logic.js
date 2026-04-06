/**
 * save_logic.js
 * 役割：【データの永続化と復元】の全体統合ロジック
 * 主な処理：全タブの入力データを一つの「JSONB型」ペイロードとして集約し、
 * Supabaseのestimatesテーブルへ保存・更新。
 * JSONBの特性を活かし、複雑な階層データも構造を維持したまま効率的に格納する。
 * また、URLパラメータのIDに基づき過去データを取得し、各復元関数を順次実行して画面状態を再構築する。
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("save_logic.js が正常に読み込まれました");
    // =============================================================
    // 0. データの復元ロジック (URLにIDまたはcopy_fromがある場合)
    // =============================================================
    const urlParams = new URLSearchParams(window.location.search);
    const estimateId = urlParams.get('id');
    const copyFromId = urlParams.get('copy_from');
    const isCopying = !!copyFromId; // 🌟 コピー中かどうかのフラグ

    // 🌟 【重要】まずマスタの読み込みを完了させ、反映まで少し待つ
    if (typeof loadDatabaseMasters === 'function') {
        await loadDatabaseMasters();
        await new Promise(resolve => setTimeout(resolve, 300)); // DOM構築の猶予
    }

    if (estimateId) {
        console.log("既存データの復元を開始します ID:", estimateId);
        await loadEstimateData(estimateId);
    } else if (copyFromId) {
        console.log("コピー元データからの復元を開始します ID:", copyFromId);
        await loadEstimateData(copyFromId, true);
    } else {
        // 🌟 ここに追加！（新規作成時）
        updateButtonDisplay(null, false);
    }

    async function loadEstimateData(id, isCopy = false) {
        try {
            const { data, error } = await supabaseClient
                .from('estimates')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data || !data.content_data) return;

            // --- 0. 共通項目（件名・日時）の表示 ---
            const projectNameInput = document.getElementById('projectNameInput');
            if (projectNameInput) projectNameInput.value = data.project_name || "";

            const lastUpdatedEl = document.getElementById('lastUpdated');
            if (lastUpdatedEl && data.updated_at) {
                const date = new Date(data.updated_at);
                lastUpdatedEl.textContent = date.toLocaleString('ja-JP', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
            }

            const content = data.content_data;
            console.log("--- 復元フェーズ開始 ---");

            // =============================================================
            // STEP 1: 「計算・行生成」が発生するサブタブを先に復元
            // =============================================================
            // ※これらが完全に終わるのを await で待ちます

            // A. 台数一覧
            if (typeof window.restoreDaisuData === 'function') {
                console.log("STEP 1-A: 台数一覧の復元");
                await window.restoreDaisuData(content);
            }

            // B. 施工内容タブ (main_form2.js)
            if (content.main_form2 && typeof window.restoreMainForm2Data === 'function') {
                console.log("STEP 1-B: 施工内容の復元（計算待ち含む）");
                await window.restoreMainForm2Data(content.main_form2);

                // 出勤簿などの行復元
                if (content.main_form2.attendanceTable && typeof window.restoreAttendanceRows === 'function') {
                    await window.restoreAttendanceRows(content.main_form2.attendanceTable, content.main_form2.targetTable);
                }
            }

            // C. A材・B材
            if (content.a_material && typeof window.restoreMaterialData === 'function') {
                await window.restoreMaterialData('a', content.a_material);
            }
            if (content.b_material && typeof window.restoreMaterialData === 'function') {
                await window.restoreMaterialData('b', content.b_material);
            }

            // 🌟 物理的な「計算待ち」時間を置く（重要：集計ロジックの衝突回避）
            await new Promise(resolve => setTimeout(resolve, 300));

            // =============================================================
            // STEP 2: 【最重要】見積web(基本情報)を最後に確定復元
            // =============================================================
            if (content.main_form1 && typeof window.restoreMainFormData === 'function') {
                console.log("STEP 2: 見積web(基本情報)の最終書き込み");
                const restoreData = {
                    ...content.main_form1,
                    estimate_no: data.estimate_no,
                    serial_number: data.serial_number,
                    revision_number: data.revision_number || content.main_form1.estimate_no7,
                    status: data.status,
                    project_name: data.project_name
                };

                // 他のタブの干渉を受けないよう最後に実行
                await window.restoreMainFormData(restoreData);
            }

            // =============================================================
            // STEP 3: コピー時専用の最終クリーンアップ
            // =============================================================
            if (isCopy) {
                const estNo7 = document.getElementById('estimateNo7');
                if (estNo7) {
                    estNo7.value = "";
                }
                if (lastUpdatedEl) lastUpdatedEl.textContent = "新規作成（コピー）";

                // 最後に作成者だけ、他のJSに上書きされないようダメ押しでセット
                setTimeout(() => {
                    if (content.main_form1.creator_name) {
                        const el = document.getElementById('creatorSelect');
                        if (el) el.value = content.main_form1.creator_name;
                    }
                    if (typeof updateFullEstimateNo === 'function') updateFullEstimateNo();
                    console.log("コピー工程がすべて完了しました");
                }, 200);
            } else {
                console.log("復元工程がすべて完了しました");
            }
            updateButtonDisplay(data.status, isCopy)

        } catch (err) {
            console.error("復元エラー:", err);
            alert("データの取得に失敗しました。");
        }
    }

    // テーブル内のイベント（削除・入力検知）をまとめて登録する関数
    function rebindTableEvents() {
        const bulkTableBody = document.getElementById('bulkTableBody');
        if (!bulkTableBody) return;

        // 削除ボタン
        bulkTableBody.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.onclick = function () {
                btn.closest('tr').remove();
                if (typeof calculateAll === 'function') calculateAll();
            };
        });

        // 入力時の自動計算
        bulkTableBody.querySelectorAll('input').forEach(input => {
            input.oninput = function () {
                if (typeof calculateAll === 'function') calculateAll();
            };
        });
    }

    // 🌟 ボタンの表示制御（出し分け）ロジック
    function updateButtonDisplay(status, isCopying) {
        const btnSaveTemp = document.getElementById('btn-save-temp'); // 一時保存ボタン
        const btnComplete = document.getElementById('btn-complete');  // 見積確定ボタン

        if (!btnSaveTemp || !btnComplete) return;

        // 【ルール】確定済み(final) かつ コピー中でない 時は「一時保存」を隠す
        if (status === 'final' && !isCopying) {
            btnSaveTemp.style.display = 'none';
            btnComplete.innerText = '確定データを更新'; // ボタン文言を更新用に変更
        } else {
            // 新規・下書き・コピー時は両方表示
            btnSaveTemp.style.display = 'inline-block';
            btnComplete.innerText = '見積確定';
        }
    }

    // =============================================================
    // 1. ボタンのイベントリスナー登録
    // =============================================================

    const btnSaveTemp = document.getElementById('btn-save-temp');
    if (btnSaveTemp) {
        btnSaveTemp.addEventListener('click', (e) => {
            console.log("--- 一時保存ボタンが押されました ---");
            executeSave('draft');
        });
    }

    const btnComplete = document.getElementById('btn-complete');
    if (btnComplete) {
        btnComplete.addEventListener('click', () => {
            if (confirm('見積を確定して登録しますか？')) {
                executeSave('final');
            }
        });
    }

    // =============================================================
    // 2. 保存実行メインロジック
    // =============================================================
    window.executeSave = executeSave;

    async function executeSave(status) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const estimateId = urlParams.get('id');

            const { data: { user } } = await supabaseClient.auth.getUser();
            if (!user) {
                alert("ログインしてください。");
                return;
            }

            // --- A. 台数一覧データの取得 (daisu-list.js 担当分) ---
            const daisuListData = [];
            document.querySelectorAll('#bulkTableBody tr').forEach(row => {
                const floor = row.querySelector('.memo-floor')?.value.trim() || "";
                const place = row.querySelector('.memo-place')?.value.trim() || "";
                const type = row.querySelector('.memo-type')?.value.trim() || "";
                const qty = row.querySelector('.memo-qty')?.value.trim() || "";
                const shape = row.querySelector('.memo-shape')?.value.trim() || "";
                const note = row.querySelector('.memo-note')?.value.trim() || "";

                if (floor || place || type || qty !== "" || shape || note) {
                    const isChecked = row.querySelector('.row-reflect-check')?.checked || false;
                    daisuListData.push([isChecked, floor, place, type, qty, shape, note]);
                }
            });

            // --- 集計テーブル（選定機種・単価）のデータ収集 ---
            const daisuReflectData = [];
            document.querySelectorAll('#summaryTableBody tr').forEach(row => {
                // セルが足りない行（初期メッセージ行など）は無視
                if (row.cells.length < 5) return;

                const name = row.cells[1]?.innerText.trim();
                // プレースホルダー行をスキップ
                if (!name || name.includes("追加すると集計されます") || name.includes("入力すると集計されます")) return;

                // 各要素を確実に取得
                const isChecked = row.cells[0]?.querySelector('input[type="checkbox"]')?.checked || false;
                const model = row.cells[2]?.querySelector('input')?.value.trim() || ""; // 選定機種(型番)
                const qty = row.cells[3]?.innerText.trim() || "0";                      // 合計数量
                const price = row.cells[4]?.querySelector('input')?.value.trim() || "0"; // 単価

                daisuReflectData.push([
                    isChecked,
                    name,
                    model,
                    qty,
                    price
                ]);
            });

            // --- B. main_form1.js 担当分のデータ収集 ---
            const mainFormData = {
                company_id: document.getElementById('companySelect')?.value || "",
                creator_name: document.getElementById('creatorSelect')?.value || "",
                destination: document.getElementById('destinationInput')?.value || "",
                contact: document.getElementById('contactInput')?.value || "",
                limit_date: document.getElementById('limitDate')?.value || "",
                estimate_no: document.getElementById('estimateNo')?.value || "",
                estimate_no1: document.getElementById('estimateNo1')?.value || "",
                estimate_no2: document.getElementById('estimateNo2')?.value || "",
                estimate_no3: document.getElementById('estimateNo3')?.value || "",
                estimate_no4: document.getElementById('estimateNo4')?.value || "",
                estimate_no5: document.getElementById('estimateNo5')?.value || "",
                estimate_no6: document.getElementById('estimateNo6')?.value || "",
                estimate_no7: document.getElementById('estimateNo7')?.value || "",
                revision_number: document.getElementById('estimateNo7')?.value || "",
                kouji_type: document.querySelector('input[name="koujiType"]:checked')?.value || "",
                work_company: document.getElementById('workCompany')?.value || "",
                work_address: document.getElementById('workAddress')?.value || "",
                estimate_date: document.getElementById('estimateDate')?.value || "",
                summary_type: document.querySelector('input[name="summary"]:checked')?.value || "",
                work_content: document.getElementById('workContent')?.value || "",
                work_detail: document.getElementById('workDetail')?.value || "",
                work_frequency: document.getElementById('workTypeSelect')?.value || "",
                start_date: document.getElementById('startDate')?.value || "",
                delivery_date: document.getElementById('deliveryDate')?.value || "",
                distance: document.getElementById('distanceSelect')?.value || "",
                environment: document.getElementById('environmentSelect')?.value || "",
                sanpai_status: document.querySelector('input[name="sanpaiStatus"]:checked')?.value || "",
                manifesto_status: document.querySelector('input[name="manifestoStatus"]:checked')?.value || "",
                is_process_sheet: document.getElementById('processSheet')?.checked || false,
                is_year_end: document.getElementById('yearEnd')?.checked || false,
                is_fiscal_end: document.getElementById('fiscalEnd')?.checked || false
            };
            // =============================================================
            // 🌟 修正：エラー時に枝番(No7)へカーソルを合わせる(focus)
            // =============================================================
            const estimateDate = mainFormData.estimate_date;
            const isCopying = urlParams.has('copy_from');

            let finalSerialNumber;
            let finalEstimateNo;

            // 枝番入力欄の要素を取得しておく
            const estNo7Input = document.getElementById("estimateNo7");
            const revisionNumber = estNo7Input?.value?.trim() || "";

            // 1. 🌟 未入力チェック
            if (isCopying || status === 'final') {
                if (!revisionNumber) {
                    alert("エラー：枝番（見積番号⑦）が入力されていません。\nコピー時は必ず枝番（01, AAなど）を入力してください。");

                    // カーソルを枝番に合わせて、背景を少し目立たせる（任意）
                    estNo7Input?.focus();
                    return;
                }
            }

            // 2. 保存する番号（No4）の確定処理
            if (status === 'final') {
                if (typeof window.getNextSerialNumber === 'function' && estimateDate) {
                    const yy = estimateDate.slice(2, 4);
                    const mm = estimateDate.slice(5, 7);
                    const yearMonth = `${yy}${mm}`;

                    const nextSer = await window.getNextSerialNumber(yearMonth);
                    finalSerialNumber = nextSer;
                    const finalNo4 = String(finalSerialNumber).padStart(2, '0');
                    finalEstimateNo = `${mainFormData.estimate_no1}${mainFormData.estimate_no2}${mainFormData.estimate_no3}${finalNo4}${mainFormData.estimate_no5}${mainFormData.estimate_no6}${revisionNumber}`;
                } else {
                    finalSerialNumber = parseInt(document.getElementById("estimateNo4")?.value) || 0;
                    finalEstimateNo = document.getElementById("estimateNo")?.value || "";
                }
            } else {
                finalSerialNumber = isCopying ? (parseInt(document.getElementById("estimateNo4")?.value) || 0) : null;
                finalEstimateNo = document.getElementById("estimateNo")?.value || "";
            }

            // 3. 🌟 重複チェック
            if (!estimateId && finalSerialNumber !== null) {
                const { data: existing, error: checkError } = await supabaseClient
                    .from('estimates')
                    .select('id')
                    .eq('serial_number', finalSerialNumber)
                    .eq('revision_number', revisionNumber)
                    .maybeSingle();

                if (existing) {
                    alert(`エラー：見積番号④ [${finalSerialNumber}] と 枝番 [${revisionNumber}] の組み合わせは既に存在します。\n別の枝番を入力してください。`);

                    // 重複したときもカーソルを合わせ、さらに入力内容を選択状態にする（消しやすいように）
                    estNo7Input?.focus();
                    estNo7Input?.select();
                    return;
                }
                if (checkError) console.error("重複チェックエラー:", checkError);
            }

            // 🔹 C. main_form2.js（施工内容タブ）のデータ収集
            const highWorkRows = [];
            document.querySelectorAll('#highWorkSection tbody tr').forEach(row => {
                const inputs = row.querySelectorAll('input');
                if (inputs.length >= 9) {
                    highWorkRows.push({
                        selected: inputs[0].checked,
                        itemName: row.cells[1].innerText.trim(),
                        qty: inputs[1].value,
                        unit: inputs[2].value,
                        price: inputs[3].value,
                        transport: inputs[4].value,
                        totalPrice: inputs[5].value,
                        subtotal: inputs[6].value,
                        memo1: inputs[7].value,
                        memo2: inputs[8].value
                    });
                }
            });

            // 💡 駐車場代の値を保存するために、テーブル内から該当行を特定して取得
            let pQty = "1";
            let pPrice = "4000"; // 初期値に合わせる

            const pRow = document.querySelector('tr[data-item-name="駐車場代"]');
            if (pRow) {
                pQty = pRow.querySelector('.parking-qty-input')?.value || "1";
                pPrice = pRow.querySelector('.parking-direct-input')?.value || "4000";
            }

            // --- メインテーブル（施工内容）の全行データを収集 ---
            const constructionTableData = [];
            document.querySelectorAll('#constructionTableBody tr').forEach(row => {
                // 駐車場代の行は別途個別に保存しているため、ループ内ではスキップ
                if (row.getAttribute('data-item-name') === '駐車場代') return;

                // 各セルのデータおよび入力を取得
                constructionTableData.push({
                    itemName: row.cells[2]?.innerText.trim() || "",         // 項目
                    touyo: row.cells[3]?.innerText.trim() || "",            // 灯用
                    qty: row.cells[4]?.innerText.trim() || "0",            // 💡修正：innerTextから取得
                    unit: row.cells[5]?.innerText.trim() || "",             // 単位
                    content: row.cells[6]?.innerText.trim() || "",          // 内容
                    honsu: row.cells[7]?.innerText.trim() || "0",           // 💡修正：innerTextから取得
                    basePrice: row.cells[8]?.innerText.trim() || "0",       // 💡修正：innerTextから取得

                    // 係数チェック状態
                    checks: {
                        day: row.cells[9]?.innerText.trim() !== "0",
                        night: row.cells[10]?.innerText.trim() !== "0",
                        high: row.cells[11]?.innerText.trim() !== "0",
                        special: row.cells[12]?.innerText.trim() !== "0",
                        waste: row.cells[13]?.innerText.trim() !== "0"
                    },

                    adjustment: row.cells[14]?.innerText.trim() || "0",      // 💡修正：innerTextから取得
                    finalPrice: row.cells[15]?.innerText.trim() || "0",            // 確定単価
                    subtotal: row.cells[16]?.innerText.trim() || "0",              // 小計
                    keisu: row.cells[17]?.querySelector('select')?.value || "off"    // 係数
                });
            });

            // 💡 単価グループ（手入力項目）の個別収集
            const unitPriceGroup = {
                highAltitudeVehicleCost: document.getElementById('highAltitudeVehicleCost')?.value || "￥0",
                surveyFee: document.getElementById('surveyFee')?.value || "0",
                isSurveyFeeManual: (typeof isSurveyFeeManual !== 'undefined') ? isSurveyFeeManual : false
            };

            // --- 💡 出勤管理テーブル（上の表）のデータ収集 ---
            const attendanceRows = [];
            document.querySelectorAll('#attendance-body .attendance-row').forEach(row => {
                const cells = row.querySelectorAll('.attendance-cell');
                const marks = Array.from(cells).map(cell => cell.textContent === '〇');
                attendanceRows.push(marks); // 各行の [true, false, ...] 配列を入れる
            });

            // --- 💡 日付・目標（下の表）のデータ収集 ---
            const targetRowsData = [];
            // IDを '#target-schedule-body' に修正します
            const targetTbody = document.getElementById('target-schedule-body');

            if (targetTbody) {
                targetTbody.querySelectorAll('tr').forEach(row => {
                    const dateInput = row.querySelector('.target-date-input');
                    targetRowsData.push({
                        // 入力されている「2026/03/27(金)」などの文字列をそのまま取得
                        date: dateInput ? dateInput.value : ""
                    });
                });
            } else {
                console.warn("警告: target-schedule-body が見つかりません。日付データは保存されません。");
            }

            // スタッフ情報の詳細（氏名・単価など）を収集
            const staffDetails = [];
            const scrollTopTable = document.getElementById('scroll-top');
            if (scrollTopTable) {
                const nameInputs = scrollTopTable.querySelectorAll('thead tr:nth-child(2) input');
                const typeInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(1) input');
                const priceInputs = scrollTopTable.querySelectorAll('tbody tr.row-unit-price input');
                const transportInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(3) input');
                const stayInputs = scrollTopTable.querySelectorAll('tbody tr:nth-child(4) input');

                for (let i = 0; i < 10; i++) {
                    staffDetails.push({
                        name: nameInputs[i]?.value || "",
                        type: typeInputs[i]?.value || "",
                        unitPrice: priceInputs[i]?.value || "0",
                        transport: transportInputs[i]?.value || "0",
                        stay: stayInputs[i]?.value || "0"
                    });
                }
            }

            const mainForm2Data = {
                // 基本情報
                addressee: document.getElementById('addressee')?.value || "",
                companyName: document.getElementById('companyName')?.value || "",

                // 高所作業車関連
                hasHighWorkCar: document.getElementById('highWorkCar')?.checked || false,
                ceilingHeight1: document.getElementById('ceilingHeight1')?.value || "",
                ceilingHeight2: document.getElementById('ceilingHeight2')?.value || "",
                highWorkTable: highWorkRows,

                // --- 💡 追加：メインテーブルの配列データ ---
                constructionTable: constructionTableData,

                // 各種合計金額・値引き
                finalEstimatedPrice: document.getElementById('finalEstimatedPrice')?.value || "￥0",
                budgetDiscount: document.getElementById('budgetDiscount')?.value || "0",
                laborTotal: document.getElementById('displayLaborTotal')?.value || "￥0",
                highWorkTotal: document.getElementById('displayHighWorkTotal')?.value || "￥0",
                materialA: document.getElementById('displayMaterialA')?.value || "￥0",
                materialB: document.getElementById('displayMaterialB')?.value || "￥0",

                // 割増率（係数）
                rate_day: document.getElementById('rate_day')?.value || "0.5",
                rate_night: document.getElementById('rate_night')?.value || "0.5",
                rate_high: document.getElementById('rate_high')?.value || "0.2",
                rate_special: document.getElementById('rate_special')?.value || "0.15",
                rate_waste: document.getElementById('rate_waste')?.value || "0.15",

                // 駐車場代フラグと詳細値
                isParkingAdded: document.getElementById('parkingCheck')?.checked || false,
                parkingQty: pQty,
                parkingPrice: pPrice,

                // 💡 単価セクションとしてまとめて保存
                unitPriceInfo: unitPriceGroup,
                staffList: staffDetails,

                // 💡 これを追記
                attendanceTable: attendanceRows,
                targetTable: targetRowsData,
            };

            // --- E. A材 (main_form3.js) のデータ収集 ---
            const aMaterialTableData = [];
            document.querySelectorAll('#a-itemTableBody tr').forEach(row => {
                // 「データ未入力」の行はスキップ
                if (row.cells.length < 2) return;

                aMaterialTableData.push({
                    name: row.cells[2]?.innerText.trim(),         // 名称
                    spec: row.cells[3]?.innerText.trim(),         // 規格
                    qty: row.cells[4]?.innerText.trim(),          // 数量
                    unit: row.cells[5]?.innerText.trim(),         // 単位
                    unitPrice: row.cells[6]?.innerText.trim(),    // 単価
                    amount: row.cells[7]?.innerText.trim(),       // 金額
                    remark: row.cells[8]?.innerText.trim(),       // 備考
                    listPrice: row.cells[9]?.innerText.trim(),    // 定価
                    listTotal: row.cells[10]?.innerText.trim(),   // 定価合計
                    costPrice: row.cells[11]?.innerText.trim(),   // 入値
                    costTotal: row.cells[12]?.innerText.trim(),   // 入値合計
                    costRate: row.cells[13]?.innerText.trim(),    // 入値率
                    sellRate: row.cells[14]?.innerText.trim(),    // 売値率
                    itemName: row.cells[15]?.innerText.trim(),    // 項目名
                    actual: row.cells[16]?.innerText.trim(),      // 実数
                    company: row.cells[17]?.innerText.trim()      // 見積会社
                });
            });

            const aMaterialData = {
                isAddedToBudget: document.getElementById('aMaterialCheck')?.checked || false,
                sellCoefficient: document.getElementById('a-sell-coefficient')?.value || "1.3",
                tableData: aMaterialTableData
            };

            // --- F. B材 (main_form4.js) のデータ収集 ---
            const bMaterialTableData = [];
            document.querySelectorAll('#b-itemTableBody tr').forEach(row => {
                // 行が空、または初期メッセージ行（colspanがあるもの）はスキップ
                if (row.cells.length < 2 || row.querySelector('td[colspan]')) return;

                bMaterialTableData.push({
                    name: row.cells[2]?.innerText.trim(),         // 名称
                    spec: row.cells[3]?.innerText.trim(),         // 規格
                    qty: row.cells[4]?.innerText.trim(),          // 数量
                    unit: row.cells[5]?.innerText.trim(),         // 単位
                    unitPrice: row.cells[6]?.innerText.trim(),    // 単価
                    amount: row.cells[7]?.innerText.trim(),       // 金額
                    remark: row.cells[8]?.innerText.trim(),       // 備考
                    listPrice: row.cells[9]?.innerText.trim(),    // 定価
                    listTotal: row.cells[10]?.innerText.trim(),   // 定価合計
                    costPrice: row.cells[11]?.innerText.trim(),   // 入値
                    costTotal: row.cells[12]?.innerText.trim(),   // 入値合計
                    costRate: row.cells[13]?.innerText.trim(),    // 入値率
                    sellRate: row.cells[14]?.innerText.trim(),    // 売値率
                    itemName: row.cells[15]?.innerText.trim(),    // 項目名
                    actual: row.cells[16]?.innerText.trim(),      // 実数
                    company: row.cells[17]?.innerText.trim()      // 見積会社
                });
            });

            const bMaterialData = {
                isAddedToBudget: document.getElementById('bMaterialCheck')?.checked || false,
                tableData: bMaterialTableData
            };

            // --- F. ペイロードの組み立て (newContentDataに追加) ---
            const newContentData = {
                daisu_list: daisuListData,
                daisu_reflect: daisuReflectData,
                main_form1: mainFormData,
                main_form2: mainForm2Data,
                a_material: aMaterialData,
                b_material: bMaterialData
            };

            const payload = {
                project_name: document.getElementById('projectNameInput')?.value || "件名なし",
                estimate_no: finalEstimateNo,
                serial_number: finalSerialNumber, // Integer (数値)
                revision_number: revisionNumber,   // Text (文字列)
                estimate_date: estimateDate,
                company_id: mainFormData.company_id,
                creator_name: mainFormData.creator_name,
                destination: mainFormData.destination,
                status: status,
                content_data: newContentData
            };
            console.log("保存するデータ(daisu_reflect):", daisuReflectData);

            // --- E. Supabaseへの保存実行 ---
            let result;
            if (estimateId) {
                result = await supabaseClient.from('estimates').update(payload).eq('id', estimateId).select();
            } else {
                result = await supabaseClient.from('estimates').insert([payload]).select();
            }

            if (result.error) throw result.error;

            const lastUpdatedEl = document.getElementById('lastUpdated');
            if (lastUpdatedEl) {
                const now = new Date();
                lastUpdatedEl.textContent = now.toLocaleString('ja-JP', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                });
            }

            if (!window.isLeaving) {
                alert(status === 'final' ? "確定しました！" : "保存しました。");
            }

            if (!estimateId && result.data && result.data[0]) {
                const newId = result.data[0].id;
                window.history.replaceState(null, '', `index.html?id=${newId}`);
            }
            if (status === 'final') window.location.href = 'menu.html';

        } catch (err) {
            console.error('保存失敗:', err);
            alert('エラー: ' + err.message);
        }
    }
});

// =============================================================
// 3. モダン離脱ガード & ログアウト制御
// =============================================================
let isDirty = false;
let pendingUrl = "";

// 変更検知
document.addEventListener('input', () => { isDirty = true; });

// 保存完了時はフラグOFF
const resetDirty = () => { isDirty = false; };
document.getElementById('btn-save-temp')?.addEventListener('click', resetDirty);
document.getElementById('btn-complete')?.addEventListener('click', resetDirty);

// --- 💡 修正版：リンクやボタンのクリックイベント ---
document.querySelectorAll('.dropdown-item, .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        // ⭐ 修正ポイント：ここでは isDirty = false にしない！
        // ログアウトボタン自体は onclick="handleLogout()" で動くので、離脱ガードとしては完全に無視するだけにする
        if (link.id === 'logout-btn') {
            return;
        }

        // 変更がない、またはリンクが無効な場合はスルー
        if (!isDirty || !link.href || link.href.includes('#')) return;

        // 変更がある場合のみ、移動を止めてモーダルを出す
        e.preventDefault();
        pendingUrl = link.href;
        const myModal = new bootstrap.Modal(document.getElementById('leaveConfirmModal'));
        myModal.show();
    });
});

// --- 🔓 ログアウト処理の実体 ---
async function handleLogout() {
    // ⭐ 修正ポイント：confirmで「OK」を押したときだけ isDirty を折る
    if (confirm('ログアウトしますか？（未保存の内容は破棄されます）')) {
        try {
            isDirty = false; // ここで初めて「保存しなくてOK」状態にする
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            window.location.href = "login.html";
        } catch (err) {
            console.error("ログアウト失敗:", err);
            alert("ログアウトに失敗しました。");
        }
    }
    // 「キャンセル」を押した場合は isDirty = true のままなので、他のリンクを押せばモーダルが出ます
}
window.handleLogout = handleLogout;

// --- 💾 モーダル内のボタン処理（変更なし） ---
document.getElementById('btn-save-and-leave')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>保存中...';
        window.isLeaving = true;
        await window.executeSave('draft');
        isDirty = false;
        window.location.href = pendingUrl;
    } catch (err) {
        console.error("離脱保存エラー:", err);
        btn.disabled = false;
        btn.innerHTML = originalText;
        window.isLeaving = false;
    }
});

document.getElementById('btn-leave-anyway')?.addEventListener('click', () => {
    isDirty = false;
    window.location.href = pendingUrl;
});