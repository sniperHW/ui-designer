#!/usr/bin/env node
/**
 * .uiw 工程校验器（无依赖，Node ≥ 18）
 *
 * 用法：node validate.mjs <文件.uiw> [更多文件.uiw ...]
 * 退出码：0 = 全部通过（可有警告）；1 = 存在错误
 *
 * 检查分两级：
 *   ✗ 错误  —— 结构/引用非法，编辑器可能无法打开或行为异常
 *   ⚠ 警告  —— 合法但可疑（坐标越界、页签数组不匹配等）
 */
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const WIDGET_TYPES = new Set([
  'rect', 'ellipse', 'line', 'placeholder', 'nine', 'text', 'button', 'checkbox',
  'progress', 'input', 'filter', 'panel', 'dialog', 'scroll', 'list', 'grid', 'tab', 'custom'
])
const CONTAINER_WITH_CHILDREN = new Set(['panel', 'dialog', 'scroll'])
const ANCHOR_PRESETS = new Set(['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'])
const ANCHOR_MODES = new Set(['fixed', 'stretch', 'aspect'])
const PROP_TYPES = new Set(['string', 'number', 'boolean', 'tab-index'])

class Report {
  constructor() { this.errors = []; this.warnings = [] }
  err(where, msg) { this.errors.push(`${where}: ${msg}`) }
  warn(where, msg) { this.warnings.push(`${where}: ${msg}`) }
}

/** 深度遍历：fn(node, path, inScroll)；path 形如 .nodes[0].pages[1].nodes[2].children[3] */
function walk(arr, fn, parentPath = '', inScroll = false) {
  arr.forEach((n, i) => {
    const path = `${parentPath}.nodes[${i}]`
    const deepInScroll = inScroll || n.type === 'scroll'
    fn(n, path, deepInScroll)
    const subs = []
    if (n.pages) n.pages.forEach((p, pi) => subs.push([p, `${path}.pages[${pi}]`]))
    if (n.children) subs.push([n.children, `${path}.children`])
    if (n.slots) for (const [k, v] of Object.entries(n.slots)) subs.push([v, `${path}.slots["${k}"]`])
    for (const [sub, subPath] of subs) walk(sub, fn, subPath, deepInScroll)
  })
}

/** 定义树顶层容器可提供的插槽键（与编辑器 slotsOfDef 一致：只扫描树顶层） */
function slotKeysOfDef(def) {
  const keys = []
  for (const n of def.tree) {
    if (n.type === 'tab' && n.pages) {
      const tabs = n.props?.tabs?.length ? n.props.tabs : ['页签 1']
      tabs.forEach((_, i) => keys.push(`${n.id}:${i}`))
    } else if (def.slotNodeIds?.includes(n.id)) {
      keys.push(n.id)
    }
  }
  return keys
}

function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v) }

/** 校验一棵节点树（页面 / 公共层 / 弹窗页 / 定义树）；返回树内全部节点（含子孙） */
function checkTree(arr, rootLabel, rep, ctx) {
  const all = []
  const popupRoot = rootLabel.includes('.popups[')
  walk(arr, (n, path, inScroll) => {
    all.push(n)
    const label = `「${n?.name ?? '?'}」(${n?.id ?? '?'})`
    const where = `${rootLabel}${path} ${label}`
    if (!popupRoot && n.type === 'dialog') {
      rep.warn(where, '弹窗控件只应出现在弹窗页（doc.popups）中——页面 / 公共层 / 定制控件定义内不放弹窗')
    }
    if (typeof n?.id !== 'string' || !n.id) return rep.err(where, '缺少字符串 id')
    if (ctx.nodeIds.has(n.id)) rep.err(where, `节点 id 重复：${n.id}`)
    ctx.nodeIds.add(n.id)
    if (typeof n.name !== 'string' || !n.name) rep.err(where, '缺少非空 name')
    if (!WIDGET_TYPES.has(n.type)) { rep.err(where, `未知控件类型：${n.type}`); return }
    for (const k of ['x', 'y', 'w', 'h']) {
      if (!isFiniteNum(n[k])) rep.err(where, `.${k} 必须是有限数字，实际 ${JSON.stringify(n[k])}`)
    }
    if (isFiniteNum(n.w) && n.w <= 0) rep.err(where, '.w 必须 > 0')
    if (isFiniteNum(n.h) && n.h <= 0) rep.err(where, '.h 必须 > 0')
    if (typeof n.visible !== 'boolean') rep.err(where, '.visible 必须是 boolean')
    if (typeof n.locked !== 'boolean') rep.err(where, '.locked 必须是 boolean')
    if (typeof n.props !== 'object' || n.props === null || Array.isArray(n.props)) {
      rep.err(where, '.props 必须是对象')
    }

    // 结构归属检查
    if (n.type === 'tab') {
      if (!Array.isArray(n.pages)) rep.err(where, 'tab 缺少 pages 数组')
      else if (!n.pages.every((p) => Array.isArray(p))) rep.err(where, 'tab.pages 必须是「数组的数组」')
      if (n.props?.tabs !== undefined && !Array.isArray(n.props.tabs)) rep.err(where, 'props.tabs 必须是字符串数组')
      else if (Array.isArray(n.props?.tabs) && Array.isArray(n.pages) && n.pages.length > n.props.tabs.length) {
        rep.warn(where, `pages(${n.pages.length}) 比 tabs(${n.props.tabs.length}) 多，多出的页签无标题`)
      }
      if (n.activeTab !== undefined && (!Number.isInteger(n.activeTab) || n.activeTab < 0)) {
        rep.err(where, `.activeTab 必须是非负整数，实际 ${JSON.stringify(n.activeTab)}`)
      }
      if (n.props?.barHeight !== undefined && (typeof n.props.barHeight !== 'number' || !(n.props.barHeight > 0))) {
        rep.err(where, 'props.barHeight 必须是正数（页签栏高）')
      }
      if (n.props?.fontSize !== undefined && (typeof n.props.fontSize !== 'number' || n.props.fontSize < 8)) {
        rep.err(where, 'props.fontSize 必须是 ≥8 的数字（页签字号）')
      }
    } else if (n.pages !== undefined) {
      rep.err(where, `只有 tab 可以有 pages（当前类型 ${n.type}）`)
    }
    if (CONTAINER_WITH_CHILDREN.has(n.type)) {
      if (n.children !== undefined && !Array.isArray(n.children)) rep.err(where, '.children 必须是数组')
    } else if (n.children !== undefined) {
      rep.err(where, `只有 panel/dialog/scroll 可以有 children（当前类型 ${n.type}）`)
    }
    if (n.type === 'dialog' && n.props?.title !== undefined && typeof n.props.title !== 'string') {
      rep.err(where, 'props.title 必须是字符串')
    }

    // 定制控件实例
    if (n.type === 'custom') {
      if (typeof n.customId !== 'string' || !n.customId) {
        rep.err(where, 'custom 缺少 customId')
      } else {
        const def = ctx.defsById.get(n.customId)
        if (!def) rep.err(where, `customId 引用不存在的定义：${n.customId}`)
        else {
          if (n.overrides !== undefined) {
            if (typeof n.overrides !== 'object' || n.overrides === null || Array.isArray(n.overrides)) {
              rep.err(where, '.overrides 必须是对象')
            } else {
              const known = new Set(def.props.map((p) => p.name))
              for (const k of Object.keys(n.overrides)) {
                if (!known.has(k)) rep.warn(where, `overrides 键「${k}」不是定义「${def.name}」暴露的属性`)
              }
            }
          }
          if (n.slots) {
            const keys = slotKeysOfDef(def)
            for (const k of Object.keys(n.slots)) {
              if (!keys.includes(k)) rep.err(where, `插槽键「${k}」不存在于定义「${def.name}」（可用：${keys.join(', ') || '无'}）`)
              else if (!Array.isArray(n.slots[k])) rep.err(where, `插槽「${k}」的值必须是数组`)
            }
          }
        }
      }
    } else if (n.slots !== undefined || n.customId !== undefined) {
      rep.err(where, `只有 custom 可以有 slots/customId（当前类型 ${n.type}）`)
    }

    // 锚点
    if (n.anchor !== undefined) {
      const a = n.anchor
      if (typeof a !== 'object' || !ANCHOR_PRESETS.has(a.preset)) rep.err(where, `anchor.preset 非法：${JSON.stringify(a?.preset)}`)
      if (typeof a !== 'object' || !ANCHOR_MODES.has(a.mode)) rep.err(where, `anchor.mode 非法：${JSON.stringify(a?.mode)}`)
    }

    // 筛选器绑定
    if (n.type === 'filter' && n.binding !== undefined) {
      const b = n.binding
      if (typeof b?.target !== 'string' || !b.target) rep.err(where, 'binding.target 必须是非空字符串')
      else ctx.filterBindings.push({ node: n, where, target: b.target })
      if (b?.tagKey !== undefined && typeof b.tagKey !== 'string') rep.err(where, 'binding.tagKey 必须是字符串')
    } else if (n.binding !== undefined) {
      rep.err(where, `只有 filter 可以有 binding（当前类型 ${n.type}）`)
    }

    // 点击交互（§8）：可点击 + 点击效果
    if (n.clickable !== undefined && typeof n.clickable !== 'boolean') {
      rep.err(where, '.clickable 必须是 boolean')
    }
    if (n.type === 'custom' && (n.clickable !== undefined || n.clickAction !== undefined)) {
      rep.warn(where, '定制控件实例不支持 clickable/clickAction（不生效）——点击标记配在定义树内的控件上')
    }
    if (n.clickAction !== undefined) {
      const a = n.clickAction
      if (a?.type === 'goto') {
        if (typeof a.target !== 'string' || !a.target) rep.err(where, 'clickAction(goto).target 必须是非空字符串（目标页面 id）')
        else ctx.clickGotos.push({ where, target: a.target })
      } else if (a?.type === 'popup') {
        if (typeof a.target !== 'string' || !a.target) rep.err(where, 'clickAction(popup).target 必须是非空字符串（弹窗页 id）')
        else ctx.clickPopups.push({ where, target: a.target })
      } else if (a?.type === 'back') {
        // 返回上一页：无需 target（运行时取来路页面）
      } else {
        rep.err(where, `clickAction.type 必须是 goto/back/popup，实际 ${JSON.stringify(a?.type)}`)
      }
    }

    // 列表 / 网格
    if (n.type === 'list') {
      if (n.props?.direction !== undefined && !['v', 'h'].includes(n.props.direction)) {
        rep.err(where, `props.direction 只能是 v/h，实际 ${JSON.stringify(n.props.direction)}`)
      }
    }
    if (n.type === 'list' || n.type === 'grid') {
      const { count } = n.props ?? {}
      if (count !== undefined && (!Number.isInteger(count) || count < 0)) rep.err(where, `props.count 必须是非负整数，实际 ${JSON.stringify(count)}`)
      if (n.type === 'grid' && n.props?.cols !== undefined && (!Number.isInteger(n.props.cols) || n.props.cols < 1)) {
        rep.err(where, `props.cols 必须 ≥ 1，实际 ${JSON.stringify(n.props.cols)}`)
      }
      if (n.itemTags !== undefined) {
        if (!Array.isArray(n.itemTags) || !n.itemTags.every((t) => typeof t === 'string')) {
          rep.err(where, '.itemTags 必须是字符串数组')
        } else if (Number.isInteger(count) && n.itemTags.length > count) {
          rep.warn(where, `itemTags(${n.itemTags.length}) 比 count(${count}) 多，多余项被忽略`)
        }
      }
    }

    // 数值型 props
    if (n.type === 'progress' && n.props?.progress !== undefined) {
      const p = n.props.progress
      if (!isFiniteNum(p) || p < 0 || p > 100) rep.warn(where, `props.progress 应为 0–100，实际 ${JSON.stringify(p)}`)
    }
    if (n.props?.fontSize !== undefined && (!isFiniteNum(n.props.fontSize) || n.props.fontSize < 8)) {
      rep.warn(where, `props.fontSize 应为 ≥ 8 的数字，实际 ${JSON.stringify(n.props.fontSize)}`)
    }

    // 越界提示（警告：滚动区内容故意溢出属合法情况，跳过）
    if (!inScroll && ctx.meta && isFiniteNum(n.x) && isFiniteNum(n.y) && isFiniteNum(n.w) && isFiniteNum(n.h)) {
      const { designWidth: dw, designHeight: dh } = ctx.meta
      if (n.x < -4 || n.y < -4 || n.x + n.w > dw + 4 || n.y + n.h > dh + 4) {
        rep.warn(where, `超出设计尺寸 (${dw}×${dh})：x=${n.x} y=${n.y} w=${n.w} h=${n.h}`)
      }
    }
  })
  return all
}

function validateFile(file) {
  const rep = new Report()
  let doc
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    rep.err('文件', `JSON 解析失败：${e.message}`)
    return rep
  }
  const f = basename(file)

  if (doc.version !== 1) rep.err(f, `version 必须为 1，实际 ${JSON.stringify(doc.version)}`)
  const meta = doc.meta ?? {}
  if (typeof meta.name !== 'string' || !meta.name) rep.err(f, 'meta.name 缺少或非字符串')
  if (!Number.isInteger(meta.designWidth) || meta.designWidth <= 0) rep.err(f, `meta.designWidth 必须是正整数，实际 ${JSON.stringify(meta.designWidth)}`)
  if (!Number.isInteger(meta.designHeight) || meta.designHeight <= 0) rep.err(f, `meta.designHeight 必须是正整数，实际 ${JSON.stringify(meta.designHeight)}`)
  if (!['landscape', 'portrait'].includes(meta.orientation)) {
    rep.err(f, `meta.orientation 必须是 landscape/portrait，实际 ${JSON.stringify(meta.orientation)}`)
  }

  const ctx = {
    nodeIds: new Set(),
    pageIds: new Set(),
    popupIds: new Set(),
    defsById: new Map(),
    filterBindings: [],
    clickGotos: [],
    clickPopups: [],
    meta
  }

  // 先注册全部定义 id，再做其它检查（实例引用先于定义体校验）
  if (!Array.isArray(doc.customWidgets)) rep.err(f, '.customWidgets 必须是数组（可为空）')
  else {
    for (const def of doc.customWidgets) {
      if (typeof def?.id === 'string' && def.id) {
        if (ctx.defsById.has(def.id)) rep.err(`${f}.customWidgets`, `定义 id 重复：${def.id}`)
        else ctx.defsById.set(def.id, def)
      }
    }
  }

  const pageLike = (p, where) => {
    if (typeof p !== 'object' || p === null) { rep.err(where, '必须是对象'); return false }
    if (typeof p.id !== 'string' || !p.id) { rep.err(where, '缺少字符串 id'); return false }
    if (ctx.pageIds.has(p.id)) rep.err(where, `页面 id 重复：${p.id}`)
    ctx.pageIds.add(p.id)
    if (typeof p.name !== 'string' || !p.name) rep.err(where, '缺少非空 name')
    if (!Array.isArray(p.nodes)) { rep.err(where, '.nodes 必须是数组'); return false }
    return true
  }

  if (doc.commonLayer === undefined) rep.err(f, '缺少 commonLayer')
  else if (pageLike(doc.commonLayer, `${f}.commonLayer`)) {
    checkTree(doc.commonLayer.nodes, `${f}.commonLayer`, rep, ctx)
  }
  if (!Array.isArray(doc.pages)) rep.err(f, '.pages 必须是数组')
  else {
    if (doc.pages.length === 0) rep.err(f, '.pages 至少要有一页')
    doc.pages.forEach((p, i) => {
      if (pageLike(p, `${f}.pages[${i}]`)) checkTree(p.nodes, `${f}.pages[${i}]`, rep, ctx)
    })
  }

  // 弹窗页（点击效果弹出显示的独立设计页）
  if (doc.popups !== undefined) {
    if (!Array.isArray(doc.popups)) rep.err(f, '.popups 必须是数组（可为空）')
    else {
      doc.popups.forEach((p, i) => {
        if (pageLike(p, `${f}.popups[${i}]`)) {
          ctx.popupIds.add(p.id)
          checkTree(p.nodes, `${f}.popups[${i}]`, rep, ctx)
        }
      })
    }
  }

  if (Array.isArray(doc.customWidgets)) {
    for (const [i, def] of doc.customWidgets.entries()) {
      const where = `${f}.customWidgets[${i}]「${def?.name ?? '?'}」(${def?.id ?? '?'})`
      if (typeof def?.id !== 'string' || !def.id) { rep.err(where, '缺少字符串 id'); continue }
      if (typeof def.name !== 'string' || !def.name) rep.err(where, '缺少非空 name')
      if (!isFiniteNum(def.w) || def.w <= 0) rep.err(where, `.w 必须 > 0，实际 ${JSON.stringify(def.w)}`)
      if (!isFiniteNum(def.h) || def.h <= 0) rep.err(where, `.h 必须 > 0，实际 ${JSON.stringify(def.h)}`)
      if (!Array.isArray(def.tree)) { rep.err(where, '.tree 必须是数组'); continue }
      if (!Array.isArray(def.props)) rep.err(where, '.props 必须是暴露属性数组')
      else {
        const names = new Set()
        // 定义树用独立 id 集合（定义内 nodeId 引用按树内解析）
        const treeCtx = { ...ctx, nodeIds: new Set(), filterBindings: [] }
        const treeNodes = checkTree(def.tree, `${where}.tree`, rep, treeCtx)
        void treeNodes
        const treeIds = treeCtx.nodeIds
        for (const [pi, p] of def.props.entries()) {
          const pw = `${where}.props[${pi}]`
          if (typeof p?.name !== 'string' || !p.name) { rep.err(pw, '缺少非空 name'); continue }
          if (names.has(p.name)) rep.err(pw, `暴露属性名重复：${p.name}`)
          names.add(p.name)
          if (!PROP_TYPES.has(p.type)) rep.err(pw, `type 必须是 string/number/boolean/tab-index，实际 ${JSON.stringify(p.type)}`)
          if (p.default === undefined) rep.warn(pw, '缺少 default（实例未覆盖时将显示为空）')
          if (!Array.isArray(p.binds)) { rep.err(pw, '.binds 必须是数组'); continue }
          for (const [bi, b] of p.binds.entries()) {
            if (typeof b?.nodeId !== 'string' || !b.nodeId) rep.err(`${pw}.binds[${bi}]`, '缺少 nodeId')
            else if (!treeIds.has(b.nodeId)) rep.err(`${pw}.binds[${bi}]`, `nodeId 不在定义树中：${b.nodeId}`)
            if (typeof b?.key !== 'string' || !b.key) rep.err(`${pw}.binds[${bi}]`, '缺少 key')
          }
        }
      }
      if (def.slotNodeIds !== undefined && !Array.isArray(def.slotNodeIds)) rep.err(where, '.slotNodeIds 必须是数组')
    }
    // 定制控件循环引用检查
    const visiting = new Set()
    const done = new Set()
    const visit = (id) => {
      if (done.has(id)) return true
      if (visiting.has(id)) return false
      visiting.add(id)
      let ok = true
      const collect = (n) => {
        if (n.type === 'custom' && n.customId) {
          if (!visit(n.customId)) ok = false
        }
        for (const sub of [...(n.pages ?? []).flat(), ...(n.children ?? []), ...Object.values(n.slots ?? {})]) collect(sub)
      }
      const def = ctx.defsById.get(id)
      if (def) for (const n of def.tree) collect(n)
      visiting.delete(id)
      done.add(id)
      return ok
    }
    for (const id of ctx.defsById.keys()) {
      if (!visit(id)) rep.err(`${f}.customWidgets`, `定制控件存在循环引用：${id}`)
    }
  }

  // 筛选器绑定目标检查：同文档内必须存在 list/grid
  if (ctx.filterBindings.length) {
    const listGridIds = new Set()
    const scan = (nodes) => walk(nodes, (n) => { if (n.type === 'list' || n.type === 'grid') listGridIds.add(n.id) })
    if (Array.isArray(doc.pages)) for (const p of doc.pages ?? []) scan(p.nodes ?? [])
    scan(doc.commonLayer?.nodes ?? [])
    for (const { where, target } of ctx.filterBindings) {
      if (!listGridIds.has(target)) rep.err(where, `binding.target 不是列表/网格节点：${target}`)
    }
  }

  // 点击效果目标检查：goto → 页面 id；popup → 弹窗页 id
  for (const { where, target } of ctx.clickGotos) {
    if (!ctx.pageIds.has(target)) rep.err(where, `clickAction(goto).target 不是页面 id：${target}`)
  }
  for (const { where, target } of ctx.clickPopups) {
    if (!ctx.popupIds.has(target)) rep.err(where, `clickAction(popup).target 不是弹窗页（doc.popups）id：${target}`)
  }

  return rep
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('用法：node validate.mjs <文件.uiw> [更多文件.uiw ...]')
  process.exit(1)
}

let failed = false
for (const file of files) {
  const rep = validateFile(file)
  if (rep.errors.length === 0 && rep.warnings.length === 0) {
    console.log(`✓ ${file} 通过校验`)
    continue
  }
  for (const e of rep.errors) console.error(`  ✗ ${e}`)
  for (const w of rep.warnings) console.warn(`  ⚠ ${w}`)
  console.log(
    rep.errors.length
      ? `✗ ${file}：${rep.errors.length} 个错误，${rep.warnings.length} 个警告`
      : `△ ${file}：通过（${rep.warnings.length} 个警告）`
  )
  if (rep.errors.length) failed = true
}
process.exit(failed ? 1 : 0)
