# cccdev

Cocos Creator 網頁預覽除錯工具 — Chrome 擴充：點擊圖示開啟獨立彈窗，即時檢視節點樹、修改屬性、效能分析。

開啟條件：目前分頁已成功注入 `window.cc`（Cocos 預覽頁）。彈窗隨預覽頁關閉或重新整理而關閉。

## 功能

- 即時節點樹瀏覽
- 節點屬性同步編輯
- 輸出節點/元件參照到預覽頁主控台
- UI 節點位置標示
- Profiler 效能分析

## 安裝（Chrome 擴充）

1. 建置：

```bash
bun install
cd packages/cccdev-template-3x && bun install && cd ../..
bun run build
```

2. 開啟 Chrome `chrome://extensions`，開啟「開發人員模式」。
3. 「載入未封裝項目」，選擇倉庫根目錄下的 `dist/`。
4. 在 Cocos Creator **瀏覽器預覽**頁點擊擴充圖示。

若彈出視窗被攔截，請允許該預覽站點的彈出視窗。若提示未偵測到 `window.cc`，確認目前分頁就是遊戲預覽頁（而非編輯器本身）。

`file://` 本機頁面需在擴充詳情中勾選「允許存取檔案網址」。

前兩碼請改根目錄 `package.json` 的 `cccdev.versionBase`（例如 `"1.0"`）。每次 `bun run build` 只把第三碼 +1（`1.0.9` → `1.0.10`，不進位），寫入 `version`、`dist/manifest.json` 與彈窗標題。改 `versionBase` 後下次 build 從 `.0` 起算。設 `CCCDEV_VERSION` 可覆寫且不自動加號。

### 使用

- 擴充圖示：首次點擊才注入目前頁並開啟彈窗；再點一次關閉。
- 預覽頁關閉或重新整理：彈窗一併關閉。
- 面板右上角 `P`：開關 Profiler 浮窗。

## 開發

### 前置需求

- [Bun](https://bun.sh) >= 1.0

### 專案結構

```
ccc-devtools/
├── dist/                           # 建置產物（gitignore）：可直接 Load unpacked
├── packages/cccdev-template-3x/
│   ├── src/                        # Preact DevTools UI
│   ├── extension/                  # Chrome MV3：manifest + background
│   └── vite.config.ts              # IIFE UI + 複製擴充靜態檔案
├── bin/ + src/                     # 舊 CLI（preview-template），非目前主路徑
└── docs/ARCHITECTURE.md            # 架構說明
```

架構、注入流程與擴充入口見 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

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

## 作者

- 目前維護：BM \<cit49836085@gmail.com\>
- 原作者來源：[potato47/ccc-devtools](https://github.com/potato47/ccc-devtools)

## License

MIT
