// app.js - UI Logic for Taiwanese Mahjong Master
// Game-first mode: always fullscreen horizontal layout
// Game logic is in game.js

document.addEventListener('DOMContentLoaded', () => {
    renderTileOverview();
    renderPatterns();
    initGameControls();
    initPanels();
    initAvatarUpload();
    initPlayerNames();
    MahjongGame.initScoringUI();
});

// --- Tile Overview (all tiles for beginners) ---
function renderTileOverview() {
    const container = document.getElementById('tile-overview');
    if (!container) return;

    const categories = [
        { name: '萬子 (Characters)', desc: '1~9萬，各4張，共36張', tiles: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'] },
        { name: '筒子 (Dots)', desc: '1~9筒，各4張，共36張', tiles: ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p'] },
        { name: '條子 (Bamboo)', desc: '1~9條，各4張，共36張', tiles: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s'] },
        { name: '字牌 (Honors)', desc: '風牌4種＋三元牌3種，各4張，共28張', tiles: ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'] },
        { name: '花牌 (Flowers)', desc: '春夏秋冬＋梅蘭菊竹，各1張，共8張', tiles: ['s1', 's2', 's3', 's4', 'f1', 'f2', 'f3', 'f4'] }
    ];

    categories.forEach(cat => {
        const card = document.createElement('div');
        card.className = 'tile-overview-card';

        const header = document.createElement('div');
        header.className = 'tile-overview-header';
        header.innerHTML = `<strong>${cat.name}</strong><span class="tile-overview-desc">${cat.desc}</span>`;
        card.appendChild(header);

        const tilesRow = document.createElement('div');
        tilesRow.className = 'tile-overview-tiles';
        cat.tiles.forEach(id => {
            tilesRow.appendChild(createTileElement(id));
        });
        card.appendChild(tilesRow);
        container.appendChild(card);
    });
}

// --- Game Controls ---
function initGameControls() {
    const dealBtn = document.getElementById('deal-btn');
    const sortBtn = document.getElementById('sort-btn');
    if (dealBtn) dealBtn.addEventListener('click', () => MahjongGame.startGame());
    if (sortBtn) sortBtn.addEventListener('click', () => MahjongGame.sortUserHand());
}

// --- Pattern Rendering ---
function renderPatterns() {
    const container = document.getElementById('patterns-container');
    if (!container || typeof MAHJONG_PATTERNS === 'undefined') return;

    MAHJONG_PATTERNS.forEach(category => {
        const catDiv = document.createElement('div');
        catDiv.className = 'pattern-category';
        const catTitle = document.createElement('h3');
        catTitle.textContent = category.category;
        catDiv.appendChild(catTitle);

        category.patterns.forEach(pattern => {
            const card = document.createElement('div');
            card.className = 'pattern-card';
            const header = document.createElement('h4');
            header.innerHTML = `${pattern.name} <span class="pattern-tai">${pattern.tai} 台</span>`;
            card.appendChild(header);

            if (pattern.probability) {
                const prob = document.createElement('div');
                prob.className = 'pattern-prob';
                prob.innerHTML = `<span class="prob-label">出現率:</span> ${pattern.probability}`;
                card.appendChild(prob);
            }

            const desc = document.createElement('p');
            desc.className = 'pattern-desc';
            desc.textContent = pattern.description;
            card.appendChild(desc);

            const exampleDiv = document.createElement('div');
            exampleDiv.className = 'pattern-example';
            const handDiv = document.createElement('div');
            handDiv.className = 'hand-display';
            pattern.example.forEach(tileId => {
                if (tileId === '+') {
                    const sep = document.createElement('span');
                    sep.className = 'meld-separator';
                    sep.textContent = '+';
                    handDiv.appendChild(sep);
                } else {
                    handDiv.appendChild(createTileElement(tileId));
                }
            });
            exampleDiv.appendChild(handDiv);
            card.appendChild(exampleDiv);
            catDiv.appendChild(card);
        });
        container.appendChild(catDiv);
    });
}

// --- Tile Display (used by game.js) ---
function getTileDisplay(id) {
    const map = {
        'dong': '東', 'nan': '南', 'xi': '西', 'bei': '北',
        'zhong': '中', 'fa': '發', 'bai': '',
        'f1': '梅', 'f2': '蘭', 'f3': '菊', 'f4': '竹',
        's1': '春', 's2': '夏', 's3': '秋', 's4': '冬'
    };
    if (map[id] !== undefined) return map[id];
    const unicode = {
        '1m': '🀇', '2m': '🀈', '3m': '🀉', '4m': '🀊', '5m': '🀋', '6m': '🀌', '7m': '🀍', '8m': '🀎', '9m': '🀏',
        '1s': '🀐', '2s': '🀑', '3s': '🀒', '4s': '🀓', '5s': '🀔', '6s': '🀕', '7s': '🀖', '8s': '🀗', '9s': '🀘',
        '1p': '🀙', '2p': '🀚', '3p': '🀛', '4p': '🀜', '5p': '🀝', '6p': '🀞', '7p': '🀟', '8p': '🀠', '9p': '🀡'
    };
    return unicode[id] || id;
}

function createTileElement(id) {
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = getTileDisplay(id);

    if (id.endsWith('m')) el.dataset.suit = 'wan';
    else if (id.endsWith('p')) el.dataset.suit = 'tong';
    else if (id.endsWith('s')) el.dataset.suit = 'sou';
    else {
        el.dataset.suit = 'honor';
        el.dataset.tile = id;

        if (['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'].includes(id)) {
            el.dataset.suit = 'flower';
            el.classList.add('flower-tile');
            const charMap = { 's1': '春', 's2': '夏', 's3': '秋', 's4': '冬', 'f1': '梅', 'f2': '蘭', 'f3': '菊', 'f4': '竹' };
            el.textContent = '';
            const flowerImg = document.createElement('img');
            flowerImg.src = `images/flowers/${id}.png`;
            flowerImg.alt = charMap[id];
            flowerImg.className = 'flower-img';
            flowerImg.draggable = false;
            el.appendChild(flowerImg);
        }
    }
    return el;
}

// --- Responsive Layout: Scale to Fit (2.5D table, absolute position) ---
function resizeTable() {
    const table = document.querySelector('.mahjong-table-container');
    if (!table) return;

    const baseWidth = 1000;
    const baseHeight = 650;

    // 手機橫向（高度 <= 500 的橫向畫面）改用緊湊版面
    const W = window.innerWidth;
    const H = window.innerHeight;
    const compact = H <= 500 && W > H;
    document.body.classList.toggle('compact-landscape', compact);
    if (compact) {
        layoutCompactTable(table, W, H, baseWidth, baseHeight);
        return;
    }
    table.style.top = '';
    table.style.left = '';

    const bottomReserve = 120; // reserve space for hand area
    const availableW = window.innerWidth - 16;
    const availableH = window.innerHeight - bottomReserve;

    let scale = Math.min(availableW / baseWidth, availableH / baseHeight);
    scale = Math.max(Math.min(scale, 1.15), 0.5);

    // Use absolute positioning: table is centered via CSS translate(-50%, -55%)
    // We only need to set the scale here; 28deg for stronger trapezoid effect
    table.style.transform = `rotateX(35deg) translate(-50%, -55%) scale(${scale})`;
    window._tableScale = scale;

    // Dynamically adjust hand tile width
    const bp = document.querySelector('.bottom-player .hand-display');
    if (bp) {
        const tileCount = bp.querySelectorAll('.tile').length || 16;
        const maxHandWidth = window.innerWidth - 150;
        const tileWidth = Math.min(62, Math.floor(maxHandWidth / tileCount) - 4);
        bp.style.setProperty('--dynamic-tile-w', tileWidth + 'px');
    }
}

// 手機橫向：底部一整排手牌，左右兩側欄放資訊與對手，中間放牌桌
function layoutCompactTable(table, W, H, baseWidth, baseHeight) {
    const bp = document.querySelector('.bottom-player .hand-display');
    const tileCount = bp ? Math.max(bp.querySelectorAll('.tile').length, 17) : 17;
    const tileW = Math.max(24, Math.min(46, Math.floor((W - 48) / tileCount) - 2));
    const handH = Math.round(tileW * 1.32) + 16;
    const sideMin = Math.max(116, Math.round(W * 0.16));
    const availW = W - sideMin * 2;
    const availH = H - handH - 6;

    const root = document.documentElement;
    root.style.setProperty('--hand-h', handH + 'px');
    if (bp) bp.style.setProperty('--dynamic-tile-w', tileW + 'px');

    // 先放一次量出斜放後的實際外框，再依外框修正縮放與置中
    const apply = (s, left, top) => {
        table.style.left = left + 'px';
        table.style.top = top + 'px';
        table.style.transform = `rotateX(35deg) scale(${s}) translate(-50%, -55%)`;
    };
    let scale = Math.min(availW / baseWidth, availH / baseHeight);
    apply(scale, W / 2, availH / 2);
    let r = table.getBoundingClientRect();
    scale = Math.max(0.25, scale * Math.min(availW / r.width, availH / r.height));
    apply(scale, W / 2, availH / 2);
    r = table.getBoundingClientRect();
    const left = W / 2 + (W / 2 - (r.left + r.width / 2));
    const top = availH / 2 + (availH / 2 + 3 - (r.top + r.height / 2));
    apply(scale, left, top);
    r = table.getBoundingClientRect();

    window._tableScale = scale;
    root.style.setProperty('--side-w', Math.max(108, Math.floor((W - r.width) / 2) - 6) + 'px');
    placeLeftOpponent();
}

// 左側對手卡片放在資訊面板正下方（面板文字一變高度就變，所以監看文字變動再量一次）
let infoObserver = null;
function placeLeftOpponent() {
    const info = document.getElementById('info-panel');
    if (!info) return;
    if (!infoObserver && window.MutationObserver) {
        infoObserver = new MutationObserver(() => {
            if (document.body.classList.contains('compact-landscape')) placeLeftOpponent();
        });
        infoObserver.observe(info, { childList: true, subtree: true, characterData: true });
    }
    const bottom = Math.round(info.getBoundingClientRect().bottom);
    document.documentElement.style.setProperty('--left-opp-top', (bottom + 6) + 'px');
}

// No-ops (game-first mode, body always has fullscreen-game class)
function enterFullscreenGame() { resizeTable(); }
function exitFullscreenGame() {}

// --- Settings & Help Modals (centered overlay) ---
function initPanels() {
    const settingsPanel = document.getElementById('settings-panel');
    const helpPanel = document.getElementById('help-panel');
    const settingsBtn = document.getElementById('settings-btn');
    const helpBtn = document.getElementById('help-btn');
    const settingsClose = document.getElementById('settings-close');
    const helpClose = document.getElementById('help-close');

    function openModal(overlay) {
        // Close any open modal first
        settingsPanel.classList.add('hidden');
        helpPanel.classList.add('hidden');
        overlay.classList.remove('hidden');
    }

    function closeAll() {
        settingsPanel.classList.add('hidden');
        helpPanel.classList.add('hidden');
    }

    // 手機橫向：分數表平時收起，按「分」叫出、點分數表本身關閉
    const scoreBtn = document.getElementById('score-btn');
    const scoreBoard = document.getElementById('floating-scoreboard');
    if (scoreBtn) scoreBtn.addEventListener('click', () => document.body.classList.toggle('show-scores'));
    if (scoreBoard) scoreBoard.addEventListener('click', () => document.body.classList.remove('show-scores'));

    if (settingsBtn) settingsBtn.addEventListener('click', () => openModal(settingsPanel));
    if (helpBtn) helpBtn.addEventListener('click', () => openModal(helpPanel));
    if (settingsClose) settingsClose.addEventListener('click', closeAll);
    if (helpClose) helpClose.addEventListener('click', closeAll);

    // Click on overlay backdrop (outside modal box) to close
    [settingsPanel, helpPanel].forEach(overlay => {
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAll();
            });
        }
    });

    // Tab switching inside help panel
    if (helpPanel) {
        const tabs = helpPanel.querySelectorAll('.hmenu-tab');
        const contents = helpPanel.querySelectorAll('.hmenu-content');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                const target = document.getElementById(tab.dataset.target);
                if (target) target.classList.add('active');
            });
        });
    }
}

// --- Avatar Upload ---
function initAvatarUpload() {
    const inputs = document.querySelectorAll('.avatar-input');
    inputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const playerId = input.dataset.player;
            const reader = new FileReader();
            reader.onload = function (ev) {
                const dataUrl = ev.target.result;
                // Update preview in settings
                const preview = document.getElementById(`avatar-preview-${playerId}`);
                if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Player ${playerId}">`;
                // Update in-game overlay avatar
                const oppAvatar = document.getElementById(`opp-avatar-${playerId}`);
                if (oppAvatar) oppAvatar.innerHTML = `<img src="${dataUrl}" alt="Player ${playerId}">`;
                // Save to localStorage
                localStorage.setItem(`mahjong_avatar_${playerId}`, dataUrl);
            };
            reader.readAsDataURL(file);
        });
    });

    // Load saved avatars on init (0=self, 1-3=opponents)
    [0, 1, 2, 3].forEach(pId => {
        const saved = localStorage.getItem(`mahjong_avatar_${pId}`);
        if (saved) {
            const preview = document.getElementById(`avatar-preview-${pId}`);
            if (preview) preview.innerHTML = `<img src="${saved}" alt="Player ${pId}">`;
            const oppAvatar = document.getElementById(`opp-avatar-${pId}`);
            if (oppAvatar) oppAvatar.innerHTML = `<img src="${saved}" alt="Player ${pId}">`;
        }
    });
}

function initPlayerNames() {
    const defaultNames = ['自己', '下家', '對家', '上家'];

    // Load saved names into input fields
    [0, 1, 2, 3].forEach(pId => {
        const savedName = localStorage.getItem(`mahjong_player_name_${pId}`);
        const input = document.getElementById(`player-name-${pId}`);
        if (input && savedName) {
            input.value = savedName;
        }
    });

    // Apply saved names to UI elements
    applyPlayerNames();
}

function applyPlayerNames() {
    const defaultNames = ['自己', '下家', '對家', '上家'];

    [0, 1, 2, 3].forEach(pId => {
        const savedName = localStorage.getItem(`mahjong_player_name_${pId}`) || defaultNames[pId];

        // Update opponent overlay names (players 1-3)
        if (pId > 0) {
            const oppNameEl = document.querySelector(`#opp-info-${pId === 1 ? 'right' : pId === 2 ? 'top' : 'left'} .opp-name`);
            if (oppNameEl) oppNameEl.textContent = savedName;
        }

        // Update bottom player label (player 0)
        if (pId === 0) {
            const bottomLabel = document.querySelector('.bottom-label');
            if (bottomLabel) {
                const windSpan = bottomLabel.querySelector('.wind-badge');
                const windText = windSpan ? windSpan.outerHTML : '';
                bottomLabel.innerHTML = `${savedName} ${windText}`;
            }
        }

        // Update scoreboard names
        const scoreRow = document.querySelector(`#score-${pId}`)?.closest('tr');
        if (scoreRow) {
            const nameCell = scoreRow.querySelector('td:first-child');
            if (nameCell) nameCell.textContent = savedName;
        }
    });
}

function savePlayerNames() {
    const defaultNames = ['自己', '下家', '對家', '上家'];

    [0, 1, 2, 3].forEach(pId => {
        const input = document.getElementById(`player-name-${pId}`);
        if (input) {
            const name = input.value.trim() || defaultNames[pId];
            localStorage.setItem(`mahjong_player_name_${pId}`, name);
        }
    });

    // Also update PLAYER_NAMES in game engine if available
    if (window.MahjongGame && typeof window.MahjongGame.updatePlayerNames === 'function') {
        window.MahjongGame.updatePlayerNames();
    }

    applyPlayerNames();
}

window.addEventListener('resize', () => {
    resizeTable();
    // 手機轉向時視窗尺寸會晚一點才定下來，稍後再排一次
    clearTimeout(window._resizeLater);
    window._resizeLater = setTimeout(resizeTable, 300);
});
window.addEventListener('load', resizeTable);
document.addEventListener('DOMContentLoaded', resizeTable);
setTimeout(resizeTable, 100);
