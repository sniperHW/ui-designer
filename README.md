# ui-designer — 手游 UI 雏形设计工具

线框图 + 交互原型设计工具（Electron）。设计文档见 `概念设计.md`，当前实现为 M0 + M1 原型。

## 开发

```bash
npm install
npm run dev        # 启动开发模式
npm run typecheck  # TypeScript 检查
npm run build      # 构建产物（out/）
```

## 当前功能（v0.2）

- 内置控件：形状（矩形 / 圆角矩形 / 椭圆 / 线段 / 占位图）、文本、交互（按钮 / 复选框 / 进度条 / 输入框）、**Tab 页签容器**
- **Tab 容器**：默认 3 页签（可增删改名）；页签栏上 / 下；画布点击页签头切换编辑页；把控件拖到页签内容区自动成为该页签子控件；移动 / 删除 / 复制 Tab 时子控件跟随；子控件裁剪显示在内容区，图层树缩进展示
- 从控件库拖入画布（或点击加到画布中央），选择 / 移动 / 8 向缩放 / 方向键微调
- 多选（Shift / ⌘A）、对齐与分布、图层排序（显隐 / 锁定 / 移层 / 置顶底）
- 页面管理：新建 / 复制 / 删除 / 重命名，缩略图预览
- 网格显示与吸附、滚轮缩放平移、适配窗口
- 撤销 / 重做、复制 / 粘贴 / 再制、删除
- 工程保存 / 打开（`.uiw`，v0.1 为 JSON 明文）、导出当前页 PNG（2x 白底）

## 快捷键

⌘Z / ⇧⌘Z 撤销重做 · ⌘C/⌘V/⌘D 复制粘贴再制 · ⌘A 全选 · ⌫ 删除 · 方向键微调（⇧ ×10）· ⌘S 保存 · ⌘O 打开 · ⌘N 新建 · ⌘= / ⌘- 缩放 · Esc 取消选择

## 结构

```
src/main/       Electron 主进程（窗口、文件对话框 IPC）
src/preload/    contextBridge API
src/renderer/   React 界面
  src/store/editorStore.ts   编辑器状态（文档 + 历史 + 视口）
  src/widgets/registry.ts    控件定义与 SVG 线框渲染（画布/缩略图/导出共用）
  src/components/            界面组件
```
