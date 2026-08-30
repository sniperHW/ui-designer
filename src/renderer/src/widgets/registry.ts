import type { CustomWidgetDef, ProjectMeta, WidgetNode, WidgetType } from '../types'

export type Category = 'shape' | 'text' | 'control' | 'container'

export interface WidgetDef {
  type: WidgetType
  label: string
  category: Category
  w: number
  h: number
  props: WidgetNode['props']
}

export const CATEGORY_LABEL: Record<Category, string> = {
  shape: '形状',
  text: '文本',
  control: '交互',
  container: '容器'
}

/** Tab 页签栏高度（文档坐标） */
export const TAB_BAR_H = 40
/** 弹窗标题栏高度 */
export const DIALOG_TITLE_H = 48

/** 内置控件（图元 + 交互图元 + 容器） */
export const WIDGET_DEFS: WidgetDef[] = [
  { type: 'rect', label: '矩形', category: 'shape', w: 160, h: 90, props: { radius: 0 } },
  { type: 'rect', label: '圆角矩形', category: 'shape', w: 160, h: 72, props: { radius: 14 } },
  { type: 'ellipse', label: '椭圆', category: 'shape', w: 120, h: 80, props: {} },
  { type: 'line', label: '线段', category: 'shape', w: 240, h: 2, props: {} },
  { type: 'placeholder', label: '占位图', category: 'shape', w: 160, h: 120, props: {} },
  { type: 'nine', label: '九宫格', category: 'shape', w: 160, h: 120, props: {} },
  { type: 'text', label: '文本', category: 'text', w: 160, h: 32, props: { text: '文本', fontSize: 26, bold: false, align: 'left' } },
  { type: 'button', label: '按钮', category: 'control', w: 200, h: 80, props: { text: '按钮', fontSize: 26, bold: false } },
  { type: 'checkbox', label: '复选框', category: 'control', w: 200, h: 40, props: { text: '选项', checked: false, fontSize: 24 } },
  { type: 'progress', label: '进度条', category: 'control', w: 300, h: 24, props: { progress: 60 } },
  { type: 'input', label: '输入框', category: 'control', w: 320, h: 64, props: { placeholder: '请输入…', fontSize: 24 } },
  { type: 'filter', label: '筛选器', category: 'control', w: 480, h: 56, props: { options: ['全部', '英雄', '部队', '建筑'], selected: 0 } },
  { type: 'panel', label: '面板', category: 'container', w: 320, h: 240, props: {} },
  { type: 'dialog', label: '弹窗', category: 'container', w: 480, h: 320, props: { title: '弹窗标题' } },
  { type: 'scroll', label: '滚动区', category: 'container', w: 320, h: 240, props: {} },
  { type: 'list', label: '列表', category: 'container', w: 300, h: 320, props: { direction: 'v', count: 5 } },
  { type: 'grid', label: '网格', category: 'container', w: 400, h: 320, props: { cols: 3, count: 9 } },
  {
    type: 'tab',
    label: 'Tab 页签',
    category: 'container',
    w: 480,
    h: 320,
    props: { tabs: ['页签 1', '页签 2', '页签 3'], barPosition: 'top' }
  }
]

const INK = '#111827'
const GRAY = '#9ca3af'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const STROKE = `stroke="${INK}" stroke-width="2" vector-effect="non-scaling-stroke"`

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** 文本块（支持多行、对齐、垂直居中），x/width 为文本区域 */
function textBlock(n: WidgetNode, x: number, width: number, fill = INK): string {
  const fontSize = n.props.fontSize ?? 24
  const raw = (n.props.text ?? '').split('\n')
  const lines = raw.length > 0 ? raw : ['']
  const lh = Math.round(fontSize * 1.3)
  const total = lh * (lines.length - 1)
  const cy = n.y + n.h / 2
  const align = n.props.align ?? 'left'
  let tx = x
  let anchor = 'start'
  if (align === 'center') {
    tx = x + width / 2
    anchor = 'middle'
  } else if (align === 'right') {
    tx = x + width
    anchor = 'end'
  }
  const weight = n.props.bold ? ' font-weight="700"' : ''
  const spans = lines
    .map((l, i) => `<tspan x="${tx}" y="${Math.round(cy - total / 2 + i * lh)}">${esc(l) || ' '}</tspan>`)
    .join('')
  return `<text x="${tx}" y="${Math.round(cy)}" fill="${fill}" font-size="${fontSize}" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif"${weight} text-anchor="${anchor}" dominant-baseline="central">${spans}</text>`
}

/** Tab 的内容区矩形（页面绝对坐标，页签栏之外的区域） */
export function tabContentRect(n: WidgetNode): Rect {
  const barH = Math.min(TAB_BAR_H, n.h / 2)
  const bottom = (n.props.barPosition ?? 'top') === 'bottom'
  return { x: n.x, y: bottom ? n.y : n.y + barH, w: n.w, h: Math.max(0, n.h - barH) }
}

/** Tab 当前激活页签下标（含越界保护） */
export function activeTabIndex(n: WidgetNode): number {
  const count = Math.max(1, n.props.tabs?.length ?? 1)
  return Math.max(0, Math.min(count - 1, n.activeTab ?? 0))
}

/** Tab 页签头 i 的矩形（页面绝对坐标），供画布点击命中用 */
export function tabBarRect(n: WidgetNode): Rect {
  const barH = Math.min(TAB_BAR_H, n.h / 2)
  const bottom = (n.props.barPosition ?? 'top') === 'bottom'
  return { x: n.x, y: bottom ? n.y + n.h - barH : n.y, w: n.w, h: barH }
}

/** 容器的内容区矩形（可挂子控件的区域）；非容器返回 null */
export function contentRectOf(n: WidgetNode): Rect | null {
  switch (n.type) {
    case 'tab':
      return tabContentRect(n)
    case 'panel':
    case 'scroll':
      return { x: n.x, y: n.y, w: n.w, h: n.h }
    case 'dialog': {
      const t = Math.min(DIALOG_TITLE_H, n.h / 2)
      return { x: n.x, y: n.y + t, w: n.w, h: Math.max(0, n.h - t) }
    }
    default:
      return null
  }
}

/** 容器在画布上显示的直接子控件（Tab = 当前页签；面板/弹窗/滚动区 = children）；非容器返回 null */
export function renderKidsOf(n: WidgetNode): WidgetNode[] | null {
  if (n.type === 'tab') return n.pages?.[activeTabIndex(n)] ?? null
  if (n.type === 'panel' || n.type === 'dialog' || n.type === 'scroll') return n.children ?? null
  return null
}

// ---------------------------------------------------------------------------
// 多分辨率预览（§6）：按锚点规则把设计尺寸布局重排到目标分辨率
// ---------------------------------------------------------------------------

/** 单个矩形按锚点规则从父空间 F 映射到 T（无锚点 = 左上锚定 + 随父拉伸） */
export function transformRect(r: Rect, F: Rect, T: Rect, anchor?: WidgetNode['anchor']): Rect {
  const kx = T.w / F.w
  const ky = T.h / F.h
  const ml = r.x - F.x
  const mt = r.y - F.y
  const mr = F.x + F.w - (r.x + r.w)
  const mb = F.y + F.h - (r.y + r.h)
  let w2: number
  let h2: number
  if (anchor?.mode === 'fixed') {
    w2 = r.w
    h2 = r.h
  } else if (anchor?.mode === 'aspect') {
    const s = Math.min(kx, ky)
    w2 = r.w * s
    h2 = r.h * s
  } else {
    w2 = r.w * kx
    h2 = r.h * ky
  }
  const col = anchor ? anchor.preset[1] : 'l'
  const row = anchor ? anchor.preset[0] : 't'
  let x2: number
  if (col === 'l') x2 = T.x + ml * kx
  else if (col === 'r') x2 = T.x + T.w - mr * kx - w2
  else x2 = T.x + (T.w - w2) / 2
  let y2: number
  if (row === 't') y2 = T.y + mt * ky
  else if (row === 'b') y2 = T.y + T.h - mb * ky - h2
  else y2 = T.y + (T.h - h2) / 2
  return { x: x2, y: y2, w: w2, h: h2 }
}

/** 递归变换整棵子树（克隆，不改动原文档）：容器子控件按容器内容区的映射递归 */
export function transformTree(nodes: WidgetNode[], F: Rect, T: Rect): WidgetNode[] {
  return nodes.map((n) => {
    const r2 = transformRect(n, F, T, n.anchor)
    const c: WidgetNode = {
      ...n,
      x: Math.round(r2.x),
      y: Math.round(r2.y),
      w: Math.max(1, Math.round(r2.w)),
      h: Math.max(1, Math.round(r2.h))
    }
    const cr0 = contentRectOf(n)
    const cr2 = contentRectOf(c)
    const innerF = cr0 && cr2 ? cr0 : F
    const innerT = cr0 && cr2 ? cr2 : T
    if (c.pages) c.pages = c.pages.map((p) => transformTree(p, innerF, innerT))
    if (c.children) c.children = transformTree(c.children, innerF, innerT)
    // 插槽子控件是页面绝对坐标：按当前层（实例所在空间）映射
    if (c.slots) {
      const next: Record<string, WidgetNode[]> = {}
      for (const [k, v] of Object.entries(c.slots)) next[k] = transformTree(v, F, T)
      c.slots = next
    }
    return c
  })
}

/** 分辨率预设（长边比：横屏 w/h；竖屏按 h/w 折算） */
export const PREVIEW_RATIOS: { id: string; label: string; r: number }[] = [
  { id: 'design', label: '设计尺寸', r: 0 },
  { id: '16:9', label: '16:9', r: 16 / 9 },
  { id: '18:9', label: '18:9', r: 2 },
  { id: '19.5:9', label: '19.5:9', r: 19.5 / 9 },
  { id: '4:3', label: '4:3', r: 4 / 3 }
]

export function previewDims(meta: ProjectMeta, ratioId: string): { w: number; h: number } {
  const r = PREVIEW_RATIOS.find((p) => p.id === ratioId)?.r ?? 0
  if (!r || r <= 0) return { w: meta.designWidth, h: meta.designHeight }
  return meta.orientation === 'portrait'
    ? { w: Math.round(meta.designHeight / r), h: meta.designHeight }
    : { w: meta.designWidth, h: Math.round(meta.designWidth / r) }
}

// ---------------------------------------------------------------------------
// 定制控件（§5）：定义树解析 → 实例渲染
// ---------------------------------------------------------------------------

function findByIdLocal(arr: WidgetNode[], id: string): WidgetNode | null {
  for (const n of arr) {
    if (n.id === id) return n
    const subs: WidgetNode[][] = [
      ...(n.pages ?? []),
      ...(n.children ? [n.children] : []),
      ...(n.slots ? Object.values(n.slots) : [])
    ]
    for (const s of subs) {
      const r = findByIdLocal(s, id)
      if (r) return r
    }
  }
  return null
}

/** 定义树解析暴露属性绑定（克隆 + 应用覆盖值） */
export function resolveTree(
  def: CustomWidgetDef,
  overrides?: Record<string, string | number | boolean>
): WidgetNode[] {
  const tree = structuredClone(def.tree)
  for (const p of def.props) {
    const v = overrides?.[p.name] !== undefined ? overrides[p.name] : p.default
    for (const b of p.binds) {
      const node = findByIdLocal(tree, b.nodeId)
      if (!node) continue
      if (b.key === 'activeTab') node.activeTab = Number(v)
      else (node.props as Record<string, unknown>)[b.key] = v
    }
  }
  return tree
}

/** 几何缩放（克隆）：整棵子树平移 + 拉伸，字号按两轴均值缩放 */
export function scaleTree(nodes: WidgetNode[], sx: number, sy: number, tx: number, ty: number): WidgetNode[] {
  const fs = (sx + sy) / 2
  const map = (n: WidgetNode): WidgetNode => {
    const c: WidgetNode = {
      ...n,
      x: tx + n.x * sx,
      y: ty + n.y * sy,
      w: Math.max(1, n.w * sx),
      h: Math.max(1, n.h * sy),
      props: n.props.fontSize
        ? { ...n.props, fontSize: Math.max(8, Math.round(n.props.fontSize * fs)) }
        : { ...n.props }
    }
    if (c.pages) c.pages = c.pages.map((p) => p.map(map))
    if (c.children) c.children = c.children.map(map)
    if (c.slots) {
      const next: Record<string, WidgetNode[]> = {}
      for (const [k, v] of Object.entries(c.slots)) next[k] = v.map(map)
      c.slots = next
    }
    return c
  }
  return nodes.map(map)
}

export interface SlotInfo {
  key: string
  name: string
  rect: Rect
  children: WidgetNode[]
}

/** 实例的插槽列表：Tab 容器每页签一槽；标记为插槽的容器整体一槽（§5.5） */
export function slotsOfDef(innerTree: WidgetNode[], def: CustomWidgetDef): { key: string; name: string; rect: Rect }[] {
  const out: { key: string; name: string; rect: Rect }[] = []
  for (const n of innerTree) {
    if (n.type === 'tab' && n.pages) {
      const tabs = n.props.tabs?.length ? n.props.tabs : ['页签 1']
      tabs.forEach((t, i) => {
        const r = tabContentRect(n)
        out.push({ key: `${n.id}:${i}`, name: `${n.name} / ${t}`, rect: r })
      })
    } else if (def.slotNodeIds?.includes(n.id)) {
      const r = contentRectOf(n)
      if (r) out.push({ key: n.id, name: n.name, rect: r })
    }
  }
  return out
}

let clipSeq = 0

function clipped(rect: Rect, key: string, body: string): string {
  // id 每次渲染递增：同一节点会同时出现在画布与页面缩略图中，固定 id 会因 SVG 全局 id 冲突互相裁剪
  const id = `clip-${key}-c${++clipSeq}`
  return (
    `<defs><clipPath id="${id}"><rect x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}"/></clipPath></defs>` +
    `<g clip-path="url(#${id})">${body}</g>`
  )
}

function missingDefSVG(n: WidgetNode): string {
  return (
    `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="#ffffff" stroke="${GRAY}" stroke-width="2" stroke-dasharray="8 5" vector-effect="non-scaling-stroke"/>` +
    `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2}" fill="${GRAY}" font-size="20" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif" text-anchor="middle" dominant-baseline="central">${esc(n.name)}（定义已删除）</text>`
  )
}

/** 定制控件实例：内部结构（解析暴露属性 + 缩放到实例矩形）+ 插槽矩形 */
export function renderCustomInstance(
  n: WidgetNode,
  def: CustomWidgetDef,
  defs: CustomWidgetDef[]
): { inner: string; slots: SlotInfo[] } {
  const resolved = resolveTree(def, n.overrides)
  const scaled = scaleTree(resolved, n.w / def.w, n.h / def.h, n.x, n.y)
  const inner = scaled.map((t) => renderResolved(t, defs)).join('')
  const slots = slotsOfDef(scaled, def).map((s) => ({ ...s, children: n.slots?.[s.key] ?? [] }))
  return { inner, slots }
}

/**
 * 递归渲染一个节点（含容器子控件、定制控件实例与插槽）——缩略图 / PNG 导出 / 定制控件内部共用
 */
export function renderResolved(n: WidgetNode, defs: CustomWidgetDef[]): string {
  if (n.type === 'custom') {
    const def = defs.find((d) => d.id === n.customId)
    if (!def) return missingDefSVG(n)
    const r = renderCustomInstance(n, def, defs)
    let s = r.inner
    for (const sl of r.slots) {
      const body = sl.children.filter((c) => c.visible).map((c) => renderResolved(c, defs)).join('')
      if (body) s += clipped(sl.rect, n.id + '-' + sl.key, body)
    }
    return s
  }
  let s = widgetInnerSVG(n)
  const kids = renderKidsOf(n)
  if (kids && kids.length) {
    const r = contentRectOf(n)
    if (r) {
      const body = kids.filter((c) => c.visible).map((c) => renderResolved(c, defs)).join('')
      if (body) s += clipped(r, n.id, body)
    }
  }
  return s
}

/** 递归渲染控件及其子控件（缩略图 / PNG 导出用） */
export function renderTreeSVG(n: WidgetNode, defs: CustomWidgetDef[] = []): string {
  return renderResolved(n, defs)
}

/** 生成控件内部的 SVG 片段（不含子控件；子控件由调用方递归组合） */
export function widgetInnerSVG(n: WidgetNode): string {
  const { x, y, w, h } = n
  const cy = y + h / 2
  switch (n.type) {
    case 'rect':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(n.props.radius ?? 0, w / 2, h / 2)}" fill="#ffffff" ${STROKE}/>`
    case 'ellipse':
      return `<ellipse cx="${x + w / 2}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="#ffffff" ${STROKE}/>`
    case 'line':
      return `<line x1="${x}" y1="${cy}" x2="${x + w}" y2="${cy}" ${STROKE}/>`
    case 'placeholder':
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>` +
        `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y + h}" ${STROKE}/>` +
        `<line x1="${x + w}" y1="${y}" x2="${x}" y2="${y + h}" ${STROKE}/>`
      )
    case 'nine': {
      // 九宫格缩放占位图：三分线示意可拉伸区域
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
      for (let i = 1; i <= 2; i++) {
        const vx = Math.round(x + (w * i) / 3)
        const hy = Math.round(y + (h * i) / 3)
        s += `<line x1="${vx}" y1="${y}" x2="${vx}" y2="${y + h}" stroke="#c3c8d0" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        s += `<line x1="${x}" y1="${hy}" x2="${x + w}" y2="${hy}" stroke="#c3c8d0" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
      }
      return s
    }
    case 'text':
      return textBlock(n, x + 2, w - 4)
    case 'button': {
      const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(12, w / 2, h / 2)}" fill="#ffffff" ${STROKE}/>`
      return rect + textBlock({ ...n, props: { ...n.props, align: 'center' } }, x + 4, w - 8)
    }
    case 'checkbox': {
      const box = 18
      const by = Math.round(cy - box / 2)
      let s = `<rect x="${x}" y="${by}" width="${box}" height="${box}" fill="#ffffff" ${STROKE}/>`
      if (n.props.checked) {
        s += `<path d="M ${x + 4} ${by + 9} L ${x + 7.5} ${by + 13} L ${x + 14} ${by + 5}" fill="none" ${STROKE}/>`
      }
      s += textBlock({ ...n, props: { ...n.props, align: 'left' } }, x + box + 10, w - box - 10)
      return s
    }
    case 'progress': {
      const p = Math.max(0, Math.min(100, n.props.progress ?? 0))
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>` +
        `<rect x="${x + 3}" y="${y + 3}" width="${Math.max(0, (w - 6) * (p / 100))}" height="${Math.max(0, h - 6)}" fill="#d1d5db"/>`
      )
    }
    case 'input': {
      const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#ffffff" ${STROKE}/>`
      const ph: WidgetNode = { ...n, props: { ...n.props, align: 'left' } }
      return rect + textBlock(ph, x + 12, w - 24, GRAY)
    }
    case 'filter': {
      // 筛选器（§4.2）：一行标签，单选高亮（黑底白字）
      const options = n.props.options?.length ? n.props.options : ['全部']
      const count = options.length
      const cw = w / count
      const sel = Math.max(0, Math.min(count - 1, n.props.selected ?? 0))
      let s = ''
      for (let i = 0; i < count; i++) {
        const cx0 = x + i * cw
        const active = i === sel
        s += active
          ? `<rect x="${cx0 + 2}" y="${y + 2}" width="${cw - 4}" height="${h - 4}" rx="${Math.min(10, (h - 4) / 2)}" fill="${INK}"/>` +
            `<text x="${cx0 + cw / 2}" y="${cy}" fill="#ffffff" font-size="20" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif" font-weight="700" text-anchor="middle" dominant-baseline="central">${esc(options[i])}</text>`
          : `<rect x="${cx0 + 2}" y="${y + 2}" width="${cw - 4}" height="${h - 4}" rx="${Math.min(10, (h - 4) / 2)}" fill="#ffffff" ${STROKE}/>` +
            `<text x="${cx0 + cw / 2}" y="${cy}" fill="${INK}" font-size="20" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif" text-anchor="middle" dominant-baseline="central">${esc(options[i])}</text>`
      }
      return s
    }
    case 'panel':
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
    case 'dialog': {
      const t = Math.min(DIALOG_TITLE_H, h / 2)
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
      s += `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${t - 2}" fill="#eceff3"/>`
      s += `<line x1="${x + 1}" y1="${y + t}" x2="${x + w - 1}" y2="${y + t}" ${STROKE}/>`
      const title: WidgetNode = {
        ...n,
        y: y,
        h: t,
        props: { ...n.props, text: n.props.title ?? '弹窗', fontSize: 24, bold: true, align: 'left' }
      }
      s += textBlock(title, x + 16, w - 60)
      // 关闭按钮 ✕
      const bx = x + w - t / 2 - 8
      const bc = y + t / 2
      s += `<path d="M ${bx - 8} ${bc - 8} L ${bx + 8} ${bc + 8} M ${bx + 8} ${bc - 8} L ${bx - 8} ${bc + 8}" ${STROKE}/>`
      return s
    }
    case 'scroll': {
      // 滚动区：边框 + 右侧滚动条示意
      const sw = Math.min(14, w / 6)
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
      s += `<rect x="${x + w - sw}" y="${y + 2}" width="${sw - 3}" height="${h - 4}" fill="#f3f4f6" stroke="#c3c8d0" stroke-width="1" vector-effect="non-scaling-stroke"/>`
      s += `<rect x="${x + w - sw + 1}" y="${y + 4}" width="${sw - 5}" height="${Math.max(10, h * 0.35)}" fill="#d1d5db"/>`
      return s
    }
    case 'list':
    case 'grid': {
      // 列表 / 网格：数量可变的重复结构（项为生成的占位格，标记显示在格子底部）
      const count = Math.max(0, n.props.count ?? 4)
      const cols = n.type === 'grid' ? Math.max(1, n.props.cols ?? 3) : n.props.direction === 'h' ? Math.max(1, count) : 1
      const rows = Math.max(1, Math.ceil(count / cols))
      const cw = w / cols
      const chh = h / rows
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
      for (let i = 0; i < count; i++) {
        const cxi = x + (i % cols) * cw
        const cyi = y + Math.floor(i / cols) * chh
        s += `<rect x="${cxi + 1}" y="${cyi + 1}" width="${cw - 2}" height="${chh - 2}" fill="#ffffff" stroke="#c3c8d0" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        s += `<line x1="${cxi + 4}" y1="${cyi + 4}" x2="${cxi + cw - 6}" y2="${cyi + chh - 6}" stroke="#d8dce3" stroke-width="1" vector-effect="non-scaling-stroke"/>`
        s += `<line x1="${cxi + cw - 6}" y1="${cyi + 4}" x2="${cxi + 4}" y2="${cyi + chh - 6}" stroke="#d8dce3" stroke-width="1" vector-effect="non-scaling-stroke"/>`
        const tag = n.itemTags?.[i]
        if (tag) {
          s += `<text x="${cxi + 5}" y="${cyi + chh - 8}" fill="${GRAY}" font-size="13" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif" text-anchor="start" dominant-baseline="central">${esc(tag)}</text>`
        }
      }
      for (let i = 1; i < cols; i++) s += `<line x1="${x + i * cw}" y1="${y}" x2="${x + i * cw}" y2="${y + h}" ${STROKE}/>`
      for (let i = 1; i < rows; i++) s += `<line x1="${x}" y1="${y + i * chh}" x2="${x + w}" y2="${y + i * chh}" ${STROKE}/>`
      return s
    }
    case 'tab': {
      const tabs = n.props.tabs && n.props.tabs.length ? n.props.tabs : ['页签 1']
      const count = tabs.length
      const hw = w / count
      const barH = Math.min(TAB_BAR_H, h / 2)
      const bottom = (n.props.barPosition ?? 'top') === 'bottom'
      const barY = bottom ? y + h - barH : y
      const active = activeTabIndex(n)
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" ${STROKE}/>`
      s += `<rect x="${x + 1}" y="${barY + 1}" width="${w - 2}" height="${barH - 2}" fill="#eceff3"/>`
      for (let i = 1; i < count; i++) {
        const lx = x + i * hw
        s += `<line x1="${lx}" y1="${barY + 5}" x2="${lx}" y2="${barY + barH - 5}" stroke="#9aa0ab" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
      }
      const sepY = bottom ? barY : barY + barH
      s += `<line x1="${x + 1}" y1="${sepY}" x2="${x + w - 1}" y2="${sepY}" ${STROKE}/>`
      const ax = x + active * hw
      const coverY = bottom ? barY - 1 : barY + 1
      s += `<rect x="${ax + 2}" y="${coverY}" width="${hw - 4}" height="${barH - 1}" fill="#ffffff"/>`
      for (let i = 0; i < count; i++) {
        const bold = i === active ? ' font-weight="700"' : ''
        s += `<text x="${x + (i + 0.5) * hw}" y="${barY + barH / 2}" fill="${INK}" font-size="22" font-family="'PingFang SC','Microsoft YaHei',system-ui,sans-serif"${bold} text-anchor="middle" dominant-baseline="central">${esc(tabs[i] || `页签 ${i + 1}`)}</text>`
      }
      return s
    }
    default:
      return ''
  }
}

/** 控件库小图标 */
export function libIcon(def: WidgetDef): string {
  const node: WidgetNode = {
    id: 'icon',
    type: def.type,
    name: def.label,
    x: 0,
    y: 0,
    w: def.w,
    h: def.h,
    visible: true,
    locked: false,
    props: structuredClone(def.props)
  }
  if (def.type === 'list') node.itemTags = []
  if (def.type === 'tab') {
    node.activeTab = 0
    node.pages = (def.props.tabs ?? []).map(() => [])
  }
  const pad = 6
  const vw = Math.min(def.w, 480)
  const vh = Math.round((vw / def.w) * def.h)
  return `<svg viewBox="${-pad} ${-pad} ${vw + pad * 2} ${vh + pad * 2}" width="38" height="26" preserveAspectRatio="xMidYMid meet">${widgetInnerSVG({ ...node, w: vw, h: vh })}</svg>`
}
