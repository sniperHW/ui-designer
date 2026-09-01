import { useEffect, useRef } from 'react'
import type { DragEvent, PointerEvent as RPointerEvent, MouseEvent as RMouseEvent, ReactNode } from 'react'
import { useEditor } from '../store/editorStore'
import {
  contentRectOf,
  previewDims,
  renderCustomInstance,
  renderKidsOf,
  renderTreeSVG,
  tabBarRect,
  transformTree,
  widgetInnerSVG
} from '../widgets/registry'
import type { CustomWidgetDef } from '../types'
import type { Rect, SlotInfo, WidgetDef } from '../widgets/registry'
import { canvasEl } from '../canvasRef'
import type { WidgetNode } from '../types'
import { DIALOG_TITLE_H } from '../widgets/registry'
import { findNodeInDoc, isClickable, walkNodes } from '../widgets/tree'
import SelectionOverlay from './SelectionOverlay'

export default function Canvas() {
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const editingPopupId = useEditor((s) => s.editingPopupId)
  const viewport = useEditor((s) => s.viewport)
  const showGrid = useEditor((s) => s.showGrid)
  const gridSize = useEditor((s) => s.gridSize)
  const fitToken = useEditor((s) => s.fitToken)
  const previewRatio = useEditor((s) => s.previewRatio)
  const showSafeArea = useEditor((s) => s.showSafeArea)
  const wrapRef = useRef<HTMLDivElement>(null)
  const isCommon = pageIndex < 0 && !editingWidgetId && !editingPopupId
  const inPreview = previewRatio !== 'design' && !editingWidgetId && !editingPopupId
  const { designWidth: dw, designHeight: dh } = doc.meta
  const pd = previewDims(doc.meta, previewRatio)
  const boardW = inPreview ? pd.w : dw
  const boardH = inPreview ? pd.h : dh

  const editingDef = editingWidgetId
    ? doc.customWidgets.find((w) => w.id === editingWidgetId) ?? null
    : null
  // 弹窗页：独立设计的弹窗内容（§8），编辑时画布只显示弹窗页节点
  const editingPopup = !editingDef && editingPopupId
    ? doc.popups.find((p) => p.id === editingPopupId) ?? null
    : null
  const page = isCommon ? doc.commonLayer : doc.pages[Math.min(pageIndex, doc.pages.length - 1)]
  const design = { x: 0, y: 0, w: dw, h: dh }
  const target = { x: 0, y: 0, w: boardW, h: boardH }
  // 预览模式：按锚点规则把设计尺寸布局重排到目标分辨率（只读）
  const pageNodes = editingDef
    ? editingDef.tree
    : editingPopup
      ? editingPopup.nodes
      : inPreview
        ? transformTree(page.nodes, design, target)
        : page.nodes
  const commonNodes =
    !isCommon && !editingDef && !editingPopup
      ? inPreview
        ? transformTree(doc.commonLayer.nodes, design, target)
        : doc.commonLayer.nodes
      : []
  const commonVisible = commonNodes.filter((n) => n.visible)
  const interactive = !inPreview

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
      const subs: WidgetNode[][] = [
        ...(m.pages ?? []),
        ...(m.children ? [m.children] : []),
        ...(m.slots ? Object.values(m.slots) : [])
      ]
      for (const p of subs) for (const c of p) addTree(c)
    }
    const collect = (arr: WidgetNode[]): void => {
      for (const m of arr) {
        if (selSet.has(m.id)) addTree(m)
        else {
          const subs: WidgetNode[][] = [
            ...(m.pages ?? []),
            ...(m.children ? [m.children] : []),
            ...(m.slots ? Object.values(m.slots) : [])
          ]
          for (const p of subs) collect(p)
        }
      }
    }
    collect(st.editRoot())
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

  // 控件右键：选中（若未选中）→ 弹出上下文菜单（删除 / 点击）
  const nodeCtx = (e: RMouseEvent<SVGGElement>, n: WidgetNode) => {
    e.preventDefault()
    e.stopPropagation()
    if (!interactive) return
    const st = useEditor.getState()
    if (!st.selectedIds.includes(n.id)) st.setSelection([n.id])
    st.openCtxMenu(e.clientX, e.clientY)
  }

  // 画布空白右键：屏蔽默认菜单并关闭自定义菜单
  const bgCtx = (e: RMouseEvent<SVGSVGElement>) => {
    e.preventDefault()
    useEditor.getState().closeCtxMenu()
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const json = e.dataTransfer.getData('application/x-widget-def')
    const customId = e.dataTransfer.getData('application/x-widget-custom')
    if (!json && !customId) return
    try {
      const pt = toDoc(e.clientX, e.clientY)
      const st = useEditor.getState()
      if (customId) {
        st.addWidgetCustom(customId, pt.x, pt.y)
      } else {
        const def = JSON.parse(json) as WidgetDef
        st.addWidget(def, pt.x, pt.y)
      }
    } catch {
      /* 忽略无效拖拽数据 */
    }
  }

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const pt = toDoc(e.clientX, e.clientY)
    useEditor.getState().setMouse(pt.x, pt.y)
  }

  // 弹窗演示：目标弹窗页被删后自动收起
  const popupId = useEditor((s) => s.popupId)
  const popupShown = popupId ? doc.popups.find((p) => p.id === popupId) ?? null : null
  useEffect(() => {
    if (popupId && !popupShown) useEditor.getState().closePopup()
  }, [popupId, popupShown])

  const hasNodes = pageNodes.length > 0 || commonVisible.length > 0

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onPointerMove={onPointerMove}
    >
      <svg className="canvas-svg" onPointerDown={bgDown} onContextMenu={bgCtx}>
        <defs>
          <pattern id="gridpat" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#d8d8de" strokeWidth="1" />
          </pattern>
        </defs>
        <g transform={`translate(${viewport.panX},${viewport.panY}) scale(${viewport.zoom})`}>
          <rect
            x={0}
            y={0}
            width={boardW}
            height={boardH}
            fill="#ffffff"
            style={{ filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.35))' }}
          />
          {showGrid && !inPreview && <rect x={0} y={0} width={boardW} height={boardH} fill="url(#gridpat)" />}
          <rect
            x={0}
            y={0}
            width={boardW}
            height={boardH}
            fill="none"
            stroke="#9aa0ab"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          {/* 公共层：普通页面中只读显示（渲染在页面内容之下）；预览模式下按锚点重排 */}
          {!isCommon &&
            !editingDef &&
            commonVisible.map((n) => (
              <g
                key={'common-' + n.id}
                className="common-layer"
                style={{ pointerEvents: 'none' }}
                dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }}
              />
            ))}
          {pageNodes
            .filter((n) => n.visible)
            .map((n) => (
              <NodeGroup key={n.id} n={n} nodeDown={nodeDown} nodeCtx={nodeCtx} defs={doc.customWidgets} interactive={interactive} />
            ))}
          {/* 点击效果演示：弹出独立弹窗页——遮罩压暗整页、弹窗内容浮于其上；点 ✕ / 遮罩 / Esc 关闭 */}
          {popupShown && (
            <g>
              <rect
                className="popup-backdrop"
                x={0}
                y={0}
                width={boardW}
                height={boardH}
                fill="rgba(17,24,39,0.42)"
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  useEditor.getState().closePopup()
                }}
              />
              <g style={{ filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.5))' }}>
                {popupShown.nodes
                  .filter((n) => n.visible)
                  .map((n) => (
                    <g key={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }} />
                  ))}
              </g>
              {/* 弹窗标题栏 ✕ 的关闭热区（与 registry 绘制的 ✕ 几何对齐） */}
              {dialogCloseRects(popupShown.nodes).map((r, i) => (
                <rect
                  key={'popupx' + i}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    useEditor.getState().closePopup()
                  }}
                />
              ))}
            </g>
          )}
          {/* 安全区参考框（§6）：刘海屏参考，虚线示意 */}
          {showSafeArea && !editingDef && (
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={Math.round(boardW * 0.03)}
                y={Math.round(boardH * 0.04)}
                width={Math.round(boardW * 0.94)}
                height={Math.round(boardH * 0.92)}
                fill="none"
                stroke="#e05555"
                strokeWidth="1.5"
                strokeDasharray="10 6"
                vectorEffect="non-scaling-stroke"
              />
              <text x={Math.round(boardW * 0.03) + 6} y={Math.round(boardH * 0.04) + 18} fill="#e05555" fontSize="18">
                安全区参考
              </text>
            </g>
          )}
        </g>
      </svg>
      {!hasNodes && !editingDef && <div className="canvas-empty">从左侧控件库拖入控件开始设计</div>}
      {editingDef && (
        <div className="common-badge">🧩 正在编辑定制控件「{editingDef.name}」— 修改保存后所有实例同步更新</div>
      )}
      {inPreview && (
        <div className="preview-badge">
          分辨率预览 {boardW} × {boardH}（只读，按锚点重排）
        </div>
      )}
      {popupShown && (
        <div className="popup-badge">
          👆 点击效果演示：弹窗「{popupShown.name}」 — 点 ✕ / 遮罩或按 Esc 关闭
        </div>
      )}
      {(isCommon || editingPopup) && (
        <div className="common-badge">
          {isCommon ? '● 正在编辑公共层 — 修改对所有页面生效' : `▣ 正在编辑弹窗「${editingPopup!.name}」— 由点击效果触发时遮罩弹出显示`}
        </div>
      )}
      {!inPreview && <SelectionOverlay />}
      <CanvasCtxMenu />
    </div>
  )
}

/** 控件右键菜单：删除（任意选中）+ 点击（仅可点击控件，触发点击效果） */
function CanvasCtxMenu() {
  const ctxMenu = useEditor((s) => s.ctxMenu)
  const selectedIds = useEditor((s) => s.selectedIds)
  const doc = useEditor((s) => s.doc)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const editingPopupId = useEditor((s) => s.editingPopupId)
  const prevPageId = useEditor((s) => s.prevPageId)

  // 点击菜单外任意位置收起
  useEffect(() => {
    if (!ctxMenu) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      if (!(t && t.closest('.ctx-menu'))) useEditor.getState().closeCtxMenu()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [ctxMenu])

  if (!ctxMenu) return null
  const single = selectedIds.length === 1 ? findNodeInDoc(doc, selectedIds[0]) : null
  const clickable = single && !editingWidgetId && !editingPopupId && isClickable(single) ? single : null
  const act = clickable?.clickAction
  const backTarget = prevPageId ? doc.pages.find((p) => p.id === prevPageId) : undefined
  // 目标是否有效（决定点击项可否触发）：未配置 / 目标被删 / 返回无来路 → 禁用
  const actOk = !act
    ? false
    : act.type === 'goto'
      ? doc.pages.some((p) => p.id === act.target)
      : act.type === 'back'
        ? !!backTarget
        : doc.popups.some((p) => p.id === act.target)
  const actLabel = !act
    ? '未配置效果'
    : act.type === 'goto'
      ? `跳转「${doc.pages.find((p) => p.id === act.target)?.name ?? '页面已删'}」`
      : act.type === 'back'
        ? backTarget
          ? `返回「${backTarget.name}」`
          : '返回上一页（无来路）'
        : `弹出「${doc.popups.find((p) => p.id === act.target)?.name ?? '弹窗已删'}」`
  const x = Math.min(ctxMenu.x, window.innerWidth - 224)
  const y = Math.min(ctxMenu.y, window.innerHeight - 96)

  return (
    <div className="ctx-menu" style={{ left: x, top: y }}>
      <div
        className="ctx-item"
        onClick={() => {
          useEditor.getState().deleteSelected()
          useEditor.getState().closeCtxMenu()
        }}
      >
        <span>删除{selectedIds.length > 1 ? `（${selectedIds.length} 个控件）` : ''}</span>
        <span className="accel">⌫</span>
      </div>
      {clickable && (
        <div
          className={'ctx-item' + (actOk ? '' : ' disabled')}
          title={
            actOk
              ? '触发该控件的点击效果'
              : act?.type === 'back'
                ? '当前页面不是从别的页面切换过来的，返回没有效果'
                : '尚未配置点击效果——去右侧属性面板「点击」区设置'
          }
          onClick={() => {
            if (!actOk) return
            useEditor.getState().triggerClick(clickable.id)
          }}
        >
          <span>点击 · {actLabel}</span>
        </div>
      )}
    </div>
  )
}

/** 递归渲染控件：外形 + 容器当前内容（裁剪到内容区）+ 定制控件插槽内容 */
function NodeGroup({
  n,
  nodeDown,
  nodeCtx,
  defs,
  interactive
}: {
  n: WidgetNode
  nodeDown: (e: RPointerEvent<SVGGElement>, n: WidgetNode) => void
  nodeCtx: (e: RMouseEvent<SVGGElement>, n: WidgetNode) => void
  defs: CustomWidgetDef[]
  interactive: boolean
}) {
  const down = interactive ? (e: RPointerEvent<SVGGElement>) => nodeDown(e, n) : undefined
  const ctx = interactive ? (e: RMouseEvent<SVGGElement>) => nodeCtx(e, n) : undefined

  // 定制控件实例：内部结构只读渲染；插槽内容是实例子控件，可交互
  if (n.type === 'custom') {
    const def = defs.find((d) => d.id === n.customId)
    if (!def) {
      return (
        <g data-id={n.id} onPointerDown={down} onContextMenu={ctx} style={{ cursor: interactive && !n.locked ? 'move' : 'default' }}>
          <g dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, defs) }} />
        </g>
      )
    }
    const r = renderCustomInstance(n, def, defs)
    return (
      <g
        data-id={n.id}
        onPointerDown={down}
        onContextMenu={ctx}
        style={{ cursor: interactive && !n.locked ? 'move' : 'default' }}
      >
        <g dangerouslySetInnerHTML={{ __html: r.inner }} />
        {r.slots.map((sl: SlotInfo) => {
          const kids = sl.children.filter((c) => c.visible)
          if (!kids.length) return null
          return (
            <ClippedGroup key={sl.key} clipId={`clip-${n.id}-${sl.key}`} rect={sl.rect}>
              {kids.map((c) => (
                <NodeGroup key={c.id} n={c} nodeDown={nodeDown} nodeCtx={nodeCtx} defs={defs} interactive={interactive} />
              ))}
            </ClippedGroup>
          )
        })}
      </g>
    )
  }

  // 容器：当前内容区子控件（Tab = 当前页签；面板 / 弹窗 / 滚动区 = children）
  const kids = renderKidsOf(n)
  const rect = contentRectOf(n)
  let children: ReactNode = null
  if (kids && kids.length && rect) {
    const visible = kids.filter((c) => c.visible)
    if (visible.length > 0) {
      children = (
        <ClippedGroup clipId={`clip-${n.id}`} rect={rect}>
          {visible.map((c) => (
            <NodeGroup key={c.id} n={c} nodeDown={nodeDown} nodeCtx={nodeCtx} defs={defs} interactive={interactive} />
          ))}
        </ClippedGroup>
      )
    }
  }
  return (
    <g
      data-id={n.id}
      onPointerDown={down}
      onContextMenu={ctx}
      style={{ cursor: n.locked || !interactive ? 'default' : 'move' }}
    >
      <g dangerouslySetInnerHTML={{ __html: widgetInnerSVG(n) }} />
      {children}
    </g>
  )
}

function ClippedGroup({ clipId, rect, children }: { clipId: string; rect: Rect; children: ReactNode }) {
  return (
    <g clipPath={`url(#${clipId})`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} />
        </clipPath>
      </defs>
      {children}
    </g>
  )
}

/** 弹窗页内每个 dialog 的 ✕ 关闭热区（与 registry 绘制的 ✕ 几何对齐，标题栏中央） */
function dialogCloseRects(nodes: WidgetNode[]): Rect[] {
  const out: Rect[] = []
  walkNodes(nodes, (n) => {
    if (n.type === 'dialog') {
      const t = Math.min(DIALOG_TITLE_H, n.h / 2)
      const cx = n.x + n.w - t / 2 - 8
      const cy = n.y + t / 2
      out.push({ x: cx - 14, y: cy - 14, w: 28, h: 28 })
    }
  })
  return out
}
