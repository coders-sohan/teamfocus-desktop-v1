const {
  app,
  BrowserWindow,
  screen,
  ipcMain,
  Menu,
  dialog,
  safeStorage,
  shell,
  Tray,
  nativeImage,
} = require("electron");
const path = require("path");
const fs = require("fs");
const config = require("./config");

const TOKEN_FILENAME = "teamfocus_token.encrypted";
const PREFS_FILENAME = "teamfocus_preferences.json";

function getTokenPath() {
  return path.join(app.getPath("userData"), TOKEN_FILENAME);
}

function getPrefsPath() {
  return path.join(app.getPath("userData"), PREFS_FILENAME);
}

function loadPreferences() {
  try {
    const p = getPrefsPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const prefs = JSON.parse(raw);
      return {
        openAtLogin: !!prefs.openAtLogin,
      };
    }
  } catch (err) {
    console.error("[TeamFocus] loadPreferences error:", err);
  }
  return { openAtLogin: false };
}

function savePreferences(prefs) {
  try {
    fs.writeFileSync(getPrefsPath(), JSON.stringify(prefs), "utf8");
  } catch (err) {
    console.error("[TeamFocus] savePreferences error:", err);
  }
}

let preferences = loadPreferences();

function registerSecureStorageIPC() {
  ipcMain.handle("secure-storage-get-token", async () => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return null;
      }
      const tokenPath = getTokenPath();
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      const encrypted = fs.readFileSync(tokenPath);
      return safeStorage.decryptString(encrypted);
    } catch (err) {
      console.error("[TeamFocus] secure-storage getToken error:", err);
      return null;
    }
  });

  ipcMain.handle("secure-storage-set-token", async (_event, token) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return false;
      }
      const tokenPath = getTokenPath();
      if (!token || token === "") {
        if (fs.existsSync(tokenPath)) {
          fs.unlinkSync(tokenPath);
        }
        return true;
      }
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(tokenPath, encrypted);
      return true;
    } catch (err) {
      console.error("[TeamFocus] secure-storage setToken error:", err);
      return false;
    }
  });

  ipcMain.handle("secure-storage-remove-token", async () => {
    try {
      const tokenPath = getTokenPath();
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }
      return true;
    } catch (err) {
      console.error("[TeamFocus] secure-storage removeToken error:", err);
      return false;
    }
  });
}

if (require("electron-squirrel-startup")) {
  app.quit();
}

let mainWindow;
let tray = null;
let quitting = false;

function parseVersion(v) {
  if (!v || typeof v !== "string") return [0, 0, 0];
  return v
    .replace(/^v/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

async function checkForUpdate() {
  const platform =
    process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : null;
  const currentVersion = require("../../package.json").version || "0.0.0";
  const apiBase =
    (config && config.apiBaseUrl) || "https://api-teamfocus.risosi.com/api/v1";
  const frontendUrl =
    (config && config.frontendUrl) || "https://teamfocus.risosi.com";

  if (!platform) {
    dialog.showMessageBox(mainWindow || null, {
      type: "info",
      title: "Check for update",
      message: "Updates are not available for this platform.",
      detail: "Please visit the download page to get the latest version.",
    });
    return;
  }

  try {
    const url = `${apiBase.replace(/\/$/, "")}/applications/latest/${platform}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        res.status === 404 ? "No release found" : `HTTP ${res.status}`,
      );
    }
    const data = await res.json();
    const release = data && data.release;
    const latestVersion = release && release.version;

    if (!latestVersion) {
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Check for update",
        message: "No update information available.",
        detail: "Please visit the download page to get the latest version.",
      });
      return;
    }

    if (isNewerVersion(latestVersion, currentVersion)) {
      const frontendDesktop = `${frontendUrl.replace(/\/$/, "")}/desktop`;
      shell.openExternal(frontendDesktop);
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Update available",
        message: `Version ${latestVersion} is available.`,
        detail:
          "A new tab has been opened. Download the update from the TeamFocus website.",
      });
    } else {
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Check for update",
        message: "You're up to date.",
        detail: `You're running the latest version (${currentVersion}).`,
      });
    }
  } catch (err) {
    console.error("[TeamFocus] Check for update error:", err);
    dialog.showMessageBox(mainWindow || null, {
      type: "info",
      title: "Check for update",
      message: "Could not check for updates.",
      detail: "Please visit the download page to get the latest version.",
    });
    const frontendDesktop = `${frontendUrl.replace(/\/$/, "")}/desktop`;
    shell.openExternal(frontendDesktop);
  }
}

function setApplicationMenu(win) {
  const isDev = !app.isPackaged;
  const helpSubmenu = [
    {
      label: "About this app",
      click: () => {
        dialog.showMessageBox(win, {
          type: "info",
          title: "About TeamFocus",
          message: "TeamFocus",
          detail: "Time & activity tracking for remote teams by RISOSI.",
        });
      },
    },
    {
      label: "Check for update",
      click: checkForUpdate,
    },
    { type: "separator" },
    { label: "Quit app", role: "quit" },
  ];
  const template = [
    {
      label: "Help",
      submenu: helpSubmenu,
    },
  ];
  if (isDev) {
    template.unshift({
      label: "View",
      submenu: [
        { label: "Toggle Developer Tools", role: "toggleDevTools" },
        { label: "Reload", role: "reload" },
      ],
    });
  }
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerScreenshotIPC() {
  ipcMain.handle("get-displays", async () => {
    const all = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    const isPrimary = (d) => d.id === primary.id;

    if (process.platform !== "win32") {
      const sorted = [...all].sort((a, b) => (isPrimary(a) ? 0 : 1) - (isPrimary(b) ? 0 : 1));
      return sorted.map((d, i) => ({
        index: i,
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor,
        primary: isPrimary(d),
        screenId: null,
      }));
    }

    let screenshotDesktop;
    try {
      screenshotDesktop = require("screenshot-desktop");
    } catch (e) {
      return all.map((d, i) => ({
        index: i,
        id: d.id,
        bounds: d.bounds,
        workArea: d.workArea,
        scaleFactor: d.scaleFactor,
        primary: isPrimary(d),
        screenId: null,
      }));
    }

    let libDisplays = [];
    try {
      libDisplays = await screenshotDesktop.listDisplays();
    } catch (err) {
      console.warn("[TeamFocus] listDisplays failed, using Electron order:", err);
    }

    function matchBounds(eBounds, libD) {
      const ex = eBounds.x;
      const ey = eBounds.y;
      const ew = eBounds.width;
      const eh = eBounds.height;
      const lx = libD.left;
      const ly = libD.top;
      const lw = libD.width;
      const lh = libD.height;
      return Math.abs(ex - lx) <= 2 && Math.abs(ey - ly) <= 2 && Math.abs(ew - lw) <= 2 && Math.abs(eh - lh) <= 2;
    }

    const withScreenId = all.map((d) => {
      const lib = libDisplays.find((ld) => matchBounds(d.bounds, ld));
      return {
        electron: d,
        primary: isPrimary(d),
        screenId: lib ? lib.id : null,
      };
    });

    const sorted = withScreenId.sort((a, b) => (a.primary ? 0 : 1) - (b.primary ? 0 : 1));
    return sorted.map((d, i) => ({
      index: i,
      id: d.electron.id,
      bounds: d.electron.bounds,
      workArea: d.electron.workArea,
      scaleFactor: d.electron.scaleFactor,
      primary: d.primary,
      screenId: d.screenId,
    }));
  });

  ipcMain.handle("capture-screen", async (_event, options) => {
    let screenshotDesktop;
    try {
      screenshotDesktop = require("screenshot-desktop");
    } catch (e) {
      console.error(
        "[TeamFocus] screenshot-desktop not installed. Run: yarn add screenshot-desktop",
      );
      throw new Error(
        "Screenshot capture not available. Install with: yarn add screenshot-desktop",
      );
    }
    const screenId = options && typeof options.screenId === "string" && options.screenId.length > 0
      ? options.screenId
      : null;
    const displayIndex =
      options && typeof options.displayIndex === "number"
        ? options.displayIndex
        : 0;
    const screenOption = screenId != null ? screenId : displayIndex;
    try {
      const buffer = await screenshotDesktop({ screen: screenOption });
      return buffer;
    } catch (err) {
      console.error("[TeamFocus] capture-screen error:", err);
      const isWindows = process.platform === "win32";
      const isEnonent = err && err.code === "ENOENT";
      const hint = isWindows
        ? (isEnonent
          ? "A required file may be missing — try reinstalling the app. You can also open Privacy & security and ensure TeamFocus is allowed for screen recording."
          : "Open Settings > Privacy & security > Screen recording (or Graphics capture) and ensure TeamFocus is allowed. If you just installed, try restarting the app.")
        : "On macOS: open System Settings > Privacy & Security > Screen Recording and add TeamFocus.";
      throw new Error(
        (err && err.message ? err.message : "Screen capture failed.") + " " + hint,
      );
    }
  });
}

function registerActiveWindowIPC() {
  ipcMain.handle("get-active-window", async () => {
    let activeWindowFn;
    try {
      const activeWin = require("active-win");
      activeWindowFn = activeWin.activeWindow || activeWin.default;
      if (typeof activeWindowFn !== "function") {
        console.error("[TeamFocus] active-win: expected activeWindow function");
        return null;
      }
    } catch (e) {
      console.error(
        "[TeamFocus] active-win not installed. Run: yarn add active-win",
      );
      return null;
    }
    try {
      const result = await activeWindowFn();
      if (!result) return null;
      const owner = result.owner || result;
      return {
        appName: owner.name ? owner.name : "",
        windowTitle: result.title || "",
        url: result.url || "",
      };
    } catch (err) {
      console.error("[TeamFocus] getActiveWindow error:", err);
      return null;
    }
  });
}

function getTrayIconPath() {
  const iconPath = path.join(__dirname, "../../assets/teamfocus.png");
  if (fs.existsSync(iconPath)) return iconPath;
  return path.join(__dirname, "../renderer/assets/teamfocus.png");
}

function updateTrayMenu() {
  if (!tray) return;
  const showWindow = () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  };
  const template = [
    { label: "Show Window", click: showWindow },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  if (tray) return;
  const iconPath = getTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.warn("[TeamFocus] Tray icon not found at", iconPath);
    return;
  }
  tray = new Tray(icon);
  tray.setToolTip("TeamFocus");
  const showWindow = () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  };
  tray.on("click", showWindow);
  tray.on("double-click", showWindow);
  updateTrayMenu();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "TeamFocus - Time & activity tracking for remote teams by RISOSI",
    icon: path.join(__dirname, "../../assets/teamfocus.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("did-finish-load", () => {
    const apiBase =
      (config && config.apiBaseUrl) ||
      "https://api-teamfocus.risosi.com/api/v1";
    const safeUrl = JSON.stringify(
      String(apiBase).trim() || "https://api-teamfocus.risosi.com/api/v1",
    );
    mainWindow.webContents.executeJavaScript(
      "window.API_BASE_URL = " +
        safeUrl +
        "; window.dispatchEvent(new Event('teamfocus-api-ready'));",
    );
  });

  mainWindow.on("minimize", (e) => {
    e.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on("close", (e) => {
    if (quitting) return;
    if (tray && tray.isDestroyed() === false) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  setApplicationMenu(mainWindow);
  createTray();
}

function registerOpenPrivacyIPC() {
  ipcMain.handle("open-privacy-settings", () => {
    if (process.platform === "win32") {
      shell.openExternal("ms-settings:privacy");
    } else if (process.platform === "darwin") {
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    }
  });
}

function registerAppLifecycleIPC() {
  ipcMain.handle("get-auto-launch", () => {
    try {
      return Promise.resolve(app.getLoginItemSettings().openAtLogin);
    } catch (e) {
      return Promise.resolve(false);
    }
  });

  ipcMain.handle("set-auto-launch", (_event, enabled) => {
    try {
      app.setLoginItemSettings({ openAtLogin: !!enabled });
      preferences.openAtLogin = !!enabled;
      savePreferences(preferences);
      return Promise.resolve(true);
    } catch (e) {
      console.error("[TeamFocus] setLoginItemSettings error:", e);
      return Promise.resolve(false);
    }
  });
}

app.on("ready", () => {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  preferences = loadPreferences();
  try {
    app.setLoginItemSettings({ openAtLogin: preferences.openAtLogin });
  } catch (e) {
    console.warn("[TeamFocus] setLoginItemSettings on ready:", e);
  }

  registerScreenshotIPC();
  registerActiveWindowIPC();
  registerSecureStorageIPC();
  registerOpenPrivacyIPC();
  registerAppLifecycleIPC();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault();
  });
});
