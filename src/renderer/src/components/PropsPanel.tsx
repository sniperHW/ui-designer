import { useEffect, useState } from 'react'
import { useEditor } from '../store/editorStore'
import type { WidgetNode, WidgetProps, WidgetType } from '../types'

const TYPE_LABEL: Record<WidgetType, string> = {
  rect: '形状',
  ellipse: '椭圆',
  line: '线段',
  placeholder: '占位图',
  text: '文本',
  button: '按钮',
  checkbox: '复选框',
  progress: '进度条',
  input: '输入框',
  tab: 'Tab 页签'
}

export default function PropsPanel() {
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const selectedIds = useEditor((s) => s.selectedIds)
  const updateNodes = useEditor((s) => s.updateNodes)
  const alignSelected = useEditor((s) => s.alignSelected)
  const distributeSelected = useEditor((s) => s.distributeSelected)

  const page = doc.pages[pageIndex]
  if (!page) return null
  const sel = page.nodes.filter((n) => selectedIds.includes(n.id))
  const ids = sel.map((n) => n.id)

  if (sel.length === 0) {
    return (
      <div className="right">
        <div className="prop-section">
          <h4>工程信息</h4>
          <div className="prop-hint">
            工程：{doc.meta.name}
            <br />
            设计尺寸：{doc.meta.designWidth} × {doc.meta.designHeight}（
            {doc.meta.orientation === 'landscape' ? '横屏' : '竖屏'}）
            <br />
            页面数：{doc.pages.length}
          </div>
          <div className="prop-hint">选中画布中的控件后，在此编辑属性。</div>
        </div>
      </div>
    )
  }

  return (
    <div className="right">
      <div className="prop-section">
        <h4>{sel.length === 1 ? TYPE_LABEL[sel[0].type] : `已选中 ${sel.length} 个控件`}</h4>
        {sel.length === 1 && (
          <TextField
            label="名称"
            value={sel[0].name}
            onCommit={(v) =>
              updateNodes(ids, (n) => {
                if (v.trim()) n.name = v.trim()
              })
            }
          />
        )}
        <div className="grid-2">
          <NumField label="X" value={sel[0].x} onCommit={(v) => updateNodes(ids, (n) => { n.x = v })} />
          <NumField label="Y" value={sel[0].y} onCommit={(v) => updateNodes(ids, (n) => { n.y = v })} />
          <NumField label="宽" value={sel[0].w} min={1} onCommit={(v) => updateNodes(ids, (n) => { n.w = v })} />
          <NumField label="高" value={sel[0].h} min={1} onCommit={(v) => updateNodes(ids, (n) => { n.h = v })} />
        </div>
      </div>
      {sel.length === 1 && <TypeProps node={sel[0]} />}
      {sel.length >= 2 && (
        <div className="prop-section">
          <h4>对齐与分布</h4>
          <div className="align-btns">
            <button onClick={() => alignSelected('left')}>左对齐</button>
            <button onClick={() => alignSelected('hcenter')}>水平居中</button>
            <button onClick={() => alignSelected('right')}>右对齐</button>
            <button disabled={sel.length < 3} onClick={() => distributeSelected('h')}>
              水平等距
            </button>
            <button onClick={() => alignSelected('top')}>顶对齐</button>
            <button onClick={() => alignSelected('vcenter')}>垂直居中</button>
            <button onClick={() => alignSelected('bottom')}>底对齐</button>
            <button disabled={sel.length < 3} onClick={() => distributeSelected('v')}>
              垂直等距
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TypeProps({ node }: { node: WidgetNode }) {
  const updateNodes = useEditor((s) => s.updateNodes)
  const id = [node.id]
  const setProp = (patch: WidgetProps) =>
    updateNodes(id, (n) => {
      Object.assign(n.props, patch)
    })
  const p = node.props

  const textRow = (
    <>
      <TextField label="内容" value={p.text ?? ''} multiline onCommit={(v) => setProp({ text: v })} />
      <NumField label="字号" value={p.fontSize ?? 26} min={8} max={200} onCommit={(v) => setProp({ fontSize: v })} />
    </>
  )

  switch (node.type) {
    case 'text':
      return (
        <div className="prop-section">
          <h4>文本</h4>
          {textRow}
          <div className="prop-row">
            <span>加粗</span>
            <input type="checkbox" checked={!!p.bold} onChange={(e) => setProp({ bold: e.target.checked })} />
          </div>
          <div className="prop-row">
            <span>对齐</span>
            <div className="seg">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} className={(p.align ?? 'left') === a ? 'on' : ''} onClick={() => setProp({ align: a })}>
                  {a === 'left' ? '左' : a === 'center' ? '中' : '右'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    case 'button':
      return (
        <div className="prop-section">
          <h4>按钮</h4>
          {textRow}
          <div className="prop-row">
            <span>加粗</span>
            <input type="checkbox" checked={!!p.bold} onChange={(e) => setProp({ bold: e.target.checked })} />
          </div>
        </div>
      )
    case 'checkbox':
      return (
        <div className="prop-section">
          <h4>复选框</h4>
          {textRow}
          <div className="prop-row">
            <span>勾选</span>
            <input type="checkbox" checked={!!p.checked} onChange={(e) => setProp({ checked: e.target.checked })} />
          </div>
        </div>
      )
    case 'input':
      return (
        <div className="prop-section">
          <h4>输入框</h4>
          <TextField label="占位文本" value={p.placeholder ?? ''} onCommit={(v) => setProp({ placeholder: v })} />
          <NumField label="字号" value={p.fontSize ?? 24} min={8} max={200} onCommit={(v) => setProp({ fontSize: v })} />
        </div>
      )
    case 'rect':
      return (
        <div className="prop-section">
          <h4>形状</h4>
          <NumField label="圆角" value={p.radius ?? 0} min={0} max={500} onCommit={(v) => setProp({ radius: v })} />
        </div>
      )
    case 'progress': {
      const value = p.progress ?? 0
      return (
        <div className="prop-section">
          <h4>进度条</h4>
          <div className="prop-row range-row">
            <span>进度</span>
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onPointerDown={() => useEditor.getState().pushHistory()}
              onChange={(e) =>
                updateNodes(
                  id,
                  (n) => {
                    n.props.progress = Number(e.target.value)
                  },
                  true
                )
              }
            />
          </div>
          <NumField label="百分比" value={value} min={0} max={100} onCommit={(v) => setProp({ progress: v })} />
        </div>
      )
    }
    case 'tab': {
      const tabs = p.tabs?.length ? p.tabs : ['页签 1']
      return (
        <div className="prop-section">
          <h4>Tab 页签</h4>
          <TextField
            label="页签列表"
            value={tabs.join('\n')}
            multiline
            onCommit={(v) => {
              const lines = v
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
              const next = lines.length ? lines : ['页签 1']
              updateNodes(id, (n) => {
                n.props.tabs = next
                const pages = n.pages ?? next.map(() => [] as WidgetNode[])
                n.pages = next.map((_, i) => pages[i] ?? [])
                n.activeTab = Math.min(n.activeTab ?? 0, next.length - 1)
              })
            }}
          />
          <div className="prop-row">
            <span>页签栏</span>
            <div className="seg">
              <button
                className={(p.barPosition ?? 'top') === 'top' ? 'on' : ''}
                onClick={() => setProp({ barPosition: 'top' })}
              >
                上
              </button>
              <button
                className={p.barPosition === 'bottom' ? 'on' : ''}
                onClick={() => setProp({ barPosition: 'bottom' })}
              >
                下
              </button>
            </div>
          </div>
          <div className="prop-row">
            <span>当前页签</span>
            <div className="seg">
              {tabs.map((_, i) => (
                <button
                  key={i}
                  className={(node.activeTab ?? 0) === i ? 'on' : ''}
                  title={`切换到页签 ${i + 1}`}
                  onClick={() =>
                    updateNodes(
                      id,
                      (n) => {
                        n.activeTab = i
                      },
                      true
                    )
                  }
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-hint">画布中点击页签头切换编辑页；把控件拖到页签内容区即放入当前页签。</div>
        </div>
      )
    }
    default:
      return (
        <div className="prop-section">
          <div className="prop-hint">该控件无附加属性。</div>
        </div>
      )
  }
}

function NumField({
  label,
  value,
  onCommit,
  min,
  max
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  min?: number
  max?: number
}) {
  const [v, setV] = useState(String(Math.round(value)))
  useEffect(() => {
    setV(String(Math.round(value)))
  }, [value])
  const commit = () => {
    const n = parseInt(v, 10)
    if (Number.isNaN(n)) {
      setV(String(Math.round(value)))
      return
    }
    const c = Math.round(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)))
    onCommit(c)
    setV(String(c))
  }
  return (
    <label className="prop-row">
      <span>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

function TextField({
  label,
  value,
  onCommit,
  multiline
}: {
  label: string
  value: string
  onCommit: (v: string) => void
  multiline?: boolean
}) {
  const [v, setV] = useState(value)
  useEffect(() => {
    setV(value)
  }, [value])
  const commit = () => onCommit(v)
  if (multiline) {
    return (
      <label className="prop-row">
        <span>{label}</span>
        <textarea
          rows={2}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit()
          }}
        />
      </label>
    )
  }
  return (
    <label className="prop-row">
      <span>{label}</span>
      <input
        type="text"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}
