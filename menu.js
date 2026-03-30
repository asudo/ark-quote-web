/**
 * menu.js
 * 役割：【ユーザー認証・権限管理】とステータス表示の制御
 * 主な処理：Supabaseを利用したログイン状態の検証、ユーザー名と見積件数（作成済/下書き）の
 * リアルタイム取得・表示、およびログアウト処理と未認証時のリダイレクト制御。
 */

async function checkAuth() {
    try {
        // --- 📅 本日の日付を自動セット ---
        updateTodayDate();

        const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

        if (authError || !user) {
            window.location.href = "login.html";
            return;
        }

        // --- 👤 ユーザー情報の取得 (roleも追加) ---
        const { data: userData, error: dbError } = await supabaseClient
            .from('user_master')
            .select('user_name, role')
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

        // --- 🛡️ 管理者権限のチェック (追加箇所) ---
        if (userData && userData.role === 'admin') {
            const adminItem = document.getElementById('adminMenuItem');
            if (adminItem) {
                adminItem.classList.remove('d-none');
            }
        }

        // --- 件数取得 ---

        // 1. 作成済 (final) の件数を取得
        const { count: finalCount } = await supabaseClient
            .from('estimates')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'final');

        // 2. 下書き (draft) の件数を取得
        const { count: draftCount } = await supabaseClient
            .from('estimates')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'draft');

        // HTMLの<span>に数字を書き込む
        const finalElem = document.getElementById('finalCount');
        const draftElem = document.getElementById('draftCount');

        if (finalElem) finalElem.innerText = finalCount || 0;
        if (draftElem) draftElem.innerText = draftCount || 0;

    } catch (err) {
        console.error("予期せぬエラーが発生しました:", err);
    }
}

/**
 * 📅 本日の日付を表示用に整形してセットする
 */
function updateTodayDate() {
    const now = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const day = days[now.getDay()];

    const displayStr = `${y}.${m}.${d} (${day})`;
    const el = document.getElementById('currentDateDisplay');
    if (el) {
        el.innerHTML = `<i class="fa-regular fa-calendar-check me-1"></i>${displayStr}`;
    }
}

/**
 * 🔓 ログアウト処理
 * ドロップダウンから呼び出される。確認ダイアログを出して誤操作を防止。
 */
async function handleLogout() {
    if (confirm('ログアウトして終了しますか？')) {
        try {
            await supabaseClient.auth.signOut();
            window.location.href = "login.html";
        } catch (err) {
            console.error("ログアウト中にエラーが発生しました:", err);
        }
    }
}

// グローバルスコープから呼び出せるように登録（HTMLのonclick用）
window.handleLogout = handleLogout;

// 画面読み込み時に実行
checkAuth();