// src/utils/settlement.js

/**
 * 補助函式：根據提供的餘額對應表 (Balances) 來配對債務路徑
 */
function solveDebts(balances, users) {
    let debtors = [];
    let creditors = [];

    users.forEach(u => {
        const bal = balances[u.id];
        if (bal < -0.01) {
            debtors.push({ id: u.id, name: u.name, amount: Math.abs(bal) });
        } else if (bal > 0.01) {
            creditors.push({ id: u.id, name: u.name, amount: bal });
        }
    });

    const result = [];
    let d = 0;
    let c = 0;
    while (d < debtors.length && c < creditors.length) {
        const debtor = debtors[d];
        const creditor = creditors[c];
        const settleAmount = Math.min(debtor.amount, creditor.amount);

        result.push({
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
    return result;
}

/**
 * 計算所有支出的債務結清 (依據幣別分開)
 */
export function calculateSettlements(expenses, users) {
    const currencies = [...new Set(expenses.map(e => e.currency))];
    const finalSettlements = {};

    currencies.forEach(curr => {
        const balances = {};
        users.forEach(u => balances[u.id] = 0);

        expenses.filter(e => e.currency === curr).forEach(exp => {
            const payers = exp.expense_payers || [];
            const splitterRecords = exp.expense_splitters || [];
            
            payers.forEach(p => {
                balances[p.user_id] += parseFloat(p.amount);
            });

            if (splitterRecords.length > 0) {
                const totalAmount = payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                const totalShares = splitterRecords.reduce((sum, s) => sum + (s.share_count || 1), 0);
                const perShareAmount = totalAmount / totalShares;
                
                splitterRecords.forEach(s => {
                    balances[s.user_id] -= perShareAmount * (s.share_count || 1);
                });
            }
        });

        finalSettlements[curr] = solveDebts(balances, users);
    });

    return finalSettlements;
}

/**
 * 計算統一幣別的債務結清
 * @param {Object} rates - 匯率物件，例如 { TWD: 1, THB: 0.95 } (代表 1 TWD = 0.95 THB)
 */
export function calculateUnifiedSettlement(expenses, users, rates, baseCurrency = 'TWD') {
    if (!rates) return [];

    const balances = {};
    users.forEach(u => balances[u.id] = 0);

    const convertToBase = (amt, curr) => {
        if (curr === baseCurrency) return amt;
        const currentRate = rates[curr];
        const baseRate = rates[baseCurrency] || 1;
        if (!currentRate) return amt;
        // 若 1 TWD = 0.95 THB, 則 THB -> TWD 是 amt / 0.95
        return amt / currentRate * baseRate;
    };

    expenses.forEach(exp => {
        exp.expense_payers.forEach(p => {
            balances[p.user_id] += convertToBase(parseFloat(p.amount), exp.currency);
        });

        const splitters = exp.expense_splitters || [];
        if (splitters.length > 0) {
            const totalShares = splitters.reduce((sum, s) => sum + (s.share_count || 1), 0);
            const totalInBase = convertToBase(exp.amount, exp.currency);
            const perShareInBase = totalInBase / totalShares;
            
            splitters.forEach(s => {
                balances[s.user_id] -= perShareInBase * (s.share_count || 1);
            });
        }
    });

    return solveDebts(balances, users);
}

/**
 * 計算個人的資產淨值 (Net Balance)
 * @returns {Object} { TWD: net, THB: net, Unified: net (以 TWD 計) }
 */
export function getPersonalSummaries(expenses, userId, rates = null, baseCurrency = 'TWD') {
    const summarized = { TWD: 0, THB: 0, Unified: 0 };
    
    // ... (convertToBase 保持不變)

    expenses.forEach(exp => {
        const myPaid = exp.expense_payers.find(p => p.user_id === userId);
        const mySplit = exp.expense_splitters.find(s => s.user_id === userId);
        
        let subPaid = 0;
        let subShare = 0;

        if (myPaid) {
            subPaid = parseFloat(myPaid.amount);
            summarized[exp.currency] += subPaid;
        }

        if (mySplit) {
            const totalShares = exp.expense_splitters.reduce((sum, s) => sum + (s.share_count || 1), 0);
            const perShareAmount = exp.amount / totalShares;
            // 重要：個人的欠款 = 每份單價 * 自己的份數
            subShare = perShareAmount * (mySplit.share_count || 1);
            summarized[exp.currency] -= subShare;
        }

        // 統一幣別計算
        if (rates) {
            const netAmount = subPaid - subShare;
            summarized.Unified += convertToBase(netAmount, exp.currency);
        }
    });

    return summarized;
}
