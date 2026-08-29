export type WidgetType =
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'placeholder'
  | 'text'
  | 'button'
  | 'checkbox'
  | 'progress'
  | 'input'
  | 'tab'

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
  /** Tab：每个页签一棵独立子树（子控件用页面绝对坐标；移动 Tab 时子控件跟随） */
  pages?: WidgetNode[][]
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
  pages: PageData[]
}
