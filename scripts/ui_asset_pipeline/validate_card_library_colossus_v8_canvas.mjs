/** 在真实 UIW 渲染器中检查巨像文明 V8 卡牌页，并输出预览截图。 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const DEBUG_BASE = 'http://127.0.0.1:9222'
const fail = (message) => { throw new Error(message) }

async function main() {
  const [file, screenshotPath, contractArg] = process.argv.slice(2)
  if (!file) fail('用法：node scripts/ui_asset_pipeline/validate_card_library_colossus_v8_canvas.mjs <候选.uiw> [截图.png] [页面合同.json]')
  const contractPath = resolve(contractArg ?? 'assets/ui-pipeline/page-contracts/card-library-colossus-v8.json')
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  const portraitGate = contract.assemblyGates?.find((gate) => gate.id === 'card.portrait-slot-safe-inset')
  if (!portraitGate || !Array.isArray(portraitGate.expectedRect) || portraitGate.expectedRect.length !== 4) {
    fail('页面合同缺少 card.portrait-slot-safe-inset.expectedRect')
  }
  const expectedPortraitRect = portraitGate.expectedRect
  const content = readFileSync(file, 'utf8')
  const targets = await (await fetch(`${DEBUG_BASE}/json`)).json()
  const page = targets.find((item) => item.type === 'page' && item.url.includes('localhost:'))
  if (!page) fail('未找到带 9222 调试端口的设计器页面')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolveOpen, rejectOpen) => { ws.onopen = resolveOpen; ws.onerror = rejectOpen })
  let sequence = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  const call = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
    const id = ++sequence
    pending.set(id, (message) => message.error
      ? rejectCall(new Error(`${method}: ${message.error.message}`))
      : resolveCall(message.result))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true })
    if (result.exceptionDetails) fail(`画布执行失败：${expression.slice(0, 120)}`)
    return result.result.value
  }
  const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms))

  await evaluate(`(() => window.__uiw.getState().loadProject(JSON.parse(${JSON.stringify(content)}), ${JSON.stringify(file)}))()`)
  await wait(400)
  await evaluate(`(() => { window.__uiw.getState().startPreview(); return true })()`)
  await wait(500)

  const result = await evaluate(`(() => {
    const state = window.__uiw.getState()
    const doc = state.doc
    const roots = [doc.commonLayer.nodes, ...doc.pages.map((page) => page.nodes), ...doc.customWidgets.map((widget) => widget.tree)]
    const flat = []
    const walk = (nodes) => (nodes ?? []).forEach((node) => {
      flat.push(node)
      walk(node.children)
      ;(node.pages ?? []).forEach(walk)
      Object.values(node.slots ?? {}).forEach(walk)
    })
    roots.forEach(walk)
    const byId = (id) => flat.find((node) => node.id === id)
    const byName = (tree, name) => tree.find((node) => node.name === name)
    const frames = ['nmtfpehuyuv6v','nmtfpelgdfx5t','nmtfpep27rvqd','nmtfpesol58ij'].map(byId)
    const actions = ['nmtfpejokzj2k','nmtfpen9x9pve','nmtfpeqvojqd9','nmtfpeuibte3u'].map(byId)
    const stats = Array.from({length: 6}, (_, index) => byId('asset-stat-icon-' + index))
    const values = Array.from({length: 6}, (_, index) => byId('asset-stat-value-' + index))
    const deck = byId('spec2-deck-selector')
    const race = byId('asset-library-filter-tab')
    const pager = byId('library-category-pager')
    const nav = byId('nmtfpewglapzq')
    const scrolls = Array.from({length: 5}, (_, index) => byId('asset-library-scroll-' + index))
    const cards = doc.customWidgets.map((widget) => ({
      name: widget.name,
      portrait: byName(widget.tree, '卡面图片'),
      frame: byName(widget.tree, '卡框'),
      badge: byName(widget.tree, '配型底'),
      icon: byName(widget.tree, '配型图标'),
      progress: byName(widget.tree, '碎片进度条'),
    }))
    const preview = document.querySelector('.preview-stage svg')
    const imageCount = preview?.querySelectorAll('image[href^="data:image/png;base64,"]').length ?? 0
    const actionImageCounts = actions.map((node) => preview?.querySelector('[data-id="' + node.id + '"]')?.querySelectorAll('image').length ?? -1)
    const rect = preview?.getBoundingClientRect()
    return {
      previewing: state.previewing,
      canvas: [doc.meta.designWidth, doc.meta.designHeight],
      backgroundLength: byId('asset-card-page-background')?.props?.src?.length ?? 0,
      deckOptions: deck?.props?.options,
      diamondExists: !!byId('anchor-stage01-title_gem'),
      resourceSameSkin: new Set(frames.map((node) => node?.props?.assetSrc)).size === 1,
      resourceActionsInside: actions.every((node, index) => node && frames[index] && node.x >= frames[index].x && node.y >= frames[index].y && node.x + node.w <= frames[index].x + frames[index].w && node.y + node.h <= frames[index].y + frames[index].h),
      resourceActionSizes: actions.map((node) => [node?.w, node?.h]),
      actionImageCounts,
      statRects: stats.map((node) => [node?.x, node?.y, node?.w, node?.h]),
      valuesRight: values.every((node, index) => node && stats[index] && node.x >= stats[index].x + stats[index].w),
      raceWidths: race?.props?.tabWidths,
      raceSkinCounts: [race?.props?.assetDefaultSrcs?.length, race?.props?.assetActiveSrcs?.length],
      pagerWidths: pager?.props?.tabWidths,
      pagerIcons: pager?.props?.assetIconSrcs?.length,
      navWidths: nav?.props?.tabWidths,
      navIcons: nav?.props?.assetIconSrcs?.length,
      scrollRuntime: scrolls.every((node) => node?.props?.transparentSurface === true && !node?.props?.assetSrc),
      cardFrameReuse: new Set(cards.map((card) => card.frame?.props?.assetSrc)).size === 1,
      portraitRects: cards.map((card) => [card.portrait?.x, card.portrait?.y, card.portrait?.w, card.portrait?.h]),
      cardBadgeReuse: new Set(cards.map((card) => card.badge?.props?.assetSrc)).size === 1,
      cardIconsIndependent: cards.every((card) => !!card.icon?.props?.assetSrc),
      progressRuntime: cards.every((card) => !!card.progress?.props?.assetSrc && !!card.progress?.props?.assetFillSrc),
      imageCount,
      previewRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
    }
  })()`)

  const checks = [
    ['已进入真实原型预览', result.previewing === true, `previewing=${result.previewing}`],
    ['画布保持 750×1600', result.canvas?.[0] === 750 && result.canvas?.[1] === 1600, result.canvas?.join('×')],
    ['背景不是整页大图', result.backgroundLength > 0 && result.backgroundLength < 1000, `data URI 长度=${result.backgroundLength}`],
    ['牌组标签为阿拉伯数字 1–5', result.deckOptions?.join(',') === '1,2,3,4,5', result.deckOptions?.join(',')],
    ['蓝色菱形节点已移除', result.diamondExists === false, `exists=${result.diamondExists}`],
    ['四个资源框复用同一皮肤', result.resourceSameSkin === true, `same=${result.resourceSameSkin}`],
    ['四个 32×32 能量按钮均位于各自资源框内并真实渲染', result.resourceActionsInside === true && result.resourceActionSizes.every(([w, h]) => w === 32 && h === 32) && result.actionImageCounts.every((count) => count === 1), `${JSON.stringify(result.resourceActionSizes)} / images=${result.actionImageCounts}`],
    ['六个战力图标统一 66×66 且等距', result.statRects.every(([, y, w, h]) => y === 692 && w === 66 && h === 66) && result.statRects.every((rect, index) => index === 0 || rect[0] - result.statRects[index - 1][0] === 78), JSON.stringify(result.statRects)],
    ['六个数值都在对应图标右侧', result.valuesRight === true, `right=${result.valuesRight}`],
    ['种族筛选保持 V16 宽度合同与五组状态皮肤', result.raceWidths?.join(',') === '120,72,72,72,72' && result.raceSkinCounts?.join(',') === '5,5', `${result.raceWidths} / ${result.raceSkinCounts}`],
    ['卡库切页栏保持四个完整 169px 按钮', result.pagerWidths?.join(',') === '169,169,169,169' && result.pagerIcons === 4, `${result.pagerWidths} / icons=${result.pagerIcons}`],
    ['底部导航保持五个 146px 按钮与五张独立图标', result.navWidths?.join(',') === '146,146,146,146,146' && result.navIcons === 5, `${result.navWidths} / icons=${result.navIcons}`],
    ['五个卡库页继续使用真实透明滚动容器', result.scrollRuntime === true, `runtime=${result.scrollRuntime}`],
    ['四种卡牌复用同一卡框与同一角标底座', result.cardFrameReuse === true && result.cardBadgeReuse === true, `frame=${result.cardFrameReuse}, badge=${result.cardBadgeReuse}`],
    ['四种卡牌立绘统一收进合同安全边', result.portraitRects.length === portraitGate.expectedDefinitionCount && result.portraitRects.every((rect) => rect.every((value, index) => value === expectedPortraitRect[index])), `${JSON.stringify(result.portraitRects)} / contract=${JSON.stringify(expectedPortraitRect)}`],
    ['种族图标独立叠加且进度动态裁剪', result.cardIconsIndependent === true && result.progressRuntime === true, `icons=${result.cardIconsIndependent}, progress=${result.progressRuntime}`],
    ['真实预览已渲染素材图层', result.imageCount > 50, `images=${result.imageCount}`],
  ]
  for (const [name, passed, detail] of checks) {
    console.log(`${passed ? '✓' : '✗'} ${name}：${detail}`)
    if (!passed) process.exitCode = 1
  }

  if (screenshotPath && result.previewRect) {
    const captured = await call('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { ...result.previewRect, scale: 2 },
    })
    const target = resolve(screenshotPath)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, Buffer.from(captured.data, 'base64'))
    console.log(`✓ 已输出真实预览截图：${target}`)
  }

  await evaluate(`(() => { window.__uiw.getState().stopPreview(); return true })()`)
  ws.close()
}

main().catch((error) => {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
})
