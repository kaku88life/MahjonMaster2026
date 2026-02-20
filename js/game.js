// game.js - Mahjong Game Simulator (4-Player, Realistic)
// Features: 3-dice rolling, educational toast messages, wall-click draw,
//           4-tile dealing, flower replacement, round/wind tracking, 
//           Chi/Pong, animated center discard pile

const MahjongGame = (() => {
    // --- Constants ---
    const PLAYER_NAMES = ['自己', '🅐 下家', '🅒 對家', '🅑 上家'];
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
        aiSpeed: 5000,
        waitingForAction: false,
        diceResult: [0, 0, 0],
        centerDiscards: [],
        dealing: false,
        userCanDraw: false, // Is wall clickable for user to draw?
        tutorialMode: true,
        speedMultiplier: 1, // 1 = normal, 0.5 = 2x speed
        lianZhuang: 0       // 連莊次數 (0=初莊)
    };

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
            settings: { base: 100, perTai: 100, difficulty: 'normal' },
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
    function canChi(playerHand, discardedTile, discardPlayer) {
        if (discardPlayer !== 3) return { valid: false, combos: [] };
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

    // --- AI ---
    function aiChooseDiscard(hand) {
        // AI Difficulty Check
        const difficulty = (scoring && scoring.settings && scoring.settings.difficulty) || 'normal';

        if (difficulty === 'easy') {
            // Easy: Completely random discard
            return Math.floor(Math.random() * hand.length);
        }

        // Normal/Hard: Use heuristic (Hard could be improved later)
        const sorted = sortTiles(hand);
        const counts = {};
        sorted.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
        let scored = sorted.map((tile, idx) => {
            let score = 0;
            const suit = getSuit(tile);
            const num = getNumber(tile);
            if (counts[tile] >= 3) score += 30;
            else if (counts[tile] >= 2) score += 15;
            if (!suit) {
                score += counts[tile] >= 2 ? 20 : -10;
            } else {
                if (num >= 3 && num <= 7) score += 5;
                if (sorted.includes((num - 1) + suit) && sorted.includes((num + 1) + suit)) score += 20;
                else if (sorted.includes((num - 1) + suit) || sorted.includes((num + 1) + suit)) score += 10;
            }
            return { tile, idx, score };
        });
        scored.sort((a, b) => a.score - b.score);
        return scored[0].idx;
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
            const speedCb = document.getElementById('opt-speed');
            if (tutorialCb && saved.tutorial !== undefined) tutorialCb.checked = saved.tutorial;
            if (speedCb && saved.speed2x !== undefined) speedCb.checked = saved.speed2x;

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
                    speed2x: speedCb ? speedCb.checked : false
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

    async function startGame() {
        // Show new game options modal
        const options = await showNewGameModal();
        if (!options) return; // User cancelled

        state.tutorialMode = options.tutorial;
        state.speedMultiplier = options.speed2x ? 0.5 : 1;

        state.aiSpeed = parseInt(document.getElementById('ai-speed').value) || 5000;
        state.active = false;
        state.dealing = true;
        state.centerDiscards = [];
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
                // User clicked "Hu" on self-draw
                // Winning tile is the last one drawn (at end of hand)
                const hand = state.players[0].hand;
                const winningTile = hand[hand.length - 1];
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

        // Initialize Audio (requires interaction, usually Start Button click)
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

        if (state.tutorialMode) {
            await showToast('✅ 準備完成！莊家先出牌，輪到你時可以從牌墩摸牌', 2500 * state.speedMultiplier);
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

        // Show dice animation
        const diceArea = document.getElementById('dice-display');
        if (diceArea) {
            diceArea.innerHTML = `
                <span class="dice">${getDiceEmoji(d1)}</span>
                <span class="dice">${getDiceEmoji(d2)}</span>
                <span class="dice">${getDiceEmoji(d3)}</span>
            `;
            diceArea.classList.add('dice-rolling');
        }

        await showToast('🎲 莊家擲骰子...', 1200 * sm);

        // Stop rolling animation, show result
        if (diceArea) diceArea.classList.remove('dice-rolling');
        await tsleep(300);

        // Calculate which player's wall to break
        const wallOwner = (state.dealer + (total - 1)) % 4;
        const wallOwnerName = PLAYER_NAMES[wallOwner];
        const wallOwnerWind = WIND_CHARS[(wallOwner - state.dealer + 4) % 4];

        if (state.tutorialMode) {
            // Full educational toast sequence
            await showToastSequence([
                { text: `🎲 骰出 ${getDiceEmoji(d1)} ${getDiceEmoji(d2)} ${getDiceEmoji(d3)} = <strong>${total}</strong>`, duration: 2000 * sm },
                { text: `從莊家（${WIND_CHARS[0]}）逆時針數 ${total} 位`, duration: 2500 * sm },
                { text: `👉 數到 <strong>${wallOwnerName}</strong>（${wallOwnerWind}風）的牌墩`, duration: 2500 * sm },
                { text: `從 ${wallOwnerName} 前方的牌墩，右邊數第 <strong>${total}</strong> 墩開始取牌`, duration: 3000 * sm },
                { text: `逆時針方向，每人每次取 <strong>4 張</strong>，共取 4 輪`, duration: 2500 * sm },
            ]);

            // Highlight the wall side being broken
            highlightWallSide(wallOwner);
            await tsleep(1500);
            clearWallHighlights();
        } else {
            // Brief summary only
            await showToast(`🎲 ${getDiceEmoji(d1)}${getDiceEmoji(d2)}${getDiceEmoji(d3)} = ${total}，從 ${wallOwnerName} 開始取牌`, 1800 * sm);
        }

        if (diceArea) {
            await tsleep(500);
            diceArea.innerHTML = '';
        }

        // Set wall draw start position based on dice result
        setWallDrawStart();
    }

    // Highlight a wall side for tutorial
    function highlightWallSide(playerIndex) {
        const sideNames = ['bottom', 'right', 'top', 'left'];
        const wallEl = document.getElementById('tile-wall');
        if (!wallEl) return;
        const sides = wallEl.querySelectorAll('.wall-side');
        // playerIndex: 0=bottom(self), 1=right(下家), 2=top(對家), 3=left(上家)
        const sideIndex = playerIndex; // matches wall-side rendering order
        if (sides[sideIndex]) {
            sides[sideIndex].classList.add('wall-highlight');
        }
    }

    function clearWallHighlights() {
        document.querySelectorAll('.wall-highlight').forEach(el => el.classList.remove('wall-highlight'));
    }

    function getDiceEmoji(n) {
        return ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][n];
    }

    // --- Deal Sequence ---
    async function dealSequence() {
        const sm = state.speedMultiplier;
        const dealOrder = [];
        for (let round = 0; round < 4; round++) {
            for (let p = 0; p < 4; p++) {
                dealOrder.push((state.dealer + p) % 4);
            }
        }

        if (state.tutorialMode) {
            await showToast('📋 開始抓牌：從牌墩依序取牌，每人每次 4 張', 2000 * sm);
        }

        for (let i = 0; i < dealOrder.length; i++) {
            const playerId = dealOrder[i];
            const tiles = state.deck.splice(0, 4);
            drawFromWall('normal');
            drawFromWall('normal');
            drawFromWall('normal');
            drawFromWall('normal');
            state.players[playerId].hand.push(...tiles);

            if (playerId === 0) {
                state.players[0].hand = sortTiles(state.players[0].hand);
            }
            renderAll();
            renderWall();
            updateTileCount();

            // Show progress every 4 players (end of a round)
            if (i % 4 === 3) {
                const roundNum = Math.floor(i / 4) + 1;
                await showToast(`第 ${roundNum} 輪抓牌完成（每人 ${roundNum * 4} 張）`, 1000 * sm);
            }
            await sleep(120 * sm);
        }

        state.players[0].hand = sortTiles(state.players[0].hand);
        renderAll();
        await showToast('16 張抓牌完成，開始補花...', 1500 * sm);
        await tsleep(400);
    }

    // --- Flower Replacement ---
    async function replaceAllFlowers() {
        const sm = state.speedMultiplier;
        let anyReplaced = true;
        let maxIter = 20;
        let isFirst = true;

        while (anyReplaced && maxIter > 0) {
            anyReplaced = false;
            maxIter--;

            for (let p = 0; p < 4; p++) {
                const player = state.players[p];
                let flowerIndices = [];
                player.hand.forEach((tile, idx) => {
                    if (isFlower(tile)) flowerIndices.push(idx);
                });

                if (flowerIndices.length > 0) {
                    // Tutorial: explain flower replacement on first occurrence
                    if (isFirst && state.tutorialMode) {
                        isFirst = false;
                        await showToast('🌸 補花：花牌不能用來組牌，需從牌墩尾端補回等量新牌', 2500 * sm);
                    }

                    anyReplaced = true;
                    flowerIndices.sort((a, b) => b - a);
                    const flowerNames = flowerIndices.map(idx => getTileDisplay(player.hand[idx])).join(' ');
                    flowerIndices.forEach(idx => {
                        const flower = player.hand.splice(idx, 1)[0];
                        player.flowers.push(flower);
                    });
                    for (let f = 0; f < flowerIndices.length; f++) {
                        if (state.deck.length > 0) {
                            player.hand.push(state.deck.shift());
                            drawFromWall('replacement');
                        }
                    }

                    if (p === 0) {
                        state.players[0].hand = sortTiles(state.players[0].hand);
                    }
                    renderAll();
                    renderWall();
                    await showToast(
                        `🌸 ${PLAYER_NAMES[p]} 補花：${flowerNames}（補 ${flowerIndices.length} 張）`,
                        1500 * sm
                    );
                }
            }
        }
        updateTileCount();
    }

    // ===== WALL DISPLAY & DRAW =====

    // Wall state: tracks the initial layout and which positions have been drawn
    // 4 sides × 18 stacks = 72 stacks total, each stack has 2 tiles (top/bottom)
    const STACKS_PER_SIDE = 18;
    const TOTAL_STACKS = STACKS_PER_SIDE * 4; // 72 stacks = 144 tiles

    function initWallState() {
        // wallStacks[i] = number of tiles in stack i (0, 1, or 2)
        // Indices 0..71 follow clockwise loop around table:
        // 0..17: Bottom (Right to Left) -> Wait, CSS is row-reverse, so Index 0 is Right-most?
        // Let's stick to the CSS logic:
        // Top: 0..17 (Left->Right)
        // Right: 18..35 (Top->Bottom)
        // Bottom: 36..53 (Right->Left)
        // Left: 54..71 (Bottom->Top)
        state.wallStacks = new Array(TOTAL_STACKS).fill(2);
        state.wallHeadPtr = 0; // Front of wall (Clockwise draw)
        state.wallTailPtr = 0; // Back of wall (Counter-Clockwise replacement)
    }

    function setWallDrawStart() {
        // diceResult sum
        const total = state.diceResult[0] + state.diceResult[1] + state.diceResult[2];
        // wallOwner: 0=Bottom, 1=Right, 2=Top, 3=Left
        const wallOwner = (state.dealer + (total - 1)) % 4;

        // Visual mapping to indices based on CSS side order
        // 0=Bottom, 1=Right, 2=Top, 3=Left (Game logic)
        // But CSS visual loop: Top(0-17)->Right(18-35)->Bottom(36-53)->Left(54-71)
        // We need to map GameSide to StackIndex
        // GameSide 0 (Bottom) -> Indices 36..53
        // GameSide 1 (Right)  -> Indices 18..35
        // GameSide 2 (Top)    -> Indices 0..17
        // GameSide 3 (Left)   -> Indices 54..71

        // Wait, standard Mahjong: Dealer is East.
        // Let's rely on the simple logic: Wall Owner is P.
        // We create a break at P's wall.
        // We need a map from PlayerID to StartIndex.
        const playerToWallStart = [36, 18, 0, 54]; // Bottom, Right, Top, Left

        let startIdx = playerToWallStart[wallOwner];

        // "Right side" of that wall.
        // Since we defined the loop Clockwise, "Right end" means "Index + total"?
        // Actually normally it's count from Right.
        // Bottom (R->L): Start is Right-most. So Index 36 is Right-most.
        // So `36 + total` is correct.

        state.wallHeadPtr = (startIdx + total) % TOTAL_STACKS;
        // Tail pointer is one step behind Head (Counter-Clockwise)
        state.wallTailPtr = (state.wallHeadPtr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
    }

    function drawFromWall(mode = 'normal') {
        // mode: 'normal' (Head moves CW), 'replacement' (Tail moves CCW)
        let ptr = (mode === 'normal') ? state.wallHeadPtr : state.wallTailPtr;
        let attempts = 0;

        // Find next available tile
        while (attempts < TOTAL_STACKS) {
            if (state.wallStacks[ptr] > 0) {
                state.wallStacks[ptr]--; // Take one tile

                // If stack becomes empty, or if we just took from a full stack?
                // The pointer logic:
                // Normal: If we take a tile, do we advance?
                // Visual stack has 2 tiles. We take top. Stack remains with 1. Pointer stays?
                // No, standard is we take the full stack (2 tiles) usually for 4-tile deal?
                // But here we simulate per-tile.
                // Implementation: Take top (2->1), then take bottom (1->0).
                // So pointer STAYS until stack is 0.

                if (state.wallStacks[ptr] === 0) {
                    // Stack empty, move pointer
                    if (mode === 'normal') {
                        state.wallHeadPtr = (ptr + 1) % TOTAL_STACKS;
                    } else {
                        state.wallTailPtr = (ptr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
                    }
                }
                return;
            }

            // If current stack empty, skip to next
            if (mode === 'normal') {
                ptr = (ptr + 1) % TOTAL_STACKS;
                state.wallHeadPtr = ptr;
            } else {
                ptr = (ptr - 1 + TOTAL_STACKS) % TOTAL_STACKS;
                state.wallTailPtr = ptr;
            }
            attempts++;
        }
    }

    function renderWall() {
        const wallEl = document.getElementById('tile-wall');
        if (!wallEl) return;

        const remaining = state.deck.length;
        wallEl.innerHTML = '';

        if (remaining === 0) {
            wallEl.innerHTML = '<div class="wall-empty">牌墩已空</div>';
            wallEl.classList.remove('wall-clickable');
            return;
        }

        // CSS defines: Top(0-17), Right(18-35), Bottom(36-53), Left(54-71)
        // Mapping from visual side name to index range
        const sides = [
            { name: 'wall-side-top', start: 0 },
            { name: 'wall-side-right', start: 18 },
            { name: 'wall-side-bottom', start: 36 },
            { name: 'wall-side-left', start: 54 }
        ];

        sides.forEach(sideDef => {
            const side = document.createElement('div');
            side.className = `wall-side ${sideDef.name}`;

            for (let i = 0; i < STACKS_PER_SIDE; i++) {
                const stackIdx = sideDef.start + i;
                const count = state.wallStacks ? state.wallStacks[stackIdx] : 2;
                const stack = document.createElement('div');
                stack.className = 'wall-brick';
                // Dataset for click validation
                stack.dataset.idx = stackIdx;

                if (count === 0) {
                    stack.classList.add('empty');
                } else if (count >= 2) {
                    stack.classList.add('double');
                }

                // Highlight HEAD pointer (Next Normal Draw)
                if (state.wallStacks && stackIdx === state.wallHeadPtr && count > 0) {
                    stack.classList.add('draw-next');
                }

                // Add click handler to individual brick
                stack.onclick = (e) => {
                    e.stopPropagation(); // prevent bubbling to container
                    if (state.userCanDraw) {
                        // Check if this is the correct stack (Head Ptr)
                        if (stackIdx === state.wallHeadPtr) {
                            wallClickDraw();
                        } else {
                            showToast('⚠️ 請從順時針方向正確位置（亮燈處）摸牌！', 1500);
                        }
                    }
                };

                side.appendChild(stack);
            }
            wallEl.appendChild(side);
        });

        // Update clickable state
        if (state.userCanDraw) {
            wallEl.classList.add('wall-clickable');
        } else {
            wallEl.classList.remove('wall-clickable');
        }
    }

    function enableUserDraw() {
        state.userCanDraw = true;
        state.currentPlayer = 0;
        startTurnTimer(); // Start thinking timer
        renderWall();
        updateInfoPanel('輪到您，請點擊牌墩摸牌');
        showToast('👆 輪到您摸牌，請點擊牌桌上的<strong>牌墩</strong>', 2500);
    }

    function wallClickDraw() {
        if (!state.active || !state.userCanDraw) return;
        state.userCanDraw = false;
        renderWall();
        drawTileForPlayer(0);
    }

    // --- Drawing ---
    function handleDraw() {
        state.lianZhuang++;
        state.active = false;
        showToast(`🔚 流局（臭莊）！莊家 ${PLAYER_NAMES[state.dealer]} 連莊（連 ${state.lianZhuang}）`, 4000);
    }

    function drawTileForPlayer(playerId) {
        if (!state.active || state.deck.length <= 16) {
            handleDraw();
            return;
        }

        // Play Sound
        if (window.AudioManager) AudioManager.playClack();

        const tile = state.deck.pop();
        state.players[playerId].hand.push(tile);
        drawFromWall('normal');
        updateTileCount();
        renderWall();

        // Flower auto-replace
        if (isFlower(tile)) {
            const player = state.players[playerId];
            const idx = player.hand.indexOf(tile);
            player.hand.splice(idx, 1);
            player.flowers.push(tile);

            if (playerId === 0) {
                showToast(`🌸 摸到花牌 ${getTileDisplay(tile)}，自動補花！`, 1500);
                renderAll();
            }
            // Recursively draw again
            setTimeout(() => drawTileForPlayer(playerId), 600);
            return;
        }

        // Check User Self-Draw (Tsumo)
        if (playerId === 0) {
            if (MahjongAlgorithm.canHu(state.players[playerId].hand)) {
                showSelfDrawHuButton(true);
                showToast('🎉 自摸！請按「胡」結束牌局', 3000);
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

        if (state.currentPlayer === 0) {
            enableUserDraw();
        } else {
            setTimeout(() => aiTurn(state.currentPlayer), state.aiSpeed * 0.3);
        }
    }

    function aiTurn(playerId) {
        try {
            if (!state.active || state.waitingForAction) return;

            if (state.deck.length <= 16) {
                handleDraw();
                return;
            }

            // Play Sound
            if (window.AudioManager) AudioManager.playClack();

            const tile = state.deck.pop();
            state.players[playerId].hand.push(tile);
            drawFromWall('normal'); // AI also draws from wall
            updateTileCount();
            renderOpponentBacks();
            renderWall();

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

            if (isFlower(tile)) {
                const player = state.players[playerId];
                const idx = player.hand.indexOf(tile);
                player.hand.splice(idx, 1);
                player.flowers.push(tile);
                renderAll();
                setTimeout(() => aiTurn(playerId), 500);
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

    // Check actions after a discard (Hu, Pong, Chi)
    function checkDiscardActions(tile, discarderId) {
        // 1. Check HU (Win) for all other players
        // Order: Counter-Clockwise from discarder (Head Bump / Jiet Hu priority)
        for (let i = 1; i <= 3; i++) {
            const pId = (discarderId + i) % 4;
            // Check if player can Hu with this tile
            if (MahjongAlgorithm.canHu(state.players[pId].hand, tile)) {
                // Guo Shui Check
                if (state.players[pId].guoShui) {
                    console.log(`Player ${pId} in Guo Shui, skipping Hu.`);
                    if (pId === 0) showToast('過水中，無法胡牌', 1500);
                    // Continue loop (don't break, maybe others can Hu? Jiet Hu needs check)
                    // If User, we fall through to Chi/Pong check later
                } else if (pId === 0) {
                    // User can Hu!
                    const chiResult = canChi(state.players[0].hand, tile, discarderId);
                    const pongResult = canPong(state.players[0].hand, tile);
                    state.waitingForAction = true;
                    state.huPossible = true; // Mark as possible
                    showActionBar(tile, discarderId, chiResult, pongResult, true);
                    showToast('🎉 有機會胡牌！', 2000);
                    return true; // Wait for user
                } else {
                    // AI can Hu (Ron)
                    declareWin(pId, 1, false, discarderId, tile);
                    return true; // Stop turn
                }
            }
        }

        // 2. Check Pong (Any player) - Currently only User
        // If we want AI to Pong, we'd check here. For now only User.
        // User is Player 0.
        if (discarderId !== 0) {
            const pongResult = canPong(state.players[0].hand, tile);
            const chiResult = canChi(state.players[0].hand, tile, discarderId);

            if (pongResult.valid || chiResult.valid) {
                state.waitingForAction = true;
                showActionBar(tile, discarderId, chiResult, pongResult, false);
                return true;
            }

            // Debug hint: explain why chi/pong isn't available when 上家 discards
            if (discarderId === 3) {
                const suit = getSuit(tile);
                if (!suit) {
                    showToast(`${getTileDisplay(tile)} 是字牌，不能吃`, 1200);
                } else {
                    showToast(`手中沒有能與 ${getTileDisplay(tile)} 組順子的牌`, 1200);
                }
            }
        }

        return false;
    }

    // --- Center Discard Pile ---
    function addToCenterPile(tile, playerId) {
        const centerX = 50 + (Math.random() - 0.5) * 30;
        const centerY = 35 + (Math.random() - 0.5) * 20;
        const rotation = (Math.random() - 0.5) * 30;

        // Play Sound on Discard
        if (window.AudioManager) AudioManager.playClack();

        state.centerDiscards.push({
            tile, playerId, x: centerX, y: centerY, rotation,
            id: Date.now() + Math.random()
        });
        renderCenterDiscards();
    }

    function renderCenterDiscards() {
        const area = document.getElementById('center-discard-pile');
        if (!area) return;
        area.innerHTML = '';

        state.centerDiscards.forEach((d, idx) => {
            const el = createTileElement(d.tile);
            el.className = 'tile center-pile-tile';
            // Grid layout handles position automatically
            el.style.borderColor = PLAYER_COLORS[d.playerId];
            el.style.borderWidth = '2px';
            el.title = `${PLAYER_NAMES[d.playerId]} 打出`;
            area.appendChild(el);
        });
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
            showToast('過水！本圈無法胡牌', 2000);
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
        updateTileCount();
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

    function updateTileCount() {
        const el = document.getElementById('remain-count');
        if (el) el.textContent = state.deck.length;
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
            executeChi(chiResult.combos[0]);
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

    function hideActionBar() {
        const bar = document.getElementById('action-bar');
        if (bar) bar.classList.add('hidden');
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

    function calculateWinAmount(taiCount, isZimo) {
        const { base, perTai } = scoring.settings;
        const perPlayer = base + taiCount * perTai;
        if (isZimo) {
            return perPlayer * 3; // all 3 opponents pay
        }
        return perPlayer; // only discarder pays
    }

    // --- Win Handling ---
    function declareWin(winnerId, taiCount, isZimo, loserId, winningTile) {
        // If winningTile is missing, try to infer it (unsafe but fallback)
        if (!winningTile) {
            const hand = state.players[winnerId].hand;
            winningTile = hand[hand.length - 1];
        }

        // Show Win Modal to calculate details
        showWinModal(winnerId, isZimo, loserId, winningTile);
    }

    function showWinModal(winnerId, isZimo, loserId, winningTile) {
        const modal = document.getElementById('win-modal');
        if (!modal) return;

        // 1. Calculate Score Details
        const player = state.players[winnerId];
        const context = {
            roundWind: state.roundWind || 'dong',
            seatWind: ['dong', 'nan', 'xi', 'bei'][(winnerId - state.dealer + 4) % 4],
            isSelfDraw: isZimo,
            isLastTile: state.deck.length <= 16,  // 海底：摸最後一張或被打最後一張
            lianZhuang: state.lianZhuang,          // 連莊次數 for 連N拉N
            isDealer: winnerId === state.dealer     // 是否為莊家
        };

        const result = MahjongAlgorithm.calculateScore(player.hand, player.melds, player.flowers, context);

        // Update Tai Count (override manual input if any)
        const totalTai = result.total;

        // 2. Render Modal
        document.getElementById('win-winner').textContent = `${PLAYER_NAMES[winnerId]} ${isZimo ? '自摸' : '胡牌'}！`;

        // Hand Display
        const handDiv = document.getElementById('win-hand');
        handDiv.innerHTML = '';
        // Melds
        player.melds.forEach(m => {
            const grp = document.createElement('div');
            grp.className = 'meld-group';
            grp.style.display = 'flex';
            grp.style.marginRight = '8px';
            m.tiles.forEach(t => grp.appendChild(createTileElement(t)));
            handDiv.appendChild(grp);
        });
        // Standing Hand
        const standing = [...player.hand];
        // If winning tile is in hand, remove it to show separately? 
        // Or just sort and show. 
        // Winning tile should be highlighted.
        // Let's just show sorted hand.
        const sorted = sortTiles(standing);
        sorted.forEach(t => {
            const el = createTileElement(t);
            if (t === winningTile) el.style.filter = 'brightness(1.2) drop-shadow(0 0 5px gold)';
            handDiv.appendChild(el);
        });

        // Details
        const listDiv = document.getElementById('win-details');
        listDiv.innerHTML = '';
        result.details.forEach(d => {
            const item = document.createElement('div');
            item.className = 'win-details-item';
            item.innerHTML = `<span>${d.name}</span><span>${d.tai} 台</span>`;
            listDiv.appendChild(item);
        });
        // Add Base?
        const base = scoring.settings.base;
        const perTai = scoring.settings.perTai;
        const totalAmt = base + totalTai * perTai;

        const baseItem = document.createElement('div');
        baseItem.className = 'win-details-item';
        baseItem.innerHTML = `<span>底</span><span>${base} (底)</span>`;
        listDiv.prepend(baseItem);

        // Total
        const totalDiv = document.getElementById('win-total');
        totalDiv.textContent = `總計：${totalTai} 台 / ${totalAmt} 元`;

        // 3. Show
        modal.style.display = 'flex';

        // 4. Bind Confirm Button
        const btn = document.getElementById('win-confirm-btn');
        btn.onclick = () => {
            modal.style.display = 'none';
            processWinResult(winnerId, totalTai, isZimo, loserId, totalAmt);
        };
    }

    function processWinResult(winnerId, taiCount, isZimo, loserId, totalAmt) {
        if (isZimo) {
            // Self-draw: all 3 others pay
            for (let p = 0; p < 4; p++) {
                if (p === winnerId) {
                    scoring.scores[p] += totalAmt * 3;
                } else {
                    scoring.scores[p] -= totalAmt;
                }
            }
            scoring.stats[winnerId].zimo++;
            scoring.stats[winnerId].hu++;
        } else {
            // Discard win: only loser pays
            scoring.scores[winnerId] += totalAmt;
            scoring.scores[loserId] -= totalAmt;
            scoring.stats[winnerId].hu++;
            scoring.stats[loserId].fangqiang++;
        }

        saveScoring();
        updateScoreboard();

        // End the game
        state.active = false;
        showSelfDrawHuButton(false);

        // Dealer rotation logic (莊家輪替)
        if (winnerId === state.dealer) {
            // 莊家胡牌 → 連莊
            state.lianZhuang++;
            showToast(`本局結束！莊家 ${PLAYER_NAMES[state.dealer]} 連莊（連 ${state.lianZhuang}）`, 3000);
        } else {
            // 非莊家胡 → 莊家換人，連莊歸零
            state.lianZhuang = 0;
            state.dealer = (state.dealer + 1) % 4;
            showToast(`本局結束！下一局莊家：${PLAYER_NAMES[state.dealer]}`, 3000);
        }
    }

    function showSelfDrawHuButton(show) {
        const btn = document.getElementById('hu-self-btn');
        if (btn) btn.style.display = show ? 'inline-block' : 'none';
    }

    function initScoringUI() {
        // Settings modal
        const settingsBtn = document.getElementById('settings-btn');
        const settingsModal = document.getElementById('settings-modal');
        const settingsSave = document.getElementById('settings-save');
        const settingsCancel = document.getElementById('settings-cancel');

        if (settingsBtn) {
            settingsBtn.onclick = () => {
                document.getElementById('setting-base').value = scoring.settings.base;
                document.getElementById('setting-per-tai').value = scoring.settings.perTai;
                const diffEl = document.getElementById('setting-difficulty');
                if (diffEl) diffEl.value = scoring.settings.difficulty || 'normal';
                settingsModal.classList.remove('hidden');
            };
        }
        if (settingsSave) {
            settingsSave.onclick = () => {
                scoring.settings.base = parseInt(document.getElementById('setting-base').value) || 100;
                scoring.settings.perTai = parseInt(document.getElementById('setting-per-tai').value) || 100;
                const diffEl = document.getElementById('setting-difficulty');
                if (diffEl) scoring.settings.difficulty = diffEl.value;

                saveScoring();
                settingsModal.classList.add('hidden');
                showToast(`\u8a2d\u5b9a\u5df2\u5132\u5b58\uff1a\u5e95 ${scoring.settings.base} \u5143\uff0c\u6bcf\u53f0 ${scoring.settings.perTai} \u5143`, 2000);
            };
        }
        if (settingsCancel) {
            settingsCancel.onclick = () => settingsModal.classList.add('hidden');
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
    return {
        startGame,
        sortUserHand,
        getState: () => state,
        passAction,
        initScoringUI,
        resetScores
    };
})();
