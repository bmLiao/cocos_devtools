# cccdev

Cocos Creator 网页预览调试工具 — Chrome 扩展：点击图标打开独立弹窗，实时查看节点树、修改属性、性能分析。

打开条件：当前标签页已成功注入 `window.cc`（Cocos 预览页）。弹窗随预览页关闭或刷新而关闭。

## 功能

- 实时节点树浏览
- 节点属性同步编辑
- 输出节点/组件引用到预览页控制台
- UI 节点位置标记
- Profiler 性能分析

## 安装（Chrome 扩展）

1. 构建：

```bash
bun install
cd packages/cccdev-template-3x && bun install && cd ../..
bun run build
```

2. 打开 Chrome `chrome://extensions`，开启「开发者模式」。
3. 「加载已解压的扩展程序」，选择仓库根目录下的 `dist/`。
4. 在 Cocos Creator **浏览器预览**页点击扩展图标。

若弹出窗口被拦截，请允许该预览站点的弹出窗口。若提示未检测到 `window.cc`，确认当前标签就是游戏预览页（而非编辑器本身）。

`file://` 本地页面需在扩展详情中勾选「允许访问文件网址」。

### 使用

- 扩展图标：首次点击才注入当前页并打开弹窗；再点一次关闭。
- 预览页关闭或刷新：弹窗一并关闭。
- 面板右上角 `P`：开关 Profiler 浮窗。

## 开发

### 前置要求

- [Bun](https://bun.sh) >= 1.0

### 项目结构

```
ccc-devtools/
├── dist/                           # 构建产物（gitignore）：可直接 Load unpacked
├── packages/cccdev-template-3x/
│   ├── src/                        # Preact DevTools UI
│   ├── extension/                  # Chrome MV3：manifest + background
│   └── vite.config.ts              # IIFE UI + 拷贝扩展静态文件
├── bin/ + src/                     # 旧 CLI（preview-template），非当前主路径
└── docs/ARCHITECTURE.md            # 架构说明
```

架构、注入流程与扩展入口见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

### 常用脚本

| 命令                 | 说明                                   |
| -------------------- | -------------------------------------- |
| `bun run build`      | 生成图标、构建 UI，输出到 `dist/`      |
| `bun run type-check` | TypeScript 类型检查（根目录 CLI 代码） |
| `bun run lint`       | oxlint 代码检查                        |
| `bun run lint:fix`   | oxlint 自动修复                        |
| `bun run fmt`        | oxfmt 格式化代码                       |
| `bun run fmt:check`  | oxfmt 检查格式（不写入）               |

### 技术栈

- **视图层**: Preact + Signals
- **构建**: Vite (IIFE library mode)
- **扩展**: Chrome Manifest V3（`scripting` + MAIN world 注入）

## 相关链接

- 自定义网页预览文档: https://docs.cocos.com/creator/manual/zh/editor/preview/browser.html
- Cocos Creator 插件商店: https://store.cocos.com/app/detail/3922

## License

MIT
