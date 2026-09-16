/**
 * 由已通过的绿色详情页复制出蓝色运行时合同候选。
 * 静态外壳与通用交互素材复用；一切卡牌实例信息只以 selectedCard 绑定声明存在。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const BASE = 'output/card-page-anchor-reconstruction-v1/quality-remaster-v2/stage-10-card-detail/candidates/卡面细节展示-绿色-v29-等级重制图标画布验收候选.uiw'
const OUTPUT = 'output/card-page-anchor-reconstruction-v1/quality-remaster-v2/stage-10-card-detail/candidates/卡面细节展示-蓝色-v1-运行时绑定结构候选.uiw'
const CONTRACT = 'output/card-page-anchor-reconstruction-v1/quality-remaster-v2/stage-10-card-detail/contracts/card-detail-blue-runtime-binding-contract-v1.json'
const GREEN_POPUP = 'ppmtv84xe0zm19'
const BLUE_POPUP = 'ppmtwmxwlmjjf1'
const BLUE_DIALOG = 'nmtwmxwlmdl84'

function fail(message) { throw new Error(message) }
function clone(value) { return JSON.parse(JSON.stringify(value)) }
function replaceGreen(value) {
  return typeof value === 'string' ? value.replaceAll('detail-green-', 'detail-blue-').replaceAll('（绿色）', '（蓝色）') : value
}
function dynamicText(node, path) {
  node.props.runtimeBinding = { source: 'selectedCard', path, mode: 'replace-text' }
  node.props.text = `{{${path}}}`
}
function dynamicImage(node, path) {
  delete node.props.src
  node.props.runtimeBinding = { source: 'selectedCard', path, mode: 'replace-src' }
}
function dynamicNine(node, path) {
  delete node.props.assetSrc
  delete node.props.nineSourceSize
  delete node.props.nineInsets
  node.props.runtimeBinding = { source: 'selectedCard', path, mode: 'replace-nine-asset' }
}

function main() {
  const base = resolve(BASE)
  const output = resolve(OUTPUT)
  const contractPath = resolve(CONTRACT)
  if (!existsSync(base)) fail(`基线候选不存在：${BASE}`)
  if (existsSync(output) || existsSync(contractPath)) fail('拒绝覆盖既有蓝色候选或合同')

  const doc = JSON.parse(readFileSync(base, 'utf8'))
  const green = doc.popups?.find((popup) => popup.id === GREEN_POPUP)
  const blue = doc.popups?.find((popup) => popup.id === BLUE_POPUP)
  if (!green || !blue?.nodes?.some((node) => node.id === BLUE_DIALOG && node.type === 'dialog')) fail('未找到绿色基线或蓝色根弹窗')

  const blueNodes = clone(green.nodes).map((node) => {
    const next = clone(node)
    next.id = replaceGreen(next.id)
    next.name = replaceGreen(next.name)
    return next
  })
  const dialog = blueNodes.find((node) => node.type === 'dialog')
  if (!dialog) fail('绿色基线缺少根 dialog')
  dialog.id = BLUE_DIALOG
  dialog.name = '卡面细节展示（蓝色）'
  dialog.props.title = '卡面细节展示（蓝色）'
  dialog.props.runtimeBinding = {
    source: 'selectedCard',
    guard: 'selectedCard.rarity === "blue"',
    skin: 'cardDetailSkin.blue'
  }

  const byId = Object.fromEntries(blueNodes.map((node) => [node.id, node]))
  const textBindings = {
    'detail-blue-title': 'name',
    'detail-blue-power': 'display.power',
    'detail-blue-level': 'display.level',
    'detail-blue-rarity': 'display.rarity',
    'detail-blue-xp': 'display.xp',
    'detail-blue-prop-1-text': 'attributes[0].display',
    'detail-blue-prop-2-text': 'attributes[1].display',
    'detail-blue-prop-3-text': 'attributes[2].display',
    'detail-blue-prop-4-text': 'attributes[3].display',
    'detail-blue-prop-5-text': 'attributes[4].display',
    'detail-blue-prop-6-text': 'attributes[5].display',
    'detail-blue-skill-3-state': 'skills[2].stateLabel',
    'detail-blue-upgrade-cost': 'actions.upgrade.cost.display'
  }
  for (const [id, path] of Object.entries(textBindings)) {
    if (!byId[id]) fail(`缺少动态文本节点：${id}`)
    dynamicText(byId[id], path)
  }

  const imageBindings = {
    'detail-blue-portrait': 'visual.detailArtSrc',
    'detail-blue-type-icon': 'classification.typeIconSrc',
    'detail-blue-race-icon': 'classification.raceIconSrc',
    'detail-blue-prop-1-icon': 'attributes[0].iconSrc',
    'detail-blue-prop-2-icon': 'attributes[1].iconSrc',
    'detail-blue-prop-3-icon': 'attributes[2].iconSrc',
    'detail-blue-prop-4-icon': 'attributes[3].iconSrc',
    'detail-blue-prop-5-icon': 'attributes[4].iconSrc',
    'detail-blue-prop-6-icon': 'attributes[5].iconSrc'
  }
  for (const [id, path] of Object.entries(imageBindings)) {
    if (!byId[id]) fail(`缺少动态图片节点：${id}`)
    dynamicImage(byId[id], path)
  }
  for (let index = 1; index <= 5; index += 1) {
    const id = `detail-blue-skill-${index}`
    if (!byId[id]) fail(`缺少动态技能节点：${id}`)
    dynamicNine(byId[id], `skills[${index - 1}].slotAssetSrc`)
  }
  for (const index of [4, 5]) {
    const node = byId[`detail-blue-skill-${index}-lock`]
    if (!node) fail(`缺少技能锁状态节点：${index}`)
    node.props.runtimeBinding = { source: 'selectedCard', path: `skills[${index - 1}].locked`, mode: 'visible-when-true' }
  }
  byId['detail-blue-xp-bar'].props.runtimeBinding = { source: 'selectedCard', path: 'xp.progressPercent', mode: 'replace-progress' }
  byId['detail-blue-xp-bar'].props.progress = 0
  byId['detail-blue-upgrade-cost-icon'].props.runtimeBinding = { source: 'selectedCard', path: 'actions.upgrade.currencyIconSrc', mode: 'replace-src-when-present' }

  blue.nodes = blueNodes
  doc.meta.name = '卡面细节展示（蓝色）v1 运行时绑定结构候选'
  doc.meta.runtimeBindingContract = 'card-detail-blue-runtime-binding-contract-v1.json'

  const contract = {
    version: 1,
    kind: 'card-detail-runtime-binding',
    candidateUiw: OUTPUT.replaceAll('\\', '/'),
    popupId: BLUE_POPUP,
    dialogNodeId: BLUE_DIALOG,
    sourceContext: 'selectedCard',
    trigger: '上一级卡牌实例点击后注入 selectedCard；弹窗按 selectedCard.rarity === "blue" 展示。',
    staticReuse: [
      '详情九宫格外壳、身份徽章底座、关闭/分享/等级重制控件、战力板、属性格、技能托盘、升级与装备按钮'
    ],
    runtimePaths: Object.values(textBindings).concat(Object.values(imageBindings), [
      'xp.progressPercent',
      'actions.upgrade.currencyIconSrc',
      'skills[0..4].slotAssetSrc',
      'skills[3..4].locked',
      'visual.cardFrameSrc'
    ]),
    nodeBindings: blueNodes.filter((node) => node.props?.runtimeBinding).map((node) => ({ id: node.id, binding: node.props.runtimeBinding })),
    invariant: '不在蓝色详情页固化任何具体卡牌名称、数值、属性、技能、立绘或卡框；它们全部继承自 selectedCard。'
  }
  mkdirSync(dirname(output), { recursive: true })
  mkdirSync(dirname(contractPath), { recursive: true })
  writeFileSync(output, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8')
  console.log(`✓ 已生成蓝色运行时绑定候选：${OUTPUT}`)
  console.log(`✓ 已生成运行时绑定合同：${CONTRACT}`)
}

try { main() } catch (error) { console.error(`✗ ${error.message}`); process.exitCode = 1 }
