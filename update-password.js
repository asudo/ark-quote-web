const _supabase = window.supabaseClient;
const updateForm = document.getElementById('updateForm');
const errorMessage = document.getElementById('errorMessage');
const passwordInput = document.getElementById('new_pw');
const confirmPasswordInput = document.getElementById('conf_pw');

const ERROR_COLOR = "#d9534f";

let rawPassword = "";
let rawConfirmPassword = "";
let maskTimeoutP = null;
let maskTimeoutC = null;

// 表示モード管理 (true: ●表示 / false: 生文字表示)
let isMaskedP = true;
let isMaskedC = true;

/**
 * 1. エラー表示
 */
function updateErrorDisplay(messages) {
    if (messages && messages.length > 0) {
        // メッセージが1つ（文字列）でも配列でも箇条書きにする
        const msgArray = Array.isArray(messages) ? messages : [messages];
        const listItems = msgArray.map(msg => `<li>${msg}</li>`).join('');

        errorMessage.innerHTML = `⚠️ <span style="font-weight:bold;">入力内容を確認してください</span><ul>${listItems}</ul>`;

        // CSSのクラス「active」を付与して「display: block」を有効にする
        errorMessage.classList.add('active');
        errorMessage.style.display = 'block';
        errorMessage.style.color = ERROR_COLOR;
        errorMessage.style.textAlign = 'left';
    } else {
        errorMessage.innerHTML = '';
        errorMessage.classList.remove('active');
        errorMessage.style.display = 'none';
    }
}

/**
 * 2. 一致チェック
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
 * 3. 伏せ字入力制御
 */
function handlePasswordInput(inputEl, currentRaw, setRaw, timerType) {
    const currentVal = inputEl.value;
    const isMasked = (timerType === 'p') ? isMaskedP : isMaskedC;

    if (isMasked) {
        if (currentVal.length > currentRaw.length) {
            const newChar = currentVal.slice(-1);
            const updatedRaw = currentRaw + newChar;
            setRaw(updatedRaw);
            inputEl.value = "●".repeat(updatedRaw.length - 1) + newChar;

            if (timerType === 'p') {
                if (maskTimeoutP) clearTimeout(maskTimeoutP);
                maskTimeoutP = setTimeout(() => {
                    if (isMaskedP) inputEl.value = "●".repeat(updatedRaw.length);
                    maskTimeoutP = null;
                }, 400);
            } else {
                if (maskTimeoutC) clearTimeout(maskTimeoutC);
                maskTimeoutC = setTimeout(() => {
                    if (isMaskedC) inputEl.value = "●".repeat(updatedRaw.length);
                    maskTimeoutC = null;
                }, 400);
            }
        } else {
            const updatedRaw = currentRaw.slice(0, currentVal.length);
            setRaw(updatedRaw);
            inputEl.value = "●".repeat(updatedRaw.length);
        }
    } else {
        setRaw(currentVal);
    }
}

// 目のマークの切り替えイベント
document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function () {
        const input = this.parentElement.querySelector('input');
        const eyeOpen = this.querySelector('.eyeOpen');
        const eyeClose = this.querySelector('.eyeClose');
        const isP = (input.id === 'new_pw');

        if ((isP && isMaskedP) || (!isP && isMaskedC)) {
            if (isP) isMaskedP = false; else isMaskedC = false;
            input.value = (isP) ? rawPassword : rawConfirmPassword;
            eyeOpen.style.display = 'none';
            eyeClose.style.display = 'block';
        } else {
            if (isP) isMaskedP = true; else isMaskedC = true;
            input.value = "●".repeat((isP ? rawPassword : rawConfirmPassword).length);
            eyeOpen.style.display = 'block';
            eyeClose.style.display = 'none';
        }
    });
});

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
        errors.push("パスワードが短すぎます。6文字以上で入力してください。");
    }

    if (rawPassword !== rawConfirmPassword) {
        errors.push("パスワードが一致しません。上下に同じ文字を入力してください。");
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
        let errMsg = err.message;

        // 判定ロジックを強化
        if (errMsg.includes("different from the old") || errMsg.includes("same as old")) {
            errMsg = "現在のパスワードとは異なるものを入力してください。";
        } else if (errMsg.includes("weak_password") || errMsg.includes("should be at least")) {
            errMsg = "パスワードが簡単すぎるか、短すぎます。";
        } else if (errMsg.includes("session_expired") || errMsg.includes("not found")) {
            errMsg = "再設定の期限が切れた可能性があります。もう一度最初からやり直してください。";
        } else {
            // 予期せぬエラー（英語）の場合は、最低限「失敗した」ことを日本語で伝える
            errMsg = "エラーが発生しました。時間を置いて再度お試しください。(" + errMsg + ")";
        }

        // 統一されたエラー表示を呼び出す
        updateErrorDisplay([errMsg]);

        submitBtn.disabled = false;
        submitBtn.textContent = 'パスワードを更新';
    }
});