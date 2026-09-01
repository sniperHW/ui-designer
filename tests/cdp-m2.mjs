// M2 专项测试：容器全集 + 锚点/分辨率预览 + 定制控件全链路（创建/暴露属性/插槽/同步/打散）
const BASE = 'http://localhost:9222'
async function main() {
  let targets = null
  for (let i = 0; i < 20; i++) {
    try {
      targets = await (await fetch(BASE + '/json')).json()
      break
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  const page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  }
  const call = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, (m) => (m.error ? rej(new Error(method)) : res(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evalJs = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval 失败: ' + expression.slice(0, 120) + ' / ' + (r.exceptionDetails.exception?.description ?? '').slice(0, 200))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const results = {}
  const check = (name, ok, detail) => {
    results[name] = ok ? '✓ ' + detail : '✗ ' + detail
    if (!ok) process.exitCode = 1
  }

  // 阻断弹窗（循环引用提示 / 删除确认）
  await evalJs(`(() => { window.alert = () => {}; window.confirm = () => true; return true })()`)

  const defs = await evalJs('window.__uiwDefs')
  const D = (label) => defs.find((d) => d.label === label)

  // ============ 准备 ============
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.newProject({ name: 'M2 测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })
    st.setCurrentPage(0)
    return true
  })()`)

  // ============ 一、其余内置容器 ============
  // 1. 面板 / 滚动区 / 列表 / 网格 入场；弹窗只入弹窗页（§8：弹窗独立设计、点击弹出）
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.addWidget(${JSON.stringify(D('面板'))}, 300, 200)
    st.addWidget(${JSON.stringify(D('滚动区'))}, 300, 550)
    st.addWidget(${JSON.stringify(D('列表'))}, 750, 550)
    st.addWidget(${JSON.stringify(D('网格'))}, 1050, 550)
    st.addWidget(${JSON.stringify(D('弹窗'))}, 900, 200)
    return true
  })()`)
  await sleep(300)
  const containers = await evalJs(`(() => {
    const ns = window.__uiw.getState().currentPage().nodes
    return ns.map((n) => n.type)
  })()`)
  check('容器入场+弹窗拦截', ['panel', 'scroll', 'list', 'grid'].every((t) => containers.includes(t)) && !containers.includes('dialog'),
    `页面 types=[${containers}]（弹窗控件被拦截，只入弹窗页）`)
  const popupIn = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const id = st.addPopup()
    st.addWidget(${JSON.stringify(D('弹窗'))}, 900, 200)
    const s2 = window.__uiw.getState()
    return { editing: s2.editingPopupId === id, dialogs: s2.doc.popups[0].nodes.filter(n => n.type === 'dialog').length }
  })()`)
  check('弹窗入弹窗页', popupIn.editing === true && popupIn.dialogs >= 2,
    `弹窗页内 dialog 数=${popupIn.dialogs}（自带 1 + 新拖 1），已切入编辑=${popupIn.editing}`)
  await evalJs(`(() => { const st = window.__uiw.getState(); st.setEditingPopup(null); st.setCurrentPage(0); return true })()`)

  // 2. 拖入按钮到面板内容区 → 成为面板 children
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const p = st.currentPage().nodes[0]
    st.addWidget(${JSON.stringify(D('按钮'))}, p.x + p.w / 2, p.y + p.h / 2)
    return true
  })()`)
  await sleep(250)
  const panelChild = await evalJs(`(() => {
    const p = window.__uiw.getState().currentPage().nodes[0]
    return { top: window.__uiw.getState().currentPage().nodes.length, child: p.children?.[0]?.type ?? null }
  })()`)
  check('面板挂子控件', panelChild.child === 'button' && panelChild.top === 4, `顶层=${panelChild.top}，面板子=${panelChild.child}`)

  // 3. 面板移动 → 子控件联动
  const beforeMove = await evalJs(`(() => { const p = window.__uiw.getState().currentPage().nodes[0]; return p.children[0].x })()`)
  await evalJs(`(() => { const st = window.__uiw.getState(); const p = st.currentPage().nodes[0]; st.updateNodes([p.id], n => { n.x += 10 }, true); return true })()`)
  const panelMoved = await evalJs(`(() => { const p = window.__uiw.getState().currentPage().nodes[0]; return { px: p.x, cx: p.children[0].x } })()`)
  check('容器移动联动', panelMoved.cx === beforeMove + 10, `面板 +10 后子控件 x：${beforeMove}→${panelMoved.cx}`)

  // 4. 列表项数 + 项标记；网格列数
  const listGrid = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const ns = st.currentPage().nodes
    const list = ns.find(n => n.type === 'list')
    const grid = ns.find(n => n.type === 'grid')
    st.updateNodes([list.id], n => { n.props.count = 3; n.itemTags = ['英雄', '部队', ''] })
    st.updateNodes([grid.id], n => { n.props.cols = 4 })
    const l2 = window.__uiw.getState().currentPage().nodes.find(n => n.type === 'list')
    const g2 = window.__uiw.getState().currentPage().nodes.find(n => n.type === 'grid')
    return { count: l2.props.count, tags: l2.itemTags, cols: g2.props.cols }
  })()`)
  check('列表项数/标记', listGrid.count === 3 && listGrid.tags?.[0] === '英雄' && listGrid.tags?.[1] === '部队', `count=${listGrid.count} tags=[${listGrid.tags}]`)
  check('网格列数', listGrid.cols === 4, `cols=${listGrid.cols}`)

  // 5. 筛选器：入场 + 绑定列表（标记键）——落点选在所有容器之外
  const filterBind = await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.addWidget(${JSON.stringify(D('筛选器'))}, 100, 40)
    st.addWidget(${JSON.stringify(D('列表'))}, 100, 400)
    const ns = window.__uiw.getState().currentPage().nodes
    const f = ns.find(n => n.type === 'filter' && !n.binding)
    const list = ns.find(n => n.type === 'list' && n.y > 380)
    st.updateNodes([f.id], n => { n.binding = { target: list.id, tagKey: 'kind' } })
    const f2 = window.__uiw.getState().currentPage().nodes.find(n => n.id === f.id)
    return { opts: f2.props.options, sel: f2.props.selected, bound: !!f2.binding && f2.binding.target === list.id }
  })()`)
  check('筛选器入场', filterBind.opts?.length === 4, `options=[${filterBind.opts}]`)
  check('筛选绑定', filterBind.bound === true, `binding.target=列表，tagKey=kind`)

  // ============ 二、锚点 + 分辨率预览（§6） ============
  // 清场，摆两个矩形：A 无锚点（随父拉伸），B 左上锚定固定尺寸
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setSelection([])
    st.selectAll()
    st.deleteSelected()
    st.addWidget(${JSON.stringify(D('矩形'))}, 300, 300)
    st.addWidget(${JSON.stringify(D('矩形'))}, 700, 300)
    const ns = window.__uiw.getState().currentPage().nodes
    st.updateNodes([ns[1].id], n => { n.anchor = { preset: 'tl', mode: 'fixed' } })
    st.updateNodes([ns[0].id], n => { n.props.radius = 0 })
    return true
  })()`)
  await sleep(250)
  await evalJs(`(() => { window.__uiw.getState().setPreviewRatio('18:9'); return true })()`)
  await sleep(300)
  const previewGeom = await evalJs(`(() => {
    const board = document.querySelector('.canvas-svg g rect')
    const gs = [...document.querySelectorAll('g[data-id]')]
    const h = (g) => g.querySelector('rect')?.getAttribute('height')
    return { bw: +board.getAttribute('width'), bh: +board.getAttribute('height'), badge: !!document.querySelector('.preview-badge'), hs: gs.map(h) }
  })()`)
  check('预览画板', previewGeom.bw === 1334 && Math.abs(previewGeom.bh - 667) <= 1, `画板 ${previewGeom.bw}×${previewGeom.bh}`)
  check('预览只读标识', previewGeom.badge === true, '显示只读预览标识')
  // A 高 90*667/750=80；B 固定 90
  const hA = +previewGeom.hs[0]
  const hB = +previewGeom.hs[1]
  check('锚点重排', Math.abs(hA - 80) <= 1 && hB === 90, `无锚点 h=${hA}（≈80），tl 固定 h=${hB}（=90）`)
  await evalJs(`(() => { window.__uiw.getState().setPreviewRatio('design'); return true })()`)
  await sleep(200)

  // ============ 三、定制控件全链路（§5） ============
  // 6. 搭组合（按钮文字"确定"）→ 存为定制控件 → 原位替换为实例
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setSelection([])
    st.selectAll()
    st.deleteSelected()
    st.addWidget(${JSON.stringify(D('按钮'))}, 300, 300)
    const ns = window.__uiw.getState().currentPage().nodes
    st.updateNodes([ns[0].id], n => { n.props.text = '确定' })
    st.setSelection([ns[0].id])
    st.saveSelectionAsCustom()
    return true
  })()`)
  await sleep(300)
  const saved = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const def = st.doc.customWidgets[0]
    const n = st.currentPage().nodes[0]
    return { defs: st.doc.customWidgets.length, nodeType: n.type, customId: n.customId === def.id, dom: document.querySelectorAll('g[data-id]').length, textOk: document.querySelector('.canvas-svg').innerHTML.includes('确定') }
  })()`)
  check('存为定制控件', saved.defs === 1 && saved.nodeType === 'custom' && saved.customId, `定义=1，页面节点 type=${saved.nodeType}`)
  check('实例原位渲染', saved.dom === 1 && saved.textOk, `画布 g=1，按钮文字"确定"已渲染`)

  // 7. 库中点击再实例化一个（含滚动定位）
  const libC = await evalJs(`(() => {
    const items = [...document.querySelectorAll('.lib-item')]
    const el = items.find(i => i.textContent.includes('定制控件 1'))
    if (!el) return null
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2 - 30, y: r.y + r.height / 2 }
  })()`)
  if (libC) {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: libC.x, y: libC.y, button: 'left', buttons: 1, clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: libC.x, y: libC.y, button: 'left', buttons: 1, clickCount: 1 })
    await sleep(300)
  }
  const twoInstances = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { count: st.currentPage().nodes.filter(n => n.type === 'custom').length, libItems: document.querySelectorAll('.lib-item.custom-item').length }
  })()`)
  check('库中实例化', twoInstances.count === 2 && twoInstances.libItems >= 1, `页面实例=${twoInstances.count}，库条目=${twoInstances.libItems}`)

  // 8. 编辑定义 → 全局同步：定义里按钮文字改"好了"
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setEditingWidget(st.doc.customWidgets[0].id)
    const tree = window.__uiw.getState().doc.customWidgets[0].tree
    window.__uiw.getState().updateNodes([tree[0].id], n => { n.props.text = '好了' })
    return true
  })()`)
  await sleep(250)
  const editing = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { editing: st.editingWidgetId, badge: document.body.textContent.includes('正在编辑定制控件'), treeText: st.doc.customWidgets[0].tree[0].props.text }
  })()`)
  check('切入定义编辑', editing.editing && editing.badge, '画布显示"正在编辑定制控件"标识')
  await evalJs(`(() => { window.__uiw.getState().setEditingWidget(null); return true })()`)
  await sleep(250)
  const synced = await evalJs(`(() => document.querySelector('.canvas-svg').innerHTML.split('好了').length - 1)()`)
  check('改定义全局生效', synced === 2, `两个实例均显示"好了"（出现 ${synced} 处）`)

  // 9. 暴露属性：定义里按钮 text 绑定为 label；实例覆盖
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const def = st.doc.customWidgets[0]
    const btnId = def.tree[0].id
    st.mutateWidget(def.id, d => { d.props.push({ name: 'label', type: 'string', default: '好了', binds: [{ nodeId: btnId, key: 'text' }] }) })
    const inst = st.currentPage().nodes.find(n => n.type === 'custom')
    st.updateNodes([inst.id], n => { n.overrides = { label: '取消' } })
    return true
  })()`)
  await sleep(250)
  const overridden = await evalJs(`(() => {
    const html = document.querySelector('.canvas-svg').innerHTML
    return { hasCancel: html.includes('取消'), otherStillDefault: (html.split('好了').length - 1) === 1 }
  })()`)
  check('暴露属性覆盖', overridden.hasCancel && overridden.otherStillDefault, '实例 1 显示"取消"，实例 2 仍为默认"好了"')

  // 10. 以 Tab 为骨架新建（页签默认插槽）→ 实例化 → 往插槽拖控件
  const slotDef = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const id = st.createCustomWidget({ kind: 'tab', tabs: ['甲', '乙'], barPosition: 'top' })
    st.setEditingWidget(null)
    st.addWidgetCustom(id, 660, 500)
    const st2 = window.__uiw.getState()
    const def = st2.doc.customWidgets.find(w => w.id === id)
    const inst = st2.currentPage().nodes.find(n => n.type === 'custom' && n.customId === id)
    return { id, tabId: def.tree[0].id, instId: inst.id, ix: inst.x, iy: inst.y }
  })()`)
  await sleep(250)
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    // 定义树 Tab 在 (40,40,480,320)，实例 1:1 → 内容区中心 ≈ (ix+280, iy+200)
    st.addWidget(${JSON.stringify(D('文本'))}, ${slotDef.ix + 280}, ${slotDef.iy + 200})
    return true
  })()`)
  await sleep(250)
  const slotState = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const inst = st.currentPage().nodes.find(n => n.id === ${JSON.stringify(slotDef.instId)})
    const keys = Object.keys(inst.slots ?? {})
    return { keys, type: inst.slots?.[keys[0]]?.[0]?.type, dom: document.querySelectorAll('g[data-id]').length }
  })()`)
  check('插槽挂载', slotState.keys?.[0] === `${slotDef.tabId}:0` && slotState.type === 'text',
    `插槽键=${slotState.keys?.[0]}，内容=${slotState.type}`)

  // 11. 打散实例：Tab 上提为普通节点，插槽子控件并入页签 0
  await evalJs(`(() => { window.__uiw.getState().detachInstance(${JSON.stringify(slotDef.instId)}); return true })()`)
  await sleep(300)
  const detached = await evalJs(`(() => {
    const ns = window.__uiw.getState().currentPage().nodes
    const tab = ns.find(n => n.type === 'tab' && n.props.tabs?.[0] === '甲')
    return { hasTab: !!tab, noCustom: !ns.some(n => n.id === ${JSON.stringify(slotDef.instId)}), childInTab: tab?.pages?.[0]?.[0]?.type === 'text', all: ns.map(n => n.type) }
  })()`)
  check('打散为普通组合', detached.hasTab && detached.childInTab, `类型=[${detached.all}]，插槽子控件已并入页签 1`)

  // 12. 循环引用拦截：编辑定义 A 时，不能把 A 自己拖进去
  const cycle = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const before = st.doc.customWidgets[0].tree.length
    st.setEditingWidget(st.doc.customWidgets[0].id)
    st.addWidgetCustom(st.doc.customWidgets[0].id, 200, 200)
    const after = window.__uiw.getState().doc.customWidgets[0].tree.length
    window.__uiw.getState().setEditingWidget(null)
    return { before, after }
  })()`)
  check('禁止循环引用', cycle.before === cycle.after, `定义树 ${cycle.before}→${cycle.after}（未变）`)

  // 13. 建议锚点：清场 → 发布"底部导航"（bottom-stretch）→ 实例化自动贴底 + 拉伸锚点
  const suggest = await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setSelection([]); st.selectAll(); st.deleteSelected()
    const def = st.doc.customWidgets[0]
    st.publishCustomWidget(def.id, { name: '底部导航', group: '导航', w: def.w, h: 120, suggestAnchor: 'bottom-stretch' })
    st.addWidgetCustom(def.id, 600, 600)
    const inst = window.__uiw.getState().currentPage().nodes.filter(n => n.type === 'custom').pop()
    return { y: inst.y, w: inst.w, anchor: inst.anchor, name: inst.name }
  })()`)
  check('建议锚点贴底', suggest.y === 750 - 120 && suggest.w === 1334 && suggest.anchor?.preset === 'bc',
    `y=${suggest.y}，w=${suggest.w}，锚点=${suggest.anchor?.preset}`)

  // 14. 删除定义 → 实例显示占位框
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const defId = st.doc.customWidgets[0].id
    st.deleteCustomWidget(defId)
    return true
  })()`)
  await sleep(250)
  const deleted = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { defs: st.doc.customWidgets.length, placeholder: document.querySelector('.canvas-svg').innerHTML.includes('定义已删除') }
  })()`)
  check('删除定义影响范围', deleted.defs >= 1 && deleted.placeholder, `剩余定义=${deleted.defs}，被删实例显示占位框`)

  // 15. 保存/打开兼容：doc 含 customWidgets 字段
  const docShape = await evalJs(`(() => { const d = window.__uiw.getState().doc; return { has: Array.isArray(d.customWidgets) } })()`)
  check('文档结构', docShape.has === true, 'doc.customWidgets 数组就位')

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
