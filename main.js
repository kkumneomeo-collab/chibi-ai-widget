const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');

process.on('uncaughtException', (err) => {
  console.error('[Nooki Main Process Error]:', err.message);
});

// Automatically start embedded Nooki Wi-Fi Drop Server in background
try {
  require('./server.js');
} catch (err) {
  console.log('Embedded server check:', err.message);
}

let mainWindow = null;
let petWindow = null;
let currentScale = 1.0;
let isMenuOpen = false;

function getDimensions(scale, menu) {
  const s = Math.max(0.5, scale || 1.0);
  const baseW = Math.round(280 * s);
  const baseH = Math.round(360 * s);
  const menuW = Math.max(390, Math.round(390 * s));
  const menuH = Math.max(540, Math.round(540 * s));

  return {
    w: menu ? menuW : baseW,
    h: menu ? menuH : baseH
  };
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const defaultW = Math.min(1140, Math.max(960, Math.round(screenWidth * 0.8)));
  const defaultH = Math.min(780, Math.max(660, Math.round(screenHeight * 0.82)));
  const posX = Math.max(20, Math.round((screenWidth - defaultW) / 2));
  const posY = Math.max(20, Math.round((screenHeight - defaultH) / 2));

  mainWindow = new BrowserWindow({
    width: defaultW,
    height: defaultH,
    minWidth: 480,
    minHeight: 520,
    x: posX,
    y: posY,
    // Mac: real native window (native traffic lights, resize, zoom, full screen).
    // Other systems keep the old frameless look.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 16 }, transparent: false, backgroundColor: '#f8f6fe' }
      : { frame: false, transparent: true, backgroundColor: '#00000000' }),
    alwaysOnTop: false,
    resizable: true,
    hasShadow: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'),
    process.platform === 'darwin' ? { query: { chrome: 'native' } } : undefined);

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('window-mode-changed', 'dashboard');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.showInactive();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  const { w, h } = getDimensions(currentScale, isMenuOpen);

  const posX = Math.max(20, screenWidth - w - 24);
  const posY = Math.max(20, screenHeight - h - 30);

  petWindow = new BrowserWindow({
    width: w,
    height: h,
    x: posX,
    y: posY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  try {
    petWindow.setAlwaysOnTop(true, 'floating');
  } catch (_) {}

  if (process.platform === 'darwin') {
    try {
      petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (_) {}
  }

  petWindow.loadFile(path.join(__dirname, 'index.html'), {
    search: 'window=pet',
    hash: 'pet',
    query: { window: 'pet' }
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });
}

// IPC Handlers
ipcMain.on('window-minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.minimize();
});

ipcMain.on('window-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('window-close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) win.close();
});

ipcMain.on('open-main-window', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('set-pet-visible', (_, visible) => {
  if (!petWindow || petWindow.isDestroyed()) {
    if (visible) createPetWindow();
    return;
  }
  if (visible) {
    petWindow.showInactive();
  } else {
    petWindow.hide();
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(ignore, options);
  }
});

ipcMain.on('window-move-by', (event, deltaX, deltaY) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  win.setPosition(Math.round(x + (deltaX || 0)), Math.round(y + (deltaY || 0)));
});

ipcMain.on('window-set-mode', (_, mode) => {
  if (mode === 'dashboard') {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  } else if (mode === 'mini') {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
    }
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.showInactive();
    }
  }
});

ipcMain.on('set-widget-scale', (event, scale, menuState) => {
  const targetWin = petWindow && !petWindow.isDestroyed() ? petWindow : BrowserWindow.fromWebContents(event.sender);
  if (!targetWin || targetWin.isDestroyed()) return;
  currentScale = scale || 1.0;
  // The floating pet has no menus of its own any more, so its window always keeps the
  // pet size. (Before, opening Settings / Styling Studio in the dashboard made the pet
  // window grow, which made the floating pet jump to another place.)
  isMenuOpen = false;

  const { w: newW, h: newH } = getDimensions(currentScale, isMenuOpen);
  const bounds = targetWin.getBounds();
  const newX = bounds.x + (bounds.width - newW);
  const newY = bounds.y + (bounds.height - newH);

  targetWin.setBounds({
    x: newX,
    y: newY,
    width: newW,
    height: newH
  }, false);
});

ipcMain.on('open-downloads-folder', () => {
  try {
    const dlPath = path.join(app.getPath('downloads'), 'NookiDrop');
    if (!fs.existsSync(dlPath)) fs.mkdirSync(dlPath, { recursive: true });
    shell.openPath(dlPath);
  } catch (_) {}
});

ipcMain.on('show-item-in-folder', (_, filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  } catch (_) {}
});

// Send the mouse position to the Nooki windows so the companion's eyes can
// follow the pointer anywhere on the screen (read only, about 12 times a second).
let lastCursorKey = '';
function startCursorFeed() {
  setInterval(() => {
    try {
      const p = screen.getCursorScreenPoint();
      const key = p.x + ',' + p.y;
      if (key === lastCursorKey) return;
      lastCursorKey = key;
      [petWindow, mainWindow].forEach((win) => {
        if (!win || win.isDestroyed() || !win.isVisible()) return;
        const b = win.getContentBounds();
        win.webContents.send('cursor-pos', p.x - b.x, p.y - b.y);
      });
    } catch (_) {}
  }, 80);
}

app.whenReady().then(() => {
  createWindow();
  createPetWindow();
  startCursorFeed();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createPetWindow();
    } else if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
