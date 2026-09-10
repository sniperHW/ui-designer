/// <reference types="vite/client" />

export interface Api {
  saveProject(args: { content: string; knownPath?: string; defaultName?: string }): Promise<string | null>
  openProject(): Promise<{ path: string; content: string } | null>
  exportPng(args: { defaultName: string; dataURL: string }): Promise<string | null>
  /** 最近打开列表（主进程已过滤磁盘上不存在的文件） */
  recentList(): Promise<{ path: string; name: string }[]>
  /** 按路径直接打开工程；文件已不存在时返回 null（主进程顺带清理该条记录） */
  openRecentProject(path: string): Promise<{ path: string; content: string } | null>
  clearRecent(): Promise<void>
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
