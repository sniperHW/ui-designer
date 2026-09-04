import { useState } from 'react'
import type { ReactNode } from 'react'
import { useEditor } from '../store/editorStore'
import { renderTreeSVG } from '../widgets/registry'
import type { WidgetNode } from '../types'

export default function PagePanel({ height = 212 }: { height?: number }) {
  const doc = useEditor((s) => s.doc)
  const currentIndex = useEditor((s) => s.currentPageIndex)
  const editingPopupId = useEditor((s) => s.editingPopupId)
  const editingTipId = useEditor((s) => s.editingTipId)
  const setCurrentPage = useEditor((s) => s.setCurrentPage)
  const addPage = useEditor((s) => s.addPage)
  const duplicatePage = useEditor((s) => s.duplicatePage)
  const deletePage = useEditor((s) => s.deletePage)
  const renamePage = useEditor((s) => s.renamePage)
  const setEditingPopup = useEditor((s) => s.setEditingPopup)
  const addPopup = useEditor((s) => s.addPopup)
  const deletePopup = useEditor((s) => s.deletePopup)
  const renamePopup = useEditor((s) => s.renamePopup)
  const setEditingTip = useEditor((s) => s.setEditingTip)
  const addTip = useEditor((s) => s.addTip)
  const deleteTip = useEditor((s) => s.deleteTip)
  const renameTip = useEditor((s) => s.renameTip)
  const [editing, setEditing] = useState<number | null>(null)
  const [renamingPopup, setRenamingPopup] = useState<string | null>(null)
  const [renamingTip, setRenamingTip] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = (i: number, name: string) => {
    setEditing(i)
    setDraft(name)
  }
  const startRenamePopup = (id: string, name: string) => {
    setRenamingPopup(id)
    setDraft(name)
  }
  const startRenameTip = (id: string, name: string) => {
    setRenamingTip(id)
    setDraft(name)
  }
  const commit = () => {
    if (editing !== null) renamePage(editing, draft)
    if (renamingPopup) renamePopup(renamingPopup, draft)
    if (renamingTip) renameTip(renamingTip, draft)
    setEditing(null)
    setRenamingPopup(null)
    setRenamingTip(null)
  }

  const dw = doc.meta.designWidth
  const dh = doc.meta.designHeight
  const thumb = (nodes: ReactNode, extra?: ReactNode) => (
    <svg
      className="page-thumb"
      viewBox={`0 0 ${dw} ${dh}`}
      style={{ height: Math.round((56 * dh) / dw) }}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={dw} height={dh} fill="#fff" stroke="#d9d9de" strokeWidth="4" />
      {extra}
      {nodes}
    </svg>
  )
  const nodesOf = (arr: WidgetNode[]) =>
    arr
      .filter((n) => n.visible)
      .map((n) => <g key={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }} />)

  return (
    <div className="pages" style={{ height }}>
      <div className="panel-title">页面（✎ / 双击重命名）</div>
      <div className="page-list">
        <div
          className={'common-row' + (currentIndex === -1 && !editingPopupId && !editingTipId ? ' active' : '')}
          onClick={() => setCurrentPage(-1)}
          title="公共层：内容显示在所有页面之下（如顶部状态栏），在此编辑"
        >
          {thumb(nodesOf(doc.commonLayer.nodes))}
          <span className="page-name">⚙ 公共层（所有页面共享）</span>
        </div>
        {doc.pages.map((p, i) => (
          <div
            key={p.id}
            className={'page-row' + (i === currentIndex && !editingPopupId && !editingTipId ? ' active' : '')}
            onClick={() => setCurrentPage(i)}
            onDoubleClick={() => startEdit(i, p.name)}
          >
            {thumb(nodesOf(p.nodes), nodesOf(doc.commonLayer.nodes))}
            {editing === i ? (
              <input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setEditing(null)
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="page-name" title={p.name}>
                {p.name}
              </span>
            )}
            <button
              className="mini-btn"
              title="重命名页面"
              onClick={(e) => {
                e.stopPropagation()
                startEdit(i, p.name)
              }}
            >
              ✎
            </button>
            <button
              className="mini-btn"
              title="复制页面"
              onClick={(e) => {
                e.stopPropagation()
                duplicatePage(i)
              }}
            >
              ⧉
            </button>
            <button
              className="mini-btn"
              title="删除页面"
              disabled={doc.pages.length <= 1}
              onClick={(e) => {
                e.stopPropagation()
                deletePage(i)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="popup-group-title" title="弹窗在独立页面设计，由点击效果（弹出）显示">
          ▣ 弹窗（点击效果弹出）
        </div>
        {doc.popups.map((p) => (
          <div
            key={p.id}
            className={'page-row popup-row' + (editingPopupId === p.id ? ' active' : '')}
            onClick={() => setEditingPopup(p.id)}
            onDoubleClick={() => startRenamePopup(p.id, p.name)}
            title="点击进入弹窗设计；✎ / 双击重命名"
          >
            {thumb(nodesOf(p.nodes))}
            {renamingPopup === p.id ? (
              <input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setRenamingPopup(null)
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="page-name" title={p.name}>
                ▣ {p.name}
              </span>
            )}
            <button
              className="mini-btn"
              title="重命名弹窗"
              onClick={(e) => {
                e.stopPropagation()
                startRenamePopup(p.id, p.name)
              }}
            >
              ✎
            </button>
            <button
              className="mini-btn"
              title="删除弹窗"
              onClick={(e) => {
                e.stopPropagation()
                deletePopup(p.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="popup-group-title" title="轻提示框在独立页面设计，由「轻提示」标记悬停弹出">
          💬 轻提示（悬停弹出）
        </div>
        {doc.tips.map((p) => (
          <div
            key={p.id}
            className={'page-row popup-row' + (editingTipId === p.id ? ' active' : '')}
            onClick={() => setEditingTip(p.id)}
            onDoubleClick={() => startRenameTip(p.id, p.name)}
            title="点击进入轻提示设计；✎ / 双击重命名"
          >
            {thumb(nodesOf(p.nodes))}
            {renamingTip === p.id ? (
              <input
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                  if (e.key === 'Escape') setRenamingTip(null)
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="page-name" title={p.name}>
                💬 {p.name}
              </span>
            )}
            <button
              className="mini-btn"
              title="重命名轻提示"
              onClick={(e) => {
                e.stopPropagation()
                startRenameTip(p.id, p.name)
              }}
            >
              ✎
            </button>
            <button
              className="mini-btn"
              title="删除轻提示"
              onClick={(e) => {
                e.stopPropagation()
                deleteTip(p.id)
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="page-foot">
        <button className="tb-btn" onClick={addPage}>
          ＋ 新建页面
        </button>
        <button className="tb-btn" onClick={() => addPopup()} title="新建独立弹窗页（自带一个居中弹窗），在点击效果中选择它">
          ＋ 新建弹窗
        </button>
        <button className="tb-btn" onClick={() => addTip()} title="新建独立轻提示页（自带一个居中轻提示框），在控件的「轻提示」标记中选择它">
          ＋ 新建轻提示
        </button>
      </div>
    </div>
  )
}
