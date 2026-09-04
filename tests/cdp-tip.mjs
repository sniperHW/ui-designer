// 轻提示专项测试：tooltip 控件（轻提示页）+ tipTarget 标记（悬停弹出 / 移开关闭）+ 编辑器守护规则
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
  const move = (x, y) => call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
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

  // 防阻塞 + 收集 alert
  await evalJs(`(() => { window.__alerts = []; window.alert = (m) => window.__alerts.push(m); window.confirm = () => true; return true })()`)

  // —— 准备：1 页工程 + 两个可悬停控件（中部占位图 / 顶部按钮）+ 定制控件（定义内按钮配轻提示）——
  const setup = await evalJs(`(() => {
    const D = (t) => window.__uiwDefs.find(d => d.type === t)
    let st = window.__uiw.getState()
    st.newProject({ name: '轻提示测试', designWidth: 1334, designHeight: 750, orientation: 'landscape' })
    st = window.__uiw.getState()
    st.addWidget(D('placeholder'), 400, 400)   // 页面中部：悬停目标 1
    st.addWidget(D('button'), 667, 60)         // 页面顶部：悬停目标 2（验证下方翻转）
    st = window.__uiw.getState()
    const ph = st.currentPage().nodes.find(n => n.type === 'placeholder')
    const bt = st.currentPage().nodes.find(n => n.type === 'button')
    st.updateNodes([bt.id], n => { n.props.text = '帮助'; n.y = 0 })
    // 轻提示页 ×2（自带居中 tooltip 本体），中部目标 → 提示 1；顶部按钮 → 提示 2
    const tp1 = st.addTip()
    const tp2 = window.__uiw.getState().addTip()
    st = window.__uiw.getState()
    st.setEditingTip(tp1)
    st.updateNodes([st.doc.tips[0].nodes[0].id], n => { n.w = 300; n.h = 150 })
    st.setEditingTip(null)
    st.updateNodes([ph.id], n => { n.tipTarget = tp1 })
    st.updateNodes([bt.id], n => { n.tipTarget = tp2 })
    // 定制控件：定义内按钮配轻提示 1 → 实例悬停命中区域触发
    const wid = st.createCustomWidget({ kind: 'blank' })
    st.setEditingWidget(wid)
    window.__uiw.getState().addWidget(D('button'), 80, 60)
    const s2 = window.__uiw.getState()
    const defBtn = s2.doc.customWidgets.find(w => w.id === wid).tree.find(n => n.type === 'button')
    s2.updateNodes([defBtn.id], n => { n.tipTarget = tp1 })
    window.__uiw.getState().setEditingWidget(null)
    window.__uiw.getState().addWidgetCustom(wid, 1000, 400)
    const fin = window.__uiw.getState()
    const d = fin.doc.customWidgets.find(w => w.id === wid)
    const inst = fin.currentPage().nodes.find(n => n.type === 'custom' && n.customId === wid)
    const b = d.tree.find(n => n.type === 'button')
    return {
      ph: fin.currentPage().nodes.find(n => n.id === ph.id),
      bt: fin.currentPage().nodes.find(n => n.id === bt.id),
      tp1, tp2, inst,
      defW: d.w, defH: d.h,
      btnCx: b.x + b.w / 2, btnCy: b.y + b.h / 2
    }
  })()`)
  await sleep(300)

  // —— 1. 轻提示页与本体：列表分组条目 + 编辑目标 chip + 本体存在 + 渲染含尾箭头 ——
  const tipState = await evalJs(`(() => {
    const st = window.__uiw.getState()
    const rows = [...document.querySelectorAll('.page-row.popup-row')].map(r => r.textContent)
    return {
      count: st.doc.tips.length,
      name1: st.doc.tips[0].name,
      bodyType: st.doc.tips[0].nodes[0]?.type,
      groupName: [...document.querySelectorAll('.popup-group-title')].map(e => e.textContent).join('|'),
      footBtn: [...document.querySelectorAll('.page-foot .tb-btn')].some(b => b.textContent.includes('新建轻提示'))
    }
  })()`)
  check('新建轻提示页', tipState.count === 2 && tipState.bodyType === 'tooltip' && tipState.groupName.includes('轻提示') && tipState.footBtn,
    `tips=${tipState.count}，本体=${tipState.bodyType}，分组"${tipState.groupName}"，页脚新建按钮=${tipState.footBtn}`)

  await evalJs(`window.__uiw.getState().setEditingTip(window.__uiw.getState().doc.tips[0].id)`)
  await sleep(250)
  const editState = await evalJs(`(() => ({
    chip: [...document.querySelectorAll('.edit-target-bar .chip')].some(c => c.textContent.includes('轻提示 1')),
    status: document.querySelector('.statusbar')?.textContent ?? '',
    badge: [...document.querySelectorAll('.common-badge')].some(b => b.textContent.includes('正在编辑轻提示')),
    layerTitle: document.querySelector('.layers .panel-title')?.textContent ?? ''
  }))()`)
  check('轻提示编辑目标', editState.chip && editState.badge && editState.status.includes('轻提示') && editState.layerTitle.includes('轻提示'),
    `chip=${editState.chip}，画布提示条=${editState.badge}，状态栏含「轻提示」=${editState.status.includes('轻提示')}，图层标题="${editState.layerTitle}"`)

  // —— 2. 本体保护：选中根级 tooltip → Delete 不删；图层树「轻提示」标记 ——
  await evalJs(`window.__uiw.getState().setSelection([window.__uiw.getState().doc.tips[0].nodes[0].id])`)
  await sleep(150)
  await evalJs(`window.__uiw.getState().deleteSelected()`)
  await sleep(200)
  const bodyKept = await evalJs(`window.__uiw.getState().doc.tips[0].nodes.length`)
  check('本体删除保护', bodyKept === 1, `删除后本体仍在=${bodyKept === 1}`)
  await evalJs(`window.__uiw.getState().setEditingTip(null)`)
  await sleep(150)

  // —— 3. 落点拦截：普通页面上拖入 tooltip → alert 且不添加 ——
  await evalJs(`(() => {
    const D = window.__uiwDefs.find(d => d.type === 'tooltip')
    window.__uiw.getState().addWidget(D, 300, 300)
    return true
  })()`)
  await sleep(150)
  const blocked = await evalJs(`(() => ({
    alerts: window.__alerts.filter(a => a.includes('轻提示框只能放在轻提示页')).length,
    onPage: [...window.__uiw.getState().currentPage().nodes, ...window.__uiw.getState().doc.commonLayer.nodes].some(n => n.type === 'tooltip')
  }))()`)
  check('普通页拦截', blocked.alerts > 0 && !blocked.onPage, `拦截提示=${blocked.alerts > 0}，页面未出现=${!blocked.onPage}`)

  // —— 4. 属性面板「轻提示」区：普通控件显示 / 定制实例不显示 ——
  await evalJs(`window.__uiw.getState().setSelection([window.__uiw.getState().currentPage().nodes.find(n => n.type === 'placeholder').id])`)
  await sleep(200)
  const secNormal = await evalJs(`[...document.querySelectorAll('.right h4')].some(h => h.textContent === '轻提示')`)
  await evalJs(`window.__uiw.getState().setSelection([${JSON.stringify(setup.inst.id)}])`)
  await sleep(200)
  const secCustom = await evalJs(`[...document.querySelectorAll('.right h4')].some(h => h.textContent === '轻提示')`)
  check('属性区显隐', secNormal === true && secCustom === false,
    `普通控件有「轻提示」区=${secNormal}，定制实例无=${!secCustom}`)

  // —— 5. ▶ 演示（编辑器画布 TipLayer）：弹出 → Esc 关闭 ——
  await evalJs(`window.__uiw.getState().setSelection([${JSON.stringify(setup.ph.id)}])`)
  await sleep(150)
  const demoBtn = await evalJs(`(() => {
    const secs = [...document.querySelectorAll('.right .prop-section')].filter(s => s.querySelector('h4')?.textContent === '轻提示')
    const btn = secs[0] && [...secs[0].querySelectorAll('button')].find(b => b.textContent.includes('演示轻提示'))
    if (!btn) return null
    const r = btn.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  await click(demoBtn.x, demoBtn.y)
  await sleep(300)
  const demoOn = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { tip: !!st.tip, tipId: st.tip?.tipId, badge: [...document.querySelectorAll('.popup-badge')].some(b => b.textContent.includes('轻提示演示')) }
  })()`)
  check('演示轻提示', demoOn.tip === true && demoOn.tipId === setup.tp1 && demoOn.badge,
    `tip=${demoOn.tip}（=${demoOn.tipId === setup.tp1}），提示条=${demoOn.badge}`)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(200)
  const demoOff = await evalJs(`window.__uiw.getState().tip === null`)
  check('Esc关演示', demoOff === true, 'Esc 后 tip 收起')

  // —— 6. 重命名同步：轻提示页名 ↔ 本体图层名 ——
  await evalJs(`window.__uiw.getState().renameTip(${JSON.stringify(setup.tp1)}, '金币说明')`)
  await sleep(200)
  const renamed = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { name: st.doc.tips[0].name, body: st.doc.tips[0].nodes[0].name, row: [...document.querySelectorAll('.page-row.popup-row')][0]?.textContent ?? '' }
  })()`)
  check('重命名同步', renamed.name === '金币说明' && renamed.body === '金币说明' && renamed.row.includes('金币说明'),
    `页名="${renamed.name}"，本体名="${renamed.body}"，列表行含新名=${renamed.row.includes('金币说明')}`)

  // —— 7. 图层树标记：带 tipTarget 的控件显示「轻提示」——
  await evalJs(`window.__uiw.getState().setCurrentPage(0)`)
  await sleep(250)
  const layerTag = await evalJs(`(() => {
    const rows = [...document.querySelectorAll('.layer-row')]
    const phRow = rows.find(r => r.textContent.includes('占位图'))
    return phRow ? !!phRow.querySelector('.clickable-tag') && phRow.textContent.includes('轻提示') : false
  })()`)
  check('图层树标记', layerTag === true, '占位图行显示「轻提示」标记')

  // —— 8. 预览：悬停弹出 / 移开关闭；下方翻转 ——
  await evalJs(`window.__uiw.getState().startPreview()`)
  await sleep(400)
  let pt = await pv(setup.ph.x + setup.ph.w / 2, setup.ph.y + setup.ph.h / 2)
  await move(pt.x, pt.y)
  await sleep(350)
  const hoverOn = await evalJs(`(() => {
    const st = window.__uiw.getState()
    return { tip: st.tip?.tipId ?? null, y: st.tip?.y ?? -1 }
  })()`)
  check('悬停弹出', hoverOn.tip === setup.tp1 && hoverOn.y === setup.ph.y,
    `tip=${hoverOn.tip === setup.tp1 ? '金币说明' : hoverOn.tip}，锚定y=${hoverOn.y}/${setup.ph.y}`)
  // 移开到空白 → 关闭
  pt = await pv(30, 700)
  await move(pt.x, pt.y)
  await sleep(350)
  const hoverOff = await evalJs(`window.__uiw.getState().tip === null`)
  check('移开关闭', hoverOff === true, '鼠标移开后 tip 收起')
  // 顶部按钮（y=0 上方无空间）→ 下方显示（尾箭头翻转，锚定仍是按钮矩形）
  pt = await pv(setup.bt.x + setup.bt.w / 2, setup.bt.y + setup.bt.h / 2)
  await move(pt.x, pt.y)
  await sleep(350)
  const below = await evalJs(`(() => {
    const st = window.__uiw.getState()
    if (!st.tip) return { ok: false }
    const shown = st.doc.tips.find(p => p.id === st.tip.tipId)
    const body = shown.nodes.find(n => n.type === 'tooltip')
    const g = [...document.querySelectorAll('.preview-stage svg g[transform]')].find(el =>
      el.getAttribute('transform')?.startsWith('translate(') && el.querySelectorAll('path').length > 0)
    return { ok: st.tip.tipId === ${JSON.stringify(setup.tp2)}, ty: st.tip.y, bodyH: body.h, tail: body.props.tail ?? 'bottom' }
  })()`)
  check('顶部下方翻转', below.ok === true && below.ty === setup.bt.y,
    `顶部按钮弹出提示 2=${below.ok}，锚定y=${below.ty}/${setup.bt.y}`)
  pt = await pv(30, 700)
  await move(pt.x, pt.y)
  await sleep(300)

  // —— 9. 定制实例：悬停定义内按钮区域触发（定义级标记），空白区不触发 ——
  const hit = {
    x: setup.inst.x + (setup.btnCx * setup.inst.w) / setup.defW,
    y: setup.inst.y + (setup.btnCy * setup.inst.h) / setup.defH
  }
  pt = await pv(hit.x, hit.y)
  await move(pt.x, pt.y)
  await sleep(350)
  const instHover = await evalJs(`window.__uiw.getState().tip?.tipId ?? null`)
  check('实例命中触发', instHover === setup.tp1, `悬停实例按钮区域 → tip=${instHover === setup.tp1 ? '金币说明' : instHover}`)
  const blank = { x: setup.inst.x + 40, y: setup.inst.y + 200 }
  pt = await pv(blank.x, blank.y)
  await move(pt.x, pt.y)
  await sleep(350)
  const instBlank = await evalJs(`window.__uiw.getState().tip === null`)
  check('实例空白不触发', instBlank === true, '悬停实例无标记区域 → 无 tip')

  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(300)

  // —— 9b. 嵌套定制实例：定义内再嵌实例（如牌组里的部队），悬停命中区域锚定逐层换算 ——
  const nested = await evalJs(`(() => {
    const D = (t) => window.__uiwDefs.find(d => d.type === t)
    let st = window.__uiw.getState()
    const inner = st.createCustomWidget({ kind: 'blank' })
    st.setEditingWidget(inner)
    window.__uiw.getState().addWidget(D('rect'), 50, 50)
    const s1 = window.__uiw.getState()
    const innerDef = s1.doc.customWidgets.find(w => w.id === inner)
    const mark = innerDef.tree.find(n => n.type === 'rect')
    s1.updateNodes([mark.id], n => { n.x = 20; n.y = 20; n.w = 60; n.h = 60; n.tipTarget = ${JSON.stringify(setup.tp2)} })
    window.__uiw.getState().setEditingWidget(null)
    const outer = window.__uiw.getState().createCustomWidget({ kind: 'blank' })
    window.__uiw.getState().setEditingWidget(outer)
    window.__uiw.getState().addWidgetCustom(inner, 160, 140)
    const s2 = window.__uiw.getState()
    const od = s2.doc.customWidgets.find(w => w.id === outer)
    const ii = od.tree.find(n => n.type === 'custom')
    s2.updateNodes([ii.id], n => { n.x = 60; n.y = 60; n.w = 160; n.h = 160 })
    window.__uiw.getState().setEditingWidget(null)
    window.__uiw.getState().setCurrentPage(0)
    window.__uiw.getState().addWidgetCustom(outer, 650, 400)
    const fin = window.__uiw.getState()
    const od2 = fin.doc.customWidgets.find(w => w.id === outer)
    const idf = fin.doc.customWidgets.find(w => w.id === inner)
    const ii2 = od2.tree.find(n => n.type === 'custom')
    const mk = idf.tree.find(n => n.type === 'rect')
    const oi = fin.currentPage().nodes.find(n => n.type === 'custom' && n.customId === outer)
    return JSON.stringify({
      inst: { x: oi.x, y: oi.y, w: oi.w, h: oi.h },
      outerW: od2.w, outerH: od2.h,
      innerInst: { x: ii2.x, y: ii2.y, w: ii2.w, h: ii2.h },
      innerW: idf.w, innerH: idf.h,
      mark: { x: mk.x, y: mk.y, w: mk.w, h: mk.h },
      markTip: mk.tipTarget ?? null
    })
  })()`)
  const ns = JSON.parse(nested)
  // 逐层换算标记矩形：内层局部 → 外层局部（内层实例）→ 页面（外层实例）
  const inOuter = {
    x: ns.innerInst.x + (ns.mark.x * ns.innerInst.w) / ns.innerW,
    y: ns.innerInst.y + (ns.mark.y * ns.innerInst.h) / ns.innerH,
    w: (ns.mark.w * ns.innerInst.w) / ns.innerW,
    h: (ns.mark.h * ns.innerInst.h) / ns.innerH
  }
  const anchor = {
    x: ns.inst.x + (inOuter.x * ns.inst.w) / ns.outerW,
    y: ns.inst.y + (inOuter.y * ns.inst.h) / ns.outerH,
    w: (inOuter.w * ns.inst.w) / ns.outerW,
    h: (inOuter.h * ns.inst.h) / ns.outerH
  }
  await sleep(300)
  await evalJs(`window.__uiw.getState().startPreview()`)
  await sleep(400)
  pt = await pv(anchor.x + anchor.w / 2, anchor.y + anchor.h / 2)
  await move(pt.x, pt.y)
  await sleep(350)
  const nestedHover = await evalJs(`(() => {
    const t = window.__uiw.getState().tip
    return t ? JSON.stringify({ id: t.tipId, x: Math.round(t.x), y: Math.round(t.y), w: Math.round(t.w) }) : null
  })()`)
  const nh = nestedHover ? JSON.parse(nestedHover) : null
  const exp = { x: Math.round(anchor.x), y: Math.round(anchor.y), w: Math.round(anchor.w) }
  check(
    '嵌套实例锚定',
    !!nh && nh.id === ns.markTip && Math.abs(nh.x - exp.x) <= 2 && Math.abs(nh.y - exp.y) <= 2 && Math.abs(nh.w - exp.w) <= 2,
    `tip=${nh ? nh.id : '无'}，锚定(${nh ? nh.x : '-'},${nh ? nh.y : '-'},${nh ? nh.w : '-'})（期望 ${exp.x},${exp.y},${exp.w}）`
  )
  pt = await pv(30, 700)
  await move(pt.x, pt.y)
  await sleep(250)
  await evalJs("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
  await sleep(300)

  // —— 10. 删除轻提示：引用清理 + 列表移除 ——
  await evalJs(`window.__uiw.getState().deleteTip(${JSON.stringify(setup.tp1)})`)
  await sleep(250)
  const afterDel = await evalJs(`(() => {
    const st = window.__uiw.getState()
    let refs = 0
    const walk = (arr) => arr.forEach(n => { if (n.tipTarget === ${JSON.stringify(setup.tp1)}) refs++; (n.children || []).forEach(walk); (n.pages || []).forEach(walk) })
    walk(st.currentPage().nodes)
    st.doc.customWidgets.forEach(w => walk(w.tree))
    return { count: st.doc.tips.length, refs }
  })()`)
  check('删除轻提示', afterDel.count === 1 && afterDel.refs === 0,
    `剩余 tips=${afterDel.count}/1，残留引用=${afterDel.refs}/0（页面与定义树均已清理）`)

  console.log(JSON.stringify(results, null, 2))
  ws.close()
}
main().catch((e) => { console.error('测试失败:', e.message); process.exit(1) })
