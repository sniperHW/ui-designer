import type { ProjectDoc, WidgetNode } from '../types'

/** 控件是否可点击：按钮天生可点击，其它控件需显式开启 clickable */
export function isClickable(n: WidgetNode): boolean {
  return n.type === 'button' || n.clickable === true
}

/** 在全文档（公共层 + 所有页面）中按 id 查找节点；找不到返回 null */
export function findNodeInDoc(doc: ProjectDoc, id: string): WidgetNode | null {
  for (const p of [doc.commonLayer, ...doc.pages]) {
    const r = findNodeById(p.nodes, id)
    if (r) return r
  }
  return null
}

/** 节点的全部子树数组（Tab 全部页签 + children + 定制控件插槽），用于全量遍历 / 查找 / 删除 */
export function childSubtrees(n: WidgetNode): WidgetNode[][] {
  const out: WidgetNode[][] = []
  if (n.pages) out.push(...n.pages)
  if (n.children) out.push(n.children)
  if (n.slots) out.push(...Object.values(n.slots))
  return out
}

/** 深度遍历所有节点（含容器子控件与插槽内容） */
export function walkNodes(arr: WidgetNode[], fn: (n: WidgetNode) => void): void {
  for (const n of arr) {
    fn(n)
    for (const sub of childSubtrees(n)) walkNodes(sub, fn)
  }
}

/** 按 id 找节点 */
export function findNodeById(arr: WidgetNode[], id: string): WidgetNode | null {
  for (const n of arr) {
    if (n.id === id) return n
    for (const sub of childSubtrees(n)) {
      const r = findNodeById(sub, id)
      if (r) return r
    }
  }
  return null
}

/** 找到 id 所在的节点数组（编辑目标根、容器内容区或某个插槽） */
export function findContainerArray(arr: WidgetNode[], id: string): WidgetNode[] | null {
  if (arr.some((m) => m.id === id)) return arr
  for (const m of arr) {
    for (const sub of childSubtrees(m)) {
      const r = findContainerArray(sub, id)
      if (r) return r
    }
  }
  return null
}

/** 选中节点及其全部子孙的 id（移动容器时子控件跟随） */
export function collectWithDescendants(arr: WidgetNode[], selSet: Set<string>, out: string[]): void {
  for (const n of arr) {
    if (selSet.has(n.id)) {
      const add = (m: WidgetNode): void => {
        out.push(m.id)
        for (const sub of childSubtrees(m)) for (const c of sub) add(c)
      }
      add(n)
    } else {
      for (const sub of childSubtrees(n)) collectWithDescendants(sub, selSet, out)
    }
  }
}

/** 包围盒 */
export function bboxOf(nodes: WidgetNode[]): { x: number; y: number; w: number; h: number } | null {
  if (!nodes.length) return null
  const minX = Math.min(...nodes.map((n) => n.x))
  const minY = Math.min(...nodes.map((n) => n.y))
  const maxX = Math.max(...nodes.map((n) => n.x + n.w))
  const maxY = Math.max(...nodes.map((n) => n.y + n.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** 克隆节点并重分配所有 id（含子树） */
export function reids(n: WidgetNode, uid: () => string): WidgetNode {
  const c: WidgetNode = { ...structuredClone(n), id: uid() }
  if (c.pages) c.pages = c.pages.map((p) => p.map((m) => reids(m, uid)))
  if (c.children) c.children = c.children.map((m) => reids(m, uid))
  if (c.slots) {
    const next: Record<string, WidgetNode[]> = {}
    for (const [k, v] of Object.entries(c.slots)) next[k] = v.map((m) => reids(m, uid))
    c.slots = next
  }
  return c
}
