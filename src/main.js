// src/main.js
import { handleLogin, getAllUsers } from './services/auth';
import { fetchAccommodations, fetchUserVotes, fetchAllVotes, castVote, deleteVote } from './services/voting';
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from './services/expenses';
import { renderAccommodations, updateVoteDots } from './ui/votingUI';
import { renderStats, renderUserProgress } from './ui/statsUI';
import { renderExpenseList, renderSettlementSummary, renderPersonalSettlement, initExpenseModal, openExpenseModal, closeExpenseModal, getExpenseFormData } from './ui/expenseUI';

// 全域狀態
let currentUser = null;
let currentVotes = [];
let allAccommodations = [];
let allUsers = [];
let allExpenses = [];

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
    
    // 初始化支出 Modal (生成使用者勾選清單)
    initExpenseModal(allUsers);

    await refreshData();
}

// 3. 刷新資料 (全域)
async function refreshData() {
    if (!currentUser) return;

    // 獲取住宿與選票
    allAccommodations = await fetchAccommodations();
    currentVotes = await fetchUserVotes(currentUser.id);
    const allVotes = await fetchAllVotes();

    // 獲取支出
    allExpenses = await fetchExpenses();

    // 渲染各分頁
    renderVotingTab();
    renderStatsTab(allVotes);
    renderExpensesTab();
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
    renderExpenseList(allExpenses, currentUser.id, handleEditExpense, handleDeleteExpense);
    renderSettlementSummary(allExpenses, allUsers);
    renderPersonalSettlement(allExpenses, currentUser.id);
}

// 註冊全域 UI 函式 (供 HTML onclick 調用)
window.openExpenseModal = () => openExpenseModal();
window.closeExpenseModal = () => closeExpenseModal();

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
    if (expense) openExpenseModal(expense);
}

async function handleDeleteExpense(id) {
    if (confirm('確定要刪除這筆支出嗎？此動作無法復原。')) {
        try {
            await deleteExpense(id);
            await refreshData();
        } catch (err) {
            alert('刪除失敗：' + err.message);
        }
    }
}

// --- 通用 UI 邏輯 ---
function setupTabs() {
    window.switchTab = function(target, event) {
        if (event) event.preventDefault();
        
        const tabs = document.querySelectorAll('.nav-tab');
        const tabElement = event ? event.currentTarget : document.querySelector(`[data-tab="${target}"]`);
        
        tabs.forEach(t => t.classList.remove('active'));
        if (tabElement) tabElement.classList.add('active');

        ['voting-content', 'stats-content', 'expense-content'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        
        const targetEl = document.getElementById(target);
        if (targetEl) targetEl.classList.remove('hidden');

        if (currentUser) refreshData();
    };
}

function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    if (el) {
        el.classList.remove('hidden');
        el.querySelector('p').textContent = msg;
    }
}
