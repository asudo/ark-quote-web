async function checkAuth() {
    try {
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            window.location.href = "login.html";
            return;
        }

        const { data: userData, error: dbError } = await supabaseClient
            .from('user_master')
            .select('user_name')
            .eq('login_email', user.email)
            .single();

        const nameDisplay = document.getElementById('userNameDisplay');

        if (userData && userData.user_name) {
            // 1. 名前をセットする
            nameDisplay.innerText = userData.user_name + " さん";
            // 2. フェードインを開始させる！
            nameDisplay.classList.add('show');
        } else {
            nameDisplay.innerText = user.email + " さん";
            nameDisplay.classList.add('show');
        }

    } catch (err) {
        console.error("予期せぬエラーが発生しました:", err);
    }
}

async function handleLogout() {
    if (confirm('ログアウトしますか？')) {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    }
}

// 画面読み込み時に実行
checkAuth();