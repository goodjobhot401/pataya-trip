// src/services/expenses.js
import { supabase } from './supabase';

export async function fetchExpenses() {
    // 獲取支出主表
    const { data: expenses, error } = await supabase
        .from('expenses')
        .select(`
            *,
            created_by_user:users!expenses_created_by_fkey(name),
            expense_payers (
                user_id,
                amount,
                users (name)
            ),
            expense_splitters (
                user_id,
                share_count,
                users (name)
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching expenses:', error);
        throw error;
    }
    return expenses;
}

export async function createExpense(expenseData, payers, splitters) {
    // 1. 建立主表項目
    const { data: expense, error: eError } = await supabase
        .from('expenses')
        .insert([{
            item_name: expenseData.item_name,
            amount: expenseData.amount,
            currency: expenseData.currency,
            remarks: expenseData.remarks,
            created_by: expenseData.created_by
        }])
        .select()
        .single();

    if (eError) throw eError;

    const expenseId = expense.id;

    // 2. 建立支付者明細 (只有金額 > 0 的才存入)
    const payerRecords = payers
        .filter(p => p.amount > 0)
        .map(p => ({
            expense_id: expenseId,
            user_id: p.user_id,
            amount: p.amount
        }));
    
    if (payerRecords.length > 0) {
        const { error: pError } = await supabase.from('expense_payers').insert(payerRecords);
        if (pError) throw pError;
    }

    // 3. 建立分帳者明細 (包含份數)
    const splitterRecords = splitters.map(s => ({
        expense_id: expenseId,
        user_id: s.user_id,
        share_count: s.share_count || 1
    }));

    if (splitterRecords.length > 0) {
        const { error: sError } = await supabase.from('expense_splitters').insert(splitterRecords);
        if (sError) throw sError;
    }

    return expense;
}

export async function updateExpense(expenseId, expenseData, payers, splitters) {
    // 1. 更新主表
    const { error: eError } = await supabase
        .from('expenses')
        .update({
            item_name: expenseData.item_name,
            amount: expenseData.amount,
            currency: expenseData.currency,
            remarks: expenseData.remarks
        })
        .eq('id', expenseId);
    
    if (eError) throw eError;

    // 2. 更新明細 (直接砍掉重練最快)
    await supabase.from('expense_payers').delete().eq('expense_id', expenseId);
    await supabase.from('expense_splitters').delete().eq('expense_id', expenseId);

    const payerRecords = payers
        .filter(p => p.amount > 0)
        .map(p => ({
            expense_id: expenseId,
            user_id: p.user_id,
            amount: p.amount
        }));
    
    if (payerRecords.length > 0) {
        const { error: pError } = await supabase.from('expense_payers').insert(payerRecords);
        if (pError) throw pError;
    }

    const splitterRecords = splitters.map(s => ({
        expense_id: expenseId,
        user_id: s.user_id,
        share_count: s.share_count || 1
    }));

    if (splitterRecords.length > 0) {
        const { error: sError } = await supabase.from('expense_splitters').insert(splitterRecords);
        if (sError) throw sError;
    }
}

export async function deleteExpense(expenseId) {
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId);
    if (error) throw error;
}
