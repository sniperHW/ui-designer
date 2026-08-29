import type { WidgetNode, WidgetType } from '../types'

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

/** 内置控件（v0.2：图元 + 交互图元 + Tab 容器） */
export const WIDGET_DEFS: WidgetDef[] = [
  { type: 'rect', label: '矩形', category: 'shape', w: 160, h: 90, props: { radius: 0 } },
  { type: 'rect', label: '圆角矩形', category: 'shape', w: 160, h: 72, props: { radius: 14 } },
  { type: 'ellipse', label: '椭圆', category: 'shape', w: 120, h: 80, props: {} },
  { type: 'line', label: '线段', category: 'shape', w: 240, h: 2, props: {} },
  { type: 'placeholder', label: '占位图', category: 'shape', w: 160, h: 120, props: {} },
  { type: 'text', label: '文本', category: 'text', w: 160, h: 32, props: { text: '文本', fontSize: 26, bold: false, align: 'left' } },
  { type: 'button', label: '按钮', category: 'control', w: 200, h: 80, props: { text: '按钮', fontSize: 26, bold: false } },
  { type: 'checkbox', label: '复选框', category: 'control', w: 200, h: 40, props: { text: '选项', checked: false, fontSize: 24 } },
  { type: 'progress', label: '进度条', category: 'control', w: 300, h: 24, props: { progress: 60 } },
  { type: 'input', label: '输入框', category: 'control', w: 320, h: 64, props: { placeholder: '请输入…', fontSize: 24 } },
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
export function tabContentRect(n: WidgetNode): { x: number; y: number; w: number; h: number } {
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
export function tabBarRect(n: WidgetNode): { x: number; y: number; w: number; h: number } {
  const barH = Math.min(TAB_BAR_H, n.h / 2)
  const bottom = (n.props.barPosition ?? 'top') === 'bottom'
  return { x: n.x, y: bottom ? n.y + n.h - barH : n.y, w: n.w, h: barH }
}

/** 生成控件内部的 SVG 片段（不含 Tab 子控件；子控件由调用方递归组合） */
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

/** 递归渲染控件及其子控件（缩略图 / PNG 导出用） */
export function renderTreeSVG(n: WidgetNode): string {
  let s = widgetInnerSVG(n)
  if (n.type === 'tab' && n.pages && n.pages.length) {
    const r = tabContentRect(n)
    const clipId = `clip-${n.id}`
    s += `<defs><clipPath id="${clipId}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/></clipPath></defs>`
    s += `<g clip-path="url(#${clipId})">`
    for (const c of n.pages[activeTabIndex(n)] ?? []) {
      if (c.visible) s += renderTreeSVG(c)
    }
    s += '</g>'
  }
  return s
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
  const pad = 6
  return `<svg viewBox="${-pad} ${-pad} ${def.w + pad * 2} ${def.h + pad * 2}" width="38" height="26" preserveAspectRatio="xMidYMid meet">${widgetInnerSVG(node)}</svg>`
}
