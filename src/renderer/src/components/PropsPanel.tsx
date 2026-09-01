import { useEffect, useState } from 'react'
import { useEditor } from '../store/editorStore'
import type { CustomPropType, WidgetNode, WidgetProps, WidgetType } from '../types'
import type { AnchorMode, AnchorPreset, CustomWidgetDef } from '../types'
import { walkNodes, findNodeById } from '../widgets/tree'

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
  scroll: '滚动区',
  list: '列表',
  grid: '网格',
  tab: 'Tab 页签',
  custom: '定制控件实例'
}

const PRESETS: { id: AnchorPreset; label: string }[] = [
  { id: 'tl', label: '↖' },
  { id: 'tc', label: '↑' },
  { id: 'tr', label: '↗' },
  { id: 'ml', label: '←' },
  { id: 'mc', label: '·' },
  { id: 'mr', label: '→' },
  { id: 'bl', label: '↙' },
  { id: 'bc', label: '↓' },
  { id: 'br', label: '↘' }
]
const PRESET_LABEL: Record<AnchorPreset, string> = {
  tl: '左上', tc: '上中', tr: '右上', ml: '左中', mc: '中心', mr: '右中', bl: '左下', bc: '下中', br: '右下'
}
const MODE_LABEL: Record<AnchorMode, string> = { fixed: '固定尺寸', stretch: '随父拉伸', aspect: '等比' }

/** 各控件类型可绑定到暴露属性的属性键 */
const BINDABLE_KEYS: Partial<Record<WidgetType, { key: string; label: string }[]>> = {
  text: [
    { key: 'text', label: '文本内容' },
    { key: 'fontSize', label: '字号' }
  ],
  button: [
    { key: 'text', label: '按钮文字' },
    { key: 'fontSize', label: '字号' }
  ],
  checkbox: [
    { key: 'text', label: '标签文字' },
    { key: 'checked', label: '勾选状态' }
  ],
  input: [
    { key: 'placeholder', label: '占位文本' },
    { key: 'fontSize', label: '字号' }
  ],
  rect: [{ key: 'radius', label: '圆角' }],
  progress: [{ key: 'progress', label: '进度' }],
  dialog: [{ key: 'title', label: '弹窗标题' }],
  filter: [{ key: 'selected', label: '选中项下标' }],
  tab: [{ key: 'activeTab', label: '当前页签（activeTab）' }]
}

export default function PropsPanel({ width = 252 }: { width?: number }) {
  const doc = useEditor((s) => s.doc)
  const editingWidgetId = useEditor((s) => s.editingWidgetId)
  const selectedIds = useEditor((s) => s.selectedIds)
  const updateNodes = useEditor((s) => s.updateNodes)
  const alignSelected = useEditor((s) => s.alignSelected)
  const distributeSelected = useEditor((s) => s.distributeSelected)

  const editingDef = editingWidgetId ? doc.customWidgets.find((w) => w.id === editingWidgetId) ?? null : null
  const root = useEditor.getState().editRoot()
  const sel: WidgetNode[] = []
  walkNodes(root, (n) => {
    if (selectedIds.includes(n.id)) sel.push(n)
  })
  const ids = sel.map((n) => n.id)

  return (
    <div className="right" style={{ width }}>
      {editingDef && <DefInfo def={editingDef} />}
      {sel.length === 0 ? (
        <div className="prop-section">
          <h4>{editingDef ? '定制控件定义' : '工程信息'}</h4>
          {!editingDef && (
            <div className="prop-hint">
              工程：{doc.meta.name}
              <br />
              设计尺寸：{doc.meta.designWidth} × {doc.meta.designHeight}（
              {doc.meta.orientation === 'landscape' ? '横屏' : '竖屏'}）
              <br />
              页面数：{doc.pages.length} · 公共层控件：{doc.commonLayer.nodes.length} · 定制控件：
              {doc.customWidgets.length}
            </div>
          )}
          <div className="prop-hint">选中画布中的控件后，在此编辑属性。</div>
        </div>
      ) : (
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
          {sel.length === 1 && <AnchorEditor node={sel[0]} />}
        </div>
      )}
      {editingDef && <ExposedPropsEditor def={editingDef} selected={sel.length === 1 ? sel[0] : null} />}
      {editingDef && sel.length === 1 && <SlotEditor def={editingDef} node={sel[0]} />}
      {sel.length === 1 && !editingDef && <TypeProps node={sel[0]} defs={doc.customWidgets} />}
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

// ---------------------------------------------------------------------------
// 锚点（§6）
// ---------------------------------------------------------------------------

function AnchorEditor({ node }: { node: WidgetNode }) {
  const updateNodes = useEditor((s) => s.updateNodes)
  const a = node.anchor
  const set = (patch: { preset?: AnchorPreset; mode?: AnchorMode }) =>
    updateNodes([node.id], (n) => {
      const cur = n.anchor
      n.anchor = {
        preset: patch.preset ?? cur?.preset ?? 'tl',
        mode: patch.mode ?? cur?.mode ?? 'stretch'
      }
    })
  return (
    <div className="prop-section">
      <h4>锚点 / 适配（分辨率预览时生效）</h4>
      <div className="prop-row">
        <span>锚定</span>
        <div className="anchor-grid">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className={(a?.preset ?? '') === p.id ? 'on' : ''}
              title={PRESET_LABEL[p.id]}
              onClick={() => set({ preset: p.id })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="prop-row">
        <span>尺寸</span>
        <div className="seg">
          {(['fixed', 'stretch', 'aspect'] as const).map((m) => (
            <button key={m} className={(a?.mode ?? '') === m ? 'on' : ''} onClick={() => set({ mode: m })}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </div>
      <div className="prop-row">
        <span />
        <button
          className="mini-btn"
          disabled={!a}
          onClick={() =>
            updateNodes([node.id], (n) => {
              delete n.anchor
            })
          }
        >
          {a ? `清除锚点（当前：${PRESET_LABEL[a.preset]} · ${MODE_LABEL[a.mode]}）` : '未设置（随父等比）'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 定制控件：定义信息（发布设置）+ 暴露属性 + 插槽
// ---------------------------------------------------------------------------

function DefInfo({ def }: { def: CustomWidgetDef }) {
  const publish = useEditor((s) => s.publishCustomWidget)
  const [name, setName] = useState(def.name)
  const [group, setGroup] = useState(def.group)
  const [w, setW] = useState(def.w)
  const [h, setH] = useState(def.h)
  const [anchor, setAnchor] = useState(def.suggestAnchor ?? 'none')
  useEffect(() => {
    setName(def.name)
    setGroup(def.group)
    setW(def.w)
    setH(def.h)
    setAnchor(def.suggestAnchor ?? 'none')
  }, [def.id, def.name, def.group, def.w, def.h, def.suggestAnchor])
  return (
    <div className="prop-section">
      <h4>发布设置（改定义全局生效）</h4>
      <TextField label="名称" value={name} onCommit={setName} />
      <TextField label="分组" value={group} onCommit={setGroup} />
      <div className="grid-2">
        <NumField label="默认宽" value={w} min={8} onCommit={setW} />
        <NumField label="默认高" value={h} min={8} onCommit={setH} />
      </div>
      <div className="prop-row">
        <span>建议锚点</span>
        <div className="seg">
          {([['none', '无'], ['top-stretch', '顶部拉伸'], ['bottom-stretch', '底部拉伸']] as const).map(
            ([id, label]) => (
              <button key={id} className={anchor === id ? 'on' : ''} onClick={() => setAnchor(id)}>
                {label}
              </button>
            )
          )}
        </div>
      </div>
      <button
        className="tb-btn primary w-full"
        onClick={() => publish(def.id, { name, group, w, h, suggestAnchor: anchor })}
      >
        保存发布设置
      </button>
    </div>
  )
}

function defaultOfType(t: CustomPropType): string | number | boolean {
  return t === 'number' ? 0 : t === 'boolean' ? false : ''
}

function ExposedPropsEditor({ def, selected }: { def: CustomWidgetDef; selected: WidgetNode | null }) {
  const mutateWidget = useEditor((s) => s.mutateWidget)
  const [bindKey, setBindKey] = useState('')
  const [bindTo, setBindTo] = useState('__new')
  const [newName, setNewName] = useState('')
  const bindable = selected ? (BINDABLE_KEYS[selected.type] ?? []) : []
  useEffect(() => {
    setBindKey(bindable[0]?.key ?? '')
  }, [selected?.id, selected?.type])

  const selectedName = selected?.name ?? ''

  return (
    <div className="prop-section">
      <h4>暴露属性（实例只能改这些）</h4>
      {def.props.length === 0 && <div className="prop-hint">暂无。选中内部控件后，把它的属性绑定为暴露属性。</div>}
      {def.props.map((p) => (
        <div key={p.name} className="prop-sub">
          <div className="prop-row">
            <input
              type="text"
              value={p.name}
              title="属性名"
              onChange={(e) => {
                const old = p.name
                const next = e.target.value
                mutateWidget(def.id, (d) => {
                  const pp = d.props.find((x) => x.name === old)
                  if (pp) pp.name = next
                })
              }}
            />
            <select
              value={p.type}
              onChange={(e) =>
                mutateWidget(def.id, (d) => {
                  const pp = d.props.find((x) => x.name === p.name)
                  if (pp) {
                    pp.type = e.target.value as CustomPropType
                    pp.default = defaultOfType(pp.type)
                  }
                })
              }
            >
              <option value="string">文本</option>
              <option value="number">数字</option>
              <option value="boolean">开关</option>
              <option value="tab-index">页签下标</option>
            </select>
            <button
              className="mini-btn"
              title="删除暴露属性"
              onClick={() =>
                mutateWidget(def.id, (d) => {
                  d.props = d.props.filter((x) => x.name !== p.name)
                })
              }
            >
              ✕
            </button>
          </div>
          <div className="prop-row">
            <span>默认值</span>
            {p.type === 'boolean' ? (
              <input
                type="checkbox"
                checked={p.default === true}
                onChange={(e) =>
                  mutateWidget(def.id, (d) => {
                    const pp = d.props.find((x) => x.name === p.name)
                    if (pp) pp.default = e.target.checked
                  })
                }
              />
            ) : p.type === 'number' || p.type === 'tab-index' ? (
              <NumField
                label=""
                value={Number(p.default)}
                onCommit={(v) =>
                  mutateWidget(def.id, (d) => {
                    const pp = d.props.find((x) => x.name === p.name)
                    if (pp) pp.default = v
                  })
                }
              />
            ) : (
              <TextField
                label=""
                value={String(p.default)}
                onCommit={(v) =>
                  mutateWidget(def.id, (d) => {
                    const pp = d.props.find((x) => x.name === p.name)
                    if (pp) pp.default = v
                  })
                }
              />
            )}
          </div>
          {p.binds.map((b, bi) => {
            const target = findNodeById(def.tree, b.nodeId)
            return (
              <div key={bi} className="prop-row bind-row">
                <span className="bind-target">
                  「{target?.name ?? '?'}」· {BINDABLE_KEYS[target?.type ?? 'rect']?.find((k) => k.key === b.key)?.label ?? b.key}
                </span>
                <button
                  className="mini-btn"
                  title="解除绑定"
                  onClick={() =>
                    mutateWidget(def.id, (d) => {
                      const pp = d.props.find((x) => x.name === p.name)
                      if (pp) pp.binds = pp.binds.filter((_, i) => i !== bi)
                    })
                  }
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      ))}
      <button
        className="tb-btn w-full"
        onClick={() =>
          mutateWidget(def.id, (d) => {
            d.props.push({ name: `属性${d.props.length + 1}`, type: 'string', default: '', binds: [] })
          })
        }
      >
        ＋ 添加暴露属性
      </button>
      {selected && bindable.length > 0 && (
        <div className="bind-form">
          <div className="prop-hint">把选中节点「{selectedName}」的属性绑定到暴露属性：</div>
          <div className="prop-row">
            <span>属性</span>
            <select value={bindKey} onChange={(e) => setBindKey(e.target.value)}>
              {bindable.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="prop-row">
            <span>绑定到</span>
            <select value={bindTo} onChange={(e) => setBindTo(e.target.value)}>
              <option value="__new">（新建暴露属性）</option>
              {def.props.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {bindTo === '__new' && (
            <div className="prop-row">
              <span>新属性名</span>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如 label" />
            </div>
          )}
          <button
            className="tb-btn primary w-full"
            disabled={!bindKey}
            onClick={() => {
              const key = bindKey
              const nodeId = selected.id
              const guessType: CustomPropType =
                key === 'fontSize' || key === 'progress' || key === 'selected'
                  ? 'number'
                  : key === 'checked'
                    ? 'boolean'
                    : key === 'activeTab'
                      ? 'tab-index'
                      : 'string'
              const guessDefault =
                key === 'activeTab'
                  ? 0
                  : key === 'checked'
                    ? Boolean((selected.props as Record<string, unknown>)[key])
                    : key === 'text' || key === 'placeholder' || key === 'title'
                      ? String((selected.props as Record<string, unknown>)[key] ?? '')
                      : Number((selected.props as Record<string, unknown>)[key] ?? 0)
              mutateWidget(def.id, (d) => {
                if (bindTo === '__new') {
                  const name = newName.trim()
                  if (!name) return
                  d.props.push({ name, type: guessType, default: guessDefault, binds: [{ nodeId, key }] })
                } else {
                  const pp = d.props.find((x) => x.name === bindTo)
                  if (pp) pp.binds.push({ nodeId, key })
                }
              })
              setNewName('')
            }}
          >
            绑定
          </button>
        </div>
      )}
    </div>
  )
}

function SlotEditor({ def, node }: { def: CustomWidgetDef; node: WidgetNode }) {
  const mutateWidget = useEditor((s) => s.mutateWidget)
  const isTab = node.type === 'tab'
  const marked = def.slotNodeIds?.includes(node.id) ?? false
  if (!isTab && !(node.type === 'panel' || node.type === 'dialog' || node.type === 'scroll')) return null
  return (
    <div className="prop-section">
      <h4>插槽（§5.5）</h4>
      {isTab ? (
        <div className="prop-hint">Tab 容器的每个页签默认就是一个具名插槽，实例可分别往里放内容。</div>
      ) : (
        <>
          <div className="prop-hint">
            开放为插槽后，实例可往该容器内容区挂自己的子控件（定义中的固定内容保留）。
          </div>
          <button
            className="tb-btn w-full"
            onClick={() =>
              mutateWidget(def.id, (d) => {
                const cur = d.slotNodeIds ?? []
                d.slotNodeIds = marked ? cur.filter((x) => x !== node.id) : [...cur, node.id]
              })
            }
          >
            {marked ? '✓ 已开放为插槽（点击取消）' : '开放为插槽'}
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 控件属性（逐类型）
// ---------------------------------------------------------------------------

function TypeProps({ node, defs }: { node: WidgetNode; defs: CustomWidgetDef[] }) {
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

  if (node.type === 'custom') return <CustomProps node={node} defs={defs} />

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
    case 'dialog':
      return (
        <div className="prop-section">
          <h4>弹窗</h4>
          <TextField label="标题" value={p.title ?? ''} onCommit={(v) => setProp({ title: v })} />
          <div className="prop-hint">把控件拖到标题栏以下的内容区即成为弹窗子控件。</div>
        </div>
      )
    case 'list':
    case 'grid': {
      const count = p.count ?? 4
      return (
        <div className="prop-section">
          <h4>{node.type === 'list' ? '列表' : '网格'}</h4>
          <NumField
            label="项数"
            value={count}
            min={0}
            max={200}
            onCommit={(v) =>
              updateNodes(id, (n) => {
                n.props.count = v
                const tags = [...(n.itemTags ?? [])]
                n.itemTags = tags.slice(0, v).concat(Array(Math.max(0, v - tags.length)).fill('') as string[])
              })
            }
          />
          {node.type === 'grid' && (
            <NumField label="列数" value={p.cols ?? 3} min={1} max={20} onCommit={(v) => setProp({ cols: v })} />
          )}
          {node.type === 'list' && (
            <div className="prop-row">
              <span>方向</span>
              <div className="seg">
                <button className={(p.direction ?? 'v') === 'v' ? 'on' : ''} onClick={() => setProp({ direction: 'v' })}>
                  纵向
                </button>
                <button className={p.direction === 'h' ? 'on' : ''} onClick={() => setProp({ direction: 'h' })}>
                  横向
                </button>
              </div>
            </div>
          )}
          <TextField
            label="项标记"
            value={(node.itemTags ?? []).join('\n')}
            multiline
            onCommit={(v) =>
              updateNodes(id, (n) => {
                const lines = v.split('\n')
                n.itemTags = Array.from({ length: n.props.count ?? 0 }, (_, i) => lines[i]?.trim() ?? '')
              })
            }
          />
          <div className="prop-hint">项标记：每行一项（如 英雄 / 部队），供筛选器按标记键过滤（预览时生效）。</div>
        </div>
      )
    }
    case 'filter': {
      const options = p.options?.length ? p.options : ['全部']
      const root = useEditor.getState().editRoot()
      const targets: WidgetNode[] = []
      walkNodes(root, (n) => {
        if ((n.type === 'list' || n.type === 'grid') && n.id !== node.id) targets.push(n)
      })
      return (
        <div className="prop-section">
          <h4>筛选器</h4>
          <TextField
            label="标签列表"
            value={options.join('\n')}
            multiline
            onCommit={(v) => {
              const lines = v.split('\n').map((s) => s.trim()).filter((s) => s.length > 0)
              const next = lines.length ? lines : ['全部']
              updateNodes(id, (n) => {
                n.props.options = next
                n.props.selected = Math.min(n.props.selected ?? 0, next.length - 1)
              })
            }}
          />
          <div className="prop-row">
            <span>选中项</span>
            <div className="seg">
              {options.map((_, i) => (
                <button
                  key={i}
                  className={(p.selected ?? 0) === i ? 'on' : ''}
                  onClick={() => setProp({ selected: i })}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div className="prop-row">
            <span>绑定目标</span>
            <select
              value={node.binding?.target ?? ''}
              onChange={(e) =>
                updateNodes(id, (n) => {
                  if (!e.target.value) delete n.binding
                  else n.binding = { target: e.target.value, tagKey: n.binding?.tagKey ?? 'kind' }
                })
              }
            >
              <option value="">（未绑定）</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {node.binding && (
            <TextField
              label="标记键"
              value={node.binding.tagKey}
              onCommit={(v) =>
                updateNodes(id, (n) => {
                  if (n.binding) n.binding.tagKey = v
                })
              }
            />
          )}
          <div className="prop-hint">预览时点选标签，只显示绑定列表 / 网格中标记匹配的项（M3 预览实现）。</div>
        </div>
      )
    }
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
              <button className={p.barPosition === 'bottom' ? 'on' : ''} onClick={() => setProp({ barPosition: 'bottom' })}>
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

/** 定制控件实例：只覆盖暴露属性 / 挂插槽（§5.2） */
function CustomProps({ node, defs }: { node: WidgetNode; defs: CustomWidgetDef[] }) {
  const updateNodes = useEditor((s) => s.updateNodes)
  const setEditingWidget = useEditor((s) => s.setEditingWidget)
  const detachInstance = useEditor((s) => s.detachInstance)
  const def = defs.find((d) => d.id === node.customId)
  if (!def) {
    return (
      <div className="prop-section">
        <div className="prop-hint">定义已被删除。可删除该实例，或打散为普通组合保留外观。</div>
        <button className="tb-btn w-full" onClick={() => detachInstance(node.id)}>
          打散为普通组合
        </button>
      </div>
    )
  }
  return (
    <div className="prop-section">
      <h4>定制控件「{def.name}」</h4>
      {def.props.length === 0 && <div className="prop-hint">该控件未声明暴露属性。</div>}
      {def.props.map((p) => {
        const value = node.overrides?.[p.name] !== undefined ? node.overrides[p.name] : p.default
        const commit = (v: string | number | boolean) =>
          updateNodes([node.id], (n) => {
            if (!n.overrides) n.overrides = {}
            n.overrides[p.name] = v
          })
        if (p.type === 'boolean') {
          return (
            <div key={p.name} className="prop-row">
              <span>{p.name}</span>
              <input type="checkbox" checked={value === true} onChange={(e) => commit(e.target.checked)} />
            </div>
          )
        }
        if (p.type === 'number' || p.type === 'tab-index') {
          return (
            <NumField key={p.name} label={p.name} value={Number(value)} onCommit={(v) => commit(v)} />
          )
        }
        return <TextField key={p.name} label={p.name} value={String(value)} onCommit={(v) => commit(v)} />
      })}
      <div className="prop-hint">插槽：把控件直接拖到实例的插槽区域即可挂入（属实例，不属定义）。</div>
      <button className="tb-btn w-full" onClick={() => setEditingWidget(def.id)}>
        编辑定义（改一处全局生效）
      </button>
      <button className="tb-btn w-full" onClick={() => detachInstance(node.id)}>
        打散为普通组合
      </button>
    </div>
  )
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
