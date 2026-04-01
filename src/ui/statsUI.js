// src/ui/statsUI.js

export function renderStats(allVotes, accommodations) {
    const statsContainer = document.getElementById('stats-summary');
    if (!statsContainer) return;

    const counts = {};
    allVotes.forEach(v => {
        counts[v.accommodation_id] = (counts[v.accommodation_id] || 0) + 1;
    });

    const sorted = accommodations
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

    const rankingsContainer = document.getElementById('hotel-rankings');
    if (!rankingsContainer) return;

    const totalVoters = 8; 

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

export function renderUserProgress(users, votes) {
    const progressContainer = document.getElementById('user-progress-list');
    if (!progressContainer) return;

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
