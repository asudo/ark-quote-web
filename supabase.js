/**
 * supabase.js
 */

// 🌟 安全に設定を読み込む（window. を明示する）
const SUPABASE_URL = window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG.URL : null;
const SUPABASE_KEY = window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG.KEY : null;

// 設定が読み込めていない場合の警告（デバッグ用）
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("【重大エラー】config.js の読み込みに失敗しているか、URL/KEYが正しく設定されていません。");
}

// クライアントの初期化
if (typeof window.supabaseClient === 'undefined') {
    // window.supabase（ライブラリ本体）が存在するか確認してから作成
    if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase Client が正常に初期化されました");
    } else {
        console.error("【重大エラー】Supabaseライブラリ(CDN)が読み込まれていません。");
    }
}