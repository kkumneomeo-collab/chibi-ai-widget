const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;

let currentScale = 1.0;
let isMenuOpen = false;

function getDimensions(scale, menu) {
  const baseW = Math.round(180 * scale);
  const baseH = Math.round(200 * scale);
  const menuW = Math.max(260, Math.round(250 * scale));
  const menuH = Math.max(340, Math.round(360 * scale));

  return {
    w: menu ? menuW : baseW,
    h: menu ? menuH : baseH
  };
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const { w, h } = getDimensions(currentScale, isMenuOpen);
  const posX = Math.max(20, screenWidth - w - 40);
  const posY = Math.max(20, screenHeight - h - 40);

  mainWindow = new BrowserWindow({
    width: w,
    height: h,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // Dynamic window resizing driven by mouse scale
  ipcMain.on('set-widget-scale', (_, scale, menuState) => {
    if (!mainWindow) return;
    currentScale = scale || 1.0;
    isMenuOpen = !!menuState;

    const { w: newW, h: newH } = getDimensions(currentScale, isMenuOpen);

    const bounds = mainWindow.getBounds();
    const newX = bounds.x + (bounds.width - newW);
    const newY = bounds.y + (bounds.height - newH);

    mainWindow.setBounds({
      x: newX,
      y: newY,
      width: newW,
      height: newH
    }, false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
