// login.js
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');

// --- ログインボタンを押した時の処理 ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.innerText = "";

    const email = document.getElementById('userId').value;
    const password = document.getElementById('password').value;

    // 2. ログイン実行
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        // ❌ 失敗：エラーメッセージを赤文字で表示
        if (error.message === "Invalid login credentials") {
            errorMessage.innerText = "メールアドレスまたはパスワードが違います";
        } else {
            errorMessage.innerText = "ログインに失敗しました: " + error.message;
        }

        errorMessage.style.color = "red";
        errorMessage.style.marginBottom = "10px"; // 少し隙間を作る
        errorMessage.style.textAlign = "center";
        errorMessage.style.fontSize = "14px";
    } else { // ❌ 失敗：エラーメッセージを赤文字で表示
        try {
            const user = data.user;

            // user_masterテーブルから名前(user_name)を取得
            const { data: userData, error: dbError } = await supabaseClient
                .from('user_master')
                .select('user_name')
                .eq('login_email', user.email)
                .single();

            if (userData && userData.user_name) {
                // ブラウザのメモ帳（sessionStorage）に名前を保存
                sessionStorage.setItem('userName', userData.user_name);
            } else {
                // 名前が見つからない場合はメールアドレスを暫定的に保存
                sessionStorage.setItem('userName', user.email);
            }

            // メニュー画面へ移動
            window.location.href = "menu.html";

        } catch (err) {
            console.error("ユーザー情報の取得に失敗しました:", err);
            window.location.href = "menu.html"; // エラーが起きてもログイン自体は成功しているので移動
        }
    }
});

// --- パスワード切り替えの処理 ---
const togglePasswordBtn = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const eyeOpen = document.getElementById('eyeOpen');
const eyeClose = document.getElementById('eyeClose');

if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', function () {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

        if (isPassword) {
            eyeOpen.classList.add('hidden');
            eyeClose.classList.remove('hidden');
        } else {
            eyeOpen.classList.remove('hidden');
            eyeClose.classList.add('hidden');
        }
    });
}