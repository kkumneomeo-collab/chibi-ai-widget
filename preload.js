const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  setWidgetScale: (scale, isMenuOpen) => ipcRenderer.send('set-widget-scale', scale, isMenuOpen),
});
