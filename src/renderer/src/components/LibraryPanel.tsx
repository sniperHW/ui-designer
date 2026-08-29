import type { DragEvent } from 'react'
import { WIDGET_DEFS, CATEGORY_LABEL, libIcon } from '../widgets/registry'
import type { Category, WidgetDef } from '../widgets/registry'
import { useEditor } from '../store/editorStore'
import { canvasEl } from '../canvasRef'

const CATEGORIES: Category[] = ['shape', 'text', 'control', 'container']

export default function LibraryPanel() {
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
