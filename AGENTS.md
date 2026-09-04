# AGENTS.md

给 AI 开发代理（ZCode / Claude Code 等）的本仓库工作指南。这里只写**操作要点与不变量**，不重复详细设计。

## 项目

手游 UI 线框图 + 交互原型设计工具（Electron 桌面应用）。技术栈：Electron + electron-vite + React 19 + TypeScript + Zustand + SVG 渲染（无 UI 框架，控件全部手绘 SVG）。全仓库文档、注释、提交信息用中文。

## 接手必读（按顺序）

1. `开发进度.md` — **当前进度、已知限制、架构速览、测试与坑**，新会话先读这个
2. `概念设计.md` — 完整产品设计（§编号被代码注释广泛引用）
3. `README.md` — 功能清单与 skill 使用说明

注意：README 个别处可能滞后于代码（如 examples 下已删除的构建脚本），以 `开发进度.md` 和实际目录为准。

## 常用命令

```bash
npm install        # Electron 二进制下载失败时见下方「环境坑」
npm run typecheck  # 快速检查门槛，改完代码必跑
npm run dev        # 开发模式（测试时加 UIW_DEBUG_PORT=9222，见下）
npm run build      # 构建产物到 out/
```

没有 `npm test`——测试全部是手跑的 CDP 脚本（见下）。

## 测试流程（CDP 黑盒）

先起带调试端口的应用：`UIW_DEBUG_PORT=9222 npm run dev`，然后另开终端跑：

- `node tests/cdp-smoke.mjs` — 基础功能
- `node tests/cdp-tab.mjs` — Tab 容器
- `node tests/cdp-common.mjs` — 公共层
- `node tests/cdp-m2.mjs` — 容器 / 锚点预览 / 定制控件
- `node tests/cdp-click.mjs` — 点击交互 / 弹窗页
- `node tests/cdp-preview.mjs` — 原型预览
- `node tests/cdp-tip.mjs` — 轻提示（tooltip 控件 + 悬停弹出）
- `node tests/gui-card/build.mjs` / `tests/gui-arena/*.mjs` — 示例工程的界面操作复现

测试原则：**CDP 模拟真实输入事件驱动 UI，不直接改 store 数据**。新功能尽量补对应 cdp-*.mjs 用例。

已知坑：Shift 点击要在 `Input.dispatchMouseEvent` 传 `modifiers: 8`；右键传 `button: 'right', buttons: 2`；控件库条目在可视区外先 `scrollIntoView`；测试开头覆写 `window.alert/confirm` 防阻塞；截图验证无屏幕录制权限，用 CDP 黑盒断言替代。

## 代码结构与单一源原则

```
src/main/index.ts            Electron 主进程（IPC：project:save / project:open / png:export）
src/preload/index.ts         contextBridge API
src/renderer/src/
  store/editorStore.ts       ★ 单一状态源：文档 + 快照式 undo/redo + 视口 + 会话态
  widgets/registry.ts        ★ 控件定义与 SVG 渲染单源（外形 / 容器子树 / 定制实例 / 锚点重排 / 命中拾取）
  widgets/tree.ts            节点树遍历（walkNodes / bboxOf / reids…，覆盖 pages/children/slots）
  types.ts                   ProjectDoc / 节点 / props 类型（.uiw 的 schema 源头）
  components/                界面组件（Canvas / Preview / PreviewNode / PopupLayer / 各面板）
  main.tsx                   DEV 模式暴露 window.__uiw（store）与 __uiwDefs（测试钩子）
```

改代码时的**硬性不变量**：

- **渲染走单源**：画布、缩略图、PNG 导出、预览共用 `registry.ts` 的渲染器；不要在组件里另写一套 SVG 绘制。
- **状态走单源**：文档修改一律经 `editorStore.ts` 的 action（多数经过快照入撤销栈）；编辑目标（页面 / 公共层 / 弹窗页 / 定制控件定义）统一走 `editRoot()/editNodesOf()` 抽象，不要为某类编辑目标开特例通道。
- **定制控件的可点击标记是定义级**：配在定义内控件上（`isClickable` 对 `custom` 实例恒 false），实例自身 `clickable` 不生效。
- **弹窗只允许在弹窗页**（`doc.popups`）：普通页面 / 公共层 / 定制控件定义内一律拦截；弹窗本体（根级 dialog）不可删除，标题栏与弹窗页名双向同步（`renamePopup`）。
- **旧工程兼容**：`loadProject` 需自动补齐缺失字段（`customWidgets` / `popups` / 公共层等）并迁移老格式，别假设文件里字段齐全。
- **`.uiw` 就是 JSON 明文**（`ProjectDoc`），改 `types.ts` 的文档结构或 `registry.ts` 的控件 props 时，同步更新 `skills/uiw-designer/references/schema.md`、`references/widgets.md` 与 `scripts/validate.mjs`。

## 生成 .uiw 工程

用户要求生成 / 批量修改设计工程时走 `skills/uiw-designer` skill（`.zcode/skills/uiw-designer` 是指向仓库 `skills/` 的软链）：先读 references 再生成，产物必须过校验：

```bash
node skills/uiw-designer/scripts/validate.mjs <文件.uiw>   # 退出码 0/1，✗ 必须清零
```

## 环境坑

- Electron 二进制下载需镜像：`ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js`
- `@vitejs/plugin-react` 必须用 5.x（6.x 要求 vite 8，与 electron-vite 5 冲突）
- 截图验证无权限，一律用 CDP 黑盒测试替代

## 提交约定

Conventional commits + 中文描述，格式如 `feat: 竞技场示例结构升级（……）`、`fix: 属性面板 mini 按钮隐形修复（……）`，括号内列出要点。
