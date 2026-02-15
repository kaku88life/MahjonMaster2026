const MahjongLogic = require('../js/mahjong-logic');
const logic = new MahjongLogic();

function test(name, hand, expectedTai, expectedValid = true) {
    console.log(`Running test: ${name}`);
    const result = logic.calculateTai(hand);

    if (result.valid !== expectedValid) {
        console.error(`FAILED: Expected valid=${expectedValid}, got ${result.valid}. Reason: ${result.reason}`);
        return;
    }

    if (expectedValid) {
        if (result.totalTai !== expectedTai) {
            console.error(`FAILED: Expected ${expectedTai} Tai, got ${result.totalTai}`);
            console.log('Breakdown:', result.breakdown);
        } else {
            console.log(`PASSED: ${expectedTai} Tai`);
        }
    } else {
        console.log('PASSED: Correctly identified as invalid');
    }
}

// Case 1: All Pongs (Pong Pong Hu)
// 1m 1m 1m, 2p 2p 2p, 3s 3s 3s, dong dong dong, nan nan nan, beibei
// Wait, 5 sets (3*5=15) + pair (2) = 17 tiles.
// 1m x3, 2p x3, 3s x3, dong x3, nan x3, bei x2.
const allPongs = [
    '1m', '1m', '1m',
    '2p', '2p', '2p',
    '3s', '3s', '3s',
    'dong', 'dong', 'dong',
    'nan', 'nan', 'nan',
    'bei', 'bei'
];
test('All Pongs (4 Tai)', allPongs, 4);

// Case 2: Mixed One Suit (Hun Yi Se)
// Wan + Honors
// 1m 1m 1m, 2m 3m 4m, 5m 6m 7m, dong dong dong, nan nan nan, bai bai
const mixedOneSuit = [
    '1m', '1m', '1m',
    '2m', '3m', '4m', // chow
    '5m', '6m', '7m', // chow
    'dong', 'dong', 'dong',
    'nan', 'nan', 'nan',
    'bai', 'bai'
];
// Mixed One Suit (4) + All Pongs? No, 2 chows.
// Mixed One Suit (4) + (Maybe Pong of Dong/Nan?) - Logic currently doesn't count Pongs of Winds as Tai unless we add it. 
// Just testing Mixed One Suit detection here.
test('Mixed One Suit (4 Tai base)', mixedOneSuit, 4);

// Case 3: Pure One Suit (Qing Yi Se)
const pureOneSuit = [
    '1m', '1m', '1m',
    '2m', '3m', '4m',
    '5m', '6m', '7m',
    '8m', '8m', '8m',
    '9m', '9m', '9m',
    '1m', '1m' // Pair
];
// Pure One Suit (8) + All Pongs? No.
// Just testing Pure One Suit.
test('Pure One Suit (8 Tai base)', pureOneSuit, 8);

// Case 4: Big Three Dragons
const bigThreeDragons = [
    'zhong', 'zhong', 'zhong',
    'fa', 'fa', 'fa',
    'bai', 'bai', 'bai',
    '1m', '2m', '3m',
    '4p', '5p', '6p',
    '7s', '7s'
];
test('Big Three Dragons (8 Tai)', bigThreeDragons, 8);

console.log('\n--- Testing Shanten ---');

function testShanten(name, hand, expectedShanten) {
    console.log(`Test Shanten: ${name}`);
    const s = logic.calculateShanten(hand);
    if (s !== expectedShanten) {
        console.error(`FAILED: Expected ${expectedShanten}, got ${s}`);
    } else {
        console.log(`PASSED: Shanten ${s}`);
    }
}

// Tenpai (0 Shanten) - Waiting for 1 tile
// 123 456 789(wan) 123(tong) 99(sou) -> Win
// Remove one 9sou -> 16 tiles. Waiting for 9sou.
// 123 456 789 123 9(sou).
// Sets: 4. Pair: No (or partial pair).
// 16 tiles. 4 sets complete. Remainder: 9s.
// Needs 9s to complete pair.
// Distance?
// Win = 5 sets + pair.
// We have 4 sets. 9s is a "partial pair" (candidate)? Or just a floater.
// If we draw 9s -> 5 sets + pair (where is 5th set?).
// Wait. 16-tile mahjong winning hand is 5 sets + 1 pair.
// 123 456 789 123 (4 sets). 
// One more set needed + pair. 
// Hand: 123 456 789 123 (12 tiles).
// + 9s (13 tiles). 
// + 3 more tiles.
// Standard TW hand is 16 tiles. Win at 17.
// 5 sets (15) + pair (2) = 17.
// If we have 16 tiles:
// 123m 456m 789m 123p 11s 22s?
// 4 sets + 2 pairs?
// 123m 456m 789m 123p (12 tiles).
// Remaining 4 tiles.
// Need 1 set + 1 pair.
// If remainder is 111s 2s. Tenpai (waiting for 2s).
// Test case: 123m 456m 789m 123p 111s 2s.
const tenpaiHand = [
    '1m', '2m', '3m',
    '4m', '5m', '6m',
    '7m', '8m', '9m',
    '1p', '2p', '3p',
    '1s', '1s', '1s',
    '2s'
];
testShanten('Tenpai Hand (Waiting for 2s)', tenpaiHand, 0);

// 1-Shanten
// 123m 456m 789m 123p 11s 4s.
// Change 4s to 1s -> Win.
// Or Change 4s to 2s/3s -> sequence?
// If we have 11s 4s. Need pair + set.
// This is likely 1-shanten.
const oneShantenHand = [
    '1m', '2m', '3m',
    '4m', '5m', '6m',
    '7m', '8m', '9m',
    '1p', '2p', '3p',
    '1s', '1s',
    '4s'
];
testShanten('1-Shanten Hand', oneShantenHand, 1);

