# HANDOFF — Mahjong-Master（台灣麻將馬上通）

> 上次更新：2026-11-09（Session 1，首份交接）
> 線上版：https://kaku88life.github.io/MahjonMaster2026/（GitHub Pages，推 `main` 即部署）

## 一句話總結
純前端（HTML/CSS/原生 JS）台灣 16 張麻將教學遊戲；本輪把「擲骰→抓牌→補花→摸牌」順序與「台數／付款」教學補完整，電腦出牌改用向聽數。

## 完成到哪
- commit `22d8098`（**本機，尚未 push**，線上版仍是舊版）
- 牌牆標示：綠框＝開抓點、粉紅框＝牌尾（補花）、紅框＝骰子跳過的墩；圖例＋「可摸」張數
- 教學模式擲骰三步解說；抓牌莊家起逆時針、每次 2 墩共 4 輪；補花從牌尾補
- 胡牌結算：台型逐列＋說明、莊家台規則（只在莊家胡或付款者是莊家時加）、每家付款算式（底＋台×每台）
- 換莊／圈風輪替、流局連莊；牌牆只剩海底 16 張時直接流局
- AI：`MahjongAlgorithm.calcShanten` / `chooseDiscard`（向聽數＋已見牌加權進張），300 局模擬勝率 12% → 59%
- `mahjong-patterns.js` 台型說明對齊計分；手機橫向（max-height 500px）資訊面板縮小；資源版本 `?v=19`

## 下一步從這開始
1. Master 決定是否 `git push origin main` 部署 GitHub Pages（AI 不擅自推）
2. 修字型 404：`css/clay-theme.css:25` 引用 `assets/fonts/KOSEFONT-JP.TTF`，但檔案實際在 `tests/KOSEFONT-JP.TTF`（搬檔或改路徑）
3. 可選：手機直向（360 寬）完整走一局驗版面；目前只驗過 812x375 橫向與桌機

## 已知問題與假資料待補
- 字型 404（見上，原本就有，畫面用備用字型）
- 根目錄有意外空檔 `nul`（Windows 保留名，未 commit；刪除需 `\\?\` 路徑或 Git Bash `rm ./nul`）
- 根目錄 `春.png` 為舊散檔，用途未確認，未處理
- 無假資料；計分規則為台灣常見算法簡化版（無嚦咕嚦咕、八仙過海等罕見台）

## 驗證命令
```bash
python -m http.server 8791 --bind 0.0.0.0
```
- 瀏覽 `http://localhost:8791/index.html`（`.claude/launch.json` 名稱 `mahjong`）
- 語法檢查：`node --check js/game.js` 等
- 演算法回歸：`node tests/test-logic.js`；向聽數模擬腳本在本輪 scratchpad（未入庫）

## 信心最低的產出與原因
- 計分細則（莊家台、連莊拉莊台數、自摸各家付款）依常見台灣規則實作，各地牌桌習慣不同，未經真人牌友校對
- 手機直向版面未完整走過一局

## 本次模型與 effort
Claude Opus 5.5（claude-opus-5-5）；effort 待 Master 到 usage 儀表板確認

## 偏好提醒
- 每次回覆開頭稱「Master」、繁體中文、程式碼不用 emoji
- 檔案為 CRLF：改完用 Python 正規化，勿用 `sed -i`
- user-facing 文字用白話，不出現工程術語

## 在哪開新 session（環境）
Windows 原生（純前端、無 build），工作目錄 `C:\vibe coding\games\Mahjong-Master`

## Kickoff Prompt
> 接手 `C:\vibe coding\games\Mahjong-Master`（台灣麻將教學遊戲，純前端，Windows 原生）。先讀 `HANDOFF.md`。上輪已在本機 commit `22d8098`（抓牌順序與台數教學、向聽數 AI），尚未 push。先問 Master 要不要推上 main 部署，再修 `KOSEFONT-JP.TTF` 字型 404，最後用瀏覽器在手機直向尺寸走一局驗版面。
