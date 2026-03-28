// 1. 初始化 Supabase
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 全域狀態
let currentUser = null;
let currentVotes = [];
let allAccommodations = [];

// 2. 啟動腳本
document.addEventListener('DOMContentLoaded', async () => {
    if (!supabase) {
        console.error('Supabase library not loaded.');
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const userName = params.get('u');
    const userKey = params.get('k');

    if (userName && userKey) {
        await handleLogin(userName, userKey);
        setupTabs();
    } else {
        showAuthError('請使用你的專屬連結進入網站。');
    }
});

// 2.5 設置分頁切換
function setupTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-tab');
            
            // UI 切換
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // 內容切換
            document.getElementById('voting-content').classList.add('hidden');
            document.getElementById('stats-content').classList.add('hidden');
            document.getElementById(target).classList.remove('hidden');

            if (target === 'stats-content') {
                refreshData(); // 切換到戰況分頁時刷新數據
            }
        });
    });
}

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

// 4. 刷新資料 (住宿與選票)
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
    const { data: allUsers } = await supabase.from('users').select('*');

    renderList();
    renderUserVotes();
    renderStats(allVotes || []);
    renderUserProgress(allUsers || [], allVotes || []);
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

function showAuthError(msg) {
    document.getElementById('auth-error').classList.remove('hidden');
    document.querySelector('#auth-error p').textContent = msg;
}
