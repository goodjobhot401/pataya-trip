// src/services/settings.js
import { supabase } from './supabase';

/**
 * 獲取所有旅程設定
 */
export async function fetchTripSettings() {
    const { data, error } = await supabase
        .from('trip_settings')
        .select('*');

    if (error) {
        console.error('Error fetching trip settings:', error);
        throw error;
    }

    // 將 data 陣列轉換為 key-value 物件方便使用
    const settings = {};
    data.forEach(item => {
        settings[item.key] = item.value;
    });
    return settings;
}

/**
 * 更新匯率設定
 * @param {Object} rates - 例如 { TWD: 1, THB: 0.95 }
 * @param {string} userId - 更新者的 ID
 */
export async function updateExchangeRates(rates, userId) {
    const { error } = await supabase
        .from('trip_settings')
        .upsert({
            key: 'exchange_rates',
            value: rates,
            updated_by: userId,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error('Error updating exchange rates:', error);
        throw error;
    }
}
