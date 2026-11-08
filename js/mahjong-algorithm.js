// Mahjong Algorithm: Win Detection
// Implements standard Taiwan Mahjong (16-tile) win check: 5 sets + 1 pair = 17 tiles.

const MahjongAlgorithm = {
    // Check if the hand (plus an optional extra tile) is a winning hand
    // hand: Array of tile IDs (e.g. ['1m', '2m'...])
    // extraTile: Optional tile ID (e.g. '1m') to add to hand (for Ron/Tsumo check)
    canHu(hand, extraTile = null) {
        // 1. Combine and clean hand
        let tiles = [...hand];
        if (extraTile) tiles.push(extraTile);

        // Filter out flowers (s1..s4, f1..f4)
        tiles = tiles.filter(t => !['s1', 's2', 's3', 's4', 'f1', 'f2', 'f3', 'f4'].includes(t));

        // Taiwan Mahjong: Standard win is 17 tiles (after draw/pick).
        // If we have melds (Pong/Chi/Kong), they are already set aside.
        // We only check the "Standing Hand".
        // Standing Hand Count = 17 - (Melds * 3).
        // Format is always: N * 3 + 2.
        if (tiles.length % 3 !== 2) {
            return false;
        }

        // 2. Sort tiles for easier checking
        tiles.sort();

        // 3. Recursive Check
        return this.checkStandardHu(tiles);
    },

    checkStandardHu(tiles) {
        // Step 1: Find a Pair (Eyes)
        // We iterate through unique tiles to try each as the pair.
        const distinctTiles = [...new Set(tiles)];

        for (const eyes of distinctTiles) {
            // Count instances of this tile
            const count = this.countTiles(tiles, eyes);
            if (count >= 2) {
                // Remove pair
                const remaining = this.removeTiles(tiles, [eyes, eyes]);
                // Check if remaining form sets
                if (this.checkSets(remaining)) return true;
            }
        }
        return false;
    },

    checkSets(tiles) {
        if (tiles.length === 0) return true;

        const first = tiles[0];

        // Try Triplet (AAA)
        if (this.countTiles(tiles, first) >= 3) {
            const afterTriplet = this.removeTiles(tiles, [first, first, first]);
            if (this.checkSets(afterTriplet)) return true;
        }

        // Try Sequence (ABC) - Only for numbered suits (m, p, s)
        // Honors (dong, nan, xi, bei, zhong, fa, bai) cannot form sequences
        if (this.isSuit(first)) {
            const t1 = first;
            const t2 = this.getNextTile(t1);
            const t3 = this.getNextTile(t2);

            // Check if t2 and t3 exist in tiles
            // Note: need to handle multiple instances correctly
            if (t2 && t3 && tiles.includes(t2) && tiles.includes(t3)) {
                // Remove one instance of each
                const afterSeq = this.removeTiles(tiles, [t1, t2, t3]);
                if (this.checkSets(afterSeq)) return true;
            }
        }

        return false;
    },

    // --- Helpers ---

    countTiles(tiles, target) {
        return tiles.filter(t => t === target).length;
    },

    removeTiles(source, toRemove) {
        // Remove only ONE instance of each target
        const result = [...source];
        for (const t of toRemove) {
            const idx = result.indexOf(t);
            if (idx !== -1) {
                result.splice(idx, 1);
            } else {
                // If we can't find a tile to remove, this path is invalid
                // (Shouldn't happen with correct logic but good safety)
                return [];
            }
        }
        return result;
    },

    isSuit(tile) {
        // Handle undefined just in case
        if (!tile) return false;
        // Check if ends with m, p, s and starts with number
        const last = tile.slice(-1);
        return ['m', 'p', 's'].includes(last) && !isNaN(parseInt(tile[0]));
    },

    getNextTile(tile) {
        if (!tile || !this.isSuit(tile)) return null;
        const num = parseInt(tile[0]);
        const suit = tile.slice(-1);
        if (num < 9) return (num + 1) + suit;
        return null;
    },

    // --- Hand Decomposition (for scoring analysis) ---
    // Returns all valid decompositions of standing hand into sets + pair
    // Each decomposition: { pair: tile, sets: [{type:'pong'|'chi', tiles:[...]}] }
    decomposeHand(hand) {
        const results = [];
        const sorted = [...hand].sort();
        const distinctTiles = [...new Set(sorted)];

        for (const eyes of distinctTiles) {
            if (this.countTiles(sorted, eyes) >= 2) {
                const remaining = this.removeTiles(sorted, [eyes, eyes]);
                const sets = [];
                if (this._decompSets(remaining, sets)) {
                    results.push({ pair: eyes, sets: [...sets] });
                }
            }
        }
        return results;
    },

    _decompSets(tiles, sets) {
        if (tiles.length === 0) return true;
        const first = tiles[0];

        // Try Triplet first
        if (this.countTiles(tiles, first) >= 3) {
            const after = this.removeTiles(tiles, [first, first, first]);
            sets.push({ type: 'pong', tiles: [first, first, first] });
            if (this._decompSets(after, sets)) return true;
            sets.pop();
        }

        // Try Sequence
        if (this.isSuit(first)) {
            const t2 = this.getNextTile(first);
            const t3 = t2 ? this.getNextTile(t2) : null;
            if (t2 && t3 && tiles.includes(t2) && tiles.includes(t3)) {
                const after = this.removeTiles(tiles, [first, t2, t3]);
                sets.push({ type: 'chi', tiles: [first, t2, t3] });
                if (this._decompSets(after, sets)) return true;
                sets.pop();
            }
        }

        return false;
    },

    // --- Scoring Main Function (台灣 16 張常見台數表) ---
    // hand: 立牌（含胡的那張）
    // openMelds: [{type:'pong'|'chi'|'kong', tiles:[...]}]
    // flowers: 花牌
    // context: { roundWind, seatWind, isSelfDraw, isLastTile, lianZhuang,
    //            winningTile, isKongDraw, isRobKong }
    // 回傳 { total, details:[{name, tai, desc}], dealerTai, dealerDetails }
    //   total 不含莊家台；莊家台另算，因為只有「莊家胡」或「莊家付錢」時才加。
    calculateScore(hand, openMelds, flowers, context) {
        const common = [];
        const add = (list, name, tai, desc) => list.push({ name, tai, desc });

        const WINDS = ['dong', 'nan', 'xi', 'bei'];
        const WIND_NAMES = ['東', '南', '西', '北'];
        const DRAGONS = ['zhong', 'fa', 'bai'];
        const SEASON_NAMES = { s1: '春', s2: '夏', s3: '秋', s4: '冬' };
        const PLANT_NAMES = { f1: '梅', f2: '蘭', f3: '菊', f4: '竹' };
        const seasons = ['s1', 's2', 's3', 's4'];
        const plants = ['f1', 'f2', 'f3', 'f4'];
        const seatIdx = WINDS.indexOf(context.seatWind);
        const seatName = seatIdx >= 0 ? WIND_NAMES[seatIdx] : '';

        // === 1. 花牌：只有「正花」算台；花槓、八仙過海取代正花 ===
        if (flowers.length === 8) {
            add(common, '八仙過海', 8, '八張花全部到齊，直接算 8 台（不再另算正花、花槓）');
        } else {
            [[seasons, SEASON_NAMES, '春夏秋冬'], [plants, PLANT_NAMES, '梅蘭菊竹']].forEach(([set, names, label]) => {
                if (set.every(f => flowers.includes(f))) {
                    add(common, `花槓（${label}）`, 2, `同一組四張花集齊算 2 台，這組不再另算正花`);
                } else if (seatIdx >= 0 && flowers.includes(set[seatIdx])) {
                    add(common, `正花 ${names[set[seatIdx]]}`, 1, `你坐${seatName}位，對應的花是「${names[set[seatIdx]]}」，正花 1 台；其他花不算台`);
                }
            });
        }

        // === 2. 牌張統計 ===
        const meldTiles = [];
        openMelds.forEach(m => {
            if (m.tiles && Array.isArray(m.tiles)) meldTiles.push(...m.tiles);
            else if (m.tile) meldTiles.push(m.tile, m.tile, m.tile);
        });
        const allTiles = [...hand, ...meldTiles];
        const counts = {};
        allTiles.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

        const openPongs = openMelds.filter(m => m.type === 'pong' || m.type === 'kong');
        const openChis = openMelds.filter(m => m.type === 'chi');
        const isConcealed = openMelds.length === 0;

        // === 3. 三元牌 ===
        const dragonPongs = DRAGONS.filter(d => counts[d] >= 3);
        const dragonPair = DRAGONS.some(d => counts[d] === 2);
        if (dragonPongs.length === 3) {
            add(common, '大三元', 8, '中、發、白三組刻子都有，8 台（取代各自的三元牌台）');
        } else if (dragonPongs.length === 2 && dragonPair) {
            add(common, '小三元', 4, '兩組三元刻子＋第三種當將眼，4 台（取代各自的三元牌台）');
        } else {
            dragonPongs.forEach(d => add(common, this.getTileName(d), 1, '中、發、白任一組刻子（三張一樣）就是 1 台'));
        }

        // === 4. 風牌 ===
        const windPongs = WINDS.filter(w => counts[w] >= 3);
        const windPair = WINDS.some(w => counts[w] === 2);
        if (windPongs.length === 4) {
            add(common, '大四喜', 16, '東南西北四組刻子全有，16 台（取代圈風、門風台）');
        } else if (windPongs.length === 3 && windPair) {
            add(common, '小四喜', 8, '三組風牌刻子＋第四種風當將眼，8 台（取代圈風、門風台）');
        } else {
            const roundName = WIND_NAMES[WINDS.indexOf(context.roundWind)] || '東';
            windPongs.forEach(w => {
                if (w === context.roundWind) add(common, `圈風 ${this.getTileName(w)}`, 1, `現在是${roundName}風圈，持有${this.getTileName(w)}刻子 1 台`);
                if (w === context.seatWind) add(common, `門風 ${this.getTileName(w)}`, 1, `你坐${seatName}位，持有自己座位的風刻子 1 台`);
            });
        }

        // === 5. 花色 ===
        const suits = new Set();
        let hasHonor = false;
        allTiles.forEach(t => {
            if (this.isSuit(t)) suits.add(t.slice(-1));
            else hasHonor = true;
        });
        if (suits.size === 0 && hasHonor) {
            add(common, '字一色', 16, '整副牌只有字牌（風牌、三元牌），16 台');
        } else if (suits.size === 1 && !hasHonor) {
            add(common, '清一色', 8, '整副牌只有一種花色、沒有字牌，8 台');
        } else if (suits.size === 1) {
            add(common, '混一色', 4, '只有一種花色再加字牌，4 台');
        }

        // === 6. 胡牌方式 ===
        if (context.isSelfDraw && isConcealed) {
            add(common, '門清自摸', 3, '沒吃沒碰又自己摸到胡牌，俗稱「門清一摸三」，合計 3 台');
        } else if (context.isSelfDraw) {
            add(common, '自摸', 1, '胡的那張是自己從牌牆摸到的，1 台');
        } else if (isConcealed) {
            add(common, '門清', 1, '從頭到尾沒有吃、碰，胡別人打的牌，1 台');
        }
        if (context.isLastTile) {
            if (context.isSelfDraw) add(common, '海底撈月', 1, '摸到牌牆可摸的最後一張而自摸，1 台');
            else add(common, '河底撈魚', 1, '牌牆已摸完，胡最後一張打出的牌，1 台');
        }
        if (context.isKongDraw && context.isSelfDraw) add(common, '槓上開花', 1, '槓牌後補牌剛好自摸，1 台');
        if (context.isRobKong) add(common, '搶槓', 1, '別人加槓的那張剛好是你要的牌，1 台');

        // 全求人：五組都是吃碰來的，手上只剩一張單吊，胡別人打的牌
        if (openMelds.length >= 5 && hand.length <= 2 && !context.isSelfDraw) {
            add(common, '全求人', 2, '五組全靠吃碰，手上只剩一張單吊，胡別人打的牌，2 台');
        }

        // === 7. 牌型結構：每種拆法各算一次，取最高 ===
        const decomps = this.decomposeHand(hand);
        const wt = context.winningTile;
        const waits = wt ? this.getWaitingTiles(this.removeTiles(hand, [wt])) : [];
        const isSingleWait = waits.length === 1;

        let bestStruct = [];
        let bestStructTai = -1;
        const candidates = decomps.length > 0 ? decomps : [{ pair: null, sets: [] }];
        candidates.forEach(d => {
            const list = [];
            const handPongs = d.sets.filter(s => s.type === 'pong');
            const allPong = openChis.length === 0 && d.sets.every(s => s.type === 'pong');

            if (allPong && (handPongs.length + openPongs.length) >= 5) {
                add(list, '碰碰胡', 4, '五組全是刻子（三張一樣），沒有順子，4 台');
            }

            // 暗刻：立牌中的刻子；若胡別人打的那張剛好湊成這組刻子，這組算明刻
            let anKe = handPongs.length;
            if (!context.isSelfDraw && wt && d.pair !== wt && handPongs.some(s => s.tiles[0] === wt)) {
                const hasChiWithWt = d.sets.some(s => s.type === 'chi' && s.tiles.includes(wt));
                if (!hasChiWithWt) anKe -= 1;
            }
            if (anKe >= 5) add(list, '五暗刻', 8, '五組刻子都是自己摸齊的（暗刻），8 台');
            else if (anKe === 4) add(list, '四暗刻', 5, '四組刻子是自己摸齊的（暗刻），5 台');
            else if (anKe === 3) add(list, '三暗刻', 2, '三組刻子是自己摸齊的（暗刻），2 台');

            // 獨聽：聽牌時只有這一張能胡
            let waitType = '';
            if (isSingleWait && wt) {
                if (d.pair === wt) waitType = '單吊';
                d.sets.forEach(s => {
                    if (waitType || s.type !== 'chi' || !s.tiles.includes(wt)) return;
                    const nums = s.tiles.map(t => parseInt(t[0])).sort((a, b) => a - b);
                    const n = parseInt(wt[0]);
                    if (n === nums[1]) waitType = '中洞';
                    else if ((nums[0] === 1 && n === 3) || (nums[2] === 9 && n === 7)) waitType = '邊張';
                });
                add(list, `獨聽（${waitType || '只聽一張'}）`, 1,
                    waitType === '單吊' ? '只差將眼那一張，只有這一種牌能胡，1 台'
                    : waitType === '中洞' ? '只差順子中間那張（例：有 4、6 等 5），1 台'
                    : waitType === '邊張' ? '手上 1、2 等 3，或 8、9 等 7，只有一種牌能胡，1 台'
                    : '聽牌時只有這一種牌能胡，1 台');
            }

            // 平胡：無花、無字、五組順子、胡別人打的牌、不是獨聽（必須兩面聽）
            const allChi = d.sets.every(s => s.type === 'chi') && openPongs.length === 0;
            if (allChi && d.pair && this.isSuit(d.pair) && flowers.length === 0 && !hasHonor
                && !context.isSelfDraw && !isSingleWait) {
                add(list, '平胡', 2, '沒花、沒字、五組都是順子、聽兩面又胡別人打的牌，2 台');
            }

            const t = list.reduce((s, x) => s + x.tai, 0);
            if (t > bestStructTai) { bestStructTai = t; bestStruct = list; }
        });

        const details = [...common, ...bestStruct];
        const total = details.reduce((s, x) => s + x.tai, 0);

        // === 8. 莊家台（莊家胡牌或莊家付錢時才加）===
        const lz = context.lianZhuang || 0;
        const dealerDetails = [{ name: '莊家', tai: 1, desc: '莊家胡牌，或由莊家付錢時，加 1 台' }];
        if (lz > 0) {
            dealerDetails.push({ name: `連${lz}拉${lz}`, tai: lz * 2, desc: `莊家已連莊 ${lz} 次：每連一次「連 1 台＋拉 1 台」，共 ${lz * 2} 台` });
        }
        const dealerTai = dealerDetails.reduce((s, x) => s + x.tai, 0);

        return { total, details, dealerTai, dealerDetails };
    },

    // 聽牌分析：回傳所有能讓這手牌胡的牌種
    getWaitingTiles(hand) {
        const all = [];
        ['m', 'p', 's'].forEach(s => { for (let n = 1; n <= 9; n++) all.push(n + s); });
        all.push('dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai');
        return all.filter(t => this.countTiles(hand, t) < 4 && this.canHu(hand, t));
    },

    // ===== 電腦打牌用：向聽數（shanten，還差幾步才聽牌；-1 = 已胡，0 = 聽牌）=====
    ALL_TILE_IDS: (() => {
        const ids = [];
        ['m', 'p', 's'].forEach(s => { for (let n = 1; n <= 9; n++) ids.push(n + s); });
        return ids.concat(['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai']);
    })(),

    _toCounts(hand) {
        const counts = new Array(34).fill(0);
        hand.forEach(t => {
            const i = this.ALL_TILE_IDS.indexOf(t);
            if (i >= 0) counts[i]++;
        });
        return counts;
    },

    // 單一花色（或字牌）能拆出的所有 [組數, 搭子數, 是否有對子] 組合，依牌型快取
    _groupCache: new Map(),
    _groupOptions(counts9, isHonor) {
        const key = (isHonor ? 'h' : 's') + counts9.join('');
        const cached = this._groupCache.get(key);
        if (cached) return cached;
        const c = counts9.slice();
        const len = c.length;
        const found = new Set();
        // 拆解：m = 完整一組（順子/刻子），t = 搭子（差一張成組），p = 對子（當眼）
        const dfs = (i, m, t, p) => {
            while (i < len && c[i] === 0) i++;
            if (i >= len) { found.add(m * 100 + t * 10 + p); return; }
            if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
            if (!isHonor && i <= 6 && c[i + 1] && c[i + 2]) {
                c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++;
            }
            if (c[i] >= 2) {
                c[i] -= 2;
                if (!p) dfs(i, m, t, 1);
                dfs(i, m, t + 1, p);
                c[i] += 2;
            }
            if (!isHonor && i <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
            if (!isHonor && i <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
            // 這張當孤張不用
            c[i]--; dfs(i, m, t, p); c[i]++;
        };
        dfs(0, 0, 0, 0);
        // 只留下不被其他組合完全比下去的選項
        const opts = [...found].map(v => [Math.floor(v / 100), Math.floor(v / 10) % 10, v % 10]);
        const pruned = opts.filter(a => !opts.some(b => b !== a && b[0] >= a[0] && b[1] >= a[1] && b[2] >= a[2]
            && (b[0] > a[0] || b[1] > a[1] || b[2] > a[2])));
        this._groupCache.set(key, pruned);
        return pruned;
    },

    // hand 為立牌（不含已吃碰的牌組）；需要的組數由張數推算，吃碰過的組自動扣掉
    calcShanten(hand) {
        const counts = this._toCounts(hand);
        const setsNeeded = Math.floor(hand.length / 3);
        const groups = [
            this._groupOptions(counts.slice(0, 9), false),
            this._groupOptions(counts.slice(9, 18), false),
            this._groupOptions(counts.slice(18, 27), false),
            this._groupOptions(counts.slice(27, 34), true)
        ];
        let best = 2 * setsNeeded; // 最差情況：一組都沒有
        const combine = (g, m, t, p) => {
            if (g === groups.length) {
                const mm = Math.min(m, setsNeeded);
                const tt = Math.min(t, setsNeeded - mm);
                const s = 2 * setsNeeded - 2 * mm - tt - p;
                if (s < best) best = s;
                return;
            }
            groups[g].forEach(([gm, gt, gp]) => {
                if (p && gp) return; // 眼只能有一對
                combine(g + 1, m + gm, t + gt, p || gp);
            });
        };
        combine(0, 0, 0, 0);
        return best;
    },

    // 選要打哪張：打完向聽數最小；同分時選「能進張的牌」最多的那張
    // visible：桌上看得到的牌（海底、別人亮的牌組），用來扣掉已經沒得摸的張數
    chooseDiscard(hand, visible = []) {
        const seen = this._toCounts(hand.concat(visible));
        let bestTile = hand[hand.length - 1];
        let bestShanten = Infinity;
        let bestUkeire = -1;
        const tried = new Set();
        hand.forEach((tile, idx) => {
            if (tried.has(tile)) return;
            tried.add(tile);
            const rest = hand.slice(0, idx).concat(hand.slice(idx + 1));
            const s = this.calcShanten(rest);
            if (s > bestShanten) return;
            let ukeire = 0;
            const restCounts = this._toCounts(rest);
            this.ALL_TILE_IDS.forEach((cand, ci) => {
                const left = 4 - seen[ci];
                if (left <= 0) return;
                // 只有跟手上牌相同或同花色差 2 以內的牌才可能有用，其他直接略過以省計算
                const near = restCounts[ci] > 0 || (ci < 27 && [-2, -1, 1, 2].some(d => {
                    const j = ci + d;
                    return Math.floor(j / 9) === Math.floor(ci / 9) && j >= 0 && restCounts[j] > 0;
                }));
                if (!near) return;
                if (this.calcShanten(rest.concat(cand)) < s) ukeire += left;
            });
            if (s < bestShanten || ukeire > bestUkeire) {
                bestShanten = s;
                bestUkeire = ukeire;
                bestTile = tile;
            }
        });
        return bestTile;
    },

    getTileName(id) {
        const map = {
            'dong': '東風', 'nan': '南風', 'xi': '西風', 'bei': '北風',
            'zhong': '紅中', 'fa': '發財', 'bai': '白板'
        };
        return map[id] || id;
    }
};

window.MahjongAlgorithm = MahjongAlgorithm;
