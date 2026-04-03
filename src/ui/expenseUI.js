// src/ui/expenseUI.js
import { calculateSettlements, getPersonalSummaries, calculateUnifiedSettlement } from '../utils/settlement';

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

export function renderExchangeRateSettings(rates, onUpdateRate) {
    const containers = document.querySelectorAll('.header-rate-info');
    if (containers.length === 0 || !rates) return;

    // 生成簡易摘要：1 TWD = THB XX, USD XX...
    const rateSummaries = Object.keys(rates)
        .filter(curr => curr !== 'TWD')
        .map(curr => `${curr} ${rates[curr]}`)
        .join(', ');

    const rateHtml = `
        <div class="inline-rate-display">
            <span class="rate-text">💱 1 TWD = <strong>${rateSummaries || '尚未設定'}</strong></span>
            <button class="btn-text-edit" id="btn-open-rate-mgmt">⚙️ 管理</button>
        </div>
    `;

    containers.forEach(container => {
        container.innerHTML = rateHtml;
        const btn = container.querySelector('#btn-open-rate-mgmt');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.openRateModal(rates, onUpdateRate);
        });
    });
}

// 匯率管理 Modal 邏輯
let currentRatesForMgmt = null;
let currentUpdateCallback = null;

window.openRateModal = (rates, onUpdate) => {
    const modal = document.getElementById('rate-modal');
    modal.classList.remove('hidden');
    currentRatesForMgmt = { ...rates }; // 複製一份
    currentUpdateCallback = onUpdate;
    renderRateManagementList();
};

window.closeRateModal = () => {
    document.getElementById('rate-modal').classList.add('hidden');
};

function renderRateManagementList() {
    const listContainer = document.getElementById('rate-management-list');
    if (!listContainer) return;

    // 列出除了 TWD 以外的所有幣別
    const codes = Object.keys(currentRatesForMgmt).filter(c => c !== 'TWD');

    if (codes.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">尚未新增任何匯率資料</div>';
    } else {
        listContainer.innerHTML = codes.map(code => `
            <div class="rate-mgmt-row">
                <span class="code-label">1 TWD = </span>
                <input type="number" step="0.001" value="${currentRatesForMgmt[code]}" 
                    onchange="window.updateLocalRate('${code}', this.value)">
                <span class="code-suffix">${code}</span>
                <button class="btn-remove-rate" onclick="window.removeCurrency('${code}')">🗑️</button>
            </div>
        `).join('');
    }
}

// 註冊全域方法以供 Modal 調用
window.updateLocalRate = (code, val) => {
    currentRatesForMgmt[code] = parseFloat(val);
    currentUpdateCallback(currentRatesForMgmt);
};

window.addNewCurrency = async () => {
    const codeInp = document.getElementById('new-curr-code');
    const rateInp = document.getElementById('new-curr-rate');
    const code = codeInp.value.trim().toUpperCase();
    const rate = parseFloat(rateInp.value);

    if (!code || isNaN(rate) || rate <= 0) {
        alert('請輸入正確的幣別代碼與匯率');
        return;
    }

    currentRatesForMgmt[code] = rate;
    await currentUpdateCallback(currentRatesForMgmt);

    // 清空並重新渲染
    codeInp.value = '';
    rateInp.value = '';
    renderRateManagementList();
};

window.removeCurrency = async (code) => {
    if (confirm(`確定要移除 ${code} 嗎？此動作將導致相關支出無法換算。`)) {
        delete currentRatesForMgmt[code];
        await currentUpdateCallback(currentRatesForMgmt);
        renderRateManagementList();
    }
};

export function renderBaseCurrencySelectors(rates, activeBase) {
    const selectors = document.querySelectorAll('.base-currency-select');
    if (!selectors.length || !rates) return;

    const currencies = Object.keys(rates);
    const options = currencies.map(curr => `
        <option value="${curr}" ${curr === activeBase ? 'selected' : ''}>以 ${curr} 結算</option>
    `).join('');

    selectors.forEach(s => {
        s.innerHTML = `
            <optgroup label="🌐 變更結算基準">
                ${options}
            </optgroup>
        `;
    });
}

export function renderSettlementSummary(expenses, users, rates, baseCurrency = 'TWD') {
    const summaryContainer = document.getElementById('expense-summary');
    if (!summaryContainer) return;

    const settlements = calculateSettlements(expenses, users);
    const unifiedSettlements = rates ? calculateUnifiedSettlement(expenses, users, rates, baseCurrency) : [];

    const renderCurrencyBlock = (curr, list) => {
        if (list.length === 0) return `<div class="settle-empty">暫無 ${curr} 欠款</div>`;

        return list.map(s => `
            <div class="settle-row">
                <span class="settle-name debtor">${s.from}</span>
                <span class="settle-arrow">➡️ 支付給 ➡️</span>
                <span class="settle-name creditor">${s.to}</span>
                <span class="settle-amount">${formatCurrency(s.amount, curr)}</span>
            </div>
        `).join('');
    };

    // 生成所有原始幣別的區塊
    const originalCurrencies = Object.keys(settlements);
    const originalBlocks = originalCurrencies.map(curr => `
        <div class="settlement-column">
            <h4>${curr} 原始明細</h4>
            ${renderCurrencyBlock(curr, settlements[curr])}
        </div>
    `).join('');

    summaryContainer.innerHTML = `
        <div class="settlement-blocks">
            <div class="settlement-column unified-column">
                <div class="column-header">
                    <h4>💎 統一幣別結標 (${baseCurrency})</h4>
                    <span class="badge-premium">RECOMMENDED</span>
                </div>
                ${renderCurrencyBlock(baseCurrency, unifiedSettlements)}
                ${rates ? `<p class="settle-note">※ 已依當前匯率轉換為 ${baseCurrency}</p>` : ''}
            </div>
            <div class="settlement-column-group">
                ${originalBlocks}
            </div>
        </div>
    `;
}

export function renderPersonalSettlement(expenses, users, currentUserId, rates, baseCurrency = 'TWD') {
    const container = document.getElementById('personal-settlement');
    if (!container) return;

    const currentUser = users.find(u => u.id === currentUserId);
    const userName = currentUser ? currentUser.name : '';
    const summary = getPersonalSummaries(expenses, currentUserId, rates, baseCurrency);
    const settlements = calculateSettlements(expenses, users);
    const unifiedSettlements = rates ? calculateUnifiedSettlement(expenses, users, rates, baseCurrency) : [];

    // 篩選與當前使用者相關的轉帳路徑 (原始)
    const mySettleActions = [];
    Object.keys(settlements).forEach(currency => {
        const curSettles = settlements[currency] || [];
        curSettles.forEach(s => {
            if (s.from === userName || s.to === userName) {
                mySettleActions.push({ ...s, currency });
            }
        });
    });

    // 篩選統一幣別轉帳路徑
    const myUnifiedActions = unifiedSettlements.filter(s => s.from === userName || s.to === userName);

    const renderPill = (amount, curr, labelPfx = '') => {
        const classes = amount >= 0 ? 'status-check' : 'status-waiting';
        const prefix = amount >= 0 ? '應收回' : '應支付';
        const displayCurr = curr === 'Unified' ? baseCurrency : curr;
        return `
            <div class="personal-pill ${classes} ${curr === 'Unified' ? 'premium' : ''}">
                <span class="pill-label">${labelPfx || curr} 平衡：</span>
                <span class="pill-value">${prefix} ${formatCurrency(Math.abs(amount), displayCurr)}</span>
            </div>
        `;
    };

    const renderActionList = (actions, title, isUnified = false) => {
        if (actions.length === 0) return `<div class="empty-state" style="opacity: 0.5;">目前${title}已平衡！✨</div>`;

        return `
            <div class="personal-actions-list ${isUnified ? 'unified-list' : ''}">
                <h4 class="list-title">${title}</h4>
                <div class="settle-items">
                    ${actions.map(s => {
            const isPayOut = s.from === userName;
            const curr = s.currency || baseCurrency;
            return `
                            <div class="settle-row ${isPayOut ? 'payout' : 'collect'}">
                                <div class="settle-main">
                                    <span class="settle-status-text">
                                        ${isPayOut ? `<span class="icon-payout">💸</span> 需支付給 <strong>${s.to}</strong>` : `<span class="icon-collect">💰</span> <strong>${s.from}</strong> 需支付給我`}
                                    </span>
                                    <span class="settle-amount">
                                        ${formatCurrency(s.amount, curr)}
                                    </span>
                                </div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    };

    // 生成所有原始幣別的 Pill
    const originalPills = Object.keys(summary)
        .filter(k => k !== 'Unified')
        .map(k => renderPill(summary[k], k))
        .join('');

    container.innerHTML = `
        <div class="personal-summary-grid">
            ${renderPill(summary.Unified, 'Unified', `💎 統一 ${baseCurrency}`)}
            ${originalPills}
        </div>
        
        <div class="settlement-action-comparison">
            <div class="comparison-column">
                ${renderActionList(myUnifiedActions, `📋 建議統一結算 (${baseCurrency})`, true)}
            </div>
            <div class="comparison-column">
                ${renderActionList(mySettleActions, '⌛ 原始幣別明細')}
            </div>
        </div>

        <p class="settle-tip premium-tip">
            💡 <strong>建議使用「統一結算」</strong>，一人只需經手一次轉帳即可清空所有債務（含泰銖與台幣）。<br>
            數值為正代表你有代墊，最後應收回；負數代表你應支付給他人。
        </p>
    `;
}

export function renderCurrencyDropdown(rates) {
    const select = document.getElementById('currency');
    if (!select || !rates) return;

    // 獲取所有具備匯率的幣別
    // 例如 { TWD: 1, THB: 0.95 }
    const currencies = Object.keys(rates);

    // 定義顯示名稱對應表
    const nameMap = {
        'TWD': '🇹🇼 TWD 台幣',
        'THB': '🇹🇭 THB 泰銖',
        'USD': '🇺🇸 USD 美金',
        'JPY': '🇯🇵 JPY 日幣'
    };

    select.innerHTML = currencies.map(curr => `
        <option value="${curr}">${nameMap[curr] || curr}</option>
    `).join('');
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
