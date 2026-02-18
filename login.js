// login.js
const _supabase = window.supabaseClient;

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const emailInput = document.getElementById('userId');
const passwordInput = document.getElementById('password');

// 共通の色定義
const ERROR_COLOR = "#d9534f";

/**
 * エラー表示を更新するヘルパー関数
 * メッセージがある時は赤枠を表示し、ない時は隠します
 */
function updateErrorDisplay(message) {
    if (message) {
        // メッセージをセット
        errorMessage.innerHTML = `⚠️ <span style="font-weight:bold;">ログインできません</span><br>${message}`;

        // CSSのクラス「active」を付与して「display: block」を有効にする
        errorMessage.classList.add('active');

        // スタイルの微調整
        errorMessage.style.display = 'block';
        errorMessage.style.color = ERROR_COLOR;
        errorMessage.style.textAlign = 'left';
        errorMessage.style.whiteSpace = "pre-line";
    } else {
        errorMessage.innerHTML = '';
        errorMessage.classList.remove('active');
        errorMessage.style.display = 'none';
    }
}

// --- ログインボタンを押した時の処理 ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    updateErrorDisplay(''); // エラーをリセット

    const email = emailInput.value.trim();
    const password = rawPassword; // パスワード制御ロジックの変数を使用

    // 1. フロントエンドでの未入力チェック
    if (!email || !password) {
        updateErrorDisplay('メールアドレスとパスワードを入力してください。');
        return;
    }

    // 2. 状態を「処理中」に切り替え
    const submitBtn = loginForm.querySelector('.login-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '認証中...';

    // 通信中のため一時的に「読み込み中」を表示
    errorMessage.classList.remove('active');
    errorMessage.style.display = 'block';
    errorMessage.style.color = '#666';
    errorMessage.style.textAlign = 'center';
    errorMessage.innerHTML = '<span class="loading-dots">ログインしています</span>';

    try {
        // 3. Supabase Auth ログイン実行
        const { data, error } = await _supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            let msg = "メールアドレスまたはパスワードが違います。";
            if (error.status === 429) {
                msg = "短時間に何度も失敗したためロックされました。\n時間を置いてお試しください。";
            }
            throw new Error(msg);
        }

        // 4. Auth成功（次に承認状態をチェック）
        const user = data.user;

        // user_masterテーブルから 権限 と 有効フラグ を取得
        const { data: userData, error: dbError } = await _supabase
            .from('user_master')
            .select('user_name, role, is_active')
            .eq('id', user.id)
            .single();

        // --- 二重チェックロジック ---
        if (dbError || !userData || !userData.is_active || userData.role === 'guest') {
            // 承認されていない、またはゲストの場合は強制ログアウト
            await _supabase.auth.signOut();
            throw new Error("管理者による承認が完了していません。\n承認されるまでお待ちください。");
        }

        // 承認済みなら名前を保存
        sessionStorage.setItem('userName', userData.user_name);

        // ✅ 
        window.location.href = "menu.html";

    } catch (err) {
        console.error("Login Process Error:", err);

        // 失敗時のみボタンとメッセージを戻す
        submitBtn.disabled = false;
        submitBtn.textContent = 'ログイン';
        updateErrorDisplay(err.message);
    }
});

// --- パスワード一文字表示ロジック ---
const togglePasswordBtn = document.getElementById('togglePassword');
const eyeOpen = document.getElementById('eyeOpen');
const eyeClose = document.getElementById('eyeClose');

let rawPassword = ""; // 本物のパスワードを保持
let maskTimeout = null;
let isVisibleMode = false;

if (passwordInput) {
    passwordInput.setAttribute('type', 'text');
    passwordInput.addEventListener('input', function (e) {
        if (isVisibleMode) {
            rawPassword = passwordInput.value;
            return;
        }

        const currentVal = passwordInput.value;
        if (currentVal.length > rawPassword.length) {
            const newChar = currentVal.slice(-1);
            rawPassword += newChar;
            passwordInput.value = "●".repeat(rawPassword.length - 1) + newChar;

            if (maskTimeout) clearTimeout(maskTimeout);
            maskTimeout = setTimeout(() => {
                passwordInput.value = "●".repeat(rawPassword.length);
                maskTimeout = null;
            }, 400);
        } else {
            rawPassword = rawPassword.slice(0, currentVal.length);
            passwordInput.value = "●".repeat(rawPassword.length);
        }
    });
}

if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', function () {
        isVisibleMode = !isVisibleMode;
        if (isVisibleMode) {
            passwordInput.value = rawPassword;
            updateEyeIcon(true);
        } else {
            passwordInput.value = "●".repeat(rawPassword.length);
            updateEyeIcon(false);
        }
    });
}

function updateEyeIcon(isVisible) {
    if (isVisible) {
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClose) eyeClose.classList.remove('hidden');
    } else {
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClose) eyeClose.classList.add('hidden');
    }
}