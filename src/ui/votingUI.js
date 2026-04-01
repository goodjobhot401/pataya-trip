// src/ui/votingUI.js

export function renderAccommodations(accommodations, userVotes, onVoteClick) {
    const airbnbContainer = document.getElementById('airbnb-list');
    const resortContainer = document.getElementById('resort-list');

    if (!airbnbContainer || !resortContainer) return;

    airbnbContainer.innerHTML = '';
    resortContainer.innerHTML = '';

    accommodations.forEach(acc => {
        const isVoted = userVotes.some(v => v.accommodation_id === acc.id);
        const card = createCard(acc, isVoted, onVoteClick);

        if (acc.type === 'airbnb') {
            airbnbContainer.appendChild(card);
        } else {
            resortContainer.appendChild(card);
        }
    });
}

function createCard(acc, isVoted, onVoteClick) {
    const card = document.createElement('div');
    card.className = `card ${isVoted ? 'voted' : ''}`;

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
                <button class="btn btn-vote ${isVoted ? 'active' : ''}">
                    ${isVoted ? '✅ 刪除此票' : '👍 投這一票'}
                </button>
            </div>
        </div>
    `;

    const voteBtn = card.querySelector('.btn-vote');
    voteBtn.addEventListener('click', () => onVoteClick(acc.id, isVoted));

    return card;
}

export function updateVoteDots(voteCount) {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.className = index < voteCount ? 'dot active' : 'dot';
    });
}
