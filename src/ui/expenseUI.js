// src/ui/expenseUI.js
import { calculateSettlements, getPersonalSummaries } from '../utils/settlement';

const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0
    }).format(amount);
};

export function renderExpenseList(expenses, currentUserId, onEdit, onDelete) {
    const container = document.getElementById('expense-list');
    if (!container) return;

    if (expenses.length === 0) {
        container.innerHTML = '<div class="empty-state card">目前還沒有任何支出登記喔！💸</div>';
        return;
    }

    container.innerHTML = expenses.map(exp => {
        const payersText = exp.expense_payers
            .map(p => `${p.users.name} (${formatCurrency(p.amount, exp.currency)})`)
            .join(', ');
        
        const splittersText = exp.expense_splitters
            .map(s => s.users.name)
            .join(', ');

        const date = new Date(exp.created_at).toLocaleDateString('zh-TW', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return `
            <div class="expense-item card ${exp.currency}">
                <div class="expense-main">
                    <div class="expense-info">
                        <div class="expense-header">
                            <span class="expense-badge ${exp.currency}">${exp.currency}</span>
                            <h3 class="expense-item-name">${exp.item_name}</h3>
                        </div>
                        <div class="expense-meta">
                            <span>🕒 ${date}</span>
                            <span>👤 登記自：${exp.created_by_user?.name || '未知'}</span>
                        </div>
                    </div>
                    <div class="expense-amount">
                        ${formatCurrency(exp.amount, exp.currency)}
                    </div>
                </div>
                <hr class="expense-divider">
                <div class="expense-details">
                    <div><strong>🙋 支付人：</strong> ${payersText}</div>
                    <div><strong>👥 分款人：</strong> ${splittersText}</div>
                    ${exp.remarks ? `<div><strong>📝 備註：</strong> ${exp.remarks}</div>` : ''}
                </div>
                <div class="expense-actions-row">
                    <button class="btn-icon-styled btn-edit" data-id="${exp.id}">✏️ 編輯</button>
                    <button class="btn-icon-styled btn-delete" data-id="${exp.id}">🗑️ 刪除</button>
                </div>
            </div>
        `;
    }).join('');

    // 綁定事件
    container.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => onEdit(btn.dataset.id));
    });
    container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => onDelete(btn.dataset.id));
    });
}

export function renderSettlementSummary(expenses, users) {
    const summaryContainer = document.getElementById('expense-summary');
    if (!summaryContainer) return;

    const settlements = calculateSettlements(expenses, users);

    const renderCurrencyBlock = (curr) => {
        const list = settlements[curr];
        if (list.length === 0) return `<div class="settle-empty">暫無${curr}債務</div>`;
        
        return list.map(s => `
            <div class="settle-row">
                <span class="settle-name debtor">${s.from}</span>
                <span class="settle-arrow">➡️ 支付給 ➡️</span>
                <span class="settle-name creditor">${s.to}</span>
                <span class="settle-amount">${formatCurrency(s.amount, curr)}</span>
            </div>
        `).join('');
    };

    summaryContainer.innerHTML = `
        <div class="settlement-blocks">
            <div class="settlement-column">
                <h4>🇹🇼 台幣結標 (TWD)</h4>
                ${renderCurrencyBlock('TWD')}
            </div>
            <div class="settlement-column">
                <h4>🇹🇭 泰銖結標 (THB)</h4>
                ${renderCurrencyBlock('THB')}
            </div>
        </div>
    `;
}

export function renderPersonalSettlement(expenses, users, currentUserId) {
    const container = document.getElementById('personal-settlement');
    if (!container) return;

    const currentUser = users.find(u => u.id === currentUserId);
    const userName = currentUser ? currentUser.name : '';
    const summary = getPersonalSummaries(expenses, currentUserId);
    const settlements = calculateSettlements(expenses, users);

    // 篩選與當前使用者相關的轉帳路徑
    const mySettleActions = [];
    ['TWD', 'THB'].forEach(currency => {
        const curSettles = settlements[currency] || [];
        curSettles.forEach(s => {
            if (s.from === userName || s.to === userName) {
                mySettleActions.push({ ...s, currency });
            }
        });
    });

    const renderPill = (amount, curr) => {
        const classes = amount >= 0 ? 'status-check' : 'status-waiting';
        const prefix = amount >= 0 ? '應收回' : '應支付';
        return `
            <div class="personal-pill ${classes}">
                <span class="pill-label">${curr} 平衡：</span>
                <span class="pill-value">${prefix} ${formatCurrency(Math.abs(amount), curr)}</span>
            </div>
        `;
    };

    let actionsHtml = '';
    if (mySettleActions.length > 0) {
        actionsHtml = `
            <div class="personal-actions-list" style="margin-top: 35px;">
                <h4 style="margin-bottom: 20px; color: #1a3a5a; border-bottom: 2px solid #eee; padding-bottom: 10px;">📋 我的轉帳指引</h4>
                <div class="settle-items">
                    ${mySettleActions.map(s => {
                        const isPayOut = s.from === userName;
                        return `
                            <div class="settle-row" style="background: ${isPayOut ? 'rgba(229, 62, 62, 0.05)' : 'rgba(39, 174, 96, 0.05)'}; padding: 15px 20px; border-radius: 12px; margin-bottom: 10px; border: 1px solid ${isPayOut ? '#fed7d7' : '#c6f6d5'};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: 700; font-size: 1.05rem;">
                                        ${isPayOut ? `<span style="color:#e53e3e">💸 需支付給</span> <strong>${s.to}</strong>` : `<span style="color:#27ae60">💰</span> <strong>${s.from}</strong> <span style="color:#27ae60">需支付給我</span>`}
                                    </span>
                                    <span class="settle-amount" style="font-size: 1.25rem; font-weight: 900; ${isPayOut ? 'color:#e53e3e' : 'color:#27ae60'}">
                                        ${formatCurrency(s.amount, s.currency)}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else {
        actionsHtml = `<div class="empty-state" style="margin-top: 30px; opacity: 0.5;">目前帳務已平衡，暫無轉帳任務！✨</div>`;
    }

    container.innerHTML = `
        <div class="personal-summary-grid">
            ${renderPill(summary.TWD, 'TWD')}
            ${renderPill(summary.THB, 'THB')}
        </div>
        
        ${actionsHtml}

        <p class="settle-tip" style="margin-top: 40px; border-top: 1px dashed #ddd; padding-top: 20px;">
            💡 數值為正代表你有代墊，最後應收回；負數代表你應支付給他人。
        </p>
    `;
}

export function initExpenseModal(users) {
    const payersContainer = document.getElementById('payers-container');
    const splittersContainer = document.getElementById('splitters-container');

    if (payersContainer) {
        payersContainer.innerHTML = users.map(u => `
            <div class="payer-input-row" data-user-id="${u.id}">
                <span class="user-label">${u.name}</span>
                <input type="number" step="0.1" class="payer-amount-input" placeholder="0">
            </div>
        `).join('');
    }

    if (splittersContainer) {
        splittersContainer.innerHTML = users.map(u => `
            <label class="splitter-checkbox">
                <input type="checkbox" value="${u.id}" checked>
                <span>${u.name}</span>
            </label>
        `).join('');
    }
}

export function openExpenseModal(expense = null) {
    const modal = document.getElementById('expense-modal');
    modal.classList.remove('hidden');

    const form = document.getElementById('expense-form');
    form.reset();

    if (expense) {
        // 填充編輯資料
        document.getElementById('modal-title').textContent = '✏️ 編輯支出';
        document.getElementById('expense-id').value = expense.id;
        document.getElementById('item-name').value = expense.item_name;
        document.getElementById('amount').value = expense.amount;
        document.getElementById('currency').value = expense.currency;
        document.getElementById('remarks').value = expense.remarks || '';

        // 設置支付者金額
        const rows = document.querySelectorAll('.payer-input-row');
        rows.forEach(row => {
            const input = row.querySelector('.payer-amount-input');
            const payer = expense.expense_payers.find(p => p.user_id === row.dataset.userId);
            input.value = payer ? payer.amount : '';
        });

        // 設置分款者勾選
        const checkboxes = document.querySelectorAll('.splitter-checkbox input');
        checkboxes.forEach(cb => {
            cb.checked = expense.expense_splitters.some(s => s.user_id === cb.value);
        });
    } else {
        document.getElementById('modal-title').textContent = '💸 登記支出';
        document.getElementById('expense-id').value = '';
        const checkboxes = document.querySelectorAll('.splitter-checkbox input');
        checkboxes.forEach(cb => cb.checked = true); // 預設全選
    }
}

export function closeExpenseModal() {
    const modal = document.getElementById('expense-modal');
    modal.classList.add('hidden');
}

export function getExpenseFormData() {
    const payers = [];
    document.querySelectorAll('.payer-input-row').forEach(row => {
        const amount = parseFloat(row.querySelector('.payer-amount-input').value) || 0;
        payers.push({ user_id: row.dataset.userId, amount });
    });

    const splitters = [];
    document.querySelectorAll('.splitter-checkbox input:checked').forEach(cb => {
        splitters.push(cb.value);
    });

    return {
        id: document.getElementById('expense-id').value,
        item_name: document.getElementById('item-name').value,
        amount: parseFloat(document.getElementById('amount').value),
        currency: document.getElementById('currency').value,
        remarks: document.getElementById('remarks').value,
        payers,
        splitters
    };
}
