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

    // --- Scoring Main Function ---
    // Returns { totalTai: number, details: Array<{name, tai}> }
    // hand: Array of tiles (including winning tile)
    // openMelds: Array of melds [{type: 'pong', tile: '1m'}, ...]
    // flowers: Array of flower tiles
    // context: { roundWind: 'dong', seatWind: 'nan', isSelfDraw: boolean,
    //            lianZhuang: number, isDealer: boolean }
    calculateScore(hand, openMelds, flowers, context) {
        const details = [];
        let totalTai = 0;

        // 1. Flowers (花牌計算)
        // Each flower = 1 台 (base)
        const flowerCount = flowers.length;
        if (flowerCount > 0) {
            details.push({ name: `花牌 x${flowerCount}`, tai: flowerCount });
            totalTai += flowerCount;
        }

        // 1b. 正花 (Matching flower to seat wind)
        // 東=1, 南=2, 西=3, 北=4
        // Seasons: s1=春(東), s2=夏(南), s3=秋(西), s4=冬(北)
        // Plants:  f1=梅(東), f2=蘭(南), f3=菊(西), f4=竹(北)
        const seatWindIdx = ['dong', 'nan', 'xi', 'bei'].indexOf(context.seatWind);
        if (seatWindIdx >= 0) {
            const matchNum = seatWindIdx + 1; // 1-4
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

        // 1c. 花槓 (Complete flower set = 2 台 each)
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

        // 1d. 八仙過海 (All 8 flowers = automatic win, treated as self-draw)
        if (flowerCount === 8) {
            details.push({ name: '八仙過海', tai: 8 });
            totalTai += 8;
        }

        // 2. Winds / Dragons (Pongs/Kongs)
        // Combine hand + melds to find triplets
        const allTiles = [...hand];
        openMelds.forEach(m => {
            // Reconstruct meld tiles
            if (m.type === 'pong') { allTiles.push(m.tile, m.tile, m.tile); }
            if (m.type === 'kong') { allTiles.push(m.tile, m.tile, m.tile, m.tile); }
            if (m.type === 'chi') { /* No honor chi */ }
        });

        const counts = {};
        allTiles.forEach(t => counts[t] = (counts[t] || 0) + 1);

        // Dragons: Zhong, Fa, Bai
        ['zhong', 'fa', 'bai'].forEach(dragon => {
            if (counts[dragon] >= 3) {
                details.push({ name: `${this.getTileName(dragon)}`, tai: 1 });
                totalTai += 1;
            }
        });

        // Winds: Round & Seat
        const winds = ['dong', 'nan', 'xi', 'bei'];
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

        // 3. Suits (Flush / Half Flush)
        const suits = new Set();
        let hasHonor = false;
        allTiles.forEach(t => {
            if (['m', 'p', 's'].includes(t.slice(-1))) suits.add(t.slice(-1));
            else hasHonor = true;
        });

        if (suits.size === 1) {
            if (!hasHonor) {
                details.push({ name: '清一色', tai: 8 });
                totalTai += 8;
            } else {
                details.push({ name: '混一色', tai: 4 });
                totalTai += 4;
            }
        }

        // 4. All Pongs (碰碰胡)
        const hasOpenSeq = openMelds.some(m => m.type === 'chi');
        if (!hasOpenSeq) {
            // Heuristic: If we can form valid hand using ONLY triplets + 1 pair.
            // We'll skip strict verification for simplicity unless user demands robustness.
            // For now, simple heuristic: All Pongs = 4 Tai.
            // But we need to be careful not to award it if hand actually has sequences.
            // (Skipping detailed check for now)
        }

        // --- Ping Hu (平胡) ---
        // Rules: No Flowers, No Open/Hidden Pongs (except pair?), All Sequences.
        // Taiwan Ping Hu: 2 Tai.
        // Simplified Logic: 
        // 1. No Flowers
        const noFlowers = flowerCount === 0; // Use flowerCount from above
        // 2. No Open Pongs/Kongs
        const noOpenPongs = !openMelds.some(m => m.type === 'pong' || m.type === 'kong');

        // 3. Hand Decomp Check (Simplified)
        // If "Ping Hu", we should NOT have Triplets.
        // Max count of any tile (hand + open) should be <= 2? (Except 3 identical seq?)
        // Let's use `counts` object calculated earlier.
        // If any tile count >= 3, it's LIKELY a Triplet (Pong/Kong), unless it's 3 identical sequences (rare).
        // So checking max(counts) <= 2 is a strong specific check for "All Sequences".
        const maxTileCount = Math.max(...Object.values(counts));

        if (noFlowers && noOpenPongs && maxTileCount <= 2 && hasOpenSeq) { // Must have at least one sequence or be closed?
            // Actually valid Ping Hu can be fully concealed (Men Qing Ping Hu).
            // But usually requires "Win on Discard" (Ron) for Ping Hu?
            // Self-Draw Ping Hu is often "No Ping Hu"? (Taiwan rules vary).
            // Common Rule: Ping Hu is mutually exclusive with "All Pairs" / "All Pongs".
            // If MaxCount <= 2, it CANNOT be All Pongs.
            // So if No Flowers & No Open Pongs & MaxCount <= 2:
            details.push({ name: '平胡', tai: 2 });
            totalTai += 2;
        }

        // 5. Self Draw
        if (context.isSelfDraw) {
            details.push({ name: '自摸', tai: 1 });
            totalTai += 1;
        }

        // 5b. 海底撈月 / 海底撈砲 (Last tile win)
        if (context.isLastTile) {
            if (context.isSelfDraw) {
                details.push({ name: '海底撈月', tai: 1 });
                totalTai += 1;
            } else {
                details.push({ name: '海底撈砲', tai: 1 });
                totalTai += 1;
            }
        }

        // 6. Door Clear (Men-Qing) -> No open melds (except concealed kong? Simplified: No open)
        if (openMelds.length === 0) { // && context.isSelfDraw usually?
            // Taiwan rules: Men Qing (No open) = 1 Tai.
            // Usually implies Self Draw? Or Ron too?
            // Men Qing Ron = 1 Tai. Men Qing Tsumo = 1 (MenQing) + 1 (Tsumo) + ?
            // Some rules say Men Qing Tsumo = 3 Tai.
            // We stick to base: Men Qing = 1 Tai.
            details.push({ name: '門清', tai: 1 });
            totalTai += 1;
        }

        // 7. 連莊加台 (連N拉N)
        // 莊家胡牌時，連莊次數 = 額外台數
        // 例：連一拉一 = +1台，連二拉二 = +2台
        if (context.isDealer && context.lianZhuang > 0) {
            details.push({ name: `連${context.lianZhuang}拉${context.lianZhuang}`, tai: context.lianZhuang });
            totalTai += context.lianZhuang;
        }

        return { total: totalTai, details: details };
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
