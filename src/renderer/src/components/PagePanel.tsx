import { useState } from 'react'
import { useEditor } from '../store/editorStore'
import { renderTreeSVG } from '../widgets/registry'

export default function PagePanel() {
  const doc = useEditor((s) => s.doc)
  const currentIndex = useEditor((s) => s.currentPageIndex)
  const setCurrentPage = useEditor((s) => s.setCurrentPage)
  const addPage = useEditor((s) => s.addPage)
  const duplicatePage = useEditor((s) => s.duplicatePage)
  const deletePage = useEditor((s) => s.deletePage)
  const renamePage = useEditor((s) => s.renamePage)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = (i: number, name: string) => {
    setEditing(i)
    setDraft(name)
  }
  const commit = () => {
    if (editing !== null) renamePage(editing, draft)
    setEditing(null)
  }

  const dw = doc.meta.designWidth
  const dh = doc.meta.designHeight

  return (
    <div className="pages">
      <div className="panel-title">页面（双击重命名）</div>
      <div className="page-list">
        <div
          className={'common-row' + (currentIndex === -1 ? ' active' : '')}
          onClick={() => setCurrentPage(-1)}
          title="公共层：内容显示在所有页面之下（如顶部状态栏），在此编辑"
        >
          <svg
            className="page-thumb"
            viewBox={`0 0 ${dw} ${dh}`}
            style={{ height: Math.round((56 * dh) / dw) }}
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x={0} y={0} width={dw} height={dh} fill="#fff" stroke="#d9d9de" strokeWidth="4" />
            {doc.commonLayer.nodes
              .filter((n) => n.visible)
              .map((n) => <g key={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }} />)}
          </svg>
          <span className="page-name">⚙ 公共层（所有页面共享）</span>
        </div>
        {doc.pages.map((p, i) => (
          <div
            key={p.id}
            className={'page-row' + (i === currentIndex ? ' active' : '')}
            onClick={() => setCurrentPage(i)}
            onDoubleClick={() => startEdit(i, p.name)}
          >
            <svg
              className="page-thumb"
              viewBox={`0 0 ${dw} ${dh}`}
              style={{ height: Math.round((56 * dh) / dw) }}
              preserveAspectRatio="xMidYMid meet"
            >
              <rect x={0} y={0} width={dw} height={dh} fill="#fff" stroke="#d9d9de" strokeWidth="4" />
              {doc.commonLayer.nodes
                .filter((n) => n.visible)
                .map((n) => <g key={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }} />)}
              {p.nodes
                .filter((n) => n.visible)
                .map((n) => <g key={n.id} dangerouslySetInnerHTML={{ __html: renderTreeSVG(n, doc.customWidgets) }} />)}
            </svg>
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
      </div>
      <div className="page-foot">
        <button className="tb-btn" onClick={addPage}>
          ＋ 新建页面
        </button>
      </div>
    </div>
  )
}
