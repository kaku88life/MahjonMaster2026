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
            console.warn("Hand tile count invalid for Hu check:", tiles.length);
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

    // --- Scoring Main Function ---
    // Returns { total: number, details: Array<{name, tai}> }
    // hand: Array of tiles (standing hand, including winning tile)
    // openMelds: Array of melds [{type: 'pong'|'chi'|'kong', tiles:[...]}]
    // flowers: Array of flower tiles
    // context: { roundWind, seatWind, isSelfDraw, isLastTile,
    //            lianZhuang, isDealer, isKongDraw, isRobKong }
    calculateScore(hand, openMelds, flowers, context) {
        const details = [];
        let totalTai = 0;

        // === 1. FLOWER SCORING ===
        const flowerCount = flowers.length;
        if (flowerCount > 0) {
            details.push({ name: `花牌 x${flowerCount}`, tai: flowerCount });
            totalTai += flowerCount;
        }

        // 正花 (Matching flower to seat wind)
        const seatWindIdx = ['dong', 'nan', 'xi', 'bei'].indexOf(context.seatWind);
        if (seatWindIdx >= 0) {
            const matchNum = seatWindIdx + 1;
            const matchingSeason = `s${matchNum}`;
            const matchingPlant = `f${matchNum}`;
            const seatWindName = ['東', '南', '西', '北'][seatWindIdx];
            if (flowers.includes(matchingSeason)) {
                const seasonNames = { s1: '春', s2: '夏', s3: '秋', s4: '冬' };
                details.push({ name: `正花 ${seasonNames[matchingSeason]}（${seatWindName}位）`, tai: 1 });
                totalTai += 1;
            }
            if (flowers.includes(matchingPlant)) {
                const plantNames = { f1: '梅', f2: '蘭', f3: '菊', f4: '竹' };
                details.push({ name: `正花 ${plantNames[matchingPlant]}（${seatWindName}位）`, tai: 1 });
                totalTai += 1;
            }
        }

        // 花槓 (Complete flower set = 2 台 each)
        const hasAllSeasons = ['s1', 's2', 's3', 's4'].every(f => flowers.includes(f));
        const hasAllPlants = ['f1', 'f2', 'f3', 'f4'].every(f => flowers.includes(f));
        if (hasAllSeasons) {
            details.push({ name: '花槓（春夏秋冬）', tai: 2 });
            totalTai += 2;
        }
        if (hasAllPlants) {
            details.push({ name: '花槓（梅蘭菊竹）', tai: 2 });
            totalTai += 2;
        }

        // 八仙過海 (All 8 flowers)
        if (flowerCount === 8) {
            details.push({ name: '八仙過海', tai: 8 });
            totalTai += 8;
        }

        // === 2. BUILD TILE DATA ===
        // Combine hand + open melds for overall tile analysis
        const allTiles = [...hand];
        openMelds.forEach(m => {
            if (m.tiles && Array.isArray(m.tiles)) {
                allTiles.push(...m.tiles);
            } else if (m.tile) {
                if (m.type === 'pong') allTiles.push(m.tile, m.tile, m.tile);
                else if (m.type === 'kong') allTiles.push(m.tile, m.tile, m.tile, m.tile);
            }
        });

        const counts = {};
        allTiles.forEach(t => { counts[t] = (counts[t] || 0) + 1; });

        // Decompose standing hand for accurate analysis
        const decomps = this.decomposeHand(hand);
        // Get all triplets: from open melds + best hand decomposition
        const openPongs = openMelds.filter(m => m.type === 'pong' || m.type === 'kong');
        const openChis = openMelds.filter(m => m.type === 'chi');

        // Find best decomposition (prefer one with most pongs for碰碰胡 check, etc.)
        let bestDecomp = decomps[0] || { pair: null, sets: [] };

        // All sets (open + standing hand)
        const allSets = [...openMelds.map(m => m.type), ...bestDecomp.sets.map(s => s.type)];
        const handPongCount = bestDecomp.sets.filter(s => s.type === 'pong').length;
        const handChiCount = bestDecomp.sets.filter(s => s.type === 'chi').length;
        const totalPongs = openPongs.length + handPongCount;
        const totalChis = openChis.length + handChiCount;

        // === 3. DRAGON SCORING (三元牌) ===
        const dragonPongCount = ['zhong', 'fa', 'bai'].filter(d => counts[d] >= 3).length;
        const dragonPairCount = ['zhong', 'fa', 'bai'].filter(d => counts[d] === 2).length;

        ['zhong', 'fa', 'bai'].forEach(dragon => {
            if (counts[dragon] >= 3) {
                details.push({ name: `${this.getTileName(dragon)}`, tai: 1 });
                totalTai += 1;
            }
        });

        // 小三元 (2 dragon pongs + 1 dragon pair)
        if (dragonPongCount === 2 && dragonPairCount >= 1) {
            details.push({ name: '小三元', tai: 4 });
            totalTai += 4;
        }

        // 大三元 (3 dragon pongs)
        if (dragonPongCount === 3) {
            details.push({ name: '大三元', tai: 8 });
            totalTai += 8;
        }

        // === 4. WIND SCORING (風牌) ===
        const winds = ['dong', 'nan', 'xi', 'bei'];
        const windPongCount = winds.filter(w => counts[w] >= 3).length;
        const windPairCount = winds.filter(w => counts[w] === 2).length;

        winds.forEach(w => {
            if (counts[w] >= 3) {
                let name = '';
                let tai = 0;
                if (w === context.roundWind) { name += '圈風 '; tai++; }
                if (w === context.seatWind) { name += '門風 '; tai++; }
                if (tai > 0) {
                    details.push({ name: `${name}${this.getTileName(w)}`, tai: tai });
                    totalTai += tai;
                }
            }
        });

        // 小四喜 (3 wind pongs + 1 wind pair)
        if (windPongCount === 3 && windPairCount >= 1) {
            details.push({ name: '小四喜', tai: 8 });
            totalTai += 8;
        }

        // 大四喜 (4 wind pongs)
        if (windPongCount === 4) {
            details.push({ name: '大四喜', tai: 16 });
            totalTai += 16;
        }

        // === 5. SUIT SCORING ===
        const suits = new Set();
        let hasHonor = false;
        allTiles.forEach(t => {
            if (['m', 'p', 's'].includes(t.slice(-1))) suits.add(t.slice(-1));
            else hasHonor = true;
        });

        if (suits.size === 0 && hasHonor) {
            // 字一色 (All Honors)
            details.push({ name: '字一色', tai: 16 });
            totalTai += 16;
        } else if (suits.size === 1) {
            if (!hasHonor) {
                details.push({ name: '清一色', tai: 8 });
                totalTai += 8;
            } else {
                details.push({ name: '混一色', tai: 4 });
                totalTai += 4;
            }
        }

        // === 6. HAND STRUCTURE SCORING ===

        // 碰碰胡 (All Pongs) - all sets are pongs/kongs, no chis
        // Check: no open chi, and hand decomposes to all pongs
        const isAllPongs = (totalChis === 0 && totalPongs >= 1);
        // Also verify via decomposition: try to find a decomp with 0 chis
        const hasAllPongDecomp = decomps.some(d =>
            d.sets.every(s => s.type === 'pong') && openChis.length === 0
        );
        if (hasAllPongDecomp && totalPongs >= 1) {
            details.push({ name: '碰碰胡', tai: 4 });
            totalTai += 4;
        }

        // 平胡 (All Chows) - no flowers, no pongs, all sequences, no honor tiles
        const noFlowers = flowerCount === 0;
        const noOpenPongs = openPongs.length === 0;
        // Check hand decomposition for all-chi
        const hasAllChiDecomp = decomps.some(d => {
            const handHasNoPong = d.sets.every(s => s.type === 'chi');
            // Pair should not be honor for strict 平胡
            const pairIsNotHonor = this.isSuit(d.pair);
            return handHasNoPong && pairIsNotHonor;
        });
        if (noFlowers && noOpenPongs && hasAllChiDecomp && !hasHonor) {
            details.push({ name: '平胡', tai: 2 });
            totalTai += 2;
        }

        // 全求人 (All melds from others, hand is just the pair)
        if (openMelds.length >= 4 && hand.length <= 2) {
            // Won from discard (not self-draw), all sets are open
            if (!context.isSelfDraw) {
                details.push({ name: '全求人', tai: 2 });
                totalTai += 2;
            }
        }

        // === 7. WIN METHOD SCORING ===

        // 自摸 (Self Draw)
        if (context.isSelfDraw) {
            details.push({ name: '自摸', tai: 1 });
            totalTai += 1;
        }

        // 門清 (Concealed Hand - no open melds)
        if (openMelds.length === 0) {
            details.push({ name: '門清', tai: 1 });
            totalTai += 1;
        }

        // 門清自摸 (Concealed Self-Draw = extra bonus)
        if (openMelds.length === 0 && context.isSelfDraw) {
            details.push({ name: '門清自摸', tai: 3 });
            totalTai += 3;
        }

        // 海底撈月 / 海底撈砲 (Last tile win)
        if (context.isLastTile) {
            if (context.isSelfDraw) {
                details.push({ name: '海底撈月', tai: 1 });
                totalTai += 1;
            } else {
                details.push({ name: '海底撈砲', tai: 1 });
                totalTai += 1;
            }
        }

        // 槓上開花 (Win on Kong replacement draw)
        if (context.isKongDraw && context.isSelfDraw) {
            details.push({ name: '槓上開花', tai: 1 });
            totalTai += 1;
        }

        // 搶槓 (Robbing a Kong)
        if (context.isRobKong) {
            details.push({ name: '搶槓', tai: 1 });
            totalTai += 1;
        }

        // === 8. WAITING PATTERN SCORING (聽牌方式) ===
        // Requires context.winningTile to analyze how the winning tile fits
        if (context.winningTile) {
            const wt = context.winningTile;
            // Analyze across all valid decompositions how the winning tile is used
            const waitResult = this._analyzeWait(hand, openMelds, wt, decomps);
            if (waitResult.isDanDiao) {
                details.push({ name: '單吊（獨聽）', tai: 1 });
                totalTai += 1;
            }
            if (waitResult.isBianZhang) {
                details.push({ name: '邊張', tai: 1 });
                totalTai += 1;
            }
            if (waitResult.isKanZhang) {
                details.push({ name: '嵌張（坎張）', tai: 1 });
                totalTai += 1;
            }
        }

        // === 9. SPECIAL CONDITIONS ===

        // 連莊加台 (連N拉N)
        if (context.isDealer && context.lianZhuang > 0) {
            details.push({ name: `連${context.lianZhuang}拉${context.lianZhuang}`, tai: context.lianZhuang });
            totalTai += context.lianZhuang;
        }

        return { total: totalTai, details: details };
    },

    // Analyze waiting pattern: how does the winning tile fit into the hand?
    // Returns { isDanDiao, isBianZhang, isKanZhang }
    _analyzeWait(hand, openMelds, winTile, decomps) {
        // Remove winning tile from hand to get the "waiting hand"
        const waitHand = [...hand];
        const idx = waitHand.indexOf(winTile);
        if (idx !== -1) waitHand.splice(idx, 1);

        // Get decompositions of the full hand (with winning tile) = decomps param
        // For each decomposition, find which set/pair the winning tile belongs to
        let isDanDiao = false;
        let isBianZhang = false;
        let isKanZhang = false;

        for (const decomp of decomps) {
            // Check if winning tile is the pair (單吊)
            if (decomp.pair === winTile) {
                // Verify: removing the winning tile from pair leaves 1 tile
                // This is 單吊 if the winning tile completes the pair
                // Check that hand without winTile has exactly 1 of this tile
                const countInWait = this.countTiles(waitHand, winTile);
                if (countInWait === 1) {
                    isDanDiao = true;
                }
            }

            // Check if winning tile is part of a sequence (邊張 / 嵌張)
            for (const set of decomp.sets) {
                if (set.type === 'chi' && set.tiles.includes(winTile)) {
                    const tiles = set.tiles.sort();
                    const nums = tiles.map(t => parseInt(t[0]));
                    const suit = tiles[0].slice(-1);
                    const winNum = parseInt(winTile[0]);

                    // 邊張 (Edge wait): 12 waiting for 3, or 89 waiting for 7
                    if (nums[0] === 1 && nums[2] === 3 && winNum === 3) {
                        isBianZhang = true;
                    }
                    if (nums[0] === 7 && nums[2] === 9 && winNum === 7) {
                        isBianZhang = true;
                    }

                    // 嵌張 (Closed wait / middle wait): e.g. 1_3 waiting for 2
                    if (winNum === nums[1] && winNum !== nums[0] && winNum !== nums[2]) {
                        // The winning tile is the middle tile of the sequence
                        isKanZhang = true;
                    }
                }
            }
        }

        // If multiple decompositions give different results, use most favorable
        // (In practice, if ANY decomp shows it's not 單吊/邊/嵌, it's not counted)
        // But Taiwan rules: if there exists a decomposition where it IS a special wait, it counts
        return { isDanDiao, isBianZhang, isKanZhang };
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
