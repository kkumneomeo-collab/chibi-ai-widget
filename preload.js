const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  isElectron: true,
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  setWindowMode: (mode) => ipcRenderer.send('window-set-mode', mode),
  onWindowModeChanged: (cb) => ipcRenderer.on('window-mode-changed', (_, mode) => { if (typeof cb === 'function') cb(mode); }),
  moveWindowBy: (dx, dy) => ipcRenderer.send('window-move-by', dx, dy),
  setWidgetScale: (scale, isMenuOpen) => ipcRenderer.send('set-widget-scale', scale, isMenuOpen),
  openDownloadsFolder: () => ipcRenderer.send('open-downloads-folder'),
  showItemInFolder: (path) => ipcRenderer.send('show-item-in-folder', path),
  setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  setPetVisible: (visible) => ipcRenderer.send('set-pet-visible', visible),
  openMainWindow: () => ipcRenderer.send('open-main-window')
});
