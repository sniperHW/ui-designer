import { useEffect } from 'react'
import type { MouseEvent as RMouseEvent } from 'react'
import { useEditor } from '../store/editorStore'
import { tipTailOf } from '../widgets/registry'
import type { CustomWidgetDef, WidgetNode } from '../types'
import PreviewNode from './PreviewNode'

/**
 * 轻提示弹出层：无遮罩、锚定触发控件的矩形就近浮层（上方优先，空间不够翻到下方）；
 * 内容用预览态节点渲染（与弹窗弹出层同套），整体 pointer-events 关闭——
 * 鼠标移入提示本体不算离开触发控件（浮层叠在其上时悬停保持），移开控件即关闭。
 * 画布编辑态（属性面板「▶ 演示轻提示」）与原型预览（悬停触发）共用。
 */
export default function TipLayer({
  defs,
  boardW,
  boardH,
  toDoc
}: {
  defs: CustomWidgetDef[]
  boardW: number
  boardH: number
  toDoc: (e: RMouseEvent) => { x: number; y: number }
}) {
  const doc = useEditor((s) => s.doc)
  const tip = useEditor((s) => s.tip)
  const shown = tip ? doc.tips.find((p) => p.id === tip.tipId) ?? null : null

  // 目标轻提示页被删后自动收起
  useEffect(() => {
    if (tip && !shown) useEditor.getState().closeTip()
  }, [tip, shown])

  if (!tip || !shown) return null

  // 本体（首个根级 tooltip）矩形决定气泡尺寸；显示在下方时上下翻转尾箭头（左右向保持设计值）
  const body = shown.nodes.find((n) => n.type === 'tooltip')
  const bx = body ? { x: body.x, y: body.y, w: body.w, h: body.h } : { x: 0, y: 0, w: 200, h: 100 }
  const GAP = 8
  const above = tip.y - GAP - bx.h >= 0
  const x = Math.max(4, Math.min(Math.round(tip.x + tip.w / 2 - bx.w / 2), boardW - bx.w - 4))
  const y = above ? Math.round(tip.y - GAP - bx.h) : Math.round(tip.y + tip.h + GAP)
  const nodes: WidgetNode[] = shown.nodes.map((n) => {
    if (n.type !== 'tooltip') return n
    const t = tipTailOf(n)
    const flip = t === 'bottom' && !above ? 'top' : t === 'top' && above ? 'bottom' : t
    return flip === t ? n : { ...n, props: { ...n.props, tail: flip } }
  })

  return (
    <g
      transform={`translate(${x - bx.x} ${y - bx.y})`}
      style={{ pointerEvents: 'none', filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.35))' }}
    >
      {nodes
        .filter((n) => n.visible)
        .map((n) => (
          <PreviewNode key={n.id} n={n} defs={defs} toDoc={toDoc} />
        ))}
    </g>
  )
}
