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

  // —— 8. 页签列表编辑（属性面板真实输入）：改名保留内容 / 中间插入不错位 / 删除页签 ——
  await evalJs(`(() => { const st = window.__uiw.getState(); st.setSelection([st.currentPage().nodes[0].id]); return true })()`)
  await sleep(300)
  const setTabsField = async (text) => {
    await evalJs(`(() => {
      const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector('span')?.textContent === '页签列表')
      const ta = row && row.querySelector('textarea')
      if (!ta) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, ${JSON.stringify(text)})
      ta.dispatchEvent(new Event('input', { bubbles: true }))
      ta.focus()
      ta.blur()
      return true
    })()`)
    await sleep(250)
  }
  // 8.1 改名：页签 2 → 商城，按钮内容跟名字走
  await setTabsField('页签 1\n商城\n页签 3')
  const renamed = await evalJs(`(() => { const t = window.__uiw.getState().currentPage().nodes[0]; return { tabs: t.props.tabs, pageLens: t.pages.map(p => p.length) } })()`)
  check('页签改名保留内容', renamed.tabs?.join() === '页签 1,商城,页签 3' && renamed.pageLens?.join() === '0,1,0',
    `tabs=[${renamed.tabs}]，各页子控件=[${renamed.pageLens}]`)
  // 8.2 中间插入：商城与页签 3 之间插入「领地」→ 领地是空页，后续页签内容不错位
  await setTabsField('页签 1\n商城\n领地\n页签 3')
  const inserted = await evalJs(`(() => { const t = window.__uiw.getState().currentPage().nodes[0]; return { tabs: t.props.tabs, pageLens: t.pages.map(p => p.length) } })()`)
  check('中间插入页签不错位', inserted.tabs?.join() === '页签 1,商城,领地,页签 3' && inserted.pageLens?.join() === '0,1,0,0',
    `tabs=[${inserted.tabs}]，各页子控件=[${inserted.pageLens}]`)
  // 8.3 画布点「领地」页签头 → 空页无按钮；点回「商城」→ 按钮还在
  const clickHeader = async (idx, count) => {
    const geo = await evalJs(`(() => {
      const st = window.__uiw.getState()
      const n = st.currentPage().nodes[0]
      const v = st.viewport
      const r = document.querySelector('.canvas-wrap').getBoundingClientRect()
      return { x: r.x + v.panX + (n.x + n.w * ${(idx + 0.5) / count}) * v.zoom, y: r.y + v.panY + (n.y + 20) * v.zoom }
    })()`)
    await click(geo.x, geo.y)
    await sleep(250)
  }
  await clickHeader(2, 4)
  const onTerritory = await evalJs(`(() => ({ active: window.__uiw.getState().currentPage().nodes[0].activeTab, dom: document.querySelectorAll('g[data-id]').length }))()`)
  await clickHeader(1, 4)
  const backToShop = await evalJs(`(() => ({ active: window.__uiw.getState().currentPage().nodes[0].activeTab, dom: document.querySelectorAll('g[data-id]').length }))()`)
  check('画布切换新页签', onTerritory.active === 2 && onTerritory.dom === 1 && backToShop.active === 1 && backToShop.dom === 2,
    `点领地：active=${onTerritory.active} 画布控件=${onTerritory.dom}/1；点回商城：active=${backToShop.active} 画布控件=${backToShop.dom}/2`)
  // 8.4 删除页签（去掉了 领地 与 页签 3）：商城按钮仍在
  await setTabsField('页签 1\n商城')
  const deleted = await evalJs(`(() => { const t = window.__uiw.getState().currentPage().nodes[0]; return { tabs: t.props.tabs, pageLens: t.pages.map(p => p.length) } })()`)
  check('删除页签', deleted.tabs?.join() === '页签 1,商城' && deleted.pageLens?.join() === '0,1',
    `tabs=[${deleted.tabs}]，各页子控件=[${deleted.pageLens}]`)

  // —— 8b. 页签栏高 / 页签字号：属性面板数值输入 → 渲染联动 ——
  await evalJs(`(() => { const st = window.__uiw.getState(); st.setSelection([st.currentPage().nodes[0].id]); return true })()`)
  await sleep(200)
  const setPropInput = async (label, value) => {
    await evalJs(`(() => {
      const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector('span')?.textContent === '${label}')
      const input = row && row.querySelector('input')
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, '${value}')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      // NumField 提交挂在 blur：给焦点再失焦触发
      input.focus()
      input.blur()
      return true
    })()`)
    await sleep(200)
  }
  const fieldsOk = await evalJs(`(() => {
    const labels = [...document.querySelectorAll('.prop-row span')].map(s => s.textContent)
    return { bar: labels.includes('页签栏高'), font: labels.includes('页签字号') }
  })()`)
  check('栏高字号字段', fieldsOk.bar && fieldsOk.font, `属性面板字段：栏高=${fieldsOk.bar}，字号=${fieldsOk.font}`)
  await setPropInput('页签栏高', 72)
  await setPropInput('页签字号', 30)
  const tabId = await evalJs(`window.__uiw.getState().currentPage().nodes[0].id`)
  const render72 = await evalJs(`(() => {
    const t = window.__uiw.getState().currentPage().nodes[0]
    const g = document.querySelector('g[data-id="${tabId}"]')
    const bar = g && g.querySelector('rect[fill="#eceff3"]')
    const text = g && [...g.querySelectorAll('text')][0]
    return {
      store: t.props.barHeight, font: t.props.fontSize,
      barH: bar ? Math.round(+bar.getAttribute('height')) : null,
      fontSize: text ? text.getAttribute('font-size') : null
    }
  })()`)
  check('栏高字号落渲染', render72.store === 72 && render72.font === 30 && render72.barH === 70 && render72.fontSize === '30',
    `store 栏高=${render72.store}/72 字号=${render72.font}/30，渲染栏底高=${render72.barH}/70，文字字号=${render72.fontSize}/30`)

  // —— 8c. 自定义栏高下页签头命中：点 (n.y+60)（默认 40 栏这里是内容区）→ 切到页签 1 ——
  const hit = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const n = st.currentPage().nodes[0]
    const v = st.viewport
    const r = document.querySelector('.canvas-wrap').getBoundingClientRect()
    return { x: r.x + v.panX + (n.x + n.w * 0.25) * v.zoom, y: r.y + v.panY + (n.y + 60) * v.zoom }
  })()`)
  await click(hit.x, hit.y)
  await sleep(250)
  const activeHit = await evalJs(`window.__uiw.getState().currentPage().nodes[0].activeTab`)
  check('栏高命中切换', activeHit === 0, `点击页签 1 头部（栏高 72 内）→ activeTab=${activeHit}/0`)
  await evalJs(`(() => { const st = window.__uiw.getState(); st.updateNodes([st.currentPage().nodes[0].id], n => { n.activeTab = 1 }, true); return true })()`)

  // —— 8d. 选中后页签栏分界拖拽手柄：下拖 40 → 栏高 72→110（10 网格吸附），内容区裁剪随动 ——
  const handleGeo = await evalJs(`(() => {
    const el = document.querySelector('.bar-handle')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  check('栏高手柄出现', !!handleGeo, `选中 Tab 后分界处出现拖拽手柄`)
  const zoom0 = await evalJs(`window.__uiw.getState().viewport.zoom`)
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: handleGeo.x, y: handleGeo.y, button: 'left', buttons: 1, clickCount: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: handleGeo.x, y: handleGeo.y + 40 * zoom0, button: 'left', buttons: 1 })
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: handleGeo.x, y: handleGeo.y + 40 * zoom0, button: 'left', buttons: 1, clickCount: 1 })
  await sleep(250)
  const dragState = await evalJs(`(() => {
    const t = window.__uiw.getState().currentPage().nodes[0]
    const clip = document.querySelector('clipPath#clip-${tabId} rect')
    return { barH: t.props.barHeight, clipY: clip ? Math.round(+clip.getAttribute('y')) : null, ty: t.y }
  })()`)
  check('拖拽调整栏高', dragState.barH === 110 && dragState.clipY === dragState.ty + 110,
    `拖后栏高=${dragState.barH}/110（吸附 10 网格），内容区裁剪 y=${dragState.clipY}（=${dragState.ty}+110）`)

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
