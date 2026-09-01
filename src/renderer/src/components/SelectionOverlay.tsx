import { useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { useEditor } from '../store/editorStore'
import { childSubtrees } from '../widgets/tree'
import type { WidgetNode } from '../types'

const HANDLES = [
  { dir: 'nw', x: 0, y: 0, cursor: 'nwse-resize' },
  { dir: 'n', x: 0.5, y: 0, cursor: 'ns-resize' },
  { dir: 'ne', x: 1, y: 0, cursor: 'nesw-resize' },
  { dir: 'e', x: 1, y: 0.5, cursor: 'ew-resize' },
  { dir: 'se', x: 1, y: 1, cursor: 'nwse-resize' },
  { dir: 's', x: 0.5, y: 1, cursor: 'ns-resize' },
  { dir: 'sw', x: 0, y: 1, cursor: 'nesw-resize' },
  { dir: 'w', x: 0, y: 0.5, cursor: 'ew-resize' }
] as const

export default function SelectionOverlay() {
  const viewport = useEditor((s) => s.viewport)
  const selectedIds = useEditor((s) => s.selectedIds)
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const [hint, setHint] = useState<{ w: number; h: number } | null>(null)

  // 与 Canvas 一致的编辑目标：定制控件定义树 / 公共层 / 当前页
  const editingDef = editingWidgetId
    ? doc.customWidgets.find((w) => w.id === editingWidgetId) ?? null
    : null
  const root = editingDef
    ? editingDef.tree
    : pageIndex < 0
      ? doc.commonLayer.nodes
      : doc.pages[pageIndex]?.nodes ?? []

  // 深度收集选中节点（Tab 页签 / 容器 children / 定制控件插槽内的内嵌控件都算）
  const sel: WidgetNode[] = []
  const walk = (arr: WidgetNode[]): void => {
    for (const n of arr) {
      if (selectedIds.includes(n.id)) sel.push(n)
      for (const sub of childSubtrees(n)) walk(sub)
    }
  }
  walk(root)
  if (sel.length === 0) return null

  const { zoom: z, panX, panY } = viewport
  const sx = (v: number) => panX + v * z
  const sy = (v: number) => panY + v * z

  // 单选：选择框 + 8 向缩放手柄
  if (sel.length === 1) {
    const n = sel[0]
    const left = sx(n.x)
    const top = sy(n.y)
    const startResize = (e: RPointerEvent<HTMLDivElement>, dir: string) => {
      e.stopPropagation()
      e.preventDefault()
      const el = e.currentTarget
      el.setPointerCapture(e.pointerId)
      const st0 = useEditor.getState()
      const zoom = st0.viewport.zoom
      const startX = e.clientX
      const startY = e.clientY
      const r0 = { x: n.x, y: n.y, w: n.w, h: n.h }
      const minSize = n.type === 'line' ? 2 : 8
      let pushed = false
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) / zoom
        const dy = (ev.clientY - startY) / zoom
        const s2 = useEditor.getState()
        if (!pushed) {
          s2.pushHistory()
          pushed = true
        }
        let { x, y, w, h } = r0
        if (dir.includes('e')) w = r0.w + dx
        if (dir.includes('s')) h = r0.h + dy
        if (dir.includes('w')) {
          x = r0.x + dx
          w = r0.w - dx
        }
        if (dir.includes('n')) {
          y = r0.y + dy
          h = r0.h - dy
        }
        if (w < minSize) {
          if (dir.includes('w')) x -= minSize - w
          w = minSize
        }
        if (h < minSize) {
          if (dir.includes('n')) y -= minSize - h
          h = minSize
        }
        if (s2.snapEnabled) {
          const g = s2.gridSize
          if (dir.includes('w')) {
            const nx = Math.round(x / g) * g
            w += x - nx
            x = nx
          } else {
            w = Math.max(minSize, Math.round(w / g) * g)
          }
          if (dir.includes('n')) {
            const ny = Math.round(y / g) * g
            h += y - ny
            y = ny
          } else {
            h = Math.max(minSize, Math.round(h / g) * g)
          }
        }
        s2.updateNodes(
          [n.id],
          (m) => {
            m.x = Math.round(x)
            m.y = Math.round(y)
            m.w = Math.round(w)
            m.h = Math.round(h)
          },
          true
        )
        setHint({ w: Math.round(w), h: Math.round(h) })
      }
      const up = () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerup', up)
        setHint(null)
      }
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerup', up)
    }
    return (
      <div className="overlay">
        <div className="sel-box" style={{ left, top, width: n.w * z, height: n.h * z }}>
          {HANDLES.map((h) => (
            <div
              key={h.dir}
              className="sel-handle"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, cursor: h.cursor }}
              onPointerDown={(e) => startResize(e, h.dir)}
            />
          ))}
        </div>
        {hint && (
          <div className="size-hint" style={{ left: left + (n.w * z) / 2, top: top - 24 }}>
            {hint.w} × {hint.h}
          </div>
        )}
      </div>
    )
  }

  // 多选：各自虚线框
  return (
    <div className="overlay">
      {sel.map((n) => (
        <div
          key={n.id}
          className="sel-box thin"
          style={{ left: sx(n.x), top: sy(n.y), width: n.w * z, height: n.h * z }}
        />
      ))}
    </div>
  )
}
