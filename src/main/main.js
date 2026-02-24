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
  desktopCapturer,
  systemPreferences,
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

function getPlatformForUpdate() {
  if (process.platform === "darwin") return "macos";
  if (process.platform === "win32") return "windows";
  if (process.platform === "linux") return "linux";
  return null;
}

function getApiOrigin(apiBase) {
  try {
    return new URL(apiBase).origin;
  } catch (e) {
    return "https://api-teamfocus.risosi.com";
  }
}

async function downloadAndInstallUpdate(release, apiBase) {
  const apiOrigin = getApiOrigin(apiBase);
  const downloadPath = release.downloadUrl
    ? (release.downloadUrl.startsWith("http") ? release.downloadUrl : apiOrigin + release.downloadUrl)
    : apiOrigin + "/api/v1/applications/download/" + (release.id || release._id);
  const fileName = release.fileName || "TeamFocus-Update." + (release.fileType || "exe");
  const savePath = path.join(app.getPath("temp"), fileName);

  try {
    const res = await fetch(downloadPath, { redirect: "follow" });
    if (!res.ok) throw new Error("Download failed: " + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(savePath, buf);
    const opened = await shell.openPath(savePath);
    if (opened) {
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Update downloaded",
        message: "The installer could not be opened automatically.",
        detail: "Saved to: " + savePath,
      });
    }
  } catch (err) {
    console.error("[TeamFocus] Download update error:", err);
    dialog.showMessageBox(mainWindow || null, {
      type: "error",
      title: "Download failed",
      message: "Could not download the update.",
      detail: (err && err.message) || "Please try again or download from the website.",
    });
    const frontendUrl = (config && config.frontendUrl) || "https://teamfocus.risosi.com";
    shell.openExternal(frontendUrl.replace(/\/$/, "") + "/desktop");
  }
}

async function checkForUpdate() {
  const platform = getPlatformForUpdate();
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
      const { response: btn } = await dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Update available",
        message: "Version " + latestVersion + " is available.",
        detail: "Download and install now, or open the website to download manually.",
        buttons: ["Download and install", "Later"],
        defaultId: 0,
        cancelId: 1,
      });
      if (btn === 0) {
        await downloadAndInstallUpdate(release, apiBase);
      }
    } else {
      dialog.showMessageBox(mainWindow || null, {
        type: "info",
        title: "Check for update",
        message: "You're up to date.",
        detail: "You're running the latest version (" + currentVersion + ").",
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
  });

  ipcMain.handle("capture-screen", async (_event, options) => {
    const doCapture = async () => {
      const displays = screen.getAllDisplays();
      if (!displays || displays.length === 0) {
        throw new Error("No displays available for capture.");
      }

      const displayIndex =
        options && typeof options.displayIndex === "number"
          ? options.displayIndex
          : 0;
      const targetDisplay =
        displays[Math.max(0, Math.min(displayIndex, displays.length - 1))];

      const scale = typeof targetDisplay.scaleFactor === "number" ? targetDisplay.scaleFactor : 1;
      const size = targetDisplay.size || { width: 1280, height: 720 };
      const rawW = Math.max(1, Math.round(size.width * scale));
      const rawH = Math.max(1, Math.round(size.height * scale));
      const maxDim = 2560;
      const scaleDown = Math.max(rawW, rawH) > maxDim ? maxDim / Math.max(rawW, rawH) : 1;
      const thumbnailSize = {
        width: Math.max(1, Math.round(rawW * scaleDown)),
        height: Math.max(1, Math.round(rawH * scaleDown)),
      };

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize,
        fetchWindowIcons: false,
      });

      const displayIdStr = targetDisplay && targetDisplay.id != null ? String(targetDisplay.id) : null;
      const match =
        (displayIdStr
          ? sources.find(
              (s) =>
                s &&
                (s.display_id === displayIdStr || s.displayId === displayIdStr),
            )
          : null) ||
        sources[displayIndex] ||
        sources[0];

      if (!match || !match.thumbnail || match.thumbnail.isEmpty()) {
        throw new Error("Screen capture failed. No image returned.");
      }

      const png = match.thumbnail.toPNG();
      return Uint8Array.from(png).buffer;
    };

    try {
      if (process.platform === "darwin" && systemPreferences && systemPreferences.getMediaAccessStatus) {
        const status = systemPreferences.getMediaAccessStatus("screen");
        if (status !== "granted") {
          const hint = "On macOS: open System Settings > Privacy & Security > Screen Recording and add TeamFocus, then restart the app.";
          throw new Error("Screen recording permission not granted. " + hint);
        }
      }

      try {
        return await doCapture();
      } catch (retryErr) {
        if (process.platform === "darwin" && retryErr.message && retryErr.message.indexOf("No image returned") !== -1) {
          await new Promise((r) => setTimeout(r, 800));
          return await doCapture();
        }
        throw retryErr;
      }
    } catch (err) {
      console.error("[TeamFocus] capture-screen error:", err);
      const msg = err && err.message ? err.message : "Screen capture failed.";
      if (msg.indexOf("permission not granted") !== -1 || msg.indexOf("On macOS:") !== -1) {
        throw err;
      }
      const isWindows = process.platform === "win32";
      const hint = isWindows
        ? "On Windows: open Settings > Privacy & security > Screen recording (or Graphics capture) and ensure TeamFocus is allowed. If you just installed, try restarting the app."
        : "If TeamFocus already has Screen Recording permission: fully quit the app (Cmd+Q), toggle Screen Recording off then on for TeamFocus in System Settings, then reopen TeamFocus.";
      throw new Error(msg + " " + hint);
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
