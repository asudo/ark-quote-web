// login.js

// 1. Supabaseの準備
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage'); // HTMLにある表示エリア

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // エラー表示を一度空にする
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
        // 日本語で分かりやすく表示する場合のカスタマイズ
        if (error.message === "Invalid login credentials") {
            errorMessage.innerText = "メールアドレスまたはパスワードが違います";
        } else {
            errorMessage.innerText = "ログインに失敗しました: " + error.message;
        }
        
        errorMessage.style.color = "red";
        errorMessage.style.marginBottom = "10px"; // 少し隙間を作る
        errorMessage.style.textAlign = "center";
        errorMessage.style.fontSize = "14px";
    } else {
        // ✅ 成功：アラートなしで即移動
        window.location.href = "menu.html"; 
    }
});