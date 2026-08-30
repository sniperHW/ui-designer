// CDP 界面操作驱动：仅通过输入事件（鼠标点击 / 键盘 / 文本插入）驱动应用真实 UI，
// 不直接改写工程数据（.uiw / store）。读取 store 仅用于校验与坐标换算。
export async function connect(port = 9222) {
  let targets = null
  for (let i = 0; i < 40; i++) {
    try {
      targets = await (await fetch(`http://localhost:${port}/json`)).json()
      if (targets.some((t) => t.type === 'page' && t.url.includes('localhost:5173'))) break
    } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  const page = targets?.find((t) => t.type === 'page' && t.url.includes('localhost:5173'))
  if (!page) throw new Error('未找到应用页面（dev server 未就绪？）')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  let dialogLog = []
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return }
    if (msg.method === 'Page.javascriptDialogOpening') {
      // 等价于人工点“确定”：关闭工程/删除确认等 window.confirm 弹窗
      dialogLog.push(msg.params.type + ':' + (msg.params.message ?? '').slice(0, 40))
      ws.send(JSON.stringify({ id: ++seq, method: 'Page.handleJavaScriptDialog', params: { accept: true } }))
    }
  }
  const call = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evalJs = async (expression) => {
    const r = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (r.exceptionDetails) throw new Error('eval 失败: ' + (r.exceptionDetails.exception?.description ?? '').slice(0, 300))
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  await call('Page.enable')
  return { ws, call, evalJs, sleep, dialogLog }
}

const VK = { Enter: [13, 'Enter'], Tab: [9, 'Tab'], Escape: [27, 'Escape'], a: [65, 'KeyA'], s: [83, 'KeyS'] }
const META = 4

/** 界面操作集合 */
export function makeUI({ call, evalJs, sleep }) {
  const ops = { count: 0 }
  const bump = () => { ops.count++ }

  const mouse = (type, x, y, opts = {}) => {
    bump()
    const p = { type, x: Math.round(x), y: Math.round(y), button: 'left', clickCount: opts.clickCount ?? 1 }
    if (type === 'mousePressed') p.buttons = 1
    if (opts.modifiers) p.modifiers = opts.modifiers
    return call('Input.dispatchMouseEvent', p)
  }
  const click = async (x, y) => {
    await mouse('mousePressed', x, y)
    await mouse('mouseReleased', x, y)
  }
  const insert = (text) => { bump(); return call('Input.insertText', { text }) }
  const metaKey = (down) => call('Input.dispatchKeyEvent', down
    ? { type: 'rawKeyDown', key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91, nativeVirtualKeyCode: 91 }
    : { type: 'keyUp', key: 'Meta', code: 'MetaLeft', windowsVirtualKeyCode: 91, nativeVirtualKeyCode: 91 })
  const key = async (name, mods = 0) => {
    bump()
    const [vk, code] = VK[name] ?? [0, name]
    if (mods & META) await metaKey(true)
    await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: mods, key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
    await call('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: mods, key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
    if (mods & META) await metaKey(false)
  }

  // ---------- DOM 查找（返回元素中心坐标） ----------
  const findRectJs = (finderJs) => `(() => { const el = (${finderJs}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, tag: el.tagName } })()`

  const libItemEl = (label) => `[...document.querySelectorAll('.lib-item')].find(i => i.querySelector('.lib-label')?.textContent?.trim() === ${JSON.stringify(label)})`
  const fieldEl = (label) => `[...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === ${JSON.stringify(label)})?.querySelector('input,textarea')`
  const segBtnEl = (rowLabel, btnText) => `(() => { const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === ${JSON.stringify(rowLabel)}); return row ? [...row.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(btnText)}) : null })()`
  const checkboxEl = (rowLabel) => `(() => { const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === ${JSON.stringify(rowLabel)}); return row?.querySelector('input[type=checkbox]') ?? null })()`
  const layerRowEl = (name) => `[...document.querySelectorAll('.layer-row')].find(r => r.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(name)})`
  const pageRowEl = (kw) => `[...document.querySelectorAll('.common-row,.page-row')].find(r => r.querySelector('.page-name')?.textContent?.includes(${JSON.stringify(kw)}))`
  const anyBtnEl = (text) => `[...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).find(b => b.textContent.trim() === ${JSON.stringify(text)})`
  const menuItemEl = (menu, item) => `(() => { const m = [...document.querySelectorAll('details.menu')].find(d => d.querySelector('summary')?.textContent?.trim() === ${JSON.stringify(menu)}); if (!m) return null; m.open = true; return [...m.querySelectorAll('.menu-item')].find(i => i.textContent.includes(${JSON.stringify(item)})) ?? null })()`

  const clickEl = async (finderJs, desc) => {
    const p = await evalJs(findRectJs(finderJs))
    if (!p) throw new Error('界面元素未找到: ' + desc)
    await click(p.x, p.y)
    await sleep(30)
    return p
  }

  const dblClick = async (x, y) => {
    await mouse('mousePressed', x, y, { clickCount: 1 })
    await mouse('mouseReleased', x, y, { clickCount: 1 })
    await mouse('mousePressed', x, y, { clickCount: 2 })
    await mouse('mouseReleased', x, y, { clickCount: 2 })
  }
  const tripleClick = async (x, y) => {
    await dblClick(x, y)
    await mouse('mousePressed', x, y, { clickCount: 3 })
    await mouse('mouseReleased', x, y, { clickCount: 3 })
  }

  /** 通用输入框录入：finderJs 返回 input/textarea 元素。全选（输入框=三连击；textarea=select()）→ 输入 → Enter（单行）/Tab（多行）提交 → 回读校验，失败重试（每次重查坐标） */
  const fillDom = async (finderJs, value, desc, okWhenGone = false) => {
    const valJs = `(() => { const el = (${finderJs}); return el ? el.value : null })()`
    for (let attempt = 0; attempt < 3; attempt++) {
      const p = await evalJs(findRectJs(finderJs))
      if (!p) throw new Error('输入框未找到: ' + desc)
      await click(p.x, p.y)
      await sleep(20)
      if (p.tag === 'TEXTAREA') await evalJs(`(() => { const el = (${finderJs}); el.focus(); el.select(); return true })()`)
      else await tripleClick(p.x, p.y)
      await sleep(30)
      await insert(String(value))
      await sleep(20)
      if (p.tag === 'TEXTAREA') await key('Tab')
      else await key('Enter')
      await sleep(60)
      const got = await evalJs(valJs)
      if (got === String(value)) return
      if (okWhenGone && got === null) return
      console.log(`  ⚠️ 输入框 ${desc} 第 ${attempt + 1} 次回读不符（got=${JSON.stringify(got)}），重试`)
    }
    throw new Error(`输入框 ${desc} 提交失败（期望 ${JSON.stringify(String(value))}）`)
  }
  const fillField = (label, value) => fillDom(fieldEl(label), value, `字段:${label}`)

  const clickSeg = (rowLabel, btnText) => clickEl(segBtnEl(rowLabel, btnText), `段按钮 ${rowLabel}/${btnText}`)
  const checkRow = async (rowLabel) => clickEl(checkboxEl(rowLabel), `勾选 ${rowLabel}`)
  const clickLib = (label) => clickEl(libItemEl(label), `控件库 ${label}`)
  const clickLayer = (name) => clickEl(layerRowEl(name), `图层 ${name}`)
  const clickPage = (kw) => clickEl(pageRowEl(kw), `页面 ${kw}`)
  const clickAnyBtn = (text) => clickEl(anyBtnEl(text), `按钮 ${text}`)
  const clickMenu = (menu, item) => clickEl(menuItemEl(menu, item), `菜单 ${menu}/${item}`)

  /** 只读：当前选中的节点信息 */
  const readSel = () => evalJs(`(() => {
    const s = window.__uiw.getState()
    let f = null
    const walk = (arr) => { for (const n of arr) { if (s.selectedIds.includes(n.id)) f = n
      const subs = [...(n.pages ?? []), ...(n.children ? [n.children] : []), ...(n.slots ? Object.values(n.slots) : [])]
      for (const c of subs) walk(c) } }
    walk(s.editRoot())
    return f ? { id: f.id, type: f.type, name: f.name, x: f.x, y: f.y, w: f.w, h: f.h, props: f.props, activeTab: f.activeTab ?? null, overrides: f.overrides ?? null } : null
  })()`)

  /** 只读：工程概况 */
  const readOverview = () => evalJs(`(() => { const s = window.__uiw.getState(); return {
    hasProject: s.hasProject, meta: s.doc.meta, page: s.currentPageIndex, sel: s.selectedIds.length,
    common: s.doc.commonLayer.nodes.length, pages: s.doc.pages.map(p => ({ name: p.name, nodes: p.nodes.length })),
    customs: s.doc.customWidgets.length } })()`)

  return { ops, mouse, click, dblClick, tripleClick, key, insert, sleep, evalJs, call, clickLib, fillField, fillDom, clickSeg, checkRow, clickLayer, clickPage, clickAnyBtn, clickMenu, readSel, readOverview }
}
