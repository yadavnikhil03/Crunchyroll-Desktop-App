const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  shell,
  screen,
  session,
  components,
} = require("electron");
const path = require("path");
const { config, isDomainAllowed, isInternalNavigation } = require("./config");
const settings = require("./settings");
const discord = require("./discord");

let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
} catch {
  // electron-updater may not be available in dev
}

const BOUNDS_SAVE_DELAY = 400;
const CR_PARTITION = "persist:crunchyroll";
const DRM_PERMISSIONS = new Set(["media", "mediaKeySystem", "fullscreen"]);
const BLOCKED_PERMISSIONS = new Set([
  "geolocation",
  "notifications",
  "midi",
  "midiSysex",
  "hid",
  "serial",
  "usb",
  "idle-detection",
  "display-capture",
  "window-management",
]);

let mainWindow = null;
let webContentsView = null;
let appWebContents = null;
let boundsTimer = null;
let isQuitting = false;
let settingsOpen = false;
let isLoading = false;
let discordEnabled = false;


const hardwareAccelEnabled = settings.get("hardwareAcceleration", config.hardwareAcceleration);
if (!hardwareAccelEnabled) {
  app.disableHardwareAcceleration();
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function send(channel, ...args) {
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isDestroyed()
  ) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function updateViewBounds() {
  if (!mainWindow || mainWindow.isDestroyed() || !webContentsView) return;

  const bounds = mainWindow.getContentBounds();
  const isFullScreen = mainWindow.isFullScreen();
  const y = isFullScreen ? 0 : 48;
  const height = Math.max(0, bounds.height - y);
  const width = Math.max(0, bounds.width - (settingsOpen ? 380 : 0));

  // Keep a real viewport even while the splash is showing. A 0x0 surface
  // prevents Widevine from initializing when a watch page is restored.
  webContentsView.setBounds({ x: 0, y, width, height });
  if (typeof webContentsView.setVisible === "function") {
    webContentsView.setVisible(!isLoading);
  }
}

function restoreBounds() {
  const { width, height, minWidth, minHeight } = config.window;
  const saved = settings.get("windowBounds", null);

  if (
    !saved ||
    !Number.isFinite(saved.width) ||
    !Number.isFinite(saved.height)
  ) {
    return { width, height };
  }

  const bounds = {
    width: Math.max(saved.width, minWidth),
    height: Math.max(saved.height, minHeight),
  };

  if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    const area = screen.getDisplayMatching({
      x: saved.x,
      y: saved.y,
      width: bounds.width,
      height: bounds.height,
    }).workArea;
    const visible =
      saved.x < area.x + area.width &&
      saved.x + bounds.width > area.x &&
      saved.y < area.y + area.height &&
      saved.y + bounds.height > area.y;
    if (visible) {
      bounds.x = saved.x;
      bounds.y = saved.y;
    }
  }

  return bounds;
}


function allowDrmPermission(permission) {
  if (DRM_PERMISSIONS.has(permission)) return true;
  return !BLOCKED_PERMISSIONS.has(permission);
}

function configureCrunchyrollSession(ses) {
  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(allowDrmPermission(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) =>
    allowDrmPermission(permission),
  );
}

async function ensureWidevine() {
  if (!components || typeof components.whenReady !== "function") {
    console.error(
      "Widevine components API is missing. Install the CastLabs Electron build.",
    );
    return;
  }

  try {
    const required = components.WIDEVINE_CDM_ID
      ? [components.WIDEVINE_CDM_ID]
      : undefined;
    await components.whenReady(required);
  } catch (err) {
    console.error("Widevine CDM failed to install:", err);
  }

  try {
    const status = components.status?.();
    const cdm = status?.[components.WIDEVINE_CDM_ID];
    if (cdm && !cdm.version) {
      console.error("Widevine CDM is registered but has no version installed.");
    } else if (status) {
      console.log("Widevine components ready:", status);
    }
  } catch (err) {
    console.error("Unable to read Widevine status:", err);
  }
}

function saveBounds() {
  if (boundsTimer) clearTimeout(boundsTimer);
  boundsTimer = setTimeout(() => {
    boundsTimer = null;
    if (
      !mainWindow ||
      mainWindow.isDestroyed() ||
      mainWindow.isMinimized() ||
      mainWindow.isFullScreen()
    )
      return;
    settings.set("windowBounds", mainWindow.getNormalBounds());
    settings.set("windowMaximized", mainWindow.isMaximized());
  }, BOUNDS_SAVE_DELAY);
  boundsTimer.unref?.();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#0F0F0F",
    icon: path.join(__dirname, "..", "..", "assets", "icon.ico"),
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      webviewTag: false,
    },
  });

  if (settings.get("windowMaximized", false)) {
    mainWindow.maximize();
  }

  mainWindow.loadFile(
    path.join(__dirname, "..", "..", "dist", "renderer", "index.html"),
  );

  webContentsView = new WebContentsView({
    webPreferences: {
      partition: CR_PARTITION,
      preload: path.join(__dirname, "crunchyroll-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
  });

  mainWindow.contentView.addChildView(webContentsView);
  appWebContents = webContentsView.webContents;

  appWebContents.setWindowOpenHandler(({ url }) => {
    if (isDomainAllowed(url)) {
      appWebContents.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  appWebContents.on("will-navigate", (event, url) => {
    if (!isDomainAllowed(url)) {
      event.preventDefault();
    }
  });

  appWebContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const history = appWebContents.navigationHistory;
    const key = input.key;
    const keyLower = key.toLowerCase();

    // Navigation: Alt+Left / Alt+Right
    if (input.alt && key === "ArrowLeft") {
      if (history.canGoBack()) history.goBack();
      event.preventDefault();
    } else if (input.alt && key === "ArrowRight") {
      if (history.canGoForward()) history.goForward();
      event.preventDefault();
    }
    // Reload: F5 / Ctrl+R
    else if (key === "F5" || (input.control && keyLower === "r")) {
      appWebContents.reload();
      event.preventDefault();
    }
    // Fullscreen: F11
    else if (key === "F11") {
      if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
    // Zoom: Ctrl+Plus / Ctrl+Minus / Ctrl+0
    else if (input.control && (key === "=" || key === "+")) {
      const current = appWebContents.getZoomLevel();
      appWebContents.setZoomLevel(Math.min(current + 0.5, 5));
      event.preventDefault();
    } else if (input.control && key === "-") {
      const current = appWebContents.getZoomLevel();
      appWebContents.setZoomLevel(Math.max(current - 0.5, -5));
      event.preventDefault();
    } else if (input.control && key === "0") {
      appWebContents.setZoomLevel(0);
      event.preventDefault();
    }
    // Home: Ctrl+Home
    else if (input.control && key === "Home") {
      appWebContents.loadURL(config.homeUrl);
      event.preventDefault();
    }
    else if (!input.control && !input.alt && !input.meta) {
      const isMediaKey = [" ", "f", "m", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(keyLower);
      if (isMediaKey) {
        appWebContents.executeJavaScript(`
          (function() {
            if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return false;
            const video = document.querySelector('video');
            if (!video) return false;
            
            switch('${keyLower}') {
              case ' ': video.paused ? video.play() : video.pause(); return true;
              case 'f': document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen(); return true;
              case 'm': video.muted = !video.muted; return true;
              case 'arrowleft': video.currentTime = Math.max(0, video.currentTime - 10); return true;
              case 'arrowright': video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); return true;
              case 'arrowup': video.volume = Math.min(1, video.volume + 0.1); return true;
              case 'arrowdown': video.volume = Math.max(0, video.volume - 0.1); return true;
            }
            return false;
          })();
        `).then((handled) => {
        }).catch(() => {});
      }
    }
  });

  configureCrunchyrollSession(appWebContents.session);

  const relay = (eventStr, ...args) => send(`view:${eventStr}`, ...args);

  appWebContents.on("did-navigate", (e, url) => relay("did-navigate", { url }));
  appWebContents.on("did-navigate-in-page", (e, url, isMainFrame) => {
    relay("did-navigate-in-page", { url, isMainFrame });
  });
  appWebContents.on("media-started-playing", () =>
    relay("media-started-playing"),
  );
  appWebContents.on("media-paused", () => relay("media-paused"));
  appWebContents.on(
    "did-fail-load",
    (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
      relay("did-fail-load", { errorCode, errorDescription, isMainFrame });
    },
  );
  appWebContents.on("dom-ready", () => {
    relay("dom-ready");
  });
  appWebContents.on("enter-html-full-screen", () =>
    relay("enter-html-full-screen"),
  );
  appWebContents.on("leave-html-full-screen", () =>
    relay("leave-html-full-screen"),
  );
  appWebContents.on("render-process-gone", () => relay("render-process-gone"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    updateViewBounds();
  });

  mainWindow.on("maximize", () => {
    send("window-state", "maximized");
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("unmaximize", () => {
    send("window-state", "normal");
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("enter-full-screen", () => {
    send("window-state", "fullscreen");
    updateViewBounds();
  });

  mainWindow.on("leave-full-screen", () => {
    send("window-state", mainWindow.isMaximized() ? "maximized" : "normal");
    updateViewBounds();
  });

  mainWindow.on("resize", () => {
    saveBounds();
    updateViewBounds();
  });

  mainWindow.on("move", saveBounds);

  mainWindow.on("app-command", (_, command) => {
    if (!appWebContents || appWebContents.isDestroyed()) return;
    const history = appWebContents.navigationHistory;

    if (command === "browser-backward" && history.canGoBack()) {
      history.goBack();
    } else if (command === "browser-forward" && history.canGoForward()) {
      history.goForward();
    }
  });

  mainWindow.on("close", () => {
    if (boundsTimer) {
      clearTimeout(boundsTimer);
      boundsTimer = null;
    }
    if (!mainWindow.isMinimized() && !mainWindow.isFullScreen()) {
      settings.set("windowBounds", mainWindow.getNormalBounds());
      settings.set("windowMaximized", mainWindow.isMaximized());
    }
    settings.flush();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    webContentsView = null;
    appWebContents = null;
  });

  discordEnabled = settings.get("discordEnabled", config.discord.enabled);
  if (discordEnabled && config.discord.appId) {
    discord.init(config.discord.appId);
  }

  updateViewBounds();
}

app.on("web-contents-created", (_, contents) => {
  if (contents === mainWindow?.webContents) {
    contents.setWindowOpenHandler(({ url }) => {
      if (isDomainAllowed(url)) shell.openExternal(url);
      return { action: "deny" };
    });
    contents.on("will-navigate", (event) => {
      event.preventDefault();
    });
  }
});

ipcMain.handle("view:scrape", async (_, script) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    try {
      return await appWebContents.executeJavaScript(script);
    } catch {}
  }
  return null;
});

ipcMain.handle("view:reload", () => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    appWebContents.reload();
  }
});

ipcMain.handle("view:load-url", (_, url) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    appWebContents.loadURL(url);
  }
});

ipcMain.handle("view:insert-css", (_, css) => {
  if (appWebContents && !appWebContents.isDestroyed()) {
    return appWebContents.insertCSS(css);
  }
});

ipcMain.handle("view:set-settings-open", (_, isOpen) => {
  settingsOpen = isOpen;
  updateViewBounds();
});

ipcMain.handle("view:set-is-loading", (_, loading) => {
  isLoading = loading;
  updateViewBounds();
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
});

ipcMain.handle("window:is-maximized", () => mainWindow?.isMaximized() ?? false);

ipcMain.handle("settings:get", (_, key) => settings.get(key));

ipcMain.handle("settings:set", (_, key, value) => {
  settings.set(key, value);
});

ipcMain.handle("settings:get-hardware-accel", () =>
  settings.get("hardwareAcceleration", config.hardwareAcceleration),
);

ipcMain.handle("settings:set-hardware-accel", (_, enabled) => {
  settings.set("hardwareAcceleration", enabled === true);
  settings.flush();
});

ipcMain.handle("app:restart", () => {
  settings.flush();
  app.relaunch();
  app.exit(0);
});

ipcMain.handle("app:get-config", () => ({
  allowedDomains: config.allowedDomains,
  homeUrl: config.homeUrl,
  version: app.getVersion(),
  discordEnabled: config.discord.enabled,
  discordConfigured: !!(config.discord.appId),
}));

ipcMain.handle("app:get-start-url", () => {
  const resume = settings.get("resumeSession", false);
  if (resume) {
    const saved = settings.get("lastUrl", null);
    return typeof saved === "string" &&
      isDomainAllowed(saved) &&
      !isInternalNavigation(saved)
      ? saved
      : config.homeUrl;
  }
  return config.homeUrl;
});

ipcMain.handle("app:set-last-url", (_, url) => {
  if (
    typeof url === "string" &&
    isDomainAllowed(url) &&
    !isInternalNavigation(url)
  ) {
    settings.set("lastUrl", url);
  }
});

ipcMain.handle("discord:update", (_, activity) => {
  if (discordEnabled) discord.updatePresence(activity);
});

ipcMain.handle("discord:get-enabled", () => {
  return settings.get("discordEnabled", config.discord.enabled);
});

ipcMain.handle("discord:set-enabled", async (_, enabled) => {
  const wasEnabled = discordEnabled;
  discordEnabled = enabled === true;
  settings.set("discordEnabled", discordEnabled);

  if (discordEnabled && !wasEnabled && config.discord.appId) {
    discord.init(config.discord.appId);
  } else if (!discordEnabled && wasEnabled) {
    await discord.shutdown();
  }
});

ipcMain.handle("cache:clear", async () => {
  try {
    const ses = session.fromPartition(CR_PARTITION);
    await ses.clearStorageData();
    await ses.clearCache();
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle("shell:open-external", (_, url) => {
  if (typeof url !== "string") return;
  let protocol;
  try {
    ({ protocol } = new URL(url));
  } catch {
    return;
  }
  if (protocol === "https:" || protocol === "http:") {
    shell.openExternal(url);
  }
});

let updateCheckPromise = null;

function checkForUpdates(manual = false) {
  if (!autoUpdater) return Promise.resolve({ status: "unavailable" });

  if (updateCheckPromise) return updateCheckPromise;

  updateCheckPromise = new Promise((resolve) => {
    const onUpdateAvailable = () => {
      cleanup();
      autoUpdater.downloadUpdate();
      resolve({ status: "available" });
    };
    const onUpdateNotAvailable = () => {
      cleanup();
      resolve({ status: "up-to-date" });
    };
    const onError = (err) => {
      cleanup();
      resolve({ status: "error", error: err.message });
    };

    const cleanup = () => {
      autoUpdater.off("update-available", onUpdateAvailable);
      autoUpdater.off("update-not-available", onUpdateNotAvailable);
      autoUpdater.off("error", onError);
      updateCheckPromise = null;
    };

    autoUpdater.once("update-available", onUpdateAvailable);
    autoUpdater.once("update-not-available", onUpdateNotAvailable);
    autoUpdater.once("error", onError);

    try {
      if (manual) {
        autoUpdater.checkForUpdates();
      } else {
        autoUpdater.checkForUpdatesAndNotify();
      }
    } catch (err) {
      cleanup();
      resolve({ status: "error", error: err.message });
    }
  });

  return updateCheckPromise;
}

ipcMain.handle("app:check-for-updates", () => checkForUpdates(true));

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  configureCrunchyrollSession(session.fromPartition(CR_PARTITION));
  await ensureWidevine();
  createWindow();
  checkForUpdates();
});

app.on("before-quit", async (event) => {
  if (isQuitting) return;
  event.preventDefault();
  isQuitting = true;

  settings.flush();
  await discord.shutdown();
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
