// Defines visual examples for common scoring patterns (Yaku)
// IDs correspond to the internal representation used in mahjong-algorithm.js
// Taiwan Mahjong: 16 tiles in hand + 1 winning tile = 17 tiles total (5 sets × 3 + 1 pair = 17)

const MAHJONG_PATTERNS = [
    {
        category: "基本牌型 (Basic)",
        patterns: [
            {
                name: "屁胡 (Chicken Hand)",
                tai: 0,
                probability: "30% - 40%",
                description: "最基本的胡牌型態，無任何額外台數。只要湊齊面子＋將眼即可胡牌，底金照算。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "3m", "4m", "5m", "dong", "dong", "dong", "2s", "2s"]
            },
            {
                name: "平胡 (All Chows)",
                tai: 2,
                probability: "15% - 20%",
                description: "全部由順子組成，無花、無字牌、無刻子。",
                example: ["2m", "3m", "4m", "5p", "6p", "7p", "2s", "3s", "4s", "6s", "7s", "8s", "1m", "2m", "3m", "9m", "9m"]
            },
            {
                name: "碰碰胡 (All Pongs)",
                tai: 4,
                probability: "2% - 4%",
                description: "全部由刻子（或槓）組成，無順子。",
                example: ["1m", "1m", "1m", "3p", "3p", "3p", "9s", "9s", "9s", "dong", "dong", "dong", "fa", "fa", "fa", "7m", "7m"]
            },
            {
                name: "門清 (Concealed Hand)",
                tai: 1,
                probability: "20% - 30%",
                description: "沒有吃、碰、明槓，全部暗牌。門清自摸另加 3 台。",
                example: ["1m", "2m", "3m", "5p", "5p", "5p", "7s", "8s", "9s", "dong", "dong", "dong", "4s", "5s", "6s", "3m", "3m"]
            },
            {
                name: "全求人 (All From Others)",
                tai: 2,
                probability: "1% - 2%",
                description: "所有面子都是吃、碰來的，手中只剩將眼，靠別人打出的牌胡。下方範例：前 5 組為已吃碰的明牌，最後 1 對為手中剩餘的將眼。",
                example: ["1m", "2m", "3m", "+", "dong", "dong", "dong", "+", "fa", "fa", "fa", "+", "7s", "8s", "9s", "+", "4p", "5p", "6p", "+", "5m", "5m"]
            }
        ]
    },
    {
        category: "花色牌型 (Suits)",
        patterns: [
            {
                name: "混一色 (Mixed One Suit)",
                tai: 4,
                probability: "3% - 5%",
                description: "只有一種花色（萬/筒/索）加上字牌。",
                example: ["1m", "2m", "3m", "5m", "5m", "5m", "7m", "8m", "9m", "dong", "dong", "dong", "fa", "fa", "fa", "9m", "9m"]
            },
            {
                name: "清一色 (Pure One Suit)",
                tai: 8,
                probability: "0.5% - 1%",
                description: "整副牌只有一種花色，無字牌。",
                example: ["1s", "1s", "1s", "2s", "3s", "4s", "5s", "6s", "7s", "7s", "8s", "9s", "8s", "8s", "8s", "9s", "9s"]
            }
        ]
    },
    {
        category: "字牌與大牌 (Honors & Big Hands)",
        patterns: [
            {
                name: "三元牌 (Dragon Pong)",
                tai: 1,
                probability: "10% - 15%",
                description: "中、發、白任一組刻子，每組 1 台。",
                example: ["zhong", "zhong", "zhong", "1m", "2m", "3m", "5p", "6p", "7p", "8s", "8s", "8s", "4m", "5m", "6m", "3p", "3p"]
            },
            {
                name: "小三元 (Little Three Dragons)",
                tai: 4,
                probability: "0.1% - 0.2%",
                description: "中、發、白其中兩組刻子，剩下一組為將眼。另加各自三元牌台。",
                example: ["zhong", "zhong", "zhong", "fa", "fa", "fa", "bai", "bai", "1m", "2m", "3m", "7s", "8s", "9s", "4p", "5p", "6p"]
            },
            {
                name: "大三元 (Big Three Dragons)",
                tai: 8,
                probability: "< 0.05%",
                description: "集齊中、發、白三組刻子。另加各自三元牌台。",
                example: ["zhong", "zhong", "zhong", "fa", "fa", "fa", "bai", "bai", "bai", "1m", "2m", "3m", "5p", "6p", "7p", "5m", "5m"]
            },
            {
                name: "圈風 / 門風 (Wind Pong)",
                tai: 1,
                probability: "8% - 12%",
                description: "持有圈風（當前風圈）或門風（座位風）的刻子各 1 台，可疊加。",
                example: ["dong", "dong", "dong", "1m", "2m", "3m", "5p", "6p", "7p", "9s", "9s", "9s", "4m", "5m", "6m", "4m", "4m"]
            },
            {
                name: "小四喜 (Little Four Winds)",
                tai: 8,
                probability: "< 0.02%",
                description: "東、南、西、北其中三組刻子，剩下一組為將眼。",
                example: ["dong", "dong", "dong", "nan", "nan", "nan", "xi", "xi", "xi", "bei", "bei", "1m", "2m", "3m", "4p", "5p", "6p"]
            },
            {
                name: "大四喜 (Big Four Winds)",
                tai: 16,
                probability: "< 0.01%",
                description: "集齊東、南、西、北四組刻子。",
                example: ["dong", "dong", "dong", "nan", "nan", "nan", "xi", "xi", "xi", "bei", "bei", "bei", "1m", "2m", "3m", "zhong", "zhong"]
            },
            {
                name: "字一色 (All Honors)",
                tai: 16,
                probability: "< 0.01%",
                description: "整副牌全由字牌（風牌＋三元牌）組成。",
                example: ["dong", "dong", "dong", "nan", "nan", "nan", "xi", "xi", "xi", "zhong", "zhong", "zhong", "fa", "fa", "fa", "bei", "bei"]
            }
        ]
    },
    {
        category: "特殊胡牌 (Special Wins)",
        patterns: [
            {
                name: "自摸 (Self-Draw)",
                tai: 1,
                probability: "25% - 35%",
                description: "自己從牌墩摸牌胡牌，非吃別人打的牌。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "門清自摸 (Concealed Self-Draw)",
                tai: "1+3",
                probability: "5% - 10%",
                description: "門清＋自摸，共加 5 台（門清 1 + 自摸 1 + 門清自摸 3）。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "海底撈月 (Last Tile Self-Draw)",
                tai: 1,
                probability: "1% - 2%",
                description: "摸牌墩最後一張牌並胡牌。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "海底撈砲 (Last Tile Ron)",
                tai: 1,
                probability: "< 1%",
                description: "牌墩剩最後一張時，胡別人打出的牌。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "槓上開花 (Win on Kong Draw)",
                tai: 1,
                probability: "< 1%",
                description: "槓牌後從牌墩補牌，補到的牌剛好胡牌。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "搶槓 (Robbing a Kong)",
                tai: 1,
                probability: "< 0.5%",
                description: "別人加槓時，槓的那張牌剛好是你要胡的牌，可搶槓胡。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            }
        ]
    },
    {
        category: "聽牌方式 (Waiting Patterns)",
        patterns: [
            {
                name: "單吊 (Single Wait)",
                tai: 1,
                probability: "10% - 15%",
                description: "只等將眼的那一張牌。例：手上只差一張 5 萬就能湊成一對將眼胡牌。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m"]
            },
            {
                name: "邊張 (Edge Wait)",
                tai: 1,
                probability: "8% - 12%",
                description: "聽邊張：手持 1、2 聽 3，或手持 8、9 聽 7。只有一張可胡。",
                example: ["1m", "2m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            },
            {
                name: "嵌張 (Closed Wait)",
                tai: 1,
                probability: "8% - 12%",
                description: "聽中間嵌張：手持 1、3 聽 2，或手持 4、6 聽 5。只有一張可胡。",
                example: ["1m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "dong", "dong", "dong", "2s", "3s", "4s", "5m", "5m"]
            }
        ]
    },
    {
        category: "花牌台數 (Flower Scoring)",
        patterns: [
            {
                name: "正花 (Matching Flower)",
                tai: 1,
                probability: "25%",
                description: "花牌對應自己座位風位：東位持春/梅、南位持夏/蘭、西位持秋/菊、北位持冬/竹。",
                example: ["s1", "f1"]
            },
            {
                name: "花槓 (Flower Set)",
                tai: 2,
                probability: "< 5%",
                description: "集齊春夏秋冬或梅蘭菊竹四張，各 +2 台（不含每花 1 台的基本計算）。",
                example: ["s1", "s2", "s3", "s4"]
            },
            {
                name: "八仙過海 (Eight Flowers)",
                tai: 8,
                probability: "< 0.1%",
                description: "集齊全部 8 張花牌，直接胡牌，加 8 台。",
                example: ["s1", "s2", "s3", "s4", "f1", "f2", "f3", "f4"]
            }
        ]
    }
];
