// src/services/recommendationService.js
import { supabase } from './supabase';

export async function fetchRecommendations() {
    const { data, error } = await supabase
        .from('recommendations')
        .select('*, users(name)')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

export async function createRecommendation(data) {
    const { error } = await supabase
        .from('recommendations')
        .insert([data]);
    
    if (error) throw error;
}

export async function deleteRecommendation(id) {
    const { error } = await supabase
        .from('recommendations')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
}

/**
 * 呼叫爬蟲後端 (假設本地運行在 :3001)
 */
export async function crawlUrl(url) {
    // 我們可以動態決定 API URL，開發環境可能是 localhost:3001
    const API_URL = 'http://localhost:3001/api/crawl';
    
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || '爬取失敗');
    }
    
    return await response.json();
}
