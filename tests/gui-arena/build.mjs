// 通过界面操作搭建「竞技场 4 界面」原型（对照 4 张参考截图）
// 结构：公共层=顶部状态栏（所有页面公用）；页面 1 = 底部导航 TabView（商店/卡牌/战斗/排名）+ 各页签内容
//   商店页签 = 特卖/基础 TabView，两页签各内嵌滚动区
//   卡牌页签 = 卡组/段位/图鉴/聊天 TabView，卡组页签内嵌滚动区（牌组 + 所有卡牌网格）
//   排名页签 = 排行榜滚动区
// 全程仅界面操作：控件库点击入画布 → 属性面板输入框录入几何与文案 → 图层树/页签按钮切换编辑目标。
import { connect, makeUI } from './driver.mjs'

const { call, evalJs, sleep, dialogLog } = await connect(9222)
const ui = makeUI({ call, evalJs, sleep })
const { clickLib, fillField, fillDom, clickSeg, checkRow, clickLayer, clickPage, clickAnyBtn, clickMenu, readSel, readOverview } = ui
const t0 = Date.now()
let idx = 0
const log = (msg) => console.log(`[${String(idx).padStart(3, '0')} ${Math.round((Date.now() - t0) / 1000)}s] ${msg}`)

const TYPE_OF = { 矩形: 'rect', 圆角矩形: 'rect', 椭圆: 'ellipse', 线段: 'line', 占位图: 'placeholder', 九宫格: 'nine', 文本: 'text', 按钮: 'button', 复选框: 'checkbox', 进度条: 'progress', 输入框: 'input', 筛选器: 'filter', 面板: 'panel', 弹窗: 'dialog', 滚动区: 'scroll', 列表: 'list', 网格: 'grid', 'Tab 页签': 'tab' }
const failures = []

/** 通过控件库添加控件并录入属性（画布中心落点决定容器归属）；单件失败记录后继续 */
async function W(lib, geo, opts = {}) {
  idx++
  const desc = `${lib}·${opts.name ?? opts.text ?? ''}`
  try {
    let added = null
    for (let i = 0; i < 3 && !added; i++) {
      await clickLib(lib)
      await sleep(60)
      const n = await readSel()
      if (n && n.type === TYPE_OF[lib]) added = n
      else console.log(`  ⚠️ ${desc} 第 ${i + 1} 次入库未选中${n ? '（类型 ' + n?.type + '）' : '（无选中）'}，重试`)
    }
    if (!added) throw new Error('入库失败')
    if (geo) {
      if (geo.w != null) await fillField('宽', geo.w)
      if (geo.h != null) await fillField('高', geo.h)
      if (geo.x != null) await fillField('X', geo.x)
      if (geo.y != null) await fillField('Y', geo.y)
      if (geo.r != null) await fillField('圆角', geo.r)
      if (opts.progress != null) await fillField('百分比', opts.progress)
    }
    if (opts.count != null) await fillField('项数', opts.count)
    if (opts.cols != null) await fillField('列数', opts.cols)
    if (opts.text != null) await fillField('内容', opts.text)
    if (opts.tabs != null) await fillField('页签列表', opts.tabs.join('\n'))
    if (opts.bar) await clickSeg('页签栏', opts.bar === 'bottom' ? '下' : '上')
    if (opts.fs != null) await fillField('字号', opts.fs)
    if (opts.bold) await checkRow('加粗')
    if (opts.align) await clickSeg('对齐', opts.align)
    if (opts.tags != null) await fillField('项标记', opts.tags.join('\n'))
    if (opts.name) await fillField('名称', opts.name)
    // 校验（只读）
    const n = await readSel()
    if (!n) throw new Error('添加后无选中节点')
    if (geo) {
      for (const k of ['x', 'y', 'w', 'h']) {
        if (geo[k] != null && n[k] !== geo[k]) throw new Error(`${k}=${n[k]} 期望 ${geo[k]}`)
      }
    }
    if (opts.text != null && n.props.text !== opts.text) throw new Error(`文本不符: ${JSON.stringify(n.props.text)}`)
    if (opts.tabs && JSON.stringify(n.props.tabs) !== JSON.stringify(opts.tabs)) throw new Error('页签列表不符')
    log(`${lib} ✓ ${opts.name ?? opts.text ?? ''} (${geo ? `${geo.x},${geo.y},${geo.w}×${geo.h}` : ''})`)
  } catch (e) {
    failures.push(`${desc}: ${e.message}`)
    console.log(`  ✗ ${desc} 失败：${e.message}`)
    // 恢复：点画布空白处清除无效选择，继续下一件
    const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`).catch(() => null)
    if (pt) { await ui.click(pt.x, pt.y).catch(() => {}); await sleep(80) }
  }
}

/** 选中图层树中的节点，并用属性面板按钮切换其当前页签 */
async function switchTab(nodeName, btnNo) {
  await clickLayer(nodeName)
  await sleep(60)
  await clickSeg('当前页签', String(btnNo))
  await sleep(60)
  const n = await readSel()
  if (!n || n.activeTab !== btnNo - 1) throw new Error(`${nodeName} 切换页签失败`)
  log(`⟳ ${nodeName} → 页签 ${btnNo}`)
}

// ================= 0. 若已有打开工程则先关闭（确认弹窗自动接受） =================
{
  const ov = await readOverview()
  if (ov.hasProject) {
    log('检测到已打开工程，先通过菜单关闭')
    await clickMenu('文件', '关闭工程')
    await sleep(400)
  }
}

// ================= 1. 新建工程（欢迎页 → 弹窗） =================
idx++
log('新建工程：竖屏 750×1600')
await clickAnyBtn('新建工程')
await sleep(300)
{
  await fillDom(`document.querySelector('.modal .form-row input[type=text]')`, '竞技场-界面操作原型', '工程名称')
  await sleep(60)
}
await clickAnyBtn('竖屏')
await sleep(100)
{
  await fillDom(`[...document.querySelectorAll('.modal input[type=number]')][0]`, 750, '自定义宽')
  await fillDom(`[...document.querySelectorAll('.modal input[type=number]')][1]`, 1600, '自定义高')
  await sleep(60)
}
await clickAnyBtn('创建')
await sleep(400)
{
  const ov = await readOverview()
  if (!ov.hasProject || ov.meta.designWidth !== 750 || ov.meta.designHeight !== 1600 || ov.meta.name !== '竞技场-界面操作原型') {
    throw new Error('工程创建失败: ' + JSON.stringify(ov))
  }
  log(`工程已创建：${ov.meta.name} ${ov.meta.designWidth}×${ov.meta.designHeight}`)
}
// 重命名页面 1 → 主界面（滚动到可见 → 双击页面行，输入后回车，输入框随提交消失）
{
  const p = await evalJs(`(() => { const el = [...document.querySelectorAll('.page-row')].find(r => r.querySelector('.page-name')?.textContent?.includes('页面 1')); if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!p) throw new Error('未找到页面 1 行')
  await ui.dblClick(p.x, p.y)
  await sleep(250)
  await fillDom(`document.querySelector('.page-row input')`, '主界面', '页面重命名', true)
  await sleep(100)
  log('页面 1 已重命名为「主界面」')
}

// ================= 2. 公共层：顶部状态栏（所有页面公用） =================
log('—— 公共层：顶部状态栏 ——')
await clickPage('公共层')
await sleep(150)

await W('椭圆', { x: 14, y: 14, w: 56, h: 56 }, { name: '等级徽章' })
await W('文本', { x: 14, y: 26, w: 56, h: 32 }, { text: '2', fs: 26, bold: true, align: '中', name: '等级数字' })
await W('文本', { x: 80, y: 20, w: 112, h: 30 }, { text: '20/130', fs: 24, bold: true, name: '等级进度文字' })
await W('进度条', { x: 80, y: 56, w: 112, h: 14 }, { progress: 15, name: '等级进度' })
await W('占位图', { x: 200, y: 18, w: 46, h: 38 }, { name: '宝箱图标' })
await W('占位图', { x: 500, y: 14, w: 46, h: 46 }, { name: '定位按钮' })
await W('按钮', { x: 556, y: 12, w: 80, h: 48 }, { text: '···', fs: 30, name: '更多按钮' })
await W('椭圆', { x: 648, y: 12, w: 56, h: 56 }, { name: '录制按钮' })
const pills = [['6', 112], ['0', 238], ['400', 364], ['139', 490], ['280', 616]]
for (const [val, x] of pills) {
  await W('圆角矩形', { x, y: 60, w: 118, h: 44, r: 22 }, { name: `资源条${val}` })
  await W('文本', { x: x + 28, y: 66, w: 64, h: 32 }, { text: val, fs: 24, bold: true, name: `资源值${val}` })
  await W('圆角矩形', { x: x + 94, y: 70, w: 22, h: 22, r: 8 }, { name: `加号${val}` })
}

// ================= 3. 页面 1：底部导航 TabView =================
log('—— 页面 1：底部导航 TabView ——')
await clickPage('主界面')
await sleep(150)
await W('Tab 页签', { x: 0, y: 110, w: 750, h: 1490 }, { name: '底部导航', tabs: ['商店', '卡牌', '战斗', '排名'], bar: 'bottom' })

// ================= 4. 战斗页签（页签 3） =================
log('—— 战斗页签 ——')
await switchTab('底部导航', 3)
await W('占位图', { x: 12, y: 130, w: 140, h: 140 }, { name: '玩家头像' })
await W('圆角矩形', { x: 150, y: 140, w: 250, h: 52, r: 26 }, { name: '战力徽章' })
await W('文本', { x: 165, y: 148, w: 220, h: 36 }, { text: '战力 9888', fs: 26, bold: true, name: '战力文字' })
await W('圆角矩形', { x: 60, y: 200, w: 345, h: 56, r: 12 }, { name: '名牌' })
await W('文本', { x: 80, y: 212, w: 305, h: 32 }, { text: 'User315614', fs: 28, bold: true, name: '玩家名' })
await W('圆角矩形', { x: 0, y: 270, w: 365, h: 52, r: 10 }, { name: '联盟条' })
await W('文本', { x: 20, y: 278, w: 180, h: 36 }, { text: '🛡 木头', fs: 26, name: '联盟名' })
await W('文本', { x: 245, y: 278, w: 100, h: 36 }, { text: '🏆 6', fs: 26, name: '奖杯数' })
await W('占位图', { x: 415, y: 330, w: 205, h: 64 }, { name: '订阅特卖横幅' })
await W('文本', { x: 430, y: 346, w: 175, h: 32 }, { text: '订阅特卖', fs: 22, align: '中', name: '订阅特卖文字' })
const leftCol = [['1天16时1分', 430], ['1天16时1分', 560], ['16时1分53秒', 660]]
for (const [t, y] of leftCol) {
  await W('占位图', { x: 14, y, w: 96, h: 80 }, { name: '左侧活动图' })
  await W('文本', { x: 0, y: y + 84, w: 124, h: 26 }, { text: t, fs: 18, align: '中', name: '倒计时' })
}
const rightCol = [['桌面好礼', 320], ['入口有奖', 450], ['新手礼包', 580], ['基金', 710], ['月卡+20%', 840]]
for (const [t, y] of rightCol) {
  await W('占位图', { x: 620, y, w: 112, h: 96 }, { name: '礼包图' })
  await W('文本', { x: 612, y: y + 100, w: 128, h: 28 }, { text: t, fs: 20, align: '中', name: '礼包名' })
}
await W('九宫格', { x: 215, y: 415, w: 320, h: 60 }, { name: '竞技场横幅' })
await W('文本', { x: 215, y: 425, w: 320, h: 40 }, { text: '竞技场 1', fs: 30, bold: true, align: '中', name: '竞技场标题' })
await W('占位图', { x: 165, y: 490, w: 420, h: 340 }, { name: '竞技场场景' })
await W('进度条', { x: 225, y: 858, w: 300, h: 20 }, { progress: 24, name: '战斗进度' })
await W('文本', { x: 285, y: 846, w: 180, h: 40 }, { text: '6/25', fs: 26, bold: true, align: '中', name: '进度文字' })
await W('文本', { x: 520, y: 846, w: 130, h: 40 }, { text: '成功 +3', fs: 22, name: '成功文字' })
await W('圆角矩形', { x: 185, y: 895, w: 380, h: 86, r: 12 }, { name: '今日可获得框' })
await W('文本', { x: 185, y: 903, w: 380, h: 30 }, { text: '今日可获得', fs: 24, align: '中', name: '今日可获得标题' })
await W('文本', { x: 185, y: 938, w: 380, h: 36 }, { text: '🪙 200', fs: 28, bold: true, align: '中', name: '今日奖励' })
await W('按钮', { x: 185, y: 1000, w: 380, h: 110 }, { text: '玩家对战', fs: 40, bold: true, name: '玩家对战按钮' })
const chests = [['⚔ 5分', 8], ['⚔ 5分', 196], ['⚔ 10分', 384], ['⚔ 10分', 572]]
for (const [score, x] of chests) {
  await W('圆角矩形', { x, y: 1140, w: 168, h: 220, r: 14 }, { name: '宝箱卡' })
  await W('文本', { x, y: 1150, w: 168, h: 30 }, { text: score, fs: 22, align: '中', name: '宝箱分值' })
  await W('占位图', { x: x + 19, y: 1185, w: 130, h: 100 }, { name: '宝箱图' })
  await W('文本', { x, y: 1290, w: 168, h: 30 }, { text: '竞技场1', fs: 24, align: '中', name: '宝箱名' })
  await W('文本', { x, y: 1326, w: 168, h: 28 }, { text: '点击解锁', fs: 20, align: '中', name: '解锁提示' })
}

// ================= 5. 商店页签（页签 1）：特卖/基础 TabView 内嵌滚动区 =================
log('—— 商店页签 ——')
await switchTab('底部导航', 1)
await W('Tab 页签', { x: 15, y: 120, w: 720, h: 1400 }, { name: '商店分类', tabs: ['特卖', '基础'], bar: 'bottom' })
await W('滚动区', { x: 15, y: 120, w: 720, h: 1360 }, { name: '特卖滚动区' })
await W('九宫格', { x: 25, y: 150, w: 700, h: 300 }, { name: '月卡横幅' })
await W('文本', { x: 25, y: 168, w: 700, h: 44 }, { text: '月卡', fs: 34, bold: true, align: '中', name: '月卡标题' })
await W('椭圆', { x: 20, y: 155, w: 92, h: 92 }, { name: '月卡超值角标' })
await W('文本', { x: 20, y: 178, w: 92, h: 46 }, { text: '200%\n超值', fs: 18, bold: true, align: '中', name: '月卡超值文字' })
await W('圆角矩形', { x: 45, y: 240, w: 200, h: 150, r: 16 }, { name: '去广告框' })
await W('文本', { x: 45, y: 345, w: 200, h: 30 }, { text: '去广告', fs: 22, align: '中', name: '去广告文字' })
await W('圆角矩形', { x: 275, y: 240, w: 200, h: 150, r: 16 }, { name: '加成框' })
await W('文本', { x: 275, y: 345, w: 200, h: 30 }, { text: '奖励加成 +20%', fs: 22, align: '中', name: '加成文字' })
await W('圆角矩形', { x: 505, y: 240, w: 200, h: 150, r: 16 }, { name: '每日奖励框' })
await W('文本', { x: 505, y: 345, w: 200, h: 30 }, { text: '每日奖励', fs: 22, align: '中', name: '每日奖励文字' })
await W('文本', { x: 25, y: 398, w: 700, h: 44 }, { text: '💎 680', fs: 34, bold: true, align: '中', name: '月卡价格' })
await W('九宫格', { x: 25, y: 480, w: 700, h: 300 }, { name: '人类礼包横幅' })
await W('占位图', { x: 35, y: 495, w: 180, h: 270 }, { name: '人类英雄' })
await W('文本', { x: 250, y: 498, w: 450, h: 40 }, { text: '人类礼包', fs: 32, bold: true, align: '中', name: '人类礼包标题' })
await W('椭圆', { x: 18, y: 488, w: 96, h: 96 }, { name: '人类超值角标' })
await W('文本', { x: 18, y: 512, w: 96, h: 48 }, { text: '1500%\n超值', fs: 17, bold: true, align: '中', name: '人类超值文字' })
const humanCards = [['+20\n0/4', 240], ['+50\n5/8', 400], ['+100\n8/6', 560]]
for (const [t, x] of humanCards) {
  await W('圆角矩形', { x, y: 545, w: 140, h: 200, r: 16 }, { name: '人类卡框' })
  await W('文本', { x, y: 645, w: 140, h: 60 }, { text: t, fs: 24, align: '中', name: '人类卡加成' })
}
await W('文本', { x: 35, y: 790, w: 190, h: 28 }, { text: '1天16时2分', fs: 20, name: '人类限时' })
await W('文本', { x: 280, y: 742, w: 200, h: 40 }, { text: '💎 680', fs: 32, bold: true, name: '人类价格' })
await W('文本', { x: 560, y: 742, w: 140, h: 40 }, { text: '5/5 可用', fs: 24, align: '右', name: '人类可用' })
await W('九宫格', { x: 25, y: 810, w: 700, h: 300 }, { name: '兽人礼包横幅' })
await W('占位图', { x: 35, y: 825, w: 180, h: 270 }, { name: '兽人英雄' })
await W('文本', { x: 250, y: 828, w: 450, h: 40 }, { text: '兽人卡包', fs: 32, bold: true, align: '中', name: '兽人卡包标题' })
await W('椭圆', { x: 18, y: 818, w: 96, h: 96 }, { name: '兽人超值角标' })
await W('文本', { x: 18, y: 842, w: 96, h: 48 }, { text: '1500%\n超值', fs: 17, bold: true, align: '中', name: '兽人超值文字' })
const orcCards = [['+20\n0/4', 240], ['+50\n0/8', 400], ['+100\n0/2', 560]]
for (const [t, x] of orcCards) {
  await W('圆角矩形', { x, y: 875, w: 140, h: 200, r: 16 }, { name: '兽人卡框' })
  await W('文本', { x, y: 975, w: 140, h: 60 }, { text: t, fs: 24, align: '中', name: '兽人卡加成' })
}
await W('文本', { x: 35, y: 1120, w: 190, h: 28 }, { text: '1天16时2分', fs: 20, name: '兽人限时' })
await W('文本', { x: 280, y: 1072, w: 200, h: 40 }, { text: '💎 680', fs: 32, bold: true, name: '兽人价格' })
await W('文本', { x: 560, y: 1072, w: 140, h: 40 }, { text: '5/5 可用', fs: 24, align: '右', name: '兽人可用' })
await W('九宫格', { x: 25, y: 1290, w: 700, h: 300 }, { name: '传奇礼包横幅' })
await W('占位图', { x: 35, y: 1305, w: 180, h: 270 }, { name: '传奇英雄' })
await W('文本', { x: 250, y: 1308, w: 450, h: 40 }, { text: '传奇卡包', fs: 32, bold: true, align: '中', name: '传奇卡包标题' })
// 基础页签（页签 2）
await switchTab('商店分类', 2)
await W('滚动区', { x: 15, y: 120, w: 720, h: 1360 }, { name: '基础滚动区' })
await W('文本', { x: 35, y: 150, w: 200, h: 36 }, { text: '资源', fs: 28, bold: true, name: '资源标题' })
await W('网格', { x: 25, y: 200, w: 700, h: 480 }, { name: '资源网格', count: 9, cols: 3, tags: ['金币', '金币', '钻石', '木材', '木材', '体力', '钥匙', '钥匙', '经验'] })
await W('文本', { x: 35, y: 710, w: 200, h: 36 }, { text: '礼包', fs: 28, bold: true, name: '礼包标题' })
await W('网格', { x: 25, y: 760, w: 700, h: 640 }, {
  name: '礼包网格', count: 12, cols: 3,
  tags: ['新手礼包', '成长礼包', '豪华礼包', '每日特惠', '每周特惠', '月度特惠', '首充礼包', '回流礼包', '节日礼包', '竞技礼包', '公会礼包', '限时礼包']
})

// ================= 6. 卡牌页签（页签 2）：卡组 TabView 内嵌滚动区 =================
log('—— 卡牌页签 ——')
await switchTab('底部导航', 2)
await W('Tab 页签', { x: 15, y: 120, w: 720, h: 1400 }, { name: '卡牌子页签', tabs: ['卡组', '段位', '图鉴', '聊天'], bar: 'bottom' })
await W('滚动区', { x: 15, y: 120, w: 720, h: 1360 }, { name: '卡组滚动区' })
await W('圆角矩形', { x: 25, y: 150, w: 700, h: 64, r: 32 }, { name: '牌组选择条' })
await W('文本', { x: 45, y: 164, w: 110, h: 36 }, { text: '牌组', fs: 28, bold: true, name: '牌组标题' })
for (let i = 0; i < 5; i++) {
  await W('按钮', { x: 170 + i * 108, y: 160, w: 92, h: 44 }, { text: String(i + 1), fs: 26, name: `牌组按钮${i + 1}` })
}
const deck = [
  ['等级 1', '0/4'], ['等级 1', '3/4'], ['等级 2', '8/9'], ['等级 1', '8/6'],
  ['等级 1', '3/6'], ['等级 1', '0/8'], ['等级 1', '0/10'], ['等级 1', '0/6']
]
for (let i = 0; i < 8; i++) {
  const x = 30 + (i % 4) * 176
  const y = i < 4 ? 240 : 490
  await W('圆角矩形', { x, y, w: 160, h: 230, r: 16 }, { name: '牌组卡' })
  await W('文本', { x, y: y + 140, w: 160, h: 28 }, { text: deck[i][0], fs: 22, align: '中', name: '卡等级' })
  await W('文本', { x, y: y + 174, w: 160, h: 26 }, { text: deck[i][1], fs: 22, align: '中', name: '卡数量' })
}
await W('圆角矩形', { x: 25, y: 750, w: 700, h: 70, r: 12 }, { name: '战力条' })
await W('文本', { x: 45, y: 764, w: 250, h: 42 }, { text: '战力 9888', fs: 30, bold: true, name: '战力值' })
await W('文本', { x: 310, y: 764, w: 400, h: 42 }, { text: '☠1 🐺2 🛡3 ⚙1 ⚔4 🏹3', fs: 24, name: '部队统计' })
await W('文本', { x: 25, y: 850, w: 700, h: 40 }, { text: '所有卡牌', fs: 30, bold: true, align: '中', name: '所有卡牌标题' })
await W('网格', { x: 25, y: 910, w: 700, h: 1140 }, {
  name: '全部卡牌网格', count: 16, cols: 4,
  tags: ['等级1 5/8', '未解锁', '未解锁', '未解锁', '等级1 3/8', '未解锁', '等级2 4/8', '未解锁', '等级1 2/8', '未解锁', '等级1 1/8', '未解锁', '等级1 6/8', '未解锁', '等级2 3/8', '未解锁']
})
for (const [btnNo, label] of [[2, '段位'], [3, '图鉴'], [4, '聊天']]) {
  await switchTab('卡牌子页签', btnNo)
  await W('占位图', { x: 175, y: 450, w: 400, h: 400 }, { name: `${label}占位` })
  await W('文本', { x: 175, y: 880, w: 400, h: 36 }, { text: `${label}（示例占位）`, fs: 28, align: '中', name: `${label}标题` })
}

// ================= 7. 排名页签（页签 4）：排行榜滚动区 =================
log('—— 排名页签 ——')
await switchTab('底部导航', 4)
await W('占位图', { x: 325, y: 128, w: 100, h: 100 }, { name: '联盟徽章' })
await W('文本', { x: 300, y: 232, w: 150, h: 34 }, { text: '木头', fs: 26, bold: true, align: '中', name: '联盟名' })
await W('滚动区', { x: 20, y: 290, w: 710, h: 1240 }, { name: '榜单滚动区' })
const ranks = [
  ['58', '躺赢大', 9], ['59', 'Lets Win', 9], ['60', '今天吃什么', 9], ['61', 'Kero', 9],
  ['62', 'soyoo', 9], ['63', '夏夜晚风', 9], ['64', '咪劣情', 8], ['65', '小雨在努力', 8],
  ['66', '阿伟', 8], ['67', '打工人', 7], ['68', '老猫', 7], ['69', '夜风', 6]
]
for (let i = 0; i < ranks.length; i++) {
  const [no, name, cup] = ranks[i]
  const y = 310 + i * 118
  await W('圆角矩形', { x: 40, y, w: 670, h: 100, r: 16 }, { name: `榜单行${no}` })
  await W('文本', { x: 60, y: y + 30, w: 100, h: 40 }, { text: `#${no}`, fs: 28, bold: true, name: '名次' })
  await W('占位图', { x: 175, y: y + 12, w: 76, h: 76 }, { name: '榜单头像' })
  await W('文本', { x: 270, y: y + 30, w: 260, h: 40 }, { text: name, fs: 26, name: '榜单玩家名' })
  await W('文本', { x: 540, y: y + 30, w: 150, h: 40 }, { text: `🏆 ${cup}`, fs: 28, align: '右', name: '榜单奖杯数' })
}

// ================= 8. 收尾：默认页签=战斗，整体校验 =================
await switchTab('底部导航', 3)
{
  const ov = await readOverview()
  log(`完成：公共层 ${ov.common} 控件；页面：${ov.pages.map(p => p.name + '=' + p.nodes).join(' ')}；弹窗记录 ${JSON.stringify(dialogLog)}；累计界面操作 ${ui.ops.count} 次`)
  // 点画布空白处（画板外围）取消选择
  const pt = await evalJs(`(() => { const r = document.querySelector('.canvas-svg').getBoundingClientRect(); const v = window.__uiw.getState().viewport; return { x: r.x + v.panX - 60 * v.zoom, y: r.y + v.panY - 60 * v.zoom } })()`)
  await ui.click(pt.x, pt.y)
  await sleep(100)
}
if (failures.length) {
  console.log('FAILED-ITEMS:')
  for (const f of failures) console.log('  ✗ ' + f)
}
console.log(failures.length ? 'BUILD-DONE-WITH-FAILURES' : 'BUILD-OK')
