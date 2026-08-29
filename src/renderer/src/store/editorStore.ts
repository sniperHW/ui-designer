import { create } from 'zustand'
import type { PageData, ProjectDoc, ProjectMeta, WidgetNode } from '../types'
import type { WidgetDef } from '../widgets/registry'
import { activeTabIndex, tabContentRect } from '../widgets/registry'
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
    pages: [{ id: uid('p'), name: '页面 1', nodes: [] }]
  }
}

function clonePage(page: PageData): PageData {
  return {
    id: uid('p'),
    name: page.name + ' 副本',
    nodes: page.nodes.map((n) => ({ ...structuredClone(n), id: uid('n') }))
  }
}

/** 深度遍历页面内所有节点（含 Tab 各页签子树） */
function walkNodes(arr: WidgetNode[], fn: (n: WidgetNode) => void): void {
  for (const n of arr) {
    fn(n)
    if (n.pages) for (const p of n.pages) walkNodes(p, fn)
  }
}

/** 选中节点及其全部子孙的 id（移动容器时子控件跟随） */
function collectWithDescendants(arr: WidgetNode[], selSet: Set<string>, out: string[]): void {
  for (const n of arr) {
    if (selSet.has(n.id)) {
      const add = (m: WidgetNode): void => {
        out.push(m.id)
        if (m.pages) for (const p of m.pages) for (const c of p) add(c)
      }
      add(n)
    } else if (n.pages) {
      for (const p of n.pages) collectWithDescendants(p, selSet, out)
    }
  }
}

/** 找到 id 所在的节点数组（页面根或某个 Tab 页签） */
function findContainerArray(arr: WidgetNode[], id: string): WidgetNode[] | null {
  if (arr.some((m) => m.id === id)) return arr
  for (const m of arr) {
    if (m.pages) {
      for (const p of m.pages) {
        const r = findContainerArray(p, id)
        if (r) return r
      }
    }
  }
  return null
}

interface EditorState {
  doc: ProjectDoc
  filePath: string | null
  dirty: boolean
  currentPageIndex: number
  selectedIds: string[]
  clipboard: WidgetNode[]
  viewport: Viewport
  showGrid: boolean
  snapEnabled: boolean
  gridSize: number
  mouse: { x: number; y: number }
  past: ProjectDoc[]
  future: ProjectDoc[]
  fitToken: number
  showNewModal: boolean

  currentPage: () => PageData

  /** 修改文档；live=true 时不入撤销栈（用于拖拽过程中的连续更新） */
  mutate: (fn: (d: ProjectDoc) => void, live?: boolean) => void
  pushHistory: () => void
  undo: () => void
  redo: () => void

  setSelection: (ids: string[]) => void
  toggleSelection: (id: string) => void
  selectAll: () => void

  /** 添加控件；落点在某 Tab 内容区内时自动成为该页签的子控件 */
  addWidget: (def: WidgetDef, cx: number, cy: number) => void
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

  newProject: (meta: ProjectMeta) => void
  loadProject: (doc: ProjectDoc, path: string) => void
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
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: createDefaultDoc(),
  filePath: null,
  dirty: false,
  currentPageIndex: 0,
  selectedIds: [],
  clipboard: [],
  viewport: { zoom: 1, panX: 60, panY: 60 },
  showGrid: true,
  snapEnabled: true,
  gridSize: 10,
  mouse: { x: 0, y: 0 },
  past: [],
  future: [],
  fitToken: 0,
  showNewModal: false,

  currentPage: () => {
    const s = get()
    return s.doc.pages[Math.min(s.currentPageIndex, s.doc.pages.length - 1)]
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
    walkNodes(get().currentPage().nodes, (n) => ids.push(n.id))
    set({ selectedIds: ids })
  },

  addWidget: (def, cx, cy) => {
    const s = get()
    const g = s.snapEnabled ? s.gridSize : 1
    const x = Math.round((cx - def.w / 2) / g) * g
    const y = Math.round((cy - def.h / 2) / g) * g
    const page = s.currentPage()
    const count = walkCount(page.nodes, def.label) + 1
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
    // 几何落点：在某 Tab 内容区内 → 成为该 Tab 当前页签的子控件
    let parent: WidgetNode | null = null
    for (let i = page.nodes.length - 1; i >= 0; i--) {
      const t = page.nodes[i]
      if (t.type !== 'tab' || !t.pages || !t.visible) continue
      const r = tabContentRect(t)
      if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) {
        parent = t
        break
      }
    }
    const parentId = parent?.id ?? null
    s.mutate((d) => {
      const target = parentId
        ? findNodeIn(d.pages[s.currentPageIndex].nodes, parentId)
        : null
      if (target && target.pages) {
        const idx = activeTabIndex(target)
        if (!target.pages[idx]) target.pages[idx] = []
        target.pages[idx].push(node)
      } else {
        d.pages[s.currentPageIndex].nodes.push(node)
      }
    })
    set({ selectedIds: [node.id] })
  },

  updateNodes: (ids, fn, live) => {
    const s = get()
    const idSet = new Set(ids)
    s.mutate((d) => {
      walkNodes(d.pages[s.currentPageIndex].nodes, (n) => {
        if (idSet.has(n.id)) fn(n)
      })
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
          else if (arr[i].pages) for (const p of arr[i].pages!) rm(p)
        }
      }
      rm(d.pages[s.currentPageIndex].nodes)
    })
    set({ selectedIds: [] })
  },

  copySelected: () => {
    const s = get()
    const ids = new Set(s.selectedIds)
    const found: WidgetNode[] = []
    walkNodes(s.currentPage().nodes, (n) => {
      if (ids.has(n.id)) found.push(n)
    })
    set({ clipboard: structuredClone(found) })
  },

  paste: () => {
    const s = get()
    if (!s.clipboard.length) return
    const clones = s.clipboard.map((n) => ({ ...structuredClone(n), id: uid('n'), x: n.x + 20, y: n.y + 20 }))
    s.mutate((d) => {
      d.pages[s.currentPageIndex].nodes.push(...clones)
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
    collectWithDescendants(s.currentPage().nodes, selSet, ids)
    s.updateNodes(ids, (n) => {
      n.x += dx
      n.y += dy
    })
  },

  moveLayer: (id, dir) => {
    const s = get()
    s.mutate((d) => {
      const arr = findContainerArray(d.pages[s.currentPageIndex].nodes, id)
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
      const arr = findContainerArray(d.pages[s.currentPageIndex].nodes, id)
      if (!arr) return
      const i = arr.findIndex((n) => n.id === id)
      if (i < 0 || i === arr.length - 1) return
      arr.push(arr.splice(i, 1)[0])
    })
  },

  sendToBack: (id) => {
    const s = get()
    s.mutate((d) => {
      const arr = findContainerArray(d.pages[s.currentPageIndex].nodes, id)
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
    walkNodes(s.currentPage().nodes, (n) => {
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
    walkNodes(s.currentPage().nodes, (n) => {
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
    set({ currentPageIndex: s.doc.pages.length, selectedIds: [] })
  },

  duplicatePage: (index) => {
    const s = get()
    const src = s.doc.pages[index]
    if (!src) return
    const copy = clonePage(src)
    s.mutate((d) => {
      d.pages.splice(index + 1, 0, copy)
    })
    set({ currentPageIndex: index + 1, selectedIds: [] })
  },

  deletePage: (index) => {
    const s = get()
    if (s.doc.pages.length <= 1) return
    s.mutate((d) => {
      d.pages.splice(index, 1)
    })
    set({
      currentPageIndex: Math.min(s.currentPageIndex, s.doc.pages.length - 1),
      selectedIds: []
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

  setCurrentPage: (index) => set({ currentPageIndex: index, selectedIds: [] }),

  newProject: (meta) => {
    set({
      doc: { version: 1, meta, pages: [{ id: uid('p'), name: '页面 1', nodes: [] }] },
      filePath: null,
      dirty: false,
      currentPageIndex: 0,
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      fitToken: get().fitToken + 1,
      showNewModal: false
    })
  },

  loadProject: (doc, path) => {
    set({
      doc,
      filePath: path,
      dirty: false,
      currentPageIndex: 0,
      selectedIds: [],
      clipboard: [],
      past: [],
      future: [],
      fitToken: get().fitToken + 1
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
  setShowNewModal: (v) => set({ showNewModal: v })
}))

function walkCount(arr: WidgetNode[], label: string): number {
  let c = 0
  walkNodes(arr, (n) => {
    if (n.name.startsWith(label)) c++
  })
  return c
}

function findNodeIn(arr: WidgetNode[], id: string): WidgetNode | null {
  for (const n of arr) {
    if (n.id === id) return n
    if (n.pages) {
      for (const p of n.pages) {
        const r = findNodeIn(p, id)
        if (r) return r
      }
    }
  }
  return null
}
