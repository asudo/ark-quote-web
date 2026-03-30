/**
 * estimate-list.js
 * 役割：保存済み見積もりの【一覧表示とフィルタリング】
 * 主な処理：Supabaseからのデータ取得（下書き/確定）、ステータス別のリスト生成、編集画面への遷移
 */

document.addEventListener('DOMContentLoaded', async () => {

    const urlParams = new URLSearchParams(window.location.search);
    const statusFilter = urlParams.get('status') || 'draft';

    const listTitle = document.getElementById('listTitle');
    if (listTitle) {
        listTitle.innerText = statusFilter === 'final' ? '作成済一覧' : '下書き一覧';
    }

    await fetchAndDisplayEstimates(statusFilter);
});

async function fetchAndDisplayEstimates(status) {
    const listBody = document.getElementById('estimateListBody');

    try {
        const { data, error } = await supabaseClient
            .from('estimates')
            .select('*')
            .eq('status', status)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            listBody.innerHTML = `<tr><td colspan="5" class="empty-message">データが見つかりませんでした。</td></tr>`;
            return;
        }

        listBody.innerHTML = '';
        data.forEach(item => {
            const updatedDate = new Date(item.updated_at);
            const updatedStr = updatedDate.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) + ' ' +
                updatedDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            const createdStr = new Date(item.created_at).toLocaleDateString('ja-JP');
            const badgeClass = status === 'final' ? 'badge-final' : 'badge-draft';
            const badgeText = status === 'final' ? '確定' : '下書き';

            // --- ✨ 修正ポイント：行に状態別のクラス（row-final / row-draft）を付与 ---
            const tr = document.createElement('tr');
            const statusRowClass = status === 'final' ? 'row-final' : 'row-draft';
            tr.className = `row-link ${statusRowClass}`;

            tr.innerHTML = `
                <td>
                    <div style="font-weight: bold; font-size: 0.9rem; color: #333;">
                        ${updatedStr} <span style="font-size: 0.7rem; color: #999; font-weight: normal;">更新</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #bbb; margin-top: 2px;">
                        作成: ${createdStr}
                    </div>
                </td>
                <td style="font-weight: bold; font-size: 1rem;">${item.project_name || '件名なし'}</td>
                <td style="font-size: 0.85rem; color: #555;">
                    <i class="fa-regular fa-user" style="margin-right: 4px; color: #ccc;"></i>
                    ${item.creator_name || '---'}
                </td>
                <td class="text-center">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                </td>
                <td style="text-align: right;">
                    <button class="btn-open">開く</button>
                </td>
            `;

            // --- 🔹 クリックイベントの登録 ---
            // 1. 行全体のクリック
            tr.addEventListener('click', () => {
                loadEstimate(item.id);
            });

            // 2. ボタン単体のクリック
            const btn = tr.querySelector('.btn-open');
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // 行側のクリックイベントが動かないように止める
                loadEstimate(item.id);
            });

            listBody.appendChild(tr);
        });

    } catch (err) {
        console.error('データ取得エラー:', err);
        listBody.innerHTML = `<tr><td colspan="5" class="loading-message" style="color: red;">エラーが発生しました。</td></tr>`;
    }
}

// グローバルスコープで定義
window.loadEstimate = function (id) {
    window.location.href = `index.html?id=${id}`;
};