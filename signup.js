// signup.js
const _supabase = window.supabaseClient;

const signupForm = document.getElementById('signupForm');
const errorMessage = document.getElementById('errorMessage');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const userInitialInput = document.getElementById('userInitial');

// 共通の色定義（HTMLの見出しの赤色に合わせる）
const ERROR_COLOR = "#d9534f";

// ★ 社内ドメインの定義
const ALLOWED_DOMAIN = "@ark-creton.co.jp";

// --- エラー表示を更新するヘルパー関数（複数エラーに対応） ---
function updateErrorDisplay(messages) {
    if (messages && messages.length > 0) {
        // メッセージが1つ（文字列）でも配列でも箇条書きにする
        const msgArray = Array.isArray(messages) ? messages : [messages];
        const listItems = msgArray.map(msg => `<li>${msg}</li>`).join('');

        errorMessage.innerHTML = `⚠️ <span style="font-weight:bold;">入力内容を確認してください</span><ul>${listItems}</ul>`;
        errorMessage.classList.add('active'); // CSSのactiveクラスを付与してボックスを表示
        errorMessage.style.color = ERROR_COLOR;
    } else {
        errorMessage.innerHTML = '';
        errorMessage.classList.remove('active'); // ボックスを非表示
    }
}

// --- 1. リアルタイム・ドメインチェック ---
emailInput.addEventListener('input', () => {
    const email = emailInput.value;
    const hint = emailInput.closest('.input-group').querySelector('small'); // ラベル横の注釈

    if (email.includes('@')) {
        if (!email.endsWith(ALLOWED_DOMAIN)) {
            // ボックス形式でエラー表示
            updateErrorDisplay('有効な社内メールアドレスではありません。');
            emailInput.style.border = `2px solid ${ERROR_COLOR}`;
            if (hint) hint.style.color = ERROR_COLOR; // 注釈も赤くする
        } else {
            updateErrorDisplay(''); // エラーを消す
            emailInput.style.border = '';
            if (hint) hint.style.color = ''; // 元に戻す
        }
    }
});

// --- 2. イニシャルのリアルタイム・バリデーション ---
if (userInitialInput) {
    userInitialInput.addEventListener('input', () => {
        // 全角を半角に変換 ＋ 大文字に変換 ＋ 英字以外を除去
        let val = userInitialInput.value
            .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .toUpperCase()
            .replace(/[^A-Z]/g, '');

        userInitialInput.value = val;
        const hint = userInitialInput.closest('.input-group').querySelector('small');

        // バリデーション表示の切り替え
        if (val.length === 1) {
            // 1文字の時は「未完成」として赤枠にする
            userInitialInput.style.border = `2px solid ${ERROR_COLOR}`;
            if (hint) hint.style.color = ERROR_COLOR;
        } else {
            // 0文字、または正しい2文字の時は、緑にせず「通常」に戻す
            userInitialInput.style.border = '';
            if (hint) hint.style.color = '';
        }
    });
}

// --- 3. パスワード表示管理（一文字表示 ＆ 個別切替） ---
const togglePassword = document.getElementById('togglePassword');
const toggleConfirmPassword = document.getElementById('toggleConfirmPassword');

let rawPassword = "";
let rawConfirmPassword = "";
let maskTimeoutP = null;
let maskTimeoutC = null;
let isVisibleP = false;
let isVisibleC = false;

// ★一致チェック関数
function checkMatch() {
    const hint = passwordInput.closest('.input-group').querySelector('small');
    if (rawConfirmPassword.length === 0) {
        confirmPasswordInput.style.border = '';
        return;
    }
    // 文字数不足、または不一致の場合のみ赤枠にする
    if (rawPassword === rawConfirmPassword && rawPassword.length >= 6) {
        confirmPasswordInput.style.border = ''; // OKなら緑にせず通常に戻す
        updateErrorDisplay('');
        if (hint) hint.style.color = '';
    } else {
        confirmPasswordInput.style.border = `2px solid ${ERROR_COLOR}`; // NGなら赤
        if (hint) hint.style.color = ERROR_COLOR;
    }
}

function handlePasswordInput(inputEl, currentRaw, setRaw, timerType, isVisible) {
    if (isVisible) {
        setRaw(inputEl.value);
        return;
    }
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

if (passwordInput) {
    passwordInput.setAttribute('type', 'text');
    passwordInput.addEventListener('input', () => {
        handlePasswordInput(passwordInput, rawPassword, (val) => { rawPassword = val; }, 'p', isVisibleP);
        checkMatch();
    });
}

if (confirmPasswordInput) {
    confirmPasswordInput.setAttribute('type', 'text');
    confirmPasswordInput.addEventListener('input', () => {
        handlePasswordInput(confirmPasswordInput, rawConfirmPassword, (val) => { rawConfirmPassword = val; }, 'c', isVisibleC);
        checkMatch();
    });
}

function toggleFieldVisibility(inputEl, rawVal, isVisibleNow, btnEl) {
    const nextVisible = !isVisibleNow;
    const eyeOpen = btnEl.querySelector('.eyeOpen');
    const eyeClose = btnEl.querySelector('.eyeClose');
    if (nextVisible) {
        inputEl.value = rawVal;
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClose) eyeClose.classList.remove('hidden');
    } else {
        inputEl.value = "●".repeat(rawVal.length);
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClose) eyeClose.classList.add('hidden');
    }
    return nextVisible;
}

if (togglePassword) {
    togglePassword.addEventListener('click', () => {
        isVisibleP = toggleFieldVisibility(passwordInput, rawPassword, isVisibleP, togglePassword);
    });
}

if (toggleConfirmPassword) {
    toggleConfirmPassword.addEventListener('click', () => {
        isVisibleC = toggleFieldVisibility(confirmPasswordInput, rawConfirmPassword, isVisibleC, toggleConfirmPassword);
    });
}

// --- 4. 登録処理 ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // エラーを蓄積する配列
    let errors = [];

    // --- ブラウザ標準の代わりに自作メッセージで一括バリデーション ---
    const checkFields = [
        { el: document.getElementById('userName'), label: '氏名' },
        { el: userInitialInput, label: 'イニシャル' },
        { el: emailInput, label: 'メールアドレス' },
        { el: passwordInput, label: 'パスワード' },
        { el: confirmPasswordInput, label: '確認用パスワード' }
    ];

    // 1. 未入力チェック
    checkFields.forEach(field => {
        if (!field.el.value.trim()) {
            errors.push(`${field.label}を入力してください。`);
            field.el.style.border = `2px solid ${ERROR_COLOR}`;
        } else {
            field.el.style.border = ''; // 入力されていれば枠を戻す
        }
    });

    // 2. 形式チェック
    const email = emailInput.value;
    const userInitial = userInitialInput.value;
    const password = rawPassword;
    const confirmPassword = rawConfirmPassword;

    if (email && !email.endsWith(ALLOWED_DOMAIN)) {
        errors.push('社内ドメインのアドレスを入力してください。');
        emailInput.style.border = `2px solid ${ERROR_COLOR}`;
    }

    if (userInitial && userInitial.length !== 2) {
        errors.push('イニシャルは2文字で入力してください。');
        userInitialInput.style.border = `2px solid ${ERROR_COLOR}`;
    }

    if (password && confirmPassword && password !== confirmPassword) {
        errors.push('パスワードが一致しません。');
        confirmPasswordInput.style.border = `2px solid ${ERROR_COLOR}`;
    } else if (password && password.length < 6) {
        errors.push('パスワードは6文字以上で入力してください。');
    }

    // エラーがあれば表示して処理を中断
    if (errors.length > 0) {
        updateErrorDisplay(errors);
        window.scrollTo(0, 0);
        return;
    }

    // --- 「処理中」の表示ロジック ---
    const submitBtn = signupForm.querySelector('.login-btn');
    const userNameValue = document.getElementById('userName').value;

    submitBtn.disabled = true; // ボタンを押せなくする
    submitBtn.textContent = '処理中...';

    // エラーエリアの設定をリセットして、文字を見せる
    errorMessage.classList.remove('active'); // 赤い枠と背景を消す
    errorMessage.style.display = 'block';    // ただし非表示にはせず、テキスト領域として表示
    errorMessage.style.color = '#666';       // グレー文字にする
    errorMessage.style.textAlign = 'center'; // 中央寄せ
    errorMessage.innerHTML = '<span class="loading-dots">登録処理を行っています</span>';

    // 描画時間を確保
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
        const { data: authData, error: authError } = await _supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: userNameValue,
                    user_initial: userInitial
                }
            }
        });

        if (authError) throw authError;

        // 成功！
        errorMessage.textContent = '登録完了！画面を切り替えます。';
        errorMessage.style.color = '#28a745';

        setTimeout(() => {
            alert('アカウントの仮登録が完了しました！管理者の承認をお待ちください。');
            window.location.href = 'login.html';
        }, 500);

    } catch (error) {
        console.error('Signup Error:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = 'アカウント仮登録';

        // エラー時は再び左寄せに戻す（updateErrorDisplayで処理）
        errorMessage.style.textAlign = 'left';

        let friendlyMessage = 'エラーが発生しました。';
        if (error.message.includes('User already registered')) {
            friendlyMessage = 'このメールアドレスは既に登録されています。';
        } else if (error.status === 429) {
            friendlyMessage = '短時間に何度も送信されました。少し時間を置いてお試しください。';
        } else {
            friendlyMessage = '登録に失敗しました。入力内容を再度ご確認ください。';
        }

        updateErrorDisplay(friendlyMessage);
    }
});