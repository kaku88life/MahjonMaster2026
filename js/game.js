// game.js - Mahjong Game Simulator (4-Player, Realistic)
// Features: 3-dice rolling, educational toast messages, wall-click draw,
//           4-tile dealing, flower replacement, round/wind tracking, 
//           Chi/Pong, animated center discard pile

const MahjongGame = (() => {
    // --- Constants ---
    const DEFAULT_PLAYER_NAMES = ['自己', '下家', '對家', '上家'];
    let PLAYER_NAMES = DEFAULT_PLAYER_NAMES.map((def, i) => {
        const saved = localStorage.getItem(`mahjong_player_name_${i}`);
        return saved || def;
    });
    const WIND_CHARS = ['東', '南', '西', '北'];
    const DIRECTION_CLASSES = ['d-east', 'd-south', 'd-west', 'd-north'];
    const PLAYER_COLORS = ['#F59E0B', '#3B82F6', '#EF4444', '#10B981'];

    // --- State ---
    let state = {
        deck: [],
        players: [],
        currentPlayer: 0,
        dealer: 0,
        active: false,
        round: 0,         // 0=東圈, 1=南圈, 2=西圈, 3=北圈
        handCount: 0,
        lastDiscard: null,
        lastDiscardPlayer: -1,
        aiSpeed: 3000,
        waitingForAction: false,
        diceResult: [0, 0, 0],
        centerDiscards: [],
        playerDiscards: [[], [], [], []],
        dealing: false,
        userCanDraw: false, // Is wall clickable for user to draw?
        tutorialMode: true,
        speedMultiplier: 1, // 1 = normal, 0.5 = 2x speed
        lianZhuang: 0,      // 連莊次數 (0=初莊)
        roundWind: 'dong',  // 圈風
        dealerPasses: 0,    // 本圈已過莊次數（滿 4 次換圈）
        lastDrawnTile: null // 最近一次摸進手的牌（自摸判定用）
    };
    const WIND_IDS = ['dong', 'nan', 'xi', 'bei'];

    // Persistent scoring state (survives across games)
    let scoring = loadScoring();

    // --- Drawn Tile Preview Helper ---
    function showDrawnTilePreview(tile) {
        const preview = document.getElementById('drawn-tile-preview');
        const container = document.getElementById('preview-tile-container');
        if (!preview || !container) return;

        // Clear previous
        container.innerHTML = '';

        // Create large tile
        const tileEl = createTileElement(tile);
        container.appendChild(tileEl);

        // Show
        preview.classList.remove('hidden');

        // Bind buttons
        const keepBtn = document.getElementById('btn-keep-preview');
        const discardBtn = document.getElementById('btn-discard-preview');

        if (keepBtn) {
            keepBtn.onclick = () => {
                preview.classList.add('hidden');
                showToast('請選擇一張手牌打出', 1500);
            };
        }

        if (discardBtn) {
            discardBtn.onclick = () => {
                preview.classList.add('hidden');
                // Force discard of the drawn tile
                // If action bar is active (e.g. Can Hu), we must cancel it
                if (state.waitingForAction) {
                    hideActionBar();
                    state.waitingForAction = false;
                }

                const hand = state.players[0].hand;
                // Drawn tile is usually at the end
                // We find the last instance of this tile to be safe
                const idx = hand.lastIndexOf(tile);
                if (idx !== -1) {
                    userDiscard(idx);
                }
            };
        }
    }

    // --- Stats Helpers ---
    function startTurnTimer() {
        if (!state.playerStats) return;
        if (state.playerStats.currentTurnStart === 0) {
            state.playerStats.currentTurnStart = Date.now();
        }
    }

    function stopTurnTimer() {
        if (!state.playerStats || state.playerStats.currentTurnStart === 0) return;
        const duration = Date.now() - state.playerStats.currentTurnStart;
        state.playerStats.totalThinkTime += duration;
        state.playerStats.moveCount++;
        state.playerStats.currentTurnStart = 0;
        updateStatsDisplay();
    }

    function updateStatsDisplay() {
        if (!state.playerStats) return;
        const div = document.getElementById('player-stats');
        const avgSpan = document.getElementById('avg-think-time');
        if (!div || !avgSpan) return;

        div.style.display = 'block';
        const avg = state.playerStats.moveCount > 0
            ? (state.playerStats.totalThinkTime / state.playerStats.moveCount / 1000).toFixed(1)
            : "0.0";
        avgSpan.textContent = avg;
    }

    function defaultScoring() {
        return {
            settings: { base: 100, perTai: 100 },
            scores: [0, 0, 0, 0],
            stats: [
                { hu: 0, zimo: 0, fangqiang: 0 },
                { hu: 0, zimo: 0, fangqiang: 0 },
                { hu: 0, zimo: 0, fangqiang: 0 },
                { hu: 0, zimo: 0, fangqiang: 0 }
            ]
        };
    }

    function loadScoring() {
        try {
            const saved = localStorage.getItem('mahjong_scoring');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return defaultScoring();
    }

    function saveScoring() {
        try { localStorage.setItem('mahjong_scoring', JSON.stringify(scoring)); } catch (e) { /* ignore */ }
    }

    // Toast queue for educational messages
    let toastQueue = [];
    let toastShowing = false;

    // --- Deck (144 tiles: 136 + 8 flowers) ---
    function generateFullDeck() {
        const suits = ['m', 'p', 's'];
        const honors = ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'];
        const flowers = ['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'];
        let deck = [];
        suits.forEach(suit => {
            for (let i = 1; i <= 9; i++) {
                for (let c = 0; c < 4; c++) deck.push(i + suit);
            }
        });
        honors.forEach(h => { for (let c = 0; c < 4; c++) deck.push(h); });
        flowers.forEach(f => deck.push(f));
        return deck;
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // --- Tile Helpers ---
    function isFlower(tile) {
        return ['f1', 'f2', 'f3', 'f4', 's1', 's2', 's3', 's4'].includes(tile);
    }
    function getSuitType(tile) {
        if (tile.endsWith('m')) return 1;
        if (tile.endsWith('p')) return 2;
        if (tile.endsWith('s')) return 3;
        if (['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'].includes(tile)) return 4;
        return 5;
    }
    function getSuit(tile) {
        if (tile.endsWith('m')) return 'm';
        if (tile.endsWith('p')) return 'p';
        if (tile.endsWith('s')) return 's';
        return null;
    }
    function getNumber(tile) {
        const s = getSuit(tile);
        return s ? parseInt(tile) : null;
    }
    function sortTiles(tiles) {
        const honorOrder = ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'];
        return tiles.slice().sort((a, b) => {
            const sa = getSuitType(a), sb = getSuitType(b);
            if (sa !== sb) return sa - sb;
            if (sa <= 3) return parseInt(a) - parseInt(b);
            if (sa === 4) return honorOrder.indexOf(a) - honorOrder.indexOf(b);
            return a.localeCompare(b);
        });
    }

    // --- Chi / Pong ---
    function canChi(playerHand, discardedTile, discardPlayer, callerPlayer) {
        // callerPlayer defaults to 0 (user) for backward compatibility
        if (callerPlayer === undefined) callerPlayer = 0;
        // Can only chi from previous player (上家)
        const previousPlayer = (callerPlayer + 3) % 4;
        if (discardPlayer !== previousPlayer) return { valid: false, combos: [] };
        const suit = getSuit(discardedTile);
        if (!suit) return { valid: false, combos: [] };
        const num = getNumber(discardedTile);
        const combos = [];
        const handNums = playerHand.filter(t => getSuit(t) === suit).map(t => getNumber(t));
        if (num >= 3 && handNums.includes(num - 2) && handNums.includes(num - 1))
            combos.push([(num - 2) + suit, (num - 1) + suit, discardedTile]);
        if (num >= 2 && num <= 8 && handNums.includes(num - 1) && handNums.includes(num + 1))
            combos.push([(num - 1) + suit, discardedTile, (num + 1) + suit]);
        if (num <= 7 && handNums.includes(num + 1) && handNums.includes(num + 2))
            combos.push([discardedTile, (num + 1) + suit, (num + 2) + suit]);
        return { valid: combos.length > 0, combos };
    }
    function canPong(playerHand, discardedTile) {
        return { valid: playerHand.filter(t => t === discardedTile).length >= 2 };
    }

    // --- AI Decision Functions ---
    function aiShouldPong(hand, tile) {
        // Always pong honor tiles (wind/dragon) - they contribute to winning patterns
        const isHonor = ['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai'].includes(tile);
        if (isHonor) return true;
        // For number tiles, pong if it doesn't break existing sequences
        return true;
    }

    function aiShouldChi(hand, combo) {
        // Always chi - actively build sequences
        return true;
    }

    // --- AI Execute Pong ---
    function executeAIPong(playerId, tile) {
        const hand = state.players[playerId].hand;
        let removed = 0;
        for (let i = hand.length - 1; i >= 0 && removed < 2; i--) {
            if (hand[i] === tile) { hand.splice(i, 1); removed++; }
        }
        state.players[playerId].melds.push({ type: 'pong', tiles: [tile, tile, tile] });
        // Remove from discard rivers
        if (state.centerDiscards.length > 0) state.centerDiscards.pop();
        if (state.playerDiscards && state.playerDiscards[state.lastDiscardPlayer]) {
            state.playerDiscards[state.lastDiscardPlayer].pop();
        }

        showToast(`${PLAYER_NAMES[playerId]} 碰！${getTileDisplay(tile)}`, 1500);

        state.currentPlayer = playerId;
        state.waitingForAction = false;
        updateTurnIndicator(playerId);
        renderAll();
        renderDiscardRivers();

        // AI discards a tile after pong
        setTimeout(() => {
            if (!state.active) return;
            const discardIdx = aiChooseDiscard(state.players[playerId].hand);
            if (discardIdx < 0 || discardIdx >= state.players[playerId].hand.length) return;
            const discardedTile = state.players[playerId].hand.splice(discardIdx, 1)[0];
            state.lastDiscard = discardedTile;
            state.lastDiscardPlayer = playerId;
            addToCenterPile(discardedTile, playerId);
            renderAll();
            renderDiscardRivers();
            updateInfoPanel(`${PLAYER_NAMES[playerId]} 打出 ${getTileDisplay(discardedTile)}`);

            setTimeout(() => {
                if (!state.active) return;
                const actionFound = checkDiscardActions(discardedTile, playerId);
                if (!actionFound) nextTurn();
            }, 500);
        }, state.aiSpeed * 0.5);
    }

    // --- AI Execute Chi ---
    function executeAIChi(playerId, combo, discardedTile) {
        const hand = state.players[playerId].hand;
        combo.filter(t => t !== discardedTile).forEach(t => {
            const idx = hand.indexOf(t);
            if (idx !== -1) hand.splice(idx, 1);
        });
        state.players[playerId].melds.push({ type: 'chi', tiles: combo });
        // Remove from discard rivers
        if (state.centerDiscards.length > 0) state.centerDiscards.pop();
        if (state.playerDiscards && state.playerDiscards[state.lastDiscardPlayer]) {
            state.playerDiscards[state.lastDiscardPlayer].pop();
        }

        showToast(`${PLAYER_NAMES[playerId]} 吃！`, 1500);

        state.currentPlayer = playerId;
        state.waitingForAction = false;
        updateTurnIndicator(playerId);
        renderAll();
        renderDiscardRivers();

        // AI discards a tile after chi
        setTimeout(() => {
            if (!state.active) return;
            const discardIdx = aiChooseDiscard(state.players[playerId].hand);
            if (discardIdx < 0 || discardIdx >= state.players[playerId].hand.length) return;
            const discardedTile2 = state.players[playerId].hand.splice(discardIdx, 1)[0];
            state.lastDiscard = discardedTile2;
            state.lastDiscardPlayer = playerId;
            addToCenterPile(discardedTile2, playerId);
            renderAll();
            renderDiscardRivers();
            updateInfoPanel(`${PLAYER_NAMES[playerId]} 打出 ${getTileDisplay(discardedTile2)}`);

            setTimeout(() => {
                if (!state.active) return;
                const actionFound = checkDiscardActions(discardedTile2, playerId);
                if (!actionFound) nextTurn();
            }, 500);
        }, state.aiSpeed * 0.5);
    }

    // --- AI ---
    function aiChooseDiscard(hand) {
        // 依向聽數選牌：打完離聽牌最近、能進張最多的那張
        // 桌上看得到的牌（海底、所有人亮出的牌組）算進去，避免去等已經沒了的牌
        const visible = [];
        (state.playerDiscards || []).forEach(river => river.forEach(d => visible.push(d.tile)));
        state.players.forEach(pl => (pl.melds || []).forEach(m => visible.push(...m.tiles)));
        const tile = MahjongAlgorithm.chooseDiscard(hand, visible);
        const idx = hand.indexOf(tile);
        return idx >= 0 ? idx : hand.length - 1;
    }

    // ===== CUSTOM TOAST UI SYSTEM =====
    function showToast(message, duration = 3500) {
        return new Promise(resolve => {
            const container = document.getElementById('toast-container');
            if (!container) { resolve(); return; }

            const toast = document.createElement('div');
            toast.className = 'game-toast';
            toast.innerHTML = message;
            container.appendChild(toast);

            // Trigger animation
            requestAnimationFrame(() => toast.classList.add('show'));

            setTimeout(() => {
                toast.classList.remove('show');
                toast.classList.add('hide');
                setTimeout(() => {
                    toast.remove();
                    resolve();
                }, 300);
            }, duration);
        });
    }

    async function showToastSequence(messages) {
        for (const msg of messages) {
            const dur = msg.duration || 2000;
            await showToast(msg.text, dur);
            await sleep(200); // Brief gap between toasts
        }
    }

    // ===== GAME FLOW =====

    function showNewGameModal() {
        return new Promise((resolve) => {
            const modal = document.getElementById('newgame-modal');
            if (!modal) { resolve({ tutorial: false, speed2x: false }); return; }

            // Load saved preferences
            const saved = JSON.parse(localStorage.getItem('mahjong_newgame_opts') || '{}');
            const tutorialCb = document.getElementById('opt-tutorial');
            const speedSel = document.getElementById('opt-speed');
            if (tutorialCb && saved.tutorial !== undefined) tutorialCb.checked = saved.tutorial;
            if (speedSel && saved.speedLevel !== undefined) speedSel.value = saved.speedLevel;

            modal.classList.remove('hidden');

            const startBtn = document.getElementById('newgame-start');
            const cancelBtn = document.getElementById('newgame-cancel');

            function cleanup() {
                modal.classList.add('hidden');
                startBtn.removeEventListener('click', onStart);
                cancelBtn.removeEventListener('click', onCancel);
            }

            function onStart() {
                const opts = {
                    tutorial: tutorialCb ? tutorialCb.checked : false,
                    speedLevel: speedSel ? parseInt(speedSel.value) : 2
                };
                localStorage.setItem('mahjong_newgame_opts', JSON.stringify(opts));
                cleanup();
                resolve(opts);
            }

            function onCancel() {
                cleanup();
                resolve(null);
            }

            startBtn.addEventListener('click', onStart);
            cancelBtn.addEventListener('click', onCancel);
        });
    }

    // Helper: adjusted sleep based on speed multiplier
    function tsleep(ms) {
        return sleep(ms * state.speedMultiplier);
    }

    async function startGame(autoRestart) {
        if (!autoRestart) {
            // Show new game options modal only for manual start
            const options = await showNewGameModal();
            if (!options) return; // User cancelled

            state.tutorialMode = options.tutorial;
            // speedLevel: 1=normal(1x), 2=fast(2x), 3=turbo(3x)
            const sl = options.speedLevel || 2;
            state.speedMultiplier = sl >= 3 ? 0.33 : sl >= 2 ? 0.5 : 1;
            state.aiSpeed = parseInt(document.getElementById('ai-speed').value) || 3000;
            // 手動開新局：從東風圈、自己當莊重新開始
            state.dealer = 0;
            state.round = 0;
            state.handCount = 0;
            state.dealerPasses = 0;
            state.lianZhuang = 0;
            state.roundWind = 'dong';
            state.drawHints = 0;
        }
        state.lastDrawnTile = null;
        // For autoRestart, keep existing tutorialMode, speedMultiplier, aiSpeed

        state.active = false;
        state.dealing = true;
        state.centerDiscards = [];
        state.playerDiscards = [[], [], [], []];
        state.lastDiscard = null;
        state.lastDiscardPlayer = -1;
        state.waitingForAction = false;
        state.userCanDraw = false;
        hideActionBar();

        // Clear toasts
        const tc = document.getElementById('toast-container');
        if (tc) tc.innerHTML = '';

        // Init players
        state.players = [];
        for (let i = 0; i < 4; i++) {
            state.players.push({ hand: [], discards: [], melds: [], flowers: [] });
            state.players[i].guoShui = false; // Init Guo Shui
        }

        // Bind Self-Draw Hu Button
        const selfHuBtn = document.getElementById('hu-self-btn');
        if (selfHuBtn) {
            selfHuBtn.onclick = () => {
                const hand = state.players[0].hand;
                const winningTile = state.lastDrawnTile || hand[hand.length - 1];
                declareWin(0, 0, true, null, winningTile);
            };
        }

        // Init Stats
        state.playerStats = {
            totalThinkTime: 0,
            moveCount: 0,
            currentTurnStart: 0
        };
        updateStatsDisplay();

        // Generate & shuffle
        state.deck = generateFullDeck();
        shuffle(state.deck);
        initWallState();

        updateWindDisplay();
        renderCenterDiscards();
        renderAll();
        updateInfoPanel();

        // Initialize Audio
        if (window.AudioManager) AudioManager.init();

        // Step 1: Roll 3 dice with animation & education
        await rollThreeDice();

        // Step 2: Deal 4×4 rounds
        await dealSequence();

        // Step 3: Replace flowers
        await replaceAllFlowers();

        // Sort user hand
        state.players[0].hand = sortTiles(state.players[0].hand);

        state.dealing = false;
        state.active = true;
        state.currentPlayer = state.dealer;

        renderAll();
        renderWall();
        updateInfoPanel();

        if (autoRestart) {
            await showToast(`新局開始！莊家：${PLAYER_NAMES[state.dealer]}${state.lianZhuang ? `（連${state.lianZhuang}）` : ''}`, 2000);
        } else if (state.tutorialMode) {
            await showToast('準備完成！莊家先摸第 17 張再打牌，之後逆時針輪流「摸一張、打一張」', 2800 * state.speedMultiplier);
        } else {
            await showToast('抓牌完成！遊戲開始', 1500 * state.speedMultiplier);
        }

        // Dealer's first draw
        if (state.dealer === 0) {
            enableUserDraw();
        } else {
            setTimeout(() => aiTurn(state.dealer), 800);
        }
    }

    // --- 3 Dice Rolling ---
    async function rollThreeDice() {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        const d3 = Math.floor(Math.random() * 6) + 1;
        state.diceResult = [d1, d2, d3];
        const total = d1 + d2 + d3;
        const sm = state.speedMultiplier;

        const diceArea = document.getElementById('dice-display');
        if (diceArea) {
            diceArea.innerHTML = `
                <span class="dice">${getDiceEmoji(d1)}</span>
                <span class="dice">${getDiceEmoji(d2)}</span>
                <span class="dice">${getDiceEmoji(d3)}</span>
            `;
            diceArea.classList.add('dice-rolling');
        }

        await showToast(`莊家 ${PLAYER_NAMES[state.dealer]} 擲三顆骰子...`, 1200 * sm);

        if (diceArea) diceArea.classList.remove('dice-rolling');
        await tsleep(300);

        // 由莊家算 1，逆時針（莊家 -> 下家 -> 對家 -> 上家）數到骰子總點數
        const wallOwner = (state.dealer + (total - 1)) % 4;
        const wallOwnerName = PLAYER_NAMES[wallOwner];
        const countPath = [];
        for (let k = 0; k < Math.min(total, 4); k++) countPath.push(PLAYER_NAMES[(state.dealer + k) % 4]);
        const ownerStart = PLAYER_WALL_START[wallOwner];
        const skipped = new Set();
        for (let k = 0; k < total; k++) skipped.add((ownerStart + k) % TOTAL_STACKS);
        const startStack = (ownerStart + total) % TOTAL_STACKS;

        if (state.tutorialMode) {
            await showToastSequence([
                { text: `骰出 ${getDiceEmoji(d1)} ${getDiceEmoji(d2)} ${getDiceEmoji(d3)}，合計 <strong>${total}</strong> 點`, duration: 2000 * sm },
                { text: `第一步：從莊家算 1，<strong>逆時針</strong>數座位（${countPath.join(' → ')}${total > 4 ? ' → 繼續繞圈' : ''}），數到 ${total} 停在 <strong>${wallOwnerName}</strong>`, duration: 3600 * sm },
            ]);
            state.wallMarks = { side: wallOwner };
            renderWall();
            await tsleep(1200 * sm);
            state.wallMarks = { side: wallOwner, counted: skipped };
            renderWall();
            await showToast(`第二步：在 ${wallOwnerName} 面前的牌牆，從他的<strong>右手邊</strong>數 ${total} 墩（紅框）先留著當「牌尾」`, 3600 * sm);
            state.wallMarks = { side: wallOwner, counted: skipped, start: startStack };
            renderWall();
            await showToast(`第三步：從第 <strong>${total + 1}</strong> 墩（綠框）開始，往<strong>順時針</strong>方向抓牌`, 3000 * sm);
            clearWallHighlights();
        } else {
            await showToast(`${getDiceEmoji(d1)}${getDiceEmoji(d2)}${getDiceEmoji(d3)} = ${total}：從 ${wallOwnerName} 的牌牆右數 ${total} 墩後開抓`, 1800 * sm);
        }

        if (diceArea) {
            await tsleep(400);
            diceArea.innerHTML = '';
        }

        setWallDrawStart();
        state.wallMarks = { start: startStack };
        renderWall();
    }

    function clearWallHighlights() {
        document.querySelectorAll('.wall-highlight').forEach(el => el.classList.remove('wall-highlight'));
    }

    function getDiceEmoji(n) {
        return ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n];
    }

    // --- Deal Sequence ---
    // 抓牌：從莊家開始，逆時針輪流（莊家 -> 下家 -> 對家 -> 上家），每人每次拿 2 墩 = 4 張，共 4 輪 = 16 張
    async function dealSequence() {
        const sm = state.speedMultiplier;
        const tut = state.tutorialMode;

        if (tut) {
            await showToast('開始抓牌：莊家先拿，接著<strong>逆時針</strong>輪流；每人每次拿 <strong>2 墩（4 張）</strong>，共 4 輪', 3000 * sm);
        }

        for (let round = 0; round < 4; round++) {
            for (let k = 0; k < 4; k++) {
                const playerId = (state.dealer + k) % 4;
                const tiles = [];
                for (let n = 0; n < 4; n++) {
                    const t = takeFromWall('normal');
                    if (t) tiles.push(t);
                }
                state.players[playerId].hand.push(...tiles);
                if (playerId === 0) state.players[0].hand = sortTiles(state.players[0].hand);

                updateTurnIndicator(playerId);
                updateInfoPanel(`抓牌 第 ${round + 1}/4 輪：${PLAYER_NAMES[playerId]} 拿 2 墩（手牌 ${state.players[playerId].hand.length} 張）`);
                state.wallMarks = null;
                renderAll();
                renderWall();

                // 教學模式第一輪放慢，讓玩家看清楚順序
                const delay = tut ? (round === 0 ? 1100 : 380) : 140;
                await sleep(delay * sm);
            }
            if (tut || round === 3) {
                await showToast(`第 ${round + 1} 輪抓完，每人 ${(round + 1) * 4} 張`, (tut ? 1100 : 700) * sm);
            }
        }

        state.players[0].hand = sortTiles(state.players[0].hand);
        renderAll();
        if (tut) {
            await showToast(`16 張抓完。莊家 ${PLAYER_NAMES[state.dealer]} 等一下先摸第 17 張，再打出第一張牌`, 2600 * sm);
        }
        await tsleep(300);
    }

    // --- Flower Replacement ---
    // 補花：從莊家開始逆時針輪流，把花牌亮出來，從「牌尾」補回同樣張數；補到花再繼續補
    async function replaceAllFlowers() {
        const sm = state.speedMultiplier;
        let anyReplaced = true;
        let maxIter = 20;
        let isFirst = true;

        while (anyReplaced && maxIter > 0) {
            anyReplaced = false;
            maxIter--;

            for (let k = 0; k < 4; k++) {
                const p = (state.dealer + k) % 4;
                const player = state.players[p];
                const flowerIndices = [];
                player.hand.forEach((tile, idx) => {
                    if (isFlower(tile)) flowerIndices.push(idx);
                });

                if (flowerIndices.length > 0) {
                    if (isFirst && state.tutorialMode) {
                        isFirst = false;
                        await showToast('補花：花牌不能組牌，要亮在桌上，再從<strong>牌尾（粉紅框）</strong>補回一樣的張數。順序也是從莊家開始逆時針', 3400 * sm);
                    }

                    anyReplaced = true;
                    flowerIndices.sort((a, b) => b - a);
                    const flowerNames = flowerIndices.map(idx => getTileDisplay(player.hand[idx])).join(' ');
                    flowerIndices.forEach(idx => {
                        const flower = player.hand.splice(idx, 1)[0];
                        player.flowers.push(flower);
                    });
                    for (let f = 0; f < flowerIndices.length; f++) {
                        const t = takeFromWall('replacement');
                        if (t) player.hand.push(t);
                    }

                    if (p === 0) state.players[0].hand = sortTiles(state.players[0].hand);
                    renderAll();
                    renderWall();
                    await showToast(`${PLAYER_NAMES[p]} 補花：${flowerNames}（從牌尾補 ${flowerIndices.length} 張）`, 1500 * sm);
                }
            }
        }
        updateTileCount();
    }

    // ===== WALL DISPLAY & DRAW =====

    // 牌牆是唯一的牌源：4 邊 x 18 墩 = 72 墩，每墩上下 2 張，共 144 張
    // 墩的編號沿桌面「順時針」排列（畫面由上往下看）：
    //   上方 0..17（左到右）、右方 18..35（上到下）、下方 36..53（右到左）、左方 54..71（下到上）
    // 抓牌、摸牌：從牌頭往順時針方向取；補花：從牌尾往逆時針方向取
    const STACKS_PER_SIDE = 18;
    const TOTAL_STACKS = STACKS_PER_SIDE * 4; // 72 stacks = 144 tiles
    const RESERVED_TILES = 16;                 // 留海底 16 張（8 墩）不摸，摸到只剩 16 張即流局
    const PLAYER_WALL_START = [36, 18, 0, 54]; // 各座位牌牆「自己右手邊第一墩」的編號

    function initWallState() {
        // 洗好的牌依序疊成 72 墩：每墩 [上層, 下層]
        state.wallTiles = [];
        for (let i = 0; i < TOTAL_STACKS; i++) {
            state.wallTiles.push([state.deck[i * 2], state.deck[i * 2 + 1]]);
        }
        state.wallStacks = new Array(TOTAL_STACKS).fill(2);
        state.wallHeadPtr = 0;
        state.wallTailPtr = TOTAL_STACKS - 1;
        state.dealStartIdx = -1;
        state.recentTaken = [];
        state.wallMarks = null;
    }

    function wallRemaining() {
        return state.wallStacks ? state.wallStacks.reduce((s, c) => s + c, 0) : 0;
    }

    // 牌牆還能正常摸的張數（扣掉海底 16 張）
    function wallDrawable() {
        return Math.max(0, wallRemaining() - RESERVED_TILES);
    }

    function setWallDrawStart() {
        const total = state.diceResult[0] + state.diceResult[1] + state.diceResult[2];
        const wallOwner = (state.dealer + (total - 1)) % 4;
        const startIdx = PLAYER_WALL_START[wallOwner];
        // 從牌牆主人的右手邊數過 total 墩，從第 total+1 墩開始抓（順時針）
        state.wallHeadPtr = (startIdx + total) % TOTAL_STACKS;
        state.dealStartIdx = state.wallHeadPtr;
        // 被跳過的那幾墩就是牌尾，補花從緊鄰開口的那一墩開始往回拿
        state.wallTailPtr = (state.wallHeadPtr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
    }

    // 從牌牆取一張牌並回傳。mode: 'normal' 牌頭（順時針）、'replacement' 牌尾（補花）
    function takeFromWall(mode = 'normal') {
        const forward = mode === 'normal';
        let ptr = forward ? state.wallHeadPtr : state.wallTailPtr;
        for (let attempts = 0; attempts < TOTAL_STACKS; attempts++) {
            const count = state.wallStacks[ptr];
            if (count > 0) {
                // 上層先拿，再拿下層
                const tile = state.wallTiles[ptr][2 - count];
                state.wallStacks[ptr] = count - 1;
                state.recentTaken.push({ idx: ptr, t: Date.now() });
                const next = forward ? (ptr + 1) % TOTAL_STACKS : (ptr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
                if (forward) state.wallHeadPtr = state.wallStacks[ptr] === 0 ? next : ptr;
                else state.wallTailPtr = state.wallStacks[ptr] === 0 ? next : ptr;
                return tile;
            }
            ptr = forward ? (ptr + 1) % TOTAL_STACKS : (ptr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
        }
        return null;
    }

    // 海底：從牌尾往回數 16 張所在的墩（正常摸牌摸不到）
    function getReservedStacks() {
        const reserved = new Set();
        if (!state.wallStacks || state.dealStartIdx < 0) return reserved;
        let acc = 0;
        let ptr = state.wallTailPtr;
        for (let i = 0; i < TOTAL_STACKS && acc < RESERVED_TILES; i++) {
            const c = state.wallStacks[ptr];
            if (c > 0) {
                reserved.add(ptr);
                acc += c;
            }
            ptr = (ptr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
        }
        return reserved;
    }

    function renderWall() {
        const wallEl = document.getElementById('tile-wall');
        if (!wallEl) return;

        const remaining = wallRemaining();
        wallEl.innerHTML = '';

        if (remaining === 0) {
            wallEl.innerHTML = '<div class="wall-empty">牌墩已空</div>';
            wallEl.classList.remove('wall-clickable');
            return;
        }

        const now = Date.now();
        state.recentTaken = (state.recentTaken || []).filter(r => now - r.t < 1200);
        const justTaken = new Set(state.recentTaken.map(r => r.idx));
        const reserved = getReservedStacks();
        const marks = state.wallMarks || {};
        const started = state.dealStartIdx >= 0;

        const sides = [
            { name: 'wall-side-top', start: 0 },
            { name: 'wall-side-right', start: 18 },
            { name: 'wall-side-bottom', start: 36 },
            { name: 'wall-side-left', start: 54 }
        ];

        sides.forEach(sideDef => {
            const side = document.createElement('div');
            side.className = `wall-side ${sideDef.name}`;
            // 教學：骰子數到的那一家，他面前的牌牆整排發光
            if (marks.side !== undefined && PLAYER_WALL_START[marks.side] === sideDef.start) {
                side.classList.add('wall-highlight');
            }

            for (let i = 0; i < STACKS_PER_SIDE; i++) {
                const stackIdx = sideDef.start + i;
                const count = state.wallStacks ? state.wallStacks[stackIdx] : 2;
                const stack = document.createElement('div');
                stack.className = 'wall-brick';
                stack.dataset.idx = stackIdx;

                if (count === 0) {
                    stack.classList.add('empty');
                } else if (count >= 2) {
                    stack.classList.add('double');
                }
                if (count > 0 && started && reserved.has(stackIdx)) stack.classList.add('reserved');
                if (justTaken.has(stackIdx)) stack.classList.add('just-taken');
                if (marks.counted && marks.counted.has(stackIdx)) stack.classList.add('counted');
                if (marks.start === stackIdx) stack.classList.add('start-mark');

                // 牌頭（下一張正常摸牌）與牌尾（下一張補花）
                if (started && count > 0 && stackIdx === state.wallHeadPtr) {
                    stack.classList.add('draw-next');
                } else if (started && count > 0 && stackIdx === state.wallTailPtr) {
                    stack.classList.add('draw-tail');
                }

                stack.onclick = (e) => {
                    e.stopPropagation();
                    if (state.userCanDraw) {
                        // 手機橫向牌墩太小點不準，點哪一墩都從牌頭摸
                        if (stackIdx === state.wallHeadPtr || isCompactLayout()) {
                            wallClickDraw();
                        } else {
                            showToast('摸牌要從<strong>亮黃色</strong>那一墩拿：牌頭沿順時針方向前進', 1800);
                        }
                    }
                };

                side.appendChild(stack);
            }
            wallEl.appendChild(side);
        });

        if (state.userCanDraw) {
            wallEl.classList.add('wall-clickable');
        } else {
            wallEl.classList.remove('wall-clickable');
        }

        // 剛被拿走的墩閃一下後，再重畫一次把閃光收掉
        if (justTaken.size > 0) {
            clearTimeout(state.wallFlashTimer);
            state.wallFlashTimer = setTimeout(renderWall, 1250);
        }
    }

    function enableUserDraw() {
        state.userCanDraw = true;
        state.currentPlayer = 0;
        updateTurnIndicator(0);
        startTurnTimer(); // Start thinking timer
        renderWall();
        updateInfoPanel(isCompactLayout()
            ? '輪到您：點牌桌摸牌'
            : '輪到您：點亮黃色的牌墩摸牌');
        // 教學模式前幾手提示怎麼摸牌，之後就不再干擾
        state.drawHints = (state.drawHints || 0) + 1;
        if (state.tutorialMode && state.drawHints <= 3) {
            showToast('輪到您摸牌：點牌桌上<strong>亮黃色</strong>的那一墩（牌頭），摸牌永遠沿順時針前進', 2600);
        }
    }

    function wallClickDraw() {
        if (!state.active || !state.userCanDraw) return;
        state.userCanDraw = false;
        renderWall();
        drawTileForPlayer(0);
    }

    function isCompactLayout() {
        return document.body.classList.contains('compact-landscape');
    }

    // 手機橫向：點牌桌任何位置都算摸牌（從牌頭）
    document.addEventListener('click', (e) => {
        if (!isCompactLayout() || !state.userCanDraw) return;
        if (e.target.closest && e.target.closest('.mahjong-table-container')) wallClickDraw();
    });

    // --- Drawing (流局/臭莊) ---
    function handleDraw() {
        if (!state.active) return; // Prevent double-trigger
        state.lianZhuang++;
        state.active = false;
        showSelfDrawHuButton(false);
        hideActionBar();

        const dealerName = PLAYER_NAMES[state.dealer];
        const lz = state.lianZhuang;
        showToast(`流局：牌牆只剩海底 ${RESERVED_TILES} 張，沒人胡牌。莊家 ${dealerName} 連莊（連${lz}拉${lz}）`, 4000);

        // Auto start next round after delay
        setTimeout(() => {
            showToast(`下一局開始，莊家：${dealerName}（連${lz}）`, 2500);
            setTimeout(() => {
                startGame(true); // autoRestart = true, skip modal
            }, 2500);
        }, 4500);
    }

    // fromTail=true 表示這是補花，從牌尾拿
    function drawTileForPlayer(playerId, fromTail) {
        if (!state.active || wallDrawable() <= 0) {
            handleDraw();
            return;
        }

        // Play Sound
        if (window.AudioManager) AudioManager.playClack();

        const tile = takeFromWall(fromTail ? 'replacement' : 'normal');
        state.players[playerId].hand.push(tile);
        state.lastDrawnTile = tile;
        updateTileCount();
        renderWall();

        // Flower auto-replace
        if (isFlower(tile)) {
            const player = state.players[playerId];
            const idx = player.hand.indexOf(tile);
            player.hand.splice(idx, 1);
            player.flowers.push(tile);

            if (playerId === 0) {
                showToast(`摸到花牌 ${getTileDisplay(tile)}：亮出來，從<strong>牌尾</strong>補一張`, 1600);
                renderAll();
            }
            // 補花：從牌尾再摸一張
            setTimeout(() => drawTileForPlayer(playerId, true), 600);
            return;
        }

        // Check User Self-Draw (Tsumo)
        if (playerId === 0) {
            if (MahjongAlgorithm.canHu(state.players[playerId].hand)) {
                showSelfDrawHuButton(true);
                showToast('自摸！按「胡」看台數怎麼算', 3000);
            } else {
                showSelfDrawHuButton(false);
            }

            state.currentPlayer = 0;
            renderUserHand(true); // Enable interaction (justDrew=true)

            showDrawnTilePreview(tile);
            startTurnTimer();

            updateInfoPanel('您的回合：請打出一張牌');
        }
    }

    // --- Discarding ---
    function userDiscard(index) {
        if (state.currentPlayer !== 0 || state.waitingForAction || state.userCanDraw) return;
        const hand = state.players[0].hand;
        // Must have drawn a tile (hand should have one more than normal)
        if (hand.length < 1) return;

        const tile = hand.splice(index, 1)[0];
        state.players[0].hand = sortTiles(state.players[0].hand);
        state.lastDiscard = tile;
        state.lastDiscardPlayer = 0;

        stopTurnTimer(); // End thinking timer (Discarded)

        addToCenterPile(tile, 0);
        renderAll();
        showSelfDrawHuButton(false);

        setTimeout(() => nextTurn(), 600);
    }

    function nextTurn() {
        if (!state.active || state.waitingForAction) return;
        state.currentPlayer = (state.currentPlayer + 1) % 4;
        // Reset Guo Shui on turn start
        state.players[state.currentPlayer].guoShui = false;

        updateInfoPanel(null, state.currentPlayer);
        updateTurnIndicator(state.currentPlayer);

        if (state.currentPlayer === 0) {
            // 牌牆只剩海底就直接流局，不要叫玩家去摸一墩摸不到的牌
            if (wallDrawable() <= 0) {
                handleDraw();
                return;
            }
            enableUserDraw();
        } else {
            setTimeout(() => aiTurn(state.currentPlayer), state.aiSpeed * 0.3);
        }
    }

    // fromTail=true 表示這是補花，從牌尾拿
    function aiTurn(playerId, fromTail) {
        try {
            if (!state.active || state.waitingForAction) return;
            updateTurnIndicator(playerId);

            if (wallDrawable() <= 0) {
                handleDraw();
                return;
            }

            // Play Sound
            if (window.AudioManager) AudioManager.playClack();

            const tile = takeFromWall(fromTail ? 'replacement' : 'normal');
            state.players[playerId].hand.push(tile);
            state.lastDrawnTile = tile;
            updateTileCount();
            renderOpponentBacks();
            renderWall();

            // 摸到花：先亮花、從牌尾補，再判斷胡牌
            if (isFlower(tile)) {
                const player = state.players[playerId];
                const idx = player.hand.indexOf(tile);
                player.hand.splice(idx, 1);
                player.flowers.push(tile);
                renderAll();
                updateInfoPanel(`${PLAYER_NAMES[playerId]} 摸到花，從牌尾補花`);
                setTimeout(() => aiTurn(playerId, true), 500);
                return;
            }

            // Check AI Self-Draw (Tsumo) - Safety Check
            let canHu = false;
            try {
                canHu = MahjongAlgorithm.canHu(state.players[playerId].hand);
            } catch (e) {
                console.error('AI Check Hu Error:', e);
            }

            if (canHu) {
                // AI Wins! Details calculated in modal.
                declareWin(playerId, 1, true, null, tile);
                return;
            }

            updateInfoPanel(`${PLAYER_NAMES[playerId]} 思考中...`);

            setTimeout(() => {
                try {
                    if (!state.active || state.waitingForAction) return;
                    const hand = state.players[playerId].hand;
                    let discardIdx = -1;

                    try {
                        discardIdx = aiChooseDiscard(hand);
                    } catch (err) {
                        console.error("AI Choose Discard Error:", err);
                        discardIdx = hand.length - 1; // Fallback: Discard drawn tile
                    }

                    // Safety check
                    if (discardIdx < 0 || discardIdx >= hand.length) discardIdx = hand.length - 1;

                    const discardedTile = hand.splice(discardIdx, 1)[0];
                    state.lastDiscard = discardedTile;
                    state.lastDiscardPlayer = playerId;

                    // Render discard
                    addToCenterPile(discardedTile, playerId);
                    renderAll();
                    renderWall();
                    updateInfoPanel(`${PLAYER_NAMES[playerId]} 打出 ${getTileDisplay(discardedTile)}`);

                    // Check actions for ALL players (Hu > Pong/Kong > Chi)
                    if (state.active) {
                        const actionFound = checkDiscardActions(discardedTile, playerId);
                        if (actionFound) return;
                    }

                    setTimeout(() => nextTurn(), 500);
                } catch (innerErr) {
                    console.error("AI Turn Inner Error:", innerErr);
                    // Attempt to recover
                    setTimeout(() => nextTurn(), 1000);
                }
            }, state.aiSpeed * 0.7);
        } catch (outerErr) {
            console.error("AI Turn Outer Error:", outerErr);
            setTimeout(() => nextTurn(), 1000);
        }
    }

    // Check actions after a discard (Priority: Hu > Pong > Chi)
    function checkDiscardActions(tile, discarderId) {
        // 1. Check HU (Win) for all other players (counter-clockwise from discarder)
        for (let i = 1; i <= 3; i++) {
            const pId = (discarderId + i) % 4;
            try {
                if (MahjongAlgorithm.canHu(state.players[pId].hand, tile)) {
                    if (state.players[pId].guoShui) {
                        if (pId === 0) showToast('過水中，無法胡牌', 1500);
                        continue;
                    }
                    if (pId === 0) {
                        const chiResult = canChi(state.players[0].hand, tile, discarderId, 0);
                        const pongResult = canPong(state.players[0].hand, tile);
                        state.waitingForAction = true;
                        state.huPossible = true;
                        showActionBar(tile, discarderId, chiResult, pongResult, true);
                        showToast('可以胡牌！', 2000);
                        return true;
                    } else {
                        declareWin(pId, 1, false, discarderId, tile);
                        return true;
                    }
                }
            } catch (e) {
                console.error(`Check Hu Error for player ${pId}:`, e);
            }
        }

        // 2. Check PONG for all players (counter-clockwise, pong has priority over chi)
        for (let i = 1; i <= 3; i++) {
            const pId = (discarderId + i) % 4;
            if (pId === discarderId) continue;

            const pongResult = canPong(state.players[pId].hand, tile);
            if (pongResult.valid) {
                if (pId === 0) {
                    // User can pong - also check chi for the action bar
                    const chiResult = canChi(state.players[0].hand, tile, discarderId, 0);
                    state.waitingForAction = true;
                    showActionBar(tile, discarderId, chiResult, pongResult, false);
                    return true;
                } else {
                    // AI pong
                    if (aiShouldPong(state.players[pId].hand, tile)) {
                        state.waitingForAction = true;
                        setTimeout(() => executeAIPong(pId, tile), state.aiSpeed * 0.3);
                        return true;
                    }
                }
            }
        }

        // 3. Check CHI - only the next player (下家) can chi
        const chiPlayer = (discarderId + 1) % 4;
        if (chiPlayer !== discarderId) {
            const chiResult = canChi(state.players[chiPlayer].hand, tile, discarderId, chiPlayer);
            if (chiResult.valid) {
                if (chiPlayer === 0) {
                    // User can chi
                    const pongResult = canPong(state.players[0].hand, tile);
                    state.waitingForAction = true;
                    showActionBar(tile, discarderId, chiResult, pongResult, false);
                    return true;
                } else {
                    // AI chi
                    if (aiShouldChi(state.players[chiPlayer].hand, chiResult.combos[0])) {
                        state.waitingForAction = true;
                        setTimeout(() => executeAIChi(chiPlayer, chiResult.combos[0], tile), state.aiSpeed * 0.3);
                        return true;
                    }
                }
            }
        }

        // 4. If user is next and no action possible from 上家, show debug hint
        if (discarderId !== 0 && (discarderId + 1) % 4 === 0) {
            // User's 上家 just discarded but user can't chi
            const suit = getSuit(tile);
            if (!suit) {
                // Honor tile - no chi possible, that's expected
            }
        }

        return false;
    }

    // --- Discard Rivers (per-player) ---
    function addToCenterPile(tile, playerId) {
        // Play Sound on Discard
        if (window.AudioManager) AudioManager.playClack();

        // Add to per-player discard river
        if (!state.playerDiscards) state.playerDiscards = [[], [], [], []];
        state.playerDiscards[playerId].push({ tile, id: Date.now() + Math.random() });

        // Keep centerDiscards for chi/pong removal compatibility
        state.centerDiscards.push({ tile, playerId, id: Date.now() });
        renderDiscardRivers();
    }

    function renderDiscardRivers() {
        for (let p = 0; p < 4; p++) {
            const river = document.getElementById(`river-${p}`);
            if (!river) continue;
            river.innerHTML = '';
            const discards = state.playerDiscards ? state.playerDiscards[p] : [];
            discards.forEach((d, idx) => {
                const el = createTileElement(d.tile);
                el.className = 'tile river-tile';
                // Highlight last discarded tile
                if (p === state.lastDiscardPlayer && idx === discards.length - 1) {
                    el.classList.add('last-discard');
                }
                el.title = `${PLAYER_NAMES[p]} 打出`;
                river.appendChild(el);
            });
        }
    }

    // Keep old name as alias for any remaining calls
    function renderCenterDiscards() {
        renderDiscardRivers();
    }

    // --- Chi/Pong ---
    function executeChi(combo) {
        stopTurnTimer(); // Decision made
        const hand = state.players[0].hand;
        const discardedTile = state.lastDiscard;
        combo.filter(t => t !== discardedTile).forEach(t => {
            const idx = hand.indexOf(t);
            if (idx !== -1) hand.splice(idx, 1);
        });
        state.players[0].melds.push({ type: 'chi', tiles: combo });
        if (state.centerDiscards.length > 0) state.centerDiscards.pop();
        if (state.playerDiscards && state.playerDiscards[state.lastDiscardPlayer]) {
            state.playerDiscards[state.lastDiscardPlayer].pop();
        }

        state.players[0].hand = sortTiles(state.players[0].hand);
        state.waitingForAction = false;
        state.currentPlayer = 0;
        state.players[0].guoShui = false; // Reset on action
        state.userCanDraw = false;

        hideActionBar();
        renderAll();
        renderCenterDiscards();
        updateInfoPanel('吃牌成功！請打出一張牌');
        showToast('✅ 吃牌成功！請點擊手牌打出一張。', 2000);
        startTurnTimer(); // Start thinking for discard
    }

    function executePong() {
        stopTurnTimer(); // Decision made
        const hand = state.players[0].hand;
        const tile = state.lastDiscard;
        let removed = 0;
        for (let i = hand.length - 1; i >= 0 && removed < 2; i--) {
            if (hand[i] === tile) { hand.splice(i, 1); removed++; }
        }
        state.players[0].melds.push({ type: 'pong', tiles: [tile, tile, tile] });
        if (state.centerDiscards.length > 0) state.centerDiscards.pop();
        if (state.playerDiscards && state.playerDiscards[state.lastDiscardPlayer]) {
            state.playerDiscards[state.lastDiscardPlayer].pop();
        }

        state.players[0].hand = sortTiles(state.players[0].hand);
        state.waitingForAction = false;
        state.currentPlayer = 0;
        state.players[0].guoShui = false; // Reset on action
        state.userCanDraw = false;

        hideActionBar();
        renderAll();
        renderCenterDiscards();
        updateInfoPanel('碰牌成功！請打出一張牌');
        showToast('✅ 碰牌成功！請點擊手牌打出一張。', 2000);
        startTurnTimer(); // Start thinking for discard
    }

    function passAction() {
        if (state.huPossible) {
            state.players[0].guoShui = true;
            showToast('過水：放棄這張不胡，在你下次摸牌前都不能再胡別人的牌', 2400);
        }
        state.huPossible = false;
        stopTurnTimer(); // Decision made (Pass)
        state.waitingForAction = false;
        hideActionBar();
        setTimeout(() => nextTurn(), 300);
    }

    // ===== RENDERING =====

    function renderAll() {
        renderUserHand(false);
        renderMelds();
        renderFlowers();
        renderOpponentBacks();
        renderOpponentFlowers();
        renderOpponentMelds();
        updateTileCount();
        updateOpponentOverlays();
    }

    // Update flat opponent info overlays (outside 3D)
    function updateOpponentOverlays() {
        if (!document.body.classList.contains('fullscreen-game')) return;
        [1, 2, 3].forEach(pId => {
            const windEl = document.getElementById(`opp-wind-${pId}`);
            const tilesEl = document.getElementById(`opp-tiles-${pId}`);
            const meldsEl = document.getElementById(`opp-melds-${pId}`);
            if (!windEl || !state.players[pId]) return;

            // Wind badge
            const seatWind = (state.dealer !== undefined)
                ? WIND_CHARS[(pId - state.dealer + 4) % 4]
                : '';
            windEl.textContent = seatWind;

            // Tile count
            const handCount = state.players[pId].hand ? state.players[pId].hand.length : 0;
            tilesEl.textContent = `${handCount}張`;

            // Melds summary
            const melds = state.players[pId].melds || [];
            if (melds.length > 0) {
                meldsEl.textContent = melds.map(m => m.type === 'chi' ? '吃' : m.type === 'pong' ? '碰' : '槓').join(' ');
            } else {
                meldsEl.textContent = '';
            }
        });
    }

    function renderUserHand(justDrew) {
        const display = document.getElementById('hand-display');
        if (!display) return;
        display.innerHTML = '';
        const hand = state.players[0].hand;

        if (hand.length === 0 && state.players[0].melds.length === 0 && !state.dealing) {
            display.innerHTML = '<div class="empty-slot-placeholder">按「開始新局」開始打牌！</div>';
            return;
        }

        hand.forEach((id, idx) => {
            const tile = createTileElement(id);
            tile.classList.add('user-tile');
            tile.addEventListener('click', () => userDiscard(idx));
            if (justDrew && idx === hand.length - 1) {
                tile.classList.add('drawn-tile');
            }
            display.appendChild(tile);
        });
    }

    function renderMelds() {
        const display = document.getElementById('hand-display');
        if (!display) return;
        state.players[0].melds.forEach(meld => {
            const meldDiv = document.createElement('div');
            meldDiv.className = 'meld-group';
            meld.tiles.forEach(t => {
                const tile = createTileElement(t);
                tile.classList.add('meld-tile');
                meldDiv.appendChild(tile);
            });
            display.appendChild(meldDiv);
        });
    }

    function renderFlowers() {
        const area = document.getElementById('flower-display');
        if (!area) return;
        area.innerHTML = '';
        state.players[0].flowers.forEach(f => {
            const tile = createTileElement(f);
            area.appendChild(tile);
        });
    }

    function renderOpponentBacks() {
        const ids = ['', 'hand-right', 'hand-top', 'hand-left'];
        for (let p = 1; p <= 3; p++) {
            const container = document.getElementById(ids[p]);
            if (!container) continue;
            container.innerHTML = '';
            if (!state.players[p]) continue;
            const count = state.players[p].hand.length;
            const isVertical = p === 1 || p === 3;
            for (let i = 0; i < count; i++) {
                const back = document.createElement('div');
                back.className = isVertical ? 'tile-back-v' : 'tile-back-h';
                container.appendChild(back);
            }
        }
    }

    function renderOpponentFlowers() {
        // Render flowers for each opponent in their flower container
        const flowerIds = ['', 'flowers-right', 'flowers-top', 'flowers-left'];
        for (let p = 1; p <= 3; p++) {
            const container = document.getElementById(flowerIds[p]);
            if (!container) continue;
            container.innerHTML = '';
            if (!state.players[p]) continue;
            const flowers = state.players[p].flowers;
            if (flowers.length > 0) {
                flowers.forEach(f => {
                    const tile = createTileElement(f);
                    tile.classList.add('opponent-flower-tile');
                    container.appendChild(tile);
                });
            }
        }
    }

    function renderOpponentMelds() {
        const meldIds = ['', 'melds-right', 'melds-top', 'melds-left'];
        for (let p = 1; p <= 3; p++) {
            const container = document.getElementById(meldIds[p]);
            if (!container) continue;
            container.innerHTML = '';
            if (!state.players[p]) continue;
            const melds = state.players[p].melds;
            melds.forEach(meld => {
                const meldDiv = document.createElement('div');
                meldDiv.className = 'opponent-meld-group';
                meld.tiles.forEach(t => {
                    const tile = createTileElement(t);
                    tile.classList.add('opponent-meld-tile');
                    meldDiv.appendChild(tile);
                });
                container.appendChild(meldDiv);
            });
        }
    }

    function updateTileCount() {
        const el = document.getElementById('remain-count');
        if (el) el.textContent = wallDrawable();
    }

    // --- Info Panel (top-right) ---
    function updateInfoPanel(msg, activePlayer) {
        const turnEl = document.getElementById('turn-indicator');
        if (turnEl && msg) {
            turnEl.textContent = msg;
        } else if (turnEl && activePlayer !== undefined) {
            if (activePlayer === 0) turnEl.textContent = '您的回合';
            else turnEl.textContent = `${PLAYER_NAMES[activePlayer]} 思考中...`;
        }

        // Round display
        const roundEl = document.getElementById('round-display');
        if (roundEl) {
            roundEl.textContent = `${WIND_CHARS[state.round]}圈 第${state.handCount + 1}局`;
        }

        // Remaining tiles
        updateTileCount();
        // Update center compass panel
        updateCenterPanel();
    }

    function updateCenterPanel() {
        const roundEl = document.getElementById('center-round');
        const remainEl = document.getElementById('center-remain');
        if (roundEl) {
            roundEl.textContent = `${WIND_CHARS[state.round]}風${state.handCount + 1}局`;
        }
        if (remainEl) {
            remainEl.textContent = state.wallStacks ? wallDrawable() : '--';
        }
        updateCompassWinds();
    }

    function updateCompassWinds() {
        const winds = ['east', 'south', 'west', 'north'];
        winds.forEach(w => {
            const el = document.getElementById(`compass-${w}`);
            if (el) el.classList.remove('active');
        });
        // Map current player to their wind direction
        // Player 0=East(bottom), 1=South(right), 2=West(top), 3=North(left) relative to dealer
        const currentWind = (state.currentPlayer - state.dealer + 4) % 4;
        const windEl = document.getElementById(`compass-${winds[currentWind]}`);
        if (windEl) windEl.classList.add('active');
    }

    // --- Turn Indicator (pulse animation on active player) ---
    function updateTurnIndicator(playerId) {
        const areaClasses = ['bottom-player', 'right-player', 'top-player', 'left-player'];
        // Remove all active states
        document.querySelectorAll('.player-area').forEach(area => {
            area.classList.remove('active-player');
            const oldArrow = area.querySelector('.turn-arrow');
            if (oldArrow) oldArrow.remove();
        });
        // Apply to current player
        const targetArea = document.querySelector(`.${areaClasses[playerId]}`);
        if (targetArea) {
            targetArea.classList.add('active-player');
            const arrow = document.createElement('div');
            arrow.className = 'turn-arrow';
            arrow.textContent = '\u25BC';
            targetArea.appendChild(arrow);
        }
    }

    function updateWindDisplay() {
        for (let i = 0; i < 4; i++) {
            const windIdx = (i - state.dealer + 4) % 4;
            const el = document.getElementById(`player-wind-${i}`);
            if (el) el.textContent = WIND_CHARS[windIdx];
        }
    }

    // --- Action Bar ---
    function showActionBar(tile, discardPlayer, chiResult, pongResult, canWin = false) {
        const bar = document.getElementById('action-bar');
        const prompt = document.getElementById('action-prompt');
        const chiBtn = document.getElementById('btn-chi');
        const pongBtn = document.getElementById('btn-pong');
        const huBtn = document.getElementById('btn-hu');

        if (!bar) return;

        startTurnTimer(); // Start thinking (Reaction)

        prompt.textContent = `${PLAYER_NAMES[discardPlayer]} 打出 ${getTileDisplay(tile)}！`;
        // Reset
        chiBtn.disabled = !chiResult.valid;
        pongBtn.disabled = !pongResult.valid;
        huBtn.disabled = !canWin;

        if (canWin) {
            huBtn.classList.add('highlight-pulse');
        } else {
            huBtn.classList.remove('highlight-pulse');
        }

        // ... handlers ...
        huBtn.onclick = () => {
            // Manual/Auto Win Declaration (Ron)
            // Tile is the one being discarded by discardPlayer
            declareWin(0, 0, false, discardPlayer, tile);
        };
        chiBtn.onclick = () => {
            if (!chiResult.valid) {
                showToast('❌ 吃牌規則：只能吃上家的數字牌，手中需有兩張能組順子。字牌不能吃。', 3500);
                return;
            }
            // If multiple combos, show selector
            if (chiResult.combos.length > 1) {
                showChiComboSelector(chiResult.combos);
            } else {
                executeChi(chiResult.combos[0]);
            }
        };
        pongBtn.onclick = () => {
            if (!pongResult.valid) {
                showToast('❌ 碰牌規則：手中必須有兩張相同的牌才能碰。', 3000);
                return;
            }
            executePong();
        };
        document.getElementById('btn-pass').onclick = () => passAction();
        bar.classList.remove('hidden');
        if (typeof resizeTable === 'function') resizeTable();
    }

    function showChiComboSelector(combos) {
        const selector = document.getElementById('chi-combo-selector');
        const options = document.getElementById('chi-combo-options');
        if (!selector || !options) return;

        options.innerHTML = '';
        combos.forEach((combo, idx) => {
            const optDiv = document.createElement('div');
            optDiv.className = 'chi-combo-option';
            optDiv.title = `組合 ${idx + 1}: ${combo.map(t => getTileDisplay(t)).join(' ')}`;
            combo.forEach(t => {
                const tile = createTileElement(t);
                optDiv.appendChild(tile);
            });
            optDiv.addEventListener('click', () => {
                selector.classList.add('hidden');
                executeChi(combo);
            });
            options.appendChild(optDiv);
        });
        selector.classList.remove('hidden');
    }

    function hideActionBar() {
        const bar = document.getElementById('action-bar');
        if (bar) bar.classList.add('hidden');
        // Also hide chi combo selector
        const selector = document.getElementById('chi-combo-selector');
        if (selector) selector.classList.add('hidden');
        if (typeof resizeTable === 'function') resizeTable();
    }

    function sortUserHand() {
        if (!state.players[0]) return;
        state.players[0].hand = sortTiles(state.players[0].hand);
        renderUserHand(false);
        renderMelds();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ===== SCORING SYSTEM =====

    function updateScoreboard() {
        for (let p = 0; p < 4; p++) {
            const scoreEl = document.getElementById(`score-${p}`);
            const statEl = document.getElementById(`stat-${p}`);
            if (scoreEl) {
                const val = scoring.scores[p];
                scoreEl.textContent = (val >= 0 ? '+' : '') + val;
                scoreEl.className = 'score-value ' + (val > 0 ? 'positive' : val < 0 ? 'negative' : '');
            }
            if (statEl) {
                const s = scoring.stats[p];
                statEl.textContent = `\u80e1:${s.hu} \u81ea\u6478:${s.zimo} \u653e\u69cd:${s.fangqiang}`;
            }
        }
    }

    // --- Win Handling ---
    function declareWin(winnerId, taiCount, isZimo, loserId, winningTile) {
        if (!state.active) return; // 已結束的局不再重複結算
        // 先把牌局停住，避免結算畫面打開時電腦還在出牌
        state.active = false;
        state.waitingForAction = false;
        state.huPossible = false;
        state.userCanDraw = false;
        stopTurnTimer();
        hideActionBar();
        showSelfDrawHuButton(false);
        renderWall();

        if (!winningTile) {
            const hand = state.players[winnerId].hand;
            winningTile = isZimo ? (state.lastDrawnTile || hand[hand.length - 1]) : state.lastDiscard;
        }
        showWinModal(winnerId, isZimo, loserId, winningTile);
    }

    // 依台灣常見算法計算每位付款者要付多少
    // 一般台：每位付款者都算；莊家台：只有「莊家胡」或「付款的人是莊家」才加
    function computePayments(winnerId, isZimo, loserId, result) {
        const { base, perTai } = scoring.settings;
        const payers = isZimo ? [0, 1, 2, 3].filter(p => p !== winnerId) : [loserId];
        return payers.map(p => {
            const withDealer = winnerId === state.dealer || p === state.dealer;
            const tai = result.total + (withDealer ? result.dealerTai : 0);
            return { payer: p, tai, withDealer, amount: base + tai * perTai };
        });
    }

    function showWinModal(winnerId, isZimo, loserId, winningTile) {
        const modal = document.getElementById('win-modal');
        if (!modal) return;

        const player = state.players[winnerId];
        // 胡別人打的牌時，那張牌還不在手上，算台前要先放進來
        const scoringHand = isZimo ? [...player.hand] : [...player.hand, winningTile];
        const context = {
            roundWind: state.roundWind || 'dong',
            seatWind: WIND_IDS[(winnerId - state.dealer + 4) % 4],
            isSelfDraw: isZimo,
            isLastTile: wallDrawable() <= 0,       // 海底撈月 / 河底撈魚
            lianZhuang: state.lianZhuang,
            winningTile: winningTile || null
        };

        const result = MahjongAlgorithm.calculateScore(scoringHand, player.melds, player.flowers, context);
        const payments = computePayments(winnerId, isZimo, loserId, result);
        const dealerInvolved = payments.some(p => p.withDealer);
        const { base, perTai } = scoring.settings;

        // 標題
        const titleEl = document.getElementById('win-title');
        if (titleEl) titleEl.textContent = isZimo ? '自摸！' : '胡牌！';
        const seatName = WIND_CHARS[(winnerId - state.dealer + 4) % 4];
        document.getElementById('win-winner').textContent = isZimo
            ? `${PLAYER_NAMES[winnerId]}（${seatName}家）自摸`
            : `${PLAYER_NAMES[winnerId]}（${seatName}家）胡 ${PLAYER_NAMES[loserId]} 打的牌`;

        // 手牌：明牌組 + 立牌 + 胡的那張（分開標示）
        const handDiv = document.getElementById('win-hand');
        handDiv.innerHTML = '';
        player.melds.forEach(m => {
            const grp = document.createElement('div');
            grp.className = 'meld-group win-meld';
            m.tiles.forEach(t => grp.appendChild(createTileElement(t)));
            handDiv.appendChild(grp);
        });
        const standing = [...scoringHand];
        const wIdx = standing.lastIndexOf(winningTile);
        if (wIdx >= 0) standing.splice(wIdx, 1);
        sortTiles(standing).forEach(t => handDiv.appendChild(createTileElement(t)));
        if (winningTile) {
            const winWrap = document.createElement('div');
            winWrap.className = 'win-tile-wrap';
            const el = createTileElement(winningTile);
            el.classList.add('win-tile');
            winWrap.appendChild(el);
            const label = document.createElement('span');
            label.className = 'win-tile-label';
            label.textContent = isZimo ? '自摸' : '胡';
            winWrap.appendChild(label);
            handDiv.appendChild(winWrap);
        }
        if (player.flowers.length > 0) {
            const fl = document.createElement('div');
            fl.className = 'win-flowers';
            player.flowers.forEach(f => fl.appendChild(createTileElement(f)));
            handDiv.appendChild(fl);
        }

        // 台數明細
        const listDiv = document.getElementById('win-details');
        listDiv.innerHTML = '';
        const addRow = (d, extraClass) => {
            const item = document.createElement('div');
            item.className = 'win-details-item' + (extraClass ? ' ' + extraClass : '');
            item.innerHTML = `<div class="win-detail-main"><span>${d.name}</span><span class="win-detail-tai">${d.tai} 台</span></div>`
                + (d.desc ? `<div class="win-detail-desc">${d.desc}</div>` : '');
            listDiv.appendChild(item);
        };
        if (result.details.length === 0) {
            addRow({ name: '無台', tai: 0, desc: '這手牌沒有任何台型，只收底' });
        } else {
            result.details.forEach(d => addRow(d));
        }
        if (dealerInvolved) {
            const head = document.createElement('div');
            head.className = 'win-detail-subhead';
            head.textContent = winnerId === state.dealer
                ? '莊家台（莊家胡牌，每一家都要加）'
                : `莊家台（只有莊家 ${PLAYER_NAMES[state.dealer]} 付的那份要加）`;
            listDiv.appendChild(head);
            result.dealerDetails.forEach(d => addRow(d, 'dealer-row'));
        }

        // 付款明細：底 + 台數 x 每台
        const payDiv = document.createElement('div');
        payDiv.className = 'win-pay-list';
        payDiv.innerHTML = `<div class="win-pay-formula">每份 = 底 ${base} + 台數 x 每台 ${perTai}</div>`
            + payments.map(p => `<div class="win-pay-row"><span>${PLAYER_NAMES[p.payer]}${p.payer === state.dealer ? '（莊）' : ''} 付</span>`
                + `<span>${base} + ${p.tai} x ${perTai} = <strong>${p.amount}</strong></span></div>`).join('');
        listDiv.appendChild(payDiv);

        const totalAmt = payments.reduce((s, p) => s + p.amount, 0);
        const shownTai = result.total + (winnerId === state.dealer ? result.dealerTai : 0);
        document.getElementById('win-total').textContent =
            `${shownTai} 台，${PLAYER_NAMES[winnerId]} 共收 ${totalAmt}`;

        modal.style.display = 'flex';

        const btn = document.getElementById('win-confirm-btn');
        btn.onclick = () => {
            modal.style.display = 'none';
            processWinResult(winnerId, isZimo, loserId, payments);
        };
    }

    function processWinResult(winnerId, isZimo, loserId, payments) {
        payments.forEach(p => {
            scoring.scores[p.payer] -= p.amount;
            scoring.scores[winnerId] += p.amount;
        });
        scoring.stats[winnerId].hu++;
        if (isZimo) scoring.stats[winnerId].zimo++;
        else if (loserId !== null && loserId !== undefined) scoring.stats[loserId].fangqiang++;

        saveScoring();
        updateScoreboard();

        state.active = false;
        showSelfDrawHuButton(false);

        // 莊家輪替：莊家胡牌就連莊；別人胡牌就由下家（逆時針下一位）接莊
        let msg;
        if (winnerId === state.dealer) {
            state.lianZhuang++;
            msg = `莊家 ${PLAYER_NAMES[state.dealer]} 胡牌，連莊（連${state.lianZhuang}拉${state.lianZhuang}）`;
        } else {
            state.lianZhuang = 0;
            state.dealer = (state.dealer + 1) % 4;
            state.dealerPasses++;
            if (state.dealerPasses >= 4) {
                // 四家都當過莊 = 一圈結束，換下一個圈風
                state.dealerPasses = 0;
                state.round = (state.round + 1) % 4;
            }
            msg = `換莊：下一局由 ${PLAYER_NAMES[state.dealer]} 當莊`;
        }
        state.handCount = state.dealerPasses;
        state.roundWind = WIND_IDS[state.round];
        showToast(`${msg}。現在是${WIND_CHARS[state.round]}風圈第 ${state.handCount + 1} 局`, 2600);
        setTimeout(() => startGame(true), 2800);
    }

    function showSelfDrawHuButton(show) {
        const btn = document.getElementById('hu-self-btn');
        if (btn) btn.style.display = show ? 'inline-block' : 'none';
    }

    function initScoringUI() {
        // Settings save (in slide panel, managed by app.js)
        const settingsSave = document.getElementById('settings-save');
        const settingsPanel = document.getElementById('settings-panel');

        // When settings panel opens, populate fields with current values
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                document.getElementById('setting-base').value = scoring.settings.base;
                document.getElementById('setting-per-tai').value = scoring.settings.perTai;
            });
        }

        if (settingsSave) {
            settingsSave.onclick = () => {
                scoring.settings.base = parseInt(document.getElementById('setting-base').value) || 100;
                scoring.settings.perTai = parseInt(document.getElementById('setting-per-tai').value) || 100;

                saveScoring();

                // Save player names (defined in app.js)
                if (typeof savePlayerNames === 'function') {
                    savePlayerNames();
                }
                updatePlayerNames();

                // Close modal overlay
                if (settingsPanel) settingsPanel.classList.add('hidden');
                showToast(`\u8a2d\u5b9a\u5df2\u5132\u5b58\uff1a\u5e95 ${scoring.settings.base} \u5143\uff0c\u6bcf\u53f0 ${scoring.settings.perTai} \u5143`, 2000);
            };
        }

        // Load saved scoreboard
        updateScoreboard();
    }

    function resetScores() {
        scoring = defaultScoring();
        saveScoring();
        updateScoreboard();
    }

    // --- Public API ---
    function updatePlayerNames() {
        const defaults = ['自己', '下家', '對家', '上家'];
        PLAYER_NAMES = defaults.map((def, i) => {
            const saved = localStorage.getItem(`mahjong_player_name_${i}`);
            return saved || def;
        });
    }

    return {
        startGame,
        sortUserHand,
        getState: () => state,
        passAction,
        initScoringUI,
        resetScores,
        updatePlayerNames
    };
})();
