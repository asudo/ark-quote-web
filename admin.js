/**
 * admin.js
 * 役割：ユーザー管理（閲覧・権限変更・アクティブ状態・並べ替え・検索）
 */

// --- グローバル変数（アプリ全体で使う箱） ---
let allUsers = []; // Supabaseから取得した全ユーザーデータを一時保存する場所
let sortConfig = { key: 'user_name', direction: 'asc' }; // 現在の並び順（初期値：名前の昇順）

// --- 初期化処理（画面が開いた瞬間に動く） ---
document.addEventListener('DOMContentLoaded', async () => {
    await fetchUsers();       // 1. データを読み込む
    setupSearch();            // 2. 検索ボックスを使えるようにする
    setupSortHeaders();       // 3. 表の見出しをクリックできるようにする
});

// --- 1. データ取得処理 ---
async function fetchUsers() {
    try {
        // user_masterテーブルから全データを取得
        const { data: users, error } = await supabaseClient
            .from('user_master')
            .select('*');

        if (error) throw error; // エラーがあれば catch ブロックへ

        allUsers = users;     // 取得したデータを変数に保存
        renderUserTable();    // 画面に表を描画する
    } catch (err) {
        console.error('取得エラー:', err);
    }
}

// --- 2. テーブル描画処理（メインの見た目作り） ---
function renderUserTable(filterText = "") {
    const listBody = document.getElementById('userListBody');
    const userCountBadge = document.getElementById('userCountBadge');

    // 【並べ替えロジック】設定されたキー(名前や日付)に基づいてデータを並び替える
    let sortedUsers = [...allUsers].sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // 【検索フィルタリング】入力された文字が名前かメールに含まれる人だけ残す
    if (filterText) {
        sortedUsers = sortedUsers.filter(u =>
            u.user_name.includes(filterText) || u.login_email.includes(filterText)
        );
    }

    // 【人数表示】現在の人数をバッジに反映
    if (userCountBadge) userCountBadge.innerText = `${sortedUsers.length} 名`;

    // 一旦テーブルを空にしてから、1人ずつ行(tr)を作成していく
    listBody.innerHTML = '';
    sortedUsers.forEach(user => {
        const tr = document.createElement('tr');
        
        // 【消し込み演出】非アクティブなユーザーは薄く表示する
        if (!user.is_active) {
            tr.style.opacity = "0.5";
            tr.style.backgroundColor = "#f8f9fa";
        }
        tr.style.transition = "all 0.3s ease"; // 変化をなめらかに

        // 【日本時間フォーマット】更新日時をJST(日本時間)に変換
        const lastUpdated = user.updated_at
            ? new Date(user.updated_at).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            })
            : '---';

        // 行のHTMLを組み立て
        tr.innerHTML = `
            <td class="ps-4 fw-bold">${user.user_name}</td>
            <td class="text-secondary small fw-bold">${user.user_initial || '--'}</td>
            <td class="text-muted small">${user.login_email}</td>
            <td>
                <select class="form-select form-select-sm role-select">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理者</option>
                    <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>スタッフ</option>
                    <option value="guest" ${user.role === 'guest' ? 'selected' : ''}>ゲスト</option>
                </select>
            </td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input active-toggle" type="checkbox" ${user.is_active ? 'checked' : ''}>
                </div>
            </td>
            <td class="text-center small text-muted">${lastUpdated}</td>
        `;

        // --- 行ごとのイベント登録 ---

        // A. 権限変更時の処理
        tr.querySelector('.role-select').addEventListener('change', async (e) => {
            const targetUserId = user.id;
            const newRole = e.target.value;
            
            // 自分自身を管理者から外そうとしたらブロック
            const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
            if (currentUser && currentUser.id === targetUserId && newRole !== 'admin') {
                alert("自分自身の管理者権限を解除することはできません。");
                e.target.value = 'admin'; // セレクトボックスを戻す
                return;
            }
            await updateUserField(targetUserId, { role: newRole });
        });

        // B. 有効/無効（スイッチ）切り替え時の処理
        tr.querySelector('.active-toggle').addEventListener('change', async (e) => {
            const targetUserId = user.id;
            const isActive = e.target.checked;
            
            // 自分自身を無効にしようとしたらブロック
            const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
            if (currentUser && currentUser.id === targetUserId && !isActive) {
                alert("自分自身を無効にすることはできません。");
                e.target.checked = true; // スイッチを戻す
                return;
            }
            
            // 見た目をリアルタイムに変更
            tr.style.opacity = isActive ? "1" : "0.5";
            tr.style.backgroundColor = isActive ? "transparent" : "#f8f9fa";
            
            await updateUserField(targetUserId, { is_active: isActive });
        });

        listBody.appendChild(tr);
    });
}

// --- 3. 検索ボックスの動作設定 ---
function setupSearch() {
    const searchInput = document.getElementById('userSearchInput');
    if (!searchInput) return;
    // 文字が入力されるたびにテーブルを再描画（フィルタリング実行）
    searchInput.addEventListener('input', (e) => {
        renderUserTable(e.target.value);
    });
}

// --- 4. 並べ替え機能（見出しクリック）の設定 ---
function setupSortHeaders() {
    const headers = document.querySelectorAll('th');
    // テーブルの見出し順に対応したデータのキー名
    const keyMap = ['user_name', 'user_initial', 'login_email', 'role', 'is_active', 'updated_at'];

    headers.forEach((th, index) => {
        if (keyMap[index]) {
            th.style.cursor = 'pointer';
            th.addEventListener('click', () => {
                const key = keyMap[index];
                // 同じ見出しをクリックしたら昇順/降順を反転
                sortConfig.direction = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
                sortConfig.key = key;

                // クリックした見出しを青色にする（視覚効果）
                headers.forEach(h => h.classList.remove('text-primary'));
                th.classList.add('text-primary');

                // 現在の検索ワードを維持したまま再描画
                renderUserTable(document.getElementById('userSearchInput')?.value);
            });
        }
    });
}

// --- 5. データベース更新（共通処理） ---
async function updateUserField(userId, updateData) {
    try {
        // 更新時刻をセット
        updateData.updated_at = new Date().toISOString();

        // Supabaseのデータを更新
        const { error } = await supabaseClient
            .from('user_master')
            .update(updateData)
            .eq('id', userId);

        if (error) throw error;

        // 【重要】メモリ上のデータ(allUsers)も書き換えて、再読み込みなしで最新状態にする
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updateData };
        }
    } catch (err) {
        console.error('更新エラー:', err);
        alert('保存に失敗しました。');
    }
}