let userMasterList = [];
let customerMaster = [];
let customerContactMaster = [];

document.addEventListener("DOMContentLoaded", async function () {

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
    toggle(); // 初期化
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
    const savedName = sessionStorage.getItem('userName');
    if (creatorSelect) {
      creatorSelect.innerHTML = '<option value="">選択してください</option>';
      userMasterList.forEach(user => {
        const opt = new Option(user.user_name, user.user_name);
        if (user.user_name === savedName) opt.selected = true;
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

    const calculateDates = (val) => {
      if (!val) return;
      const date = new Date(val);
      if (isNaN(date.getTime())) return;

      const yy = date.getFullYear().toString().slice(-2);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      if (estNo3Input) estNo3Input.value = `${yy}${mm}`;

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
  }

  // --- 4. イベント登録 ---
  document.getElementById("destinationInput")?.addEventListener("input", handleDestinationChange);
  document.getElementById("contactInput")?.addEventListener("input", handleContactChange);
  document.getElementById("creatorSelect")?.addEventListener("change", syncCreatorInitial);

  loadDatabaseMasters();
});

// --- 5. 見積番号の最終合算 ---
setInterval(() => {
  const fieldIds = ["estimateNo1", "estimateNo2", "estimateNo3", "estimateNo4", "estimateNo5", "estimateNo6"];
  const values = fieldIds.map(id => document.getElementById(id)?.value.trim() || "");
  const output = document.getElementById("estimateNo");
  const extra = document.getElementById("estimateNo7")?.value.trim() || "";

  if (values.every(val => val !== "")) {
    output.value = values.join("") + extra;
  } else {
    output.value = "";
  }
}, 500);

// 作成者イニシャル同期
function syncCreatorInitial() {
  const creatorSelect = document.getElementById("creatorSelect");
  const estNo5Input = document.getElementById("estimateNo5");
  const user = userMasterList.find(u => u.user_name === creatorSelect.value);
  if (estNo5Input) estNo5Input.value = user ? user.user_initial : "";
}