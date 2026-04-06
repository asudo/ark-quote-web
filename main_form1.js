/**
 * main_form1.js
 * 役割：【基本情報タブ】の入力制御とマスタ連動ロジック
 * 主な処理：顧客・担当者マスタの取得と連動、見積番号の自動生成、日付計算（有効期限など）、復元処理
 */

let userMasterList = [];
let customerMaster = [];
let customerContactMaster = [];

// 🌟 修正1：外部から呼び出せる共通関数を先に定義しておく
// (DOMContentLoadedの外に出すことで、どのタイミングでも呼び出し可能にします)
window.getNextBranchNumber = async function (serialNo) {
  try {
    const { data, error } = await supabaseClient
      .from('estimates')
      .select('revision_number')
      .eq('serial_number', serialNo)
      .order('revision_number', { ascending: false })
      .limit(1);

    if (error) throw error;
    if (data && data.length > 0) {
      // 既存の最大枝番に+1する（数値として計算し、2桁文字列で返す）
      const lastBranch = parseInt(data[0].revision_number || "0", 10);
      return String(lastBranch + 1).padStart(2, "0");
    }
    return "01"; // データがなければ 01 スタート
  } catch (err) {
    console.error('枝番取得エラー:', err);
    return "01";
  }
};

document.addEventListener("DOMContentLoaded", async function () {

  // --- 🔹 準備完了を待つためのユーティリティ ---
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // マスタデータが読み込まれるまで最大5秒待機する関数
  async function waitUntilMastersLoaded() {
    let attempts = 0;
    while (attempts < 50) { // 100ms × 50 = 5秒
      if (userMasterList.length > 0 && customerMaster.length > 0) {
        return true;
      }
      await sleep(100);
      attempts++;
    }
    return false;
  }

  // --- 🔹 復元用の窓口関数 ---
  window.restoreMainFormData = async function (data) {
    if (!data) return;

    // 1. マスタ読み込みを「完全に」待つ
    await waitUntilMastersLoaded();

    // --- A. 基本フィールドをセット（イベントを飛ばさず、まずは値だけ入れる） ---
    const setElementValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
      return el;
    };

    setElementValue('companySelect', data.company_id);
    setElementValue('destinationInput', data.destination);
    setElementValue('estimateDate', data.estimate_date);
    setElementValue('creatorSelect', data.creator_name);

    // --- B. 連動処理を「順番に」実行 ---
    // 宛先連動を実行
    if (typeof handleDestinationChange === 'function') {
      handleDestinationChange();
    }

    // 🌟 重要：datalistの生成を待つ
    let retry = 0;
    const contactOptions = document.getElementById('contactOptions');
    while (contactOptions && contactOptions.children.length <= 1 && retry < 20) {
      await new Promise(resolve => setTimeout(resolve, 50)); // sleepの代わり
      retry++;
    }

    // --- C. 担当者名をセット（リスト準備後） ---
    const contactEl = setElementValue('contactInput', data.contact);
    if (contactEl && typeof handleContactChange === 'function') {
      handleContactChange();
    }

    // --- D. その他のフィールドを一括セット ---
    const otherFields = {
      'limitDate': data.limit_date,
      'estimateNo': data.estimate_no,
      'estimateNo1': data.estimate_no1,
      'estimateNo2': data.estimate_no2,
      'estimateNo3': data.estimate_no3,
      // serial_number がある場合はそれを使用
      'estimateNo4': data.serial_number ? String(data.serial_number).padStart(2, '0') : (data.estimate_no4 || ""),
      'estimateNo5': data.estimate_no5,
      'estimateNo6': data.estimate_no6,
      'estimateNo7': data.revision_number || data.estimate_no7 || "",
      'workCompany': data.work_company,
      'workAddress': data.work_address,
      'workContent': data.work_content,
      'workDetail': data.work_detail,
      'workTypeSelect': data.work_frequency,
      'startDate': data.start_date,
      'deliveryDate': data.delivery_date,
      'distanceSelect': data.distance,
      'environmentSelect': data.environment
    };

    Object.keys(otherFields).forEach(id => setElementValue(id, otherFields[id]));

    // --- E. ラジオ・チェックボックスの復元（省略せず実行） ---
    const setRadioValue = (name, value) => {
      if (!value) return;
      const radio = document.querySelector(`input[name="${name}"][value="${value}"]`);
      if (radio) radio.checked = true;
    };
    setRadioValue('koujiType', data.kouji_type);
    setRadioValue('summary', data.summary_type);
    setRadioValue('sanpaiStatus', data.sanpai_status);
    setRadioValue('manifestoStatus', data.manifesto_status);

    // --- F. ダメ押しの「最終セット」 ---
    // 他のスクリプトによる上書きを防ぐため、少しだけ遅らせて重要な値を再度入れる
    setTimeout(() => {
      if (data.creator_name) document.getElementById('creatorSelect').value = data.creator_name;
      if (data.company_id) document.getElementById('companySelect').value = data.company_id;

      // 全体番号の再計算
      if (typeof updateFullEstimateNo === 'function') updateFullEstimateNo();
      console.log("復元処理の最終確定を行いました");
    }, 200);
  };

  // --- 1. Supabaseから全マスタデータを取得 ---
  async function loadDatabaseMasters() {
    try {
      const [custRes, contactRes, userRes] = await Promise.all([
        supabaseClient.from('customer_master').select('*'),
        supabaseClient.from('customer_contact_master').select('*'),
        supabaseClient.from('user_master').select('*').eq('is_active', true)
      ]);

      customerMaster = custRes.data || [];
      customerContactMaster = contactRes.data || [];
      userMasterList = userRes.data || [];

      initializeForm();
    } catch (err) {
      console.error("データベースの取得に失敗しました:", err);
    }
  }

  // --- 2. 各連動ロジックの定義 ---

  // A. 宛先（会社名）変更時の処理
  function handleDestinationChange() {
    const destInput = document.getElementById("destinationInput");
    const estNo2 = document.getElementById("estimateNo2");
    const contactDatalist = document.getElementById("contactOptions");

    const selectedCompanyName = destInput.value.trim();
    const customer = customerMaster.find(c => c.customer_name === selectedCompanyName);

    // --- 【見積番号2】 ---
    if (customer) {
      // マスタにあればそのイニシャル
      estNo2.value = customer.customer_initial;
    } else if (selectedCompanyName !== "") {
      // マスタにないが、何か入力されている場合は「ETC」
      estNo2.value = "ETC";
    } else {
      // 空欄なら空
      estNo2.value = "";
    }

    // 【担当者リスト】datalistの更新
    contactDatalist.innerHTML = "";
    if (customer) {
      const filteredContacts = customerContactMaster.filter(c => c.customer_id === customer.id);
      filteredContacts.forEach(contact => {
        const opt = document.createElement("option");
        opt.value = contact.contact_name;
        contactDatalist.appendChild(opt);
      });
    }

    // 共通担当者の追加
    const optUnknown = document.createElement("option");
    optUnknown.value = "不明";
    contactDatalist.appendChild(optUnknown);

    handleContactChange();
  }

  // B. 担当者 or 注文元 変更時 -> 【見積番号6】
  function handleContactChange() {
    const destInput = document.getElementById("destinationInput");
    const contactInput = document.getElementById("contactInput");
    const estNo6Input = document.getElementById("estimateNo6");

    const selectedCompanyName = destInput.value.trim();
    const selectedContactName = contactInput.value.trim();

    let initial = "";

    // 会社がマスタにあるか確認
    const customer = customerMaster.find(c => c.customer_name === selectedCompanyName);

    if (customer) {
      // 会社がマスタにある場合、その会社の担当者を探す
      const contact = customerContactMaster.find(c =>
        c.customer_id === customer.id && c.contact_name === selectedContactName
      );
      if (contact) {
        initial = contact.contact_initial;
      }
    }

    // 最終的にイニシャルが決まらない（手入力や不明）場合は「YY」
    // ただし、担当者名すら入力されていない場合は空
    if (selectedContactName === "") {
      estNo6Input.value = "";
    } else {
      estNo6Input.value = initial || "YY";
    }
  }

  // c. 割引チェック
  function setupDiscountToggle() {
    const discountCheck = document.getElementById("discountCheck");
    const discountAmount = document.getElementById("discountAmount");
    if (!discountCheck || !discountAmount) return;
    const toggle = () => {
      discountAmount.disabled = !discountCheck.checked;
      if (!discountCheck.checked) discountAmount.value = "";
    };
    discountCheck.addEventListener("change", toggle);
    toggle();
  }

  // D. 産業廃棄物とマニフェストの連動
  function setupSanpaiToggle() {
    const sanpaiNone = document.getElementById("sanpai_none");
    const sanpaiExists = document.getElementById("sanpai_exists");
    const manifestoRadios = document.querySelectorAll("input[name='manifestoStatus']");

    const toggle = () => {
      const isExists = sanpaiExists.checked;
      manifestoRadios.forEach(radio => {
        // 「あり」の時だけ活性化
        radio.disabled = !isExists;
        // 「なし」に戻った時は「不要」に強制リセット
        if (!isExists && radio.id === "manifesto_none") {
          radio.checked = true;
        }
      });
    };

    sanpaiNone.addEventListener("change", toggle);
    sanpaiExists.addEventListener("change", toggle);
    toggle();
  }

  // E. 工事種類連動
  function setupWorkContent() {
    const workContent = document.getElementById("workContent");
    const koujiRadios = document.querySelectorAll("input[name='koujiType']");
    const koujiContentMap = { "koujiType1": "照明LED化工事", "koujiType2": "空調設備工事" };
    const update = () => {
      const selected = document.querySelector("input[name='koujiType']:checked");
      if (selected) workContent.value = koujiContentMap[selected.id] || "";
    };
    koujiRadios.forEach(radio => radio.addEventListener("change", update));
    update();
  }

  // F. 案件バッジ連動（文字のみ更新）
  function updateProjectBadges() {
    const tagDisplay = document.getElementById('tagName');
    if (!tagDisplay) return;

    // チェックされているラジオボタンの値を取得
    const selectedType = document.querySelector('input[name="koujiType"]:checked')?.value;
    if (selectedType) {
      tagDisplay.innerText = selectedType;
    }
  }

  // 作成者イニシャル同期
  function syncCreatorInitial() {
    const creatorSelect = document.getElementById("creatorSelect");
    const estNo5Input = document.getElementById("estimateNo5");
    const user = userMasterList.find(u => u.user_name === creatorSelect.value);
    if (estNo5Input) estNo5Input.value = user ? user.user_initial : "";
  }

  // --- 3. フォーム初期化 ---
  function initializeForm() {
    // 宛先リスト生成
    const destList = document.getElementById("destinationList");
    if (destList) {
      destList.innerHTML = "";
      customerMaster.forEach(customer => {
        const opt = document.createElement("option");
        opt.value = customer.customer_name || "";
        destList.appendChild(opt);
      });
    }

    // 作成者リスト生成
    const creatorSelect = document.getElementById("creatorSelect");
    const currentVal = creatorSelect ? creatorSelect.value : "";
    const savedName = sessionStorage.getItem('userName');

    if (creatorSelect) {
      creatorSelect.innerHTML = '<option value="">選択してください</option>';
      userMasterList.forEach(user => {
        const opt = new Option(user.user_name, user.user_name);
        if (currentVal && user.user_name === currentVal) {
          opt.selected = true;
        } else if (!currentVal && user.user_name === savedName) {
          opt.selected = true;
        }
        creatorSelect.add(opt);
      });
      syncCreatorInitial();
    }

    // 会社コード初期化
    const companySelect = document.getElementById("companySelect");
    const estNo1 = document.getElementById("estimateNo1");
    const updateNo1 = () => {
      const map = { af: "AF", ak: "AK" };
      if (estNo1) estNo1.value = map[companySelect.value] || "";
    };
    companySelect?.addEventListener("change", updateNo1);
    updateNo1();

    // 日付と期限計算
    const estDateInput = document.getElementById("estimateDate");
    const limitDateInput = document.getElementById("limitDate");
    const estNo3Input = document.getElementById("estimateNo3");
    const estNo4Input = document.getElementById("estimateNo4");

    const calculateDates = async (val) => {
      if (!val) return;
      const date = new Date(val);
      if (isNaN(date.getTime())) return;

      const yy = date.getFullYear().toString().slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yearMonth = `${yy}${mm}`;

      if (estNo3Input) estNo3Input.value = yearMonth;

      const urlParams = new URLSearchParams(window.location.search);
      const isEditing = urlParams.has('id');
      const isCopying = urlParams.has('copy_from');

      if (!isEditing && !isCopying && typeof window.getNextSerialNumber === 'function') {
        const nextSeq = await window.getNextSerialNumber(yearMonth);
        if (estNo4Input) {
          estNo4Input.value = String(nextSeq).padStart(2, "0");
        }
      }

      const deadline = new Date(date);
      deadline.setMonth(deadline.getMonth() + 3);
      if (deadline.getDate() !== date.getDate()) deadline.setDate(0);

      if (limitDateInput) {
        const dYYYY = deadline.getFullYear();
        const dMM = String(deadline.getMonth() + 1).padStart(2, "0");
        const dDD = String(deadline.getDate()).padStart(2, "0");
        limitDateInput.value = `${dYYYY}-${dMM}-${dDD}`;
      }
    };

    if (estDateInput && !estDateInput.value) {
      const today = new Date();
      estDateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    }

    estDateInput?.addEventListener("change", (e) => calculateDates(e.target.value));
    if (estDateInput.value) calculateDates(estDateInput.value);

    setupDiscountToggle();
    setupWorkContent();
    setupSanpaiToggle();
    updateProjectBadges();
  }

  // --- 4. イベント登録 ---
  document.getElementById("destinationInput")?.addEventListener("input", handleDestinationChange);
  document.getElementById("contactInput")?.addEventListener("input", handleContactChange);
  document.getElementById("creatorSelect")?.addEventListener("change", syncCreatorInitial);
  document.querySelectorAll('input[name="koujiType"]').forEach(radio => {
    radio.addEventListener("change", updateProjectBadges);
  });

  // =============================================================
  // 🌟 実行ブロック：マスタ読み込み後にコピー復元を実行
  // =============================================================
  (async () => {
    // 1. まずマスタ読み込みを完了させ、リスト(select)を生成しきる
    await loadDatabaseMasters();

    // 2. URLパラメータを取得
    const urlParams = new URLSearchParams(window.location.search);
    const copyFromId = urlParams.get('copy_from');

    // 枝番入力欄と注釈の要素を取得
    const estNo7 = document.getElementById('estimateNo7');
    const branchNote = document.getElementById('branchNote');

    // 3. コピー処理がある場合のみ実行
    if (copyFromId) {
      try {
        console.log("コピー元IDを発見しました。復元を開始します...");

        const { data, error } = await supabaseClient
          .from('estimates')
          .select('*')
          .eq('id', copyFromId)
          .single();

        if (error || !data) throw error;

        // A. データの復元
        await window.restoreMainFormData(data);

        // B. 自動計算項目の強制発火（連動を確実にする）
        const companySelect = document.getElementById('companySelect');
        if (companySelect) companySelect.dispatchEvent(new Event('change'));

        if (typeof handleDestinationChange === 'function') handleDestinationChange();
        if (typeof handleContactChange === 'function') handleContactChange();

        const estDateInput = document.getElementById("estimateDate");
        if (estDateInput) estDateInput.dispatchEvent(new Event('change'));

        if (typeof syncCreatorInitial === 'function') syncCreatorInitial();

        // C. 🌟 枝番(No7)の制御（手入力モードへ切り替え）
        if (estNo7) {
          estNo7.value = "";           // コピー時は一旦空にする
          estNo7.readOnly = false;     // 入力可能にする
          estNo7.required = true;      // 保存時に必須チェックをかける

          // 見た目を強調（赤枠）
          estNo7.style.backgroundColor = "#ffffff";
          estNo7.style.border = "2px solid #ff4d4d";
          estNo7.placeholder = "例: 01";
        }

        // D. 注釈を赤字で強調
        if (branchNote) {
          branchNote.innerText = "※ コピー（改訂）のため、新しい枝番を半角英数字で入力してください。";
          branchNote.style.color = "#ff4d4d";
          branchNote.style.fontWeight = "bold";
        }

        console.log("コピー復元と枝番入力の準備が完了しました。");

      } catch (err) {
        console.error("コピー復元エラー:", err);
      }
    } else {
      // --- 新規作成時（コピーでない場合）のデフォルト設定 ---
      if (estNo7) {
        estNo7.readOnly = true;
        estNo7.style.backgroundColor = "#e9ecef";
        estNo7.value = "";
      }
    }
  })();

  // --- 5. 見積番号の最終合算（リアルタイム反映） ---
  setInterval(() => {
    // No7（枝番）も含めて取得
    const fieldIds = ["estimateNo1", "estimateNo2", "estimateNo3", "estimateNo4", "estimateNo5", "estimateNo6", "estimateNo7"];
    const values = fieldIds.map(id => document.getElementById(id)?.value.trim() || "");
    const output = document.getElementById("estimateNo");

    if (output) {
      const fullNo = values.join("");
      output.value = fullNo !== "" ? fullNo : "";
    }
  }, 500);

});