import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const assetDir = resolve(root, 'output', process.argv[2] ?? 'card-page-ui-assets')
const isCollection = assetDir.endsWith('card-page-ui-assets-slate-collection')
const isLibraryFilter = assetDir.endsWith('card-page-ui-assets-slate-library-filter')
const isCardCollection = isCollection || isLibraryFilter
const source = JSON.parse(readFileSync(resolve(root, 'examples/卡牌.uiw'), 'utf8'))
const data = (name) => `data:image/png;base64,${readFileSync(resolve(assetDir, name)).toString('base64')}`
const a = {
  pageBackground: data('page_background_750x1600.png'),
  resourceBar: data('common_resource_bar_bg_160x44.png'),
  gem: data('common_resource_gem_32x32.png'), wood: data('common_resource_wood_32x32.png'),
  orb: data('common_resource_orb_32x32.png'), coin: data('common_resource_coin_32x32.png'),
  location: data('common_location_button_46x46.png'), more: data('common_more_button_80x48.png'), record: data('common_record_button_56x56.png'),
  filterDefault: data('page_filter_tab_default_110x64.png'), filterActive: data('page_filter_tab_selected_150x64.png'),
  power: data('page_power_bar_bg_700x70.png'), subDefault: data('page_sub_tab_default_175x64.png'), subActive: data('page_sub_tab_selected_175x64.png'),
  navDefault: data('page_main_nav_default_150x110.png'), navActive: data('page_main_nav_selected_150x110.png'),
  frame: data('card_frame_160x220.png'), role: data('card_role_badge_34x34.png'), art: data('card_art_window_112x96.png'),
  track: data('card_progress_track_136x26.png'), fill: data('card_progress_fill_136x26.png'), upgrade: data('card_upgrade_badge_38x26.png')
}
const skin = (node, src) => { node.props = { ...node.props, assetSrc: src } }
const setTextContrast = (node) => {
  if (node.type === 'text' || node.type === 'filter' || node.type === 'tab') {
    node.props = { ...node.props, bold: true, fontWeight: 800, textColor: '#F4F8FF', textStroke: '#08111F', textStrokeWidth: 1.2 }
  }
  node.children?.forEach(setTextContrast)
  node.pages?.flat().forEach(setTextContrast)
}

source.meta.name = assetDir.endsWith('card-page-ui-assets-mobile-simplified')
  ? '卡牌素材交互装配预览（移动端精简版）'
  : assetDir.endsWith('card-page-ui-assets-slate-hierarchy')
    ? '卡牌素材交互装配预览（石板蓝分级框体版）'
    : isLibraryFilter
      ? '卡牌素材交互装配预览（石板蓝图鉴筛选版）'
    : isCollection
      ? '卡牌素材交互装配预览（石板蓝卡牌图鉴版）'
    : '卡牌素材交互装配预览'
source.commonLayer.nodes.forEach((n) => {
  if (n.name.startsWith('资源条')) skin(n, a.resourceBar)
  if (n.name === '定位按钮') skin(n, a.location)
  if (n.name === '更多按钮') { skin(n, a.more); n.props.text = '' }
  if (n.name === '录制按钮') skin(n, a.record)
  if (n.name.startsWith('资源值')) n.props.text = n.name.match(/(\d+)$/)?.[1] ?? ''
})
if (isCardCollection) {
  source.commonLayer.nodes.forEach((n) => {
    if (['定位按钮', '更多按钮', '录制按钮'].includes(n.name)) n.visible = false
  })
}
source.commonLayer.nodes.forEach(setTextContrast)
const resourceIcons = [a.gem, a.wood, a.orb, a.coin]
for (let i = 0; i < 4; i++) {
  const x = 27 + i * 176
  source.commonLayer.nodes.push({ id: `asset-resource-icon-${i}`, type: 'image', name: `资源图标${i + 1}`, x, y: 66, w: 32, h: 32, visible: true, locked: false, props: { src: resourceIcons[i] } })
}

const card = source.customWidgets.find((w) => w.id === 'wmtfpf5my34k7')
for (const n of card.tree) {
  if (n.name === '卡框') skin(n, a.frame)
  if (n.name === '配型底') skin(n, a.role)
  if (n.name === '卡面图片') skin(n, a.art)
  if (n.name === '碎片进度条') { skin(n, a.track); n.props.assetFillSrc = a.fill }
}
card.tree.forEach(setTextContrast)

if (isCardCollection) {
  const skins = [
    { name: '绿色', frame: data('card_frame_green_160x220.png'), art: data('card_art_green_112x96.png') },
    { name: '蓝色', frame: data('card_frame_blue_160x220.png'), art: data('card_art_blue_112x96.png') },
    { name: '紫色', frame: data('card_frame_purple_160x220.png'), art: data('card_art_purple_112x96.png') },
    { name: '金色', frame: data('card_frame_gold_160x220.png'), art: data('card_art_gold_112x96.png') }
  ]
  const applySkin = (def, skinDef) => {
    for (const n of def.tree) {
      if (n.name === '卡框') skin(n, skinDef.frame)
      if (n.name === '卡面图片') skin(n, skinDef.art)
    }
  }
  const originalId = card.id
  const variants = skins.map((skinDef, i) => {
    const def = i === 0 ? card : JSON.parse(JSON.stringify(card))
    if (i > 0) {
      def.id = `${originalId}-rarity-${i}`
      const idMap = new Map()
      const renameTree = (nodes) => {
        for (const node of nodes ?? []) {
          const previousId = node.id
          node.id = `${previousId}-rarity-${i}`
          idMap.set(previousId, node.id)
          renameTree(node.children)
          for (const page of node.pages ?? []) renameTree(page)
        }
      }
      renameTree(def.tree)
      for (const prop of def.props ?? []) {
        for (const bind of prop.binds ?? []) bind.nodeId = idMap.get(bind.nodeId) ?? bind.nodeId
      }
    }
    def.name = `游戏卡牌（${skinDef.name}）`
    applySkin(def, skinDef)
    return def
  })
  source.customWidgets = variants
  let index = 0
  const assignCardVariants = (nodes) => {
    for (const n of nodes ?? []) {
      if (n.type === 'custom' && n.customId === originalId) n.customId = variants[(index++) % variants.length].id
      assignCardVariants(n.children)
      for (const page of n.pages ?? []) assignCardVariants(page)
    }
  }
  source.pages.forEach((page) => assignCardVariants(page.nodes))
}

const mainTab = source.pages[0].nodes[0]
// 渲染器先画公共层、后画页面层：背景必须位于公共层最底部，避免盖住资源条。
source.commonLayer.nodes.unshift({
  id: 'asset-card-page-background', type: 'image', name: '页面背景素材',
  x: 0, y: 0, w: 750, h: 1600, visible: true, locked: false,
  props: { src: a.pageBackground }
})
mainTab.props.barHeight = 110
mainTab.props.transparentSurface = true
mainTab.props.assetDefaultSrc = a.navDefault
mainTab.props.assetActiveSrc = a.navActive
const pageNodes = mainTab.pages[1]
for (const n of pageNodes) {
  if (n.name === '牌组选择') { n.props.assetDefaultSrc = a.filterDefault; n.props.assetActiveSrc = a.filterActive }
  if (n.name === '战力条') skin(n, a.power)
  if (n.name === '卡牌分类') {
    n.props.barHeight = 64
    n.props.transparentSurface = true
    n.props.assetDefaultSrc = a.subDefault
    n.props.assetActiveSrc = a.subActive
    n.pages?.flat().filter((child) => child.type === 'scroll').forEach((child) => { child.props.transparentSurface = true })
  }
  if (isCardCollection && n.name === '兵种统计') n.props.text = ''
}
if (isCardCollection) {
  const statIcons = ['skull', 'wolf', 'helmet', 'gear', 'sword', 'bow']
  const statValues = ['1', '2', '3', '1', '4', '3']
  statIcons.forEach((icon, i) => {
    const x = 310 + i * 64
    pageNodes.push({ id: `asset-stat-icon-${i}`, type: 'image', name: `兵种图标${i + 1}`, x, y: 708, w: 22, h: 22, visible: true, locked: false, props: { src: data(`stat_icon_${icon}_24x24.png`) } })
    pageNodes.push({ id: `asset-stat-value-${i}`, type: 'text', name: `兵种数值${i + 1}`, x: x + 23, y: 706, w: 22, h: 24, visible: true, locked: false, props: { text: statValues[i], fontSize: 18, bold: true, fontWeight: 800, align: 'left', textColor: '#F4F8FF', textStroke: '#08111F', textStrokeWidth: 1 } })
  })
}
if (isLibraryFilter) {
  const libraryIndex = pageNodes.findIndex((n) => n.name === '卡牌分类')
  const previousLibrary = pageNodes[libraryIndex]
  const sourceScroll = previousLibrary.pages?.[0]?.find((n) => n.type === 'scroll')
  if (libraryIndex < 0 || !sourceScroll?.children?.length) throw new Error('未找到用于生成卡库筛选的原始图鉴滚动区')

  const allCards = sourceScroll.children.filter((n) => n.type === 'custom')
  const groups = [
    allCards,
    [allCards[0], allCards[4], allCards[8], allCards[12]],
    [allCards[1], allCards[5], allCards[9], allCards[13]],
    [allCards[2], allCards[6], allCards[10], allCards[14]],
    [allCards[3], allCards[7], allCards[11], allCards[15]]
  ]
  const makePage = (items, pageIndex) => {
    // 筛选栏只负责切换卡库集合；原有“所有卡牌 / 神器 / 宝箱 / 表情”保留为内层分类 Tab。
    const categoryTab = JSON.parse(JSON.stringify(previousLibrary))
    categoryTab.id = `asset-library-category-tab-${pageIndex}`
    categoryTab.x = 25
    categoryTab.y = 850
    categoryTab.w = 700
    categoryTab.h = 625
    categoryTab.visible = true
    categoryTab.locked = false
    categoryTab.activeTab = 0
    categoryTab.props = { ...categoryTab.props, barPosition: 'bottom', barHeight: 64, transparentSurface: true }
    const resultScroll = {
      id: `asset-library-scroll-${pageIndex}`,
      type: 'scroll', name: `卡库筛选结果${pageIndex + 1}`,
      x: 25, y: 850, w: 700, h: 561, visible: true, locked: false,
      props: { transparentSurface: true },
      children: items.map((item, itemIndex) => {
        const clone = JSON.parse(JSON.stringify(item))
        clone.id = `asset-library-card-${pageIndex}-${itemIndex}`
        clone.name = `筛选${pageIndex + 1}-图鉴卡${itemIndex + 1}`
        clone.x = 31 + (itemIndex % 4) * 176
        clone.y = 870 + Math.floor(itemIndex / 4) * 240
        clone.visible = true
        clone.locked = false
        return clone
      })
    }
    categoryTab.pages = [[resultScroll], ...(previousLibrary.pages?.slice(1) ?? []).map(() => [])]
    return [categoryTab]
  }
  const defaultSkins = [
    data('library_filter_all_default_120x64.png'),
    data('library_filter_skull_default_72x64.png'),
    data('library_filter_wolf_default_72x64.png'),
    data('library_filter_helmet_default_72x64.png'),
    data('library_filter_gear_default_72x64.png')
  ]
  const activeSkins = [
    data('library_filter_all_active_120x64.png'),
    data('library_filter_skull_active_72x64.png'),
    data('library_filter_wolf_active_72x64.png'),
    data('library_filter_helmet_active_72x64.png'),
    data('library_filter_gear_active_72x64.png')
  ]
  pageNodes[libraryIndex] = {
    id: 'asset-library-filter-tab', type: 'tab', name: '卡库筛选',
    x: 25, y: 775, w: 700, h: 700, visible: true, locked: false,
    props: {
      tabs: ['全部', '', '', '', ''], tabWidths: [120, 72, 72, 72, 72],
      barPosition: 'top', barHeight: 64, transparentSurface: true,
      assetDefaultSrcs: defaultSkins, assetActiveSrcs: activeSkins,
      fontSize: 22, bold: true, fontWeight: 800,
      textColor: '#F4F8FF', textStroke: '#08111F', textStrokeWidth: 1.2
    },
    activeTab: 0,
    pages: groups.map(makePage)
  }
  pageNodes.push({
    id: 'asset-library-collection-count', type: 'text', name: '已收集统计',
    x: 470, y: 790, w: 235, h: 32, visible: true, locked: false,
    props: { text: '已收集：13/40', fontSize: 24, bold: true, fontWeight: 800, align: 'right', textColor: '#F4F8FF', textStroke: '#08111F', textStrokeWidth: 1.2 }
  })
}
source.pages[0].nodes.forEach(setTextContrast)

const previewFileName = isLibraryFilter
  ? '卡牌-素材交互装配预览-卡库筛选版.uiw'
  : '卡牌-素材交互装配预览.uiw'
writeFileSync(resolve(assetDir, previewFileName), JSON.stringify(source, null, 2), 'utf8')
