// Tab 容器专项测试：构建 3 页签 TabView 的完整链路
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

  // —— 准备：确保已打开工程，回到页面 1 并清空 ——
  await evalJs(`(() => {
    const st = window.__uiw.getState()
    if (!st.hasProject) st.newProject({ name: 'Tab 测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })
    st.setCurrentPage(0)
    st.setSelection([])
    return true
  })()`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true }))")
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))")
  await sleep(200)

  // —— 1. 从控件库点击添加 Tab（真实点击，按标签定位；先滚动到可视区）——
  const c = await evalJs(`(() => { const items = [...document.querySelectorAll('.lib-item')]; const el = items.find(i => i.querySelector('.lib-label')?.textContent === 'Tab 页签'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  await click(c.x, c.y)
  await sleep(300)
  const st1 = await evalJs(`(() => { const st = window.__uiw.getState(); const n = st.currentPage().nodes[0]; return n ? { type: n.type, tabs: n.props.tabs, pages: (n.pages || []).map(p => p.length), active: n.activeTab, w: n.w, h: n.h } : null })()`)
  check('添加 Tab', st1?.type === 'tab', `type=${st1?.type}`)
  check('默认 3 页签', st1?.tabs?.length === 3 && st1.pages?.length === 3, `tabs=[${st1?.tabs}] 每页子控件=[${st1?.pages}]`)
  const domHeaders = await evalJs(`(() => { const g = document.querySelector('g[data-id]'); const t = g.textContent; return ['页签 1','页签 2','页签 3'].every(s => t.includes(s)) })()`)
  check('页签头渲染', domHeaders === true, '三个页签标题已绘制')

  // —— 2. 画布点击第 2 个页签头 → 切换当前编辑页 ——
  const geo = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const n = st.currentPage().nodes[0]
    const v = st.viewport
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect()
    // 页签头 2 中心：文档坐标 (n.x + n.w*0.5, n.y + 20)
    return { x: r.x + v.panX + (n.x + n.w * 0.5) * v.zoom, y: r.y + v.panY + (n.y + 20) * v.zoom }
  })()`)
  await click(geo.x, geo.y)
  await sleep(250)
  const active1 = await evalJs(`window.__uiw.getState().currentPage().nodes[0].activeTab`)
  check('点击页签头切换', active1 === 1, `activeTab=${active1}/1`)
  const boldCheck = await evalJs(`(() => { const g = document.querySelector('g[data-id]'); return g.innerHTML.includes('font-weight="700"') })()`)
  check('激活页签加粗', boldCheck === true, '激活页签标题为粗体')

  // —— 3. 往该页签内容区添加按钮（模拟拖放落点，几何判定入页签）——
  const added = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const n = st.currentPage().nodes[0]
    const def = window.__uiwDefs.find(d => d.type === 'button')
    // 落点：Tab 内容区中央
    st.addWidget(def, n.x + n.w / 2, n.y + 40 + 120)
    const t = window.__uiw.getState().currentPage().nodes[0]
    return { top: window.__uiw.getState().currentPage().nodes.length, pageLens: t.pages.map(p => p.length), childType: t.pages[1][0]?.type }
  })()`)
  await sleep(250)
  check('子控件入页签', added.top === 1 && added.pageLens[1] === 1 && added.childType === 'button',
    `顶层=${added.top}，各页子控件=[${added.pageLens}]，类型=${added.childType}`)
  const domNodes = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('嵌套渲染', domNodes === 2, `画布 g[data-id]=${domNodes}/2`)
  const layerRows = await evalJs('document.querySelectorAll(".layer-row").length')
  check('图层树含子项', layerRows === 2, `图层行=${layerRows}/2`)
  const indented = await evalJs(`(() => { const rows = [...document.querySelectorAll('.layer-row')]; return rows.some(r => parseInt(getComputedStyle(r).paddingLeft) > 20) })()`)
  check('子项缩进显示', indented === true, 'Tab 子控件在图层树中缩进')

  // —— 4. 子控件被裁剪在内容区内（clipPath 存在）——
  const clipped = await evalJs(`!!document.querySelector('.canvas-svg clipPath')`)
  check('内容区裁剪', clipped === true, '子控件裁剪到 Tab 内容区')

  // —— 5. 移动 Tab（方向键微调）→ 子控件跟随 ——
  const before = await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]; return { tx: t.x, ty: t.y, cx: t.pages[1][0].x, cy: t.pages[1][0].y } })()`)
  await evalJs(`
    (() => { const st = window.__uiw.getState(); st.setSelection([st.currentPage().nodes[0].id]); return true })()
  `)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))")
  await sleep(200)
  const after = await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]; return { tx: t.x, cx: t.pages[1][0].x } })()`)
  check('容器移动联动', after.tx === before.tx + 1 && after.cx === before.cx + 1,
    `Tab x: ${before.tx}→${after.tx}，子控件 x: ${before.cx}→${after.cx}`)

  // —— 6. 撤销 → 两者同时回到原位（一次撤销覆盖联动）——
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true }))")
  await sleep(200)
  const undone = await evalJs(`(() => { const st = window.__uiw.getState(); const t = st.currentPage().nodes[0]; return { tx: t.x, cx: t.pages[1][0].x } })()`)
  check('撤销联动', undone.tx === before.tx && undone.cx === before.cx, `Tab x=${undone.tx}，子控件 x=${undone.cx}（均回到原位）`)

  // —— 7. 页签栏位置切换到底部 ——
  await evalJs(`
    (() => { const st = window.__uiw.getState(); st.updateNodes([st.currentPage().nodes[0].id], n => { n.props.barPosition = 'bottom' }); return true })()
  `)
  await sleep(250)
  const bottomOk = await evalJs(`(() => {
    const g = document.querySelector('.canvas-wrap svg')
    return g.innerHTML.includes('clip-') && window.__uiw.getState().currentPage().nodes[0].props.barPosition
  })()`)
  check('页签栏置底', bottomOk === 'bottom', `barPosition=${bottomOk}，内容区裁剪随之上移`)
  // 放回顶部
  await evalJs(`(() => { const st = window.__uiw.getState(); st.updateNodes([st.currentPage().nodes[0].id], n => { n.props.barPosition = 'top' }, true); return true })()`)

  // —— 8. 修改页签数量（3→2）：第 1 页签的子控件保留 ——
  const resized = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const t = st.currentPage().nodes[0]
    st.updateNodes([t.id], n => {
      n.props.tabs = ['装备', '商城']
      const pages = n.pages ?? []
      n.pages = ['装备', '商城'].map((_, i) => pages[i] ?? [])
      n.activeTab = Math.min(n.activeTab ?? 0, 1)
    })
    const t2 = window.__uiw.getState().currentPage().nodes[0]
    return { tabs: t2.props.tabs, pageLens: t2.pages.map(p => p.length) }
  })()`)
  check('页签增删', resized.tabs?.length === 2 && resized.pageLens?.[1] === 1,
    `tabs=[${resized.tabs}]，子控件保留=[${resized.pageLens}]`)

  // —— 9. 删除 Tab → 子控件一起删除 ——
  await evalJs(`
    (() => { const st = window.__uiw.getState(); st.setSelection([st.currentPage().nodes[0].id]); return true })()
  `)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))")
  await sleep(200)
  const finalNodes = await evalJs('window.__uiw.getState().currentPage().nodes.length')
  const finalDom = await evalJs('document.querySelectorAll("g[data-id]").length')
  check('删除容器含子控件', finalNodes === 0 && finalDom === 0, `store=${finalNodes}，DOM=${finalDom}`)

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
