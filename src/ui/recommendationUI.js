// src/ui/recommendationUI.js

export function renderRecommendationList(recommendations, currentUserId, onDeleteClick) {
    const container = document.getElementById('recommendation-list');
    if (!container) return;

    if (recommendations.length === 0) {
        container.innerHTML = '<div class="loading-placeholder">目前還沒有推薦，快來分享！</div>';
        return;
    }

    container.innerHTML = '';
    recommendations.forEach(rec => {
        const card = createRecommendationCard(rec, currentUserId, onDeleteClick);
        container.appendChild(card);
    });
}

function createRecommendationCard(rec, currentUserId, onDeleteClick) {
    const card = document.createElement('div');
    card.className = 'card';

    const images = rec.image_urls || [];
    const hasMultipleImages = images.length > 1;

    let imageHtml = '';
    if (images.length === 0) {
        imageHtml = `<div class="card-img-wrapper"><div class="loading-placeholder">無圖片</div></div>`;
    } else if (hasMultipleImages) {
        // 建立 Carousel
        const dots = images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('');
        const tracks = images.map(url => `<img src="${url}" alt="${rec.name}">`).join('');
        
        imageHtml = `
            <div class="card-carousel">
                <div class="carousel-track" style="transform: translateX(0%);">
                    ${tracks}
                </div>
                <div class="carousel-nav">${dots}</div>
                <button class="btn-carousel-nav nav-prev">❮</button>
                <button class="btn-carousel-nav nav-next">❯</button>
            </div>
        `;
    } else {
        imageHtml = `
            <div class="card-img-wrapper">
                <img src="${images[0]}" class="card-img" alt="${rec.name}">
            </div>
        `;
    }

    const isCreator = rec.created_by === currentUserId;

    card.style.cursor = 'pointer'; // 讓使用者知道整張卡片可點擊
    card.innerHTML = `
        ${imageHtml}
        <div class="card-content">
            <h3 class="card-title">${rec.name}</h3>
            ${rec.location ? `<div class="card-location">📍 ${rec.location}</div>` : ''}
            ${rec.description ? `<p class="card-description">${rec.description}</p>` : ''}
            
            <div class="card-actions" style="justify-content: flex-end; border-top: none; padding-top: 0; margin-top: 15px;">
                ${isCreator ? `
                    <button class="btn btn-delete btn-icon-styled" data-id="${rec.id}">
                        🗑️ 刪除
                    </button>
                ` : ''}
            </div>

            <div class="recommendation-footer">
                <span>By ${rec.users?.name || '匿名'}</span>
                <span>${new Date(rec.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    `;

    // 綁定整張卡片的點擊事件 (開新分頁)
    card.addEventListener('click', (e) => {
        // 如果點擊的是刪除按鈕或輪播按鈕，則不執行開啟連結
        if (e.target.closest('.btn-delete') || e.target.closest('.btn-carousel-nav') || e.target.closest('.carousel-dot')) {
            return;
        }
        window.open(rec.url, '_blank');
    });

    // 綁定 Carousel 邏輯
    if (hasMultipleImages) {
        setupCarousel(card);
    }

    // 綁定刪除邏輯
    const deleteBtn = card.querySelector('.btn-delete');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止觸發卡片點擊
            onDeleteClick(rec.id);
        });
    }

    return card;
}

function setupCarousel(card) {
    const track = card.querySelector('.carousel-track');
    const dots = card.querySelectorAll('.carousel-dot');
    const prevBtn = card.querySelector('.nav-prev');
    const nextBtn = card.querySelector('.nav-next');
    const imgCount = dots.length;
    let currentIndex = 0;
    let autoPlayTimer = null;

    const updateCarousel = (index) => {
        currentIndex = (index + imgCount) % imgCount;
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentIndex);
        });
    };

    // 自動輪播邏輯
    const startAutoPlay = () => {
        if (autoPlayTimer) return;
        autoPlayTimer = setInterval(() => {
            updateCarousel(currentIndex + 1);
        }, 3500 + Math.random() * 1500); // 隨機錯開每張卡片的切換時間，讓視覺更自然且減輕瀏覽器瞬間負擔
    };

    const stopAutoPlay = () => {
        if (autoPlayTimer) {
            clearInterval(autoPlayTimer);
            autoPlayTimer = null;
        }
    };

    // 初始化自動輪播
    startAutoPlay();

    // 互動控制：滑鼠移入時暫停，移出時恢復
    card.addEventListener('mouseenter', stopAutoPlay);
    card.addEventListener('mouseleave', startAutoPlay);

    // 手動按鈕控制
    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopAutoPlay(); // 手動操作時先停止，避免剛切換完又被定時器切換
        updateCarousel(currentIndex - 1);
    });

    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        stopAutoPlay();
        updateCarousel(currentIndex + 1);
    });

    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            stopAutoPlay();
            updateCarousel(parseInt(dot.dataset.index));
        });
    });
}

// Modal 控制
export function openRecommendationModal() {
    document.getElementById('recommendation-modal').classList.remove('hidden');
    document.getElementById('recommendation-form').reset();
    document.getElementById('rec-preview-images').innerHTML = '<span style="color: #ccc;">尚未抓取圖片</span>';
}

export function closeRecommendationModal() {
    document.getElementById('recommendation-modal').classList.add('hidden');
}

export function updateImagePreviews(urls) {
    const container = document.getElementById('rec-preview-images');
    if (urls.length === 0) {
        container.innerHTML = '<span style="color: #ff6b6b;">無法抓取圖片，請手動輸入資訊</span>';
        return;
    }
    container.innerHTML = urls.map(url => `<img src="${url}" class="preview-img">`).join('');
}

export function getRecommendationFormData() {
    const form = document.getElementById('recommendation-form');
    return {
        url: form.querySelector('#rec-url').value,
        name: form.querySelector('#rec-name').value,
        location: form.querySelector('#rec-location').value,
        description: form.querySelector('#rec-description').value,
        // 圖片由外部傳入或從預覽狀態取得
    };
}
