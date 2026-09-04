import { useEditor } from '../store/editorStore'
import { PREVIEW_RATIOS, previewDims } from '../widgets/registry'

export default function StatusBar() {
  const hasProject = useEditor((s) => s.hasProject)
  const currentPageIndex = useEditor((s) => s.currentPageIndex)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const editingPopupId = useEditor((s) => s.editingPopupId)
  const editingTipId = useEditor((s) => s.editingTipId)
  const meta = useEditor((s) => s.doc.meta)
  const dirty = useEditor((s) => s.dirty)
  const filePath = useEditor((s) => s.filePath)
  const mouse = useEditor((s) => s.mouse)
  const zoom = useEditor((s) => s.viewport.zoom)
  const selCount = useEditor((s) => s.selectedIds.length)
  const snapEnabled = useEditor((s) => s.snapEnabled)
  const previewRatio = useEditor((s) => s.previewRatio)
  const showSafeArea = useEditor((s) => s.showSafeArea)
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

  const pd = previewDims(meta, previewRatio)
  const editingDef = useEditor.getState().doc.customWidgets.find((w) => w.id === editingWidgetId)
  const editingPopup = !editingDef && editingPopupId ? useEditor.getState().doc.popups.find((p) => p.id === editingPopupId) : null
  const editingTip =
    !editingDef && !editingPopup && editingTipId ? useEditor.getState().doc.tips.find((p) => p.id === editingTipId) : null

  return (
    <div className="statusbar">
      <span>
        {meta.name}
        {dirty ? ' •' : ''}
      </span>
      <span>{fileLabel}</span>
      <span>
        {editingDef
          ? `编辑：定制控件「${editingDef.name}」`
          : editingPopup
            ? `编辑：弹窗「${editingPopup.name}」`
            : editingTip
              ? `编辑：轻提示「${editingTip.name}」`
              : currentPageIndex < 0
              ? '编辑：公共层'
              : `编辑：页面 ${currentPageIndex + 1}`}
      </span>
      <span>
        设计 {meta.designWidth} × {meta.designHeight} · {meta.orientation === 'landscape' ? '横屏' : '竖屏'}
      </span>
      <span className="grow" />
      <label className="sb-select" title="分辨率预览：按锚点规则重排，只读">
        预览
        <select value={previewRatio} onChange={(e) => useEditor.getState().setPreviewRatio(e.target.value)}>
          {PREVIEW_RATIOS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
              {r.id !== 'design' ? ` (${pd.w}×${pd.h})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="sb-select" title="刘海屏安全区参考框">
        <input
          type="checkbox"
          checked={showSafeArea}
          onChange={() => useEditor.getState().toggleSafeArea()}
        />
        安全区
      </label>
      <span>
        坐标 {mouse.x}, {mouse.y}
      </span>
      <span>缩放 {Math.round(zoom * 100)}%</span>
      <span>{snapEnabled ? '吸附开' : '吸附关'}</span>
      <span>选中 {selCount} 项</span>
    </div>
  )
}
