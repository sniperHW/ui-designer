import { create } from 'zustand'
import type { CustomWidgetDef, PageData, ProjectDoc, ProjectMeta, WidgetNode } from '../types'
import type { WidgetDef } from '../widgets/registry'
import {
  activeTabIndex,
  contentRectOf,
  renderCustomInstance,
  renderKidsOf,
  resolveTree,
  scaleTree
} from '../widgets/registry'
import { bboxOf, collectWithDescendants, findNodeById, reids, walkNodes } from '../widgets/tree'
import { canvasEl } from '../canvasRef'

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
export type DistributeAxis = 'h' | 'v'

function uid(prefix: string): string {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function createDefaultDoc(): ProjectDoc {
  return {
    version: 1,
    meta: { name: '未命名工程', designWidth: 1334, designHeight: 750, orientation: 'landscape' },
    commonLayer: { id: 'common', name: '公共层', nodes: [] },
    customWidgets: [],
    pages: [{ id: uid('p'), name: '页面 1', nodes: [] }]
  }
}

/** currentPageIndex < 0 = 正在编辑公共层；返回该编辑目标的节点数组（用于 mutate 内部，随克隆文档变化） */
function pageNodesOf(d: ProjectDoc, pageIndex: number): WidgetNode[] {
  return pageIndex < 0 ? d.commonLayer.nodes : (d.pages[pageIndex]?.nodes ?? [])
}

function clonePage(page: PageData): PageData {
  return {
    id: uid('p'),
    name: page.name + ' 副本',
    nodes: page.nodes.map((n) => reids(structuredClone(n), () => uid('n')))
  }
}

interface DropTarget {
  kind: 'root' | 'tab' | 'container' | 'slot'
  /** tab：容器 id + 页签下标；container：容器 id；slot：实例 id + 插槽键 */
  id?: string
  pageIndex?: number
  key?: string
}

/** 递归找最深的落点容器：Tab 内容区 / 面板等 children / 定制控件插槽 */
function findDropTarget(
  arr: WidgetNode[],
  cx: number,
  cy: number,
  defs: CustomWidgetDef[]
): DropTarget {
  for (let i = arr.length - 1; i >= 0; i--) {
    const n = arr[i]
    if (!n.visible) continue
    if (n.type === 'custom' && n.customId) {
      const def = defs.find((d) => d.id === n.customId)
      if (def) {
        const { slots } = renderCustomInstance(n, def, defs)
        for (const sl of slots) {
          const r = sl.rect
          if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
            const deeper = findDropTarget(sl.children, cx, cy, defs)
            if (deeper.kind !== 'root') return deeper
            return { kind: 'slot', id: n.id, key: sl.key }
          }
        }
      }
    }
    const cr = contentRectOf(n)
    if (cr && cx >= cr.x && cx <= cr.x + cr.w && cy >= cr.y && cy <= cr.y + cr.h) {
      const kids = renderKidsOf(n)
      if (kids) {
        const deeper = findDropTarget(kids, cx, cy, defs)
        if (deeper.kind !== 'root') return deeper
      }
      if (n.type === 'tab') return { kind: 'tab', id: n.id, pageIndex: activeTabIndex(n) }
      return { kind: 'container', id: n.id }
    }
  }
  return { kind: 'root' }
}

/** 定制控件循环引用检查：defTree 内（含传递引用）是否已引用 targetId */
function treeReferences(tree: WidgetNode[], targetId: string, defs: CustomWidgetDef[]): boolean {
  let found = false
  walkNodes(tree, (n) => {
    if (n.type === 'custom' && n.customId) {
      if (n.customId === targetId) {
        found = true
        return
      }
      const d = defs.find((x) => x.id === n.customId)
      if (d && treeReferences(d.tree, targetId, defs)) found = true
    }
  })
  return found
}

/** 把节点挂到落点（在已克隆的文档上执行） */
function attachToTarget(
  root: WidgetNode[],
  target: DropTarget,
  defs: CustomWidgetDef[],
  node: WidgetNode
): void {
  if (target.kind === 'root') {
    root.push(node)
    return
  }
  const parent = findNodeById(root, target.id!)
  if (!parent) {
    root.push(node)
    return
  }
  if (target.kind === 'tab') {
    if (!parent.pages) parent.pages = []
    const idx = Math.max(0, target.pageIndex ?? 0)
    if (!parent.pages[idx]) parent.pages[idx] = []
    parent.pages[idx].push(node)
  } else if (target.kind === 'container') {
    if (!parent.children) parent.children = []
    parent.children.push(node)
  } else {
    if (!parent.slots) parent.slots = {}
    if (!parent.slots[target.key!]) parent.slots[target.key!] = []
    parent.slots[target.key!].push(node)
  }
}

interface EditorState {
  doc: ProjectDoc
  /** 是否已打开工程（启动默认 false，显示欢迎页） */
  hasProject: boolean
  filePath: string | null
  dirty: boolean
  currentPageIndex: number
  /** 正在编辑的定制控件定义 id（null = 编辑页面 / 公共层） */
  editingWidgetId: string | null
  selectedIds: string[]
  clipboard: WidgetNode[]
  viewport: Viewport
  showGrid: boolean
  snapEnabled: boolean
  gridSize: number
  /** 分辨率预览（§6）：'design' = 设计尺寸 */
  previewRatio: string
  showSafeArea: boolean
  mouse: { x: number; y: number }
  past: ProjectDoc[]
  future: ProjectDoc[]
  fitToken: number
  showNewModal: boolean

  currentPage: () => PageData
  /** 当前编辑目标的节点数组（页面 / 公共层 / 定制控件定义树） */
  editRoot: () => WidgetNode[]

  /** 修改文档；live=true 时不入撤销栈（用于拖拽过程中的连续更新） */
  mutate: (fn: (d: ProjectDoc) => void, live?: boolean) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void

  setSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  selectAll: () => void

  /** 添加控件；落点在某容器内容区 / 插槽内时自动挂进去 */
  addWidget: (def: WidgetDef, cx: number, cy: number) => void
  /** 从定制控件库实例化（含建议锚点吸附） */
  addWidgetCustom: (customId: string, cx: number, cy: number) => void
  /** live=true 不入撤销栈 */
  updateNodes: (ids: string[], fn: (n: WidgetNode) => void, live?: boolean) => void
  deleteSelected: () => void
  copySelected: () => void
  paste: () => void
  duplicateSelected: () => void
  nudge: (dx: number, dy: number) => void

  moveLayer: (id: string, dir: 1 | -1) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  alignSelected: (mode: AlignMode) => void
  distributeSelected: (axis: DistributeAxis) => void

  addPage: () => void
  duplicatePage: (index: number) => void
  deletePage: (index: number) => void
  renamePage: (index: number, name: string) => void
  setCurrentPage: (index: number) => void
  /** 切入定制控件定义编辑（null = 回到页面编辑） */
  setEditingWidget: (id: string | null) => void

  /** 定制控件（§5） */
  createCustomWidget: (skeleton: {
    kind: 'blank' | 'tab' | 'panel' | 'dialog' | 'scroll'
    tabs?: string[]
    barPosition?: 'top' | 'bottom'
    title?: string
  }) => string
  /** 画布选中组合 → 存为定制控件，原位替换为实例 */
  saveSelectionAsCustom: () => void
  /** 发布设置（名称 / 分组 / 默认尺寸 / 建议锚点） */
  publishCustomWidget: (
    id: string,
    meta: { name: string; group: string; w: number; h: number; suggestAnchor: CustomWidgetDef['suggestAnchor'] }
  ) => void
  renameCustomWidget: (id: string, name: string) => void
  deleteCustomWidget: (id: string) => void
  /** 通用定义修改（暴露属性 / 插槽标记等） */
  mutateWidget: (id: string, fn: (def: CustomWidgetDef) => void) => void
  /** 打散实例为普通组合（§5.2） */
  detachInstance: (id: string) => void

  newProject: (meta: ProjectMeta) => void
  loadProject: (doc: ProjectDoc, path: string) => void
  closeProject: () => void
  markSaved: (path: string) => void

  setViewport: (v: Viewport) => void
  panBy: (dx: number, dy: number) => void
  zoomAt: (sx: number, sy: number, factor: number) => void
  zoomByCenter: (factor: number) => void
  setZoom100: () => void
  fitView: () => void
  setMouse: (x: number, y: number) => void
  toggleGrid: () => void
  toggleSnap: () => void
  setShowNewModal: (v: boolean) => void
  setPreviewRatio: (id: string) => void
  toggleSafeArea: () => void
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: createDefaultDoc(),
  hasProject: false,
  filePath: null,
  dirty: false,
  currentPageIndex: 0,
  editingWidgetId: null,
  selectedIds: [],
  clipboard: [],
  viewport: { zoom: 1, panX: 60, panY: 60 },
  showGrid: true,
  snapEnabled: true,
  gridSize: 10,
  previewRatio: 'design',
  showSafeArea: false,
  mouse: { x: 0, y: 0 },
  past: [],
  future: [],
  fitToken: 0,
  showNewModal: false,

  currentPage: () => {
    const s = get()
    return s.currentPageIndex < 0
      ? s.doc.commonLayer
      : s.doc.pages[Math.min(s.currentPageIndex, s.doc.pages.length - 1)]
  },

  editRoot: () => {
    const s = get()
    if (s.editingWidgetId) {
      return s.doc.customWidgets.find((w) => w.id === s.editingWidgetId)?.tree ?? []
    }
    return s.currentPage().nodes
  },

  mutate: (fn, live) => {
    const s = get()
    const past = live ? s.past : [...s.past.slice(-99), structuredClone(s.doc)]
    const next = structuredClone(s.doc)
    fn(next)
    set({ doc: next, dirty: true, past, future: live ? s.future : [] })
  },

  pushHistory: () => {
    const s = get()
    set({ past: [...s.past.slice(-99), structuredClone(s.doc)], future: [] })
  },

  undo: () => {
    const s = get()
    if (!s.past.length) return
    const prev = s.past[s.past.length - 1]
    set({
      doc: prev,
      past: s.past.slice(0, -1),
      future: [s.doc, ...s.future].slice(0, 100),
      dirty: true,
      selectedIds: []
    })
  },

  redo: () => {
    const s = get()
    if (!s.future.length) return
    const next = s.future[0]
    set({ doc: next, future: s.future.slice(1), past: [...s.past, s.doc], dirty: true, selectedIds: [] })
  },

  setSelection: (ids) => set({ selectedIds: ids }),

  toggleSelection: (id) => {
    const s = get()
    set({
      selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((i) => i !== id) : [...s.selectedIds, id]
    })
  },

  selectAll: () => {
    const ids: string[] = []
    walkNodes(get().editRoot(), (n) => ids.push(n.id))
    set({ selectedIds: ids })
  },

  addWidget: (def, cx, cy) => {
    const s = get()
    const g = s.snapEnabled ? s.gridSize : 1
    const x = Math.round((cx - def.w / 2) / g) * g
    const y = Math.round((cy - def.h / 2) / g) * g
    const root = s.editRoot()
    const count = walkCount(root, def.label) + 1
    const node: WidgetNode = {
      id: uid('n'),
      type: def.type,
      name: `${def.label} ${count}`,
      x,
      y,
      w: def.w,
      h: def.h,
      visible: true,
      locked: false,
      props: structuredClone(def.props)
    }
    if (def.type === 'tab') {
      node.activeTab = 0
      node.pages = (def.props.tabs ?? ['页签 1']).map(() => [])
    }
    if (def.type === 'list' || def.type === 'grid') node.itemTags = []
    // 递归几何落点：最深容器内容区 / 定制控件插槽
    const target = findDropTarget(root, cx, cy, s.doc.customWidgets)
    s.mutate((d) => {
      const arr = editNodesOf(d, s)
      attachToTarget(arr, target, d.customWidgets, node)
    })
    set({ selectedIds: [node.id] })
  },

  addWidgetCustom: (customId, cx, cy) => {
    const s = get()
    const def = s.doc.customWidgets.find((d) => d.id === customId)
    if (!def) return
    // 禁止循环引用（§5.2）：不能把定义自身（或其引用链上的定义）放进正在编辑的定义
    if (s.editingWidgetId) {
      const editing = s.doc.customWidgets.find((w) => w.id === s.editingWidgetId)
      if (
        customId === s.editingWidgetId ||
        (editing && treeReferences(editing.tree, customId, s.doc.customWidgets))
      ) {
        alert(`不能把「${def.name}」放进自己（或其引用链）的定义里`)
        return
      }
    }
    const g = s.snapEnabled ? s.gridSize : 1
    const root = s.editRoot()
    const target = findDropTarget(root, cx, cy, s.doc.customWidgets)
    let x = Math.round((cx - def.w / 2) / g) * g
    let y = Math.round((cy - def.h / 2) / g) * g
    let w = def.w
    let h = def.h
    let anchor: WidgetNode['anchor']
    // 建议锚点：拖到页面根时自动吸附对应边（§5.1）
    if (target.kind === 'root' && !s.editingWidgetId) {
      const { designWidth: dw, designHeight: dh } = s.doc.meta
      if (def.suggestAnchor === 'top-stretch') {
        x = 0
        w = dw
        anchor = { preset: 'tc', mode: 'stretch' }
      } else if (def.suggestAnchor === 'bottom-stretch') {
        x = 0
        y = dh - def.h
        w = dw
        anchor = { preset: 'bc', mode: 'stretch' }
      }
    }
    const count = walkCount(root, def.name) + 1
    const node: WidgetNode = {
      id: uid('n'),
      type: 'custom',
      customId,
      name: `${def.name} ${count}`,
      x,
      y,
      w,
      h,
      visible: true,
      locked: false,
      props: {},
      ...(anchor ? { anchor } : {})
    }
    s.mutate((d) => {
      const arr = editNodesOf(d, s)
      attachToTarget(arr, target, d.customWidgets, node)
    })
    set({ selectedIds: [node.id] })
  },

  updateNodes: (ids, fn, live) => {
    const s = get()
    const idSet = new Set(ids)
    s.mutate((d) => {
      const moved: { n: WidgetNode; dx: number; dy: number }[] = []
      walkNodes(editNodesOf(d, s), (n) => {
        if (!idSet.has(n.id)) return
        const x0 = n.x
        const y0 = n.y
        fn(n)
        if (n.x !== x0 || n.y !== y0) moved.push({ n, dx: n.x - x0, dy: n.y - y0 })
      })
      // 容器移动 → 子孙跟随（子控件为页面绝对坐标；已在更新列表里的子孙按自身增量处理）
      for (const { n, dx, dy } of moved) {
        const shift = (m: WidgetNode): void => {
          for (const sub of childSubtreesOf(m)) {
            for (const c of sub) {
              if (idSet.has(c.id)) continue
              c.x += dx
              c.y += dy
              shift(c)
            }
          }
        }
        shift(n)
      }
    }, live)
  },

  deleteSelected: () => {
    const s = get()
    if (!s.selectedIds.length) return
    const ids = new Set(s.selectedIds)
    s.mutate((d) => {
      const rm = (arr: WidgetNode[]): void => {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (ids.has(arr[i].id)) arr.splice(i, 1)
          else for (const sub of childSubtreesOf(arr[i])) rm(sub)
        }
      }
      rm(editNodesOf(d, s))
    })
    set({ selectedIds: [] })
  },

  copySelected: () => {
    const s = get()
    const ids = new Set(s.selectedIds)
    const found: WidgetNode[] = []
    walkNodes(s.editRoot(), (n) => {
      if (ids.has(n.id)) found.push(n)
    })
    set({ clipboard: structuredClone(found) })
  },

  paste: () => {
    const s = get()
    if (!s.clipboard.length) return
    const clones = s.clipboard.map((n) => {
      const c = reids(structuredClone(n), () => uid('n'))
      c.x = n.x + 20
      c.y = n.y + 20
      return c
    })
    s.mutate((d) => {
      editNodesOf(d, s).push(...clones)
    })
    set({ selectedIds: clones.map((c) => c.id) })
  },

  duplicateSelected: () => {
    const s = get()
    s.copySelected()
    s.paste()
  },

  nudge: (dx, dy) => {
    const s = get()
    if (!s.selectedIds.length) return
    const selSet = new Set(s.selectedIds)
    const ids: string[] = []
    collectWithDescendants(s.editRoot(), selSet, ids)
    s.updateNodes(ids, (n) => {
      n.x += dx
      n.y += dy
    })
  },

  moveLayer: (id, dir) => {
    const s = get()
    s.mutate((d) => {
      const arr = findContainerArrayIn(editNodesOf(d, s), id)
      if (!arr) return
      const i = arr.findIndex((n) => n.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= arr.length) return
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    })
  },

  bringToFront: (id) => {
    const s = get()
    s.mutate((d) => {
      const arr = findContainerArrayIn(editNodesOf(d, s), id)
      if (!arr) return
      const i = arr.findIndex((n) => n.id === id)
      if (i < 0 || i === arr.length - 1) return
      arr.push(arr.splice(i, 1)[0])
    })
  },

  sendToBack: (id) => {
    const s = get()
    s.mutate((d) => {
      const arr = findContainerArrayIn(editNodesOf(d, s), id)
      if (!arr) return
      const i = arr.findIndex((n) => n.id === id)
      if (i <= 0) return
      arr.unshift(arr.splice(i, 1)[0])
    })
  },

  alignSelected: (mode) => {
    const s = get()
    const ids = new Set(s.selectedIds)
    const ns: WidgetNode[] = []
    walkNodes(s.editRoot(), (n) => {
      if (ids.has(n.id)) ns.push(n)
    })
    if (ns.length < 2) return
    const minX = Math.min(...ns.map((n) => n.x))
    const maxX = Math.max(...ns.map((n) => n.x + n.w))
    const minY = Math.min(...ns.map((n) => n.y))
    const maxY = Math.max(...ns.map((n) => n.y + n.h))
    const idList = ns.map((n) => n.id)
    s.updateNodes(idList, (n) => {
      if (mode === 'left') n.x = minX
      else if (mode === 'right') n.x = maxX - n.w
      else if (mode === 'hcenter') n.x = (minX + maxX) / 2 - n.w / 2
      else if (mode === 'top') n.y = minY
      else if (mode === 'bottom') n.y = maxY - n.h
      else if (mode === 'vcenter') n.y = (minY + maxY) / 2 - n.h / 2
    })
  },

  distributeSelected: (axis) => {
    const s = get()
    const ids = new Set(s.selectedIds)
    const ns: WidgetNode[] = []
    walkNodes(s.editRoot(), (n) => {
      if (ids.has(n.id)) ns.push(n)
    })
    if (ns.length < 3) return
    const sorted = [...ns].sort((a, b) => (axis === 'h' ? a.x - b.x : a.y - b.y))
    const size = (n: WidgetNode) => (axis === 'h' ? n.w : n.h)
    const pos = (n: WidgetNode) => (axis === 'h' ? n.x : n.y)
    const last = sorted[sorted.length - 1]
    const span = pos(last) + size(last) - pos(sorted[0])
    const total = sorted.reduce((acc, n) => acc + size(n), 0)
    if (span <= total) return
    const gap = (span - total) / (sorted.length - 1)
    let cursor = pos(sorted[0])
    const moves = new Map(sorted.map((n) => [n.id, cursor]))
    for (const n of sorted) {
      moves.set(n.id, cursor)
      cursor += size(n) + gap
    }
    s.updateNodes(ns.map((n) => n.id), (n) => {
      if (axis === 'h') n.x = moves.get(n.id)!
      else n.y = moves.get(n.id)!
    })
  },

  addPage: () => {
    const s = get()
    const page: PageData = { id: uid('p'), name: `页面 ${s.doc.pages.length + 1}`, nodes: [] }
    s.mutate((d) => {
      d.pages.push(page)
    })
    set({ currentPageIndex: s.doc.pages.length, selectedIds: [], editingWidgetId: null })
  },

  duplicatePage: (index) => {
    const s = get()
    const src = s.doc.pages[index]
    if (!src) return
    const copy = clonePage(src)
    s.mutate((d) => {
      d.pages.splice(index + 1, 0, copy)
    })
    set({ currentPageIndex: index + 1, selectedIds: [], editingWidgetId: null })
  },

  deletePage: (index) => {
    const s = get()
    if (s.doc.pages.length <= 1) return
    s.mutate((d) => {
      d.pages.splice(index, 1)
    })
    set({
      currentPageIndex: Math.min(s.currentPageIndex, s.doc.pages.length - 1),
      selectedIds: [],
      editingWidgetId: null
    })
  },

  renamePage: (index, name) => {
    const s = get()
    if (!name.trim()) return
    s.mutate((d) => {
      const p = d.pages[index]
      if (p) p.name = name.trim()
    })
  },

  setCurrentPage: (index) => set({ currentPageIndex: index, selectedIds: [], editingWidgetId: null }),

  setEditingWidget: (id) => set({ editingWidgetId: id, selectedIds: [] }),

  createCustomWidget: (skeleton) => {
    const s = get()
    const def: CustomWidgetDef = {
      id: uid('w'),
      name: `定制控件 ${s.doc.customWidgets.length + 1}`,
      group: '未分组',
      w: 320,
      h: 240,
      props: [],
      tree: [],
      slotNodeIds: []
    }
    if (skeleton.kind !== 'blank') {
      const label = { tab: 'Tab 页签', panel: '面板', dialog: '弹窗', scroll: '滚动区' }[skeleton.kind]
      const node: WidgetNode = {
        id: uid('n'),
        type: skeleton.kind,
        name: label,
        x: 40,
        y: 40,
        w: 480,
        h: 320,
        visible: true,
        locked: false,
        props: {}
      }
      if (skeleton.kind === 'tab') {
        node.props = { tabs: skeleton.tabs?.length ? skeleton.tabs : ['页签 1', '页签 2'], barPosition: skeleton.barPosition ?? 'top' }
        node.activeTab = 0
        node.pages = (node.props.tabs ?? []).map(() => [])
      } else if (skeleton.kind === 'dialog') {
        node.props = { title: skeleton.title ?? '弹窗标题' }
        node.children = []
      } else {
        node.children = []
      }
      def.tree = [node]
      def.w = node.w + 80
      def.h = node.h + 80
    }
    s.mutate((d) => {
      d.customWidgets.push(def)
    })
    set({ editingWidgetId: def.id, selectedIds: [] })
    return def.id
  },

  saveSelectionAsCustom: () => {
    const s = get()
    const ids = new Set(s.selectedIds)
    const picked: WidgetNode[] = []
    walkNodes(s.editRoot(), (n) => {
      if (ids.has(n.id)) picked.push(n)
    })
    if (!picked.length) return
    const bb = bboxOf(picked)
    if (!bb) return
    const tree = picked.map((n) => reids(structuredClone(n), () => uid('n')))
    for (const n of tree) {
      n.x -= bb.x
      n.y -= bb.y
    }
    const def: CustomWidgetDef = {
      id: uid('w'),
      name: `定制控件 ${s.doc.customWidgets.length + 1}`,
      group: '未分组',
      w: bb.w,
      h: bb.h,
      props: [],
      tree,
      slotNodeIds: []
    }
    const instance: WidgetNode = {
      id: uid('n'),
      type: 'custom',
      customId: def.id,
      name: def.name,
      x: bb.x,
      y: bb.y,
      w: bb.w,
      h: bb.h,
      visible: true,
      locked: false,
      props: {},
      slots: {}
    }
    s.mutate((d) => {
      // 原选中组合从编辑目标移除，原位替换为实例
      const rm = (arr: WidgetNode[]): void => {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (ids.has(arr[i].id)) arr.splice(i, 1)
          else for (const sub of childSubtreesOf(arr[i])) rm(sub)
        }
      }
      const root = editNodesOf(d, s)
      rm(root)
      root.push(instance)
      d.customWidgets.push(def)
    })
    set({ selectedIds: [instance.id] })
  },

  publishCustomWidget: (id, meta) => {
    const s = get()
    if (!meta.name.trim() || meta.w < 8 || meta.h < 8) return
    s.mutate((d) => {
      const def = d.customWidgets.find((w) => w.id === id)
      if (!def) return
      def.name = meta.name.trim()
      def.group = meta.group.trim() || '未分组'
      def.w = Math.round(meta.w)
      def.h = Math.round(meta.h)
      def.suggestAnchor = meta.suggestAnchor
    })
  },

  renameCustomWidget: (id, name) => {
    const s = get()
    if (!name.trim()) return
    s.mutate((d) => {
      const def = d.customWidgets.find((w) => w.id === id)
      if (def) def.name = name.trim()
    })
  },

  deleteCustomWidget: (id) => {
    const s = get()
    const def = s.doc.customWidgets.find((w) => w.id === id)
    if (!def) return
    // 影响范围提示（§5.3）
    let refs = 0
    for (const p of [s.doc.commonLayer, ...s.doc.pages]) {
      walkNodes(p.nodes, (n) => {
        if (n.type === 'custom' && n.customId === id) refs++
      })
    }
    for (const w of s.doc.customWidgets) {
      if (w.id !== id) walkNodes(w.tree, (n) => {
        if (n.type === 'custom' && n.customId === id) refs++
      })
    }
    if (refs > 0 && !window.confirm(`「${def.name}」被 ${refs} 处实例引用，删除后这些实例将显示为占位框。确定删除？`)) {
      return
    }
    s.mutate((d) => {
      d.customWidgets = d.customWidgets.filter((w) => w.id !== id)
    })
    if (s.editingWidgetId === id) set({ editingWidgetId: null, selectedIds: [] })
  },

  mutateWidget: (id, fn) => {
    const s = get()
    s.mutate((d) => {
      const def = d.customWidgets.find((w) => w.id === id)
      if (def) fn(def)
    })
  },

  detachInstance: (id) => {
    const s = get()
    const root = s.editRoot()
    const inst = findNodeById(root, id)
    if (!inst || inst.type !== 'custom' || !inst.customId) return
    const def = s.doc.customWidgets.find((d) => d.id === inst.customId)
    if (!def) {
      alert('定义已删除，无法打散')
      return
    }
    // 解析暴露属性 + 缩放到实例位置（保持定义 id 以便插槽回填，最后统一换 id）
    const resolved = resolveTree(def, inst.overrides)
    const scaled = scaleTree(resolved, inst.w / def.w, inst.h / def.h, inst.x, inst.y)
    const slotKeys = Object.keys(inst.slots ?? {})
    if (slotKeys.length) {
      const slots = slotsOfDefLocal(scaled, def)
      for (const sk of slotKeys) {
        const info = slots.find((x) => x.key === sk)
        const children = inst.slots?.[sk] ?? []
        if (!info || !children.length) continue
        const container = findNodeById(scaled, info.containerId)
        if (!container) continue
        if (info.pageIndex !== undefined) {
          if (!container.pages) container.pages = []
          if (!container.pages[info.pageIndex]) container.pages[info.pageIndex] = []
          container.pages[info.pageIndex].push(...structuredClone(children))
        } else {
          if (!container.children) container.children = []
          container.children.push(...structuredClone(children))
        }
      }
    }
    const expanded = scaled.map((n) => reids(n, () => uid('n')))
    s.mutate((d) => {
      const arr = findContainerArrayIn(editNodesOf(d, s), id)
      if (!arr) return
      const i = arr.findIndex((n) => n.id === id)
      if (i < 0) return
      arr.splice(i, 1, ...expanded)
    })
    set({ selectedIds: expanded.map((n) => n.id) })
  },

  newProject: (meta) => {
    set({
      doc: {
        version: 1,
        meta,
        commonLayer: { id: 'common', name: '公共层', nodes: [] },
        customWidgets: [],
        pages: [{ id: uid('p'), name: '页面 1', nodes: [] }]
      },
      hasProject: true,
      filePath: null,
      dirty: false,
      currentPageIndex: 0,
      editingWidgetId: null,
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      previewRatio: 'design',
      fitToken: get().fitToken + 1,
      showNewModal: false
    })
  },

  loadProject: (doc, path) => {
    set({
      doc,
      hasProject: true,
      filePath: path,
      dirty: false,
      currentPageIndex: 0,
      editingWidgetId: null,
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      previewRatio: 'design',
      fitToken: get().fitToken + 1
    })
  },

  closeProject: () => {
    set({
      doc: createDefaultDoc(),
      hasProject: false,
      filePath: null,
      dirty: false,
      currentPageIndex: 0,
      editingWidgetId: null,
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      previewRatio: 'design'
    })
  },

  markSaved: (path) => set({ filePath: path, dirty: false }),

  setViewport: (v) => set({ viewport: v }),

  panBy: (dx, dy) => {
    const v = get().viewport
    set({ viewport: { ...v, panX: v.panX + dx, panY: v.panY + dy } })
  },

  zoomAt: (sx, sy, factor) => {
    const v = get().viewport
    const zoom = Math.min(8, Math.max(0.1, v.zoom * factor))
    const k = zoom / v.zoom
    set({
      viewport: {
        zoom,
        panX: sx - (sx - v.panX) * k,
        panY: sy - (sy - v.panY) * k
      }
    })
  },

  zoomByCenter: (factor) => {
    const el = canvasEl.current
    if (!el) {
      get().zoomAt(400, 300, factor)
      return
    }
    const r = el.getBoundingClientRect()
    get().zoomAt(r.width / 2, r.height / 2, factor)
  },

  setZoom100: () => {
    const v = get().viewport
    get().zoomByCenter(1 / v.zoom)
  },

  fitView: () => {
    const el = canvasEl.current
    if (!el) return
    const { designWidth: dw, designHeight: dh } = get().doc.meta
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    const zoom = Math.min((r.width - 80) / dw, (r.height - 80) / dh, 2)
    set({
      viewport: {
        zoom,
        panX: (r.width - dw * zoom) / 2,
        panY: (r.height - dh * zoom) / 2
      }
    })
  },

  setMouse: (x, y) => set({ mouse: { x: Math.round(x), y: Math.round(y) } }),

  toggleGrid: () => set({ showGrid: !get().showGrid }),
  toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),
  setShowNewModal: (v) => set({ showNewModal: v }),
  setPreviewRatio: (id) => set({ previewRatio: id, selectedIds: [] }),
  toggleSafeArea: () => set({ showSafeArea: !get().showSafeArea })
}))

/** 当前编辑目标的节点数组（mutate 内部，随克隆文档变化） */
function editNodesOf(d: ProjectDoc, s: { currentPageIndex: number; editingWidgetId: string | null }): WidgetNode[] {
  if (s.editingWidgetId) {
    return d.customWidgets.find((w) => w.id === s.editingWidgetId)?.tree ?? []
  }
  return pageNodesOf(d, s.currentPageIndex)
}

function childSubtreesOf(n: WidgetNode): WidgetNode[][] {
  const out: WidgetNode[][] = []
  if (n.pages) out.push(...n.pages)
  if (n.children) out.push(n.children)
  if (n.slots) out.push(...Object.values(n.slots))
  return out
}

function findContainerArrayIn(arr: WidgetNode[], id: string): WidgetNode[] | null {
  if (arr.some((m) => m.id === id)) return arr
  for (const m of arr) {
    for (const sub of childSubtreesOf(m)) {
      const r = findContainerArrayIn(sub, id)
      if (r) return r
    }
  }
  return null
}

function walkCount(arr: WidgetNode[], label: string): number {
  let c = 0
  walkNodes(arr, (n) => {
    if (n.name.startsWith(label)) c++
  })
  return c
}

/** detachInstance 用：插槽键 → 定义树容器（含 Tab 页签下标） */
function slotsOfDefLocal(innerTree: WidgetNode[], def: CustomWidgetDef): { key: string; containerId: string; pageIndex?: number }[] {
  const out: { key: string; containerId: string; pageIndex?: number }[] = []
  for (const n of innerTree) {
    if (n.type === 'tab' && n.pages) {
      const tabs = n.props.tabs?.length ? n.props.tabs : ['页签 1']
      tabs.forEach((_, i) => out.push({ key: `${n.id}:${i}`, containerId: n.id, pageIndex: i }))
    } else if (def.slotNodeIds?.includes(n.id)) {
      out.push({ key: n.id, containerId: n.id })
    }
  }
  return out
}
