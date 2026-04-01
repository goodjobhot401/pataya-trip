// src/services/voting.js
import { supabase } from './supabase';

export async function fetchAccommodations() {
    const { data, error } = await supabase.from('accommodations').select('*');
    if (error) throw error;
    return data;
}

export async function fetchUserVotes(userId) {
    const { data, error } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', userId);
    if (error) throw error;
    return data;
}

export async function fetchAllVotes() {
    const { data, error } = await supabase
        .from('votes')
        .select('*, accommodations(name), users(name)');
    if (error) throw error;
    return data;
}

export async function castVote(userId, accommodationId) {
    const { error } = await supabase
        .from('votes')
        .insert([{
            user_id: userId,
            accommodation_id: accommodationId
        }]);
    if (error) throw error;
}

export async function deleteVote(userId, accommodationId) {
    const { error } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', userId)
        .eq('accommodation_id', accommodationId);
    if (error) throw error;
}
