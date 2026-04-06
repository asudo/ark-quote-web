/**
 * supabase.js
 */
const SUPABASE_URL = SUPABASE_CONFIG.URL;
const SUPABASE_KEY = SUPABASE_CONFIG.KEY;

if (typeof supabaseClient === 'undefined') {
    var supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}