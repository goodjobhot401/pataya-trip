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

export async function deleteRecommendation(recommendation) {
    const { id, image_urls } = recommendation;

    // 1. 刪除雲端 Storage 裡的圖片檔案
    if (image_urls && image_urls.length > 0) {
        // 從 URL 中提取檔名 (假設 URL 格式為 .../recommendations/filename)
        const fileNames = image_urls.map(url => {
            try {
                const parts = url.split('/');
                return parts[parts.length - 1].split('?')[0]; // 移除可能的 query string
            } catch (e) {
                return null;
            }
        }).filter(name => name !== null);

        if (fileNames.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('recommendations')
                .remove(fileNames);
            
            if (storageError) console.error('Storage 圖片刪除失敗:', storageError);
        }
    }

    // 2. 刪除資料庫紀錄
    const { error: dbError } = await supabase
        .from('recommendations')
        .delete()
        .eq('id', id);
    
    if (dbError) throw dbError;
}

/**
 * 呼叫爬蟲後端 (假設本地運行在 :3001)
 */
export async function crawlUrl(url) {
    // 配合後端新設定的埠號 3003
    const API_URL = 'http://localhost:3003/api/crawl';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        if (!response.ok) {
            // 嘗試解析錯誤訊息
            let errorMsg = '爬取失敗';
            try {
                const err = await response.json();
                errorMsg = err.message || errorMsg;
            } catch (e) {
                errorMsg = `伺服器連線異常 (代碼: ${response.status})`;
            }
            throw new Error(errorMsg);
        }
        
        return await response.json();
    } catch (err) {
        console.error("Crawl Error:", err);
        // 如果是連線失敗，通常是伺服器沒開
        if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
            throw new Error("無法連線到本地爬蟲服務，請確認已執行 `node server/index.js` 且正在運行。");
        }
        throw err;
    }
}
