# 倉庫專案目錄與分析

本倉庫目前以 **一個 Chrome 擴充**（Cocos DevTools + 便條紙）為主產物，再加上舊 CLI。

## 目錄一覽

| 目錄 | 專案 | 載入方式 | 建置 |
| ---- | ---- | -------- | ---- |
| `packages/cccdev-template-3x/` | **Cocos DevTools**（含便條紙）原始碼 | 載入建置後的 `dist/` | `bun run build` → `dist/` |
| `dist/` | MV3 產物（gitignore） | `chrome://extensions` 選 `dist/` | 由上一列產生 |
| `snippet/` | **已棄用**：舊獨立便條擴充殘件 | 不要載入 | 無 |
| `src/` + `bin/` | 舊 CLI（preview-template） | 不作為擴充入口 | 根目錄 `tsc` |
| `exsimple.js` | 早期「從頁面 `window.open` 彈窗」原型 | 手動掛在預覽頁 | 無 |
| `docs/` | 開發文件 | — | — |

```
ccc-devtools/
├── dist/                         # 建置產物，載入此資料夾
├── packages/cccdev-template-3x/  # 擴充原始碼（含 extension/snippet/）
├── snippet/                      # 已棄用：勿再 Load unpacked
├── src/ + bin/                   # 舊 CLI
├── exsimple.js                   # 彈窗注入原型
└── docs/
    ├── ARCHITECTURE.md           # 注入與 UI 架構
    └── PROJECTS.md               # 本檔
```

---

## 1. Cocos DevTools（`packages/cccdev-template-3x/` → `dist/`）

**目的：**

1. 在獨立彈窗檢視 Cocos Creator 3.x 瀏覽器預覽的節點樹、屬性、Profiler。
2. 在一般網頁疊可拖曳便條紙（原獨立 Snippet）。

**操作：** 工具列圖示**左鍵無作用**；**右鍵**選單：

| 選項 | 行為 |
| ---- | ---- |
| 便條紙（checkbox） | 全域顯示／隱藏；預設開啟；`chrome.storage.local` 鍵 `snippet_ui_visible` |
| 開啟／關閉 Cocos DevTools | 對目前分頁 toggle 注入（需 `window.cc`） |
| 泡泡／子母畫面（radio） | DevTools 視窗模式偏好 |

| 項目 | 說明 |
| ---- | ---- |
| Manifest | `extension/manifest.json`，建置時寫入版本到 `dist/` |
| 進入點 | `extension/background.js`：右鍵選單 + `scripting.executeScript`（MAIN） |
| UI | Preact IIFE：`dist/assets/index.js` + `style.css` |
| 便條 | `extension/snippet/{content.js,styles.css}` → `dist/snippet/`；`content_scripts` 注入 `<all_urls>` |
| 名稱表 | `extension/assets/prop-labels.json` → `dist/assets/` |
| 權限 | `scripting`、`storage`、`unlimitedStorage`、`activeTab`、`contextMenus` + 廣泛 `host_permissions` |
| 使用說明 | `extension/說明檔案.md` → `dist/說明檔案.md` |

細節見 [ARCHITECTURE.md](./ARCHITECTURE.md)。

### 便條紙行為摘要

- 浮動按鈕可拖；面板可新增便條、多頁切換、改文字／背景色、摺疊、匯入匯出。
- 便條資料：該站 **`localStorage`**（`snippet_sticky_*`）。顯示／隱藏：全域 **`chrome.storage.local`**。
- iframe 不注入（`window.top !== window.self`）。
- Manifest／舊文件若寫「跨頁面管理」，便條資料仍是各站 `localStorage`，不會跨網域共用。

---

## 2. 舊 CLI 與原型

| 路徑 | 分析 |
| ---- | ---- |
| `src/`、`bin/cccdev.ts` | 早期把 DevTools 寫進 Creator preview-template 的 CLI。根 `package.json` 的 `bin` 仍指向它，**不是**目前 Chrome 擴充建置路徑。 |
| `exsimple.js` | 在遊戲頁 `window.open` 再賦 `cc` 的最小範例；cccdev 的彈窗策略由此而來。 |
| `template/`（gitignore） | CLI 產生預覽樣板用，與擴充無關。 |
| 根目錄 `snippet/` | 舊獨立擴充；請只載入 `dist/`。 |

---

## 對照（歷史）

過去曾是兩套擴充；現已合併為單一 `dist/`。不要再把 `snippet/` 當 Load unpacked 目標。
