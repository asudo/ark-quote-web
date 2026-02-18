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
        /**
         * 【重要修正】GitHub Pagesのリポジトリ名を含めたフルURLを指定します
         */
        const resetURL = 'https://asudo.github.io/ark-quote-web/update-password.html';

        const { error } = await _supabase.auth.resetPasswordForEmail(email, {
            redirectTo: resetURL,
        });

        if (error) throw error;

        // 成功時の表示
        showStatus("✅ 再設定メールを送信しました。<br>メールボックスを確認してください。", "success");
        submitBtn.textContent = '送信完了';

    } catch (err) {
        console.error(err);
        // エラー内容が英語の場合があるので、分かりやすく表示
        let userMsg = err.message;
        if (err.message.includes("rate limit")) {
            userMsg = "短時間に何度も送信できません。少し時間を置いてからお試しください。";
        }
        showStatus("⚠️ 送信に失敗しました。<br>" + userMsg, "error");
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
        errorMessage.style.padding = "10px";
        errorMessage.style.borderRadius = "4px";
        errorMessage.style.marginBottom = "15px";
    } else {
        errorMessage.style.color = "#d9534f"; // 赤色
        errorMessage.style.backgroundColor = "#fdecea";
        errorMessage.style.border = "1px solid #d9534f";
        errorMessage.style.padding = "10px";
        errorMessage.style.borderRadius = "4px";
        errorMessage.style.marginBottom = "15px";
    }
}