import { useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'

/**
 * 面板拉伸条：dir='v' 拖拽调整相邻面板宽度（左右布局间），dir='h' 调整高度（上下布局间）。
 * 拖拽过程中通过 onResize 增量回调，由调用方负责累加与钳制。
 *
 * 事件监听挂在 window 而非拉伸条自身：不依赖 setPointerCapture，
 * 即使快速拖拽中捕获失效、指针落在画布或窗口外释放，pointerup 也必定送达，
 * 拉伸状态总能被正确终止。
 */
export default function Resizer({
  dir,
  onResize
}: {
  dir: 'v' | 'h'
  onResize: (delta: number) => void
}) {
  const [active, setActive] = useState(false)
  const dragging = useRef(false)

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || dragging.current) return
    e.preventDefault()
    dragging.current = true
    setActive(true)
    // 拖拽时锁定全局光标，指针快速划出拉伸条也保持形状
    document.body.classList.add(dir === 'v' ? 'resizing-v' : 'resizing-h')
    let last = dir === 'v' ? e.clientX : e.clientY
    const move = (ev: PointerEvent) => {
      const cur = dir === 'v' ? ev.clientX : ev.clientY
      if (cur !== last) {
        onResize(cur - last)
        last = cur
      }
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up)
      dragging.current = false
      setActive(false)
      document.body.classList.remove('resizing-v', 'resizing-h')
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    // 中途切走窗口（⌘Tab 等）时直接结束本次拉伸
    window.addEventListener('blur', up)
  }

  return (
    <div
      className={'resizer-' + dir + (active ? ' active' : '')}
      title="拖拽调整面板大小"
      onPointerDown={down}
    />
  )
}
