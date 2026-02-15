/**
 * usage:
 * const logic = new MahjongLogic();
 * const tai = logic.calculateTai(hand);
 */

class MahjongLogic {
    constructor() {
        this.tiles = [];
        this.TILES = {
            WAN: ['1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m'],
            TONG: ['1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p'],
            SOU: ['1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s'],
            HONOR: [
                'dong', 'nan', 'xi', 'bei', // Winds: East, South, West, North
                'zhong', 'fa', 'bai'        // Dragons: Red, Green, White
            ],
            // Flower tiles are usually handled separately as bonus tiles, but kept here for reference
            FLOWER: ['chun', 'xia', 'qiu', 'dong_f', 'mei', 'lan', 'zhu', 'ju']
        };
    }

    // --- Core Data Structures ---

    /**
     * Converts internal ID to readable name
     * e.g. '1m' -> '一萬', 'dong' -> '東風'
     */
    getTileName(tileId) {
        // TODO: Implement mapping
        return tileId;
    }

    // --- Tai Calculation (Scoring) ---

    /**
     * Calculates the Tai (points) for a winning hand.
     * @param {Array} hand - Array of tile IDs (e.g. ['1m', '1m', '1m', ...])
     * @param {Object} context - Game context (wind, flower, etc.)
     * @returns {Object} { valid: boolean, totalTai: number, breakdown: [] }
     */
    calculateTai(hand, context = {}) {
        // Basic validation: Hand size should be 17 for a win (16 + 1)
        if (hand.length !== 17) {
            return { valid: false, reason: 'Invalid hand size (must be 17)', totalTai: 0, breakdown: [] };
        }

        const breakdown = [];
        let totalTai = 0;

        // 1. Sort hand
        const sortedHand = [...hand].sort();

        // 2. Check for Standard Win (5 sets + 1 pair)
        const winPlan = this.checkStandardWin(sortedHand);

        if (!winPlan) {
            // TODO: Check for 7 Pairs or 8 Pairs if supporting those variants
            return { valid: false, reason: 'Not a winning hand', totalTai: 0, breakdown: [] };
        }

        // --- Winning Hand Confirmed, Calculate Tai ---

        // [Pattern] All Pongs (Pung-Pung Hu) - 4 Tai
        if (this.isAllPongs(winPlan)) {
            breakdown.push({ name: '碰碰胡 (All Pongs)', tai: 4 });
            totalTai += 4;
        }

        // [Pattern] Mixed One Suit (Hun Yi Se) - 4 Tai
        if (this.isMixedOneSuit(sortedHand)) {
            breakdown.push({ name: '混一色 (Mixed One Suit)', tai: 4 });
            totalTai += 4;
        }

        // [Pattern] Pure One Suit (Qing Yi Se) - 8 Tai
        if (this.isPureOneSuit(sortedHand)) {
            breakdown.push({ name: '清一色 (Pure One Suit)', tai: 8 });
            totalTai += 8;
        }

        // [Pattern] Big Three Dragons (Da San Yuan) - 8 Tai
        if (this.hasBigThreeDragons(sortedHand)) {
            breakdown.push({ name: '大三元 (Big Three Dragons)', tai: 8 });
            totalTai += 8;
        }

        // [Pattern] Small Three Dragons (Xiao San Yuan) - 4 Tai
        if (this.hasSmallThreeDragons(sortedHand)) {
            breakdown.push({ name: '小三元 (Small Three Dragons)', tai: 4 });
            totalTai += 4;
        }

        // [Pattern] All Honours (Zi Yi Se) - 16 Tai
        if (this.isAllHonors(sortedHand)) {
            breakdown.push({ name: '字一色 (All Honors)', tai: 16 });
            totalTai += 16;
        }

        // [Pattern] Ping Hu (Plain) - 2 Tai (Taiwan Rules: usually need no flowers, no pongs, etc.)
        // Implementing a simplified Ping Hu check: All Chows + Pair is not logic/dragon/wind (strictly)
        if (this.isPingHu(winPlan, sortedHand)) {
            breakdown.push({ name: '平胡 (Ping Hu)', tai: 2 });
            totalTai += 2;
        }

        return { valid: true, totalTai, breakdown };
    }

    // --- Helper Functions for Win Checking ---

    /**
     * Recursive function to checks if the hand can be arranged into 5 sets + 1 pair.
     * Returns the 'plan' (array of sets) if valid, null otherwise.
     */
    checkStandardWin(handTiles) {
        // Frequency map
        const counts = this.getCounts(handTiles);

        // Try every possible pair
        const uniqueTiles = Object.keys(counts);
        for (const pairTile of uniqueTiles) {
            if (counts[pairTile] >= 2) {
                // Remove pair
                const remCounts = { ...counts };
                remCounts[pairTile] -= 2;
                if (remCounts[pairTile] === 0) delete remCounts[pairTile];

                // Check if remaining 15 tiles form 5 sets
                const sets = this.canFormSets(remCounts, 5);
                if (sets) {
                    return { pair: pairTile, sets: sets };
                }
            }
        }
        return null;
    }

    /**
     * Tries to form N sets from the remaining tiles.
     * Sets can be Triplet (3 identical) or Sequence (3 consecutive).
     */
    canFormSets(counts, setsNeeded) {
        if (setsNeeded === 0) return [];

        // Find first available tile
        const tiles = Object.keys(counts).sort();
        if (tiles.length === 0) return null;

        const first = tiles[0];

        // 1. Try Triplet (Pong)
        if (counts[first] >= 3) {
            const newCounts = { ...counts };
            newCounts[first] -= 3;
            if (newCounts[first] === 0) delete newCounts[first];

            const res = this.canFormSets(newCounts, setsNeeded - 1);
            if (res) return [{ type: 'pong', tiles: [first, first, first] }, ...res];
        }

        // 2. Try Sequence (Chow)
        // Must be numerical suit
        if (this.isNumberTile(first)) {
            const t1 = first;
            const t2 = this.getNextTile(t1);
            const t3 = this.getNextTile(t2);

            if (t2 && t3 && counts[t2] > 0 && counts[t3] > 0) {
                const newCounts = { ...counts };
                newCounts[t1]--;
                newCounts[t2]--;
                newCounts[t3]--;
                if (newCounts[t1] === 0) delete newCounts[t1];
                if (newCounts[t2] === 0) delete newCounts[t2];
                if (newCounts[t3] === 0) delete newCounts[t3];

                const res = this.canFormSets(newCounts, setsNeeded - 1);
                if (res) return [{ type: 'chow', tiles: [t1, t2, t3] }, ...res];
            }
        }

        return null;
    }

    isNumberTile(tile) {
        return !['dong', 'nan', 'xi', 'bei', 'zhong', 'fa', 'bai', 'chun', 'xia', 'qiu', 'dong_f', 'mei', 'lan', 'zhu', 'ju'].includes(tile);
    }

    getNextTile(tile) {
        const suit = tile.slice(-1);
        const num = parseInt(tile.slice(0, -1));
        if (isNaN(num) || num >= 9) return null;
        return (num + 1) + suit;
    }

    // --- Pattern Checkers ---

    isAllPongs(winPlan) {
        return winPlan.sets.every(s => s.type === 'pong');
    }

    isMixedOneSuit(hand) {
        const suits = new Set(hand.map(t => this.getSuit(t)));
        const hasHonor = hand.some(t => this.getSuit(t) === 'honor');
        const numericSuits = [...suits].filter(s => s !== 'honor');
        return hasHonor && numericSuits.length === 1;
    }

    isPureOneSuit(hand) {
        const suits = new Set(hand.map(t => this.getSuit(t)));
        return suits.size === 1 && !suits.has('honor') && !suits.has('flower');
    }

    isAllHonors(hand) {
        return hand.every(t => this.getSuit(t) === 'honor');
    }

    hasBigThreeDragons(hand) {
        const counts = this.getCounts(hand);
        return (counts['zhong'] || 0) >= 3 && (counts['fa'] || 0) >= 3 && (counts['bai'] || 0) >= 3;
    }

    hasSmallThreeDragons(hand) {
        const counts = this.getCounts(hand);
        let dragons = 0;
        let dragonPairs = 0;
        if ((counts['zhong'] || 0) >= 3) dragons++;
        if ((counts['fa'] || 0) >= 3) dragons++;
        if ((counts['bai'] || 0) >= 3) dragons++;
        if ((counts['zhong'] || 0) === 2) dragonPairs++;
        if ((counts['fa'] || 0) === 2) dragonPairs++;
        if ((counts['bai'] || 0) === 2) dragonPairs++;

        return dragons === 2 && dragonPairs === 1;
    }

    isPingHu(winPlan, hand) {
        // Ping Hu: All Chows, No Flowers (assumed 0 flowers in hand array), Pair is not Dragon/Own Wind/Round Wind?
        // Simplified: All sets are Chows.
        return winPlan.sets.every(s => s.type === 'chow');
    }

    getSuit(tile) {
        if (tile.endsWith('m')) return 'wan';
        if (tile.endsWith('p')) return 'tong';
        if (tile.endsWith('s')) return 'sou';
        return 'honor';
    }

    getCounts(hand) {
        const c = {};
        for (const t of hand) c[t] = (c[t] || 0) + 1;
        return c;
    }

    // --- Strategy / Efficiency ---

    /**
     * Calculates Shanten (moves to ready).
     * Standard method: 8 - 2*Sets - Partials - Pair
     * Returns minimal shanten.
     * 0 = Tenpai (Ready), -1 = Agari (Win).
     */
    calculateShanten(hand) {
        try {
            // Simple 4-set + 1-pair shanten
            const counts = this.getCounts(hand);
            const res = this.getSplits(counts);
            return res.shanten;
        } catch (e) {
            console.error('Error in calculateShanten:', e);
            return 8; // Fallback
        }
    }

    /**
     * Recommends the best discard based on tile efficiency.
     * @param {Array} hand 
     * @returns {Array} List of suggestions sorted by efficiency
     */
    recommendDiscard(hand, scoring = { base: 100, tai: 20 }) {
        if (hand.length % 3 !== 2) {
            // usually should have 17 tiles
        }

        const initialShanten = this.calculateShanten(hand);
        const candidates = [];
        const uniqueTiles = [...new Set(hand)];
        const visibleCounts = this.getCounts(hand); // Approximation for user hand only

        for (const tile of uniqueTiles) {
            const newHand = [...hand];
            const idx = newHand.indexOf(tile);
            newHand.splice(idx, 1);

            const s = this.calculateShanten(newHand);
            candidates.push({ tile, shanten: s });
        }

        candidates.sort((a, b) => a.shanten - b.shanten);
        if (candidates.length === 0) return [];

        const bestShanten = candidates[0].shanten;
        const bestCandidates = candidates.filter(c => c.shanten === bestShanten);

        for (const cand of bestCandidates) {
            const tempHand = [...hand];
            tempHand.splice(tempHand.indexOf(cand.tile), 1);

            const ukeire = this.calculateUkeire(tempHand, bestShanten);
            cand.ukeire = ukeire;

            // Calculate Expected Tai/Score
            // EV = Sum (Prob(Wait_w) * Score(Win_w))
            // Probability approx = (Remaining Count of w) / (Unknown Tiles)
            // Score = Base + Tai * TaiValue

            let totalEV = 0;
            let totalWeightedTai = 0;
            let totalProp = 0;

            for (const waitTile of ukeire.tiles) {
                // Approximate score if we win on this wait
                // We construct a 'winning hand' by adding waitTile
                const winHand = [...tempHand, waitTile];
                const taiResult = this.calculateTai(winHand);

                let tai = taiResult.totalTai;
                // If invalid win (shouldn't happen if reliable), 0.
                if (!taiResult.valid) tai = 0;

                // Adjust for self-draw? For now, assume simple win.
                // Score depends on Tai.
                // EV contribution from this tile:
                // Count * Score? 

                // Let's count specific remaining tiles of this type
                // Assumption: 4 - visible in hand.
                const inHand = visibleCounts[waitTile] || 0;
                const remaining = 4 - inHand; // TODO: Minus board discards if tracked

                const score = scoring.base + (tai * scoring.tai);

                totalEV += remaining * score;
                totalWeightedTai += remaining * tai;
                totalProp += remaining;
            }

            cand.ev = totalProp > 0 ? (totalEV / totalProp) : 0; // Average Score per Win?
            // Or Total Value (Sum of all possibilities)? 
            // "Expected Value" usually implies prob * payoff.
            // Here: Sum(Count * Score). This is "Total Potential Score Mass".
            // To get "Expected Score given Win", divide by count.
            // To get "Expected Score next draw", divide by ~120?

            // Let's return Total Weight (Score * Count) as a metric of "Attack Power".
            cand.scorePotential = totalEV;
            cand.avgTai = totalProp > 0 ? (totalWeightedTai / totalProp) : 0;
        }

        // Sort by Efficiency (Count) then Potential
        bestCandidates.sort((a, b) => {
            if (b.ukeire.count !== a.ukeire.count) return b.ukeire.count - a.ukeire.count;
            return b.scorePotential - a.scorePotential;
        });

        return bestCandidates.map(c => ({
            tile: c.tile,
            shanten: c.shanten,
            waits: c.ukeire.tiles,
            count: c.ukeire.count,
            avgTai: c.avgTai,
            scorePotential: c.scorePotential
        }));
    }

    // --- Shanten Helpers ---

    calculateUkeire(hand16, currentShanten) {
        const allTiles = this.getAllTileTypes();
        const useful = [];
        let totalCount = 0; // count of *remaining* visible tiles? No, just abstract count for now (4 per type max).

        const baseShanten = this.calculateShanten(hand16);

        for (const t of allTiles) {
            const h = [...hand16, t];
            const s = this.calculateShanten(h);
            if (s < baseShanten) {
                useful.push(t);
                // In a real game, checking remaining count is crucial. 
                // Here we assume 4 max.
                // We can check 'hand16' to see how many we hold.
                const held = hand16.filter(x => x === t).length;
                totalCount += (4 - held);
            }
        }

        return { tiles: useful, count: totalCount };
    }

    getAllTileTypes() {
        if (this._allTypes) return this._allTypes;
        this._allTypes = [
            ...this.TILES.WAN, ...this.TILES.TONG, ...this.TILES.SOU, ...this.TILES.HONOR
        ];
        return this._allTypes;
    }

    getSplits(counts) {
        let minShanten = 20;

        // Option A: With a Pair
        const tiles = Object.keys(counts);
        for (const t of tiles) {
            if (counts[t] >= 2) {
                const c = { ...counts };
                c[t] -= 2;
                if (c[t] === 0) delete c[t];

                const res = this.searchGroups(c);
                // Groups (sets + partials)
                let s = res.sets;
                let p = res.partials;

                // Cap groups at 5
                if (s + p > 5) p = 5 - s;

                // Score
                const score = 10 - 2 * s - p;
                if (score < minShanten) minShanten = score;
            }
        }

        // Option B: No Pair (or pair is part of partial)
        const res = this.searchGroups(counts);
        let s = res.sets;
        let p = res.partials;
        if (s + p > 5) p = 5 - s;
        const scoreOnly = 11 - 2 * s - p;
        if (scoreOnly < minShanten) minShanten = scoreOnly;

        return { shanten: minShanten };
    }

    searchGroups(counts) {
        let best = { sets: 0, partials: 0 };

        const tiles = Object.keys(counts).sort();
        if (tiles.length === 0) return best;

        const first = tiles[0];

        // 1. Try Set (Pong)
        if (counts[first] >= 3) {
            const c = { ...counts };
            c[first] -= 3;
            if (c[first] === 0) delete c[first];
            const res = this.searchGroups(c);
            if (1 + res.sets > best.sets || (1 + res.sets === best.sets && res.partials > best.partials)) {
                best = { sets: 1 + res.sets, partials: res.partials };
            }
        }

        // 2. Try Set (Chow)
        if (this.isNumberTile(first)) {
            const t1 = first;
            const t2 = this.getNextTile(t1);
            const t3 = this.getNextTile(t2);
            if (t2 && t3 && counts[t2] && counts[t3]) {
                const c = { ...counts };
                c[t1]--; c[t2]--; c[t3]--;
                if (c[t1] === 0) delete c[t1];
                if (c[t2] === 0) delete c[t2];
                if (c[t3] === 0) delete c[t3];
                const res = this.searchGroups(c);
                // Prefer sets
                const s = 1 + res.sets;
                if (s > best.sets || (s === best.sets && res.partials > best.partials)) {
                    best = { sets: s, partials: res.partials };
                }
            }
        }

        // 3. Try Partial (Pair) -> Only if we have space?
        if (counts[first] >= 2) {
            const c = { ...counts };
            c[first] -= 2;
            if (c[first] === 0) delete c[first];
            const res = this.searchGroups(c);
            // Partial
            const s = res.sets;
            const p = 1 + res.partials;
            // Compare (2*s + p) against best (2*best.sets + best.partials)
            if (2 * s + p > 2 * best.sets + best.partials) {
                best = { sets: s, partials: p };
            }
        }

        // 4. Try Partial (Ryanmen/Kanchan/Penchan) -> Sequence partials
        if (this.isNumberTile(first)) {
            const t1 = first;
            const t2 = this.getNextTile(t1);
            // 1-2 wait for 3
            if (t2 && counts[t2]) {
                const c = { ...counts };
                c[t1]--; c[t2]--;
                if (c[t1] === 0) delete c[t1];
                if (c[t2] === 0) delete c[t2];
                const res = this.searchGroups(c);
                const s = res.sets;
                const p = 1 + res.partials;
                if (2 * s + p > 2 * best.sets + best.partials) {
                    best = { sets: s, partials: p };
                }
            }
            // 1-3 wait for 2 (Kanchan)
            const t3 = (t2 ? this.getNextTile(t2) : null);
            if (t3 && counts[t3]) {
                const c = { ...counts };
                c[t1]--; c[t3]--;
                if (c[t1] === 0) delete c[t1];
                if (c[t3] === 0) delete c[t3];
                const res = this.searchGroups(c);
                const s = res.sets;
                const p = 1 + res.partials;
                if (2 * s + p > 2 * best.sets + best.partials) {
                    best = { sets: s, partials: p };
                }
            }
        }

        // 5. Skip tile (treat as isolated)
        {
            const c = { ...counts };
            c[first]--;
            if (c[first] === 0) delete c[first];
            const res = this.searchGroups(c);
            if (2 * res.sets + res.partials > 2 * best.sets + best.partials) {
                best = res;
            }
        }

        return best;
    }
}

// Export for use in app.js
if (typeof window !== 'undefined') {
    window.MahjongLogic = MahjongLogic;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MahjongLogic;
}
