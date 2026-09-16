export type WidgetType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'placeholder'
  | 'image'
  | 'nine'
  | 'text'
  | 'button'
  | 'checkbox'
  | 'progress'
  | 'input'
  | 'filter'
  | 'panel'
  | 'dialog'
  | 'tooltip'
  | 'scroll'
  | 'list'
  | 'grid'
  | 'tab'
  | 'custom'

export interface WidgetProps {
  /** 文本内容 / 按钮文字 / 复选框标签 */
  text?: string
  placeholder?: string
  /** 本地 PNG / SVG 的 file:// URI 或 data URI（图片控件） */
  src?: string
  /** 控件皮肤图片（适用于保留原控件交互的装配预览） */
  assetSrc?: string
  /** 九宫格皮肤切片边距：[左, 上, 右, 下]；未配置时按节点尺寸均分示意。 */
  nineInsets?: [number, number, number, number]
  /** 九宫格皮肤的原始设计尺寸；配合 nineInsets 在任意目标尺寸保持四角不变形。 */
  nineSourceSize?: [number, number]
  /** 多态控件（筛选 / Tab）的普通、选中皮肤，以及进度填充皮肤 */
  assetDefaultSrc?: string
  assetActiveSrc?: string
  /** 筛选器选中项可选的悬挂装饰；随真实 selected 状态自动移动。 */
  assetActiveOverlaySrc?: string
  activeOverlayWidth?: number
  activeOverlayHeight?: number
  activeOverlayOffsetX?: number
  activeOverlayOffsetY?: number
  /** Tab：按页签下标指定的普通、选中皮肤；缺项回退到单一皮肤 */
  assetDefaultSrcs?: string[]
  assetActiveSrcs?: string[]
  /** Tab：叠加在完整页签底板上的透明图标；不属于页签皮肤本身。 */
  assetIconSrc?: string
  assetIconSrcs?: string[]
  assetIconWidth?: number
  assetIconHeight?: number
  /** Tab：图标导航不渲染标签，保留 tabs 作为真实页签与无障碍语义。 */
  hideTabLabels?: boolean
  assetFillSrc?: string
  fontSize?: number
  bold?: boolean
  /** 文本颜色与描边：用于深色素材上的可读性 */
  textColor?: string
  textStroke?: string
  textStrokeWidth?: number
  fontWeight?: number
  align?: 'left' | 'center' | 'right'
  radius?: number
  /** 进度条百分比 0-100 */
  progress?: number
  checked?: boolean
  /** Tab：页签标题（每项一个页签） */
  tabs?: string[]
  /** Tab：各页签头宽度（设计像素）；未设置时均分，剩余区域不作为页签点击区 */
  tabWidths?: number[]
  /** Tab：相邻独立页签之间的固定留缝，避免完整边框互相叠压。 */
  tabGap?: number
  /** Tab：页签栏位置 */
  barPosition?: 'top' | 'bottom'
  /** Tab：页签栏高度（默认 40，上限为控件高一半） */
  barHeight?: number
  /** 容器底面透明：用于让页面背景穿透，仍保留子控件与交互 */
  transparentSurface?: boolean
  /** 滚动区滑块颜色；框体素材由 assetSrc 承担，滑块仍保留真实滚动语义。 */
  scrollThumbColor?: string
  /** 弹窗：标题栏文字 */
  title?: string
  /** 弹窗：隐藏编辑器默认标题栏与叉号，改由皮肤及独立节点提供视觉。 */
  hideDialogChrome?: boolean
  /** 弹窗：自定义关闭热区（页面绝对坐标），用于与美术关闭按钮严格对齐。 */
  dialogCloseRect?: [number, number, number, number]
  /** 轻提示框：尾箭头方向（默认 bottom，指向被提示控件） */
  tail?: 'top' | 'bottom' | 'left' | 'right'
  /** 列表：方向 */
  direction?: 'v' | 'h'
  /** 列表 / 网格：项数 */
  count?: number
  /** 网格：列数 */
  cols?: number
  /** 筛选器：标签列表 */
  options?: string[]
  /** 筛选器：每项宽度（设计像素）；不填时均分。 */
  filterWidths?: number[]
  /** 筛选器：当前选中项下标 */
  selected?: number
}

/** 锚点：九宫格预设 + 尺寸模式（§6 多分辨率适配） */
export type AnchorPreset = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br'
export type AnchorMode = 'fixed' | 'stretch' | 'aspect'
export interface Anchor {
  preset: AnchorPreset
  mode: AnchorMode
}

/** 点击效果（§8 交互原型）：切换页面 / 返回上一页 / 弹出弹窗 */
export interface ClickAction {
  type: 'goto' | 'back' | 'popup'
  /** goto：目标页面 id；popup：弹窗页（doc.popups）id；back 无需目标（运行时取来路页面） */
  target?: string
}

/** 定制控件：对外暴露的属性（内部子控件属性绑定到它，实例只覆盖它） */
export interface CustomPropBind {
  /** 定义树内被绑定的节点 id */
  nodeId: string
  /** 被绑定的属性键：text / fontSize / radius / progress / checked / placeholder / title / activeTab … */
  key: string
}

export type CustomPropType = 'string' | 'number' | 'boolean' | 'tab-index'

export interface CustomPropDef {
  name: string
  type: CustomPropType
  default: string | number | boolean
  binds: CustomPropBind[]
}

/** 定制控件定义（§5） */
export interface CustomWidgetDef {
  id: string
  name: string
  group: string
  /** 默认尺寸（tree 的包围盒） */
  w: number
  h: number
  /** 建议锚点：实例化时自动吸附（§5.1 发布设置） */
  suggestAnchor?: 'none' | 'top-stretch' | 'bottom-stretch'
  /** 暴露属性 */
  props: CustomPropDef[]
  /** 内部结构（归一化到 (0,0) 原点的根节点列表） */
  tree: WidgetNode[]
  /** 开放为插槽的容器节点 id（Tab 容器默认每页签一槽，无需列出） */
  slotNodeIds?: string[]
}

export interface WidgetNode {
  id: string
  type: WidgetType
  name: string
  x: number
  y: number
  w: number
  h: number
  visible: boolean
  locked: boolean
  props: WidgetProps
  /** Tab：当前页签下标（文档属性：编辑中的页 + 预览初始选中） */
  activeTab?: number
  /** Tab：每个页签一棵独立子树（子控件页面绝对坐标；移动时子控件跟随） */
  pages?: WidgetNode[][]
  /** 面板 / 弹窗 / 滚动区：单一内容区子控件（页面绝对坐标） */
  children?: WidgetNode[]
  /** 定制控件实例：指向 doc.customWidgets 的定义 id */
  customId?: string
  /** 定制控件实例：暴露属性覆盖值（键 = 暴露属性名） */
  overrides?: Record<string, string | number | boolean>
  /** 定制控件实例：插槽内容（键 = 定义内容器 id；Tab 为 `${id}:${页签下标}`），页面绝对坐标 */
  slots?: Record<string, WidgetNode[]>
  /** 锚点（多分辨率适配；缺省 = 随父等比拉伸） */
  anchor?: Anchor
  /** 筛选器：绑定同页的列表 / 网格 + 标记键（§4.2） */
  binding?: { target: string; tagKey: string }
  /** 列表 / 网格：每项标记值（与项数对齐，供筛选器过滤） */
  itemTags?: string[]
  /** 可点击（按钮天生可点击，无需此标记；其它控件显式开启。定制控件实例不支持——统一配在定义内控件上） */
  clickable?: boolean
  /** 点击效果：切换页面 / 弹出弹窗（编辑器内右键「点击」演示触发） */
  clickAction?: ClickAction
  /** 轻提示标记：指向轻提示页（doc.tips）id，悬停该控件时弹出对应轻提示框。
   *  与可点击同理配在定义内控件上（定义级，实例同步生效），定制控件实例自身不支持 */
  tipTarget?: string
}

export type Orientation = 'landscape' | 'portrait'

export interface ProjectMeta {
  name: string
  designWidth: number
  designHeight: number
  orientation: Orientation
}

export interface PageData {
  id: string
  name: string
  nodes: WidgetNode[]
}

export interface ProjectDoc {
  version: 1
  meta: ProjectMeta
  /** 公共层：内容显示在所有页面之下（如顶部状态栏），在页面列表顶部的"公共层"条目中编辑 */
  commonLayer: PageData
  /** 定制控件库（§5） */
  customWidgets: CustomWidgetDef[]
  /** 弹窗页：独立设计的弹窗内容（典型：一个居中的 dialog），由点击效果（popup）弹出显示 */
  popups: PageData[]
  /** 轻提示页：独立设计的轻提示内容（典型：一个 tooltip 气泡），由轻提示标记（tipTarget）悬停弹出 */
  tips: PageData[]
  pages: PageData[]
}
