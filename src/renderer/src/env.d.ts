/// <reference types="vite/client" />

export interface Api {
  saveProject(args: { content: string; knownPath?: string; defaultName?: string }): Promise<string | null>
  openProject(): Promise<{ path: string; content: string } | null>
  exportPng(args: { defaultName: string; dataURL: string }): Promise<string | null>
}

declare global {
  interface Window {
    api: Api
  }
}

export {}
