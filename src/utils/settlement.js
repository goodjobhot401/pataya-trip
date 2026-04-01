// src/utils/settlement.js

/**
 * 計算所有支出的債務結清
 * @param {Array} expenses - 從 Supabase 抓回來的 expenses 陣列 (包含 payers 與 splitters)
 * @param {Array} users - 所有成員清單
 * @returns {Object} { TWD: [ { from, to, amount } ], THB: [ ... ] }
 */
export function calculateSettlements(expenses, users) {
    const currencies = ['TWD', 'THB'];
    const finalSettlements = { TWD: [], THB: [] };

    currencies.forEach(curr => {
        // 1. 初始化每位使用者的淨額平衡 (Net Balance)
        // Net Balance = (該幣別下總共代墊的錢) - (該幣別下總共應付的錢)
        const balances = {};
        users.forEach(u => balances[u.id] = 0);

        // 2. 累計每筆支出的收支
        expenses.filter(e => e.currency === curr).forEach(exp => {
            // 代墊款
            exp.expense_payers.forEach(p => {
                balances[p.user_id] += parseFloat(p.amount);
            });

            // 應付分攤款 (通常是平均分配)
            const splitters = exp.expense_splitters;
            if (splitters.length > 0) {
                const totalAmount = exp.expense_payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const shareAmount = totalAmount / splitters.length;
                splitters.forEach(s => {
                    balances[s.user_id] -= shareAmount;
                });
            }
        });

        // 3. 找出債務人 (Net < 0) 與 債權人 (Net > 0)
        let debtors = [];
        let creditors = [];

        users.forEach(u => {
            const bal = balances[u.id];
            if (bal < -0.01) { // 稍微考慮精度
                debtors.push({ id: u.id, name: u.name, amount: Math.abs(bal) });
            } else if (bal > 0.01) {
                creditors.push({ id: u.id, name: u.name, amount: bal });
            }
        });

        // 4. 配對債務與債權 (最簡化路徑)
        let d = 0;
        let c = 0;
        while (d < debtors.length && c < creditors.length) {
            const debtor = debtors[d];
            const creditor = creditors[c];
            const settleAmount = Math.min(debtor.amount, creditor.amount);

            finalSettlements[curr].push({
                from: debtor.name,
                fromId: debtor.id,
                to: creditor.name,
                toId: creditor.id,
                amount: settleAmount
            });

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount < 0.01) d++;
            if (creditor.amount < 0.01) c++;
        }
    });

    return finalSettlements;
}

/**
 * 計算個人的資產淨值 (Net Balance)
 * 用於「個人帳務」視圖
 */
export function getPersonalSummaries(expenses, userId) {
    const summarized = { TWD: 0, THB: 0 };
    
    expenses.forEach(exp => {
        // 我墊了多少錢
        const myPaid = exp.expense_payers.find(p => p.user_id === userId);
        if (myPaid) summarized[exp.currency] += parseFloat(myPaid.amount);

        // 我分擔了多少錢
        const mySplit = exp.expense_splitters.find(s => s.user_id === userId);
        if (mySplit) {
            const totalAmount = exp.expense_payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
            const share = totalAmount / exp.expense_splitters.length;
            summarized[exp.currency] -= share;
        }
    });

    return summarized;
}
