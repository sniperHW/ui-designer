/** 校验巨像文明卡牌页的确认基线、机器可读装配门禁和验收哈希。 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const fail = (message) => { throw new Error(message) }
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const resolveRepo = (file) => path.resolve(root, file)
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase()

function requireFile(file, label) {
  const absolute = resolveRepo(file)
  if (!fs.existsSync(absolute)) fail(`${label}不存在：${file}`)
  return absolute
}

function findByName(nodes, name) {
  for (const node of nodes ?? []) {
    if (node.name === name) return node
    const nested = findByName(node.children, name)
    if (nested) return nested
    for (const page of node.pages ?? []) {
      const inPage = findByName(page, name)
      if (inPage) return inPage
    }
    for (const slot of Object.values(node.slots ?? {})) {
      const inSlot = findByName(slot, name)
      if (inSlot) return inSlot
    }
  }
}

function walk(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node)
    walk(node.children, visit)
    for (const page of node.pages ?? []) walk(page, visit)
    for (const slot of Object.values(node.slots ?? {})) walk(slot, visit)
  }
}

function main() {
  const contractArg = process.argv[2] ?? 'assets/ui-pipeline/page-contracts/card-library-colossus-v8.json'
  const contractPath = requireFile(contractArg, '页面合同')
  const contract = readJson(contractPath)
  if (contract.version !== 1) fail('contract.version 必须为 1')
  if (contract.status !== 'approved-runtime-baseline') fail(`页面合同尚未封版：${contract.status}`)
  if (contract.releaseCommand !== 'npm run gate:card-library-v23') fail('页面合同发布命令不唯一或不正确')

  for (const [key, label] of [
    ['structuralOriginUiw', '结构来源 UIW'],
    ['sourceUiw', '当前事实源 UIW'],
    ['styleReference', '风格基线'],
    ['styleStandard', '专用风格标准'],
    ['assetPlan', '素材计划'],
  ]) requireFile(contract[key], label)
  const qualityProfilePath = requireFile(`assets/ui-pipeline/quality-profiles/${contract.qualityProfile}.json`, '通用质量配置')
  const qualityProfile = readJson(qualityProfilePath)
  const requiredPageGates = new Set(qualityProfile.pageAssemblyGates ?? [])
  for (const gate of ['assembly.approved-baseline-hash', 'assembly.contract-slot-rect', 'visual.real-render', 'vcs.required-artifacts']) {
    if (!requiredPageGates.has(gate)) fail(`通用质量配置缺少页面封版门禁：${gate}`)
  }

  const baseline = contract.approvedBaseline
  if (!baseline || baseline.version !== 'V23' || baseline.userConfirmed !== true) fail('V23 尚未登记为用户确认基线')
  if (contract.sourceUiw !== baseline.uiw) fail('sourceUiw 必须指向 approvedBaseline.uiw')
  const uiwPath = requireFile(baseline.uiw, '验收 UIW')
  const previewPath = requireFile(baseline.realPreview, '真实预览')
  const gatePath = requireFile(baseline.qualityGate, '质量门禁')
  const auditPath = requireFile(baseline.assemblyAudit, '装配审计')
  if (sha256(uiwPath) !== baseline.uiwSha256) fail('验收 UIW 哈希与页面合同不一致')
  if (sha256(previewPath) !== baseline.realPreviewSha256) fail('真实预览哈希与页面合同不一致')

  const qualityGate = readJson(gatePath)
  if (qualityGate.status !== 'passed-real-render-qa') fail(`真实渲染门禁未通过：${qualityGate.status}`)
  if (qualityGate.userConfirmation?.status !== 'approved') fail('质量门禁缺少用户确认记录')
  if (qualityGate.candidateSha256 !== baseline.uiwSha256) fail('质量门禁 UIW 哈希与页面合同不一致')
  if (qualityGate.realPreview?.sha256 !== baseline.realPreviewSha256) fail('质量门禁预览哈希与页面合同不一致')
  const audit = readJson(auditPath)
  if (audit.outputSha256 !== baseline.uiwSha256) fail('装配审计 UIW 哈希与页面合同不一致')

  if (!Array.isArray(contract.canvas) || contract.canvas.join('x') !== '750x1600') fail('页面合同画布必须为 750×1600')
  const doc = readJson(uiwPath)
  if ([doc.meta?.designWidth, doc.meta?.designHeight].join('x') !== contract.canvas.join('x')) fail('验收 UIW 画布与页面合同不一致')

  const portraitGate = contract.assemblyGates?.find((gate) => gate.id === 'card.portrait-slot-safe-inset')
  if (!portraitGate || !Array.isArray(portraitGate.expectedRect) || portraitGate.expectedRect.length !== 4) fail('缺少立绘安全边机器门禁')
  const cardDefinitions = (doc.customWidgets ?? []).map((widget) => ({
    widget,
    portrait: findByName(widget.tree, portraitGate.selector?.nodeName),
  })).filter((entry) => entry.portrait)
  if (cardDefinitions.length !== portraitGate.expectedDefinitionCount) fail(`卡牌定义数量错误：${cardDefinitions.length}`)
  for (const { widget, portrait } of cardDefinitions) {
    const rect = [portrait.x, portrait.y, portrait.w, portrait.h]
    if (rect.some((value, index) => value !== portraitGate.expectedRect[index])) fail(`${widget.name} 立绘窗口偏离合同：${rect}`)
    if ([widget.w, widget.h].some((value, index) => value !== portraitGate.parentCardSize[index])) fail(`${widget.name} 卡牌尺寸偏离合同`)
    if (portrait.x < portraitGate.minimumHorizontalInset || widget.w - portrait.x - portrait.w < portraitGate.minimumHorizontalInset) fail(`${widget.name} 立绘左右安全边不足`)
  }

  const referenced = new Set()
  const roots = [doc.commonLayer?.nodes, ...(doc.pages ?? []).map((page) => page.nodes)]
  for (const nodes of roots) walk(nodes, (node) => { if (node.type === 'custom') referenced.add(node.customId) })
  for (const { widget } of cardDefinitions) if (!referenced.has(widget.id)) fail(`${widget.name} 未被页面实例复用`)

  console.log(`✓ ${contractArg} 通过封版合同校验：V23 哈希有效，4 个立绘窗口均为 [${portraitGate.expectedRect.join(', ')}]`)
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
}
