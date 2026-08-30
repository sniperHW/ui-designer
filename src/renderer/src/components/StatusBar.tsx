import { useEditor } from '../store/editorStore'

export default function StatusBar() {
  const hasProject = useEditor((s) => s.hasProject)
  const currentPageIndex = useEditor((s) => s.currentPageIndex)
  const meta = useEditor((s) => s.doc.meta)
  const dirty = useEditor((s) => s.dirty)
  const filePath = useEditor((s) => s.filePath)
  const mouse = useEditor((s) => s.mouse)
  const zoom = useEditor((s) => s.viewport.zoom)
  const selCount = useEditor((s) => s.selectedIds.length)
  const snapEnabled = useEditor((s) => s.snapEnabled)
  const fileLabel = filePath ? filePath.split(/[\\/]/).pop() : '未保存'

  if (!hasProject) {
    return (
      <div className="statusbar">
        <span>未打开工程</span>
        <span className="grow" />
        <span>⌘N 新建 · ⌘O 打开</span>
      </div>
    )
  }

  return (
    <div className="statusbar">
      <span>
        {meta.name}
        {dirty ? ' •' : ''}
      </span>
      <span>{fileLabel}</span>
      <span>
        {currentPageIndex < 0 ? '编辑：公共层' : `编辑：${meta ? '' : ''}页面 ${currentPageIndex + 1}`}
      </span>
      <span>
        设计 {meta.designWidth} × {meta.designHeight} · {meta.orientation === 'landscape' ? '横屏' : '竖屏'}
      </span>
      <span className="grow" />
      <span>
        坐标 {mouse.x}, {mouse.y}
      </span>
      <span>缩放 {Math.round(zoom * 100)}%</span>
      <span>{snapEnabled ? '吸附开' : '吸附关'}</span>
      <span>选中 {selCount} 项</span>
    </div>
  )
}
