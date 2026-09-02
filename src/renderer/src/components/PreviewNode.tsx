import { useState } from 'react'
import type { MouseEvent as RMouseEvent, ReactNode, WheelEvent as RWheelEvent } from 'react'
import { useEditor } from '../store/editorStore'
import {
  activeTabIndex,
  contentRectOf,
  pickPathInTree,
  renderCustomInstance,
  renderKidsOf,
  renderTreeSVG,
  scrollTrackSVG,
  tabBarRect,
  widgetInnerSVG
} from '../widgets/registry'
import type { Rect, SlotInfo } from '../widgets/registry'
import { bboxOf, isClickable } from '../widgets/tree'
import type { CustomWidgetDef, WidgetNode } from '../types'

/** 预览会话内滚动区的竖向偏移（nodeId → 像素），进入预览时清空，切页回来位置保留 */
export const previewScrollOffsets = new Map<string, number>()

/**
 * 预览态节点（§8 / §10）：外形 + 容器子树（裁剪）+ 定制实例插槽；
 * 可点击控件点击触发效果，Tab 点页签头就地切换，滚动区滚轮滚动。
 * 原型预览与画布编辑态的点击效果演示（PopupLayer）共用。
 */
export default function PreviewNode({
  n,
  defs,
  toDoc,
  wheel = false,
  scale = 1,
  scrollDy = 0
}: {
  n: WidgetNode
  defs: CustomWidgetDef[]
  toDoc: (e: RMouseEvent) => { x: number; y: number }
  /** 启用滚轮滚动（原型预览开；画布演示关——画布滚轮已被平移/缩放占用） */
  wheel?: boolean
  /** 屏幕像素 → 文档坐标比例（滚轮步长换算） */
  scale?: number
  /** 祖先滚动区的累计位移（≤0）：几何命中换算前把预览点还原到未滚动坐标系 */
  scrollDy?: number
}) {
  const clickable = isClickable(n)
  const onClick = (e: RMouseEvent<SVGGElement>) => {
    e.stopPropagation()
    const st = useEditor.getState()
    // Tab：点击页签栏就地切换内容页（§4.1 内容型）；导航型 goto 由页签内容里的可点击控件承担
    if (n.type === 'tab' && n.pages) {
      const pt = toDoc(e)
      const py = pt.y - scrollDy
      const bar = tabBarRect(n)
      if (pt.x >= bar.x && pt.x <= bar.x + bar.w && py >= bar.y && py <= bar.y + bar.h) {
        const count = Math.max(1, n.props.tabs?.length ?? 1)
        const idx = Math.max(0, Math.min(count - 1, Math.floor((pt.x - n.x) / (n.w / count))))
        if (idx !== activeTabIndex(n)) {
          st.updateNodes(
            [n.id],
            (m) => {
              m.activeTab = idx
            },
            true
          )
        }
        return
      }
    }
    if (clickable) st.triggerClick(n.id)
  }
  const cursor = clickable || n.type === 'tab' ? 'pointer' : 'default'

  // 定制控件实例：内部结构只读渲染（可点击控件按命中区域触发），插槽内容可交互
  if (n.type === 'custom') {
    const [hot, setHot] = useState(false)
    const def = defs.find((d) => d.id === n.customId)
    if (!def) {
      return <g data-id={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, defs) }} />
    }
    const r = renderCustomInstance(n, def, defs)
    // 命中拾取：坐标换算到定义局部系（滚动区内的实例先还原滚动位移）；
    // 可点击标记统一配在定义内（含嵌套定制控件），实例自身不再有可点击标记
    const pickAt = (e: RMouseEvent<SVGGElement>): WidgetNode[] => {
      const pt = toDoc(e)
      return (
        pickPathInTree(
          def.tree,
          ((pt.x - n.x) * def.w) / n.w,
          ((pt.y - scrollDy - n.y) * def.h) / n.h,
          defs
        ) ?? []
      )
    }
    // 点击：沿「命中节点 → 祖先」链找第一个可点击控件触发；
    // 悬停：命中区域（会真正触发的点击位置）才显示手指，而不是整个实例常亮
    const onInstClick = (e: RMouseEvent<SVGGElement>) => {
      e.stopPropagation()
      const path = pickAt(e)
      for (let i = path.length - 1; i >= 0; i--) {
        if (isClickable(path[i])) {
          useEditor.getState().triggerClick(path[i].id)
          return
        }
      }
    }
    return (
      <g
        data-id={n.id}
        style={{ cursor: hot ? 'pointer' : 'default' }}
        onClick={onInstClick}
        onMouseMove={(e) => setHot(pickAt(e).length > 0)}
        onMouseLeave={() => setHot(false)}
      >
        <g dangerouslySetInnerHTML={{ __html: r.inner }} />
        {r.slots.map((sl: SlotInfo) => {
          const kids = sl.children.filter((c) => c.visible)
          if (!kids.length) return null
          return (
            <ClippedGroup key={sl.key} clipId={`pclip-${n.id}-${sl.key}`} rect={sl.rect}>
              {kids.map((c) => (
                <PreviewNode key={c.id} n={c} defs={defs} toDoc={toDoc} wheel={wheel} scale={scale} scrollDy={scrollDy} />
              ))}
            </ClippedGroup>
          )
        })}
      </g>
    )
  }

  // 滚动区（§10）：内容超出可视高时滚轮滚动，滑块随内容移动；到边界后放行给外层滚动区（滚动链）
  if (n.type === 'scroll') {
    const kids = (renderKidsOf(n) ?? []).filter((c) => c.visible)
    const bbox = kids.length ? bboxOf(kids) : null
    const maxScroll = bbox ? Math.max(0, Math.round(bbox.y + bbox.h - (n.y + n.h))) : 0
    const [offset, setOffset] = useState(() => previewScrollOffsets.get(n.id) ?? 0)
    const onWheel = (e: RWheelEvent<SVGGElement>) => {
      if (!wheel || maxScroll <= 0) return
      const next = Math.max(-maxScroll, Math.min(0, Math.round(offset - e.deltaY * scale)))
      if (next === offset) return
      e.stopPropagation()
      previewScrollOffsets.set(n.id, next)
      setOffset(next)
    }
    const sw = Math.min(14, n.w / 6)
    const trackY = n.y + 4
    const trackH = n.h - 8
    const contentH = bbox ? Math.max(n.h, bbox.y + bbox.h - n.y) : n.h
    const thumbH = Math.max(12, Math.min(trackH, Math.round((trackH * n.h) / contentH)))
    const thumbY = trackY + Math.round((maxScroll > 0 ? -offset / maxScroll : 0) * (trackH - thumbH))
    return (
      <g data-id={n.id} style={{ cursor }} onClick={onClick} onWheel={onWheel}>
        <g dangerouslySetInnerHTML={{ __html: scrollTrackSVG(n.x, n.y, n.w, n.h) }} />
        {kids.length > 0 && (
          <ClippedGroup clipId={`pclip-${n.id}`} rect={{ x: n.x, y: n.y, w: n.w, h: n.h }}>
            <g transform={`translate(0 ${offset})`}>
              {kids.map((c) => (
                <PreviewNode key={c.id} n={c} defs={defs} toDoc={toDoc} wheel={wheel} scale={scale} scrollDy={scrollDy + offset} />
              ))}
            </g>
          </ClippedGroup>
        )}
        {maxScroll > 0 && (
          <rect
            x={n.x + n.w - sw + 1}
            y={thumbY}
            width={sw - 5}
            height={thumbH}
            fill="#9aa0ab"
            style={{ pointerEvents: 'none' }}
          />
        )}
      </g>
    )
  }

  const kids = renderKidsOf(n)
  const rect = contentRectOf(n)
  let children: ReactNode = null
  if (kids && kids.length && rect) {
    const visible = kids.filter((c) => c.visible)
    if (visible.length > 0) {
      children = (
        <ClippedGroup clipId={`pclip-${n.id}`} rect={rect}>
          {visible.map((c) => (
            <PreviewNode key={c.id} n={c} defs={defs} toDoc={toDoc} wheel={wheel} scale={scale} scrollDy={scrollDy} />
          ))}
        </ClippedGroup>
      )
    }
  }
  return (
    <g data-id={n.id} style={{ cursor }} onClick={onClick}>
      <g dangerouslySetInnerHTML={{ __html: widgetInnerSVG(n) }} />
      {children}
    </g>
  )
}

export function ClippedGroup({ clipId, rect, children }: { clipId: string; rect: Rect; children: ReactNode }) {
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
