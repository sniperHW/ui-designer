// 点击交互专项测试：可点击控件（按钮 / 自定义开启）+ 点击效果（切换页面 / 弹窗）+ 右键菜单
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
    if (r.exceptionDetails) throw new Error('eval 失败: ' + expression.slice(0, 100))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const click = async (x, y) => {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 1, clickCount: 1 })
  }
  const rclick = async (x, y) => {
    await call('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'right', buttons: 2, clickCount: 1 })
    await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'right', buttons: 2, clickCount: 1 })
  }
  const results = {}
  const check = (name, ok, detail) => {
    results[name] = ok ? '✓ ' + detail : '✗ ' + detail
    if (!ok) process.exitCode = 1
  }
  /** 文档坐标 → 屏幕坐标 */
  const toScreen = async (docX, docY) => {
    const geo = await evalJs(`(() => {
      const v = window.__uiw.getState().viewport
      const r = document.querySelector('.canvas-wrap').getBoundingClientRect()
      return { x: r.x, y: r.y, panX: v.panX, panY: v.panY, zoom: v.zoom }
    })()`)
    return { x: geo.x + geo.panX + docX * geo.zoom, y: geo.y + geo.panY + docY * geo.zoom }
  }
  const ctxItems = () => evalJs(`(() => [...document.querySelectorAll('.ctx-menu .ctx-item')].map(i => i.textContent.trim()))()`)

  // —— 准备：新工程（2 页），回到页面 1 并清空 ——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.newProject({ name: '点击测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })
    st.addPage()
    st.setCurrentPage(0)
    return true
  })()`)
  await sleep(200)

  // —— 1. 页面 1 放一个按钮（天生可点击，暂不配效果）——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.addWidget(window.__uiwDefs.find(d => d.type === 'button'), 400, 375)
    return true
  })()`)
  await sleep(200)
  const btn = await evalJs(`window.__uiw.getState().currentPage().nodes[0]`)
  check('添加按钮', btn?.type === 'button', `type=${btn?.type}`)

  // —— 2. 属性面板「点击」区：按钮显示效果配置（无「可点击」开关）——
  await evalJs(`(() => { window.__uiw.getState().setSelection(['${btn.id}']); return true })()`)
  await sleep(200)
  const clickSec = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    if (!sec) return null
    return { hasCheckbox: !!sec.querySelector('input[type=checkbox]'), hasSeg: !!sec.querySelector('.seg') }
  })()`)
  check('属性面板点击区', clickSec?.hasCheckbox === false && clickSec?.hasSeg === true,
    `按钮天生可点击（无开关=${clickSec?.hasCheckbox === false}，效果选择=${clickSec?.hasSeg})`)

  // —— 3. 右键按钮 → 菜单（删除 + 点击·未配置效果且禁用）——
  let pt = await toScreen(btn.x + btn.w / 2, btn.y + btn.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  let items = await ctxItems()
  check('右键弹出菜单', items.length === 2, `菜单项=[${items}]`)
  check('未配置点击禁用', items.length === 2 && items[1].includes('未配置效果'),
    `第 2 项="${items[1]}"`)
  const disabledItem = await evalJs(`!!document.querySelector('.ctx-menu .ctx-item.disabled')`)
  check('禁用态渲染', disabledItem === true, '未配置效果的点击项为禁用态')
  // 左键点空白处收起菜单
  const blank = await toScreen(60, 700)
  await click(blank.x, blank.y)
  await sleep(200)
  const closedByOutside = await evalJs(`!document.querySelector('.ctx-menu')`)
  check('点外收起菜单', closedByOutside === true, '点击菜单外后菜单关闭')

  // —— 4. 配置 goto 效果 → 右键「点击」→ 切换到页面 2 ——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.updateNodes(['${btn.id}'], n => { n.clickAction = { type: 'goto', target: st.doc.pages[1].id } })
    return true
  })()`)
  await sleep(150)
  pt = await toScreen(btn.x + btn.w / 2, btn.y + btn.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  check('菜单显示效果', items[1]?.includes('跳转「页面 2」'), `点击项="${items[1]}"`)
  const gotoLabel = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(gotoLabel.x, gotoLabel.y)
  await sleep(250)
  const afterGoto = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { page: st.currentPageIndex, menu: !!document.querySelector('.ctx-menu') }
  })()`)
  check('点击跳转页面', afterGoto.page === 1 && !afterGoto.menu, `currentPageIndex=${afterGoto.page}/1，菜单已关=${!afterGoto.menu}`)

  // —— 5. 弹窗独立设计：普通页面禁止弹窗控件，弹窗在独立弹窗页中设计 ——
  // 5a. 弹窗拖入普通页面 → 拦截并提示
  const blocked = await evalJs(`(() => {
    window.__alertMsgs = []
    window.alert = (m) => { window.__alertMsgs.push(String(m)) }
    const st = window.__uiw.getState()
    st.setCurrentPage(0)
    const before = st.currentPage().nodes.length
    st.addWidget(window.__uiwDefs.find(d => d.type === 'dialog'), 900, 375)
    const s2 = window.__uiw.getState()
    return { before, after: s2.currentPage().nodes.length, msg: window.__alertMsgs[0] ?? '' }
  })()`)
  check('弹窗禁入普通页', blocked.before === blocked.after && blocked.msg.includes('弹窗页'),
    `页面节点 ${blocked.before}→${blocked.after}，提示「${blocked.msg.slice(0, 16)}…」`)

  // 5b. 新建弹窗页（自带居中弹窗）→ 自动切入弹窗编辑
  const pp = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const id = st.addPopup()
    const s2 = window.__uiw.getState()
    const p = s2.doc.popups.find((x) => x.id === id)
    return { id, name: p.name, types: p.nodes.map((n) => n.type), editing: s2.editingPopupId === id, dlg: p.nodes[0],
      title: p.nodes[0].props.title }
  })()`)
  check('新建弹窗页', pp.types[0] === 'dialog' && pp.editing === true && pp.title === pp.name,
    `弹窗页「${pp.name}」自带 dialog=${pp.types[0]}，已切入编辑=${pp.editing}，标题栏同步=${pp.title === pp.name}`)

  // 5b2. 弹窗标题 ↔ 页名同步：改本体「标题」→ 页名与左侧列表跟随
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const dlg = st.editRoot().find(n => n.type === 'dialog')
    st.setSelection([dlg.id])
    return true
  })()`)
  await sleep(200)
  await evalJs(`(() => {
    const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector('span')?.textContent === '标题')
    const input = row.querySelector('input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '确认弹窗')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(150)
  await evalJs(`(() => {
    const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector('span')?.textContent === '标题')
    const input = row.querySelector('input')
    input.focus()
    input.blur()
    return true
  })()`)
  await sleep(250)
  const titleSync = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const p = st.doc.popups[0]
    return {
      name: p.name,
      title: p.nodes.find(n => n.type === 'dialog').props.title,
      listText: [...document.querySelectorAll('.popup-row .page-name')].map(e => e.textContent.trim()).join(',')
    }
  })()`)
  check('标题页名同步', titleSync.name === '确认弹窗' && titleSync.title === '确认弹窗' && titleSync.listText.includes('确认弹窗'),
    `改标题后页名="${titleSync.name}"，标题栏="${titleSync.title}"，列表=[${titleSync.listText}]`)

  // 5c. 弹窗页内往弹窗内容区加按钮（编辑目标 = 弹窗页）
  const popupEdit = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const dlg = st.editRoot()[0]
    st.addWidget(window.__uiwDefs.find(d => d.type === 'button'), dlg.x + dlg.w / 2, dlg.y + 48 + 110)
    const d2 = window.__uiw.getState().editRoot()[0]
    return { child: d2.children?.[0]?.type ?? null }
  })()`)
  check('弹窗内容可编辑', popupEdit.child === 'button', `弹窗 children[0]=${popupEdit.child}`)

  // 5c2. 弹窗页内选中弹窗控件 → 高亮框 + 8 向缩放手柄（编辑目标须包含弹窗页）
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const dlg = st.editRoot().find(n => n.type === 'dialog')
    st.setSelection([dlg.id])
    return true
  })()`)
  await sleep(250)
  const overlay1 = await evalJs(`(() => {
    const box = document.querySelector('.sel-box')
    return { has: !!box, handles: document.querySelectorAll('.sel-handle').length }
  })()`)
  check('弹窗选中高亮', overlay1.has === true && overlay1.handles === 8,
    `高亮框=${overlay1.has}，缩放手柄=${overlay1.handles}/8`)

  // 5c3. 拖右下角手柄伸缩弹窗
  const dlgBefore = await evalJs(`window.__uiw.getState().editRoot().find(n => n.type === 'dialog')`)
  const seHandle = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.sel-handle')].find(h => h.style.left === '100%' && h.style.top === '100%')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: seHandle.x, y: seHandle.y, button: 'left', buttons: 1, clickCount: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: seHandle.x + 50, y: seHandle.y + 40, button: 'left', buttons: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: seHandle.x + 50, y: seHandle.y + 40, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(250)
  const dlgAfter = await evalJs(`window.__uiw.getState().editRoot().find(n => n.type === 'dialog')`)
  check('弹窗手柄伸缩', dlgAfter.w > dlgBefore.w && dlgAfter.h > dlgBefore.h,
    `弹窗 w ${dlgBefore.w}→${dlgAfter.w}，h ${dlgBefore.h}→${dlgAfter.h}`)

  // 5c4. 弹窗页内右键弹窗本体 → 不弹菜单（弹窗本体即弹窗本身，不提供删除；删整个弹窗走弹窗列表 ✕）
  const bodyPt = await toScreen(dlgAfter.x + dlgAfter.w / 2, dlgAfter.y + 24)
  await rclick(bodyPt.x, bodyPt.y)
  await sleep(250)
  const noMenuOnBody = await evalJs(`!document.querySelector('.ctx-menu')`)
  check('弹窗本体无删除项', noMenuOnBody === true, '右键弹窗本体不弹删除菜单')

  // 5c5. Delete 键 / deleteSelected 同样不删弹窗本体
  const bodyKept = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const dlg = st.editRoot().find(n => n.type === 'dialog')
    st.setSelection([dlg.id])
    st.deleteSelected()
    return !!window.__uiw.getState().editRoot().find(n => n.type === 'dialog')
  })()`)
  check('弹窗本体删除保护', bodyKept === true, 'deleteSelected 跳过弹窗本体')

  // 5c6. 右键弹窗内容子控件 → 仍可删除
  const childGeo = await evalJs(`(() => {
    const d = window.__uiw.getState().editRoot().find(n => n.type === 'dialog')
    const b = d.children[0]
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  })()`)
  const cpt = await toScreen(childGeo.x, childGeo.y)
  await rclick(cpt.x, cpt.y)
  await sleep(250)
  const childMenu = await evalJs(`(() => {
    const items = [...document.querySelectorAll('.ctx-menu .ctx-item')]
    // 弹窗页内子控件：删除可用；按钮天生可点击 → 附加「点击」项（未配置效果时禁用）
    return items.length === 2 && items[0].textContent.includes('删除') &&
      items[1].textContent.includes('点击') && items[1].className.includes('disabled')
  })()`)
  check('内容控件可删除', childMenu === true, '右键弹窗内容子控件仍提供删除')
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(150)

  // 5c7. 弹窗（含子孙）不能「存为定制控件」
  const savedBlocked = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const defs0 = st.doc.customWidgets.length
    const dlg = st.editRoot().find(n => n.type === 'dialog')
    st.setSelection([dlg.id])
    st.saveSelectionAsCustom()
    return { same: window.__uiw.getState().doc.customWidgets.length === defs0 }
  })()`)
  check('弹窗不可存为定制', savedBlocked.same === true, '选中弹窗「存为定制控件」被拦截')

  // 5d. 回页面 1 放矩形（准备开启可点击）
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setCurrentPage(0)
    st.addWidget(window.__uiwDefs.find(d => d.type === 'rect' && d.label === '矩形'), 200, 375)
    return true
  })()`)
  await sleep(200)
  const pair = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const rect = st.currentPage().nodes.find(n => n.type === 'rect')
    return { rectId: rect.id, rectClickable: rect.clickable === undefined }
  })()`)
  check('矩形默认不可点击', pair.rectClickable === true, '未开启 clickable 的矩形：右键菜单不应有「点击」')

  // 5a. 右键矩形（未开启）→ 菜单只有删除
  const rect = await evalJs(`window.__uiw.getState().currentPage().nodes.find(n => n.type === 'rect')`)
  pt = await toScreen(rect.x + rect.w / 2, rect.y + rect.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  check('非点击控件菜单', items.length === 1 && items[0].includes('删除'), `菜单项=[${items}]`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(150)

  // 5b. 属性面板勾选「可点击」（真实点击 checkbox）
  await evalJs(`(() => { window.__uiw.getState().setSelection(['${rect.id}']); return true })()`)
  await sleep(200)
  const cbGeo = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    const cb = sec.querySelector('input[type=checkbox]')
    const r = cb.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(cbGeo.x, cbGeo.y)
  await sleep(200)
  const rectClickable = await evalJs(`window.__uiw.getState().currentPage().nodes.find(n => n.id === '${rect.id}').clickable`)
  check('勾选可点击', rectClickable === true, `rect.clickable=${rectClickable}`)
  const badge = await evalJs(`!!document.querySelector('.clickable-tag')`)
  check('图层可点击标记', badge === true, '图层树显示「点击」标记')

  // 5e. 配置弹窗效果（指向独立弹窗页）
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.updateNodes(['${rect.id}'], n => { n.clickAction = { type: 'popup', target: '${pp.id}' } })
    return true
  })()`)
  await sleep(150)

  // 5f. 「编辑弹窗内容」快捷入口：从按钮的点击效果直接跳到弹窗页编辑
  const editBtn = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    const b = [...sec.querySelectorAll('button')].find(x => x.textContent.includes('编辑弹窗内容'))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(editBtn.x, editBtn.y)
  await sleep(250)
  const jumped = await evalJs(`window.__uiw.getState().editingPopupId`)
  check('编辑弹窗入口', jumped === pp.id, `点「编辑弹窗内容」后进入弹窗页=${jumped === pp.id}`)
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.setEditingPopup(null)
    st.setCurrentPage(0)
    st.setSelection([st.currentPage().nodes.find(n => n.type === 'rect').id])
    return true
  })()`)
  await sleep(150)

  // —— 6. 属性面板「▶ 演示点击效果」→ 弹窗遮罩浮层 ——
  const demoBtn = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    const b = [...sec.querySelectorAll('button')].find(x => x.textContent.includes('演示点击效果'))
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(demoBtn.x, demoBtn.y)
  await sleep(250)
  const popup1 = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { popupId: st.popupId, backdrop: !!document.querySelector('.popup-backdrop'), badge: !!document.querySelector('.popup-badge') }
  })()`)
  check('弹窗演示打开', popup1.popupId === pp.id && popup1.backdrop && popup1.badge,
    `popupId=${popup1.popupId === pp.id}，遮罩=${popup1.backdrop}，提示=${popup1.badge}`)

  // —— 7. 点遮罩关闭；Esc 也能关闭 ——
  const dim = await toScreen(40, 60)
  await click(dim.x, dim.y)
  await sleep(200)
  const closedByBackdrop = await evalJs(`window.__uiw.getState().popupId === null && !document.querySelector('.popup-backdrop')`)
  check('点遮罩关闭', closedByBackdrop === true, '遮罩点击后弹窗演示关闭')
  await evalJs(`window.__uiw.getState().triggerClick('${rect.id}')`)
  await sleep(200)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(200)
  const closedByEsc = await evalJs(`window.__uiw.getState().popupId === null`)
  check('Esc 关闭弹窗', closedByEsc === true, 'Esc 收起弹窗演示')

  // —— 7b. 点弹窗标题栏 ✕ 关闭 ——
  await evalJs(`window.__uiw.getState().triggerClick('${rect.id}')`)
  await sleep(250)
  const xpt = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const popup = st.doc.popups.find(p => p.id === st.popupId)
    const dlg = popup.nodes.find(n => n.type === 'dialog')
    const t = Math.min(48, dlg.h / 2)
    return { x: dlg.x + dlg.w - t / 2 - 8, y: dlg.y + t / 2 }
  })()`)
  const xs = await toScreen(xpt.x, xpt.y)
  await click(xs.x, xs.y)
  await sleep(200)
  const closedByX = await evalJs(`window.__uiw.getState().popupId === null && !document.querySelector('.popup-backdrop')`)
  check('✕ 关闭弹窗', closedByX === true, '点击弹窗标题栏 ✕ 后演示关闭')

  // —— 8. 右键菜单「点击」触发弹窗（走菜单路径）——
  pt = await toScreen(rect.x + rect.w / 2, rect.y + rect.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  check('弹窗菜单项', items[1]?.includes('弹出'), `点击项="${items[1]}"`)
  const popupItem = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(popupItem.x, popupItem.y)
  await sleep(250)
  const popup2 = await evalJs(`window.__uiw.getState().popupId`)
  check('菜单触发弹窗', popup2 === pp.id, `popupId 匹配弹窗页`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(150)

  // —— 9. 右键菜单「删除」——
  await rclick(pt.x, pt.y)
  await sleep(250)
  const delItem = await evalJs(`(() => {
    const el = document.querySelector('.ctx-menu .ctx-item')
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(delItem.x, delItem.y)
  await sleep(200)
  const rectGone = await evalJs(`!window.__uiw.getState().currentPage().nodes.some(n => n.id === '${rect.id}')`)
  check('菜单删除控件', rectGone === true, '右键「删除」移除选中控件')

  // —— 10. 定制控件实例：可点击标记统一在定义内——实例属性无「点击」区、右键无「点击」项 ——
  const widgetDialog = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const wid = st.createCustomWidget({ kind: 'panel' })
    // 弹窗禁入定制控件定义（正在编辑定义树）
    const defs0 = window.__uiw.getState().doc.customWidgets.length
    const alerts0 = (window.__alertMsgs ?? []).length
    st.addWidget(window.__uiwDefs.find(d => d.type === 'dialog'), 100, 100)
    const s2 = window.__uiw.getState()
    const tree = s2.doc.customWidgets.find(w => w.id === wid).tree
    return { blocked: tree.every(n => n.type !== 'dialog'), defs: s2.doc.customWidgets.length === defs0, alerted: (window.__alertMsgs ?? []).length > alerts0 }
  })()`)
  check('弹窗禁入定制控件', widgetDialog.blocked === true && widgetDialog.alerted === true,
    `定义树无 dialog=${widgetDialog.blocked}，拦截提示=${widgetDialog.alerted}`)
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const wid = st.doc.customWidgets[st.doc.customWidgets.length - 1].id
    st.setEditingWidget(null)
    st.addWidgetCustom(wid, 650, 550)
    return true
  })()`)
  await sleep(250)
  const inst = await evalJs(`window.__uiw.getState().currentPage().nodes.find(n => n.type === 'custom')`)
  check('定制实例就位', !!inst, `custom 实例=${inst?.name}`)
  // 实例单独选中：属性面板不显示「点击」区（可点击标记配在定义内的控件上）
  await evalJs(`(() => { window.__uiw.getState().setSelection(['${inst.id}']); return true })()`)
  await sleep(200)
  const instPanel = await evalJs(`(() => {
    const secs = [...document.querySelectorAll('.prop-section')]
    return {
      hasClick: secs.some(s => s.querySelector('h4')?.textContent === '点击'),
      hasCustom: secs.some(s => s.textContent.includes('定制控件「'))
    }
  })()`)
  check('实例属性无点击区', instPanel.hasClick === false && instPanel.hasCustom === true,
    `「点击」区显示=${instPanel.hasClick}（应 false），定制控件属性区=${instPanel.hasCustom}`)
  const i = await evalJs(`window.__uiw.getState().currentPage().nodes.find(n => n.id === '${inst.id}')`)
  pt = await toScreen(i.x + i.w / 2, i.y + i.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  check('实例右键仅删除', items.length === 1 && items[0].includes('删除'),
    `实例不可整体点击，菜单项=[${items}]`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(150)

  // —— 11. 数据落盘：clickable / clickAction / popups 进入文档 ——
  const persisted = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const saved = JSON.parse(JSON.stringify(st.doc))
    const b = saved.pages[0].nodes.find(n => n.type === 'button')
    return { btnAction: b.clickAction, pageOk: saved.pages.some(p => p.id === b.clickAction.target),
      popups: Array.isArray(saved.popups) ? saved.popups.length : -1 }
  })()`)
  check('文档含点击数据', persisted.btnAction?.type === 'goto' && persisted.pageOk && persisted.popups >= 1,
    `button.clickAction=${JSON.stringify(persisted.btnAction)}，弹窗页=${persisted.popups}`)

  // —— 12. 配置「返回」效果：页 1 放返回按钮（实例级点击已移除，返回效果走普通控件）——
  const backBtn = await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.addWidget(window.__uiwDefs.find(d => d.type === 'button'), 1050, 620)
    const s2 = window.__uiw.getState()
    const b = s2.currentPage().nodes.filter(n => n.type === 'button').pop()
    s2.updateNodes([b.id], n => {
      n.props.text = '返回'
      n.clickAction = { type: 'back' }
    })
    s2.setSelection([b.id])
    return window.__uiw.getState().currentPage().nodes.find(n => n.id === b.id)
  })()`)
  await sleep(200)
  const backSel = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    const btns = [...sec.querySelectorAll('.seg button')]
    const back = btns.find(b => b.textContent === '返回')
    return { count: btns.length, on: !!back && back.className.includes('on'), hint: sec.textContent.includes('返回跳转来之前的页面') }
  })()`)
  check('返回效果选项', backSel.count === 4 && backSel.on === true && backSel.hint === true,
    `效果按钮 ${backSel.count}/4 个，返回选中=${backSel.on}，提示=${backSel.hint}`)

  // —— 13. 右键「点击 · 返回」→ 回到来路页面（此前从页面 2 切到页面 1，来路 = 页面 2）——
  pt = await toScreen(backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  const backEnabled = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    return { disabled: el.className.includes('disabled'), geo: (() => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })() }
  })()`)
  check('菜单返回标签', items[1]?.includes('返回「页面 2」') === true && backEnabled.disabled === false,
    `点击项="${items[1]}"，可触发=${!backEnabled.disabled}`)
  await click(backEnabled.geo.x, backEnabled.geo.y)
  await sleep(250)
  const afterBack = await evalJs('window.__uiw.getState().currentPageIndex')
  check('点击返回来路页', afterBack === 1, `currentPageIndex=${afterBack}/1（页面 2）`)

  // —— 14. 无来路时点击没有效果：删除页面 2（来路作废）→ 返回保持原页 ——
  await evalJs(`(() => { window.__uiw.getState().deletePage(1); return true })()`)
  await sleep(200)
  const afterDel = await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.triggerClick('${backBtn.id}')
    return { page: window.__uiw.getState().currentPageIndex, prev: st.prevPageId }
  })()`)
  check('无来路点击无效', afterDel.page === 0 && afterDel.prev === null,
    `点击后仍停在页面 1=${afterDel.page === 0}，prevPageId=${afterDel.prev}`)
  const bb = await evalJs(`window.__uiw.getState().currentPage().nodes.find(n => n.id === '${backBtn.id}')`)
  pt = await toScreen(bb.x + bb.w / 2, bb.y + bb.h / 2)
  await rclick(pt.x, pt.y)
  await sleep(250)
  const noBack = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    return { label: el.textContent.trim(), disabled: el.className.includes('disabled') }
  })()`)
  check('无来路菜单禁用', noBack.disabled === true && noBack.label.includes('无来路'),
    `"${noBack.label}"，禁用=${noBack.disabled}`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")

  // —— 15. 旧格式迁移：popup 动作指向页面上的 dialog 节点 → 自动移入弹窗页并改指向 ——
  const mig = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const doc = {
      version: 1,
      meta: { name: '旧工程', designWidth: 1334, designHeight: 750, orientation: 'landscape' },
      commonLayer: { id: 'common', name: '公共层', nodes: [] },
      customWidgets: [],
      pages: [
        { id: 'old_p1', name: '旧页', nodes: [
          { id: 'old_btn', type: 'button', name: '开', x: 100, y: 100, w: 200, h: 80, visible: true, locked: false,
            props: { text: '开' }, clickAction: { type: 'popup', target: 'old_dlg' } },
          { id: 'old_dlg', type: 'dialog', name: '旧弹窗', x: 400, y: 200, w: 480, h: 320, visible: true, locked: false,
            props: { title: '旧' }, children: [] }
        ] }
      ]
    }
    st.loadProject(doc, '/tmp/old.uiw')
    const s2 = window.__uiw.getState()
    const p1 = s2.doc.pages[0]
    const popup = s2.doc.popups[0]
    return {
      popups: s2.doc.popups.length,
      popupTypes: popup ? popup.nodes.map(n => n.type) : [],
      pageHasDialog: p1.nodes.some(n => n.type === 'dialog'),
      action: p1.nodes.find(n => n.id === 'old_btn').clickAction,
      popupId: popup?.id
    }
  })()`)
  check('旧格式自动迁移', mig.popups === 1 && mig.popupTypes[0] === 'dialog' && mig.pageHasDialog === false && mig.action.target === mig.popupId,
    `生成弹窗页=${mig.popups}，页面残留 dialog=${mig.pageHasDialog}，动作已改指向=${mig.action.target === mig.popupId}`)

  // —— 16. 弹窗页内控件：属性面板可配点击效果（ClickEditor 不再对弹窗页隐藏）——
  const popBtn = await evalJs(`(() => {
    const st0 = window.__uiw.getState()
    st0.addPage()
    const st = window.__uiw.getState()
    st.setCurrentPage(0)
    st.setEditingPopup(st.doc.popups[0].id)
    const dlg = window.__uiw.getState().doc.popups[0].nodes.find(n => n.type === 'dialog')
    st.addWidget(window.__uiwDefs.find(d => d.type === 'button'), dlg.x + dlg.w / 2, dlg.y + 48 + (dlg.h - 48) / 2)
    const s2 = window.__uiw.getState()
    const btn = s2.doc.popups[0].nodes.find(n => n.type === 'dialog').children.find(n => n.type === 'button')
    s2.updateNodes([btn.id], n => {
      n.props.text = '确定'
      n.clickAction = { type: 'goto', target: s2.doc.pages[1].id }
    })
    window.__uiw.getState().setSelection([btn.id])
    const fin = window.__uiw.getState()
    const b = fin.doc.popups[0].nodes.find(n => n.type === 'dialog').children.find(n => n.type === 'button')
    return { id: b.id, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }
  })()`)
  await sleep(200)
  const popPanel = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    return sec
      ? { ok: true, seg: sec.querySelectorAll('.seg button').length,
          demo: !![...sec.querySelectorAll('button')].find(b => b.textContent.includes('演示点击效果')) }
      : { ok: false, seg: 0, demo: false }
  })()`)
  check('弹窗页可配点击', popPanel.ok && popPanel.seg === 4 && popPanel.demo,
    `弹窗页属性面板「点击」区=${popPanel.ok}，效果选项=${popPanel.seg}/4，演示按钮=${popPanel.demo}`)

  // —— 17. 弹窗页内右键「点击」演示 → 跳转并退出弹窗编辑 ——
  pt = await toScreen(popBtn.cx, popBtn.cy)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  const popGo = items[1] ?? ''
  check('弹窗页右键点击项', popGo.includes('跳转「页面 2」'), `菜单项=[${items}]`)
  const popGoItem = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(popGoItem.x, popGoItem.y)
  await sleep(250)
  const popGoState = await evalJs(`(() => ({ page: window.__uiw.getState().currentPageIndex, editing: window.__uiw.getState().editingPopupId }))()`)
  check('弹窗页点击演示', popGoState.page === 1 && popGoState.editing === null,
    `右键「点击」后 currentPageIndex=${popGoState.page}/1，退出弹窗编辑=${popGoState.editing === null}`)

  // —— 18. 编辑态弹窗浮层内控件左键触发（PopupLayer 交互式渲染）——
  await evalJs(`(() => { window.__uiw.getState().setCurrentPage(0); window.__uiw.getState().triggerClick('old_btn'); return true })()`)
  await sleep(250)
  pt = await toScreen(popBtn.cx, popBtn.cy)
  await click(pt.x, pt.y)
  await sleep(250)
  const popupInner = await evalJs(`(() => ({ page: window.__uiw.getState().currentPageIndex, popup: window.__uiw.getState().popupId }))()`)
  check('弹窗内控件可点击', popupInner.page === 1 && popupInner.popup === null,
    `浮层内点「确定」→ 切页=${popupInner.page === 1}，弹窗收起=${popupInner.popup === null}`)

  // —— 19. 定制控件定义内控件：属性面板可配「点击」（定义级，实例上按命中区域触发）——
  const defBtn = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const wid = st.createCustomWidget({ kind: 'blank' })
    window.__uiw.getState().setEditingWidget(wid)
    window.__uiw.getState().addWidget(window.__uiwDefs.find(d => d.type === 'button'), 80, 60)
    const s2 = window.__uiw.getState()
    const btn = s2.doc.customWidgets.find(w => w.id === wid).tree.find(n => n.type === 'button')
    s2.setSelection([btn.id])
    const fin = window.__uiw.getState()
    const b = fin.doc.customWidgets.find(w => w.id === wid).tree.find(n => n.type === 'button')
    return { wid, id: b.id, cx: b.x + b.w / 2, cy: b.y + b.h / 2, editing: fin.editingWidgetId === wid }
  })()`)
  await sleep(250)
  const defPanel = await evalJs(`(() => {
    const sec = [...document.querySelectorAll('.prop-section')].find(s => s.querySelector('h4')?.textContent === '点击')
    return sec
      ? { ok: true, seg: sec.querySelectorAll('.seg button').length, hint: sec.textContent.includes('定义级设置') }
      : { ok: false, seg: 0, hint: false }
  })()`)
  check('定义内可配点击', defPanel.ok && defBtn.editing && defPanel.seg === 4 && defPanel.hint,
    `定义编辑选中按钮 → 「点击」区=${defPanel.ok}，效果选项=${defPanel.seg}/4（按钮天生可点击，无勾选框），定义级提示=${defPanel.hint}`)

  // —— 20. 定义编辑内右键「点击」演示 → 触发跳转并退出定义编辑 ——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    const target = st.doc.pages[0].id
    st.updateNodes(['${defBtn.id}'], n => { n.clickAction = { type: 'goto', target } })
    return true
  })()`)
  await sleep(150)
  pt = await toScreen(defBtn.cx, defBtn.cy)
  await rclick(pt.x, pt.y)
  await sleep(250)
  items = await ctxItems()
  const defGo = items[1] ?? ''
  check('定义内右键点击项', defGo.includes('跳转「旧页」'), `菜单项=[${items}]`)
  const defGoItem = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.ctx-menu .ctx-item')][1]
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(defGoItem.x, defGoItem.y)
  await sleep(250)
  const defGoState = await evalJs(`(() => ({ page: window.__uiw.getState().currentPageIndex, editing: window.__uiw.getState().editingWidgetId }))()`)
  check('定义内点击演示', defGoState.page === 0 && defGoState.editing === null,
    `右键「点击」后 currentPageIndex=${defGoState.page}/0，退出定义编辑=${defGoState.editing === null}`)

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
