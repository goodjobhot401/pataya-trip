// 1. 初始化 Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 全域狀態
let currentUser = null;
let currentVotes = [];
let allAccommodations = [];
let allUsers = [];
let allExpenses = [];

// 2. 啟動腳本
document.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) {
        console.error('Supabase library not loaded.');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const userName = params.get('u');
    const userKey = params.get('k');

    // 啟動身分驗證
    if (userName && userKey) {
        await handleLogin(userName, userKey);
    } else {
        showAuthError('請使用你的專屬連結進入網站。');
    }
    
    // 初始化表單監聽
    setupExpenseForm();
});

// 2.5 設置分頁切換 (優化 LINE 與手機版相容性)
window.switchTab = function(target, event) {
    if (event) event.preventDefault();
    
    const tabs = document.querySelectorAll('.nav-tab');
    const tabElement = event ? event.currentTarget : document.querySelector(`[data-tab="${target}"]`);
    
    // 1. UI 切換 (立刻反應)
    tabs.forEach(t => t.classList.remove('active'));
    if (tabElement) tabElement.classList.add('active');

    document.getElementById('voting-content').classList.add('hidden');
    document.getElementById('stats-content').classList.add('hidden');
    document.getElementById('expense-content').classList.add('hidden');
    document.getElementById(target).classList.remove('hidden');

    // 2. 非同步拉取資料
    if ((target === 'stats-content' || target === 'expense-content') && currentUser) {
        setTimeout(() => refreshData(), 10);
    }
};

// ... 原有的 DOMContentLoaded 中移除 setupTabs ...

// 3. 處理登入/驗證身分
async function handleLogin(name, key) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('name', name)
        .eq('key', key)
        .single();

    if (error || !data) {
        showAuthError('無效的成員名稱或密鑰，請聯絡主辦人。');
        return;
    }

    currentUser = data;
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('voting-content').classList.remove('hidden');

    await refreshData();
}

// 4. 刷新資料 (住宿與選票、支出)
async function refreshData() {
    // 獲取住宿資訊
    const { data: accData } = await supabase.from('accommodations').select('*');
    allAccommodations = accData || [];

    // 獲取我的投票
    const { data: voteData } = await supabase
        .from('votes')
        .select('*')
        .eq('user_id', currentUser.id);
    currentVotes = voteData || [];

    // 獲取全局統計 (所有票數 + 所有使用者)
    const { data: allVotes } = await supabase
        .from('votes')
        .select('*, accommodations(name), users(name)');
    
    const { data: usersData } = await supabase.from('users').select('*');
    allUsers = usersData || [];

    // 獲取支出資訊 (包含支付者與分款者)
    const { data: expData } = await supabase
        .from('expenses')
        .select('*, expense_payers(*), expense_splitters(*)')
        .order('created_at', { ascending: false });
    allExpenses = expData || [];

    renderList();
    renderUserVotes();
    renderStats(allVotes || []);
    renderUserProgress(allUsers, allVotes || []);
    renderExpenses();
    renderSettlement();
}

// 5. 渲染列表
function renderList() {
    const airbnbContainer = document.getElementById('airbnb-list');
    const resortContainer = document.getElementById('resort-list');

    airbnbContainer.innerHTML = '';
    resortContainer.innerHTML = '';

    allAccommodations.forEach(acc => {
        const isVoted = currentVotes.some(v => v.accommodation_id === acc.id);
        const card = createCard(acc, isVoted);

        if (acc.type === 'airbnb') {
            airbnbContainer.appendChild(card);
        } else {
            resortContainer.appendChild(card);
        }
    });
}

function createCard(acc, isVoted) {
    const card = document.createElement('div');
    card.className = `card ${isVoted ? 'voted' : ''}`;

    // 生成特點標籤
    const featuresHtml = (acc.features || []).map(f => `<span class="feature-pill">${f}</span>`).join('');

    card.innerHTML = `
        <div class="card-img-wrapper">
            <img src="${acc.image_url}" class="card-img" alt="${acc.name}">
        </div>
        <div class="card-content">
            <div class="card-tag">${acc.type.toUpperCase()}</div>
            <h3 class="card-title">${acc.name}</h3>
            <div class="card-features">
                ${featuresHtml}
            </div>
            <div class="card-actions">
                <a href="${acc.link}" target="_blank" class="btn btn-link">
                    🔗 查看詳細
                </a>
                <button class="btn btn-vote ${isVoted ? 'active' : ''}" 
                    onclick="handleVoteClick('${acc.id}', ${isVoted})">
                    ${isVoted ? '✅ 刪除此票' : '👍 投這一票'}
                </button>
            </div>
        </div>
    `;
    return card;
}

// 6. 投票邏輯
window.handleVoteClick = async (accommodationId, alreadyVoted) => {
    if (alreadyVoted) {
        // 取消投票
        const { error } = await supabase
            .from('votes')
            .delete()
            .eq('user_id', currentUser.id)
            .eq('accommodation_id', accommodationId);

        if (error) alert('取消失敗');
    } else {
        // 新增投票
        if (currentVotes.length >= 2) {
            alert('🚫 每人最高上限投 2 票，請先取消現有投票後再投！');
            return;
        }

        const { error } = await supabase
            .from('votes')
            .insert([{
                user_id: currentUser.id,
                accommodation_id: accommodationId
            }]);

        if (error) alert('投票失敗');
    }

    await refreshData();
};

// 7. 更新用戶票數顯示 (點點)
function renderUserVotes() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.className = index < currentVotes.length ? 'dot active' : 'dot';
    });
}

// 8. 渲染統計 (目前各飯店得票)
function renderStats(allVotes) {
    const statsContainer = document.getElementById('stats-summary');
    const counts = {};

    allVotes.forEach(v => {
        counts[v.accommodation_id] = (counts[v.accommodation_id] || 0) + 1;
    });

    // 排序顯示前三名
    const sorted = allAccommodations
        .map(acc => ({ ...acc, count: counts[acc.id] || 0 }))
        .sort((a, b) => b.count - a.count);

    statsContainer.innerHTML = `
        <div class="stats-summary-grid">
            ${sorted.map(s => `
                <div class="stat-item">
                    <span class="stat-value">${s.count}</span>
                    <span class="stat-label">${s.name}</span>
                </div>
            `).join('')}
        </div>
    `;

    // 渲染排名分頁中的排行榜
    const rankingsContainer = document.getElementById('hotel-rankings');
    const totalVoters = 8; // 有 8 位成員
    const maxPossibleVotes = totalVoters * 2;

    rankingsContainer.innerHTML = sorted.map((s, index) => `
        <div class="rank-item">
            <div class="rank-number">#${index + 1}</div>
            <div class="rank-info">
                <div style="display:flex; justify-content:space-between">
                    <strong>${s.name}</strong>
                    <span>${s.count} 票</span>
                </div>
                <div class="rank-bar-bg">
                    <div class="rank-bar-fill" style="width: ${(s.count / totalVoters) * 100}%"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// 9. 渲染每位成員的投票進度
function renderUserProgress(users, votes) {
    const progressContainer = document.getElementById('user-progress-list');
    
    // 將選票按使用者分組
    const userVotesMap = {};
    users.forEach(u => userVotesMap[u.id] = []);
    votes.forEach(v => {
        if (userVotesMap[v.user_id]) {
            userVotesMap[v.user_id].push(v.accommodations.name);
        }
    });

    progressContainer.innerHTML = users.map(user => {
        const myVotes = userVotesMap[user.id];
        const count = myVotes.length;
        const isDone = count >= 2;

        return `
            <div class="user-progress-card">
                <div class="user-progress-name">
                    ${user.name}
                    <span class="status-pill ${isDone ? 'status-check' : 'status-waiting'}">
                        ${isDone ? '✅ 已完成' : `⏳ 已投 ${count}/2`}
                    </span>
                </div>
                ${myVotes.length > 0 
                  ? myVotes.map(vname => `<div class="user-vote-item">📍 ${vname}</div>`).join('') 
                  : `<div class="user-vote-item empty">尚未投票</div>`}
            </div>
        `;
    }).join('');
}

// --- 💰 代付支出專屬功能 ---

// 10. 初始化支出表單 (只執行一次)
function setupExpenseForm() {
    const form = document.getElementById('expense-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveExpense();
    });

    // 監聽金額變動，若只有一位支付者且金額為 0，則自動帶入總金額
    document.getElementById('amount').addEventListener('input', (e) => {
        const total = parseFloat(e.target.value) || 0;
        const payerInputs = document.querySelectorAll('.payer-amount-input');
        if (payerInputs.length === 1) {
            payerInputs[0].value = total;
        }
    });
}

// 11. 開啟支出 Modal (新增或編輯)
window.openExpenseModal = function(expenseId = null) {
    const modal = document.getElementById('expense-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('expense-form');
    
    form.reset();
    document.getElementById('expense-id').value = expenseId || '';
    
    // 生成支付者與分款者列表
    renderModalUsers(expenseId);
    
    if (expenseId) {
        title.textContent = '✏️ 編輯支出';
        const exp = allExpenses.find(e => e.id === expenseId);
        if (exp) {
            document.getElementById('item-name').value = exp.item_name;
            document.getElementById('amount').value = exp.amount;
            document.getElementById('currency').value = exp.currency;
            document.getElementById('remarks').value = exp.remarks || '';
            
            // 填寫支付者金額
            exp.expense_payers.forEach(p => {
                const input = document.querySelector(`.payer-amount-input[data-user-id="${p.user_id}"]`);
                if (input) input.value = p.amount;
            });
            
            // 勾選分款者
            exp.expense_splitters.forEach(s => {
                const checkbox = document.querySelector(`.splitter-checkbox[data-user-id="${s.user_id}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } else {
        title.textContent = '💸 登記支出';
        // 預設支付者為當前使用者
        const currentPayerInput = document.querySelector(`.payer-amount-input[data-user-id="${currentUser.id}"]`);
        if (currentPayerInput) currentPayerInput.value = '';
        
        // 預設分款者為全部人
        document.querySelectorAll('.splitter-checkbox').forEach(cb => cb.checked = true);
    }
    
    modal.classList.remove('hidden');
};

window.closeExpenseModal = function() {
    document.getElementById('expense-modal').classList.add('hidden');
};

function renderModalUsers(expenseId) {
    const payersContainer = document.getElementById('payers-container');
    const splittersContainer = document.getElementById('splitters-container');
    
    payersContainer.innerHTML = allUsers.map(u => `
        <div class="payer-row">
            <label>${u.name}</label>
            <input type="number" step="0.01" class="payer-amount-input" 
                data-user-id="${u.id}" placeholder="0.00">
        </div>
    `).join('');
    
    splittersContainer.innerHTML = allUsers.map(u => `
        <label class="splitter-item">
            <input type="checkbox" class="splitter-checkbox" data-user-id="${u.id}">
            <span>${u.name}</span>
        </label>
    `).join('');
}

// 12. 儲存支出 (Insert or Update)
async function saveExpense() {
    const id = document.getElementById('expense-id').value;
    const itemName = document.getElementById('item-name').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const remarks = document.getElementById('remarks').value;
    
    // 收集支付者
    const payers = [];
    let payersTotal = 0;
    document.querySelectorAll('.payer-amount-input').forEach(input => {
        const val = parseFloat(input.value) || 0;
        if (val > 0) {
            payers.push({ user_id: input.dataset.userId, amount: val });
            payersTotal += val;
        }
    });
    
    // 驗證支付總額
    if (Math.abs(payersTotal - amount) > 0.01) {
        alert(`❌ 支付者總額 (${payersTotal}) 必須等於總支出金額 (${amount})！`);
        return;
    }
    
    // 收集分款者
    const splitters = [];
    document.querySelectorAll('.splitter-checkbox:checked').forEach(cb => {
        splitters.push({ user_id: cb.dataset.userId });
    });
    
    if (splitters.length === 0) {
        alert('❌ 至少需要一位分款者！');
        return;
    }

    try {
        let expenseId = id;
        if (id) {
            // Update
            await supabase.from('expenses').update({
                item_name: itemName, amount, currency, remarks
            }).eq('id', id);
            
            // Re-sync payers and splitters (Delete then Insert is simplest)
            await supabase.from('expense_payers').delete().eq('expense_id', id);
            await supabase.from('expense_splitters').delete().eq('expense_id', id);
        } else {
            // Insert
            const { data, error } = await supabase.from('expenses').insert([{
                item_name: itemName, amount, currency, remarks, created_by: currentUser.id
            }]).select();
            if (error) throw error;
            expenseId = data[0].id;
        }
        
        // Insert payers and splitters
        const payersToInsert = payers.map(p => ({ ...p, expense_id: expenseId }));
        const splittersToInsert = splitters.map(s => ({ ...s, expense_id: expenseId }));
        
        await supabase.from('expense_payers').insert(payersToInsert);
        await supabase.from('expense_splitters').insert(splittersToInsert);
        
        closeExpenseModal();
        await refreshData();
    } catch (err) {
        console.error(err);
        alert('儲存失敗，請檢查網路。');
    }
}

// 13. 刪除支出
window.deleteExpense = async function(id) {
    if (!confirm('確定要刪除這筆支出嗎？')) return;
    await supabase.from('expenses').delete().eq('id', id);
    await refreshData();
};

// 14. 渲染支出明細
function renderExpenses() {
    const container = document.getElementById('expense-list');
    if (allExpenses.length === 0) {
        container.innerHTML = '<div class="empty-state">尚無任何支出記錄</div>';
        return;
    }
    
    container.innerHTML = allExpenses.map(exp => {
        const date = new Date(exp.created_at);
        const day = date.getDate();
        const month = date.getMonth() + 1;
        
        const payersNames = exp.expense_payers.map(p => {
            const u = allUsers.find(user => user.id === p.user_id);
            return u ? u.name : 'Unknown';
        }).join(', ');

        const splitCount = exp.expense_splitters.length;

        return `
            <div class="expense-item-card" onclick="window.openExpenseModal('${exp.id}')">
                <div class="expense-date">
                    <span class="month">${month}月</span>
                    <span class="day">${day}</span>
                </div>
                <div class="expense-info">
                    <h4>${exp.item_name}</h4>
                    <div class="payers-label">支付：${payersNames}</div>
                    <div class="splitters-label">分帳：${splitCount} 人平分</div>
                    ${exp.remarks ? `<div class="remarks-label"><small>${exp.remarks}</small></div>` : ''}
                </div>
                <div class="expense-amount-area">
                    <div class="expense-price">${exp.amount}</div>
                    <div class="expense-currency">${exp.currency}</div>
                    <button class="btn-link" style="color:#e74c3c; padding: 5px 0" 
                        onclick="event.stopPropagation(); window.deleteExpense('${exp.id}')">
                        🗑️ 刪除
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 15. 渲染結算總覽與個人帳務
function renderSettlement() {
    const summaryContainer = document.getElementById('expense-summary');
    const personalContainer = document.getElementById('personal-settlement');
    
    const debts = calculateSettlement(allExpenses, allUsers);
    
    // 1. 總覽渲染
    if (debts.length === 0) {
        summaryContainer.innerHTML = '<div class="empty-state">目前的帳目是平的！</div>';
    } else {
        summaryContainer.innerHTML = debts.map(d => `
            <div class="settlement-item">
                <span>
                    <span class="debtor">${d.from}</span> 
                    👉 給 
                    <span class="creditor">${d.to}</span>
                </span>
                <span class="amount-text">${d.amount} <small>${d.currency}</small></span>
            </div>
        `).join('');
    }
    
    // 2. 個人帳務渲染
    renderPersonalSettlement(debts, personalContainer);
}

function renderPersonalSettlement(debts, container) {
    const myDebtsFrom = debts.filter(d => d.from === currentUser.name);
    const myDebtsTo = debts.filter(d => d.to === currentUser.name);
    
    // 計算我的總額
    const totals = { TWD: 0, THB: 0 };
    myDebtsTo.forEach(d => totals[d.currency] += parseFloat(d.amount));
    myDebtsFrom.forEach(d => totals[d.currency] -= parseFloat(d.amount));

    let html = `
        <div class="personal-status">
            ${Object.entries(totals).map(([curr, amt]) => `
                <div>
                    <span class="status-amount ${amt > 0 ? 'positive' : (amt < 0 ? 'negative' : 'zero')}">
                        ${amt > 0 ? '+' : ''}${amt.toFixed(1)}
                    </span>
                    <span class="stat-label">${curr} 預計${amt >= 0 ? '拿回' : '支出'}</span>
                </div>
            `).join('')}
        </div>
    `;

    if (myDebtsFrom.length > 0) {
        html += '<div style="margin-top:20px; font-weight:700">👇 我該付出的</div>';
        html += myDebtsFrom.map(d => `
            <div class="settlement-item">
                <span>付給 <span class="creditor">${d.to}</span></span>
                <span class="amount-text">${d.amount} <small>${d.currency}</small></span>
            </div>
        `).join('');
    }

    if (myDebtsTo.length > 0) {
        html += '<div style="margin-top:20px; font-weight:700">👆 我該收回的</div>';
        html += myDebtsTo.map(d => `
            <div class="settlement-item">
                <span>收到來自 <span class="debtor">${d.from}</span></span>
                <span class="amount-text">${d.amount} <small>${d.currency}</small></span>
            </div>
        `).join('');
    }

    if (myDebtsFrom.length === 0 && myDebtsTo.length === 0) {
        html += '<div class="empty-state">你目前沒有待清算的帳務</div>';
    }

    container.innerHTML = html;
}

// 核心計算引擎
function calculateSettlement(expenses, users) {
    const balances = {}; // {userId: {TWD: balance, THB: balance}}
    users.forEach(u => balances[u.id] = { TWD: 0, THB: 0 });

    expenses.forEach(exp => {
        const currency = exp.currency;
        // 支付者：代墊了錢 (餘額增加)
        exp.expense_payers.forEach(p => {
            if (balances[p.user_id]) balances[p.user_id][currency] += parseFloat(p.amount);
        });
        // 分款者：欠了錢 (餘額減少)
        if (exp.expense_splitters.length > 0) {
            const splitAmount = parseFloat(exp.amount) / exp.expense_splitters.length;
            exp.expense_splitters.forEach(s => {
                if (balances[s.user_id]) balances[s.user_id][currency] -= splitAmount;
            });
        }
    });

    const debts = [];
    ['TWD', 'THB'].forEach(curr => {
        const creditors = []; // 餘額為正的人
        const debtors = []; // 餘額為負的人

        users.forEach(u => {
            const b = balances[u.id][curr];
            if (b > 0.01) creditors.push({ id: u.id, name: u.name, balance: b });
            else if (b < -0.01) debtors.push({ id: u.id, name: u.name, balance: -b });
        });

        // 貪婪演算法分配債務
        let cIdx = 0, dIdx = 0;
        const localCreditors = creditors.map(c => ({...c}));
        const localDebtors = debtors.map(d => ({...d}));

        while (cIdx < localCreditors.length && dIdx < localDebtors.length) {
            const c = localCreditors[cIdx];
            const d = localDebtors[dIdx];
            const settleAmount = Math.min(c.balance, d.balance);

            debts.push({ 
                from: d.name, 
                to: c.name, 
                amount: settleAmount.toFixed(1), 
                currency: curr 
            });

            c.balance -= settleAmount;
            d.balance -= settleAmount;

            if (c.balance < 0.01) cIdx++;
            if (d.balance < 0.01) dIdx++;
        }
    });
    return debts;
}

function showAuthError(msg) {
    document.getElementById('auth-error').classList.remove('hidden');
    document.querySelector('#auth-error p').textContent = msg;
}
