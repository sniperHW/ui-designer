import { useEffect, useRef } from 'react'
import type { DragEvent, PointerEvent as RPointerEvent, ReactNode } from 'react'
import { useEditor } from '../store/editorStore'
import { widgetInnerSVG, tabBarRect, renderTreeSVG } from '../widgets/registry'
import type { WidgetDef } from '../widgets/registry'
import { canvasEl } from '../canvasRef'
import type { WidgetNode } from '../types'
import SelectionOverlay from './SelectionOverlay'

export default function Canvas() {
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const viewport = useEditor((s) => s.viewport)
  const showGrid = useEditor((s) => s.showGrid)
  const gridSize = useEditor((s) => s.gridSize)
  const fitToken = useEditor((s) => s.fitToken)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isCommon = pageIndex < 0
  const page = isCommon
    ? doc.commonLayer
    : doc.pages[Math.min(pageIndex, doc.pages.length - 1)]
  const { designWidth: dw, designHeight: dh } = doc.meta
  const commonVisible = isCommon ? [] : doc.commonLayer.nodes.filter((n) => n.visible)

  useEffect(() => {
    canvasEl.current = wrapRef.current
    return () => {
      if (canvasEl.current === wrapRef.current) canvasEl.current = null
    }
  }, [])

  useEffect(() => {
    useEditor.getState().fitView()
  }, [fitToken, dw, dh])

  // 滚轮：Ctrl/⌘ 缩放（以指针为中心），否则平移
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useEditor.getState()
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        st.zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015))
      } else {
        st.panBy(-e.deltaX, -e.deltaY)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const toDoc = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = wrapRef.current!.getBoundingClientRect()
    const v = useEditor.getState().viewport
    return {
      x: (clientX - rect.left - v.panX) / v.zoom,
      y: (clientY - rect.top - v.panY) / v.zoom
    }
  }

  // 空白处按下：拖动 = 平移画布；点击 = 取消选择
  const bgDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    e.preventDefault()
    const svg = e.currentTarget
    svg.setPointerCapture(e.pointerId)
    let last = { x: e.clientX, y: e.clientY }
    let moved = false
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - last.x
      const dy = ev.clientY - last.y
      if (dx !== 0 || dy !== 0) {
        moved = true
        useEditor.getState().panBy(dx, dy)
        last = { x: ev.clientX, y: ev.clientY }
      }
    }
    const up = () => {
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
      if (!moved) useEditor.getState().setSelection([])
    }
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
  }

  // 控件按下：Tab 页签头 = 切换页签；否则选择 + 拖动移动（子控件跟随容器）
  const nodeDown = (e: RPointerEvent<SVGGElement>, n: WidgetNode) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const st = useEditor.getState()

    // Tab：点击页签栏切换当前编辑页签
    if (n.type === 'tab' && n.pages) {
      const pt = toDoc(e.clientX, e.clientY)
      const bar = tabBarRect(n)
      if (pt.x >= bar.x && pt.x <= bar.x + bar.w && pt.y >= bar.y && pt.y <= bar.y + bar.h) {
        const count = Math.max(1, n.props.tabs?.length ?? 1)
        const idx = Math.max(0, Math.min(count - 1, Math.floor((pt.x - n.x) / (n.w / count))))
        if (idx !== (n.activeTab ?? 0)) {
          st.updateNodes(
            [n.id],
            (m) => {
              m.activeTab = idx
            },
            true
          )
        }
        st.setSelection([n.id])
        return
      }
    }

    let ids = st.selectedIds
    if (e.shiftKey) {
      ids = ids.includes(n.id) ? ids.filter((i) => i !== n.id) : [...ids, n.id]
      st.setSelection(ids)
      if (!ids.includes(n.id)) return
    } else if (!ids.includes(n.id)) {
      ids = [n.id]
      st.setSelection(ids)
    }
    if (n.locked) return
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const start = { x: e.clientX, y: e.clientY }
    const z0 = st.viewport.zoom
    // 选中项 + 容器的全部子孙一起进快照（移动容器时子控件跟随）
    const selSet = new Set(ids)
    const snapshot = new Map<string, { x: number; y: number }>()
    const addTree = (m: WidgetNode): void => {
      snapshot.set(m.id, { x: m.x, y: m.y })
      if (m.pages) for (const p of m.pages) for (const c of p) addTree(c)
    }
    const collect = (arr: WidgetNode[]): void => {
      for (const m of arr) {
        if (selSet.has(m.id)) addTree(m)
        else if (m.pages) for (const p of m.pages) collect(p)
      }
    }
    collect(st.currentPage().nodes)
    const moveIds = [...snapshot.keys()]
    const primary = snapshot.get(n.id) ?? { x: n.x, y: n.y }
    let pushed = false
    let moved = false
    const move = (ev: PointerEvent) => {
      let dx = (ev.clientX - start.x) / z0
      let dy = (ev.clientY - start.y) / z0
      if (!moved && Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      moved = true
      const s2 = useEditor.getState()
      if (!pushed) {
        s2.pushHistory()
        pushed = true
      }
      if (s2.snapEnabled) {
        const g = s2.gridSize
        const tx = Math.round((primary.x + dx) / g) * g
        const ty = Math.round((primary.y + dy) / g) * g
        dx += tx - (primary.x + dx)
        dy += ty - (primary.y + dy)
      }
      s2.updateNodes(
        moveIds,
        (m) => {
          const s0 = snapshot.get(m.id)!
          m.x = Math.round(s0.x + dx)
          m.y = Math.round(s0.y + dy)
        },
        true
      )
    }
    const up = () => {
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const json = e.dataTransfer.getData('application/x-widget-def')
    if (!json) return
    try {
      const def = JSON.parse(json) as WidgetDef
      const pt = toDoc(e.clientX, e.clientY)
      useEditor.getState().addWidget(def, pt.x, pt.y)
    } catch {
      /* 忽略无效拖拽数据 */
    }
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const pt = toDoc(e.clientX, e.clientY)
    useEditor.getState().setMouse(pt.x, pt.y)
  }

  const hasNodes = page.nodes.length > 0 || commonVisible.length > 0

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onPointerMove={onPointerMove}
    >
      <svg className="canvas-svg" onPointerDown={bgDown}>
        <defs>
          <pattern id="gridpat" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#d8d8de" strokeWidth="1" />
          </pattern>
        </defs>
        <g transform={`translate(${viewport.panX},${viewport.panY}) scale(${viewport.zoom})`}>
          <rect
            x={0}
            y={0}
            width={dw}
            height={dh}
            fill="#ffffff"
            style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.35))' }}
          />
          {showGrid && <rect x={0} y={0} width={dw} height={dh} fill="url(#gridpat)" />}
          <rect
            x={0}
            y={0}
            width={dw}
            height={dh}
            fill="none"
            stroke="#9aa0ab"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {/* 公共层：普通页面中只读显示（渲染在页面内容之下） */}
          {!isCommon &&
            commonVisible.map((n) => (
              <g
                key={'common-' + n.id}
                className="common-layer"
                style={{ pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: renderTreeSVG(n) }}
              />
            ))}
          {page.nodes
            .filter((n) => n.visible)
            .map((n) => (
              <NodeGroup key={n.id} n={n} nodeDown={nodeDown} />
            ))}
        </g>
      </svg>
      {!hasNodes && <div className="canvas-empty">从左侧控件库拖入控件开始设计</div>}
      {isCommon && (
        <div className="common-badge">● 正在编辑公共层 — 修改对所有页面生效</div>
      )}
      <SelectionOverlay />
    </div>
  )
}

/** 递归渲染控件：外形 + Tab 当前页签的子控件（裁剪到内容区） */
function NodeGroup({
  n,
  nodeDown
}: {
  n: WidgetNode
  nodeDown: (e: RPointerEvent<SVGGElement>, n: WidgetNode) => void
}) {
  let children: ReactNode = null
  if (n.type === 'tab' && n.pages && n.pages.length) {
    const active = Math.max(0, Math.min((n.props.tabs?.length ?? 1) - 1, n.activeTab ?? 0))
    const barH = Math.min(40, n.h / 2)
    const bottom = (n.props.barPosition ?? 'top') === 'bottom'
    const cy0 = bottom ? n.y : n.y + barH
    const ch = Math.max(0, n.h - barH)
    const clipId = `clip-${n.id}`
    const visible = (n.pages[active] ?? []).filter((c) => c.visible)
    if (visible.length > 0) {
      children = (
        <g clipPath={`url(#${clipId})`}>
          <defs>
            <clipPath id={clipId}>
              <rect x={n.x} y={cy0} width={n.w} height={ch} />
            </clipPath>
          </defs>
          {visible.map((c) => (
            <NodeGroup key={c.id} n={c} nodeDown={nodeDown} />
          ))}
        </g>
      )
    }
  }
  return (
    <g
      data-id={n.id}
      onPointerDown={(e) => nodeDown(e, n)}
      style={{ cursor: n.locked ? 'default' : 'move' }}
    >
      <g dangerouslySetInnerHTML={{ __html: widgetInnerSVG(n) }} />
      {children}
    </g>
  )
}
