export type WidgetType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'placeholder'
  | 'nine'
  | 'text'
  | 'button'
  | 'checkbox'
  | 'progress'
  | 'input'
  | 'filter'
  | 'panel'
  | 'dialog'
  | 'scroll'
  | 'list'
  | 'grid'
  | 'tab'
  | 'custom'

export interface WidgetProps {
  /** 文本内容 / 按钮文字 / 复选框标签 */
  text?: string
  placeholder?: string
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  radius?: number
  /** 进度条百分比 0-100 */
  progress?: number
  checked?: boolean
  /** Tab：页签标题（每项一个页签） */
  tabs?: string[]
  /** Tab：页签栏位置 */
  barPosition?: 'top' | 'bottom'
  /** Tab：页签栏高度（默认 40，上限为控件高一半） */
  barHeight?: number
  /** 弹窗：标题栏文字 */
  title?: string
  /** 列表：方向 */
  direction?: 'v' | 'h'
  /** 列表 / 网格：项数 */
  count?: number
  /** 网格：列数 */
  cols?: number
  /** 筛选器：标签列表 */
  options?: string[]
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
  pages: PageData[]
}
