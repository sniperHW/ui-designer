import { useEffect, type ReactNode } from 'react'
import { useEditor } from '../store/editorStore'
import { doSave, doOpen, doExportPng, confirmDiscard } from '../fileOps'
import { PREVIEW_RATIOS } from '../widgets/registry'
import type { WidgetNode } from '../types'

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

/** 菜单栏类别：有菜单处于展开状态时，悬停其它类别 = 收起旧的、展开新的 */
function Menu({ label, children }: { label: string; children: ReactNode }) {
  const onSummaryEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (!document.querySelector('details.menu[open]')) return
    const self = (e.currentTarget as HTMLElement).closest('details')
    document.querySelectorAll('details.menu[open]').forEach((d) => {
      if (d !== self) d.removeAttribute('open')
    })
    self?.setAttribute('open', '')
  }
  return (
    <details className="menu">
      <summary onMouseEnter={onSummaryEnter}>{label}</summary>
      <div className="menu-items">{children}</div>
    </details>
  )
}

/** 当前选中是否为单个定制控件实例 */
function useSingleCustomInstance(): { id: string; customId: string } | null {
  const selectedIds = useEditor((s) => s.selectedIds)
  const doc = useEditor((s) => s.doc)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  if (selectedIds.length !== 1 || editingWidgetId) return null
  for (const p of [doc.commonLayer, ...doc.pages]) {
    const found = findCustom(p.nodes, selectedIds[0])
    if (found) return found
  }
  return null
}

function findCustom(arr: WidgetNode[], id: string): { id: string; customId: string } | null {
  for (const n of arr) {
    if (n.id === id && n.type === 'custom' && n.customId) return { id: n.id, customId: n.customId }
    const subs = [
      ...(n.pages ?? []),
      ...(n.children ? [n.children] : []),
      ...(n.slots ? Object.values(n.slots) : [])
    ]
    for (const s of subs) {
      const r = findCustom(s, id)
      if (r) return r
    }
  }
  return null
}

export default function Header() {
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const selectedCount = useEditor((s) => s.selectedIds.length)
  const clipboardCount = useEditor((s) => s.clipboard.length)
  const showGrid = useEditor((s) => s.showGrid)
  const snapEnabled = useEditor((s) => s.snapEnabled)
  const showSafeArea = useEditor((s) => s.showSafeArea)
  const previewRatio = useEditor((s) => s.previewRatio)
  const zoom = useEditor((s) => s.viewport.zoom)
  const dirty = useEditor((s) => s.dirty)
  const docName = useEditor((s) => s.doc.meta.name)
  const hasProject = useEditor((s) => s.hasProject)
  const inst = useSingleCustomInstance()

  const st = () => useEditor.getState()

  // 点击菜单外部任意位置收起菜单；pointerdown 先于 click，点其它菜单时旧的先收起再展开新的
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null
      document.querySelectorAll('details.menu[open]').forEach((d) => {
        if (!(t && d.contains(t))) d.removeAttribute('open')
      })
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div className="header">
      <div className="menu-bar">
        <Menu label="文件">
          <MenuItem
            label="新建工程…"
            accel="⌘N"
            onClick={() => {
              if (confirmDiscard()) st().setShowNewModal(true)
            }}
          />
          <MenuItem label="打开…" accel="⌘O" onClick={() => void doOpen()} />
          <MenuItem label="保存" accel="⌘S" disabled={!hasProject} onClick={() => void doSave(false)} />
          <MenuItem label="另存为…" disabled={!hasProject} onClick={() => void doSave(true)} />
          <MenuItem
            label="关闭工程"
            disabled={!hasProject}
            onClick={() => {
              if (confirmDiscard()) st().closeProject()
            }}
          />
          <div className="menu-sep" />
          <MenuItem label="导出当前页 PNG…" disabled={!hasProject} onClick={() => void doExportPng()} />
        </Menu>
        <Menu label="编辑">
          <MenuItem label="撤销" accel="⌘Z" disabled={!canUndo} onClick={() => st().undo()} />
          <MenuItem label="重做" accel="⇧⌘Z" disabled={!canRedo} onClick={() => st().redo()} />
          <div className="menu-sep" />
          <MenuItem label="复制" accel="⌘C" disabled={selectedCount === 0} onClick={() => st().copySelected()} />
          <MenuItem label="粘贴" accel="⌘V" disabled={clipboardCount === 0} onClick={() => st().paste()} />
          <MenuItem label="再制" accel="⌘D" disabled={selectedCount === 0} onClick={() => st().duplicateSelected()} />
          <div className="menu-sep" />
          <MenuItem label="全选" accel="⌘A" onClick={() => st().selectAll()} />
          <MenuItem label="删除" accel="⌫" disabled={selectedCount === 0} onClick={() => st().deleteSelected()} />
        </Menu>
        <Menu label="控件">
          <MenuItem label="新建定制控件（空白）" disabled={!hasProject} onClick={() => st().createCustomWidget({ kind: 'blank' })} />
          <MenuItem
            label="以 Tab 容器为骨架新建…"
            disabled={!hasProject}
            onClick={() => st().createCustomWidget({ kind: 'tab', tabs: ['页签 1', '页签 2'], barPosition: 'top' })}
          />
          <MenuItem
            label="以面板为骨架新建"
            disabled={!hasProject}
            onClick={() => st().createCustomWidget({ kind: 'panel' })}
          />
          <MenuItem
            label="以滚动区为骨架新建"
            disabled={!hasProject}
            onClick={() => st().createCustomWidget({ kind: 'scroll' })}
          />
          <div className="menu-sep" />
          <MenuItem
            label="存为定制控件"
            disabled={selectedCount === 0}
            onClick={() => st().saveSelectionAsCustom()}
          />
          <MenuItem
            label="编辑选中实例的定义"
            disabled={!inst}
            onClick={() => inst && st().setEditingWidget(inst.customId)}
          />
          <MenuItem
            label="打散实例为普通组合"
            disabled={!inst}
            onClick={() => inst && st().detachInstance(inst.id)}
          />
        </Menu>
        <Menu label="视图">
          <MenuItem label="放大" accel="⌘=" onClick={() => st().zoomByCenter(1.2)} />
          <MenuItem label="缩小" accel="⌘-" onClick={() => st().zoomByCenter(1 / 1.2)} />
          <MenuItem label="实际大小 (100%)" onClick={() => st().setZoom100()} />
          <MenuItem label="适配窗口" onClick={() => st().fitView()} />
          <div className="menu-sep" />
          <MenuItem
            label="▶ 运行原型预览"
            disabled={!hasProject}
            onClick={() => st().startPreview()}
          />
          <div className="menu-sep" />
          <MenuItem label={(showGrid ? '✓ ' : '') + '显示网格'} onClick={() => st().toggleGrid()} />
          <MenuItem label={(snapEnabled ? '✓ ' : '') + '网格吸附'} onClick={() => st().toggleSnap()} />
          <MenuItem label={(showSafeArea ? '✓ ' : '') + '安全区参考框'} onClick={() => st().toggleSafeArea()} />
          <div className="menu-sep" />
          <div className="menu-group-title">分辨率预览（按锚点重排，只读）</div>
          {PREVIEW_RATIOS.map((r) => (
            <MenuItem
              key={r.id}
              label={(previewRatio === r.id ? '✓ ' : '') + r.label}
              onClick={() => st().setPreviewRatio(r.id)}
            />
          ))}
        </Menu>
        <Menu label="帮助">
          <MenuItem
            label="关于…"
            onClick={() =>
              alert('手游 UI 雏形设计工具 v0.1\n线框图原型编辑器（M0 – M2）\n\n设计文档见：概念设计.md')
            }
          />
        </Menu>
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
        {hasProject && (
          <>
            <span className="doc-name">
              {docName}
              {dirty && <span className="dot" title="有未保存的修改" />}
            </span>
            <button className="tb-btn" title="运行原型预览（Esc 退出）" onClick={() => st().startPreview()}>
              ▶ 预览
            </button>
            <button className="tb-btn" onClick={() => void doExportPng()}>
              导出 PNG
            </button>
            <button className="tb-btn primary" onClick={() => void doSave(false)}>
              保存
            </button>
          </>
        )}
      </div>
    </div>
  )
}
