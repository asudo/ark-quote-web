document.addEventListener("DOMContentLoaded", function () {

  // 割引チェックボックスと金額入力連動
  function setupDiscountToggle() {
    const discountCheck = document.getElementById("discountCheck");
    const discountAmount = document.getElementById("discountAmount");
    if (!discountCheck || !discountAmount) return;

    function toggleDiscountInput() {
      discountAmount.disabled = !discountCheck.checked;
      if (!discountCheck.checked) discountAmount.value = "";
    }
    toggleDiscountInput();
    discountCheck.addEventListener("change", toggleDiscountInput);
  }

  // 宛先と担当者の連動システム
  function setupContactSystem() {
    const destInput = document.getElementById("destinationInput");
    const contactInput = document.getElementById("contactInput");
    const contactDatalist = document.getElementById("contactOptions");

    // 各会社固有の名簿
    const companyStaffData = {
      "リコージャパン株式会社": [
        "【ﾘｺｰ首都圏】石井 猛",
        "【ﾘｺｰ首都圏】志賀 孝浩",
        "【ﾘｺｰ西東京】根岸 徹",
        "【ﾘｺｰ西東京】小山 恒治",
        "【ﾘｺｰ群馬】藤野 智史",
        "【ﾘｺｰ群馬】池田 淳一",
        "【ﾘｺｰ群馬】田村",
        "【ﾘｺｰ群馬】渡辺 和弘",
        "【ﾘｺｰ千葉】内村 嘉朗",
        "【ﾘｺｰ埼玉】石川",
        "【ﾘｺｰ首都圏】大久保 博文",
        "【ﾘｺｰ首都圏】安喰 和弘",
        "【ﾘｺｰ首都圏】小針 重雄",
        "【ﾘｺｰ首都圏】青木 正人",
        "【ﾘｺｰ首都圏】長見 篤也",
        "【ﾘｺｰ神奈川】坂入"
      ],
      "株式会社サイホー": [
        "【ｻｲﾎｰ】戸野塚 直樹",
        "【ｻｲﾎｰ】今田 猛",
        "【ｻｲﾎｰ】坂本 憲司"
      ],
      "株式会社奥本いろは堂": [
        "【いろは堂】染矢 剛",
        "【いろは堂】日高 重夫",
        "【いろは堂】奥本 哲也",
        "【いろは堂】島村 岳士"
      ],
      "株式会社カナデン": [
        "【ｶﾅﾃﾞﾝ】佐々木 翔平",
        "【ｶﾅﾃﾞﾝ】古谷 暁",
        "【ｶﾅﾃﾞﾝ】松田 壮亮",
        "【ｶﾅﾃﾞﾝ】坂口 恭祐",
        "【ｶﾅﾃﾞﾝ】原田 遼",
        "【ｶﾅﾃﾞﾝ】佐藤 伸佳"
      ],
      "株式会社リブ・ネクスト": [
        "【ﾘｸﾞﾈｸｽﾄ】小林 一路"
      ],
      "株式会社新日通": [
        "【新日通】山中 浩",
      ],
      "株式会社GNE": [
        "【GNE】小川 佳彦",
        "【GNE】山田 浩貴",
        "【GNE】太田",
        "【GNE】柿本",
        "【GNE】中村",
        "【GNE】高岡 裕"
      ],
      "株式会社ウム・ヴェルト・ジャパン": [
        "【ｳﾑﾍﾞﾙﾄ】藤本 幸大",
        "【ｳﾑﾍﾞﾙﾄ】横田 晋宏"
      ],
      "株式会社ルクス": [
        "ﾙｸｽ根岸 武彦",
        "ﾙｸｽ糴川 毅史",
        "ﾙｸｽ朝倉 智孝",
      ],
      "株式会社三井造船昭島研究所": [
        "【三井造船】橋本 聡明",
      ],
    };

    // 会社を問わず表示したい共通名簿（所属不明・不明）
    const commonStaffData = [
      "佐々木幸夫",
      "不明"
    ];

    // リストを更新する関数
    function updateList() {
      const company = destInput.value;
      contactDatalist.innerHTML = ""; // 一旦リストを空にする

      // 1. 会社が一致する担当者を追加
      if (companyStaffData[company]) {
        companyStaffData[company].forEach(staff => {
          const opt = document.createElement("option");
          opt.value = staff;
          contactDatalist.appendChild(opt);
        });
      }

      // 2. 共通の担当者を常に追加
      commonStaffData.forEach(staff => {
        const opt = document.createElement("option");
        opt.value = staff;
        contactDatalist.appendChild(opt);
      });
    }

    // 宛先が変わるたびにリストを更新
    destInput.addEventListener("input", updateList);

    // 初期状態でもリストを作っておく
    updateList();
  }

  // 実行
  setupContactSystem();

  // 見積日付から期限日付の自動計算
  function setupEstimateDateLimit() {
    const estimateDate = document.getElementById("estimateDate");
    const limitDate = document.getElementById("limitDate");
    if (!estimateDate || !limitDate) return;

    estimateDate.addEventListener("change", function () {
      const estimate = new Date(estimateDate.value);
      if (!isNaN(estimate.getTime())) {
        const deadline = new Date(estimate);
        deadline.setMonth(deadline.getMonth() + 3);

        if (deadline.getDate() !== estimate.getDate()) {
          deadline.setDate(0);
        }

        const yyyy = deadline.getFullYear();
        const mm = String(deadline.getMonth() + 1).padStart(2, "0");
        const dd = String(deadline.getDate()).padStart(2, "0");
        limitDate.value = `${yyyy}-${mm}-${dd}`;
      } else {
        limitDate.value = "";
      }
    });
  }

  // 会社選択による見積番号1の自動入力設定
  function setupCompanySelect() {
    const companySelect = document.getElementById("companySelect");
    const estimateNo1 = document.getElementById("estimateNo1");
    if (!companySelect || !estimateNo1) return;

    const companyCodeMap = {
      af: "AF",
      ak: "AK",
    };

    function updateCode() {
      estimateNo1.value = companyCodeMap[companySelect.value] || "";
      // 全体番号の更新も呼ぶ
      if (typeof updateEstimateNo === "function") updateEstimateNo();
    }

    companySelect.addEventListener("change", updateCode);

    // ページ読み込み時に実行（デフォルトの「AK」が入る）
    updateCode();
  }

  // 宛先選択による見積番号2の自動入力設定
  function setupDestinationSelect() {
    const destinationInput = document.getElementById("destinationInput");
    const estimateNo2 = document.getElementById("estimateNo2");
    if (!destinationInput || !estimateNo2) return;

    const nameToCode = {
      "リコージャパン株式会社": "RIC",
      "株式会社サイホー": "SAI",
      "株式会社奥本いろは堂": "IRH",
      "株式会社カナデン": "KND",
      "株式会社リブ・ネクスト": "LNT",
      "株式会社新日通": "SNT",
      "株式会社GNE": "GNE",
      "株式会社ウム・ヴェルト・ジャパン": "UMU",
      "ウム・ヴェルト株式会社": "UMJ",
      "株式会社力": "RIK",
      "エコ・トラスト・ジャパン株式会社": "ETJ",
      "株式会社紀鳳産業": "KHS",
      "コイズミ照明株式会社": "KOI",
      "アイリスオーヤマ株式会社": "IRI",
      "株式会社遠藤照明": "ENS",
      "株式会社ルクス": "LUX",
      "株式会社エコプラン": "ECP",
      "岩崎電気株式会社": "IWS",
      "株式会社関電工": "KDK",
      "東光電気工事株式会社": "TKD",
      "株式会社TKテクノサービス": "TKT",
      "株式会社ティーネットジャパン": "TNT",
      "株式会社三井造船昭島研究所": "MZA",
      "ダイキンHVACソリューション東京株式会社": "DKN",
      "有限会社南信堂": "NSD",
      "株式会社リバティ": "LBT",
      "株式会社フジクラエンジニアリング": "FGK",
      "イーシームズ株式会社": "ESM",
    };

    destinationInput.addEventListener("input", function () {
      const companyName = destinationInput.value;
      estimateNo2.value = nameToCode[companyName] || "";
    });
  }

  // 見積日付から見積番号3(YYMM)の自動入力設定
  function setupEstimateNo3() {
    const estimateDateInput = document.getElementById("estimateDate");
    const estimateNo3Input = document.getElementById("estimateNo3");
    if (!estimateDateInput || !estimateNo3Input) return;

    estimateDateInput.addEventListener("change", function () {
      const dateValue = estimateDateInput.value;
      if (!dateValue) {
        estimateNo3Input.value = "";
        return;
      }

      const date = new Date(dateValue);
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      estimateNo3Input.value = `${year}${month}`;
    });
  }

  // 作成者選択による見積番号5の自動入力設定
  function setupCreatorSelect() {
    const creatorSelect = document.getElementById("creatorSelect");
    const estimateNo5Input = document.getElementById("estimateNo5");
    if (!creatorSelect || !estimateNo5Input) return;

    const creatorMap = {
      nb: "NB",
      ts: "TS",
    };

    creatorSelect.addEventListener("change", function () {
      estimateNo5Input.value = creatorMap[creatorSelect.value] || "";
    });
  }


  // 受取人＋担当者選択による見積番号6の自動入力設定
  function setupEstimateNo6() {
    const recipientSelect = document.getElementById("destinationInput"); // 宛先（会社名）
    const personSelect = document.getElementById("contactInput");       // 担当者
    const orderSourceSelect = document.getElementById("orderFromSelect"); // 注文元
    const estimateNo6Input = document.getElementById("estimateNo6");    // 出力フィールド

    if (!recipientSelect || !personSelect || !orderSourceSelect || !estimateNo6Input) return;

    // 「リコージャパン株式会社」専用マッピング（注文元 + 担当者）
    const ricohMap = {
      "tokyo": {
        "【ﾘｺｰ首都圏】石井 猛": "TI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "TS",
        "【ﾘｺｰ西東京】根岸 徹": "TN",
        "【ﾘｺｰ西東京】小山 恒治": "TK",
        "【ﾘｺｰ群馬】藤野 智史": "TF",
        "【ﾘｺｰ群馬】池田 淳一": "TI",
        "【ﾘｺｰ群馬】田村": "TT",
        "【ﾘｺｰ群馬】渡辺 和弘": "TW",
        "【ﾘｺｰ千葉】内村 嘉朗": "TU",
        "【ﾘｺｰ埼玉】石川": "TI",
        "【ﾘｺｰ首都圏】大久保 博文": "TO",
        "【ﾘｺｰ首都圏】安喰 和弘": "TA",
        "【ﾘｺｰ首都圏】小針 重雄": "TK",
        "【ﾘｺｰ首都圏】青木 正人": "TA",
        "【ﾘｺｰ首都圏】長見 篤也": "TN",
        "【ﾘｺｰ神奈川】坂入": "TS",
      },
      // 他の注文元も同様に追加してください

      "gunma": {
        "【ﾘｺｰ首都圏】石井 猛": "GI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "GS",
        "【ﾘｺｰ西東京】根岸 徹": "GN",
        "【ﾘｺｰ西東京】小山 恒治": "GK",
        "【ﾘｺｰ群馬】藤野 智史": "GF",
        "【ﾘｺｰ群馬】池田 淳一": "GI",
        "【ﾘｺｰ群馬】田村": "GT",
        "【ﾘｺｰ群馬】渡辺 和弘": "GW",
        "【ﾘｺｰ千葉】内村 嘉朗": "GU",
        "【ﾘｺｰ埼玉】石川": "GI",
        "【ﾘｺｰ首都圏】大久保 博文": "GO",
        "【ﾘｺｰ首都圏】安喰 和弘": "GA",
        "【ﾘｺｰ首都圏】小針 重雄": "GK",
        "【ﾘｺｰ首都圏】青木 正人": "GA",
        "【ﾘｺｰ首都圏】長見 篤也": "GN",
        "【ﾘｺｰ神奈川】坂入": "GS",
      },
      "nisitokyo": {
        "【ﾘｺｰ首都圏】石井 猛": "NI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "NS",
        "【ﾘｺｰ西東京】根岸 徹": "NN",
        "【ﾘｺｰ西東京】小山 恒治": "NK",
        "【ﾘｺｰ群馬】藤野 智史": "NF",
        "【ﾘｺｰ群馬】池田 淳一": "NI",
        "【ﾘｺｰ群馬】田村": "NT",
        "【ﾘｺｰ群馬】渡辺 和弘": "NW",
        "【ﾘｺｰ千葉】内村 嘉朗": "NU",
        "【ﾘｺｰ埼玉】石川": "NI",
        "【ﾘｺｰ首都圏】大久保 博文": "NO",
        "【ﾘｺｰ首都圏】安喰 和弘": "NA",
        "【ﾘｺｰ首都圏】小針 重雄": "NK",
        "【ﾘｺｰ首都圏】青木 正人": "NA",
        "【ﾘｺｰ首都圏】長見 篤也": "NN",
        "【ﾘｺｰ神奈川】坂入": "NS",
      },
      "kanagawa": {
        "【ﾘｺｰ首都圏】石井 猛": "KI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "KS",
        "【ﾘｺｰ西東京】根岸 徹": "KN",
        "【ﾘｺｰ西東京】小山 恒治": "KK",
        "【ﾘｺｰ群馬】藤野 智史": "KF",
        "【ﾘｺｰ群馬】池田 淳一": "KI",
        "【ﾘｺｰ群馬】田村": "KT",
        "【ﾘｺｰ群馬】渡辺 和弘": "KW",
        "【ﾘｺｰ千葉】内村 嘉朗": "KU",
        "【ﾘｺｰ埼玉】石川": "KI",
        "【ﾘｺｰ首都圏】大久保 博文": "KO",
        "【ﾘｺｰ首都圏】安喰 和弘": "KA",
        "【ﾘｺｰ首都圏】小針 重雄": "KK",
        "【ﾘｺｰ首都圏】青木 正人": "KA",
        "【ﾘｺｰ首都圏】長見 篤也": "KN",
        "【ﾘｺｰ神奈川】坂入": "KS",
      },
      "chiba": {
        "【ﾘｺｰ首都圏】石井 猛": "CI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "CS",
        "【ﾘｺｰ西東京】根岸 徹": "CN",
        "【ﾘｺｰ西東京】小山 恒治": "CK",
        "【ﾘｺｰ群馬】藤野 智史": "CF",
        "【ﾘｺｰ群馬】池田 淳一": "CI",
        "【ﾘｺｰ群馬】田村": "CT",
        "【ﾘｺｰ群馬】渡辺 和弘": "CW",
        "【ﾘｺｰ千葉】内村 嘉朗": "CU",
        "【ﾘｺｰ埼玉】石川": "CI",
        "【ﾘｺｰ首都圏】大久保 博文": "CO",
        "【ﾘｺｰ首都圏】安喰 和弘": "CA",
        "【ﾘｺｰ首都圏】小針 重雄": "CK",
        "【ﾘｺｰ首都圏】青木 正人": "CA",
        "【ﾘｺｰ首都圏】長見 篤也": "CN",
        "【ﾘｺｰ神奈川】坂入": "CS",
      },
      "saitama": {
        "【ﾘｺｰ首都圏】石井 猛": "SI",
        "【ﾘｺｰ首都圏】志賀 孝浩": "SS",
        "【ﾘｺｰ西東京】根岸 徹": "SN",
        "【ﾘｺｰ西東京】小山 恒治": "SK",
        "【ﾘｺｰ群馬】藤野 智史": "SF",
        "【ﾘｺｰ群馬】池田 淳一": "SI",
        "【ﾘｺｰ群馬】田村": "ST",
        "【ﾘｺｰ群馬】渡辺 和弘": "SW",
        "【ﾘｺｰ千葉】内村 嘉朗": "SU",
        "【ﾘｺｰ埼玉】石川": "SI",
        "【ﾘｺｰ首都圏】大久保 博文": "SO",
        "【ﾘｺｰ首都圏】安喰 和弘": "SA",
        "【ﾘｺｰ首都圏】小針 重雄": "SK",
        "【ﾘｺｰ首都圏】青木 正人": "SA",
        "【ﾘｺｰ首都圏】長見 篤也": "SN",
        "【ﾘｺｰ神奈川】坂入": "SS",
      },
    };

    // 通常の会社 → 担当者ベース
    const personMap = {
      "【新日通】山中 浩": "Y",
      "【ﾘｸﾞﾈｸｽﾄ】小林 一路": "K",
      "【いろは堂】染矢 剛": "S",
      "【いろは堂】日高 重夫": "H",
      "【いろは堂】奥本 哲也": "T",
      "【いろは堂】島村 岳士": "S",
      "【ｶﾅﾃﾞﾝ】佐々木 翔平": "SS",
      "【ｶﾅﾃﾞﾝ】古谷 暁": "F",
      "【ｶﾅﾃﾞﾝ】松田 壮亮": "M",
      "【ｶﾅﾃﾞﾝ】坂口 恭祐": "SK",
      "【ｶﾅﾃﾞﾝ】原田 遼": "H",
      "【ｶﾅﾃﾞﾝ】佐藤 伸佳": "SH",
      "【ｻｲﾎｰ】戸野塚 直樹": "T",
      "【ｻｲﾎｰ】今田 猛": "I",
      "【ｻｲﾎｰ】坂本 憲司": "S",
      "【GNE】小川 佳彦": "OG",
      "【GNE】山田 浩貴": "Y",
      "【GNE】太田": "OT",
      "【GNE】柿本": "K",
      "【GNE】中村": "N",
      "【GNE】高岡 裕": "T",
      "【ｳﾑﾍﾞﾙﾄ】藤本 幸大": "F",
      "【ｳﾑﾍﾞﾙﾄ】横田 晋宏": "Y",
      "【三井造船】橋本 聡明": "H",
      "その他": "E",
      "佐々木幸夫": "S",
      "ﾙｸｽ根岸 武彦": "N",
      "ﾙｸｽ糴川 毅史": "S",
      "ﾙｸｽ朝倉 智孝": "A"
      // 必要に応じて他の担当者も追加
    };

    function updateEstimateNo6() {
      const recipient = recipientSelect.value;
      const person = personSelect.value;
      const orderSource = orderSourceSelect.value;

      let result = "YY"; // 初期値（該当なし）

      if (recipient === "リコージャパン株式会社") {
        // 注文元 + 担当者 による完全一致
        if (ricohMap[orderSource] && ricohMap[orderSource][person]) {
          result = ricohMap[orderSource][person];
        }
      } else {
        // 通常の担当者ベース
        if (personMap[person]) {
          result = personMap[person];
        }
      }

      estimateNo6Input.value = result;


      // 最終見積番号も更新
      if (typeof updateFinalEstimateNo === "function") {
        updateFinalEstimateNo();
      }
    }

    // 変更時に自動更新
    recipientSelect.addEventListener("change", updateEstimateNo6);
    personSelect.addEventListener("change", updateEstimateNo6);
    orderSourceSelect.addEventListener("change", updateEstimateNo6);
  }

  setupDiscountToggle();
  setupEstimateDateLimit();
  setupCompanySelect();
  setupDestinationSelect();
  setupEstimateNo3();
  setupCreatorSelect();
  setupEstimateNo6(); // ← ← ← ★★★ これを追加！！
});

//見積番号1～6による見積番号の自動入力設定
document.addEventListener("DOMContentLoaded", () => {
  const fieldIds = [
    "estimateNo1",
    "estimateNo2",
    "estimateNo3",
    "estimateNo4",
    "estimateNo5",
    "estimateNo6"
  ];

  const fields = fieldIds.map(id => document.getElementById(id));
  const estimateNoOutput = document.getElementById("estimateNo");
  const estimateNo7 = document.getElementById("estimateNo7"); // 枝番

  function updateEstimateNo() {
    const values = fields.map(field => field?.value.trim() || "");
    const allFilled = values.every(val => val !== "");

    if (allFilled) {
      let fullEstimateNo = values.join("");

      const extra = estimateNo7?.value.trim();
      if (extra) {
        fullEstimateNo += extra; // 枝番も追加（ハイフンなし）
      }

      estimateNoOutput.value = fullEstimateNo;
    } else {
      estimateNoOutput.value = "";
    }
  }

  // 全フィールドにイベントリスナー追加（枝番も含む）
  fields.forEach(field => {
    if (!field) return;
    field.addEventListener("input", updateEstimateNo);
    field.addEventListener("change", updateEstimateNo);
  });

  if (estimateNo7) {
    estimateNo7.addEventListener("input", updateEstimateNo);
    estimateNo7.addEventListener("change", updateEstimateNo);
  }

  // 自動入力にも対応（500msごとにチェック）
  setInterval(updateEstimateNo, 500);
});

//工事種類の選択による内容の自動入力設定
document.addEventListener("DOMContentLoaded", function () {
  const workContent = document.getElementById("workContent");
  const koujiRadios = document.querySelectorAll("input[name='koujiType']");

  const koujiContentMap = {
    "koujiType1": "照明LED化工事",
    "koujiType2": "空調設備工事"
  };

  function updateContent() {
    // チェックされているラジオボタンを探して内容を反映S
    const selectedRadio = document.querySelector("input[name='koujiType']:checked");
    if (selectedRadio) {
      workContent.value = koujiContentMap[selectedRadio.id] || "";
    }
  }

  // ラジオボタンがクリックされた時のイベント
  koujiRadios.forEach(radio => {
    radio.addEventListener("change", updateContent);
  });

  // ページ読み込み時に実行（デフォルトの「照明LED化工事」が入る）
  updateContent();
});

//注文元の選択による注文番号の自動入力設定
document.addEventListener("DOMContentLoaded", function () {
  const orderFromSelect = document.getElementById("orderFromSelect");
  const orderNumber1 = document.getElementById("orderNumber1");

  const orderNumberMap = {
    tokyo: "408",
    gunma: "305",
    nisitokyo: "403",
    kanagawa: "405",
    chiba: "401",
    saitama: "304"
  };

  orderFromSelect.addEventListener("change", function () {
    const selectedValue = orderFromSelect.value;
    orderNumber1.value = orderNumberMap[selectedValue] || "";
  });
});

//宛先と注文元と注文番号1と注文番号2によって注文番号を自動入力する設定
document.addEventListener('DOMContentLoaded', () => {
  const destinationSelect = document.getElementById('destinationSelect');  // 宛先
  const orderNumber1 = document.getElementById('orderNumber1');          // 注文番号1（注文元に応じて自動入力）
  const orderNumber2 = document.getElementById('orderNumber2');          // 注文番号2（ユーザー入力）
  const orderFromSelect = document.getElementById('orderFromSelect');    // 注文元
  const orderNumberFull = document.getElementById('orderNumberFull');    // 完成注文番号（自動生成）

  // 注文元によって注文番号1を自動設定する関数
  function updateOrderNumber1() {
    const orderFrom = orderFromSelect.value;
    // 注文元別の注文番号1のマッピング（例）
    const orderNumberMap = {
      tokyo: '408',
      gunma: '305',
      nisitokyo: '403',
      kanagawa: '405',
      chiba: '401',
      saitama: '304'
    };

    orderNumber1.value = orderNumberMap[orderFrom] || '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const destinationSelect = document.getElementById('destinationSelect'); // 宛先（B4）
    const orderNumber1 = document.getElementById('orderNumber1');           // 注文番号1（E16）
    const orderNumber2 = document.getElementById('orderNumber2');           // 注文番号2（E17）
    const orderNumberFull = document.getElementById('orderNumberFull');     // 出力先

    function updateOrderNumberFull() {
      const destination = destinationSelect?.value?.trim() || "";
      const no1 = orderNumber1?.value?.trim() || "";
      const no2 = orderNumber2?.value?.trim() || "";

      if (no2 !== "" && no2 !== "0000000000" && no2 !== "000000000") {
        if (destination === "リコージャパン株式会社") {
          orderNumberFull.value = `${no1}-JS${no2}`;
        } else {
          orderNumberFull.value = no2;
        }
      } else {
        orderNumberFull.value = "";
      }
    }

    destinationSelect?.addEventListener('change', updateOrderNumberFull);
    orderNumber1?.addEventListener('input', updateOrderNumberFull);
    orderNumber2?.addEventListener('input', updateOrderNumberFull);
  });
  function updateOrderNumberFull() {
    const orderNumber1 = document.getElementById('orderNumber1').value.trim();
    const orderNumber2 = document.getElementById('orderNumber2').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    const orderNumberFull = document.getElementById('orderNumberFull'); // 出力先

    if (orderNumber2 !== "000000000") {
      if (destination === "ricoh") {
        orderNumberFull.value = `${orderNumber1}-JS${orderNumber2}`;
      } else {
        orderNumberFull.value = orderNumber2;
      }
    } else {
      orderNumberFull.value = "";
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const destinationSelect = document.getElementById('destinationSelect');
    const orderNumber2 = document.getElementById('orderNumber2');

    destinationSelect.addEventListener('change', updateOrderNumberFull);
    orderNumber2.addEventListener('input', updateOrderNumberFull);
  });

  // 初期化や変更時のイベント設定
  orderFromSelect.addEventListener('change', () => {
    updateOrderNumber1();
    updateOrderNumberFull();
  });
  orderNumber2.addEventListener('input', updateOrderNumberFull);
  destinationInput.addEventListener('change', updateOrderNumberFull);
});

