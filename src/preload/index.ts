import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  saveProject: (args: { content: string; knownPath?: string; defaultName?: string }) =>
    ipcRenderer.invoke('project:save', args),
  openProject: () => ipcRenderer.invoke('project:open'),
  exportPng: (args: { defaultName: string; dataURL: string }) => ipcRenderer.invoke('png:export', args)
})
