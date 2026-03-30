/**
 * supabase.js
 * 役割：【データベース接続の初期化】と共通クライアントの提供
 * 主な処理：SupabaseのURL・APIキーの設定、プロジェクト全域で使う supabaseClient の生成
 */

const SUPABASE_URL = 'https://tfljqavrlrjpzjdmyzey.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmbGpxYXZybHJqcHpqZG15emV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDczNjYsImV4cCI6MjA4NTYyMzM2Nn0._7YitLhYelEfFTzAvUFiam-rr73JxLbZtWNxTmY7jH0';
if (typeof supabaseClient === 'undefined') {
    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}