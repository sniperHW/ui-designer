// 公共层专项测试：顶部状态栏在所有页面共享的完整链路
const BASE = 'http://localhost:9222'
async function main() {
  const targets = await (await fetch(BASE + '/json')).json()
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
  const def = (type, label) => `window.__uiwDefs.find(d => d.type === '${type}' && d.label === '${label}')`

  // —— 准备：新工程，进入公共层 ——
  await evalJs(`(() => { const st = window.__uiw.getState(); st.closeProject(); st.newProject({ name: '公共层测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' }); st.setCurrentPage(-1); return true })()`)
  await sleep(300)
  const badge1 = await evalJs('document.querySelector(".common-badge") !== null')
  check('编辑公共层', badge1 === true, '画布显示"正在编辑公共层"标识')
  const idx1 = await evalJs('window.__uiw.getState().currentPageIndex')
  check('公共层选中态', idx1 === -1, `currentPageIndex=${idx1}`)

  // —— 1. 在公共层搭"顶部状态栏"：头像占位 + 玩家名 + 金币 + 设置按钮 ——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    st.addWidget(${def('placeholder', '占位图')}, 90, 60)     // 头像
    st.addWidget(${def('text', '文本')}, 260, 60)             // 玩家名
    st.addWidget(${def('button', '按钮')}, 1100, 60)          // 设置
    return true
  })()`)
  await sleep(250)
  const cInfo = await evalJs(`(() => { const st = window.__uiw.getState(); return { common: st.doc.commonLayer.nodes.length, page: st.doc.pages[0].nodes.length } })()`)
  check('公共层控件', cInfo.common === 3 && cInfo.page === 0, `公共层=${cInfo.common}/3，页面=${cInfo.page}/0`)
  const editable = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('公共层可编辑', editable === 3, `公共层编辑态 g[data-id]=${editable}/3`)
  // 改玩家名文本
  await evalJs(`(() => { const st = window.__uiw.getState(); const n = st.doc.commonLayer.nodes[1]; st.updateNodes([n.id], m => { m.props.text = '玩家 10001' }); return true })()`)

  // —— 2. 切回页面 1：公共层只读显示在页面之下 ——
  await evalJs(`(() => { window.__uiw.getState().setCurrentPage(0); return true })()`)
  await sleep(250)
  const pageView = await evalJs(`(() => {
    const g = document.querySelectorAll('g[data-id]').length
    const c = document.querySelectorAll('.common-layer').length
    const badge = document.querySelector('.common-badge') !== null
    const txt = document.querySelector('.canvas-svg').textContent.includes('玩家 10001')
    return { g, c, badge, txt }
  })()`)
  check('页面显示公共层', pageView.c === 3, `页面画布渲染公共层 ${pageView.c}/3 组`)
  check('公共层不可选', pageView.g === 0, `页面画布可交互 g[data-id]=${pageView.g}/0`)
  check('无编辑标识', pageView.badge === false, '页面编辑时不显示公共层标识')
  check('内容同步', pageView.txt === true, '公共层改名后页面视图同步（玩家 10001）')

  // —— 3. 点击公共层区域 → 不选中任何东西（穿透到背景）——
  const pt = await evalJs(`(() => { const r = document.querySelector('.common-layer').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await click(pt.x, pt.y)
  await sleep(200)
  const afterClick = await evalJs(`window.__uiw.getState().selectedIds.length`)
  check('点击穿透', afterClick === 0, `点击公共层区域后选中=${afterClick}/0`)

  // —— 4. 页面添加控件：不影响公共层；页面控件盖在公共层之上 ——
  await evalJs(`(() => { const st = window.__uiw.getState(); st.addWidget(${def('button', '按钮')}, 667, 400); return true })()`)
  await sleep(250)
  const mixed = await evalJs(`(() => { const st = window.__uiw.getState(); return { page: st.doc.pages[0].nodes.length, common: st.doc.commonLayer.nodes.length, dom: document.querySelectorAll('g[data-id]').length, commonDom: document.querySelectorAll('.common-layer').length } })()`)
  check('页面控件共存', mixed.page === 1 && mixed.common === 3 && mixed.dom === 1 && mixed.commonDom === 3,
    `页面=${mixed.page}，公共层=${mixed.common}，DOM 可交互=${mixed.dom}，只读=${mixed.commonDom}`)

  // —— 5. 缩略图包含公共层 ——
  const thumb = await evalJs(`(() => {
    const row = document.querySelector('.page-row .page-thumb')
    return { hasCommon: row.textContent.includes('玩家 10001'), hasPage: row.textContent.includes('按钮') }
  })()`)
  check('缩略图含公共层', thumb.hasCommon === true && thumb.hasPage === true, '页面缩略图同时含公共层与页面控件')

  // —— 6. 删除页面控件不影响公共层 ——
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))")
  await sleep(200)
  const afterDel = await evalJs(`(() => { const st = window.__uiw.getState(); return { page: st.doc.pages[0].nodes.length, common: st.doc.commonLayer.nodes.length } })()`)
  check('删除隔离', afterDel.page === 0 && afterDel.common === 3, `删除页面控件后：页面=${afterDel.page}，公共层=${afterDel.common}/3`)

  // —— 7. 页面列表公共层条目切换 ——
  const rowPt = await evalJs(`(() => { const row = document.querySelector('.common-row'); row.scrollIntoView({ block: 'nearest' }); const r = row.getBoundingClientRect(); return { x: r.x + 30, y: r.y + r.height / 2 } })()`)
  await click(rowPt.x, rowPt.y)
  await sleep(250)
  const backCommon = await evalJs(`(() => ({ idx: window.__uiw.getState().currentPageIndex, badge: document.querySelector('.common-badge') !== null }))()`)
  check('条目切换', backCommon.idx === -1 && backCommon.badge === true, '点击"公共层"条目回到公共层编辑')

  // —— 8. 新建第二个页面，公共层自动存在 ——
  await evalJs(`(() => { window.__uiw.getState().addPage(); return true })()`)
  await sleep(250)
  const p2 = await evalJs(`(() => { const st = window.__uiw.getState(); return { idx: st.currentPageIndex, common: document.querySelectorAll('.common-layer').length } })()`)
  check('新页共享', p2.idx === 1 && p2.common === 3, `新页面同样显示公共层 ${p2.common}/3 组`)

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
