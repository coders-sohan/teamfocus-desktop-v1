const { contextBridge, ipcRenderer, desktopCapturer, screen } = require("electron");

function sortDisplaysPrimaryFirst(displays) {
  const primary = screen.getPrimaryDisplay();
  const isPrimary = (d) => d && primary && d.id === primary.id;
  return [...displays].sort((a, b) => (isPrimary(a) ? 0 : 1) - (isPrimary(b) ? 0 : 1));
}

async function captureScreenFallback(options) {
  // Fallback capture path (especially useful on Windows) that does NOT rely on screenshot-desktop batch files.
  // Uses Electron's desktopCapturer thumbnails.
  if (!desktopCapturer || !screen) throw new Error("desktopCapturer not available");
  const displays = sortDisplaysPrimaryFirst(screen.getAllDisplays());
  const idx = options && typeof options.displayIndex === "number" ? options.displayIndex : 0;
  const display = displays[Math.max(0, Math.min(idx, displays.length - 1))];
  const scale = typeof display.scaleFactor === "number" ? display.scaleFactor : 1;
  const size = display && display.size ? display.size : { width: 1280, height: 720 };
  const thumbnailSize = {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
    fetchWindowIcons: false,
  });

  // Try to match by display id first (best effort); otherwise use index order.
  const displayIdStr = display && display.id != null ? String(display.id) : null;
  const match =
    (displayIdStr
      ? sources.find((s) => s && (s.display_id === displayIdStr || s.displayId === displayIdStr))
      : null) || sources[idx] || sources[0];

  if (!match || !match.thumbnail || match.thumbnail.isEmpty()) {
    throw new Error("Fallback capture failed");
  }
  const png = match.thumbnail.toPNG(); // Buffer
  // Return ArrayBuffer-compatible (ipc/structured clone friendly) data
  return Uint8Array.from(png).buffer;
}

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
  openPrivacySettings: () => ipcRenderer.invoke("open-privacy-settings"),
  captureScreenFallback: (options) => captureScreenFallback(options || {}),
});
