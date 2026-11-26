# cccdev

> 本專案基於 [potato47/ccc-devtools](https://github.com/potato47/ccc-devtools) 改寫，感謝原作者的開源貢獻。

Cocos Creator 網頁預覽除錯工具 — Chrome 擴充：右鍵圖示開啟選單，可開關 DevTools 視窗與全站便條紙；即時檢視節點樹、修改屬性、效能分析。

DevTools 開啟條件：目前分頁已成功注入 `window.cc`（Cocos 預覽頁）。視窗隨預覽頁關閉或重新整理而關閉；若該網域先前已開啟過，引擎初始化後會自動再開。預設為**子母畫面**（置頂 PiP）；右鍵選單可改為**泡泡模式**（獨立彈窗）。工具列**左鍵無作用**。

## 功能

- 即時節點樹瀏覽
- 節點屬性同步編輯
- 輸出節點/元件參照到預覽頁主控台
- UI 節點位置標示
- Profiler 效能分析
- 全站便條紙（右鍵選單勾選開關；預設開啟）

## 安裝（Chrome 擴充）

1. 建置：

```bash
bun install
cd packages/cccdev-template-3x && bun install && cd ../..
bun run build
```

2. 開啟 Chrome `chrome://extensions`，開啟「開發人員模式」。
3. 「載入未封裝項目」，選擇倉庫根目錄下的 `dist/`（不要載入根目錄 `snippet/`）。
4. 在 Cocos Creator **瀏覽器預覽**頁，**右鍵**擴充圖示 →「開啟／關閉 Cocos DevTools」。

若彈出視窗被攔截，請允許該預覽站點的彈出視窗。若提示未偵測到 `window.cc`，確認目前分頁就是遊戲預覽頁（而非編輯器本身）。

`file://` 本機頁面需在擴充詳情中勾選「允許存取檔案網址」。

前兩碼請改根目錄 `package.json` 的 `cccdev.versionBase`（例如 `"1.0"`）。每次 `bun run build` 只把第三碼 +1（`1.0.9` → `1.0.10`，不進位），寫入 `version`、`dist/manifest.json` 與彈窗標題。改 `versionBase` 後下次 build 從 `.0` 起算。設 `CCCDEV_VERSION` 可覆寫且不自動加號。

### 使用

- 擴充圖示（左鍵）：無作用。
- 擴充圖示（右鍵）：
  - **便條紙**：勾選顯示／取消隱藏（記住；預設開啟）。頁內藍鈕開關設定面板。
  - **開啟／關閉 Cocos DevTools**：首次才注入目前頁並開啟；再選一次關閉。
  - **子母畫面／泡泡模式**：記住偏好；預設子母畫面。選定哪種就只開哪種，失敗不退回；子母畫面失敗時看預覽頁主控台。
- 預覽頁關閉或重新整理：DevTools 視窗一併關閉。該網域若曾成功開啟，下次載入並等引擎就緒後會自動再開。
- 用選單關閉 DevTools，或關掉視窗：取消該網域的自動開啟。
- 面板右上角 `P`：開關 Profiler 浮窗。
- 屬性顯示名稱與操作說明見 `packages/cccdev-template-3x/extension/說明檔案.md`（build 會複製到 `dist/說明檔案.md`）。

## 開發

### 前置需求

- [Bun](https://bun.sh) >= 1.0

### 專案結構

```
ccc-devtools/
├── dist/                           # 建置產物（gitignore）：載入此資料夾
├── packages/cccdev-template-3x/    # 擴充原始碼（含便條紙 extension/snippet/）
├── snippet/                        # 已棄用：勿再載入
├── bin/ + src/                     # 舊 CLI（preview-template），非目前主路徑
└── docs/
    ├── ARCHITECTURE.md             # 架構
    └── PROJECTS.md                 # 目錄與功能說明
```

架構與注入見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。目錄與功能見 [docs/PROJECTS.md](docs/PROJECTS.md)。

### 常用指令

| 指令                 | 說明                                   |
| -------------------- | -------------------------------------- |
| `bun run build`      | 產生圖示、建置 UI，輸出到 `dist/`      |
| `bun run type-check` | TypeScript 型別檢查（根目錄 CLI 程式碼） |
| `bun run lint`       | oxlint 程式碼檢查                      |
| `bun run lint:fix`   | oxlint 自動修復                        |
| `bun run fmt`        | oxfmt 格式化程式碼                     |
| `bun run fmt:check`  | oxfmt 檢查格式（不寫入）               |

### 技術棧

- **視圖層**: Preact + Signals
- **建置**: Vite (IIFE library mode)
- **擴充**: Chrome Manifest V3（`scripting` + MAIN world 注入）

## 相關連結

- 自訂網頁預覽文件: https://docs.cocos.com/creator/manual/zh/editor/preview/browser.html
- Cocos Creator 外掛商店: https://store.cocos.com/app/detail/3922

## 致謝

本專案源自 **[potato47/ccc-devtools](https://github.com/potato47/ccc-devtools)**（Cocos Creator 網頁預覽除錯工具，MIT License）。
節點樹、屬性檢視、Profiler 等核心概念皆來自原專案；本倉庫在其基礎上改寫為 Chrome 擴充（MV3），並加入子母畫面視窗、網域自動開啟、全站便條紙等功能。

衷心感謝原作者 [potato47](https://github.com/potato47) 及所有原專案貢獻者的付出。

## 作者

- 目前維護：BM \<cit49836085@gmail.com\>
- 原始專案：[potato47/ccc-devtools](https://github.com/potato47/ccc-devtools)（作者 potato47）

## License

MIT — 保留原專案著作權聲明，詳見 [LICENSE](LICENSE)。
