/**
 * 1. URL修復ロジック（最優先で実行）
 * メールのリンクが &amp; で壊れている場合、正しい & に置換してリロード
 */
(function () {
    if (window.location.href.includes('&amp;')) {
        const fixedUrl = window.location.href.replace(/&amp;/g, '&');
        console.log("URL修復中...", fixedUrl);
        window.location.replace(fixedUrl);
    }
})();

const _supabase = window.supabaseClient;
const updateForm = document.getElementById('updateForm');
const errorMessage = document.getElementById('errorMessage');

// HTML側のID
const passwordInput = document.getElementById('new_pw');
const confirmPasswordInput = document.getElementById('conf_pw');

const ERROR_COLOR = "#d9534f";

let rawPassword = "";
let rawConfirmPassword = "";
let maskTimeoutP = null;
let maskTimeoutC = null;

/**
 * 2. エラー表示ヘルパー
 */
function updateErrorDisplay(messages) {
    if (messages && messages.length > 0) {
        const msgArray = Array.isArray(messages) ? messages : [messages];
        const listItems = msgArray.map(msg => `<li>${msg}</li>`).join('');
        errorMessage.innerHTML = `⚠️ <span style="font-weight:bold;">入力内容を確認してください</span><ul>${listItems}</ul>`;
        errorMessage.classList.add('active');
        errorMessage.style.color = ERROR_COLOR;
        errorMessage.style.display = 'block';
    } else {
        errorMessage.innerHTML = '';
        errorMessage.classList.remove('active');
        errorMessage.style.display = 'none';
    }
}

/**
 * 3. パスワード一致チェック
 */
function checkMatch() {
    const hint = passwordInput.closest('.input-group').querySelector('small');
    if (rawConfirmPassword.length === 0) {
        confirmPasswordInput.style.border = '';
        return;
    }

    if (rawPassword === rawConfirmPassword && rawPassword.length >= 6) {
        confirmPasswordInput.style.border = '';
        updateErrorDisplay('');
        if (hint) {
            hint.style.color = '';
            hint.style.fontWeight = '';
        }
    } else {
        confirmPasswordInput.style.border = `2px solid ${ERROR_COLOR}`;
        if (hint) {
            hint.style.color = ERROR_COLOR;
            hint.style.fontWeight = 'bold';
        }
    }
}

/**
 * 4. 伏せ字入力制御
 */
function handlePasswordInput(inputEl, currentRaw, setRaw, timerType) {
    const currentVal = inputEl.value;
    if (currentVal.length > currentRaw.length) {
        const newChar = currentVal.slice(-1);
        const updatedRaw = currentRaw + newChar;
        setRaw(updatedRaw);
        inputEl.value = "●".repeat(updatedRaw.length - 1) + newChar;

        if (timerType === 'p') {
            if (maskTimeoutP) clearTimeout(maskTimeoutP);
            maskTimeoutP = setTimeout(() => {
                inputEl.value = "●".repeat(updatedRaw.length);
                maskTimeoutP = null;
            }, 400);
        } else {
            if (maskTimeoutC) clearTimeout(maskTimeoutC);
            maskTimeoutC = setTimeout(() => {
                inputEl.value = "●".repeat(updatedRaw.length);
                maskTimeoutC = null;
            }, 400);
        }
    } else {
        const updatedRaw = currentRaw.slice(0, currentVal.length);
        setRaw(updatedRaw);
        inputEl.value = "●".repeat(updatedRaw.length);
    }
}

// イベント登録
passwordInput.addEventListener('input', () => {
    handlePasswordInput(passwordInput, rawPassword, (val) => { rawPassword = val; }, 'p');
    checkMatch();
});

confirmPasswordInput.addEventListener('input', () => {
    handlePasswordInput(confirmPasswordInput, rawConfirmPassword, (val) => { rawConfirmPassword = val; }, 'c');
    checkMatch();
});

/**
 * 5. パスワード更新（本番処理）
 */
updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    let errors = [];
    if (!rawPassword) {
        errors.push("新しいパスワードを入力してください。");
    } else if (rawPassword.length < 6) {
        errors.push("パスワードは6文字以上で入力してください。");
    }

    if (rawPassword !== rawConfirmPassword) {
        errors.push("パスワードが一致しません。");
    }

    if (errors.length > 0) {
        updateErrorDisplay(errors);
        return;
    }

    const submitBtn = updateForm.querySelector('.login-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '更新中...';

    try {
        // セッションが確立されているか確認
        const { data: { session }, error: sessionError } = await _supabase.auth.getSession();
        
        if (sessionError || !session) {
            // セッションがない場合（直リンクなど）はURLから復帰を試みる
            // 通常、Supabaseはハッシュ(#)の中のアクセストークンを自動で拾いますが
            // 念のためエラーを具体的出します
            throw new Error("認証セッションが見つかりません。メールのリンクから再度やり直してください。");
        }

        // パスワード更新実行
        const { error } = await _supabase.auth.updateUser({ password: rawPassword });
        if (error) throw error;

        alert("✅ パスワードを更新しました。新しいパスワードでログインしてください。");
        window.location.href = "login.html";

    } catch (err) {
        console.error(err);
        updateErrorDisplay("⚠️ 更新に失敗しました: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'パスワードを更新';
    }
});

window.addEventListener('load', () => {
    const hint = passwordInput.closest('.input-group').querySelector('small');
    if (hint) {
        hint.style.color = '';
        hint.style.fontWeight = '';
    }
});