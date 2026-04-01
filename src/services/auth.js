// src/services/auth.js
import { supabase } from './supabase';

export async function handleLogin(name, key) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .eq('key', key)
        .single();

    if (error || !data) {
        throw new Error('無效的成員名稱或密鑰，請聯絡主辦人。');
    }

    return data;
}

export async function getAllUsers() {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return data;
}
