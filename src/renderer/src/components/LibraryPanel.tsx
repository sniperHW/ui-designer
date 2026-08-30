import { useState } from 'react'
import type { DragEvent } from 'react'
import { WIDGET_DEFS, CATEGORY_LABEL, libIcon, renderTreeSVG } from '../widgets/registry'
import type { Category, WidgetDef } from '../widgets/registry'
import { useEditor } from '../store/editorStore'
import { canvasEl } from '../canvasRef'
import type { CustomWidgetDef, WidgetNode } from '../types'

const CATEGORIES: Category[] = ['shape', 'text', 'control', 'container']

/** 定制控件库小图标：按定义树渲染（缩放到图标框） */
function customLibIcon(def: CustomWidgetDef): string {
  if (!def.tree.length) {
    return `<svg viewBox="0 0 44 30" width="38" height="26"><rect x="2" y="2" width="40" height="26" fill="#fff" stroke="#9aa0ab" stroke-width="1.5" stroke-dasharray="4 3"/><text x="22" y="15" fill="#9ca3af" font-size="10" text-anchor="middle" dominant-baseline="central">空</text></svg>`
  }
  const pad = 6
  const iconW = 72
  const s = iconW / def.w
  const iconH = Math.max(8, Math.round(def.h * s))
  const scaled = def.tree.map((n) => shiftScale(n, s))
  return `<svg viewBox="${-pad} ${-pad} ${iconW + pad * 2} ${iconH + pad * 2}" width="38" height="26" preserveAspectRatio="xMidYMid meet">${scaled
    .map((n) => renderTreeSVG(n))
    .join('')}</svg>`
}

function shiftScale(n: WidgetNode, s: number): WidgetNode {
  const c: WidgetNode = {
    ...n,
    x: n.x * s,
    y: n.y * s,
    w: Math.max(1, n.w * s),
    h: Math.max(1, n.h * s),
    props: n.props.fontSize ? { ...n.props, fontSize: Math.max(6, Math.round(n.props.fontSize * s)) } : { ...n.props }
  }
  if (c.pages) c.pages = c.pages.map((p) => p.map((m) => shiftScale(m, s)))
  if (c.children) c.children = c.children.map((m) => shiftScale(m, s))
  return c
}

export default function LibraryPanel() {
  const customWidgets = useEditor((s) => s.doc.customWidgets)
  const groups = new Map<string, CustomWidgetDef[]>()
  for (const w of customWidgets) {
    const g = w.group || '未分组'
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(w)
  }

  return (
    <div className="library">
      <div className="panel-title">控件库</div>
      <div className="library-scroll">
        {CATEGORIES.map((cat) => (
          <div key={cat}>
            <div className="group-title">{CATEGORY_LABEL[cat]}</div>
            <div className="lib-grid">
              {WIDGET_DEFS.filter((d) => d.category === cat).map((def, i) => (
                <LibItem key={cat + '-' + i} def={def} />
              ))}
            </div>
          </div>
        ))}
        {[...groups.entries()].map(([group, defs]) => (
          <div key={group}>
            <div className="group-title">🧩 定制控件 · {group}</div>
            <div className="lib-grid">
              {defs.map((def) => (
                <CustomLibItem key={def.id} def={def} />
              ))}
            </div>
          </div>
        ))}
        {customWidgets.length === 0 && (
          <div className="group-title">🧩 定制控件（菜单"控件"里新建，或选中画布内容"存为定制控件"）</div>
        )}
      </div>
    </div>
  )
}

function LibItem({ def }: { def: WidgetDef }) {
  const addWidget = useEditor((s) => s.addWidget)

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/x-widget-def', JSON.stringify(def))
    e.dataTransfer.setData('text/plain', def.label)
    e.dataTransfer.effectAllowed = 'copy'
  }

  // 点击 = 添加到画布中央
  const onClick = () => {
    const el = canvasEl.current
    const st = useEditor.getState()
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (r.width / 2 - st.viewport.panX) / st.viewport.zoom
    const y = (r.height / 2 - st.viewport.panY) / st.viewport.zoom
    addWidget(def, x, y)
  }

  return (
    <div
      className="lib-item"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title="拖入画布指定位置，或点击加到画布中央"
    >
      <span className="lib-icon" dangerouslySetInnerHTML={{ __html: libIcon(def) }} />
      <span className="lib-label">{def.label}</span>
    </div>
  )
}

function CustomLibItem({ def }: { def: CustomWidgetDef }) {
  const addWidgetCustom = useEditor((s) => s.addWidgetCustom)
  const renameCustomWidget = useEditor((s) => s.renameCustomWidget)
  const deleteCustomWidget = useEditor((s) => s.deleteCustomWidget)
  const setEditingWidget = useEditor((s) => s.setEditingWidget)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(def.name)

  const onDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/x-widget-custom', def.id)
    e.dataTransfer.setData('text/plain', def.name)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const onClick = () => {
    const el = canvasEl.current
    const st = useEditor.getState()
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (r.width / 2 - st.viewport.panX) / st.viewport.zoom
    const y = (r.height / 2 - st.viewport.panY) / st.viewport.zoom
    addWidgetCustom(def.id, x, y)
  }

  return (
    <div
      className="lib-item custom-item"
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      title="拖入画布创建实例；双击重命名；✎ 编辑定义；✕ 删除"
      onDoubleClick={() => {
        setEditing(true)
        setDraft(def.name)
      }}
    >
      <span className="lib-icon" dangerouslySetInnerHTML={{ __html: customLibIcon(def) }} />
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            renameCustomWidget(def.id, draft)
            setEditing(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="lib-label">{def.name}</span>
      )}
      <button
        className="mini-btn"
        title="编辑定义"
        onClick={(e) => {
          e.stopPropagation()
          setEditingWidget(def.id)
        }}
      >
        ✎
      </button>
      <button
        className="mini-btn"
        title="删除定义"
        onClick={(e) => {
          e.stopPropagation()
          deleteCustomWidget(def.id)
        }}
      >
        ✕
      </button>
    </div>
  )
}
