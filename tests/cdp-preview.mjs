// 原型预览专项测试：▶ 预览运行整套工程（可点击控件切页 / 返回 / 弹窗 + Tab 页签切换）
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
  const results = {}
  const check = (name, ok, detail) => {
    results[name] = ok ? '✓ ' + detail : '✗ ' + detail
    if (!ok) process.exitCode = 1
  }
  /** 文档坐标 → 预览画板屏幕坐标 */
  const pv = (docX, docY) => evalJs(`(() => {
    const svg = document.querySelector('.preview-stage svg')
    const r = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    return { x: r.left + (${docX} / vb.width) * r.width, y: r.top + (${docY} / vb.height) * r.height }
  })()`)

  // —— 准备：2 页工程；页 1 = 跳转按钮 + 2 页签 Tab + 可点击矩形（弹窗）；页 2 = 返回按钮 ——
  await evalJs(`(() => {
    let st = window.__uiw.getState()
    st.newProject({ name: '预览测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })
    st = window.__uiw.getState()
    st.addPage()
    st.setCurrentPage(0)
    const D = (t) => window.__uiwDefs.find(d => d.type === t)
    st.addWidget(D('button'), 200, 300)                 // 跳转按钮
    st.addWidget(D('tab'), 540, 550)                    // Tab（默认 3 页签 → 改 2）
    st.addWidget(D('rect'), 900, 150)                   // 弹窗入口矩形
    st = window.__uiw.getState()
    const p1 = st.doc.pages[0]
    const btn = p1.nodes.find(n => n.type === 'button')
    const tab = p1.nodes.find(n => n.type === 'tab')
    const rectId = p1.nodes.find(n => n.type === 'rect').id
    st.updateNodes([btn.id], n => {
      n.props.text = '去下页'
      n.clickAction = { type: 'goto', target: window.__uiw.getState().doc.pages[1].id }
    })
    st.updateNodes([tab.id], n => {
      n.props.tabs = ['装备', '商城']
      const pages = n.pages ?? []
      n.pages = ['装备', '商城'].map((_, i) => pages[i] ?? [])
      n.activeTab = 0
    })
    const pp = st.addPopup()                            // 弹窗页（自带居中弹窗）；注意已切入弹窗编辑
    st.setEditingPopup(null)                            // 回页面 1 再给矩形绑弹窗
    st.setCurrentPage(0)
    st.updateNodes([rectId], n => {
      n.clickable = true
      n.clickAction = { type: 'popup', target: pp }
    })
    st.setCurrentPage(1)
    st.addWidget(D('button'), 667, 375)
    const b2 = window.__uiw.getState().currentPage().nodes.find(n => n.type === 'button')
    st.updateNodes([b2.id], n => {
      n.props.text = '返回'
      n.clickAction = { type: 'back' }
    })
    st.setCurrentPage(0)
    return true
  })()`)
  await sleep(300)
  const geo = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const p1 = st.doc.pages[0]
    const tab = p1.nodes.find(n => n.type === 'tab')
    const rect = p1.nodes.find(n => n.type === 'rect')
    const dlg = st.doc.popups[0].nodes.find(n => n.type === 'dialog')
    const b2 = st.doc.pages[1].nodes.find(n => n.type === 'button')
    return { btn: p1.nodes.find(n => n.type === 'button'), tab, rect, dlg, b2, p1: st.doc.pages[0], p2: st.doc.pages[1] }
  })()`)

  // —— 1. 工具栏「▶ 预览」进入 ——
  const pvBtn = await evalJs(`(() => {
    const el = document.querySelector('.preview-overlay') ? null : [...document.querySelectorAll('.toolbar .tb-btn')].find(b => b.textContent.includes('预览'))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(pvBtn.x, pvBtn.y)
  await sleep(350)
  const entered = await evalJs(`(() => ({
    on: window.__uiw.getState().previewing,
    overlay: !!document.querySelector('.preview-overlay'),
    title: document.querySelector('.preview-title')?.textContent ?? ''
  }))()`)
  check('进入预览', entered.on === true && entered.overlay && entered.title.includes('页面 1'),
    `previewing=${entered.on}，浮层=${entered.overlay}，标题="${entered.title}"`)

  // —— 2. 点跳转按钮 → 页面 2 ——
  let pt = await pv(geo.btn.x + geo.btn.w / 2, geo.btn.y + geo.btn.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const gotoState = await evalJs(`(() => ({
    page: window.__uiw.getState().currentPageIndex,
    title: document.querySelector('.preview-title')?.textContent ?? ''
  }))()`)
  check('点击跳转页面', gotoState.page === 1 && gotoState.title.includes('页面 2'),
    `currentPageIndex=${gotoState.page}/1，标题="${gotoState.title}"`)

  // —— 3. 点返回按钮（back）→ 回到页面 1 ——
  pt = await pv(geo.b2.x + geo.b2.w / 2, geo.b2.y + geo.b2.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const backState = await evalJs('window.__uiw.getState().currentPageIndex')
  check('点击返回来路页', backState === 0, `currentPageIndex=${backState}/0`)

  // —— 4. 点 Tab 第 2 个页签头 → 就地切换内容页 ——
  pt = await pv(geo.tab.x + geo.tab.w * 0.75, geo.tab.y + 20)
  await click(pt.x, pt.y)
  await sleep(300)
  const tabState = await evalJs(`window.__uiw.getState().doc.pages[0].nodes.find(n => n.type === 'tab').activeTab`)
  check('Tab 页签切换', tabState === 1, `activeTab=${tabState}/1`)

  // —— 5. 点可点击矩形 → 弹窗弹出（遮罩 + 内容置顶）；点 ✕ 关闭 ——
  pt = await pv(geo.rect.x + geo.rect.w / 2, geo.rect.y + geo.rect.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const popState = await evalJs(`(() => ({
    id: window.__uiw.getState().popupId,
    backdrop: !!document.querySelector('.preview-overlay .popup-backdrop'),
    badge: !!document.querySelector('.popup-badge')
  }))()`)
  check('预览弹出弹窗', !!popState.id && popState.backdrop === true,
    `popupId=${!!popState.id}，遮罩=${popState.backdrop}`)
  const t = Math.min(48, geo.dlg.h / 2)
  pt = await pv(geo.dlg.x + geo.dlg.w - t / 2 - 8, geo.dlg.y + t / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const xClosed = await evalJs(`window.__uiw.getState().popupId === null && !document.querySelector('.preview-overlay .popup-backdrop')`)
  check('预览✕关弹窗', xClosed === true, '点弹窗 ✕ 后关闭')

  // —— 6. Esc 退出预览，编辑器状态保留 ——
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(300)
  const exited = await evalJs(`(() => ({
    on: window.__uiw.getState().previewing,
    overlay: !!document.querySelector('.preview-overlay'),
    page: window.__uiw.getState().currentPageIndex
  }))()`)
  check('Esc 退出预览', exited.on === false && !exited.overlay && exited.page === 0,
    `previewing=${exited.on}，浮层=${exited.overlay}，退出后停在页面 1=${exited.page === 0}`)

  // —— 准备 2：页 1 = 定制控件实例（整体可点击 → 跳页 2）+ 滚动区（内容溢出，底部按钮绑返回页 1）；弹窗页内容按钮绑跳页 2 ——
  const setup2 = await evalJs(`(() => {
    const D = (t) => window.__uiwDefs.find(d => d.type === t)
    let st = window.__uiw.getState()
    // 页 1：面板骨架定制控件实例
    const wid = st.createCustomWidget({ kind: 'panel' })
    st = window.__uiw.getState()
    st.setCurrentPage(0)
    st.addWidgetCustom(wid, 900, 430)
    st = window.__uiw.getState()
    const inst = st.doc.pages[0].nodes.find(n => n.type === 'custom')
    st.updateNodes([inst.id], n => {
      n.w = 240; n.h = 140
      n.clickable = true
      n.clickAction = { type: 'goto', target: window.__uiw.getState().doc.pages[1].id }
    })
    // 页 2：滚动区（80,300 360×300）+ 3 个子按钮，第 3 个移出可视区（内容溢出）并绑返回页 1
    st = window.__uiw.getState()
    st.setCurrentPage(1)
    st.addWidget(D('scroll'), 260, 450)
    st = window.__uiw.getState()
    st.updateNodes([st.currentPage().nodes.find(n => n.type === 'scroll').id], n => { n.w = 360; n.h = 300 })
    for (const cy of [380, 490, 560]) {
      window.__uiw.getState().addWidget(D('button'), 260, cy)
    }
    st = window.__uiw.getState()
    const scr = st.currentPage().nodes.find(n => n.type === 'scroll')
    st.updateNodes([scr.children[2].id], n => {
      n.y = 636
      n.clickAction = { type: 'goto', target: window.__uiw.getState().doc.pages[0].id }
    })
    // 弹窗页：内容按钮（确定）绑跳页 2
    st = window.__uiw.getState()
    st.setEditingPopup(st.doc.popups[0].id)
    const dlg0 = window.__uiw.getState().doc.popups[0].nodes.find(n => n.type === 'dialog')
    st.addWidget(D('button'), dlg0.x + dlg0.w / 2, dlg0.y + 48 + (dlg0.h - 48) / 2)
    const s3 = window.__uiw.getState()
    const pbtn = s3.doc.popups[0].nodes.find(n => n.type === 'dialog').children.find(n => n.type === 'button')
    s3.updateNodes([pbtn.id], n => {
      n.props.text = '确定'
      n.clickAction = { type: 'goto', target: s3.doc.pages[1].id }
    })
    window.__uiw.getState().setEditingPopup(null)
    window.__uiw.getState().setCurrentPage(0)
    const fin = window.__uiw.getState()
    const s = fin.doc.pages[1].nodes.find(n => n.type === 'scroll')
    const maxScroll = Math.round(Math.max(0, Math.max(...s.children.map(c => c.y + c.h)) - (s.y + s.h)))
    const b = s.children[2]
    const pb = fin.doc.popups[0].nodes.find(n => n.type === 'dialog').children.find(n => n.type === 'button')
    return { scrollId: s.id, sy: s.y, maxScroll, btn3: b, pbtn: pb }
  })()`)
  await sleep(300)

  // —— 7. 再入预览：点可点击定制控件实例 → 跳页 2 ——
  const pvBtn2 = await evalJs(`(() => {
    const el = [...document.querySelectorAll('.toolbar .tb-btn')].find(b => b.textContent.includes('预览'))
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(pvBtn2.x, pvBtn2.y)
  await sleep(350)
  const inst = await evalJs(`window.__uiw.getState().doc.pages[0].nodes.find(n => n.type === 'custom')`)
  pt = await pv(inst.x + inst.w / 2, inst.y + inst.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const instGo = await evalJs(`(() => ({ page: window.__uiw.getState().currentPageIndex, title: document.querySelector('.preview-title')?.textContent ?? '' }))()`)
  check('点击定制实例跳页', instGo.page === 1 && instGo.title.includes('页面 2'),
    `currentPageIndex=${instGo.page}/1，标题="${instGo.title}"`)

  // —— 8. 预览滚动：滚轮下滚 → 内容上移、滑块下移；回滚归零 ——
  const wheelOn = (deltaY) => evalJs(`(() => {
    const el = document.querySelector('.preview-overlay [data-id="${setup2.scrollId}"]')
    if (!el) return false
    el.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: ${deltaY} }))
    return true
  })()`)
  const scrollRead = () => evalJs(`(() => {
    const g = document.querySelector('.preview-overlay [data-id="${setup2.scrollId}"]')
    const inner = g && g.querySelector('g[clip-path] > g')
    const thumb = g && g.querySelector('rect[fill="#9aa0ab"]')
    return { t: inner ? inner.getAttribute('transform') : null, thumbY: thumb ? Math.round(+thumb.getAttribute('y')) : null }
  })()`)
  await wheelOn(1000)
  await sleep(200)
  const down = await scrollRead()
  const expectDown = 'translate(0 ' + -setup2.maxScroll + ')'
  check('预览滚动下滚', down.t === expectDown && down.thumbY !== null && down.thumbY > setup2.sy + 4,
    `transform="${down.t}"（应 = ${expectDown}），滑块y=${down.thumbY}`)
  await wheelOn(-1000)
  await sleep(200)
  const up = await scrollRead()
  check('预览滚动回顶', up.t === 'translate(0 0)' && up.thumbY !== null && up.thumbY <= setup2.sy + 4,
    `transform="${up.t}"，滑块y=${up.thumbY}`)

  // —— 9. 滚到底后点击露出的按钮（滚出可视区的内容可点）→ 返回页 1 ——
  await wheelOn(1000)
  await sleep(200)
  const b3 = setup2.btn3
  pt = await pv(b3.x + b3.w / 2, b3.y + b3.h / 2 - setup2.maxScroll)
  await click(pt.x, pt.y)
  await sleep(300)
  const revealGo = await evalJs('window.__uiw.getState().currentPageIndex')
  check('滚出内容可点击', revealGo === 0, `滚到底点击第 3 个按钮 → currentPageIndex=${revealGo}/0`)

  // —— 10. 弹窗内控件可点击：弹窗里的「确定」→ 跳页 2 并收起弹窗 ——
  pt = await pv(geo.rect.x + geo.rect.w / 2, geo.rect.y + geo.rect.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const pb2 = setup2.pbtn
  pt = await pv(pb2.x + pb2.w / 2, pb2.y + pb2.h / 2)
  await click(pt.x, pt.y)
  await sleep(300)
  const popGo = await evalJs(`(() => ({ page: window.__uiw.getState().currentPageIndex, popup: window.__uiw.getState().popupId, backdrop: !!document.querySelector('.preview-overlay .popup-backdrop') }))()`)
  check('弹窗内控件可点击', popGo.page === 1 && popGo.popup === null && !popGo.backdrop,
    `点「确定」→ 切页=${popGo.page === 1}，弹窗收起=${popGo.popup === null}`)

  // —— 10b. 定制控件定义内控件可点击：实例上点对应区域触发，点空白区域不触发 ——
  await evalJs(`window.__uiw.getState().stopPreview()`)
  await sleep(250)
  const defInst = await evalJs(`(() => {
    const D = (t) => window.__uiwDefs.find(d => d.type === t)
    let st = window.__uiw.getState()
    const wid = st.createCustomWidget({ kind: 'blank' })
    st.setEditingWidget(wid)
    window.__uiw.getState().addWidget(D('button'), 80, 60)
    const s2 = window.__uiw.getState()
    const def = s2.doc.customWidgets.find(w => w.id === wid)
    const btn = def.tree.find(n => n.type === 'button')
    s2.updateNodes([btn.id], n => {
      n.clickAction = { type: 'goto', target: window.__uiw.getState().doc.pages[0].id }
    })
    window.__uiw.getState().setEditingWidget(null)
    window.__uiw.getState().setCurrentPage(1)
    window.__uiw.getState().addWidgetCustom(wid, 950, 250)
    const fin = window.__uiw.getState()
    const d = fin.doc.customWidgets.find(w => w.id === wid)
    const inst = fin.doc.pages[1].nodes.find(n => n.type === 'custom' && n.customId === wid)
    const b = d.tree.find(n => n.type === 'button')
    return { inst, defW: d.w, defH: d.h, btnCx: b.x + b.w / 2, btnCy: b.y + b.h / 2 }
  })()`)
  await sleep(300)
  await evalJs(`window.__uiw.getState().startPreview()`)
  await sleep(400)
  // 空白区域（定义坐标 (300, 220)，无控件）→ 不触发
  const blank = {
    x: defInst.inst.x + (300 * defInst.inst.w) / defInst.defW,
    y: defInst.inst.y + (220 * defInst.inst.h) / defInst.defH
  }
  let blankPt = await pv(blank.x, blank.y)
  await click(blankPt.x, blankPt.y)
  await sleep(250)
  const blankGo = await evalJs('window.__uiw.getState().currentPageIndex')
  check('实例空白区不触发', blankGo === 1, `点实例内无控件区域后仍停在页面 2=${blankGo === 1}`)
  // 按钮区域（定义局部坐标换算到页面）→ 触发定义内 goto
  const hit = {
    x: defInst.inst.x + (defInst.btnCx * defInst.inst.w) / defInst.defW,
    y: defInst.inst.y + (defInst.btnCy * defInst.inst.h) / defInst.defH
  }
  let hitPt = await pv(hit.x, hit.y)
  await click(hitPt.x, hitPt.y)
  await sleep(300)
  const hitGo = await evalJs('window.__uiw.getState().currentPageIndex')
  check('定义内控件实例触发', hitGo === 0, `点实例上按钮区域 → currentPageIndex=${hitGo}/0`)

  // —— 11. Esc 退出预览 ——
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(300)
  const exited2 = await evalJs(`(() => ({ on: window.__uiw.getState().previewing, overlay: !!document.querySelector('.preview-overlay') }))()`)
  check('再次Esc退出', exited2.on === false && !exited2.overlay, '预览关闭，回到编辑器')

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
