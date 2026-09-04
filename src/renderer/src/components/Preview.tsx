import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../store/editorStore'
import PreviewNode, { previewScrollOffsets } from './PreviewNode'
import PopupLayer from './PopupLayer'
import TipLayer from './TipLayer'

/**
 * 原型预览（§8 / §10）：复用同一套 SVG 渲染器，把整套工程跑起来——
 * 可点击控件触发效果（切页 / 返回上一页 / 弹窗）、Tab 页签就地切换 / 导航跳转，
 * 滚动区滚轮滚动，公共层常驻可交互；Esc 退出。
 */
export default function Preview() {
  const doc = useEditor((s) => s.doc)
  const pageIndex = useEditor((s) => s.currentPageIndex)
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const { designWidth: dw, designHeight: dh } = doc.meta

  // 每次进入预览重置滚动位置
  useEffect(() => {
    previewScrollOffsets.clear()
  }, [])

  const fit = () => {
    const el = stageRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return
    setZoom(Math.max(0.1, Math.min((r.width - 48) / dw, (r.height - 48) / dh, 1.6)))
  }
  useEffect(() => {
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [dw, dh])

  const page = doc.pages[Math.min(pageIndex, doc.pages.length - 1)]

  // 事件坐标（屏幕）→ 文档坐标（预览画板按 viewBox 等比映射）
  const toDoc = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * dw, y: ((e.clientY - r.top) / r.height) * dh }
  }
  const scale = 1 / zoom

  return (
    <div
      className="preview-overlay"
      onContextMenu={(e) => e.preventDefault()}
      onWheel={() => useEditor.getState().closeTip()}
    >
      <div className="preview-top">
        <span className="preview-title">▶ 原型预览 · {page?.name ?? ''}</span>
        <span className="preview-hint">
          可点击控件可跳转 / 返回 / 弹窗（✕ 关闭）· Tab 页签可切换 · 滚动区可滚轮滚动 · 悬停标记控件弹轻提示 · Esc 退出
        </span>
        <button className="tb-btn" onClick={() => useEditor.getState().stopPreview()}>
          ✕ 退出预览
        </button>
      </div>
      <div className="preview-stage" ref={stageRef}>
        <svg
          ref={svgRef}
          width={Math.round(dw * zoom)}
          height={Math.round(dh * zoom)}
          viewBox={`0 0 ${dw} ${dh}`}
        >
          <rect
            x={0}
            y={0}
            width={dw}
            height={dh}
            fill="#ffffff"
            style={{ filter: 'drop-shadow(0 10px 36px rgba(0,0,0,0.6))' }}
          />
          {/* 公共层：预览中常驻且可交互（如顶栏设置按钮） */}
          {doc.commonLayer.nodes
            .filter((n) => n.visible)
            .map((n) => <PreviewNode key={'common-' + n.id} n={n} defs={doc.customWidgets} toDoc={toDoc} wheel scale={scale} />)}
          {page.nodes
            .filter((n) => n.visible)
            .map((n) => <PreviewNode key={n.id} n={n} defs={doc.customWidgets} toDoc={toDoc} wheel scale={scale} />)}
          <PopupLayer defs={doc.customWidgets} boardW={dw} boardH={dh} toDoc={toDoc} wheel scale={scale} />
          <TipLayer defs={doc.customWidgets} boardW={dw} boardH={dh} toDoc={toDoc} />
        </svg>
      </div>
    </div>
  )
}
