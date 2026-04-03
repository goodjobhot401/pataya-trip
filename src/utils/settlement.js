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
 * 通用的幣別換算工具
 */
const getConvertToBase = (rates, baseCurrency) => (amt, curr) => {
    if (!rates || curr === baseCurrency) return amt;
    const currentRate = rates[curr];
    const baseRate = rates[baseCurrency] || 1;
    if (!currentRate) return amt;
    // 若 1 TWD = 1, 1 THB = 0.95, 則 THB -> TWD 是 amt / 0.95
    return amt / currentRate * baseRate;
};

/**
 * 計算統一幣別的債務結清
 */
export function calculateUnifiedSettlement(expenses, users, rates, baseCurrency = 'TWD') {
    if (!rates) return [];

    const balances = {};
    users.forEach(u => balances[u.id] = 0);
    const convertToBase = getConvertToBase(rates, baseCurrency);

    expenses.forEach(exp => {
        const splitters = exp.expense_splitters || [];
        if (splitters.length > 0) {
            const totalShares = splitters.reduce((sum, s) => sum + (s.share_count || 1), 0);
            const totalInBase = convertToBase(exp.amount, exp.currency);
            const perShareInBase = totalInBase / totalShares;
            
            splitters.forEach(s => {
                balances[s.user_id] -= perShareInBase * (s.share_count || 1);
            });
        }

        (exp.expense_payers || []).forEach(p => {
            balances[p.user_id] += convertToBase(parseFloat(p.amount), exp.currency);
        });
    });

    return solveDebts(balances, users);
}

/**
 * 計算個人的資產淨值 (Net Balance)
 */
export function getPersonalSummaries(expenses, userId, rates = null, baseCurrency = 'TWD') {
    const summarized = { TWD: 0, THB: 0, Unified: 0 };
    const convertToBase = getConvertToBase(rates, baseCurrency);

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
            subShare = perShareAmount * (mySplit.share_count || 1);
            summarized[exp.currency] -= subShare;
        }

        if (rates) {
            const netAmount = subPaid - subShare;
            summarized.Unified += convertToBase(netAmount, exp.currency);
        }
    });

    return summarized;
}
