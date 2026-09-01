import { useState } from 'react'
import type { ReactNode } from 'react'
import { useEditor } from '../store/editorStore'
import type { WidgetNode, WidgetType } from '../types'
import { isClickable } from '../widgets/tree'
import { renderKidsOf } from '../widgets/registry'

const TYPE_LABEL: Record<WidgetType, string> = {
  rect: '形状',
  ellipse: '椭圆',
  line: '线段',
  placeholder: '占位图',
  nine: '九宫格',
  text: '文本',
  button: '按钮',
  checkbox: '复选框',
  progress: '进度条',
  input: '输入框',
  filter: '筛选器',
  panel: '面板',
  dialog: '弹窗',
  scroll: '滚动',
  list: '列表',
  grid: '网格',
  tab: '页签',
  custom: '定制'
}

export default function LayerPanel({ height = 198 }: { height?: number }) {
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const editingPopupId = useEditor((s) => s.editingPopupId)
  const editingDef = editingWidgetId ? doc.customWidgets.find((w) => w.id === editingWidgetId) : null
  const editingPopup = !editingDef && editingPopupId ? doc.popups.find((p) => p.id === editingPopupId) : null
  const root = editingDef
    ? editingDef.tree
    : editingPopup
      ? editingPopup.nodes
      : pageIndex < 0
        ? doc.commonLayer.nodes
        : doc.pages[pageIndex]?.nodes ?? []
  const rows: ReactNode[] = []
  renderRows(root, 0, rows)
  return (
    <div className="layers" style={{ height }}>
      <div className="panel-title">
        {editingDef
          ? `定义图层「${editingDef.name}」（Tab 子控件、插槽内容缩进显示）`
          : editingPopup
            ? `弹窗「${editingPopup.name}」图层（双击重命名）`
            : pageIndex < 0
              ? '公共层图层（所有页面共享）'
              : '图层（排在前面的显示在上层；容器子控件缩进显示；双击重命名）'}
      </div>
      <div className="layer-list">{rows}</div>
    </div>
  )
}

function renderRows(arr: WidgetNode[], depth: number, out: ReactNode[]): void {
  for (let i = arr.length - 1; i >= 0; i--) {
    const n = arr[i]
    out.push(<Row key={n.id} n={n} depth={depth} />)
    const kids = renderKidsOf(n)
    if (kids) renderRows(kids, depth + 1, out)
    if (n.slots) {
      for (const list of Object.values(n.slots)) renderRows(list, depth + 1, out)
    }
  }
}

function Row({ n, depth }: { n: WidgetNode; depth: number }) {
  const selectedIds = useEditor((s) => s.selectedIds)
  const setSelection = useEditor((s) => s.setSelection)
  const toggleSelection = useEditor((s) => s.toggleSelection)
  const updateNodes = useEditor((s) => s.updateNodes)
  const moveLayer = useEditor((s) => s.moveLayer)
  const bringToFront = useEditor((s) => s.bringToFront)
  const sendToBack = useEditor((s) => s.sendToBack)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const commit = () => {
    if (draft.trim()) {
      updateNodes([n.id], (m) => {
        m.name = draft.trim()
      })
    }
    setEditing(false)
  }

  return (
    <div
      className={
        'layer-row' +
        (selectedIds.includes(n.id) ? ' selected' : '') +
        (n.visible ? '' : ' hidden-node') +
        (depth > 0 ? ' nested' : '')
      }
      style={{ paddingLeft: 10 + depth * 20 }}
      onClick={(e) => {
        if (e.shiftKey) toggleSelection(n.id)
        else setSelection([n.id])
      }}
      onDoubleClick={() => {
        setEditing(true)
        setDraft(n.name)
      }}
    >
      <span className="type-tag">{TYPE_LABEL[n.type]}</span>
      {isClickable(n) && (
        <span className="clickable-tag" title="可点击控件：右键 →「点击」可演示点击效果">
          点击
        </span>
      )}
      {editing ? (
        <input
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="layer-name">{n.name}</span>
      )}
      <button
        className="mini-btn"
        title={n.visible ? '隐藏' : '显示'}
        onClick={(e) => {
          e.stopPropagation()
          updateNodes([n.id], (m) => {
            m.visible = !m.visible
          })
        }}
      >
        {n.visible ? '显' : '隐'}
      </button>
      <button
        className="mini-btn"
        title={n.locked ? '解锁' : '锁定'}
        onClick={(e) => {
          e.stopPropagation()
          updateNodes([n.id], (m) => {
            m.locked = !m.locked
          })
        }}
      >
        {n.locked ? '解' : '锁'}
      </button>
      <button
        className="mini-btn"
        title="上移一层"
        onClick={(e) => {
          e.stopPropagation()
          moveLayer(n.id, 1)
        }}
      >
        ↑
      </button>
      <button
        className="mini-btn"
        title="下移一层"
        onClick={(e) => {
          e.stopPropagation()
          moveLayer(n.id, -1)
        }}
      >
        ↓
      </button>
      <button
        className="mini-btn"
        title="置顶"
        onClick={(e) => {
          e.stopPropagation()
          bringToFront(n.id)
        }}
      >
        ⤒
      </button>
      <button
        className="mini-btn"
        title="置底"
        onClick={(e) => {
          e.stopPropagation()
          sendToBack(n.id)
        }}
      >
        ⤓
      </button>
    </div>
  )
}
