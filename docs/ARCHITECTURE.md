# cccdev 架構文件

本文說明 `cccdev` 如何以 Chrome 擴充形式，把目前預覽頁的 `window.cc` 注入獨立彈窗並執行 DevTools UI。面向需要改注入邏輯、擴充屬性編輯器或理解建置產物的開發者。

使用者安裝說明見倉庫根目錄 [README.md](../README.md)。目錄與便條紙功能見 [PROJECTS.md](./PROJECTS.md)。

## 1. 專案定位

`cccdev` 的主產物是 **Chrome 擴充**（DevTools + 便條紙）。工具列**左鍵無作用**；**右鍵**選單可開關便條紙與 DevTools。開啟 DevTools 時：

1. 在目前分頁的頁面主世界（MAIN world）偵測 `window.cc`
2. 依右鍵選單選定的視窗模式開啟（預設**子母畫面** Document PiP；可選**泡泡** `window.open`）
3. 把遊戲頁的 `cc` / `Editor` 賦給該視窗（與 `exsimple.js` 相同）
4. 將建置出的 CSS + JS 寫入視窗並掛載 Preact 面板
5. 預覽頁 `pagehide` / `beforeunload` 時關閉視窗

便條紙以 `content_scripts` 注入一般網頁（`dist/snippet/`），顯示狀態由右鍵核取方塊與 `snippet_ui_visible` 控制。

擴充頁無法直接持有頁面裡的 `cc` 物件（隔離世界 / 跨源）。必須從頁面主世界開啟子視窗並賦值參照，UI 才能讀寫引擎。

| 維度      | 說明                                               |
| --------- | -------------------------------------------------- |
| 執行環境  | 遊戲預覽頁彈出的同源視窗（`window.cc` 為注入參照） |
| 支援引擎  | 執行時偵測 `window.cc`（面向 CC 3.x 預覽）         |
| 發布產物  | `dist/` 解壓載入的 MV3 擴充                        |
| UI 執行時 | Preact + `@preact/signals`，Vite 打成 IIFE         |

## 2. 目錄結構

```
ccc-devtools/
├── dist/                                 # bun run build 輸出（gitignore）
├── packages/cccdev-template-3x/          # 擴充原始碼（含 extension/snippet/）
├── snippet/                              # 已棄用：勿再 Load unpacked
├── src/ + bin/                           # 舊 CLI，不再作為主建置路徑
└── docs/PROJECTS.md                      # 目錄與功能說明
```

根 `tsconfig.json` 排除 `packages/`，CLI 與範本各自 type-check。

## 3. 建置流程

```
packages/cccdev-template-3x
        │  gen-icons + tsc --noEmit && vite build
        ▼
  dist/assets/{index.js, style.css, prop-labels.json}
  dist/{manifest.json, background.js, icons/, snippet/, 說明檔案.md}  ← closeBundle 複製
        │
        ▼
  Chrome「載入未封裝項目」→ dist/
```

- Vite `build.lib.formats: ['iife']`，全域名 `CCDevTools`，入口 `src/main.tsx`。
- `outDir` 為倉庫根 `dist/`，CSS 不拆包。
- 前兩碼來自根目錄 `package.json` 的 `cccdev.versionBase`；建置時第三碼 +1（不進位），寫入 `dist/manifest.json`，彈窗標題顯示同一版本。
- `background.js` 在右鍵選單觸發時立刻 `executeScript`（不先 `fetch`，以免丟失使用者手勢導致彈窗被攔）。
- 彈窗透過 `web_accessible_resources` 載入 `chrome-extension://…/assets/{index.js,style.css,prop-labels.json}`，與 `exsimple.js` 的 `<link>` + `<script src>` 相同。屬性顯示名稱表為未壓縮 JSON，不打進 IIFE。
- 便條紙 `extension/snippet/` 原樣複製到 `dist/snippet/`，由 manifest `content_scripts` 載入。

## 4. 擴充注入流程

```
右鍵 action →「開啟／關閉 Cocos DevTools」
    │
    ▼
background.js
    │  chrome.scripting.executeScript({ world: 'MAIN', func: runRemoteDevTools })
    ▼
遊戲頁 MAIN world
    │  無 window.cc → console.error，不開啟視窗
    │  彈出被攔 → console.error
    │  已有視窗 → 關閉（再開則還原尺寸）
    ▼
window.open / Document PiP
    │  document.write 最小 HTML（#cc-devtools-root）
    │  注入 window.cc = 遊戲頁.cc
    │  注入 <script> IIFE → mount App
    │  UI 就緒後套用上次視窗與分欄尺寸
    ▼
滿版 #cc-devtools（節點樹 + 屬性）
```

頁面重新整理 / 關閉時，遊戲頁上的 `pagehide` / `beforeunload` 監聽會 `devWin.close()`。

再次選「開啟／關閉」同一頁：若彈窗仍在則關閉；已關閉則重新偵測 `cc` 並開啟。成功開啟後把該網域寫入 `chrome.storage.local`（`autoOpenOrigins`）；`tabs.onUpdated` 在頁面 `complete` 時若該網域已記錄，則以 `open` 模式注入並等到引擎就緒（scene / `game_inited`，否則 `cc` 出現後 12 秒）再開啟視窗。用選單關閉或使用者關掉彈窗（MAIN 偵測後 `postMessage` → isolated bridge）會清掉該網域紀錄。安裝後仍不會對未記錄的網域注入。

## 5. DevTools UI 模組

面板始終展開，佔滿彈窗；已移除預覽頁內嵌開關（`.ccdev-toggle`）、畫布 `padding` 推開、寬度拖曳與 `localStorage` 開關狀態。

```
App
├── #cc-devtools          # inset:0 滿版
│   ├── Profiler 按鈕
│   ├── GitHub 連結
│   ├── TreePanel
│   └── PropPanel
│       ├── Node 基礎屬性（NodeModel）
│       └── ComponentPanel × N
└── ProfilerPanel         # 可拖曳浮窗
```

狀態全部是 `store.ts` 裡的頂層 signal。

| Signal          | 含義                                                       |
| --------------- | ---------------------------------------------------------- |
| `selectedNode`  | 目前選取的 `cc.Node` 實例                                  |
| `treeData`      | 每幀重建的輕量樹（uuid / name / active / children / path） |
| `expandedUuids` | 樹節點展開集合                                             |
| `searchQuery`   | 節點名搜尋                                                 |
| `updateTick`    | 每幀在 `1 / -1` 間翻轉，逼屬性面板重讀引擎值               |
| `profilerOpen`  | Profiler 浮窗                                              |

`engine.ts` 讀 `window.cc`，若彈窗側尚未賦值則回退 `window.opener.cc`。`outputToConsole` 把 `tempN` 寫到遊戲頁，方便在預覽主控台繼續操作。

## 6. 引擎橋接與刷新循環

`engine.ts` 是 UI 內唯一直接碰 `cc` 的模組。

節點樹刷新（`TreePanel`）：

1. 每 500ms poll，直到 `isReady()`（`cc` + scene）
2. 之後 `requestAnimationFrame`：`buildTree(scene.children)` 寫入 `treeData`，並翻轉 `updateTick`
3. 點擊樹節點時用 uuid `path` 再 `resolveNodeByPath`

屬性面板訂閱 `selectedNode` 與 `updateTick`。`PropItem` 數字/字串輸入為非受控：僅當輸入框未聚焦時才把引擎值寫回 DOM。

## 7. 屬性模型

| 類名             | 可編輯欄位                            |
| ---------------- | ------------------------------------- |
| `cc.UITransform` | Width, Height, Anchor X/Y             |
| `cc.Label`       | String, Color, Font Size, Line Height |
| `cc.Sprite`      | Color                                 |

未註冊的元件仍列出名稱和 enabled；通用反射只顯示可完整編輯的欄位。擴充新元件：在 `ComponentModels.ts` 增加 class 與 `switch` 分支。

## 8. 約定與限制

- 格式化：oxfmt，單引號；檢查：oxlint
- 引擎 API 按 `any` 存取，IIFE 不依賴 `@cocos/creator` 型別
- 無法在 `chrome://`、Web Store 等頁面注入
- 彈窗被瀏覽器攔截時必須由使用者允許彈出視窗
- `dist/` 不進 git，改 UI 後需重新 `bun run build` 再在 `chrome://extensions` 重新整理擴充
- 目前沒有自動化測試；需在真實 Creator 瀏覽器預覽上右鍵擴充圖示驗證
