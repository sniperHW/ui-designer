import { useEditor } from '../store/editorStore'

/** 画布上方的编辑目标切换：页面 / 公共层 / 定制控件定义（可与页面编辑并存，§5.1） */
export default function EditTargetBar() {
  const doc = useEditor((s) => s.doc)
  const currentPageIndex = useEditor((s) => s.currentPageIndex)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const setCurrentPage = useEditor((s) => s.setCurrentPage)
  const setEditingWidget = useEditor((s) => s.setEditingWidget)

  return (
    <div className="edit-target-bar">
      <button
        className={'chip' + (!editingWidgetId && currentPageIndex < 0 ? ' on' : '')}
        onClick={() => setCurrentPage(-1)}
        title="公共层：所有页面共享的常驻内容"
      >
        ⚙ 公共层
      </button>
      {doc.pages.map((p, i) => (
        <button
          key={p.id}
          className={'chip' + (!editingWidgetId && i === currentPageIndex ? ' on' : '')}
          onClick={() => setCurrentPage(i)}
        >
          📄 {p.name}
        </button>
      ))}
      {doc.customWidgets.length > 0 && <span className="chip-sep" />}
      {doc.customWidgets.map((w) => (
        <button
          key={w.id}
          className={'chip widget' + (editingWidgetId === w.id ? ' on' : '')}
          onClick={() => setEditingWidget(w.id)}
          title="编辑定制控件定义（改一处全局生效）"
        >
          🧩 {w.name}
        </button>
      ))}
      <span className="grow" />
      <button
        className="chip add"
        title="新建定制控件（空白）"
        onClick={() => useEditor.getState().createCustomWidget({ kind: 'blank' })}
      >
        ＋ 定制控件
      </button>
    </div>
  )
}
