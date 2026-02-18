// update-password.js
const _supabase = window.supabaseClient;

const updateForm = document.getElementById('updateForm');
const errorMessage = document.getElementById('errorMessage');

// HTML側のID変更（new_pw / conf_pw）に合わせる
const passwordInput = document.getElementById('new_pw');
const confirmPasswordInput = document.getElementById('conf_pw');

const ERROR_COLOR = "#d9534f";

let rawPassword = "";
let rawConfirmPassword = "";
let maskTimeoutP = null;
let maskTimeoutC = null;

/**
 * 1. エラー表示（signup.jsと統一）
 */
function updateErrorDisplay(messages) {
    if (messages && messages.length > 0) {
        const msgArray = Array.isArray(messages) ? messages : [messages];
        const listItems = msgArray.map(msg => `<li>${msg}</li>`).join('');
        errorMessage.innerHTML = `⚠️ <span style="font-weight:bold;">入力内容を確認してください</span><ul>${listItems}</ul>`;
        errorMessage.classList.add('active');
        errorMessage.style.color = ERROR_COLOR;
    } else {
        errorMessage.innerHTML = '';
        errorMessage.classList.remove('active');
    }
}

/**
 * 2. 一致チェック（★CSSの挙動を邪魔しないのがコツ）
 */
function checkMatch() {
    // 注釈要素を取得
    const hint = passwordInput.closest('.input-group').querySelector('small');
    
    if (rawConfirmPassword.length === 0) {
        confirmPasswordInput.style.border = '';
        return;
    }

    // 正常な場合（一致 ＆ 6文字以上）
    if (rawPassword === rawConfirmPassword && rawPassword.length >= 6) {
        confirmPasswordInput.style.border = '';
        updateErrorDisplay('');
        
        // ★重要：JS側からの指定を「空」にすることで、CSSの :focus-within に任せる
        if (hint) {
            hint.style.color = '';
            hint.style.fontWeight = '';
        }
    } else {
        // 異常時（不一致）のみ、JSが赤く強制上書き
        confirmPasswordInput.style.border = `2px solid ${ERROR_COLOR}`;
        if (hint) {
            hint.style.color = ERROR_COLOR;
            hint.style.fontWeight = 'bold';
        }
    }
}

/**
 * 3. 伏せ字入力制御（signup.jsのロジックを完全再現）
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
 * 4. 送信処理
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
        confirmPasswordInput.style.border = `2px solid ${ERROR_COLOR}`;
    }

    if (errors.length > 0) {
        updateErrorDisplay(errors);
        return;
    }

    const submitBtn = updateForm.querySelector('.login-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '更新中...';

    try {
        const { error } = await _supabase.auth.updateUser({ password: rawPassword });
        if (error) throw error;

        alert("パスワードを更新しました。新しいパスワードでログインしてください。");
        window.location.href = "login.html";
    } catch (err) {
        console.error(err);
        updateErrorDisplay("更新に失敗しました: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'パスワードを更新';
    }
});

// ページ読み込み時の強制初期化（ブラウザキャッシュ対策）
window.addEventListener('load', () => {
    const hint = passwordInput.closest('.input-group').querySelector('small');
    if (hint) {
        hint.style.color = '';
        hint.style.fontWeight = '';
    }
});