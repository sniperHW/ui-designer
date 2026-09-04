# 导入实战踩坑清单

本工程导入过程中实际遇到过的问题与对策。生成/修改场景与绑定代码前先过一遍。

> 定位说明：条目里的**规则与对策是通用的**（适用于任何走本管线的项目）；出现的具体数值（750×1600、720/688、y≈1435、280×140 等）与节点名（DeckPanel、部队说明等）均为当时的工程实例，只作症状参照，不要照抄。

## 复合症状案例：tooltip「hint 一直处于打开状态，且显示位置不对」

单个症状背后叠了 **5 个独立缺陷**，按类别修复互相独立，串起来才是完整排查路径（都在 Main.ts，全部运行时补偿、未改 .ls）：

| # | 根因 | 条目 | 修复 |
|---|---|---|---|
| 1 | `findByName(tipBox, 同名)` 匹配到自身，showTip 移动的是 750×1600 全屏层而非 280×140 内层框，内容整体甩出屏 | #14 | tipInner 从外层 `_children` 里取，只动内层 |
| 2 | 「说明文字」保留原型绝对坐标 (255,716) 未换算父框相对坐标，文字渲染到整屏外 | #6 | `fixTipText` 兜底改写为内边距 (20,16) |
| 3 | 背景命令 percent 默认 true，280×140 像素值被当比例乘节点宽高，盒子渲染成贯穿屏幕的竖带（去广告框/加号/弹窗关闭按钮同病，多为裁剪掩盖） | #3、#8 | `fixBackgroundCmds` 全场景幂等重建为像素语义命令 |
| 4 | 按「图标」通用子名全量绑定，底部导航 5 个标签图标错挂部队 tooltip（运行时同名节点共 11 个） | #17 | 绑定谓词加 `parent.name.startsWith("部队")` 限定 |
| 5 | 28×28 小图标外释放收不到 MOUSE_UP，提示框永不隐藏 | #16 | 隐藏挂 stage 级 MOUSE_UP 兜底 |

**排查路径（关键收获：一个症状多因叠加时，逐层证伪）**：合成 `node.event(MOUSE_OVER)` 先证实 handler 逻辑错（tipBox 被移走）→ 读运行时节点树证实数据错（文字 xy=255,716）→ 截图像素差分证实渲染错（盒子渲染成竖带、文字不在屏内）→ 读引擎 `DrawRoundRectCmd.run` 源码定位 percent 语义 → 命中链日志证实误绑（悬停导航图标也触发）。工具见 #24-#26。

## 场景/序列化

1. **GPanel 内部容器包装**：GPanel 运行时可能把序列化子节点包进内部容器（`panel._children[0]._children[0]`）。任何「遍历容器子节点」的逻辑都必须递归查找（`findAll`），不能假设直接子节点。症状：按直接子节点收集列表槽位得到空数组。
2. **`_$override` 匹配靠预制体内部 `_$id`**：实例覆盖项的 `_$override` 值是预制体节点的 `_$id`，不是名字。生成实例时先给预制体每个节点分配可读短 id（如 `dname001`）。
3. **背景 DrawRoundRectCmd 的 percent 陷阱**：生成器把像素尺寸写进 width/height 而未显式写 `percent:false` 时，运行时按比例解析（实际绘制 width×节点宽 × height×节点高 的巨型色块，被屏幕/父容器裁剪成"从节点位置向下延伸的竖带"）。运行时需幂等重建为 `percent=false` 的命令（见 Main.ts fixBackgroundCmds）。
4. **JSON 格式**：2 空格缩进、原生 UTF-8、`_$` 前缀字段（MCP 传输可能丢下划线，写文件时永远带 `_$`）。改完用 `json.load` 校验合法性，并确认没有 `_$ref` 指向被删除的子树。
5. **`_$ref` 引用检查**：删节点前收集全场景 `_$ref` 目标 id，目标在删除子树内则不能删。
6. **子节点坐标必须换算为父容器相对坐标**：tips 类「框 + 框内文字」结构生成时，文字若直接保留原型的绝对舞台坐标（如 255,716）而父框在 (235,700)，运行时文字会渲染到框外右下方 255/716 处（等于整屏外）。生成器必须做「子坐标 − 父坐标」换算；对已生成的场景可运行时兜底（`fixTipText`：以 `txt.y > 容器高度` 判定后改写为内边距 20,16）。
7. **页签栏（页签栏_*）被底部导航栏整体遮挡**：生成器把子页签栏放在页面容器底部（local y≈1336 → root 1456-1520），而底部导航栏占 root 1435-1600 且渲染在其上层——子页签从未可见、从未可点（实测点击命中的是导航按钮）。生成时页签栏位置必须避开导航栏区域；已有场景运行时修正参照 `revealSubTabBars`：整体 scaleX/Y=0.7、水平居中、底边贴导航栏上沿（root 1431）、悬浮在内容之上（GWidget 缩放后子节点渲染与命中测试都跟随缩放）。
8. **重建背景命令的对象池回收陷阱**：`node.background = null` 再把**同一个**命令对象赋回去会得到隐形背景——setter 的 `removeCmd` 会把旧命令回收到对象池并清空 fillColor/lineColor。修复必须 `Laya.DrawRoundRectCmd.create(...)` 新建命令，不要复用旧对象。

## 数据绑定

9. **同名节点串写**：战斗页与排名页都有「联盟名」，领地页与角色弹窗都有「文本 1」。按页面容器（PageTab_* / 公共层 / 弹窗名）限定 findByName 作用域；弹窗容器与内层框同名时先定位外层再向内查找。
10. **图标路径前缀**：数据层 icon 存 resources 相对路径，运行时 URL 是否需要 `resources/` 前缀取决于引擎版本——集中在 `iconUrl()` 一处，实测不识别就改这里，不要散落各处。
11. **克隆槽位的样式继承时机**：先给模板实例做样式增强（字号/描边），再执行克隆（克隆逐项复制当前属性），动态生成的槽位自动带上样式。
12. **增量克隆的布局推导误判**：「首行槽数=列数」只在预摆行完整时成立；从单模板增量克隆时首行逐渐填满，推导会把 4 列误判成 2 列。列数必须由调用方 hint 给定，间距推导优先、hint 兜底。

## 交互

13. **预制体实例异步就绪**：内嵌预制体（DeckPanel 等）的子节点可能异步实例化（刷新后可达数秒），接线用「就绪探测 + 延迟重试」（找标志性节点如筛选器，50 次×100ms 上限）。注意就绪前**所有**绑定（含主导航）都不生效，刷新后立刻点啥都没反应先怀疑未就绪，等几秒再测，勿误诊为绑定 bug。
14. **小提示框命名**：外层全屏容器与内层小框同名，取内层要从子节点里找（`findByName(box, 同名)` 会匹配到 box 自身）；移动时只动内层小框，动外层全屏容器会把内容整体甩出屏幕。
15. **滚动内容尺寸时机**：GPanel 的 sourceWidth/Height 必须在动态内容（网格/列表项）生成之后再计算；列表项运行时增减后要重算并调用 scroller 的 `_ownerSizeChanged`。
16. **小点击面的鼠标释放**：28×28 的图标按压后手指偏移收不到 MOUSE_UP，tooltip 的隐藏要挂 stage 级 MOUSE_UP 兜底。
17. **按通用子名绑定事件会误绑同名节点**：场景里叫「图标」的节点既在 TroopItem 里也在底部导航按钮里（运行时共 11 个），按名字全量绑定会把部队 tooltip 错挂到导航标签上。绑定谓词必须加限定（如 `parent.name.startsWith("部队")`）。
18. **Scroller 滚动条默认常驻且挤占内容宽度**：`barDisplay` 默认 0（Default）显示常驻 32px 滚动条；非悬浮（barFloating=false）时内容视口会被扣掉滚动条宽度（720 宽面板实际视口 688）。要无反馈/仅滚动时出现：`sc.barDisplay = Laya.ScrollBarDisplay.Hidden / OnScroll` + `sc.barFloating = true`（OnScroll 为滚动时浮现、停止 0.5s 后淡出）。
19. **Tween 快速连点卡死**：动画中途 `Laya.Tween.killAll(target, false)` 不触发回调也不保证状态一致，页面会停在半途位置（实测两页悬在 -220/530）。切换动画前必须 `killAll(target, true)` 吸附到终态（隐藏/复位回调照常触发），再起新动画。
20. **Tab 滑动切换实现要点**（slideToPage）：方向按页序（索引增大从右滑入）；新旧两页用同 duration/ease 的两条补间锁步位移，几何上永不重叠；出场页的完成回调里隐藏并复位 x；重复点击当前页为无操作。页面/容器无裁剪时，滑动距离=页宽正好把滑出页送到屏幕外。
21. **无背景图形的 GBox 可见时不拦截命中**：全屏 GBox 覆盖层（如 tooltip 外层）没有 background 命令就不参与命中测试，显示它不会挡住下面的按钮；反之 GPanel+Scroller 的视口区域会吃掉落在其内的点击。排查"点不到"时先想清楚命中优先级。

## 验证

22. **mock 冒烟测试套路**：Widget 基类 mock（_children/parent/addChild/on/emit/text/src…）+ 按 `_$type` 动态建类（保证 `constructor.name` 判定可用）+ 递归实例化场景 JSON（展开 `_$prefab`、应用 `_$override`）→ 跑 onStart → 断言列表数量、文案、图标 URL、交互数据流。数据层（Store/Actions）不依赖引擎，可脱离 UI 直接单测。
23. **类型检查**：数据模型加必填字段后，Actions 里构造新对象要用展开运算符（`{ ...r, amount: x }`）而不是重新拼字面量，否则漏字段报 TS 错。
24. **浏览器实测套路（IDE 预览页直开）**：LayaAirIDE 的预览服务可直接在内嵌浏览器打开（`http://localhost:18090/?scene=<场景uuid>`）。组合拳：运行时 evaluate 读 GObject 树真实状态（`background.percent`、`scroller.barDisplay`、`visible/x/y`、`localToGlobal`）；`node.event(Laya.Event.MOUSE_OVER / CLICK)` 合成事件直接触发 handler 验证逻辑；同一页面"操作前/后"两张截图做像素差分，精确定位渲染足迹与异常色块范围。
25. **点击坐标必须运行时实测换算，不要口算**：`viewport = 设计坐标 × (canvas CSS 宽 / Laya.stage 逻辑宽)`，每次从 `canvas.getBoundingClientRect()` 和 `Laya.stage.width` 现算（本次曾把 ×0.64 口算成 ÷0.64，全部点击落在画布外，差点误报"交互失灵"）。换算后可用 `Laya.stage.mouseX/mouseY` 回读确认事件已到达。
26. **命中链日志是"点不到/点错"的最快定位手段**：`Laya.stage.on(Laya.Event.MOUSE_DOWN, ...)` 里从 `e.target` 沿 parent 收集 name 链打印；再横向扫描若干坐标点看各点命中谁，一眼看出遮挡/错位。
27. **IDE 后台节流不重编译**：修改 .ts 后若 LayaAirIDE 在后台被节流，bundle.js 不更新。测试前先 `grep 新函数名 bin/js/bundles/bundle.js` 确认已编译；未编译时刷新一次预览页 URL 可触发按需编译，否则测的是旧逻辑。

## 渲染清晰度（字体模糊）

28. **高分屏字体发虚的根因是 `useRetinalCanvas` 默认关闭**：引擎默认按 CSS 像素 1x 渲染画布，再由浏览器拉伸到物理分辨率；手机 DPR 2~3 时文字必然模糊（桌面 DPR=1 看不出来，极易漏测）。对策：场景脚本 onStart 里尽早开启并立即重建画布：

    ```ts
    if (!Laya.Config.useRetinalCanvas) {
        Laya.Config.useRetinalCanvas = true;
        Laya.stage.updateCanvasSize(false);  // Stage 公开 API，init 之后运行时开启同样生效
    }
    ```

    `updateCanvasSize` 会触发 `setScreenSize` 重算：画布物理分辨率 = 逻辑尺寸 × canvasScale × DPR、CSS transform 反向缩放（laya.core.js 中 `if (Config.useRetinalCanvas || !Browser.isDomSupported)` 分支），并按新 stage 缩放重新光栅化字体图集，文字变清晰。
29. **预览初始化配置改不了，只能运行时自救**：IDE 预览页的 init 配置经 WebSocket 下发（index.js 里 `Object.assign(Laya.Config, config["2D"])` 后 `Laya.init(config.resolution)`），默认 1334×750 横屏 + fixedheight，与竖屏 750×1600 设计不符，且该模板不受项目控制。画布分辨率、适配一律在场景脚本运行时处理（fitStage 自管 + useRetinalCanvas），不要试图改 IDE 模板。
30. **DPR=1 的测试环境验证不到模糊**：桌面内嵌浏览器 iframe 可能报告 `devicePixelRatio=1`，改完看不出任何差异，容易误判「已修复」。验证画布翻倍机制：页面内执行 `Laya.PAL.browser._pixelRatio = 2; Laya.stage.updateCanvasSize(false)`（PAL 从 laya.core 导出在 window.Laya 上），断言 `canvas.width` 翻倍而 `getBoundingClientRect()` 宽度不变（如 390→780）；最终以真机或 Chrome 设备模拟器复核实际观感。
31. **开启视网膜画布不影响逻辑布局**：stage 逻辑尺寸（design 单位）不变，fitStage 自定义适配、scrollRect 遮罩、命中测试互不干扰；字体图集缩放走引擎 `TextRenderConfig.scaleFontWithCtx` 自动重光栅化，无需手动刷新文本。
