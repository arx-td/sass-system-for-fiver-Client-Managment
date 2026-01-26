import { app, BrowserWindow, shell, ipcMain, Notification, Menu, Tray } from 'electron';
import * as path from 'path';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = process.env.NODE_ENV === 'development';
// Production URL - Update 'codereve' with your actual Vercel project name
const frontendUrl = isDev
  ? 'http://localhost:3000'
  : process.env.FRONTEND_URL || 'https://codereve.vercel.app';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'CodeReve',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    titleBarStyle: 'default',
    autoHideMenuBar: !isDev,
  });

  // Load the frontend
  mainWindow.loadURL(frontendUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();

    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle window close
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      // On macOS, hide the window instead of closing
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray() {
  // Create system tray icon
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show CodeReve',
      click: () => {
        mainWindow?.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('CodeReve Management System');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

// IPC handlers
ipcMain.handle('show-notification', async (_, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({ title, body });
    notification.show();
    notification.on('click', () => {
      mainWindow?.show();
    });
    return true;
  }
  return false;
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (error) {
    console.error('Update check failed:', error);
    return null;
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Check for updates on startup
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up tray icon
  tray?.destroy();
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  if (Notification.isSupported()) {
    new Notification({
      title: 'Update Available',
      body: `Version ${info.version} is available and will be downloaded.`,
    }).show();
  }
});

autoUpdater.on('update-downloaded', (info) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'Update Ready',
      body: `Version ${info.version} has been downloaded. Restart to install.`,
    });
    notification.show();
    notification.on('click', () => {
      autoUpdater.quitAndInstall();
    });
  }
});

autoUpdater.on('error', (error) => {
  console.error('Auto-updater error:', error);
});
