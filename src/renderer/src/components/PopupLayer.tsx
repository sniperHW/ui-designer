import { useEffect } from 'react'
import type { MouseEvent as RMouseEvent, PointerEvent as RPointerEvent } from 'react'
import { useEditor } from '../store/editorStore'
import { DIALOG_TITLE_H } from '../widgets/registry'
import { walkNodes } from '../widgets/tree'
import type { CustomWidgetDef, WidgetNode } from '../types'
import type { Rect } from '../widgets/registry'
import PreviewNode from './PreviewNode'

/** 弹窗页内每个 dialog 的 ✕ 关闭热区（与 registry 绘制的 ✕ 几何对齐，标题栏中央） */
export function dialogCloseRects(nodes: WidgetNode[]): Rect[] {
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

/**
 * 点击效果演示的弹出层：遮罩压暗整页 + 弹窗页内容置顶浮层；
 * 内容用预览态节点渲染——弹窗里的可点击控件同样可触发效果，滚动区随预览滚动。
 * 点 ✕ / 遮罩 / Esc 关闭。画布编辑态（右键「点击」演示）与原型预览共用。
 */
export default function PopupLayer({
  defs,
  boardW,
  boardH,
  toDoc,
  wheel = false,
  scale = 1
}: {
  defs: CustomWidgetDef[]
  boardW: number
  boardH: number
  toDoc: (e: RMouseEvent) => { x: number; y: number }
  wheel?: boolean
  scale?: number
}) {
  const doc = useEditor((s) => s.doc)
  const popupId = useEditor((s) => s.popupId)
  const popupShown = popupId ? doc.popups.find((p) => p.id === popupId) ?? null : null

  // 目标弹窗页被删后自动收起
  useEffect(() => {
    if (popupId && !popupShown) useEditor.getState().closePopup()
  }, [popupId, popupShown])

  if (!popupShown) return null
  const close = (e: RPointerEvent): void => {
    e.stopPropagation()
    useEditor.getState().closePopup()
  }
  return (
    <g>
      <rect
        className="popup-backdrop"
        x={0}
        y={0}
        width={boardW}
        height={boardH}
        fill="rgba(17,24,39,0.42)"
        style={{ cursor: 'pointer' }}
        onPointerDown={close}
      />
      <g style={{ filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.5))' }} onPointerDown={(e) => e.stopPropagation()}>
        {popupShown.nodes
          .filter((n) => n.visible)
          .map((n) => (
            <PreviewNode key={n.id} n={n} defs={defs} toDoc={toDoc} wheel={wheel} scale={scale} />
          ))}
      </g>
      {dialogCloseRects(popupShown.nodes).map((r, i) => (
        <rect
          key={'popupx' + i}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onPointerDown={close}
        />
      ))}
    </g>
  )
}
