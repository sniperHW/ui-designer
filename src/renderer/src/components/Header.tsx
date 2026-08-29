import { useEditor } from '../store/editorStore'
import { doSave, doOpen, doExportPng } from '../fileOps'

function MenuItem({
  label,
  accel,
  disabled,
  onClick
}: {
  label: string
  accel?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={'menu-item' + (disabled ? ' disabled' : '')}
      onClick={(e) => {
        if (disabled) return
        onClick()
        const d = (e.currentTarget as HTMLElement).closest('details')
        if (d) d.removeAttribute('open')
      }}
    >
      <span>{label}</span>
      {accel && <span className="accel">{accel}</span>}
    </div>
  )
}

export default function Header() {
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const selectedCount = useEditor((s) => s.selectedIds.length)
  const clipboardCount = useEditor((s) => s.clipboard.length)
  const showGrid = useEditor((s) => s.showGrid)
  const snapEnabled = useEditor((s) => s.snapEnabled)
  const zoom = useEditor((s) => s.viewport.zoom)
  const dirty = useEditor((s) => s.dirty)
  const docName = useEditor((s) => s.doc.meta.name)

  const st = () => useEditor.getState()

  return (
    <div className="header">
      <div className="menu-bar">
        <details className="menu">
          <summary>文件</summary>
          <div className="menu-items">
            <MenuItem label="新建工程…" accel="⌘N" onClick={() => st().setShowNewModal(true)} />
            <MenuItem label="打开…" accel="⌘O" onClick={() => void doOpen()} />
            <MenuItem label="保存" accel="⌘S" onClick={() => void doSave(false)} />
            <MenuItem label="另存为…" onClick={() => void doSave(true)} />
            <div className="menu-sep" />
            <MenuItem label="导出当前页 PNG…" onClick={() => void doExportPng()} />
          </div>
        </details>
        <details className="menu">
          <summary>编辑</summary>
          <div className="menu-items">
            <MenuItem label="撤销" accel="⌘Z" disabled={!canUndo} onClick={() => st().undo()} />
            <MenuItem label="重做" accel="⇧⌘Z" disabled={!canRedo} onClick={() => st().redo()} />
            <div className="menu-sep" />
            <MenuItem label="复制" accel="⌘C" disabled={selectedCount === 0} onClick={() => st().copySelected()} />
            <MenuItem label="粘贴" accel="⌘V" disabled={clipboardCount === 0} onClick={() => st().paste()} />
            <MenuItem label="再制" accel="⌘D" disabled={selectedCount === 0} onClick={() => st().duplicateSelected()} />
            <div className="menu-sep" />
            <MenuItem label="全选" accel="⌘A" onClick={() => st().selectAll()} />
            <MenuItem label="删除" accel="⌫" disabled={selectedCount === 0} onClick={() => st().deleteSelected()} />
          </div>
        </details>
        <details className="menu">
          <summary>视图</summary>
          <div className="menu-items">
            <MenuItem label="放大" accel="⌘=" onClick={() => st().zoomByCenter(1.2)} />
            <MenuItem label="缩小" accel="⌘-" onClick={() => st().zoomByCenter(1 / 1.2)} />
            <MenuItem label="实际大小 (100%)" onClick={() => st().setZoom100()} />
            <MenuItem label="适配窗口" onClick={() => st().fitView()} />
            <div className="menu-sep" />
            <MenuItem label={(showGrid ? '✓ ' : '') + '显示网格'} onClick={() => st().toggleGrid()} />
            <MenuItem label={(snapEnabled ? '✓ ' : '') + '网格吸附'} onClick={() => st().toggleSnap()} />
          </div>
        </details>
        <details className="menu">
          <summary>帮助</summary>
          <div className="menu-items">
            <MenuItem
              label="关于…"
              onClick={() => alert('手游 UI 雏形设计工具 v0.1\n线框图原型编辑器（M0 / M1）\n\n设计文档见：概念设计.md')}
            />
          </div>
        </details>
        <span className="app-title">手游 UI 雏形设计工具</span>
      </div>

      <div className="toolbar">
        <button className="tb-btn" title="撤销 (⌘Z)" disabled={!canUndo} onClick={() => st().undo()}>
          ↩ 撤销
        </button>
        <button className="tb-btn" title="重做 (⇧⌘Z)" disabled={!canRedo} onClick={() => st().redo()}>
          ↪ 重做
        </button>
        <div className="tb-sep" />
        <button
          className="tb-btn"
          title="再制 (⌘D)"
          disabled={selectedCount === 0}
          onClick={() => st().duplicateSelected()}
        >
          再制
        </button>
        <button
          className="tb-btn"
          title="删除 (⌫)"
          disabled={selectedCount === 0}
          onClick={() => st().deleteSelected()}
        >
          删除
        </button>
        <div className="tb-sep" />
        <div className="align-grid" title="多选后可用">
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('left')}>
            左对齐
          </button>
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('hcenter')}>
            水平居中
          </button>
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('right')}>
            右对齐
          </button>
          <button className="tb-btn" disabled={selectedCount < 3} onClick={() => st().distributeSelected('h')}>
            ⇹ 等距
          </button>
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('top')}>
            顶对齐
          </button>
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('vcenter')}>
            垂直居中
          </button>
          <button className="tb-btn" disabled={selectedCount < 2} onClick={() => st().alignSelected('bottom')}>
            底对齐
          </button>
          <button className="tb-btn" disabled={selectedCount < 3} onClick={() => st().distributeSelected('v')}>
            ⤓ 等距
          </button>
        </div>
        <div className="tb-sep" />
        <button
          className={'tb-btn' + (showGrid ? ' active' : '')}
          title="显示网格"
          onClick={() => st().toggleGrid()}
        >
          网格
        </button>
        <button
          className={'tb-btn' + (snapEnabled ? ' active' : '')}
          title="网格吸附"
          onClick={() => st().toggleSnap()}
        >
          吸附
        </button>
        <div className="tb-sep" />
        <button className="tb-btn" title="缩小 (⌘-)" onClick={() => st().zoomByCenter(1 / 1.2)}>
          −
        </button>
        <button className="tb-btn zoom-label" title="实际大小" onClick={() => st().setZoom100()}>
          {Math.round(zoom * 100)}%
        </button>
        <button className="tb-btn" title="放大 (⌘=)" onClick={() => st().zoomByCenter(1.2)}>
          ＋
        </button>
        <button className="tb-btn" title="适配窗口" onClick={() => st().fitView()}>
          适配
        </button>
        <div className="spacer" />
        <span className="doc-name">
          {docName}
          {dirty && <span className="dot" title="有未保存的修改" />}
        </span>
        <button className="tb-btn" onClick={() => void doExportPng()}>
          导出 PNG
        </button>
        <button className="tb-btn primary" onClick={() => void doSave(false)}>
          保存
        </button>
      </div>
    </div>
  )
}
