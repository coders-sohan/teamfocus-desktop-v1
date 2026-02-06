const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  getDisplays: () => ipcRenderer.invoke("get-displays"),
  captureScreen: (options) => ipcRenderer.invoke("capture-screen", options),
  getActiveWindow: () => ipcRenderer.invoke("get-active-window"),
  getSecureToken: () => ipcRenderer.invoke("secure-storage-get-token"),
  setSecureToken: (token) => ipcRenderer.invoke("secure-storage-set-token", token),
  removeSecureToken: () => ipcRenderer.invoke("secure-storage-remove-token"),
  getAutoLaunch: () => ipcRenderer.invoke("get-auto-launch"),
  setAutoLaunch: (enabled) => ipcRenderer.invoke("set-auto-launch", enabled),
});
