// Defines visual examples for common scoring patterns (Yaku)
// IDs correspond to the internal representation used in mahjong-logic.js

const MAHJONG_PATTERNS = [
    {
        category: "基本牌型 (Basic)",
        patterns: [
            {
                name: "屁胡 (Chicken Hand / Pi Hu)",
                tai: 0,
                probability: "30% - 40%",
                description: "最基本的胡牌型態，無任何額外台數。只要湊齊 4 組面子（順子或刻子）+ 1 對將眼即可胡牌，但無花、無字、非自摸等加台條件。底金照算。",
                example: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "3m", "4m", "5m", "2s", "2s"]
            },
            {
                name: "平胡 (All Chows)",
                tai: 2,
                probability: "15% - 20%",
                description: "由 5 組順子和 1 對將眼組成，無花、無字、非獨聽。",
                example: ["2m", "3m", "4m", "5p", "6p", "7p", "2s", "3s", "4s", "6s", "7s", "8s", "9m", "9m"]
            },
            {
                name: "碰碰胡 (All Pongs)",
                tai: 4,
                probability: "2% - 4%",
                description: "由 4 組刻子（或槓）和 1 對將眼組成。",
                example: ["1m", "1m", "1m", "3p", "3p", "3p", "9s", "9s", "9s", "dong", "dong", "dong", "fa", "fa"]
            }
        ]
    },
    {
        category: "索/筒/萬 (Suits)",
        patterns: [
            {
                name: "混一色 (Mixed One Suit)",
                tai: 4,
                probability: "3% - 5%",
                description: "只有一種花色（萬/筒/索）加上字牌。",
                example: ["1m", "2m", "3m", "5m", "5m", "5m", "9m", "9m", "dong", "dong", "dong", "fa", "fa", "fa"]
            },
            {
                name: "清一色 (Pure One Suit)",
                tai: 8,
                probability: "0.5% - 1%",
                description: "整副牌只有一種花色（萬/筒/索），無字牌。",
                example: ["1s", "1s", "1s", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "8s", "8s", "9s", "9s"]
            }
        ]
    },
    {
        category: "字牌與大牌 (Honors & Big Hands)",
        patterns: [
            {
                name: "小三元 (Little Three Dragons)",
                tai: 4,
                probability: "0.1% - 0.2%",
                description: "集齊中、發、白其中兩組刻子，剩下一組為將眼。",
                example: ["zhong", "zhong", "zhong", "fa", "fa", "fa", "bai", "bai", "1m", "2m", "3m", "7s", "8s", "9s"]
            },
            {
                name: "大三元 (Big Three Dragons)",
                tai: 8,
                probability: "0.03% - 0.05%",
                description: "集齊中、發、白三組刻子。",
                example: ["zhong", "zhong", "zhong", "fa", "fa", "fa", "bai", "bai", "bai", "1m", "2m", "3m", "5p", "5p"]
            },
            {
                name: "字一色 (All Honors)",
                tai: 16,
                probability: "< 0.01%",
                description: "整副牌全由字牌組成。",
                example: ["dong", "dong", "dong", "nan", "nan", "nan", "xi", "xi", "xi", "bei", "bei", "zhong", "zhong", "zhong"]
            },
            {
                name: "大四喜 (Big Four Winds)",
                tai: 16,
                probability: "< 0.02%",
                description: "集齊東、南、西、北四組刻子。",
                example: ["dong", "dong", "dong", "nan", "nan", "nan", "xi", "xi", "xi", "bei", "bei", "bei", "zhong", "zhong"]
            }
        ]
    }
];
