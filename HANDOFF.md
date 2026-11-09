# HANDOFF — Mahjong-Master（台灣麻將馬上通）

> 上次更新：2026-11-09（Session 2：手機橫向版面）
> 線上版：https://kaku88life.github.io/MahjonMaster2026/（GitHub Pages，推 `main` 即部署）

## 一句話總結
純前端（HTML/CSS/原生 JS）台灣 16 張麻將教學遊戲；Session 1 補完抓牌順序與台數教學、向聽數 AI，Session 2 把手機橫向版面改成「手牌滿寬置底、對手角落小卡」的精簡配置，**皆已 push 上線**。

## 完成到哪
- **Session 2**（commit `8fa5c15`，已 push，線上確認 `?v=24`）
  - 手機橫向精簡版面：`body.compact-landscape`（判定 `innerHeight <= 500 && W > H`）由 `js/app.js` `resizeTable()` 切換
  - `layoutCompactTable()`：手牌滿寬置底（`--dynamic-tile-w` 依寬度算）、牌桌依剩餘空間縮放置中（inline left/top + transform），兩側留 `--side-w`
  - 對手縮成角落小卡（上家右上、右家右側中、左家在資訊面板下方，`placeLeftOpponent()` 用 MutationObserver 跟資訊面板高度）
  - 資訊面板左上、操作鈕右下手牌上方、花牌縮 16x22、彈窗可捲動
  - 手機版點牌桌任一處即摸牌（`js/game.js` `isCompactLayout()`），提示「點牌桌摸牌」
  - 新增「分」按鈕切換分數板（`#score-btn` → `body.show-scores`）
  - 轉向後 300ms 再排一次版；桌機版面完全不變
  - CSS 全在 `css/clay-theme.css` 檔尾「COMPACT LANDSCAPE」區塊
- **Session 1**（commit `22d8098`，已 push）
  - 牌牆標示：綠框＝開抓點、粉紅框＝牌尾（補花）、紅框＝骰子跳過的墩；圖例＋「可摸」張數
  - 教學模式擲骰三步解說；抓牌莊家起逆時針、每次 2 墩共 4 輪；補花從牌尾補
  - 胡牌結算：台型逐列＋說明、莊家台規則、每家付款算式（底＋台×每台）
  - 換莊／圈風輪替、流局連莊；牌牆只剩海底 16 張時直接流局
  - AI：`MahjongAlgorithm.calcShanten` / `chooseDiscard`（向聽數＋已見牌加權進張），300 局模擬勝率 12% → 59%
  - `mahjong-patterns.js` 台型說明對齊計分

## 下一步從這開始
1. Master 用手機實機玩一局驗橫向版面（尤其是轉向後自動重排，預覽工具模擬不出 resize 事件）
2. 修字型 404：`css/clay-theme.css:25` 引用 `assets/fonts/KOSEFONT-JP.TTF`，但檔案實際在 `tests/KOSEFONT-JP.TTF`（搬檔或改路徑）
3. 手機直向（360 寬）版面尚未設計，目前只處理橫向；直向要做就另開一條 A 體驗線

## 已知問題與假資料待補
- 字型 404（見上，原本就有，畫面用備用字型）
- 根目錄有意外空檔 `nul`（Windows 保留名，未 commit；刪除需 `\\?\` 路徑或 Git Bash `rm ./nul`）
- 根目錄 `春.png` 為舊散檔，用途未確認，未處理
- 無假資料；計分規則為台灣常見算法簡化版（無嚦咕嚦咕、八仙過海等罕見台）

## 驗證命令
```bash
python -m http.server 8791 --bind 0.0.0.0
```
- 瀏覽 `http://localhost:8791/index.html`（`.claude/launch.json` 名稱 `mahjong`）；改 JS/CSS 後要升 `index.html` 的 `?v=` 版本號，否則會吃到舊快取
- 語法檢查：`node --check js/game.js` 等
- 演算法回歸：`node tests/test-logic.js`
- 手機版面：預覽工具設 640x300 / 740x330 / 915x412 後手動呼叫 `resizeTable()`（隱藏的預覽窗格不會觸發 resize 事件），量各區塊 `getBoundingClientRect` 是否重疊

## 信心最低的產出與原因
- 計分細則（莊家台、連莊拉莊台數、自摸各家付款）依常見台灣規則實作，未經真人牌友校對
- 手機橫向版面只在預覽工具模擬尺寸驗過，未在實機（含 iOS Safari 瀏海安全區）走過一局
- 手機直向未處理

## 本次模型與 effort
Claude Opus 5.5（claude-opus-5-5）；effort 待 Master 到 usage 儀表板確認

## 偏好提醒
- 每次回覆開頭稱「Master」、繁體中文、程式碼不用 emoji
- 檔案為 CRLF：改完用 Python 正規化，勿用 `sed -i`
- user-facing 文字用白話，不出現工程術語
- 參考其他遊戲版面只取通用慣例，不照搬美術與品牌

## 在哪開新 session（環境）
Windows 原生（純前端、無 build），工作目錄 `C:\vibe coding\games\Mahjong-Master`

## Kickoff Prompt
> 接手 `C:\vibe coding\games\Mahjong-Master`（台灣麻將教學遊戲，純前端，Windows 原生）。先讀 `HANDOFF.md`。前兩輪的抓牌順序／台數教學、向聽數 AI、手機橫向精簡版面都已 push 上線（`8fa5c15`）。先問 Master 實機玩過橫向版面有沒有問題，再修 `KOSEFONT-JP.TTF` 字型 404；手機直向版面要不要做先跟 Master 確認。
