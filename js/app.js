// app.js - UI Logic for Taiwanese Mahjong Master
// Handles: Tabs, Tile Rendering, Pattern Display, Control Wiring
// Game logic is in game.js

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    renderTileOverview();
    renderPatterns();
    initGameControls();
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
        { name: '花牌 (Flowers)', desc: '春夏秋冬＋梅蘭竹菊，各1張，共8張', tiles: ['s1', 's2', 's3', 's4', 'f1', 'f2', 'f3', 'f4'] }
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

// --- Tab Logic ---
function initTabs() {
    const tabs = document.querySelectorAll('.tabs .tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        });
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
                handDiv.appendChild(createTileElement(tileId));
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
        'f1': '梅', 'f2': '蘭', 'f3': '竹', 'f4': '菊',
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
            const charMap = { 's1': '春', 's2': '夏', 's3': '秋', 's4': '冬', 'f1': '梅', 'f2': '蘭', 'f3': '竹', 'f4': '菊' };
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

// --- Responsive Layout: Scale to Fit ---
function resizeTable() {
    const table = document.querySelector('.mahjong-table-container');
    if (!table) return;

    // Base dimensions
    const baseWidth = 800;
    const baseHeight = 800;

    // Available space (subtract header ~100px, footer ~100px buffer)
    // On mobile, header might be smaller.
    const headerHeight = window.innerHeight < 700 ? 60 : 100;
    const footerHeight = 80;
    const paddingX = 20;

    const availableW = window.innerWidth - paddingX;
    const availableH = window.innerHeight - headerHeight - footerHeight;

    // Calculate scale
    let scale = Math.min(availableW / baseWidth, availableH / baseHeight);

    // Optional: Max scale cap? (e.g. 1.2)
    // scale = Math.min(scale, 1.5); 

    // Apply scale
    table.style.transform = `scale(${scale})`;

    // Adjust layout flow (since transform doesn't affect flow size)
    // We reduce the effective height of the container to pull up elements below
    const effectiveHeight = baseHeight * scale;
    const gap = baseHeight - effectiveHeight;
    table.style.marginBottom = `-${gap}px`;

    // Also adjust width margin if needed? 
    // margin: auto handles horizontal.
}

window.addEventListener('resize', resizeTable);
// Use multiple events to ensure it runs
window.addEventListener('load', resizeTable);
document.addEventListener('DOMContentLoaded', resizeTable);
// Run shortly after render (game start)
setTimeout(resizeTable, 100);
