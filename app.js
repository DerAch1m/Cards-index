/**
 * Index Card App Logic
 */

// --- STATE MANAGEMENT ---

const defaultState = {
    tabs: [
        { id: 'tab-1', name: 'General', createdAt: Date.now() }
    ],
    cards: [],
    activeTabId: 'tab-1'
};

let state = loadState() || defaultState;

function loadState() {
    const stored = localStorage.getItem('index-card-app-data');
    return stored ? JSON.parse(stored) : null;
}

function saveState() {
    localStorage.setItem('index-card-app-data', JSON.stringify(state));
}

// Ensure activeTabId is valid
if (!state.tabs.find(t => t.id === state.activeTabId)) {
    if (state.tabs.length > 0) {
        state.activeTabId = state.tabs[0].id;
    } else {
        // Should not happen if we prevent deleting last tab, but just in case
        const newTab = { id: 'tab-' + Date.now(), name: 'General', createdAt: Date.now() };
        state.tabs.push(newTab);
        state.activeTabId = newTab.id;
    }
    saveState();
}

// --- DOM ELEMENTS ---
const tabsContainer = document.getElementById('tabs-list');
const addTabBtn = document.getElementById('add-tab-btn');

// Dialogs
const manageTabDialog = document.getElementById('manage-tab-dialog');
const manageTabInput = document.getElementById('manage-tab-input');
const deleteTabBtn = document.getElementById('delete-tab-btn');

// Views
const viewFlashcard = document.getElementById('view-flashcard');
const viewAdd = document.getElementById('view-add');
const viewList = document.getElementById('view-list');

// Flashcard Elements
const currentCardEl = document.getElementById('current-card');
const frontText = document.getElementById('card-front-text');
const backText = document.getElementById('card-back-text');
const backContent = document.querySelector('.card-content.back');
const studyControls = document.getElementById('study-controls');

// Buttons
const navManage = document.getElementById('nav-manage');
const navAdd = document.getElementById('nav-add');
const navArchive = document.getElementById('nav-archive');

const btnCancelAdd = document.getElementById('btn-cancel-add');
const btnSaveCard = document.getElementById('btn-save-card');
const inputFront = document.getElementById('input-front');
const inputBack = document.getElementById('input-back');

const listTitle = document.getElementById('list-title');
const cardsListContainer = document.getElementById('cards-list');
const btnReturnList = document.getElementById('btn-return-list');

// Interaction State
let isCardRevealed = false;
let currentCard = null;
let currentListMode = 'manage'; // 'manage' or 'archive'
let editingTabId = null; // Track which tab is being managed

// --- INITIALIZATION ---

function init() {
    try {
        // Check if lucide is loaded
        if (window.lucide) {
            lucide.createIcons();
        }
        renderTabs();
        showFlashcardView();

        // Event Listeners
        if (addTabBtn) addTabBtn.addEventListener('click', handleAddTab);

        if (navAdd) navAdd.addEventListener('click', () => switchView('add'));
        if (navManage) navManage.addEventListener('click', () => openList('manage'));
        if (navArchive) navArchive.addEventListener('click', () => openList('archive'));

        if (btnCancelAdd) btnCancelAdd.addEventListener('click', () => switchView('flashcard'));
        if (btnSaveCard) btnSaveCard.addEventListener('click', handleSaveCard);

        if (btnReturnList) btnReturnList.addEventListener('click', () => switchView('flashcard'));

        // Export / Import
        const btnExport = document.getElementById('nav-export');
        const btnImport = document.getElementById('nav-import');
        const fileInput = document.getElementById('file-import');

        if (btnExport) btnExport.addEventListener('click', handleExport);
        if (btnImport) btnImport.addEventListener('click', handleImport);
        if (fileInput) fileInput.addEventListener('change', handleFileImport);

        if (currentCardEl) currentCardEl.addEventListener('click', handleCardTap);

        // Study Controls
        document.getElementById('btn-correct')?.addEventListener('click', (e) => { e.stopPropagation(); rateCard(true); });
        document.getElementById('btn-incorrect')?.addEventListener('click', (e) => { e.stopPropagation(); rateCard(false); });
        document.getElementById('btn-delete-quick')?.addEventListener('click', (e) => { e.stopPropagation(); deleteCurrentCard(); });
        document.getElementById('btn-archive-quick')?.addEventListener('click', (e) => { e.stopPropagation(); archiveCurrentCard(); });

        // Dialog listener
        if (manageTabDialog) {
            manageTabDialog.addEventListener('close', () => {
                if (manageTabDialog.returnValue === 'confirm') {
                    const newName = manageTabInput.value.trim();
                    if (newName && editingTabId) {
                        const tab = state.tabs.find(t => t.id === editingTabId);
                        if (tab) {
                            tab.name = newName;
                            saveState();
                            renderTabs();
                        }
                    }
                }
                editingTabId = null;
            });
        }

        if (deleteTabBtn) deleteTabBtn.addEventListener('click', handleDeleteTab);
    } catch (err) {
        console.error("Init failed:", err);
        alert("App failed to initialize: " + err.message);
    }
}

// --- TABS LOGIC ---

function renderTabs() {
    tabsContainer.innerHTML = '';
    state.tabs.forEach(tab => {
        const tabEl = document.createElement('button');
        tabEl.className = `tab ${tab.id === state.activeTabId ? 'active' : ''}`;
        tabEl.textContent = tab.name;

        // Click to switch
        tabEl.onclick = () => {
            state.activeTabId = tab.id;
            saveState();
            renderTabs();
            showFlashcardView();
        };

        // Right click (Desktop) or Long Press (Mobile) to manage
        tabEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            openManageTabDialog(tab.id);
        });

        // Simple long-press implementation for mobile
        let pressTimer;
        tabEl.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => openManageTabDialog(tab.id), 800);
        });
        tabEl.addEventListener('touchend', () => clearTimeout(pressTimer));

        tabsContainer.appendChild(tabEl);
    });
}

function handleAddTab() {
    const name = prompt("Enter new project theme name:", "New Project");
    if (name) {
        const newTab = {
            id: 'tab-' + Date.now(),
            name,
            createdAt: Date.now()
        };
        state.tabs.push(newTab);
        state.activeTabId = newTab.id;
        saveState();
        renderTabs();
        showFlashcardView();
    }
}

function openManageTabDialog(tabId) {
    const tab = state.tabs.find(t => t.id === tabId);
    if (!tab) return;

    editingTabId = tabId;
    manageTabInput.value = tab.name;
    manageTabDialog.showModal();
}

function handleDeleteTab() {
    if (!editingTabId) return;

    if (state.tabs.length <= 1) {
        alert("You cannot delete the only tab.");
        return;
    }

    if (confirm("Delete this tab and all its cards?")) {
        // Remove cards
        state.cards = state.cards.filter(c => c.tabId !== editingTabId);

        // Remove tab
        state.tabs = state.tabs.filter(t => t.id !== editingTabId);

        // If we deleted the active tab, switch to the first available one
        if (state.activeTabId === editingTabId) {
            state.activeTabId = state.tabs[0].id;
        }

        saveState();
        renderTabs();
        showFlashcardView();
        manageTabDialog.close();
    }
}

// --- FLASHCARD LOGIC ---

function getCardsForTab(tabId) {
    return state.cards.filter(c => c.tabId === tabId);
}

function selectNextCard() {
    const allCards = getCardsForTab(state.activeTabId);
    const activeCards = allCards.filter(c => !c.isArchived);

    if (activeCards.length === 0) {
        currentCard = null;
        return;
    }

    // Weighted Random Algorithm
    // Cards with higher weight (incorrect answers) appear more often.
    // Calculate total weight
    const totalWeight = activeCards.reduce((sum, card) => sum + (card.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const card of activeCards) {
        random -= (card.weight || 1);
        if (random <= 0) {
            currentCard = card;
            return;
        }
    }
    // Fallback
    currentCard = activeCards[0];
}

function renderCard() {
    if (!currentCard) {
        frontText.textContent = "No cards yet. Press + to add one!";
        backText.textContent = "...";
        backContent.classList.add('hidden');
        studyControls.classList.add('hidden');
        isCardRevealed = false;
        return;
    }

    frontText.textContent = currentCard.front;
    backText.textContent = currentCard.back;

    // Reset state
    isCardRevealed = false;
    backContent.classList.add('hidden'); // Hide back
    studyControls.classList.add('hidden'); // Hide controls
}

function handleCardTap() {
    if (!currentCard) return;
    if (isCardRevealed) return; // Already revealed

    // Reveal
    isCardRevealed = true;
    backContent.classList.remove('hidden'); // Show back
    studyControls.classList.remove('hidden'); // Show controls
}

function rateCard(isCorrect) {
    if (!currentCard) return;

    if (isCorrect) {
        // Decrease weight, min 1
        currentCard.weight = Math.max(1, (currentCard.weight || 1) - 1);
    } else {
        // Increase weight to show more often
        currentCard.weight = (currentCard.weight || 1) + 2;
    }

    saveState();
    refreshCard();
}

function refreshCard() {
    selectNextCard();
    renderCard();
}

function deleteCurrentCard() {
    if (!currentCard) return;
    if (confirm("Delete this card?")) {
        state.cards = state.cards.filter(c => c.id !== currentCard.id);
        saveState();
        refreshCard();
    }
}

function archiveCurrentCard() {
    if (!currentCard) return;
    currentCard.isArchived = true;
    saveState();
    refreshCard();
}

// --- ADD CARD LOGIC ---

function handleSaveCard() {
    const front = inputFront.value.trim();
    const back = inputBack.value.trim();

    if (!front || !back) {
        alert("Please fill both sides.");
        return;
    }

    const newCard = {
        id: 'card-' + Date.now(),
        tabId: state.activeTabId,
        front,
        back,
        weight: 3, // Start with slightly higher weight so new cards appear
        isArchived: false,
        createdAt: Date.now()
    };

    state.cards.push(newCard);
    saveState();

    // Clear inputs
    inputFront.value = '';
    inputBack.value = '';

    inputFront.focus();

    // Alert user briefly (optional, keeping it simple as per request)
}

// --- MANAGE / ARCHIVE LIST LOGIC ---

function openList(mode) {
    currentListMode = mode;
    switchView('list');
    renderList();
}

function renderList() {
    cardsListContainer.innerHTML = '';

    const allCards = getCardsForTab(state.activeTabId);
    let displayCards = [];

    if (currentListMode === 'manage') {
        listTitle.textContent = "Manage Cards";
        displayCards = allCards.filter(c => !c.isArchived);
    } else {
        listTitle.textContent = "Archive";
        displayCards = allCards.filter(c => c.isArchived);
    }

    if (displayCards.length === 0) {
        cardsListContainer.innerHTML = '<p style="text-align:center; color:#999;">No cards found.</p>';
        return;
    }

    displayCards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const actionsHtml = currentListMode === 'manage'
            ? `
                <button class="btn-sm" onclick="editCard('${card.id}')">Edit</button>
                <button class="btn-sm" onclick="archiveCard('${card.id}')">Archive</button>
                <button class="btn-sm" style="color:var(--error-color)" onclick="deleteCard('${card.id}')">Delete</button>
              `
            : `
                <button class="btn-sm" onclick="unarchiveCard('${card.id}')">Reactivate</button>
                <button class="btn-sm" style="color:var(--error-color)" onclick="deleteCard('${card.id}')">Delete</button>
              `;

        item.innerHTML = `
            <div class="list-item-header">
                <span>${escapeHtml(card.front)}</span>
            </div>
            <div class="list-item-body">
                ${escapeHtml(card.back)}
            </div>
            <div class="list-item-actions">
                ${actionsHtml}
            </div>
        `;
        cardsListContainer.appendChild(item);
    });
}

// Global functions for inline onclicks
window.deleteCard = (id) => {
    if (confirm("Delete this card permanently?")) {
        state.cards = state.cards.filter(c => c.id !== id);
        saveState();
        renderList();
        // If we deleted the current card being viewed, refresh it
        if (currentCard && currentCard.id === id) {
            currentCard = null;
        }
    }
};

window.archiveCard = (id) => {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        card.isArchived = true;
        saveState();
        renderList();
        if (currentCard && currentCard.id === id) refreshCard();
    }
};

window.unarchiveCard = (id) => {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        card.isArchived = false;
        saveState();
        renderList();
        refreshCard();
        alert("Card reactivated!");
    }
};

window.editCard = (id) => {
    const card = state.cards.find(c => c.id === id);
    if (card) {
        const newFront = prompt("Edit Front:", card.front);
        const newBack = prompt("Edit Back:", card.back);
        if (newFront !== null && newBack !== null) {
            card.front = newFront;
            card.back = newBack;
            saveState();
            renderList();
            if (currentCard && currentCard.id === id) renderCard();
        }
    }
};

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// --- EXPORT / IMPORT LOGIC ---

function handleExport() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `cards_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handleImport() {
    document.getElementById('file-import').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedState = JSON.parse(e.target.result);

            // Basic validation
            if (!importedState.tabs || !importedState.cards) {
                throw new Error("Invalid backup file format.");
            }

            if (confirm("This will overwrite your current data. Continue?")) {
                state = importedState;
                saveState();

                // Reset UI state
                state.activeTabId = state.tabs[0].id;
                currentCard = null;
                isCardRevealed = false;

                renderTabs();
                showFlashcardView();
                alert("Data restored successfully!");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to import: " + err.message);
        }
        // Reset input so same file can be selected again if needed
        event.target.value = '';
    };
    reader.readAsText(file);
}

// --- VIEW NAVIGATION ---

function switchView(viewName) {
    // Hide all
    [viewFlashcard, viewAdd, viewList].forEach(el => el.classList.add('hidden'));
    [viewFlashcard, viewAdd, viewList].forEach(el => el.classList.remove('active'));

    // Show target
    if (viewName === 'flashcard') {
        viewFlashcard.classList.remove('hidden');
        viewFlashcard.classList.add('active');
        refreshCard();
    } else if (viewName === 'add') {
        viewAdd.classList.remove('hidden');
        viewAdd.classList.add('active');
        inputFront.focus();
    } else if (viewName === 'list') {
        viewList.classList.remove('hidden');
        viewList.classList.add('active');
    }
}

function showFlashcardView() {
    switchView('flashcard');
}

// Start
init();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}
