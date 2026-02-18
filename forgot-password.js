// forgot-password.js
const _supabase = window.supabaseClient;
const forgotForm = document.getElementById('forgotForm');
const errorMessage = document.getElementById('errorMessage');

forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const submitBtn = forgotForm.querySelector('.login-btn');

    if (!email) {
        showStatus("メールアドレスを入力してください。", "error");
        return;
    }

    // 状態を「処理中」に
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';
    
    try {
        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
            // パスワードを実際に更新する画面のURL（次に作る画面）
            redirectTo: window.location.origin + '/update-password.html',
        });

        if (error) throw error;

        // 成功時の表示
        showStatus("✅ 再設定メールを送信しました。<br>メールボックスを確認してください。", "success");
        submitBtn.textContent = '送信完了';

    } catch (err) {
        console.error(err);
        showStatus("⚠️ 送信に失敗しました。<br>" + err.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = '再設定メールを送信';
    }
});

/**
 * 状態（成功・失敗）を表示するヘルパー
 */
function showStatus(msg, type) {
    errorMessage.innerHTML = msg;
    errorMessage.classList.add('active');
    errorMessage.style.display = 'block';
    
    if (type === "success") {
        errorMessage.style.color = "#28a745"; // 緑色
        errorMessage.style.backgroundColor = "#e8f5e9";
        errorMessage.style.border = "1px solid #28a745";
    } else {
        errorMessage.style.color = "#d9534f"; // 赤色
        errorMessage.style.backgroundColor = "";
        errorMessage.style.border = "";
    }
}