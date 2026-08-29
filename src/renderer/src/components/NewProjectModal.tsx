import { useState } from 'react'
import { useEditor } from '../store/editorStore'
import type { Orientation } from '../types'

const PRESETS: Record<Orientation, { w: number; h: number; label: string }[]> = {
  landscape: [
    { w: 1334, h: 750, label: '1334 × 750' },
    { w: 1280, h: 720, label: '1280 × 720' },
    { w: 1920, h: 1080, label: '1920 × 1080' }
  ],
  portrait: [
    { w: 750, h: 1334, label: '750 × 1334' },
    { w: 1170, h: 2532, label: '1170 × 2532' },
    { w: 1080, h: 1920, label: '1080 × 1920' }
  ]
}

export default function NewProjectModal() {
  const newProject = useEditor((s) => s.newProject)
  const setShowNewModal = useEditor((s) => s.setShowNewModal)
  const [name, setName] = useState('未命名工程')
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const [w, setW] = useState(1334)
  const [h, setH] = useState(750)

  const switchOrientation = (o: Orientation) => {
    setOrientation(o)
    if (o === 'landscape') {
      setW(1334)
      setH(750)
    } else {
      setW(750)
      setH(1334)
    }
  }

  const create = () => {
    newProject({
      name: name.trim() || '未命名工程',
      designWidth: Math.max(200, Math.round(w) || 1334),
      designHeight: Math.max(200, Math.round(h) || 750),
      orientation
    })
  }

  return (
    <div
      className="modal-mask"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) setShowNewModal(false)
      }}
    >
      <div className="modal">
        <h3>新建工程</h3>
        <div className="form-row">
          <span>工程名称</span>
          <input type="text" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <span>方向</span>
          <div className="seg">
            <button className={orientation === 'landscape' ? 'on' : ''} onClick={() => switchOrientation('landscape')}>
              横屏
            </button>
            <button className={orientation === 'portrait' ? 'on' : ''} onClick={() => switchOrientation('portrait')}>
              竖屏
            </button>
          </div>
        </div>
        <div className="form-row">
          <span>预设尺寸</span>
          <div className="preset-list">
            {PRESETS[orientation].map((ps) => (
              <button
                key={ps.label}
                className={'preset-btn' + (w === ps.w && h === ps.h ? ' on' : '')}
                onClick={() => {
                  setW(ps.w)
                  setH(ps.h)
                }}
              >
                {ps.label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <span>自定义</span>
          <input type="number" value={w} onChange={(e) => setW(Number(e.target.value))} />
          <span style={{ width: 'auto' }}>×</span>
          <input type="number" value={h} onChange={(e) => setH(Number(e.target.value))} />
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setShowNewModal(false)}>
            取消
          </button>
          <button className="btn primary" onClick={create}>
            创建
          </button>
        </div>
      </div>
    </div>
  )
}
