import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Show native notification
  showNotification: (title: string, body: string) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  },

  // Get app version
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },

  // Check for updates
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },

  // Platform detection
  platform: process.platform,

  // Is running in Electron
  isElectron: true,
});

// TypeScript declaration for the exposed API
declare global {
  interface Window {
    electronAPI?: {
      showNotification: (title: string, body: string) => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<any>;
      platform: string;
      isElectron: boolean;
    };
  }
}
