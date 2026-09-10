# cccdev 架构文档

本文说明 `cccdev` 如何以 Chrome 扩展形式，把当前预览页的 `window.cc` 注入独立弹窗并运行 DevTools UI。面向需要改注入逻辑、扩属性编辑器或理解构建产物的开发者。

用户安装说明见仓库根目录 [README.md](../README.md)。

## 1. 项目定位

`cccdev` 的主产物是 **Chrome 扩展**。点击工具栏图标后：

1. 在当前标签的页面主世界（MAIN world）检测 `window.cc`
2. 检测成功则 `window.open` 一个固定弹窗（满版显示 UI）
3. 把游戏页的 `cc` / `Editor` 赋给弹窗（与 `exsimple.js` 相同）
4. 将构建出的 CSS + JS 写入弹窗并挂载 Preact 面板
5. 预览页 `pagehide` / `beforeunload` 时关闭弹窗

扩展页无法直接持有页面里的 `cc` 对象（隔离世界 / 跨源）。必须从页面主世界打开子窗口并赋值引用，UI 才能读写引擎。

| 维度      | 说明                                               |
| --------- | -------------------------------------------------- |
| 运行环境  | 游戏预览页弹出的同源窗口（`window.cc` 为注入引用） |
| 支持引擎  | 运行时检测 `window.cc`（面向 CC 3.x 预览）         |
| 发布产物  | `dist/` 解压加载的 MV3 扩展                        |
| UI 运行时 | Preact + `@preact/signals`，Vite 打成 IIFE         |

## 2. 目录结构

```
ccc-devtools/
├── dist/                                 # bun run build 输出（gitignore）
│   ├── manifest.json
│   ├── background.js
│   ├── icons/
│   └── assets/{index.js,style.css}
├── packages/cccdev-template-3x/
│   ├── src/                              # DevTools UI
│   ├── extension/                        # MV3 静态文件
│   │   ├── manifest.json
│   │   ├── background.js                 # 图标点击 + MAIN world 启动器
│   │   └── icons/
│   └── vite.config.ts
└── src/ + bin/                           # 旧 CLI，不再作为主构建路径
```

根 `tsconfig.json` 排除 `packages/`，CLI 与模板各自 type-check。

## 3. 构建流水线

```
packages/cccdev-template-3x
        │  gen-icons + tsc --noEmit && vite build
        ▼
  dist/assets/{index.js, style.css}     ← Vite IIFE
  dist/{manifest.json, background.js, icons/}  ← closeBundle 拷贝
        │
        ▼
  Chrome「加载已解压的扩展程序」→ dist/
```

- Vite `build.lib.formats: ['iife']`，全局名 `CCDevTools`，入口 `src/main.tsx`。
- `outDir` 为仓库根 `dist/`，CSS 不拆包。
- `background.js` 在点击时立刻 `executeScript`（不先 `fetch`，以免丢失用户手势导致弹窗被拦）。
- 弹窗通过 `web_accessible_resources` 加载 `chrome-extension://…/assets/{index.js,style.css}`，与 `exsimple.js` 的 `<link>` + `<script src>` 相同。

## 4. 扩展注入流程

```
点击 action
    │
    ▼
background.js
    │  fetch assets/style.css + assets/index.js
    │  chrome.scripting.executeScript({ world: 'MAIN', func: launchRemoteDevTools })
    ▼
游戏页 MAIN world
    │  无 window.cc → alert，不打开窗口
    │  弹出被拦 → alert
    │  已有窗口 → 重新赋值 cc 并 focus
    ▼
window.open(固定尺寸、无工具栏)
    │  document.write 最小 HTML（#cc-devtools-root）
    │  注入 <style> + window.cc = 游戏页.cc
    │  注入 <script> IIFE → mount App
    ▼
满版 #cc-devtools（节点树 + 属性）
```

页面刷新 / 关闭时，游戏页上的 `pagehide` / `beforeunload` 监听会 `devWin.close()`。

再次点击同一页：若弹窗仍在则关闭；已关闭则重新检测 `cc` 并打开。安装后不会对任何页面注入脚本，直到用户第一次点击扩展图标。

## 5. DevTools UI 模块

面板始终展开，占满弹窗；已移除预览页内嵌开关（`.ccdev-toggle`）、画布 `padding` 推开、宽度拖拽与 `localStorage` 开关状态。

```
App
├── #cc-devtools          # inset:0 满版
│   ├── Profiler 按钮
│   ├── GitHub 链接
│   ├── TreePanel
│   └── PropPanel
│       ├── Node 基础属性（NodeModel）
│       └── ComponentPanel × N
└── ProfilerPanel         # 可拖动浮窗
```

状态全部是 `store.ts` 里的顶层 signal。

| Signal          | 含义                                                       |
| --------------- | ---------------------------------------------------------- |
| `selectedNode`  | 当前选中的 `cc.Node` 实例                                  |
| `treeData`      | 每帧重建的轻量树（uuid / name / active / children / path） |
| `expandedUuids` | 树节点展开集合                                             |
| `searchQuery`   | 节点名搜索                                                 |
| `updateTick`    | 每帧在 `1 / -1` 间翻转，逼属性面板重读引擎值               |
| `profilerOpen`  | Profiler 浮窗                                              |

`engine.ts` 读 `window.cc`，若弹窗侧尚未赋值则回退 `window.opener.cc`。`outputToConsole` 把 `tempN` 写到游戏页，方便在预览控制台继续操作。

## 6. 引擎桥接与刷新循环

`engine.ts` 是 UI 内唯一直接碰 `cc` 的模块。

节点树刷新（`TreePanel`）：

1. 每 500ms poll，直到 `isReady()`（`cc` + scene）
2. 之后 `requestAnimationFrame`：`buildTree(scene.children)` 写入 `treeData`，并翻转 `updateTick`
3. 点击树节点时用 uuid `path` 再 `resolveNodeByPath`

属性面板订阅 `selectedNode` 与 `updateTick`。`PropItem` 数字/字符串输入为非受控：仅当输入框未聚焦时才把引擎值写回 DOM。

## 7. 属性模型

| 类名             | 可编辑字段                            |
| ---------------- | ------------------------------------- |
| `cc.UITransform` | Width, Height, Anchor X/Y             |
| `cc.Label`       | String, Color, Font Size, Line Height |
| `cc.Sprite`      | Color                                 |

未注册的组件仍列出名称和 enabled，属性区显示「无可编辑属性」。扩展新组件：在 `ComponentModels.ts` 增加 class 与 `switch` 分支。

## 8. 约定与限制

- 格式化：oxfmt，单引号；检查：oxlint
- 引擎 API 按 `any` 访问，IIFE 不依赖 `@cocos/creator` 类型
- 无法在 `chrome://`、Web Store 等页面注入
- 弹窗被浏览器拦截时必须由用户允许弹出窗口
- `dist/` 不进 git，改 UI 后需重新 `bun run build` 再在 `chrome://extensions` 刷新扩展
- 当前没有自动化测试；需在真实 Creator 浏览器预览上点扩展图标验证
