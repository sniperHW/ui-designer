// 界面操作改造（续）：排行榜条目 → 定制控件「榜单条目」；战斗页竞技场宝箱 → 定制控件「竞技场宝箱」
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
const deleteThrowaway = async (name) => { await clickLayerOcc(name); await deleteSelected() }
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
    if (JSON.stringify(n.overrides?.[k]) !== JSON.stringify(v)) throw new Error(`覆盖 ${k} 错`)
  }
}

// ---------- 0. 载入工程 ----------
{
  const content = readFileSync(FILE, 'utf8')
  await evalJs(`(() => { window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(FILE)}); return true })()`)
  await sleep(400)
  const ov = await ui.readOverview()
  if (!ov.hasProject) throw new Error('工程载入失败')
  log(`工程已载入：定制控件 ${ov.customs} 个`)
}

// ---------- 1. 排行榜：榜单条目 定制控件 ----------
await tryStep('榜单：切到排名页', async () => { await switchTab('底部导航', 4) })
await tryStep('榜单：第 58 名行存为定制控件', async () => {
  // 图层倒序：第 58 名的通用名控件在最后 = occ 12
  await clickLayerOcc('榜单行58', 1)
  await clickLayerOcc('名次', 12, true)
  await clickLayerOcc('榜单头像', 12, true)
  await clickLayerOcc('榜单玩家名', 12, true)
  await clickLayerOcc('榜单奖杯数', 12, true)
  const cnt = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (cnt !== 5) throw new Error('选了 ' + cnt)
  await saveAsCustom()
})
await tryStep('榜单：定义改名「榜单条目」+ 暴露 名次/玩家名/奖杯数', async () => {
  await enterDefEdit()
  await renameDef('榜单条目')
  await bindProp('名次', '名次')
  await bindProp('榜单玩家名', '玩家名')
  await bindProp('榜单奖杯数', '奖杯数')
  const defs = await evalJs(`(() => { const d = window.__uiw.getState().doc.customWidgets; return d.map(w => ({ n: w.name, p: w.props.map(x => x.name) })) })()`)
  const def = defs.find(w => w.n === '榜单条目')
  if (!def || def.p.join() !== '名次,玩家名,奖杯数') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('榜单：删除临时实例', async () => { await deleteThrowaway('定制控件 3') })
await tryStep('榜单：删除其余 11 行（55 控件）', async () => {
  const names = ['名次', '榜单头像', '榜单玩家名', '榜单奖杯数']
  for (let no = 59; no <= 69; no++) names.push('榜单行' + no)
  const idxs = await rowsByNames(names)
  if (idxs.length !== 55) throw new Error('行数 ' + idxs.length)
  await selectRows(idxs, 55)
  await deleteSelected()
})
const ranks = [
  ['58', '躺赢大', 9], ['59', 'Lets Win', 9], ['60', '今天吃什么', 9], ['61', 'Kero', 9],
  ['62', 'soyoo', 9], ['63', '夏夜晚风', 9], ['64', '咪劣情', 8], ['65', '小雨在努力', 8],
  ['66', '阿伟', 8], ['67', '打工人', 7], ['68', '老猫', 7], ['69', '夜风', 6]
]
for (let i = 0; i < ranks.length; i++) {
  const [no, name, cup] = ranks[i]
  const y = 310 + i * 118
  const overrides = {}
  if (no !== '58') overrides['名次'] = '#' + no
  if (name !== '躺赢大') overrides['玩家名'] = name
  if (cup !== 9) overrides['奖杯数'] = `🏆 ${cup}`
  await tryStep(`榜单：实例 #${no} (${40},${y})`, async () => { await addInstance('榜单条目', 40, y, overrides) })
}

// ---------- 2. 战斗：竞技场宝箱 定制控件 ----------
await tryStep('宝箱：切到战斗页', async () => { await switchTab('底部导航', 3) })
await tryStep('宝箱：第 1 个宝箱存为定制控件', async () => {
  // 图层倒序：第 1 个宝箱的通用名控件 = occ 4
  await clickLayerOcc('宝箱卡', 4)
  await clickLayerOcc('宝箱分值', 4, true)
  await clickLayerOcc('宝箱图', 4, true)
  await clickLayerOcc('宝箱名', 4, true)
  await clickLayerOcc('解锁提示', 4, true)
  const cnt = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (cnt !== 5) throw new Error('选了 ' + cnt)
  await saveAsCustom()
})
await tryStep('宝箱：定义改名「竞技场宝箱」+ 暴露 分值/箱名', async () => {
  await enterDefEdit()
  await renameDef('竞技场宝箱')
  await bindProp('宝箱分值', '分值')
  await bindProp('宝箱名', '箱名')
  const defs = await evalJs(`(() => { const d = window.__uiw.getState().doc.customWidgets; return d.map(w => ({ n: w.name, p: w.props.map(x => x.name) })) })()`)
  const def = defs.find(w => w.n === '竞技场宝箱')
  if (!def || def.p.join() !== '分值,箱名') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('宝箱：删除临时实例', async () => { await deleteThrowaway('定制控件 4') })
await tryStep('宝箱：删除其余 3 个宝箱（15 控件）', async () => {
  const idxs = await rowsByNames(['宝箱卡', '宝箱分值', '宝箱图', '宝箱名', '解锁提示'])
  if (idxs.length !== 15) throw new Error('行数 ' + idxs.length)
  await selectRows(idxs, 15)
  await deleteSelected()
})
const chests = [['⚔ 5分', 8], ['⚔ 5分', 196], ['⚔ 10分', 384], ['⚔ 10分', 572]]
for (let i = 0; i < chests.length; i++) {
  const [score, x] = chests[i]
  const overrides = score !== '⚔ 5分' ? { 分值: score } : {}
  await tryStep(`宝箱：实例 ${i + 1} (${x},1140) ${score}`, async () => { await addInstance('竞技场宝箱', x, 1140, overrides) })
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
await tryStep('截图 排名页', async () => { await switchTab('底部导航', 4); await shot('/tmp/arena-shots/v3-rank.png') })
await tryStep('截图 战斗页', async () => { await switchTab('底部导航', 3); await shot('/tmp/arena-shots/v3-battle.png') })

console.log(failures.length ? 'CUSTOM-FAILED:\n' + failures.map(f => '  ✗ ' + f).join('\n') : 'CUSTOM-OK')
