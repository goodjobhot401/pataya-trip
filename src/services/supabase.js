// src/services/supabase.js
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 如果沒有設定環境變數，提示錯誤
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Supabase URL or Key is missing in .env');
}

export const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
