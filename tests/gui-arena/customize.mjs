// 界面操作改造：牌组→筛选器；牌组卡→定制控件「游戏卡牌」；特卖礼包→定制控件「礼包横幅」
// 全程输入事件驱动真实 UI（控件库点击 / 属性面板录入 / 图层树多选 / 菜单），不直接写数据。
import { connect, makeUI } from './driver.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

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

// ---------- 通用界面操作 ----------
const clickLayerOcc = async (name, occ = 1, shift = false) => {
  for (let a = 0; a < 3; a++) {
    const r = await evalJs(`(() => { const m = [...document.querySelectorAll('.layer-row')].filter(x => x.querySelector('.layer-name')?.textContent?.trim() === ${JSON.stringify(name)}); const el = m[${occ - 1}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
    if (!r) throw new Error(`图层未找到: ${name}#${occ}`)
    await ui.mouse('mousePressed', r.x, r.y, shift ? { modifiers: 8 } : {})
    await ui.mouse('mouseReleased', r.x, r.y, shift ? { modifiers: 8 } : {})
    await sleep(70)
    const n = await ui.readSel()
    if (!shift && n && n.name === name) return n
    if (shift) return await ui.readSel()
  }
  throw new Error('图层选中失败 ' + name)
}
const rowsByPrefix = async (prefix) => evalJs(`(() => [...document.querySelectorAll('.layer-row')].map((r, i) => ({ i, name: r.querySelector('.layer-name')?.textContent?.trim() })).filter(r => r.name && r.name.startsWith(${JSON.stringify(prefix)})).map(r => r.i))()`)
const rowsByNames = async (names) => evalJs(`(() => { const set = new Set(${JSON.stringify(names)}); return [...document.querySelectorAll('.layer-row')].map((r, i) => ({ i, name: r.querySelector('.layer-name')?.textContent?.trim() })).filter(r => r.name && set.has(r.name)).map(r => r.i) })()`)
const clickRowByIndex = async (i, shift) => {
  const r = await evalJs(`(() => { const el = document.querySelectorAll('.layer-row')[${i}]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!r) throw new Error('图层行不存在 #' + i)
  await ui.mouse('mousePressed', r.x, r.y, shift ? { modifiers: 8 } : {})
  await ui.mouse('mouseReleased', r.x, r.y, shift ? { modifiers: 8 } : {})
  await sleep(60)
}
const selectRows = async (idxs, expected) => {
  await clickRowByIndex(idxs[0], false)
  for (let k = 1; k < idxs.length; k++) await clickRowByIndex(idxs[k], true)
  const n = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (n !== expected) throw new Error(`多选数量 ${n} ≠ ${expected}`)
}
const deleteSelected = async () => { await ui.key('Backspace'); await sleep(80) }
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
const saveSelectionAsCustom = async () => {
  await ui.clickMenu('控件', '存为定制控件')
  await sleep(150)
  const n = await ui.readSel()
  if (!n || n.type !== 'custom') throw new Error('存为定制控件后选中不是实例')
  return n
}
const enterDefEdit = async () => { await ui.clickAnyBtn('编辑定义（改一处全局生效）'); await sleep(150) }
const exitDefEdit = async () => { await ui.clickAnyBtn('📄 主界面'); await sleep(150) }
const renameDef = async (name) => {
  await ui.fillField('名称', name)
  await ui.clickAnyBtn('保存发布设置')
  await sleep(80)
}
const bindProp = async (rowName, occ, propName) => {
  const n = await clickLayerOcc(rowName, occ)
  await ui.fillField('新属性名', propName)
  await ui.clickAnyBtn('绑定')
  await sleep(90)
  return n
}
const addInstance = async (lib, x, y, name, overrides = {}) => {
  await ui.clickLib(lib)
  await sleep(70)
  const n0 = await ui.readSel()
  if (!n0 || n0.type !== 'custom') throw new Error(`${lib} 实例化失败`)
  await ui.fillField('X', x)
  await ui.fillField('Y', y)
  for (const [k, v] of Object.entries(overrides)) await ui.fillField(k, v)
  if (name) await ui.fillField('名称', name)
  const n = await ui.readSel()
  if (n.x !== x || n.y !== y) throw new Error(`实例位置 ${n.x},${n.y} ≠ ${x},${y}`)
  for (const [k, v] of Object.entries(overrides)) {
    if (JSON.stringify(n.overrides?.[k]) !== JSON.stringify(v)) throw new Error(`覆盖 ${k}=${JSON.stringify(n.overrides?.[k])} ≠ ${JSON.stringify(v)}`)
  }
  return n
}
const readState = (js) => evalJs(`(() => { const s = window.__uiw.getState(); const d = s.doc; ${js} })()`)

// ---------- 0. 载入工程（应用自身的 loadProject 流程，文件内容原样载入） ----------
{
  const content = readFileSync(FILE, 'utf8')
  await evalJs(`(() => { window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(FILE)}); return true })()`)
  await sleep(400)
  const ov = await ui.readOverview()
  if (!ov.hasProject || ov.meta.name !== '竞技场-界面操作原型') throw new Error('工程载入失败: ' + JSON.stringify(ov))
  log(`工程已载入：公共层 ${ov.common}，定制控件 ${ov.customs}`)
}

// ---------- 1. 牌组 → 筛选器 ----------
await tryStep('牌组：切换到 卡牌/卡组', async () => {
  await switchTab('底部导航', 2)
  await switchTab('卡牌子页签', 1)
})
await tryStep('牌组：删除旧选择条（7 控件）', async () => {
  const idxs = await rowsByNames(['牌组选择条', '牌组标题', '牌组按钮 1', '牌组按钮 2', '牌组按钮 3', '牌组按钮 4', '牌组按钮 5'])
  if (idxs.length !== 7) throw new Error('旧选择条行数 ' + idxs.length)
  await selectRows(idxs, 7)
  await deleteSelected()
})
await tryStep('牌组：添加筛选器', async () => {
  await ui.clickLib('筛选器')
  await sleep(70)
  if ((await ui.readSel()).type !== 'filter') throw new Error('筛选器未入库')
  await ui.fillField('宽', 700); await ui.fillField('高', 64)
  await ui.fillField('X', 25); await ui.fillField('Y', 150)
  await ui.fillField('标签列表', '牌组\n1\n2\n3\n4\n5')
  await ui.clickSeg('选中项', '2')
  await ui.fillField('名称', '牌组选择')
  const n = await ui.readSel()
  if (n.props.options?.length !== 6 || n.props.selected !== 1) throw new Error('筛选器属性不符 ' + JSON.stringify(n.props))
})

// ---------- 2. 定制控件「游戏卡牌」----------
await tryStep('卡牌：第 1 张卡存为定制控件', async () => {
  // 图层列表倒序：occ 8 = 最早添加的第 1 张卡
  await clickLayerOcc('牌组卡', 8)
  await clickLayerOcc('卡等级', 8, true)
  await clickLayerOcc('卡数量', 8, true)
  const cnt = await evalJs(`window.__uiw.getState().selectedIds.length`)
  if (cnt !== 3) throw new Error('选了 ' + cnt + ' 个')
  await saveSelectionAsCustom()
})
await tryStep('卡牌：定义改名「游戏卡牌」+ 暴露 等级/数量', async () => {
  await enterDefEdit()
  await renameDef('游戏卡牌')
  await bindProp('卡等级', 1, '等级')
  await bindProp('卡数量', 1, '数量')
  const defs = await readState(`return d.customWidgets.map(w => ({ name: w.name, props: w.props.map(p => p.name) }))`)
  const def = defs.find(w => w.name === '游戏卡牌')
  if (!def || def.props.join() !== '等级,数量') throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('卡牌：删除画布根上的临时实例', async () => {
  await clickLayerOcc('定制控件 1')
  await deleteSelected()
})
await tryStep('卡牌：删除其余 7 张手摆卡（21 控件）', async () => {
  const idxs = await rowsByNames(['牌组卡', '卡等级', '卡数量'])
  if (idxs.length !== 21) throw new Error('剩余卡行数 ' + idxs.length)
  await selectRows(idxs, 21)
  await deleteSelected()
})
const deck = [
  ['等级 1', '0/4'], ['等级 1', '3/4'], ['等级 2', '8/9'], ['等级 1', '8/6'],
  ['等级 1', '3/6'], ['等级 1', '0/8'], ['等级 1', '0/10'], ['等级 1', '0/6']
]
for (let i = 0; i < 8; i++) {
  const x = 30 + (i % 4) * 176
  const y = i < 4 ? 240 : 490
  const overrides = {}
  if (deck[i][0] !== '等级 1') overrides['等级'] = deck[i][0]
  if (deck[i][1] !== '0/4') overrides['数量'] = deck[i][1]
  await tryStep(`卡牌：实例 ${i + 1} (${x},${y}) ${deck[i].join('/')}`, async () => {
    await addInstance('游戏卡牌', x, y, `卡牌${i + 1}`, overrides)
  })
}

// ---------- 3. 定制控件「礼包横幅」----------
await tryStep('商店：切换到 商店/特卖', async () => {
  await switchTab('底部导航', 1)
  await switchTab('商店分类', 1)
})
await tryStep('商店：人类卡加成文字改单行（便于属性覆盖）', async () => {
  const want = { 240: '+20 0/4', 400: '+50 5/8', 560: '+100 8/6' }
  for (const occ of [1, 2, 3]) {
    const n = await clickLayerOcc('人类卡加成', occ)
    if (want[n.x] === undefined) throw new Error('意外位置 x=' + n.x)
    if (n.props.text !== want[n.x]) await ui.fillField('内容', want[n.x])
  }
})
await tryStep('商店：人类礼包组存为定制控件', async () => {
  const idxs = await rowsByPrefix('人类')
  if (idxs.length !== 14) throw new Error('人类组行数 ' + idxs.length)
  await selectRows(idxs, 14)
  await saveSelectionAsCustom()
})
await tryStep('商店：定义改名「礼包横幅」+ 暴露 8 属性', async () => {
  await enterDefEdit()
  await renameDef('礼包横幅')
  await bindProp('人类礼包标题', 1, '标题')
  await bindProp('人类超值文字', 1, '角标')
  for (const occ of [1, 2, 3]) {
    const n = await clickLayerOcc('人类卡加成', occ)
    const prop = n.x === 240 ? '卡1' : n.x === 400 ? '卡2' : '卡3'
    await ui.fillField('新属性名', prop)
    await ui.clickAnyBtn('绑定')
    await sleep(90)
  }
  await bindProp('人类限时', 1, '限时')
  await bindProp('人类价格', 1, '价格')
  await bindProp('人类可用', 1, '可用')
  const defs = await readState(`return d.customWidgets.map(w => ({ name: w.name, props: w.props.map(p => p.name) }))`)
  const def = defs.find(w => w.name === '礼包横幅')
  if (!def || def.props.length !== 8) throw new Error('定义属性 ' + JSON.stringify(defs))
  await exitDefEdit()
})
await tryStep('商店：删除画布根上的临时实例', async () => {
  await clickLayerOcc('定制控件 2')
  await deleteSelected()
})
await tryStep('商店：删除兽人/传奇手摆组', async () => {
  const idxs = [...await rowsByPrefix('兽人'), ...await rowsByPrefix('传奇')]
  if (idxs.length !== 17) throw new Error('兽人+传奇行数 ' + idxs.length)
  await selectRows(idxs, 17)
  await deleteSelected()
})
await tryStep('商店：实例 人类礼包', async () => {
  await addInstance('礼包横幅', 18, 480, '人类礼包')
})
await tryStep('商店：实例 兽人卡包', async () => {
  await addInstance('礼包横幅', 18, 810, '兽人卡包', { 标题: '兽人卡包', 卡2: '+50 0/8', 卡3: '+100 0/2' })
})
await tryStep('商店：实例 传奇卡包', async () => {
  await addInstance('礼包横幅', 18, 1290, '传奇卡包', { 标题: '传奇卡包' })
})

// ---------- 4. 结构校验（只读）----------
{
  const st = await readState(`const nav = d.pages[0].nodes[0]
    const cards = nav.pages[1][0]
    const deckScroll = cards.pages[0][0]
    const shop = nav.pages[0][0]
    const sale = shop.pages[0][0]
    return {
      defs: d.customWidgets.map(w => ({ name: w.name, props: w.props.map(p => p.name + ':' + p.binds.length + '绑定') })),
      deck: deckScroll.children.map(c => c.type === 'custom' ? c.name + '@' + c.x + ',' + c.y : c.type + ':' + c.name),
      sale: sale.children.map(c => c.type === 'custom' ? c.name + '@' + c.x + ',' + c.y + '/' + JSON.stringify(c.overrides ?? {}) : c.type + ':' + c.name)
    }`)
  console.log(JSON.stringify(st, null, 1))
}

// ---------- 5. 保存（应用自身保存管线）+ 截图 ----------
await tryStep('保存工程', async () => {
  const res = await evalJs(`(async () => {
    const s = window.__uiw.getState()
    const path = await window.api.saveProject({ content: JSON.stringify(s.doc, null, 2), knownPath: s.filePath ?? ${JSON.stringify(FILE)} })
    if (path) s.markSaved(path)
    return { path, dirty: window.__uiw.getState().dirty }
  })()`)
  // 等待 Promise 完成
  await sleep(600)
  const st = await evalJs(`(() => { const s = window.__uiw.getState(); return { dirty: s.dirty, fp: s.filePath } })()`)
  if (st.dirty || !st.fp) throw new Error('保存状态异常 ' + JSON.stringify(st))
})
mkdirSync('/tmp/arena-shots', { recursive: true })
const shot = async (file) => {
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y); await sleep(100)
  const rect = await evalJs(`(() => { const r = document.querySelector('.canvas-wrap').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })()`)
  const s = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...rect, scale: 2 } })
  writeFileSync(file, Buffer.from(s.data, 'base64'))
  log('📸 ' + file)
}
await tryStep('截图 卡组页', async () => {
  await switchTab('底部导航', 2)
  await switchTab('卡牌子页签', 1)
  await shot('/tmp/arena-shots/v2-cards-deck.png')
})
await tryStep('截图 特卖页', async () => {
  await switchTab('底部导航', 1)
  await switchTab('商店分类', 1)
  await shot('/tmp/arena-shots/v2-shop-sale.png')
})
await tryStep('恢复默认视图（战斗）', async () => { await switchTab('底部导航', 3) })

if (failures.length) { console.log('FAILED:\n' + failures.map(f => '  ✗ ' + f).join('\n')); console.log('MOD-DONE-WITH-FAILURES') } else console.log('MOD-OK')
