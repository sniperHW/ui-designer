// 界面操作改造（续 2）：战斗页左侧活动 → 「左侧活动」定制控件；右侧活动 → 「侧栏活动」定制控件
import { connect, makeUI } from './driver.mjs'
import { readFileSync, writeFileSync } from 'fs'

const FILE = '/Users/huangwei/ui-designer/examples/竞技场-界面操作原型.uiw'
const { call, evalJs, sleep } = await connect(9222)
const ui = makeUI({ call, evalJs, sleep })
const t0 = Date.now()
let idx = 0
const log = (m) => console.log(`[${String(++idx).padStart(3, '0')} ${Math.round((Date.now() - t0) / 1000)}s] ${m}`)
const failures = []
const tryStep = async (desc, fn) => {
  try { await fn(); log('✓ ' + desc) } catch (e) { failures.push(desc + ': ' + e.message); console.log(`  ✗ ${desc}: ${e.message}`) }
}

const clickLayerOcc = async (name, occ = 1, shift = false) => {
  const r = await evalJs(`(() => { const m = [...document.querySelectorAll('.layer-row')].filter(x => x.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(name)}); const el = m[${occ - 1}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!r) throw new Error('图层未找到 ' + name)
  await ui.mouse('mousePressed', r.x, r.y, shift ? { modifiers: 8 } : {})
  await ui.mouse('mouseReleased', r.x, r.y, shift ? { modifiers: 8 } : {})
  await sleep(60)
  return await ui.readSel()
}
const rowsByNames = async (names) => evalJs(`(() => { const set = new Set(${JSON.stringify(names)}); return [...document.querySelectorAll('.layer-row')].map((r, i) => ({ i, name: r.querySelector('.layer-name')?.textContent?.trim() })).filter(r => r.name && set.has(r.name)).map(r => r.i) })()`)
const selectRows = async (idxs, expected) => {
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k]
    const r = await evalJs(`(() => { const el = document.querySelectorAll('.layer-row')[${i}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!r) throw new Error('行不存在 #' + i)
    await ui.mouse('mousePressed', r.x, r.y, k > 0 ? { modifiers: 8 } : {})
    await ui.mouse('mouseReleased', r.x, r.y, k > 0 ? { modifiers: 8 } : {})
    await sleep(45)
  }
  const n = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (n !== expected) throw new Error(`多选 ${n} ≠ ${expected}`)
}
const deleteSelected = async () => { await ui.key('Backspace'); await sleep(90) }
const switchTab = async (nodeName, btnNo) => {
  for (let i = 0; i < 3; i++) {
    await clickLayerOcc(nodeName)
    const b = await evalJs(`(() => { const row = [...document.querySelectorAll('.prop-row')].find(r => r.querySelector(':scope>span')?.textContent?.trim() === '当前页签'); const btn = row && [...row.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(String(btnNo))}); if (!btn) return null; const r = btn.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!b) throw new Error('当前页签按钮未找到')
    await ui.click(b.x, b.y); await sleep(110)
    const n = await ui.readSel()
    if (n && n.activeTab === btnNo - 1) return
  }
  throw new Error('切页签失败 ' + nodeName)
}
const saveAsCustom = async () => {
  await ui.clickMenu('控件', '存为定制控件')
  await sleep(150)
  const n = await ui.readSel()
  if (!n || n.type !== 'custom') throw new Error('存为定制控件失败')
  return n
}
const enterDefEdit = async () => { await ui.clickAnyBtn('编辑定义（改一处全局生效）'); await sleep(150) }
const exitDefEdit = async () => { await ui.clickAnyBtn('📄 主界面'); await sleep(150) }
const renameDef = async (name) => { await ui.fillField('名称', name); await ui.clickAnyBtn('保存发布设置'); await sleep(80) }
const bindProp = async (rowName, propName) => {
  await clickLayerOcc(rowName)
  await ui.fillField('新属性名', propName)
  await ui.clickAnyBtn('绑定')
  await sleep(90)
}
const addInstance = async (lib, x, y, overrides = {}) => {
  await ui.clickLib(lib)
  await sleep(70)
  const n0 = await ui.readSel()
  if (!n0 || n0.type !== 'custom') throw new Error(`${lib} 实例化失败`)
  await ui.fillField('X', x)
  await ui.fillField('Y', y)
  for (const [k, v] of Object.entries(overrides)) await ui.fillField(k, v)
  const n = await ui.readSel()
  if (n.x !== x || n.y !== y) throw new Error(`位置 ${n.x},${n.y} ≠ ${x},${y}`)
  for (const [k, v] of Object.entries(overrides)) {
    if (JSON.stringify(n.overrides?.[k]) !== JSON.stringify(v)) throw new Error(`覆盖 ${k} 错: ${JSON.stringify(n.overrides)}`)
  }
}

// ---------- 0. 载入工程 ----------
{
  const content = readFileSync(FILE, 'utf8')
  await evalJs(`(() => { window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(FILE)}); return true })()`)
  await sleep(400)
  if (!(await ui.readOverview()).hasProject) throw new Error('工程载入失败')
  log('工程已载入')
}

// ---------- 1. 左侧活动 ----------
await tryStep('左侧：切到战斗页', async () => { await switchTab('底部导航', 3) })
await tryStep('左侧：第 1 个活动存为定制控件', async () => {
  // 图层倒序：第 1 个活动的控件 = occ 3
  await clickLayerOcc('左侧活动图', 3)
  await clickLayerOcc('倒计时', 3, true)
  const cnt = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (cnt !== 2) throw new Error('选了 ' + cnt)
  await saveAsCustom()
})
await tryStep('左侧：定义改名「左侧活动」+ 暴露 倒计时', async () => {
  await enterDefEdit()
  await renameDef('左侧活动')
  await bindProp('倒计时', '倒计时')
  const defs = await evalJs(`(() => { const d = window.__uiw.getState().doc.customWidgets; return d.map(w => ({ n: w.name, p: w.props.map(x => x.name) })) })()`)
  const def = defs.find(w => w.n === '左侧活动')
  if (!def || def.p.join() !== '倒计时') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('左侧：删除临时实例', async () => { await clickLayerOcc('定制控件 5'); await deleteSelected() })
await tryStep('左侧：删除其余 2 个活动（4 控件）', async () => {
  const idxs = await rowsByNames(['左侧活动图', '倒计时'])
  if (idxs.length !== 4) throw new Error('行数 ' + idxs.length)
  await selectRows(idxs, 4)
  await deleteSelected()
})
const leftItems = [['1天16时1分', 430], ['1天16时1分', 560], ['16时1分53秒', 686]]
for (const [t, y] of leftItems) {
  const overrides = t !== '1天16时1分' ? { 倒计时: t } : {}
  await tryStep(`左侧：实例 (${0},${y}) ${t}`, async () => { await addInstance('左侧活动', 0, y, overrides) })
}

// ---------- 2. 右侧活动 ----------
await tryStep('右侧：第 1 个活动存为定制控件', async () => {
  // 图层倒序：第 1 个活动的控件 = occ 5
  await clickLayerOcc('礼包图', 5)
  await clickLayerOcc('礼包名', 5, true)
  const cnt = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (cnt !== 2) throw new Error('选了 ' + cnt)
  await saveAsCustom()
})
await tryStep('右侧：定义改名「侧栏活动」+ 暴露 名称', async () => {
  await enterDefEdit()
  await renameDef('侧栏活动')
  await bindProp('礼包名', '名称')
  const defs = await evalJs(`(() => { const d = window.__uiw.getState().doc.customWidgets; return d.map(w => ({ n: w.name, p: w.props.map(x => x.name) })) })()`)
  const def = defs.find(w => w.n === '侧栏活动')
  if (!def || def.p.join() !== '名称') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('右侧：删除临时实例', async () => { await clickLayerOcc('定制控件 6'); await deleteSelected() })
await tryStep('右侧：删除其余 4 个活动（8 控件）', async () => {
  const idxs = await rowsByNames(['礼包图', '礼包名'])
  if (idxs.length !== 8) throw new Error('行数 ' + idxs.length)
  await selectRows(idxs, 8)
  await deleteSelected()
})
const rightItems = [['桌面好礼', 320], ['入口有奖', 450], ['新手礼包', 580], ['基金', 710], ['月卡+20%', 840]]
for (const [t, y] of rightItems) {
  const overrides = t !== '桌面好礼' ? { 名称: t } : {}
  await tryStep(`右侧：实例 (${612},${y}) ${t}`, async () => { await addInstance('侧栏活动', 612, y, overrides) })
}

// ---------- 3. 保存 ----------
await tryStep('保存工程', async () => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(120)
  await evalJs(`(async () => { const s = window.__uiw.getState(); const path = await window.api.saveProject({ content: JSON.stringify(s.doc, null, 2), knownPath: s.filePath }); if (path) s.markSaved(path); return true })()`)
  await sleep(700)
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); return { dirty: s.dirty, fp: !!s.filePath } })()`)
  if (st.dirty || !st.fp) throw new Error('保存状态 ' + JSON.stringify(st))
})

// ---------- 4. 截图 ----------
const shot = async (file) => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(100)
  const rect = await evalJs(`(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`)
  const s = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 2 } })
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  log('📸 ' + file)
}
await tryStep('截图 战斗页', async () => { await switchTab('底部导航', 3); await shot('/tmp/arena-shots/v4-battle.png') })

// ---------- 5. 结构校验（只读）----------
{
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); const battle = s.doc.pages[0].nodes[0].pages[2]; return {
    defs: s.doc.customWidgets.map(w => w.name + '(' + w.props.map(p => p.name).join('/') + ')'),
    left: battle.filter(c => c.name === '左侧活动' || c.name.startsWith('左侧活动 ')).length,
    right: battle.filter(c => c.name === '侧栏活动' || c.name.startsWith('侧栏活动 ')).length,
    leftovers: battle.filter(c => c.name === '左侧活动图' || c.name === '倒计时' || c.name === '礼包图' || c.name === '礼包名').length,
    samples: battle.filter(c => c.type === 'custom').map(c => c.name + '@' + c.x + ',' + c.y + JSON.stringify(c.overrides || {}))
  } })()`)
  console.log(JSON.stringify(st, null, 1))
}

console.log(failures.length ? 'CUSTOM3-FAILED:\n' + failures.map(f => '  ✗ ' + f).join('\n') : 'CUSTOM3-OK')
