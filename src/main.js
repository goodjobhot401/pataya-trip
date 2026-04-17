// src/main.js
import { handleLogin, getAllUsers } from './services/auth';
import { fetchAccommodations, fetchUserVotes, fetchAllVotes, castVote, deleteVote } from './services/voting';
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from './services/expenses';
import { fetchTripSettings, updateExchangeRates } from './services/settings';
import { fetchRecommendations, createRecommendation, deleteRecommendation, crawlUrl } from './services/recommendationService';
import { renderAccommodations, updateVoteDots } from './ui/votingUI';
import { renderStats, renderUserProgress } from './ui/statsUI';
import {
    renderRecommendationList,
    openRecommendationModal,
    closeRecommendationModal,
    updateImagePreviews,
    getRecommendationFormData
} from './ui/recommendationUI';
import {
    renderExpenseList,
// ... existing imports ...
    renderSettlementSummary,
    renderPersonalSettlement,
    openExpenseModal,
    closeExpenseModal,
    getExpenseFormData,
    renderExchangeRateSettings,
    renderCurrencyDropdown,
    renderBaseCurrencySelectors,
    renderValidationWarning
} from './ui/expenseUI';

// 全域狀態
let currentUser = null;
let currentVotes = [];
let allAccommodations = [];
let allUsers = [];
let allExpenses = [];
let allRecommendations = []; // 新增：收容推薦資料
let tripSettings = {};
let currentBaseCurrency = 'TWD'; // 當前結算基準幣別
let tempCrawledData = null; // 暫存爬取到的資料

// ... (setupApp and refreshData omitted for brevity if they don't change much, but I'll update renderExpensesTab)

// 1. 初始化
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const userName = params.get('u');
    const userKey = params.get('k');

    if (userName && userKey) {
        try {
            currentUser = await handleLogin(userName, userKey);
            setupApp();
        } catch (error) {
            showAuthError(error.message);
        }
    } else {
        showAuthError('請使用你的專屬連結進入網站。');
    }

    setupTabs();
});

// 2. 設置應用程式
async function setupApp() {
    document.getElementById('current-user-name').textContent = currentUser.name;
    document.getElementById('user-info').classList.remove('hidden');
    document.getElementById('voting-content').classList.remove('hidden');

    // 預先載入所有使用者 (表單與結算需使用)
    allUsers = await getAllUsers();

    await refreshData();
}

// 3. 刷新資料 (全域)
async function refreshData() {
    if (!currentUser) return;

    // 獲取住宿與選票
    allAccommodations = await fetchAccommodations();
    currentVotes = await fetchUserVotes(currentUser.id);
    const allVotes = await fetchAllVotes();

    // 獲取支出與設定
    allExpenses = await fetchExpenses();
    allRecommendations = await fetchRecommendations(); // 新增
    tripSettings = await fetchTripSettings();

    // 渲染各分頁
    renderVotingTab();
    renderStatsTab(allVotes);
    renderExpensesTab();
    renderRecommendationsTab(); // 新增
}

// --- 投票邏輯 ---
function renderVotingTab() {
    renderAccommodations(allAccommodations, currentVotes, handleVoteClick);
    updateVoteDots(currentVotes.length);
}

async function handleVoteClick(accommodationId, alreadyVoted) {
    try {
        if (alreadyVoted) {
            await deleteVote(currentUser.id, accommodationId);
        } else {
            if (currentVotes.length >= 2) {
                alert('🚫 每人最高上限投 2 票，請先取消現有投過後的再投！');
                return;
            }
            await castVote(currentUser.id, accommodationId);
        }
        await refreshData();
    } catch (err) {
        alert('操作失敗：' + err.message);
    }
}

// --- 戰況邏輯 ---
function renderStatsTab(allVotes) {
    renderStats(allVotes, allAccommodations);
    renderUserProgress(allUsers, allVotes);
}

// --- 支出邏輯 ---
function renderExpensesTab() {
    const rates = tripSettings.exchange_rates;

    // 預先進行資料驗證防呆
    renderValidationWarning(allExpenses, rates);
    renderBaseCurrencySelectors(rates, currentBaseCurrency, allExpenses);

    renderExpenseList(allExpenses, currentUser.id, handleEditExpense, handleDeleteExpense);
    renderExchangeRateSettings(rates, handleUpdateExchangeRate);
    renderCurrencyDropdown(rates);

    renderSettlementSummary(allExpenses, allUsers, rates, currentBaseCurrency);
    renderPersonalSettlement(allExpenses, allUsers, currentUser.id, rates, currentBaseCurrency);
}

// 供 UI 切換結算基準
window.handleBaseCurrencyChange = (newBase) => {
    currentBaseCurrency = newBase;
    renderExpensesTab();
};

async function handleUpdateExchangeRate(newRates) {
    try {
        await updateExchangeRates(newRates, currentUser.id);
        await refreshData();
    } catch (err) {
        alert('匯率更新失敗：' + err.message);
    }
}

// --- 推薦邏輯 ---
function renderRecommendationsTab() {
    renderRecommendationList(allRecommendations, currentUser?.id, handleDeleteRecommendation, handleEditRecommendation);
}

// --- 全域工具：自定義確認彈窗 ---
window.showConfirm = function (options) {
    const { title, message, icon, onConfirm } = options;
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const iconEl = document.getElementById('confirm-icon');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    titleEl.textContent = title || '確認操作';
    msgEl.textContent = message || '';
    iconEl.textContent = icon || '⚠️';
    modal.classList.remove('hidden');

    // 清除舊的事件監聽（透過複製元素）
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.onclick = () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    };
    newCancelBtn.onclick = () => {
        modal.classList.add('hidden');
    };
};

async function handleDeleteRecommendation(id) {
    window.showConfirm({
        title: '確定要刪除嗎？',
        message: '此動作將同步刪除雲端圖片，且無法復原。',
        icon: '🗑️',
        onConfirm: async () => {
            try {
                const rec = (allRecommendations || []).find(r => r.id === id);
                if (!rec) return;
                await deleteRecommendation(rec);
                await refreshData();
            } catch (err) {
                alert('刪除失敗：' + err.message);
            }
        }
    });
}

// 註冊全域 UI 函式 (供 HTML onclick 調用)
window.openExpenseModal = () => openExpenseModal(null, allUsers);
window.closeExpenseModal = () => closeExpenseModal();
window.handleEditExpense = (id) => handleEditExpense(id);
window.handleDeleteExpense = (id) => handleDeleteExpense(id);
window.handleEditRecommendation = (id) => handleEditRecommendation(id);

window.openRecommendationModal = () => openRecommendationModal();
window.closeRecommendationModal = () => closeRecommendationModal();

// 處理爬取按鈕
document.getElementById('btn-crawl')?.addEventListener('click', async () => {
    const url = document.getElementById('rec-url').value;
    if (!url) {
        alert('請先輸入網址');
        return;
    }

    const btn = document.getElementById('btn-crawl');
    const originalText = btn.textContent;
    btn.textContent = '爬取中...';
    btn.disabled = true;

    try {
        tempCrawledData = await crawlUrl(url);
        
        // 自動填入名稱
        if (tempCrawledData.title) {
            const nameEl = document.getElementById('rec-name');
            if (nameEl) nameEl.value = tempCrawledData.title;
        }
        
        // 預覽圖片，並提供刪除回呼
        const renderPreviews = () => {
            updateImagePreviews(tempCrawledData.image_urls, (index) => {
                window.showConfirm({
                    title: '移除圖片？',
                    message: '你確定不要這張圖片嗎？',
                    icon: '🖼️',
                    onConfirm: () => {
                        tempCrawledData.image_urls.splice(index, 1);
                        renderPreviews();
                    }
                });
            });
        };
        renderPreviews();
    } catch (err) {
        alert('爬取失敗：' + err.message + '\n請手動輸入資訊。');
        updateImagePreviews([]);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
});

async function handleEditRecommendation(recommendation) {
    // 進入編輯模式，將現有資料存入暫存，供預覽使用
    tempCrawledData = {
        title: recommendation.name,
        image_urls: [...recommendation.image_urls] // 深拷貝
    };
    
    // 開啟 Modal 並填入資料
    openRecommendationModal(recommendation);
    
    // 渲染現有圖片的預覽圖與刪除功能
    const renderPreviews = () => {
        updateImagePreviews(tempCrawledData.image_urls, (index) => {
            window.showConfirm({
                title: '移除圖片？',
                message: '你確定不要這張圖片嗎？',
                icon: '🖼️',
                onConfirm: () => {
                    tempCrawledData.image_urls.splice(index, 1);
                    renderPreviews();
                }
            });
        });
    };
    renderPreviews();
}

// 處理推薦表單提交
document.getElementById('recommendation-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = getRecommendationFormData();
    
    // 如果有爬取到的圖片，使用它們；否則使用空陣列
    const finalData = {
        url: formData.url,
        name: formData.name,
        location: formData.location,
        description: formData.description,
        image_urls: tempCrawledData ? tempCrawledData.image_urls : [],
        created_by: currentUser.id
    };

    try {
        if (formData.id) {
            // 編輯模式
            delete finalData.created_by; // 編輯時不更改建立者
            await updateRecommendation(formData.id, finalData);
        } else {
            // 新增模式
            await createRecommendation(finalData);
        }
        
        closeRecommendationModal();
        tempCrawledData = null;
        await refreshData();
    } catch (err) {
        alert('儲存失敗：' + err.message);
    }
});

// 處理支出表單提交
document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = getExpenseFormData();

    // 檢查總金額是否與分款金額相符 (簡單驗證)
    const totalPaid = data.payers.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(totalPaid - data.amount) > 0.1) {
        alert('❌ 支付者的總金額必須等於項目總金額！系統會自動幫你修正，或請檢查。');
    }

    try {
        if (data.id) {
            await updateExpense(data.id, data, data.payers, data.splitters);
        } else {
            await createExpense({ ...data, created_by: currentUser.id }, data.payers, data.splitters);
        }
        closeExpenseModal();
        await refreshData();
    } catch (err) {
        alert('儲存失敗：' + err.message);
    }
});

async function handleEditExpense(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (expense) openExpenseModal(expense, allUsers);
}

async function handleDeleteExpense(id) {
    window.showConfirm({
        title: '確定要刪除這筆支出？',
        message: '此動作無法復原。',
        icon: '💸',
        onConfirm: async () => {
            try {
                await deleteExpense(id);
                await refreshData();
            } catch (err) {
                alert('刪除失敗：' + err.message);
            }
        }
    });
}

// --- 通用 UI 邏輯 ---
function setupTabs() {
    window.switchTab = function (target, event) {
        if (event) event.preventDefault();

        const tabs = document.querySelectorAll('.nav-tab');
        const tabElement = event ? event.currentTarget : document.querySelector(`[data-tab="${target}"]`);

        tabs.forEach(t => t.classList.remove('active'));
        if (tabElement) tabElement.classList.add('active');

        ['voting-content', 'stats-content', 'expense-content', 'recommendation-content'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        const targetEl = document.getElementById(target);
        if (targetEl) targetEl.classList.remove('hidden');

        // --- 優化：如果是支出或推薦分頁，隱藏底部的投票統計 ---
        const globalStats = document.getElementById('global-stats');
        if (target === 'expense-content' || target === 'recommendation-content') {
            globalStats.classList.add('hidden');
        } else {
            globalStats.classList.remove('hidden');
        }

        if (currentUser) refreshData();
    };

    // --- 新增：子分頁切換邏輯 (支出分頁專用) ---
    window.switchSubTab = function (targetSectionId, event) {
        if (event) event.preventDefault();

        // 切換按鈕樣式
        const subTabs = document.querySelectorAll('.sub-tab');
        subTabs.forEach(t => t.classList.remove('active'));
        if (event) event.currentTarget.classList.add('active');

        // 切換內容顯示
        const subContents = document.querySelectorAll('.sub-content');
        subContents.forEach(c => c.classList.add('hidden'));
        document.getElementById(targetSectionId).classList.remove('hidden');
    };
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.classList.remove('hidden');
        el.querySelector('p').textContent = msg;
    }
}
