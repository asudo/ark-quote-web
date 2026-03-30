/**
 * admin.js
 * 役割：ユーザー管理（閲覧・権限変更・アクティブ状態・並べ替え・検索
 */

let allUsers = [];
let sortConfig = { key: 'user_name', direction: 'asc' };

document.addEventListener('DOMContentLoaded', async () => {
    await fetchUsers();
    setupSearch();
    setupSortHeaders();
});

async function fetchUsers() {
    try {
        const { data: users, error } = await supabaseClient
            .from('user_master')
            .select('*');
        if (error) throw error;
        allUsers = users;
        renderUserTable();
    } catch (err) {
        console.error('取得エラー:', err);
    }
}

function renderUserTable(filterText = "") {
    const listBody = document.getElementById('userListBody');
    const userCountBadge = document.getElementById('userCountBadge');

    let sortedUsers = [...allUsers].sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (filterText) {
        sortedUsers = sortedUsers.filter(u =>
            u.user_name.includes(filterText) || u.login_email.includes(filterText)
        );
    }

    if (userCountBadge) userCountBadge.innerText = `${sortedUsers.length} 名`;

    listBody.innerHTML = '';
    sortedUsers.forEach(user => {
        const tr = document.createElement('tr');
        if (!user.is_active) {
            tr.style.opacity = "0.5";
            tr.style.backgroundColor = "#f8f9fa";
        }
        tr.style.transition = "all 0.3s ease";

        // ✨ 日本時間(JST)でフォーマット
        const lastUpdated = user.updated_at
            ? new Date(user.updated_at).toLocaleString('ja-JP', {
                timeZone: 'Asia/Tokyo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })
            : '---';

        tr.innerHTML = `
            <td class="ps-4 fw-bold">${user.user_name}</td>
            <td class="text-secondary small fw-bold">${user.user_initial || '--'}</td>
            <td class="text-muted small">${user.login_email}</td>
            <td>
                <select class="form-select form-select-sm role-select" data-user-id="${user.id}">
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>管理者</option>
                    <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>スタッフ</option>
                    <option value="guest" ${user.role === 'guest' ? 'selected' : ''}>ゲスト</option>
                </select>
            </td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input active-toggle" type="checkbox" ${user.is_active ? 'checked' : ''} data-user-id="${user.id}">
                </div>
            </td>
            <td class="text-center small text-muted">${lastUpdated}</td>
        `;

        tr.querySelector('.role-select').addEventListener('change', async (e) => {
            const targetUserId = user.id;
            const newRole = e.target.value;
            const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
            if (currentUser && currentUser.id === targetUserId && newRole !== 'admin') {
                alert("自分自身の管理者権限を解除することはできません。");
                e.target.value = 'admin';
                return;
            }
            await updateUserField(targetUserId, { role: newRole });
        });

        tr.querySelector('.active-toggle').addEventListener('change', async (e) => {
            const targetUserId = user.id;
            const isActive = e.target.checked;
            const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
            if (currentUser && currentUser.id === targetUserId && !isActive) {
                alert("自分自身を無効にすることはできません。");
                e.target.checked = true;
                return;
            }
            tr.style.opacity = isActive ? "1" : "0.5";
            tr.style.backgroundColor = isActive ? "transparent" : "#f8f9fa";
            await updateUserField(targetUserId, { is_active: isActive });
        });

        listBody.appendChild(tr);
    });
}

function setupSearch() {
    const searchInput = document.getElementById('userSearchInput');
    if (!searchInput) return;
    searchInput.addEventListener('input', (e) => {
        renderUserTable(e.target.value);
    });
}

function setupSortHeaders() {
    const headers = document.querySelectorAll('th');
    const keyMap = ['user_name', 'user_initial', 'login_email', 'role', 'is_active', 'updated_at'];
    headers.forEach((th, index) => {
        if (keyMap[index]) {
            th.style.cursor = 'pointer';
            th.title = 'クリックで並べ替え';
            th.addEventListener('click', () => {
                const key = keyMap[index];
                sortConfig.direction = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
                sortConfig.key = key;
                headers.forEach(h => h.classList.remove('text-primary'));
                th.classList.add('text-primary');
                renderUserTable(document.getElementById('userSearchInput')?.value);
            });
        }
    });
}

async function updateUserField(userId, updateData) {
    try {
        updateData.updated_at = new Date().toISOString();
        const { error } = await supabaseClient
            .from('user_master')
            .update(updateData)
            .eq('id', userId);
        if (error) throw error;
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updateData };
        }
    } catch (err) {
        console.error('更新エラー:', err);
        alert('保存に失敗しました。');
    }
}