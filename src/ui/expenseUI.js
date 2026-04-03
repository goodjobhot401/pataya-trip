import { calculateSettlements, calculateUnifiedSettlement, getPersonalSummaries } from '../utils/settlement';

export function renderExpenseList(expenses, currentUserId, onEdit, onDelete) {
    const listContainer = document.getElementById('expense-list');
    if (!listContainer || expenses.length === 0) {
        listContainer.innerHTML = '<div class="loading-placeholder">無資料</div>';
        return;
    }

    listContainer.innerHTML = expenses.map(exp => {
        const totalAmount = exp.expense_payers.reduce((sum, p) => sum + parseFloat(p.amount), 0);
        const payersText = exp.expense_payers
            .map(p => `${p.users.name} (${formatCurrency(p.amount, exp.currency)})`)
            .join(', ');

        const splittersText = exp.expense_splitters
            .map(s => s.users.name)
            .join(', ');

        return `
            <div class="expense-card card">
                <div class="expense-info">
                    <div class="expense-main">
                        <span class="expense-amount">${formatCurrency(totalAmount, exp.currency)}</span>
                        <h3 class="expense-item-name">${exp.item_name}</h3>
                    </div>
                    <div class="expense-details">
                        <div class="detail-row">
                            <span class="label">支付者:</span>
                            <span class="value">${payersText}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">分帳者:</span>
                            <span class="value">${splittersText}</span>
                        </div>
                        ${exp.remarks ? `<div class="detail-row remarks"><span class="value">💬 ${exp.remarks}</span></div>` : ''}
                    </div>
                </div>
                <div class="expense-actions">
                    <button class="btn-icon-only" onclick="window.handleEditExpense('${exp.id}')" title="編輯">✏️</button>
                    <button class="btn-icon-only btn-danger" onclick="window.handleDeleteExpense('${exp.id}')" title="刪除">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

export function renderExchangeRateSettings(rates, onUpdateRate) {
    const containers = document.querySelectorAll('.header-rate-info');
    if (containers.length === 0 || !rates) return;

    const rateHtml = `
        <div class="inline-rate-display">
            <button class="btn-rate-mgmt" id="btn-open-rate-mgmt">⚙️ 匯率管理</button>
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
    currentRatesForMgmt = { ...rates };
    currentUpdateCallback = onUpdate;
    renderRateManagementList();
};

window.closeRateModal = () => {
    document.getElementById('rate-modal').classList.add('hidden');
};

function renderRateManagementList() {
    const listContainer = document.getElementById('rate-management-list');
    if (!listContainer) return;

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

export function renderBaseCurrencySelectors(rates, activeBase, expenses = []) {
    const selectors = document.querySelectorAll('.base-currency-select');
    if (!selectors.length || !rates) return;

    // 檢查資料完整性 (防呆)
    const usedCurrencies = [...new Set(expenses.map(e => e.currency))];
    const rateCodes = Object.keys(rates);
    const missingCodes = usedCurrencies.filter(c => !rateCodes.includes(c));
    const isDataComplete = missingCodes.length === 0;

    const options = rateCodes.map(curr => {
        const isSelected = curr === activeBase;
        // 如果目前這筆計算基礎是基於有缺漏的匯率，標上警告
        const labelPfx = !isDataComplete ? '⚠️ 資料不全 - ' : '';
        return `<option value="${curr}" ${isSelected ? 'selected' : ''}>${labelPfx}以 ${curr} 結算</option>`;
    }).join('');

    selectors.forEach(s => {
        s.innerHTML = `
            <optgroup label="${isDataComplete ? '🌐 變更結算基準' : '🚨 注意：匯率資料不全'}">
                ${options}
            </optgroup>
        `;
        // 如果資料不全，給點樣式提示
        s.style.borderColor = isDataComplete ? '' : '#ff4d4f';
    });
}

/**
 * 核心防呆：渲染全域警告 (如果明細中有沒填匯率的幣別)
 */
export function renderValidationWarning(expenses, rates) {
    const container = document.getElementById('data-validation-error');
    if (!container) return;

    const usedCurrencies = [...new Set(expenses.map(e => e.currency))];
    const rateCodes = rates ? Object.keys(rates) : [];
    const missingCodes = usedCurrencies.filter(c => !rateCodes.includes(c));

    if (missingCodes.length > 0) {
        container.innerHTML = `
            <div class="validation-alert-bar">
                <div class="alert-content">
                    <span class="alert-icon">🚫</span>
                    <div class="alert-text">
                        <strong>結算數據可能不正確！</strong>
                        <p>明細中使用了 <strong>${missingCodes.join(', ')}</strong>，但目前尚未設定該幣別對 TWD 的換算匯率。</p>
                    </div>
                </div>
                <button class="btn-alert-action" onclick="window.openRateModal()">立即補齊匯率</button>
            </div>
        `;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

export function renderSettlementSummary(expenses, users, rates, baseCurrency = 'TWD') {
    const summaryContainer = document.getElementById('expense-summary');
    if (!summaryContainer) return;

    const unifiedSettlements = rates ? calculateUnifiedSettlement(expenses, users, rates, baseCurrency) : [];

    const renderCurrencyBlock = (curr, list) => {
        if (list.length === 0) return `<div class="settle-empty" style="padding: 40px;">目前結算已平衡！✨</div>`;
        
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
        <div class="settlement-blocks single-view">
            <div class="settlement-column unified-column full-width">
                <div class="column-header">
                    <h4>💎 結算建議總覽 (${baseCurrency})</h4>
                    <span class="badge-premium">UNIFIED</span>
                </div>
                ${renderCurrencyBlock(baseCurrency, unifiedSettlements)}
                ${rates ? `<p class="settle-note">※ 系統已依匯率自動換算為您選擇的結算幣別 (${baseCurrency}) 進行最簡轉帳計算</p>` : ''}
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
    const unifiedSettlements = rates ? calculateUnifiedSettlement(expenses, users, rates, baseCurrency) : [];

    const myUnifiedActions = unifiedSettlements.filter(s => s.from === userName || s.to === userName);

    const renderPill = (amount, curr, labelPfx = '') => {
        const classes = amount >= 0 ? 'status-check' : 'status-waiting';
        const prefix = amount >= 0 ? '目前結餘 (應收回)' : '目前結餘 (應支付)';
        const displayCurr = curr === 'Unified' ? baseCurrency : curr;
        return `
            <div class="personal-pill ${classes} premium standalone">
                <span class="pill-label">${labelPfx || curr}：</span>
                <span class="pill-value">${prefix} ${formatCurrency(Math.abs(amount), displayCurr)}</span>
            </div>
        `;
    };

    const renderActionList = (actions, title) => {
        if (actions.length === 0) return `<div class="empty-state" style="padding: 40px;">目前此結算區間已平衡！✨</div>`;
        
        return `
            <div class="personal-actions-list unified-list full-width">
                <h4 class="list-title">${title}</h4>
                <div class="settle-items">
                    ${actions.map(s => {
                        const isPayOut = s.from === userName;
                        return `
                            <div class="settle-row ${isPayOut ? 'payout' : 'collect'}">
                                <div class="settle-main">
                                    <span class="settle-status-text">
                                        ${isPayOut ? `<span class="icon-payout">💸</span> 需支付給 <strong>${s.to}</strong>` : `<span class="icon-collect">💰</span> <strong>${s.from}</strong> 需支付給我`}
                                    </span>
                                    <span class="settle-amount">
                                        ${formatCurrency(s.amount, baseCurrency)}
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    };

    container.innerHTML = `
        <div class="personal-summary-grid single-row">
            ${renderPill(summary.Unified, 'Unified', `💎 統一結算平衡 (${baseCurrency})`)}
        </div>
        
        <div class="settlement-action-comparison single-view">
            <div class="comparison-column full-width">
                ${renderActionList(myUnifiedActions, `📋 建議轉帳明細 (${baseCurrency})`)}
            </div>
        </div>

        <p class="settle-tip premium-tip">
            💡 系統已依照最新匯率將所有支出合算。您只需依照上方明細進行一次性結清即可。<br>
            若需更改結算顯示幣別，請點選右上方的選單。
        </p>
    `;
}

export function openExpenseModal(expense = null, users = []) {
    const modal = document.getElementById('expense-modal');
    const form = document.getElementById('expense-form');
    const title = document.getElementById('modal-title');
    
    modal.classList.remove('hidden');
    form.reset();

    if (expense) {
        title.innerText = '✏️ 編輯支出';
        document.getElementById('expense-id').value = expense.id;
        document.getElementById('item-name').value = expense.item_name;
        document.getElementById('amount').value = expense.amount;
        document.getElementById('currency').value = expense.currency;
        document.getElementById('remarks').value = expense.remarks || '';
    } else {
        title.innerText = '💸 登記支出';
        document.getElementById('expense-id').value = '';
    }

    renderPayersAndSplitters(users, expense);
}

export function closeExpenseModal() {
    document.getElementById('expense-modal').classList.add('hidden');
}

export function getExpenseFormData() {
    const id = document.getElementById('expense-id').value;
    const itemName = document.getElementById('item-name').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const remarks = document.getElementById('remarks').value;

    const payers = [];
    document.querySelectorAll('.payer-row').forEach(row => {
        const checkbox = row.querySelector('.payer-checkbox');
        const input = row.querySelector('.payer-amount');
        if (checkbox.checked) {
            payers.push({
                user_id: checkbox.value,
                amount: parseFloat(input.value) || 0
            });
        }
    });

    const splitters = [];
    document.querySelectorAll('.splitter-checkbox:checked').forEach(cb => {
        splitters.push({ user_id: cb.value });
    });

    return { id, itemName, amount, currency, remarks, payers, splitters };
}

function renderPayersAndSplitters(users, expense = null) {
    const payersContainer = document.getElementById('payers-container');
    const splittersContainer = document.getElementById('splitters-container');

    payersContainer.innerHTML = users.map(user => {
        const pData = expense?.expense_payers.find(p => p.user_id === user.id);
        return `
            <div class="payer-row">
                <label class="checkbox-label">
                    <input type="checkbox" class="payer-checkbox" value="${user.id}" ${pData ? 'checked' : ''}>
                    ${user.name}
                </label>
                <input type="number" class="payer-amount" placeholder="金額" step="0.01" value="${pData ? pData.amount : ''}" ${pData ? '' : 'disabled'}>
            </div>
        `;
    }).join('');

    splittersContainer.innerHTML = users.map(user => {
        const isSplitter = expense ? expense.expense_splitters.some(s => s.user_id === user.id) : true;
        return `
            <label class="checkbox-label">
                <input type="checkbox" class="splitter-checkbox" value="${user.id}" ${isSplitter ? 'checked' : ''}>
                ${user.name}
            </label>
        `;
    }).join('');

    document.querySelectorAll('.payer-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const input = e.target.closest('.payer-row').querySelector('.payer-amount');
            input.disabled = !e.target.checked;
            if (e.target.checked && !input.value) {
                input.value = document.getElementById('amount').value || '';
            }
        });
    });
}

export function renderCurrencyDropdown(rates) {
    const select = document.getElementById('currency');
    if (!select || !rates) return;

    const currencies = Object.keys(rates);
    
    const nameMap = {
        'TWD': '🇹🇼 TWD 台幣',
        'THB': '🇹🇭 THB 泰銖',
        'USD': '🇺🇸 USD 美金',
        'JPY': '🇯🇵 JPY 日元'
    };

    const currentValue = select.value;

    select.innerHTML = currencies.map(curr => `
        <option value="${curr}">${nameMap[curr] || `🌐 ${curr}`}</option>
    `).join('');

    if (currencies.includes(currentValue)) {
        select.value = currentValue;
    } else if (currencies.includes('THB')) {
        select.value = 'THB';
    }
}

function formatCurrency(amount, currency) {
    const symbolMap = {
        'TWD': 'NT$',
        'THB': 'THB ',
        'USD': 'US$',
        'JPY': 'JP¥'
    };
    const symbol = symbolMap[currency] || (currency + ' ');
    return `${symbol}${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
